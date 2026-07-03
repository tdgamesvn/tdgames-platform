-- Fix Payroll Discord Notification — đổi từ "báo cáo tài chính nội bộ" sang
-- "thông báo cho nhân viên" (đúng mục đích thật của tính năng).
--
-- Bản trước (20260707120000) gửi tổng lương Net + tổng chi phí công ty kèm
-- @everyone — SUÝT lộ số liệu tài chính nhạy cảm ra toàn bộ nhân viên qua
-- Discord. Bản này thay bằng thông báo mời nhân viên vào Portal kiểm tra +
-- tự xác nhận phiếu lương của mình, không có số liệu tài chính nào.
--
-- Format tham khảo mẫu sếp đã dùng thủ công ở session 17 (message_id
-- 1522404138602856460): @everyone + heading + hướng dẫn 3 bước + lưu ý +
-- link Portal, dùng embed description (không phải fields) + màu brand.

CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _discord_url  text;
  _period       text;
  _desc         text;
BEGIN
  -- Chỉ fire khi status THỰC SỰ chuyển sang 'confirmed' (không fire khi update field khác,
  -- không fire khi confirmed → confirmed do save record lặt vặt)
  IF NEW.status <> 'confirmed' OR OLD.status IS NOT DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Đọc webhook URL từ app_config (SECURITY DEFINER bypasses RLS) — không gửi nếu chưa cấu hình
  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_payroll_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  _period := 'tháng ' || NEW.month || '/' || NEW.year;

  _desc :=
       '### 💰 Bảng lương ' || _period || ' đã sẵn sàng' || chr(10)
    || 'Công ty đã gửi bảng lương ' || _period || ' trên TD Games Platforms.' || chr(10)
    || chr(10)
    || 'Các bạn vui lòng truy cập app để kiểm tra và xác nhận phiếu lương của mình.' || chr(10)
    || chr(10)
    || '📌 Cần làm:' || chr(10)
    || '• Đăng nhập vào Platforms' || chr(10)
    || '• Kiểm tra chi tiết phiếu lương' || chr(10)
    || '• Bấm Xác nhận nếu thông tin chính xác' || chr(10)
    || chr(10)
    || '⚠️ Nếu có bất kỳ thắc mắc hoặc sai sót nào, vui lòng phản hồi lại trên phiếu lương hoặc inbox trực tiếp cho bộ phận Nhân sự nhé.' || chr(10)
    || chr(10)
    || '🔗 Truy cập nhanh: app.tdgamestudio.com → Portal';

  -- content = '@everyone' riêng (mention chỉ ping khi nằm trong content, không ping nếu nằm trong embed)
  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'content', '@everyone',
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'description', _desc,
          'color',       16749824, -- #FF9500 brand
          'footer',      jsonb_build_object('text', 'TD Games • Phòng Hành chính - Nhân sự')
        )
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger giữ nguyên (đã tạo ở migration trước, CREATE OR REPLACE FUNCTION là đủ để áp bản mới)
