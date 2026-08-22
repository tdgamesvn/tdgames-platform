import { supabase } from './supabaseClient';

export interface AppNotification {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_user_id', userId)
    .eq('is_read', false);
}

// ─── Web Push ────────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Trình duyệt có hỗ trợ push không (iOS: chỉ khi app đã Thêm vào MH chính). */
export function pushSupported(): boolean {
  return !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/** Xin quyền + đăng ký subscription, lưu vào push_subscriptions.
 *  PHẢI gọi từ trong sự kiện click (iOS Safari chặn requestPermission ngoài user gesture). */
export async function enablePush(userId: string): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;

  const reg = await navigator.serviceWorker.ready;
  // ponytail: applicationServerKey nhận thẳng chuỗi base64url theo spec —
  // khỏi tự viết hàm base64url → Uint8Array. Trình duyệt quá cũ không nhận
  // chuỗi thì subscribe() ném lỗi, bắt ở caller.
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY as any }));

  const keys = sub.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw new Error('Subscription thiếu khoá mã hoá');

  // upsert theo endpoint (PK): máy dùng chung, người sau đăng nhập thì ghi đè user_id.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
  if (error) throw error;

  return 'granted';
}

/** Admin broadcast: insert one notification per user.
 *  Requires supabase service role OR an Edge Function in the future.
 *  Currently inserts for all users returned by SELECT (RLS must allow admin insert). */
export async function broadcastNotification(
  userIds: string[],
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  if (!userIds.length) return;
  const rows = userIds.map(uid => ({
    recipient_user_id: uid,
    type: 'broadcast',
    title,
    body,
    link: link || null,
  }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
}
