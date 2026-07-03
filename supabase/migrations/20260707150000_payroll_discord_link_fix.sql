-- Đổi dòng "Truy cập nhanh" trong thông báo Discord bảng lương thành link bấm được
-- thẳng tới tab Portal (thay vì text thuần "app.tdgamestudio.com → Portal").

CREATE OR REPLACE FUNCTION public.notify_payroll_confirmed_discord()
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
  IF NEW.status <> 'confirmed' OR OLD.status IS NOT DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

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
    || '🔗 Truy cập nhanh: https://app.tdgamestudio.com/#portal';

  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'content', '@everyone',
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'description', _desc,
          'color',       16749824,
          'footer',      jsonb_build_object('text', 'TD Games • Phòng Hành chính - Nhân sự')
        )
      )
    )
  );

  RETURN NEW;
END;
$$;
