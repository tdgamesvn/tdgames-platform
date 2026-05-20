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
