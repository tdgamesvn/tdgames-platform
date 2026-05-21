import { supabase } from '@/services/supabaseClient';

export interface CompanyProfile {
  id: string;
  entity_name_vn: string;
  entity_name_en: string | null;
  entity_short: string | null;
  entity_type: string;
  tax_id: string;
  address: string | null;
  address_tax: string | null;
  legal_rep: string | null;
  phone: string | null;
  email: string | null;
  operation_date: string | null;
  founded_date: string | null;
  managed_by: string | null;
  notes: string | null;
  is_primary: boolean;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  company_id: string;
  doc_type: string;
  doc_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

const BUCKET = 'company-documents';

export async function fetchCompanyProfiles(): Promise<CompanyProfile[]> {
  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data as CompanyProfile[];
}

export async function updateCompanyProfile(id: string, patch: Partial<CompanyProfile>): Promise<void> {
  const { error } = await supabase
    .from('company_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', companyId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data as CompanyDocument[];
}

export async function uploadCompanyDocument(
  companyId: string,
  file: File,
  docType: string,
  docName: string,
  notes: string,
  uploadedBy: string
): Promise<CompanyDocument> {
  const ext = file.name.split('.').pop();
  const path = `${companyId}/${Date.now()}_${docType.replace(/\s/g, '_')}.${ext}`;

  // Ensure bucket exists (idempotent)
  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('company_documents')
    .insert({
      company_id: companyId,
      doc_type: docType,
      doc_name: docName || file.name,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type,
      notes,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CompanyDocument;
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? '';
}

export async function deleteCompanyDocument(doc: CompanyDocument): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await supabase.from('company_documents').delete().eq('id', doc.id);
  if (error) throw error;
}
