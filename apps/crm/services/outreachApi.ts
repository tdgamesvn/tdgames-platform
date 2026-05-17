import { supabase } from '@/services/supabaseClient';

/**
 * Base URL cho Outreach API.
 * - Nếu có `VITE_OUTREACH_API_URL`: gọi trực tiếp FastAPI (backend phải bật CORS cho origin CRM).
 * - Ngược lại: dùng Supabase Edge `outreach-proxy` (tránh CORS, cần deploy function + secret OUTREACH_API_URL).
 */
export function getOutreachApiBase(): string {
  const direct = (import.meta.env.VITE_OUTREACH_API_URL || '').trim().replace(/\/$/, '');
  if (direct) return direct;
  const u = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (u) return `${u}/functions/v1/outreach-proxy`;
  return '';
}

/** Gọi API outreach với session Supabase (bắt buộc cho Edge verify_jwt). */
export async function outreachRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getOutreachApiBase();
  if (!base) {
    throw new Error(
      'Outreach API chưa cấu hình: đặt VITE_OUTREACH_API_URL (FastAPI trực tiếp) hoặc VITE_SUPABASE_URL + deploy Edge Function outreach-proxy.',
    );
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (
    !headers.has('Content-Type') &&
    init.body != null &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof Blob) &&
    !(init.body instanceof ArrayBuffer)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (anon) {
    headers.set('apikey', anon);
  }
  // Abort sau 45s nếu caller không truyền signal riêng
  const signal = init.signal ?? AbortSignal.timeout(45_000);
  return fetch(url, { ...init, headers, signal });
}

/** Gọi Edge Function Supabase (vd. outreach-auto-batch) kèm JWT. */
export async function supabaseEdgeFunctionPost(functionName: string, body: unknown = {}): Promise<Response> {
  const u = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (!u) throw new Error('VITE_SUPABASE_URL chưa cấu hình');
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (anon) headers.set('apikey', anon);
  return fetch(`${u}/functions/v1/${functionName}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
