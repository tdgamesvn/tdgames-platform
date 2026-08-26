import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SEPAY_BASE_URL = Deno.env.get("SEPAY_BASE_URL") || "https://einvoice-api.sepay.vn";
const SEPAY_CLIENT_ID = Deno.env.get("SEPAY_CLIENT_ID") || "";
const SEPAY_CLIENT_SECRET = Deno.env.get("SEPAY_CLIENT_SECRET") || "";
const SEPAY_PROVIDER_ACCOUNT_ID = Deno.env.get("SEPAY_PROVIDER_ACCOUNT_ID") || "";
const SEPAY_TEMPLATE_CODE = Deno.env.get("SEPAY_TEMPLATE_CODE") || "1";
const SEPAY_INVOICE_SERIES = Deno.env.get("SEPAY_INVOICE_SERIES") || "C26TTD";

// Trước đây gác bằng `x-api-key` = VITE_SEPAY_API_KEY. Vite nhúng mọi biến VITE_* vào bundle
// JS công khai ⇒ ai mở devtools trên app.tdgamestudio.com cũng đọc được, tức là KHÔNG có auth.
// (Còn tệ hơn: có fallback cứng "tdgames-sepay-2026" trong source nếu env trống.)
// Giờ dùng session token thật + kiểm role như send-invoice-email.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Chỉ admin / ke_toan được gọi — khớp quyền vào app Invoice.
 * Đọc `app_metadata`, KHÔNG phải `user_metadata` (user_metadata do chính người dùng ghi được).
 * Trả null nếu hợp lệ, trả Response lỗi nếu không.
 */
async function requireStaff(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return jsonRes({ error: "Unauthorized: thiếu Authorization header" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return jsonRes({ error: "Unauthorized: token không hợp lệ" }, 401);

  const meta = (user.app_metadata || {}) as Record<string, unknown>;
  const roles = [meta.role, ...(Array.isArray(meta.secondary_roles) ? meta.secondary_roles : [])];
  if (!roles.some((r) => r === "admin" || r === "ke_toan")) {
    return jsonRes({ error: "Forbidden: cần quyền admin hoặc ke_toan" }, 403);
  }
  return null;
}

// Token cache
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const credentials = btoa(`${SEPAY_CLIENT_ID}:${SEPAY_CLIENT_SECRET}`);
  const res = await fetch(`${SEPAY_BASE_URL}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  cachedToken = data.data?.access_token || data.access_token;
  if (!cachedToken) throw new Error("No access_token in response");
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken;
}

async function listProviderAccounts() {
  const token = await getAccessToken();
  const res = await fetch(`${SEPAY_BASE_URL}/v1/provider-accounts?page=1&per_page=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.json();
}

async function createDraft(payload: Record<string, unknown>) {
  const token = await getAccessToken();
  payload.provider_account_id = SEPAY_PROVIDER_ACCOUNT_ID;
  payload.template_code = SEPAY_TEMPLATE_CODE;
  payload.invoice_series = SEPAY_INVOICE_SERIES;
  payload.is_draft = true;
  const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: true, sepay_status: res.status, sepay_response: data, sent_payload: payload,
      config: { base_url: SEPAY_BASE_URL, provider_account_id: SEPAY_PROVIDER_ACCOUNT_ID ? '***set***' : '***EMPTY***', template_code: SEPAY_TEMPLATE_CODE, invoice_series: SEPAY_INVOICE_SERIES, client_id: SEPAY_CLIENT_ID ? '***set***' : '***EMPTY***' }
    };
  }
  return data;
}

async function checkStatus(trackingCode: string) {
  const token = await getAccessToken();
  const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/create/check/${trackingCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(`SePay check error (${res.status}): ${errorMsg}`);
  }
  return data;
}

