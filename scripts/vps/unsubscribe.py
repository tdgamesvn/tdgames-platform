"""
Unsubscribe helpers — CAN-SPAM / RFC 8058 compliance.

Deployed to VPS: /opt/td-mailer-api/services/unsubscribe.py
Bản gốc giữ trong repo để lần sau còn biết nó ở đâu.

Một chỗ duy nhất dựng link huỷ + footer, gọi từ sender_dispatch (footer HTML,
áp cho mọi provider) và resend_sender (header List-Unsubscribe).
"""
import os
from urllib.parse import quote

PUBLIC_BASE = os.environ.get(
    'OUTREACH_PUBLIC_URL', 'https://app.tdgamestudio.com/outreach-api'
).rstrip('/')

COMPANY_LINE = ("TD GAMES COMPANY LIMITED — Xom Ngoai, Dong Anh Commune, "
                "Hanoi, Vietnam")


def unsub_url(to_email: str) -> str:
    return f"{PUBLIC_BASE}/api/webhook/unsubscribe?email={quote(to_email or '')}"


def footer_html(to_email: str) -> str:
    url = unsub_url(to_email)
    return (
        '<div style="max-width:600px;margin:0 auto;padding:16px 10px;'
        "font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;"
        'font-size:11.5px;line-height:1.7;color:#8a8f98;text-align:center;">'
        f'{COMPANY_LINE}<br>'
        'You got this email because we thought TD Games could help your art '
        'pipeline. Not relevant? '
        f'<a href="{url}" style="color:#8a8f98;text-decoration:underline;">'
        'Unsubscribe</a> and we won\'t email you again.'
        '</div>'
    )


def with_footer(html_body: str, to_email: str) -> str:
    """Chèn footer trước </body> (fallback: nối đuôi). Idempotent."""
    if not to_email or 'webhook/unsubscribe' in (html_body or ''):
        return html_body
    foot = footer_html(to_email)
    lower = (html_body or '').lower()
    idx = lower.rfind('</body>')
    if idx == -1:
        return (html_body or '') + foot
    return html_body[:idx] + foot + html_body[idx:]


def list_unsubscribe_headers(to_email: str) -> dict:
    """RFC 8058 one-click. Endpoint phải nhận cả POST — xem routes/webhook.py."""
    if not to_email:
        return {}
    return {
        "List-Unsubscribe": f"<{unsub_url(to_email)}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


if __name__ == '__main__':
    h = with_footer('<html><body>hi</body></html>', 'a+b@x.com')
    assert h.count('Unsubscribe</a>') == 1 and h.endswith('</body></html>')
    assert 'a%2Bb%40x.com' in h, h
    assert with_footer(h, 'a+b@x.com') == h  # idempotent
    assert with_footer('<p>no body tag</p>', 'a@x.com').startswith('<p>')
    assert with_footer('<p>x</p>', '') == '<p>x</p>'
    assert list_unsubscribe_headers('a@x.com')['List-Unsubscribe'].startswith('<https://')
    print('ok')
