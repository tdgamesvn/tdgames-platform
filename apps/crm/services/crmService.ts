import { supabase } from '@/services/supabaseClient';
import { CrmClient, CrmContact, CrmDocument, CrmProject, CrmProjectFile, CrmActivity, CrmDeal, CrmDealStage } from '@/types';

// ══════════════════════════════════════════════════════════════
// ── Clients ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchClients(): Promise<CrmClient[]> {
  const { data, error } = await supabase
    .from('crm_clients')
    .select('*, contacts:crm_contacts(*)')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createClient(
  client: Omit<CrmClient, 'id' | 'created_at' | 'updated_at' | 'contacts'>
): Promise<CrmClient> {
  const { data, error } = await supabase
    .from('crm_clients')
    .insert(client)
    .select('*, contacts:crm_contacts(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, updates: Partial<CrmClient>): Promise<void> {
  const { contacts, ...clean } = updates as any;
  const { error } = await supabase
    .from('crm_clients')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('crm_clients').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Contacts ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchContacts(clientId: string): Promise<CrmContact[]> {
  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createContact(contact: Omit<CrmContact, 'id' | 'created_at'>): Promise<CrmContact> {
  const { data, error } = await supabase.from('crm_contacts').insert(contact).select().single();
  if (error) throw error;
  return data;
}

export async function updateContact(id: string, updates: Partial<CrmContact>): Promise<void> {
  const { error } = await supabase.from('crm_contacts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('crm_contacts').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Documents ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchDocuments(clientId?: string): Promise<CrmDocument[]> {
  let q = supabase.from('crm_documents').select('*').order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchDocumentsByProject(projectId: string): Promise<CrmDocument[]> {
  const { data, error } = await supabase
    .from('crm_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDocument(doc: Omit<CrmDocument, 'id' | 'created_at'>): Promise<CrmDocument> {
  const { data, error } = await supabase.from('crm_documents').insert(doc).select().single();
  if (error) throw error;
  return data;
}

export async function updateDocument(id: string, updates: Partial<CrmDocument>): Promise<void> {
  const { error } = await supabase.from('crm_documents').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('crm_documents').delete().eq('id', id);
  if (error) throw error;
}

export async function approveDocument(
  id: string,
  approvedBy: string,
  note?: string
): Promise<CrmDocument> {
  const { data, error } = await supabase
    .from('crm_documents')
    .update({
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      notes: note || undefined,
    })
    .eq('id', id)
    .eq('approval_status', 'pending_approval')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function rejectDocument(
  id: string,
  approvedBy: string,
  note: string
): Promise<CrmDocument> {
  const { data, error } = await supabase
    .from('crm_documents')
    .update({
      approval_status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      notes: note,
    })
    .eq('id', id)
    .eq('approval_status', 'pending_approval')
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════════
// ── Projects ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchProjects(clientId?: string): Promise<CrmProject[]> {
  let q = supabase.from('crm_projects').select('*, files:crm_project_files(*)').order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createProject(proj: Omit<CrmProject, 'id' | 'created_at' | 'updated_at' | 'files'>): Promise<CrmProject> {
  const { data, error } = await supabase.from('crm_projects').insert(proj).select('*, files:crm_project_files(*)').single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<CrmProject>): Promise<void> {
  const { files, ...clean } = updates as any;
  const { error } = await supabase.from('crm_projects').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('crm_projects').delete().eq('id', id);
  if (error) throw error;
}

// ── Project Files ─────────────────────────────────────────────

export async function createProjectFile(file: Omit<CrmProjectFile, 'id' | 'created_at'>): Promise<CrmProjectFile> {
  const { data, error } = await supabase.from('crm_project_files').insert(file).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProjectFile(id: string): Promise<void> {
  const { error } = await supabase.from('crm_project_files').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Invoice Sync (Payment Tracking — read-only) ──────────────
// ══════════════════════════════════════════════════════════════

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client_name: string;
  status: string;
  paid_date: string | null;
  currency: string;
  items: { id: string; description: string; quantity: number; unitPrice: number }[];
  created_at: string;
  crm_project_id?: string | null;
}

export async function fetchInvoicesByClient(clientName?: string): Promise<InvoiceRecord[]> {
  let q = supabase
    .from('invoice_invoices')
    .select('id, invoice_number, client_name, status, paid_date, currency, items, created_at, crm_project_id')
    .order('created_at', { ascending: false });
  if (clientName) q = q.eq('client_name', clientName);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchInvoicesByProject(projectId: string): Promise<InvoiceRecord[]> {
  const { data, error } = await supabase
    .from('invoice_invoices')
    .select('id, invoice_number, client_name, status, paid_date, currency, items, created_at, crm_project_id')
    .eq('crm_project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Tính tổng giá trị hoá đơn từ items */
export function calcInvoiceTotal(inv: InvoiceRecord): number {
  return (inv.items || []).reduce((s, item) => s + (item.quantity || 0) * (item.unitPrice || 0), 0);
}

// ══════════════════════════════════════════════════════════════
// ── Activities ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchActivities(clientId?: string, limit = 50): Promise<CrmActivity[]> {
  let q = supabase.from('crm_activities').select('*').order('activity_date', { ascending: false }).limit(limit);
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createActivity(activity: Omit<CrmActivity, 'id' | 'created_at'>): Promise<CrmActivity> {
  const { data, error } = await supabase.from('crm_activities').insert(activity).select().single();
  if (error) throw error;
  return data;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('crm_activities').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Deals (Sales Pipeline) ───────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchDeals(): Promise<CrmDeal[]> {
  const { data, error } = await supabase
    .from('crm_deals')
    .select('*, client:crm_clients(name)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    ...d,
    client_name: d.client?.name || '',
    client: undefined,
  }));
}

export async function createDeal(deal: Omit<CrmDeal, 'id' | 'created_at' | 'updated_at' | 'client_name'>): Promise<CrmDeal> {
  const { data, error } = await supabase
    .from('crm_deals')
    .insert(deal)
    .select('*, client:crm_clients(name)')
    .single();
  if (error) throw error;
  return { ...data, client_name: data.client?.name || '', client: undefined };
}

export async function updateDeal(id: string, updates: Partial<CrmDeal>): Promise<void> {
  const { client_name, ...clean } = updates as any;
  const { error } = await supabase
    .from('crm_deals')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateDealStage(id: string, stage: CrmDealStage): Promise<void> {
  const updates: any = { stage, updated_at: new Date().toISOString() };
  if (stage === 'won' || stage === 'lost') {
    updates.actual_close_date = new Date().toISOString().split('T')[0];
  }
  const { error } = await supabase.from('crm_deals').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase.from('crm_deals').delete().eq('id', id);
  if (error) throw error;
}