// Get invoice detail by reference_code
// Returns the raw SePay response with normalized status
async function getInvoiceDetail(referenceCode: string) {
  const token = await getAccessToken();
  const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/${referenceCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[get-invoice-detail] GET /v1/invoices/${referenceCode} => ${res.status}`);

  if (res.status === 404) {
    return { data: { status: 'deleted', reference_code: referenceCode, _deleted: true } };
  }

  const data = await res.json();
  console.log(`[get-invoice-detail] Response:`, JSON.stringify(data).substring(0, 500));

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(`SePay detail error (${res.status}): ${errorMsg}`);
  }

  // Normalize: document_type 3 = cancelled/deleted
  const inv = data?.data || data;
  if (inv.document_type === 3 || inv.status === 'cancelled') {
    inv.status = 'cancelled';
  }

  return data;
}

// Try to get PDF content as Base64 from SePay API
async function trySePayDownload(identifier: string, label: string): Promise<string | null> {
  try {
    const token = await getAccessToken();
    console.log(`[download] Trying ${label}: ${identifier}`);
    const res = await fetch(`${SEPAY_BASE_URL}/v1/invoices/${identifier}/download?type=pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.content) {
        console.log(`[download] Success via ${label}`);
        return data.data.content;
      }
    }
    const errText = await res.text().catch(() => '');
    console.log(`[download] ${label} failed: ${res.status} ${errText.substring(0, 200)}`);
  } catch (e) {
    console.log(`[download] ${label} error:`, e);
  }
  return null;
}

async function debugConfig() {
  let tokenStatus = 'not tested';
  let tokenError = '';
  try { await getAccessToken(); tokenStatus = 'success'; } catch (e) { tokenStatus = 'failed'; tokenError = e instanceof Error ? e.message : String(e); }
  let providerAccounts = null;
  try { providerAccounts = await listProviderAccounts(); } catch (e) { providerAccounts = { error: e instanceof Error ? e.message : String(e) }; }
  return {
    config: { base_url: SEPAY_BASE_URL, client_id_set: !!SEPAY_CLIENT_ID, provider_account_id: SEPAY_PROVIDER_ACCOUNT_ID, template_code: SEPAY_TEMPLATE_CODE, invoice_series: SEPAY_INVOICE_SERIES },
    token: { status: tokenStatus, error: tokenError },
    provider_accounts: providerAccounts,
  };
}

// ── GET handler: tải PDF (client fetch kèm Bearer rồi tự dựng blob) ──
// Bỏ hẳn nhánh fallback `pdf_url`: nó nhận URL tuỳ ý từ query rồi fetch hộ và trả nội dung
// về ⇒ SSRF. Xoá tham số là hết đường, không cần allowlist.
async function handleGet(url: URL): Promise<Response> {
  const action = url.searchParams.get('action');
  if (action !== 'download-pdf') return jsonRes({ error: 'Only download-pdf supported via GET' }, 400);

  const referenceCode = url.searchParams.get('reference_code') || '';
  const trackingCode = url.searchParams.get('tracking_code') || '';
  // Chặn CR/LF + dấu nháy: filename đi thẳng vào header Content-Disposition.
  const filename = (url.searchParams.get('filename') || 'eInvoice').replace(/[^\w.-]/g, '_');

  let base64: string | null = null;
  if (referenceCode) base64 = await trySePayDownload(referenceCode, 'reference_code');
  if (!base64 && trackingCode) base64 = await trySePayDownload(trackingCode, 'tracking_code');

  if (!base64) {
    return jsonRes({ error: 'All download methods failed' }, 500);
  }

  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      'Content-Length': String(bytes.length),
    },
  });
}

// ── Main handler ──
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const denied = await requireStaff(req);
  if (denied) return denied;

  if (req.method === 'GET') {
    try {
      return await handleGet(new URL(req.url));
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { action, payload } = body;
    let result: unknown;
    switch (action) {
      case 'create-draft': result = await createDraft(payload || {}); break;
      case 'check-status':
        if (!payload?.tracking_code) throw new Error('tracking_code is required');
        result = await checkStatus(payload.tracking_code); break;
      case 'get-invoice-detail':
        if (!payload?.reference_code) throw new Error('reference_code is required');
        result = await getInvoiceDetail(payload.reference_code); break;
      case 'list-accounts': result = await listProviderAccounts(); break;
      case 'debug': result = await debugConfig(); break;
      default: throw new Error(`Unknown action: ${action}`);
    }
    return jsonRes(result, 200);
  } catch (err) {
    return jsonRes({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
