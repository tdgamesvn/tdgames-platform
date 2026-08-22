#!/usr/bin/env bash
# Kiểm tra mã key Mật Bảo (hóa đơn đầu vào) trước khi tích hợp.
# Dùng:  bash scripts/matbao-check.sh '<mã key>'
# ponytail: script dùng 1 lần để chốt method GET/POST + xác minh key, xoá được sau khi tích hợp xong.
set -u

KEY="${1:-}"
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"   # ponytail: key copy/paste hay dính space
BASE="${MATBAO_BASE_URL:-https://api-hoadondauvao.matbao.in}"

if [ -z "$KEY" ]; then
  echo "Thiếu mã key. Dùng: bash scripts/matbao-check.sh '<mã key>'" >&2
  exit 1
fi

echo "== Base URL: $BASE"

# ── 1. Đổi mã key → JWT ───────────────────────────────────────
AUTH=$(curl -s -X POST "$BASE/auth/token" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$KEY\"}")

JWT=$(printf '%s' "$AUTH" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
print(d.get("Data", "") if d.get("Success") else "")
' 2>/dev/null)

if [ -z "$JWT" ]; then
  echo "== [1] LẤY TOKEN: THẤT BẠI"
  echo "$AUTH"
  echo
  echo ">> Key chưa dùng được. Vào https://demo.matbao.in (hoặc trang quản lý prod)"
  echo "   -> Quản lý hóa đơn đầu vào -> Kích hoạt -> Lưu cấu hình, rồi chạy lại."
  exit 2
fi
echo "== [1] LẤY TOKEN: OK  (jwt ${#JWT} ký tự)"

# ── 2. Thử 2 endpoint: load-data (kho Mật Bảo) vs load-data-tct (kéo từ TCT) ──
FROM="${MATBAO_FROM:-$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)}"
TO=$(date +%Y-%m-%d)
COMMON="\"comName\":\"\",\"comTaxCode\":\"\",\"no\":0,\"fromDateYMD\":\"$FROM\",\"toDateYMD\":\"$TO 23:59:59\",\"trangthai\":-1,\"pattern\":\"\",\"serial\":\"\",\"typeDataPDF\":0"
echo "== [2] Lấy hóa đơn từ $FROM đến $TO"

OUT=$(mktemp -d)
for M in load-data load-data-tct; do
  # load-data dùng typeSearchDate, load-data-tct dùng loaihoadon
  if [ "$M" = load-data ]; then BODY="{$COMMON,\"typeSearchDate\":0}"; else BODY="{$COMMON,\"loaihoadon\":-1}"; fi
  CODE=$(curl -s -o "$OUT/$M.json" -w '%{http_code}' -X POST \
    "$BASE/hoa-don-dau-vao/$M" \
    -H "Authorization: Bearer $JWT" \
    -H 'Content-Type: application/json' \
    -d "$BODY")
  SUMMARY=$(python3 -c '
import sys, json
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("(không phải JSON)"); sys.exit()
data = d.get("Data")
n = len(data) if isinstance(data, list) else "-"
print(f'"'"'Success={d.get("Success")} ErrorCode={d.get("ErrorCode")} số_hóa_đơn={n}'"'"')
if not d.get("Success"):
    print("   Data:", str(data)[:200])
elif isinstance(data, list) and data:
    print("   Mẫu 1 hóa đơn:")
    print(json.dumps(data[0], ensure_ascii=False, indent=2)[:2000])
' "$OUT/$M.json")
  echo "   $M  http=$CODE  $SUMMARY"
done

echo
echo "== Kết quả lưu ở: $OUT"
echo ">> Gửi lại toàn bộ output phía trên cho Claude (KHÔNG cần gửi mã key)."
