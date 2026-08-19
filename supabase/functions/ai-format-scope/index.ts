// ai-format-scope — chuyển mô tả phạm vi công việc dạng thô thành HTML song ngữ
// cho ĐIỀU II của hợp đồng khách hàng (CRM > Tạo hợp đồng).
// LLM qua endpoint OpenAI-compatible ở LLM_API_BASE. verify_jwt = true → chỉ user đã đăng nhập.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Bạn là trợ lý soạn thảo hợp đồng của TD Games Company Limited.
Nhiệm vụ: nhận mô tả phạm vi công việc dạng thô (ghi chú, email, brief của khách) và viết lại
thành một đoạn HTML sạch, có cấu trúc, để chèn vào ĐIỀU II — PHẠM VI CÔNG VIỆC của hợp đồng
dịch vụ song ngữ Anh–Việt.

QUY TẮC BẮT BUỘC:
1. CHỈ trả về HTML fragment. Không markdown, không dấu \`\`\`, không <html>/<body>/<style>/<script>.
2. Gom công việc thành các mục đánh số 2.1, 2.2, 2.3... Mỗi mục theo đúng khuôn:
   <p style="font-weight:bold;margin:8px 0 2px">2.1 English Title / Tiêu đề tiếng Việt</p>
   <ul style="margin:0 0 6px 18px">
     <li><span style="font-style:italic">English description</span><br>Mô tả tiếng Việt</li>
   </ul>
3. Mỗi <li> phải song ngữ: câu tiếng Anh in nghiêng, xuống dòng, rồi câu tiếng Việt.
4. Giữ nguyên 100% số liệu, tên riêng, tên game, deliverable, số lượng có trong bản gốc.
   TUYỆT ĐỐI KHÔNG bịa thêm hạng mục công việc và KHÔNG bỏ sót hạng mục nào.
5. Không viết điều khoản thanh toán, tiến độ, bảo mật, phạt hợp đồng — các điều khác đã lo.
6. Chỉ dùng thẻ: p, ul, ol, li, strong, em, br, span.
7. Văn phong hợp đồng: trang trọng, câu ngắn, không marketing.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { text } = await req.json();
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
          { role: 'system', content: SYSTEM_PROMPT },
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
