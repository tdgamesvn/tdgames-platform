import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS, GET',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * GUARD (thêm 2026-08-26): chỉ cần đăng nhập hợp lệ, KHÔNG giới hạn role.
 *
 * Trước đó function này không kiểm gì cả. Hai đường khai thác:
 *  - POST: ai trên Internet cũng đẩy 20MB/lần vào R2 của công ty (kho chứa miễn phí, và
 *    file phục vụ qua domain R2 công ty nên host được nội dung độc hại dưới tên TD Games).
 *  - DELETE: nhận `key` tuỳ ý ⇒ xoá từng file trong bucket — chứng từ chi phí, ảnh CCCD
 *    nhân viên, tài liệu CRM. Đây mới là nhánh nguy nhất, mất dữ liệu không khôi phục được.
 * Chứng minh trước khi vá: POST multipart rỗng, không auth ⇒ 400 "No file..." (vào thẳng logic).
 *
 * Không lọc role vì 8 chỗ gọi trải khắp expense/accounting/crm/hr/workforce, gồm cả luồng
 * member tự upload CCCD trong ProfileTab. Lọc role là gãy hồ sơ nhân viên.
 * Cả 8 chỗ đều đã gửi `Authorization: Bearer session.access_token` nên guard không phá gì.
 */
async function requireUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized: thiếu Authorization header' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return json({ error: 'Unauthorized: token không hợp lệ' }, 401);
  return null; // hợp lệ
}

function sanitizeFilename(name: string): string {
  let safe = '';
  for (const ch of name) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 48 && code <= 57) || (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) || ch === '.' || ch === '-' || ch === '_'
    ) safe += ch;
    else if (ch === ' ') safe += '_';
  }
  return safe.slice(0, 200) || 'file';
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(
  method: string, url: string, headers: Record<string, string>,
  body: Uint8Array, accessKeyId: string, secretAccessKey: string, region: string
) {
  const u = new URL(url);
  const date = new Date();
  const dateStamp = date.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  headers['x-amz-date'] = amzDate;
  headers['x-amz-content-sha256'] = await sha256(body);

  const signedHeaderKeys = Object.keys(headers).sort().map(k => k.toLowerCase());
  const signedHeaders = signedHeaderKeys.join(';');
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}`).join('\n') + '\n';

  const canonicalRequest = [
    method, u.pathname, u.search.replace(/^\?/, ''),
    canonicalHeaders, signedHeaders, headers['x-amz-content-sha256']
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, scope,
    await sha256(new TextEncoder().encode(canonicalRequest))
  ].join('\n');

  let signingKey: ArrayBuffer = await hmacSha256(new TextEncoder().encode('AWS4' + secretAccessKey), dateStamp);
  signingKey = await hmacSha256(signingKey, region);
  signingKey = await hmacSha256(signingKey, service);
  signingKey = await hmacSha256(signingKey, 'aws4_request');

  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // GET là health check, để công khai.
  if (req.method === 'GET') {
    return json({ status: 'ok', service: 'r2-expense-upload', version: 17 });
  }

  try {
    const denied = await requireUser(req);
    if (denied) return denied;

    const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;
    const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL')!;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      return json({ error: 'R2 credentials not configured' }, 500);
    }

    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    if (req.method === 'DELETE') {
      const { key } = await req.json();
      if (!key) return json({ error: 'key is required' }, 400);

      const url = `${endpoint}/${R2_BUCKET_NAME}/${key}`;
      const headers = await signRequest(
        'DELETE', url, { host: new URL(url).host },
        new Uint8Array(0), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, 'auto'
      );

      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        console.error('[R2] Delete error:', res.status, text);
        return json({ error: 'Delete failed' }, 500);
      }
      return json({ success: true });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return json({ error: 'No file. Send multipart form with field "file"' }, 400);

    console.log('[R2] File:', file.name, 'type:', file.type, 'size:', file.size);

    if (file.size > 20 * 1024 * 1024) {
      return json({ error: 'File too large. Max 20MB.' }, 400);
    }

    const safeName = sanitizeFilename(file.name);
    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = `expense-receipts/${uniquePrefix}_${safeName}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const url = `${endpoint}/${R2_BUCKET_NAME}/${key}`;
    const contentType = file.type || 'application/octet-stream';
    const headers = await signRequest(
      'PUT', url,
      { host: new URL(url).host, 'content-type': contentType },
      fileBytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, 'auto'
    );

    console.log('[R2] Uploading to:', key);
    const res = await fetch(url, { method: 'PUT', headers, body: fileBytes });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[R2] Upload error:', res.status, errText);
      return json({ error: `Upload failed: ${res.status}`, details: errText }, 500);
    }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    console.log('[R2] Success:', publicUrl);

    return json({ success: true, url: publicUrl, key, filename: file.name, size: file.size });
  } catch (err: any) {
    console.error('[R2] Error:', err.message, err.stack);
    return json({ error: err.message }, 500);
  }
});
