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
    // Escape PostgREST `.or()` filter chars: , () % * — nếu không user gõ "(" hoặc ","
    // sẽ làm broken query hoặc inject thêm clause.
    const safe = filters.search.trim().replace(/[(),%*]/g, '');
    if (safe) {
      q = q.or(`contact_name.ilike.%${safe}%,email.ilike.%${safe}%,studio_name.ilike.%${safe}%`);
    }
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

/** Validate email format theo RFC 5322 simplified — đủ catch lỗi nhập tay */
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Parse 1 dòng CSV theo RFC 4180:
 * - Hỗ trợ field bao trong dấu " (cho phép chứa dấu phẩy)
 * - Hỗ trợ escaped quote "" thành 1 dấu " bên trong
 * - Strip CR (\r) ở cuối từ file Windows/Excel
 */
function parseCsvLine(line: string): string[] {
  const cleanLine = line.replace(/\r$/, ''); // strip CR cuối nếu có
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleanLine.length; i++) {
    const ch = cleanLine[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanLine[i + 1] === '"') {
          // Escaped quote ""  →  một dấu "
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current === '') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export interface CsvParseResult {
  leads: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[];
  skipped: { line: number; reason: string }[];
}

/**
 * Parse CSV text → leads. Trả về cả leads valid và danh sách dòng skip
 * (caller có thể hiển thị warning để user biết file có lỗi gì).
 *
 * Bảo trì backward-compat: nếu caller chỉ destructure [leads], TypeScript
 * vẫn cảnh báo nhưng runtime an toàn vì giá trị return giờ là object.
 */
export function parseCsvLeads(csvText: string): CsvParseResult {
  // Hỗ trợ cả \n và \r\n; loại dòng rỗng
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { leads: [], skipped: [] };

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^['"]|['"]$/g, ''));
  const leads: Omit<CrmOutreachLead, 'id' | 'created_at' | 'updated_at'>[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    // Support SalesQL CSV format: Work_Email, Personal_Email
    const rawEmail = (row['email'] || row['work_email'] || row['personal_email'] || '').trim();
    if (!rawEmail) {
      skipped.push({ line: i + 1, reason: 'thiếu email' });
      continue;
    }

    // Validate email format — bỏ những row email rõ ràng sai để khỏi tốn quota verify
    const email = rawEmail.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      skipped.push({ line: i + 1, reason: `email không hợp lệ: ${rawEmail}` });
      continue;
    }

    // Parse tier
    let tier = 3;
    const tierVal = (row['tier'] || '').toLowerCase();
    if (tierVal.includes('1') || tierVal.includes('⭐')) tier = 1;
    else if (tierVal.includes('2') || tierVal.includes('★')) tier = 2;

    const contactName = (row['contact_name'] || row['name'] || row['full_name'] || '').trim();
    const firstName = contactName.split(/\s+/)[0] || '';

    leads.push({
      client_id: null,
      studio_name: (row['studio'] || row['studio_name'] || row['company_name'] || row['company'] || '').trim(),
      contact_name: contactName,
      first_name: firstName,
      email,
      job_title: (row['job_title'] || row['title'] || row['position'] || '').trim(),
      linkedin_url: (row['linkedin'] || row['linkedin_url'] || '').trim(),
      tier,
      outreach_status: 'pending',
      initial_sent_at: null,
      followup1_sent_at: null,
      followup2_sent_at: null,
      replied_at: null,
      source: 'csv_import',
      tags: [],
      notes: (row['notes'] || '').trim(),
    });
  }

  return { leads, skipped };
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
