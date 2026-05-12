import { supabase } from '@/services/supabaseClient';
import { CrmOutreachLead, CrmEmailLog, CrmEmailTemplate } from '@/types';
import { outreachRequest } from './outreachApi';

// ══════════════════════════════════════════════════════════════
// ── OUTREACH LEADS ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchLeads(filters?: {
  status?: string; tier?: number; source?: string; search?: string;
}): Promise<CrmOutreachLead[]> {
  let q = supabase
    .from('crm_outreach_leads')
    .select('*')
    .order('tier')
    .order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('outreach_status', filters.status);
  if (filters?.tier) q = q.eq('tier', filters.tier);
  if (filters?.source) q = q.eq('source', filters.source);
  if (filters?.search) {
    q = q.or(`contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,studio_name.ilike.%${filters.search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createLead(
  lead: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmOutreachLead> {
  const { data, error } = await supabase.from('crm_outreach_leads').insert(lead).select().single();
  if (error) throw error;
  return data;
}

export async function createLeadsBatch(
  leads: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[]
): Promise<CrmOutreachLead[]> {
  const { data, error } = await supabase.from('crm_outreach_leads').insert(leads).select();
  if (error) throw error;
  return data || [];
}

export async function updateLead(id: string, updates: Partial<CrmOutreachLead>): Promise<void> {
  const { error } = await supabase
    .from('crm_outreach_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('crm_outreach_leads').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── EMAIL TEMPLATES ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchTemplates(): Promise<CrmEmailTemplate[]> {
  const { data, error } = await supabase
    .from('crm_email_templates')
    .select('*')
    .order('delay_days');
  if (error) throw error;
  return data || [];
}

export async function updateTemplate(id: string, updates: Partial<CrmEmailTemplate>): Promise<void> {
  const { error } = await supabase
    .from('crm_email_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── EMAIL LOGS ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEmailLogs(leadId?: string): Promise<CrmEmailLog[]> {
  let q = supabase.from('crm_email_log').select('*').order('sent_at', { ascending: false });
  if (leadId) q = q.eq('lead_id', leadId);
  const { data, error } = await q.limit(100);
  if (error) throw error;
  return data || [];
}

// ══════════════════════════════════════════════════════════════
// ── PIPELINE STATS ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface PipelineStats {
  total: number;
  pending: number;
  initial_sent: number;
  followup1_sent: number;
  followup2_sent: number;
  replied: number;
  bounced: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

export async function getPipelineStats(): Promise<PipelineStats> {
  const { data, error } = await supabase
    .from('crm_outreach_leads')
    .select('outreach_status, tier');
  if (error) throw error;

  const leads = data || [];
  return {
    total: leads.length,
    pending: leads.filter(l => l.outreach_status === 'pending').length,
    initial_sent: leads.filter(l => l.outreach_status === 'initial_sent').length,
    followup1_sent: leads.filter(l => l.outreach_status === 'followup1_sent').length,
    followup2_sent: leads.filter(l => l.outreach_status === 'followup2_sent').length,
    replied: leads.filter(l => l.outreach_status === 'replied').length,
    bounced: leads.filter(l => l.outreach_status === 'bounced').length,
    tier1: leads.filter(l => l.tier === 1).length,
    tier2: leads.filter(l => l.tier === 2).length,
    tier3: leads.filter(l => l.tier === 3).length,
  };
}

// ══════════════════════════════════════════════════════════════
// ── CSV PARSER ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function parseCsvLeads(csvText: string): Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const results: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    // Support SalesQL CSV format: Work_Email, Personal_Email
    const email = row['email'] || row['work_email'] || row['personal_email'] || '';
    if (!email) continue;

    // Parse tier
    let tier = 3;
    const tierVal = (row['tier'] || '').toLowerCase();
    if (tierVal.includes('1') || tierVal.includes('⭐')) tier = 1;
    else if (tierVal.includes('2') || tierVal.includes('★')) tier = 2;

    const contactName = row['contact_name'] || row['name'] || row['full_name'] || '';
    const firstName = contactName.split(' ')[0] || '';

    results.push({
      client_id: null,
      studio_name: row['studio'] || row['studio_name'] || row['company_name'] || row['company'] || '',
      contact_name: contactName,
      first_name: firstName,
      email,
      job_title: row['job_title'] || row['title'] || row['position'] || '',
      linkedin_url: row['linkedin'] || row['linkedin_url'] || '',
      tier,
      outreach_status: 'pending',
      initial_sent_at: null,
      followup1_sent_at: null,
      followup2_sent_at: null,
      replied_at: null,
      source: 'csv_import',
      tags: [],
      notes: row['notes'] || '',
    });
  }

  return results;
}

// ══════════════════════════════════════════════════════════════
// ── FASTAPI INTEGRATION (Phase 2) ─────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function discoverContacts(company: string, domain: string): Promise<any[]> {
  const res = await outreachRequest('/api/leads/discover', {
    method: 'POST',
    body: JSON.stringify({ company, domain }),
  });
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
  return (await res.json()).contacts || [];
}

export async function sendOutreachEmail(leadId: string, templateName: string): Promise<any> {
  const res = await outreachRequest('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ lead_id: leadId, template_name: templateName }),
  });
  if (!res.ok) throw new Error(`Send failed: ${res.status}`);
  return res.json();
}
