import { supabase } from '@/services/supabaseClient';

export interface CrmStudio {
  id: number;
  studio_name: string;
  apollo_id: string | null;
  country: string | null;
  domain: string | null;
  careers_link: string | null;
  source: 'hiring' | 'discovered' | 'both';
  bd_status: 'uncontacted' | 'outreached' | 'responding' | 'proposal' | 'client';
  contacts_found: number;
  processed_at: string | null;
  discovered_at: string | null;
  created_at: string;
  updated_at: string;
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

  const { data, error, count } = await query;
  if (error) throw error;
  return { studios: (data ?? []) as CrmStudio[], total: count ?? 0 };
}

export async function fetchStudioStats(): Promise<StudioStats | null> {
  const { data, error } = await supabase
    .from('crm_studios')
    .select('bd_status, source');
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

export { PAGE_SIZE as STUDIO_PAGE_SIZE };
