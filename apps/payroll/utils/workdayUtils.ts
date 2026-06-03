/**
 * Đếm số ngày làm việc (Thứ 2 – Thứ 6) trong một tháng cụ thể.
 * Dùng để xác định ngày công tiêu chuẩn khi tạo bảng lương.
 * Kết quả thường là 21, 22, hoặc 23 tuỳ lịch tháng.
 */
export function countWeekdays(year: number, month: number): number {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    const dow = date.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
    if (dow >= 1 && dow <= 5) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}
