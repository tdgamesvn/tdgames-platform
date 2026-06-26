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
  payload: Pick<HandbookArticle, 'category_id' | 'title' | 'content' | 'is_published' | 'order_index' | 'created_by'>,
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
  payload: Partial<Pick<HandbookArticle, 'title' | 'content' | 'is_published' | 'order_index' | 'category_id'>>,
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
