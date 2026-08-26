// ai-format-scope — chuyển mô tả phạm vi công việc dạng thô thành HTML song ngữ
// cho ĐIỀU II của hợp đồng khách hàng (CRM > Tạo hợp đồng).
// LLM qua endpoint OpenAI-compatible ở LLM_API_BASE.
//
// ⚠ `verify_jwt = true` KHÔNG phải bảo vệ: anon key cũng là JWT hợp lệ và nằm sẵn trong bundle
// JS công khai ⇒ trước đây đây là proxy LLM miễn phí cho cả Internet, đốt `LLM_API_KEY` của
// công ty (20.000 ký tự vào / 8.000 token ra mỗi lượt). Guard dưới bắt user thật + role CRM.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Quyền khớp app CRM (nơi duy nhất gọi hàm này): admin / ke_toan. Đọc `app_metadata`. */
async function requireStaff(req: Request): Promise<Response | null> {
  const deny = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return deny('Unauthorized: thiếu Authorization header', 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return deny('Unauthorized: token không hợp lệ', 401);

  const meta = (user.app_metadata || {}) as Record<string, unknown>;
  const roles = [meta.role, ...(Array.isArray(meta.secondary_roles) ? meta.secondary_roles : [])];
  if (!roles.some((r) => r === 'admin' || r === 'ke_toan' || r === 'bd')) {
    return deny('Forbidden: cần quyền CRM (admin/ke_toan/bd)', 403);
  }
  return null;
}

type Lang = 'both' | 'vi' | 'en';

const buildPrompt = (L: Lang) => {
  const ngonNgu = L === 'vi'
    ? `NGON NGU: CHI tieng Viet. Tuyet doi khong chen tieng Anh.`
    : L === 'en'
    ? `NGON NGU: CHI tieng Anh. Tuyet doi khong chen tieng Viet.`
    : `NGON NGU: song ngu. Moi doan/muc viet cau tieng Anh in nghieng truoc, xuong dong, roi cau tieng Viet.`;

  return `Ban la tro ly soan thao hop dong cua TD Games Company Limited.
Nhiem vu: chuan hoa mo ta pham vi cong viec thanh HTML sach de chen vao
DIEU II - PHAM VI CONG VIEC cua hop dong dich vu.

${ngonNgu}

QUY TAC BAT BUOC:
1. CHI tra ve HTML fragment. Khong markdown, khong dau \`\`\`, khong <html>/<body>/<style>/<script>.
2. GIU NGUYEN 100% so lieu, don gia, thanh tien, ten rieng, ten game, deliverable,
   so luong. TUYET DOI KHONG bia them va KHONG bo sot bat ky hang muc nao.
3. NEU dau vao da co cau truc (danh sach danh so, bang bao gia): GIU NGUYEN cau truc
   va thu tu do. Chi chuan hoa dinh dang, KHONG viet lai thanh khuon khac.
4. NEU dau vao co BANG (bao gia, hang muc, chi phi): BAT BUOC giu nguyen bang duoi
   dang <table><tr><th>/<td>, du so dong va du cot. Khong duoc chuyen bang thanh
   gach dau dong.
5. Neu dau vao la ghi chu tho khong co cau truc: gom thanh cac muc danh so
   2.1, 2.2, 2.3... moi muc co tieu de in dam roi noi dung.
6. Chi dung the: p, ul, ol, li, strong, b, em, i, br, span, table, thead, tbody,
   tr, th, td, h3, h4.
7. KHONG dat font-family, font-size, color, background trong style - hop dong tu
   ap dinh dang. Chi duoc dung style cho border/padding/text-align neu la bang.
8. Khong viet dieu khoan thanh toan, tien do, bao mat, phat hop dong - cac dieu
   khac da lo.
9. Van phong hop dong: trang trong, cau ngan, khong marketing.`;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const denied = await requireStaff(req);
  if (denied) return denied;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { text, lang } = await req.json();
    if (typeof text !== 'string' || text.trim().length < 10) {
      return json({ error: 'Cần ít nhất 10 ký tự nội dung scope.' }, 400);
    }
    if (text.length > 20000) {
      return json({ error: 'Nội dung quá dài (tối đa 20.000 ký tự).' }, 400);
    }

    const apiKey = Deno.env.get('LLM_API_KEY');
    const apiBase = Deno.env.get('LLM_API_BASE');
    // ponytail: bắt buộc set env, không fallback ngầm — default cũ trỏ 9Router (đã chết 10/07)
    // khiến lỗi cấu hình hiện ra thành 502 khó đoán thay vì báo thẳng.
    if (!apiKey || !apiBase) {
      return json({ error: 'LLM_API_KEY / LLM_API_BASE chưa được cấu hình.' }, 500);
    }

    const res = await fetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get('LLM_MODEL') || 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: buildPrompt((lang === 'vi' || lang === 'en') ? lang : 'both') },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      return json({ error: `LLM lỗi ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);
    }

    const data = await res.json();
    const html = data.choices?.[0]?.message?.content;
    if (!html) return json({ error: 'LLM không trả về nội dung.' }, 502);

    return json({ html });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
