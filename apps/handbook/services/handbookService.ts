import { supabase } from '@/services/supabaseClient';
import { HandbookCategory, HandbookArticle } from '@/types';

// ── Categories ─────────────────────────────────────────────────

export async function fetchCategories(): Promise<HandbookCategory[]> {
  const { data, error } = await supabase
    .from('handbook_categories')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(
  payload: Pick<HandbookCategory, 'title' | 'icon' | 'order_index'>,
): Promise<HandbookCategory> {
  const { data, error } = await supabase
    .from('handbook_categories')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  payload: Partial<Pick<HandbookCategory, 'title' | 'icon' | 'order_index'>>,
): Promise<HandbookCategory> {
  const { data, error } = await supabase
    .from('handbook_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('handbook_categories').delete().eq('id', id);
  if (error) throw error;
}

// ── Articles ───────────────────────────────────────────────────

export async function fetchArticles(
  categoryId?: string,
  publishedOnly = false,
): Promise<HandbookArticle[]> {
  let q = supabase
    .from('handbook_articles')
    .select('*')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (categoryId) q = q.eq('category_id', categoryId);
  if (publishedOnly) q = q.eq('is_published', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createArticle(
  payload: Pick<HandbookArticle, 'category_id' | 'title' | 'content' | 'is_published' | 'is_required' | 'order_index' | 'created_by'>,
): Promise<HandbookArticle> {
  const { data, error } = await supabase
    .from('handbook_articles')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateArticle(
  id: string,
  payload: Partial<Pick<HandbookArticle, 'title' | 'content' | 'is_published' | 'is_required' | 'order_index' | 'category_id'>>,
): Promise<HandbookArticle> {
  const { data, error } = await supabase
    .from('handbook_articles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('handbook_articles').delete().eq('id', id);
  if (error) throw error;
}

// ── Onboarding ──────────────────────────────────────────────────

/** Fetch tất cả bài published + is_required = true, dùng cho OnboardingScreen */
export async function fetchRequiredArticles(): Promise<HandbookArticle[]> {
  const { data, error } = await supabase
    .from('handbook_articles')
    .select('*')
    .eq('is_required', true)
    .eq('is_published', true)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Kiểm tra xem nhân viên có cần làm onboarding không.
 * Returns true nếu: có required articles + onboarding_completed_at IS NULL
 */
export async function checkOnboardingNeeded(employeeId: string): Promise<boolean> {
  const [{ data: emp }, { count: artsCount }] = await Promise.all([
    supabase
      .from('hr_employees')
      .select('onboarding_completed_at')
      .eq('id', employeeId)
      .single(),
    supabase
      .from('handbook_articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_required', true)
      .eq('is_published', true),
  ]);
  if (!emp) return false;
  if (emp.onboarding_completed_at) return false; // đã hoàn thành rồi
  return (artsCount ?? 0) > 0;
}

/**
 * Submit acknowledgments sau khi nhân viên tick xong tất cả bài bắt buộc.
 * Insert vào hr_onboarding_acknowledgments + set onboarding_completed_at.
 */
export async function submitOnboardingAcks(
  employeeId: string,
  articleIds: string[],
): Promise<void> {
  // Insert acknowledgments (upsert để safe nếu gọi 2 lần)
  if (articleIds.length > 0) {
    const rows = articleIds.map(article_id => ({ employee_id: employeeId, article_id }));
    const { error: ackErr } = await supabase
      .from('hr_onboarding_acknowledgments')
      .upsert(rows, { onConflict: 'employee_id,article_id' });
    if (ackErr) throw ackErr;
  }
  // Mark employee onboarding done
  const { error: empErr } = await supabase
    .from('hr_employees')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', employeeId);
  if (empErr) throw empErr;
}
