import { getWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';

export interface CrmStudio {
  id: number;
  studio_name: string;
  apollo_id: string | null;
  country: string | null;
  domain: string | null;
  careers_link: string | null;
  source: 'hiring' | 'discovered' | 'both' | 'manual';
  bd_status: 'uncontacted' | 'outreached' | 'responding' | 'proposal' | 'client';
  contacts_found: number;
  processed_at: string | null;
  discovered_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id?: string | null;
  owner_name?: string | null;
}

export interface StudioLead {
  id: string;
  contact_name: string;
  email: string;
  job_title: string;
  outreach_status: string;
  initial_sent_at: string | null;
  replied_at: string | null;
  lead_score: number;
}

export interface StudioFilters {
  search?: string;
  country?: string;
  source?: string;
  bd_status?: string;
  // 'unclaimed' | 'claimed' (bất kỳ ai) | uuid cụ thể (đúng owner_id — dùng cho "Của tôi")
  owner?: string;
}

export interface StudioStats {
  total: number;
  uncontacted: number;
  outreached: number;
  responding: number;
  proposal: number;
  client: number;
  hiring: number;
  discovered: number;
  both: number;
}

const PAGE_SIZE = 25;

export async function fetchStudios(
  page = 0,
  filters: StudioFilters = {}
): Promise<{ studios: CrmStudio[]; total: number }> {
  let query = supabase
    .from('crm_studios')
    .select('*', { count: 'exact' })
    .eq('entity', getWorkspace())
    // Studio đã có người phụ trách nổi lên đầu danh sách (has_owner generated column), rồi mới A-Z.
    .order('has_owner', { ascending: false })
    .order('studio_name', { ascending: true })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (filters.search?.trim()) {
    query = query.ilike('studio_name', `%${filters.search.trim()}%`);
  }
  if (filters.country?.trim()) {
    query = query.ilike('country', `%${filters.country.trim()}%`);
  }
  if (filters.source === 'discovered') {
    // Apollo = studios found via Apollo (pure 'discovered' OR merged 'both')
    query = query.in('source', ['discovered', 'both']);
  } else if (filters.source === 'hiring') {
    // Hiring = studios from hiring signals (pure 'hiring' OR merged 'both')
    query = query.in('source', ['hiring', 'both']);
  } else if (filters.source === 'both') {
    // "Cả hai" = only studios that appear in BOTH sources
    query = query.eq('source', 'both');
  }
  if (filters.bd_status) {
    query = query.eq('bd_status', filters.bd_status);
  }
  if (filters.owner === 'unclaimed') {
    query = query.is('owner_id', null);
  } else if (filters.owner === 'claimed') {
    query = query.not('owner_id', 'is', null);
  } else if (filters.owner) {
    query = query.eq('owner_id', filters.owner);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { studios: (data ?? []) as CrmStudio[], total: count ?? 0 };
}

export async function fetchStudioStats(): Promise<StudioStats | null> {
  const { data, error } = await supabase
    .from('crm_studios')
    .select('bd_status, source')
    .eq('entity', getWorkspace());
  if (error) return null;

  const stats: StudioStats = {
    total: 0, uncontacted: 0, outreached: 0, responding: 0,
    proposal: 0, client: 0, hiring: 0, discovered: 0, both: 0,
  };
  (data ?? []).forEach(s => {
    stats.total++;
    stats[s.bd_status as keyof StudioStats] = (stats[s.bd_status as keyof StudioStats] as number) + 1;
    stats[s.source as keyof StudioStats] = (stats[s.source as keyof StudioStats] as number) + 1;
  });
  return stats;
}

export async function updateStudioBdStatus(id: number, bd_status: string): Promise<void> {
  const { error } = await supabase
    .from('crm_studios')
    .update({ bd_status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchLeadsByStudio(studioId: number): Promise<StudioLead[]> {
  const { data, error } = await supabase
    .from('crm_outreach_leads')
    .select('id, contact_name, email, job_title, outreach_status, initial_sent_at, replied_at, lead_score')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudioLead[];
}

// Tìm studio trùng theo tên (case-insensitive) hoặc domain, trong cùng sổ (entity).
export async function findDuplicateStudio(studioName: string, domain?: string | null): Promise<CrmStudio | null> {
  const name = studioName.trim();
  if (!name) return null;

  const byName = await supabase
    .from('crm_studios')
    .select('*')
    .eq('entity', getWorkspace())
    .ilike('studio_name', name)
    .limit(1);
  if (byName.data?.length) return byName.data[0] as CrmStudio;

  const cleanDomain = domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (cleanDomain) {
    const byDomain = await supabase
      .from('crm_studios')
      .select('*')
      .eq('entity', getWorkspace())
      .ilike('domain', cleanDomain)
      .limit(1);
    if (byDomain.data?.length) return byDomain.data[0] as CrmStudio;
  }
  return null;
}

export async function createStudio(input: {
  studio_name: string;
  country?: string;
  domain?: string;
}): Promise<CrmStudio> {
  const studio_name = input.studio_name.trim();
  if (!studio_name) throw new Error('Tên studio không được để trống');
  const domain = input.domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') || null;

  const dup = await findDuplicateStudio(studio_name, domain);
  if (dup) throw new Error(`Studio "${dup.studio_name}" đã tồn tại rồi (trùng ${dup.domain === domain && domain ? 'domain' : 'tên'})`);

  const { data, error } = await supabase
    .from('crm_studios')
    .insert({
      studio_name,
      country: input.country?.trim() || null,
      domain,
      source: 'manual',
      entity: getWorkspace(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as CrmStudio;
}

export async function assignStudioOwner(
  studioId: number,
  ownerId: string,
  ownerName: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_studios')
    .update({ owner_id: ownerId, owner_name: ownerName })
    .eq('id', studioId);
  if (error) throw error;
}

export async function releaseStudioOwner(studioId: number): Promise<void> {
  const { error } = await supabase
    .from('crm_studios')
    .update({ owner_id: null, owner_name: null })
    .eq('id', studioId);
  if (error) throw error;
}

// Danh sách studio cho ô chọn khi thêm lead: ownerId truyền vào -> chỉ studio BD đó đã nhận;
// bỏ trống (admin/ke_toan) -> toàn bộ studio trong sổ hiện tại.
// ponytail: cap 500, nâng lên server-side search nếu 1 sổ vượt mốc này.
export async function fetchStudioOptions(ownerId?: string): Promise<Pick<CrmStudio, 'id' | 'studio_name'>[]> {
  let query = supabase
    .from('crm_studios')
    .select('id, studio_name')
    .eq('entity', getWorkspace())
    .order('studio_name')
    .limit(500);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export { PAGE_SIZE as STUDIO_PAGE_SIZE };
