// Làm sạch HTML do LLM trả về trước khi nhét vào ĐIỀU II của hợp đồng.
// ponytail: regex thay vì DOM parser — input là output của chính LLM ta gọi,
// không phải nội dung từ internet. Đổi sang DOMPurify nếu về sau cho khách tự paste HTML.

const FENCE = /^\s*```(?:html)?\s*|\s*```\s*$/g;
const SCRIPT_OR_STYLE = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi;
const LONE_DANGEROUS_TAG = /<\/?(script|style|iframe|object|embed|html|head|body)\b[^>]*>/gi;
const EVENT_HANDLER = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /\s+(?:href|src)\s*=\s*(?:"|')?\s*javascript:[^"'>]*(?:"|')?/gi;

// Cac khai bao lam scope lech khoi dinh dang hop dong. Inline style luon thang
// CSS nen phai go tan goc, khong the fix bang CSS.
const FONT_DECLS = /(?:^|;)\s*(?:font-family|font-size|line-height|color|font|background(?:-color)?)\s*:[^;]*/gi;

/**
 * Chuan hoa scope paste tu ngoai vao: bo font/size/mau, giu bo cuc (border,
 * padding, text-align, width). Nho vay bang bao gia dan tu Word/Google Docs
 * hien dung font Times cua hop dong thay vi font goc.
 */
export function normalizeScopeHtml(raw: string): string {
  return cleanScopeHtml(raw).replace(
    /\sstyle\s*=\s*"([^"]*)"/gi,
    (_m, css: string) => {
      const kept = String(css).replace(FONT_DECLS, '').replace(/^\s*;+/, '').trim();
      return kept ? ` style="${kept}"` : '';
    },
  );
}

export function cleanScopeHtml(raw: string): string {
  return (raw || '')
    .replace(FENCE, '')
    .replace(SCRIPT_OR_STYLE, '')
    .replace(LONE_DANGEROUS_TAG, '')
    .replace(EVENT_HANDLER, '')
    .replace(JS_URL, '')
    .trim();
}
