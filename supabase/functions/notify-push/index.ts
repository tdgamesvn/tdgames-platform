// notify-push — bắn Web Push khi có row mới trong public.notifications.
// Trigger: on_notification_push (migration 20260822110000_push_subscriptions.sql).
//
// ponytail: dùng npm:web-push thay vì tự ký VAPID + mã hoá aes128gcm bằng WebCrypto
// (~150 dòng crypto tự viết là chỗ tệ nhất để tiết kiệm dependency). Nếu edge runtime
// bung vì node-compat, thay bằng `jsr:@negrel/webpush` — cùng khái niệm, API Deno thuần.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return json({ skipped: true });
    }

    const publicKey  = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      console.error('VAPID keys not set');
      return json({ error: 'VAPID keys not set' }, 503);
    }
    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_CONTACT_EMAIL') || 'tdgames.vn@gmail.com'}`,
      publicKey,
      privateKey,
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Không tin payload: đọc lại notification từ DB (sửa 2026-08-26) ─────────
    // Trước đây function lấy thẳng recipient_user_id / title / body / link từ body request
    // mà không kiểm gì. Trigger DB gọi nó kèm `Authorization: Bearer <ANON_KEY>` — anon key
    // nằm trong bundle JS công khai nên KHÔNG chứng minh được danh tính, tức ai cũng giả
    // được lời gọi đó:
    //   curl -X POST .../notify-push -d '{"type":"INSERT","table":"notifications","record":
    //     {"id":"x","recipient_user_id":"<uid>","title":"Phiếu lương mới","link":"https://evil/"}}'
    // ⇒ push hiện trên điện thoại nhân viên MANG DANH app TD Games (VAPID key thật, icon
    // thật), dẫn tới link bất kỳ. Push từ app nội bộ đáng tin hơn email nhiều nên đây là
    // phishing chất lượng cao.
    //
    // Cách chặn rẻ nhất không phải thêm secret rồi sửa trigger, mà là bỏ tin payload: chỉ
    // lấy `id`, còn nội dung đọc từ bảng `notifications` bằng service_role. Kẻ tấn công
    // không bịa được nội dung nữa.
    // ponytail: vẫn replay được — gọi lại với id có thật thì push đó gửi lần nữa. Vô hại
    // (đúng nội dung, đúng người). Cần chặn hẳn thì thêm x-push-secret vào cả hàm
    // trigger_notify_push() lẫn đây.
    const recordId = (payload.record as { id?: string } | undefined)?.id;
    if (!recordId) return json({ skipped: true, reason: 'missing record id' });

    const { data: record, error: recErr } = await supabase
      .from('notifications')
      .select('id, recipient_user_id, title, body, link')
      .eq('id', recordId)
      .single();

    if (recErr || !record) return json({ skipped: true, reason: 'notification not found' });

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', record.recipient_user_id);

    if (error) {
      console.error('Query subscriptions failed:', error);
      return json({ error: 'Query failed' }, 500);
    }
    if (!subs?.length) return json({ sent: 0, reason: 'no subscription' });

    const appUrl = (Deno.env.get('APP_URL') || 'https://app.tdgamestudio.com').replace(/\/$/, '');
    const link   = !record.link ? appUrl
      : record.link.startsWith('http') ? record.link
      : `${appUrl}/${record.link.replace(/^\//, '')}`;

    const message = JSON.stringify({
      title: record.title,
      // OS push hiện text thuần — body dùng chung với email nên có <strong>, phải gỡ tag.
      body:  (record.body || '').replace(/<[^>]*>/g, ''),
      link,
      tag:   record.id,
    });

    // Endpoint chết (user gỡ app / xoá quyền) → Google/Apple trả 404|410, dọn luôn
    // để lần sau khỏi bắn vào hư không.
    const dead: string[] = [];
    let sent = 0;

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error('Push failed:', code, (e as Error)?.message);
      }
    }));

    if (dead.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', dead);
    }

    return json({ sent, pruned: dead.length });
  } catch (e) {
    console.error('notify-push error:', e);
    return json({ error: (e as Error)?.message ?? 'unknown' }, 500);
  }
});
