import { supabase } from '@/services/supabaseClient';
import { InvoiceData, BankingInfo, ClientInfo, ClientRecord, StudioInfo, StudioRecord, AccountUser } from '@/types';

export interface SaveResponse {
    success: boolean;
    id: string;
    error?: string;
}

// ────────────────────────────────────────────────────────────────
// CLIENT METHODS
// ────────────────────────────────────────────────────────────────

export const fetchClientsFromCloud = async (): Promise<ClientRecord[]> => {
    const { data, error } = await supabase
        .from('crm_clients')
        .select('*')
        .order('name');
    if (error) throw new Error(`Fetch clients failed: ${error.message}`);
    return (data || []).map((c: any) => ({
        id: c.id,
        clientType: c.client_type || 'company',
        name: c.name || '',
        contactPerson: c.contact_person || '',
        email: c.email || '',
        address: c.address || '',
        taxCode: c.tax_code || '',
    }));
};

export const saveClientToCloud = async (client: ClientInfo): Promise<ClientRecord> => {
    const { data, error } = await supabase
        .from('crm_clients')
        .insert({
            client_type: client.clientType || 'company',
            name: client.name,
            contact_person: client.contactPerson,
            email: client.email,
            address: client.address,
            tax_code: client.taxCode || '',
            status: 'active',
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    if (error) throw new Error(`Save client failed: ${error.message}`);
    return { ...client, id: data.id };
};

export const updateClientInCloud = async (id: string, client: ClientInfo): Promise<void> => {
    const { error } = await supabase
        .from('crm_clients')
        .update({
            client_type: client.clientType || 'company',
            name: client.name,
            contact_person: client.contactPerson,
            email: client.email,
            address: client.address,
            tax_code: client.taxCode || '',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    if (error) throw new Error(`Update client failed: ${error.message}`);
};

// ────────────────────────────────────────────────────────────────
// INVOICE METHODS
// ────────────────────────────────────────────────────────────────

export const saveInvoiceToCloud = async (data: InvoiceData): Promise<SaveResponse> => {
    const record = {
        invoice_number: data.invoiceNumber,
        issue_date: data.issueDate || null,
        due_date: data.dueDate || null,
        currency: data.currency,
        tax_rate: data.taxRate,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        theme: data.theme,
        status: data.status,
        paid_date: data.paidDate || null,
        payment_method: data.payment_method || 'TM/CK',
        client_info: data.clientInfo,
        studio_info: data.studioInfo,
        banking_info: data.bankingInfo,
        items: data.items,
        client_name: data.clientInfo.name || '',
        einvoice_status: data.einvoice_status && data.einvoice_status !== 'none' ? data.einvoice_status : '',
        einvoice_reference_code: data.einvoice_reference_code || '',
        einvoice_tracking_code: data.einvoice_tracking_code || '',
        einvoice_pdf_url: data.einvoice_pdf_url || '',
        crm_project_id: data.crm_project_id || null,
    };

    const { data: created, error } = await supabase
        .from('invoice_invoices')
        .insert(record)
        .select()
        .single();
    if (error) throw new Error(`Save invoice failed: ${error.message}`);
    return { success: true, id: created.id };
};

const parseInvoice = (row: any): InvoiceData => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date || '',
    dueDate: row.due_date || '',
    currency: row.currency || 'USD',
    taxRate: row.tax_rate ?? 0,
    discountType: row.discount_type || 'percentage',
    discountValue: row.discount_value ?? 0,
    theme: row.theme || 'dark',
    status: row.status || 'pending',
    paidDate: row.paid_date || undefined,
    payment_method: row.payment_method || '',
    clientInfo: row.client_info || { name: '', address: '', contactPerson: '', email: '' },
    studioInfo: row.studio_info || { name: '', address: '', email: '', taxCode: '' },
    bankingInfo: row.banking_info || { accountName: '', accountNumber: '', bankName: '', branchName: '', bankAddress: '', citadCode: '', swiftCode: '' },
    items: row.items || [],
    einvoice_status: row.einvoice_status || '',
    einvoice_reference_code: row.einvoice_reference_code || '',
    einvoice_tracking_code: row.einvoice_tracking_code || '',
    einvoice_pdf_url: row.einvoice_pdf_url || '',
    einvoice_invoice_number: row.einvoice_invoice_number || '',
    amount_received: row.amount_received ?? undefined,
    transfer_fee: row.transfer_fee ?? undefined,
    crm_project_id: row.crm_project_id ?? null,
    createdAt: row.created_at,
});

export const fetchInvoicesFromCloud = async (): Promise<InvoiceData[]> => {
    const { data, error } = await supabase
        .from('invoice_invoices')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Fetch invoices failed: ${error.message}`);
    return (data || []).map(parseInvoice);
};

/**
 * Tính số hoá đơn tiếp theo trong năm hiện tại.
 * Format: INV-YYYYMM-NNN  (e.g. INV-202603-007)
 *
 * Chỉ fetch 1 row có invoice_number lớn nhất theo prefix năm — DB sort dictionary
 * order trùng với numeric order vì sequence luôn được pad zero.
 */
export const getNextInvoiceNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const yearPrefix = `INV-${year}`;
    const issuePrefix = `INV-${year}${monthStr}`;
    try {
        const { data } = await supabase
            .from('invoice_invoices')
            .select('invoice_number')
            .like('invoice_number', `${yearPrefix}%`)
            .order('invoice_number', { ascending: false })
            .limit(1);
        const latest = data?.[0]?.invoice_number as string | undefined;
        if (!latest) return `${issuePrefix}-001`;
        const parts = latest.split('-');
        const maxSeq = parseInt(parts[parts.length - 1], 10) || 0;
        return `${issuePrefix}-${String(maxSeq + 1).padStart(3, '0')}`;
    } catch {
        return `${issuePrefix}-001`;
    }
};

export const updateInvoiceStatusInCloud = async (
    id: string,
    status: InvoiceData['status'],
    paidDate?: string,
    amountReceived?: number,
    transferFee?: number
) => {
    const payload: Record<string, unknown> = { status };
    if (status === 'paid' && paidDate) payload.paid_date = paidDate;
    if (status === 'paid' && amountReceived !== undefined) payload.amount_received = amountReceived;
    if (status === 'paid' && transferFee !== undefined) payload.transfer_fee = transferFee;
    if (status === 'pending') {
        payload.paid_date = null;
        payload.amount_received = null;
        payload.transfer_fee = null;
    }
    const { error } = await supabase
        .from('invoice_invoices')
        .update(payload)
        .eq('id', id);
    if (error) throw new Error(`Update status failed: ${error.message}`);
};

export const deleteInvoiceFromCloud = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('invoice_invoices')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete invoice failed: ${error.message}`);
};

export const updateEInvoiceInCloud = async (
    id: string,
    data: {
        einvoice_status: string;
        einvoice_reference_code?: string;
        einvoice_tracking_code?: string;
        einvoice_pdf_url?: string;
        einvoice_invoice_number?: string;
    }
) => {
    const updatePayload: Record<string, any> = {
        einvoice_status: data.einvoice_status,
        einvoice_reference_code: data.einvoice_reference_code || '',
        einvoice_tracking_code: data.einvoice_tracking_code || '',
        einvoice_pdf_url: data.einvoice_pdf_url || '',
    };
    if (data.einvoice_invoice_number !== undefined) {
        updatePayload.einvoice_invoice_number = data.einvoice_invoice_number;
    }
    const { error } = await supabase
        .from('invoice_invoices')
        .update(updatePayload)
        .eq('id', id);
    if (error) throw new Error(`Update eInvoice failed: ${error.message}`);
};

// ────────────────────────────────────────────────────────────────
// BANK METHODS
// ────────────────────────────────────────────────────────────────

export const saveBankToCloud = async (bank: BankingInfo): Promise<SaveResponse> => {
    const { data, error } = await supabase
        .from('invoice_banks')
        .insert({
            alias: bank.alias || '',
            account_name: bank.accountName,
            account_number: bank.accountNumber,
            bank_name: bank.bankName,
            branch_name: bank.branchName,
            bank_address: bank.bankAddress,
            citad_code: bank.citadCode,
            swift_code: bank.swiftCode,
            is_default: false,
        })
        .select()
        .single();
    if (error) throw new Error(`Save bank failed: ${error.message}`);
    return { success: true, id: data.id };
};

export const fetchBanksFromCloud = async (): Promise<(BankingInfo & { id: string; isDefault: boolean })[]> => {
    const { data, error } = await supabase
        .from('invoice_banks')
        .select('*')
        .order('created_at');
    if (error) throw new Error(`Fetch banks failed: ${error.message}`);
    return (data || []).map((b: any) => ({
        id: b.id,
        alias: b.alias || '',
        accountName: b.account_name || '',
        accountNumber: b.account_number || '',
        bankName: b.bank_name || '',
        branchName: b.branch_name || '',
        bankAddress: b.bank_address || '',
        citadCode: b.citad_code || '',
        swiftCode: b.swift_code || '',
        isDefault: b.is_default === true,
    }));
};

export const updateBankInCloud = async (id: string, bank: BankingInfo): Promise<void> => {
    const { error } = await supabase
        .from('invoice_banks')
        .update({
            alias: bank.alias || '',
            account_name: bank.accountName,
            account_number: bank.accountNumber,
            bank_name: bank.bankName,
            branch_name: bank.branchName,
            bank_address: bank.bankAddress,
            citad_code: bank.citadCode,
            swift_code: bank.swiftCode,
        })
        .eq('id', id);
    if (error) throw new Error(`Update bank failed: ${error.message}`);
};

export const setDefaultBankInCloud = async (
    targetId: string,
    allBanks: (BankingInfo & { id: string; isDefault: boolean })[]
): Promise<void> => {
    // Clear all defaults first
    const clearOps = allBanks
        .filter(b => b.isDefault && b.id !== targetId)
        .map(b => supabase.from('invoice_banks').update({ is_default: false }).eq('id', b.id));
    await Promise.all(clearOps);

    // Set the target as default
    const { error } = await supabase
        .from('invoice_banks')
        .update({ is_default: true })
        .eq('id', targetId);
    if (error) throw new Error(`Set default bank failed: ${error.message}`);
};

export const deleteBankFromCloud = async (id: string) => {
    const { error } = await supabase
        .from('invoice_banks')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete bank failed: ${error.message}`);
};

// ────────────────────────────────────────────────────────────────
// STUDIO METHODS
// ────────────────────────────────────────────────────────────────

export const fetchStudiosFromCloud = async (): Promise<StudioRecord[]> => {
    const { data, error } = await supabase
        .from('invoice_studios')
        .select('*')
        .order('name');
    if (error) throw new Error(`Fetch studios failed: ${error.message}`);
    return (data || []).map((s: any) => ({
        id: s.id,
        name: s.name || '',
        address: s.address || '',
        email: s.email || '',
        taxCode: s.tax_code || '',
        isDefault: s.is_default === true,
    }));
};

export const saveStudioToCloud = async (studio: StudioInfo): Promise<StudioRecord> => {
    const { data, error } = await supabase
        .from('invoice_studios')
        .insert({
            name: studio.name,
            address: studio.address,
            email: studio.email,
            tax_code: studio.taxCode,
            is_default: false,
        })
        .select()
        .single();
    if (error) throw new Error(`Save studio failed: ${error.message}`);
    return { ...studio, id: data.id, isDefault: false };
};

export const updateStudioInCloud = async (id: string, studio: StudioInfo): Promise<void> => {
    const { error } = await supabase
        .from('invoice_studios')
        .update({
            name: studio.name,
            address: studio.address,
            email: studio.email,
            tax_code: studio.taxCode,
        })
        .eq('id', id);
    if (error) throw new Error(`Update studio failed: ${error.message}`);
};

export const setDefaultStudioInCloud = async (
    targetId: string,
    _allStudios?: StudioRecord[]
): Promise<void> => {
    // Fetch fresh data
    const { data: freshStudios } = await supabase
        .from('invoice_studios')
        .select('id, is_default');
    const clearOps = (freshStudios || [])
        .filter((s: any) => s.is_default && s.id !== targetId)
        .map((s: any) => supabase.from('invoice_studios').update({ is_default: false }).eq('id', s.id));
    await Promise.all(clearOps);

    const { error } = await supabase
        .from('invoice_studios')
        .update({ is_default: true })
        .eq('id', targetId);
    if (error) throw new Error(`Set default studio failed: ${error.message}`);
};

export const deleteStudioFromCloud = async (id: string) => {
    const { error } = await supabase
        .from('invoice_studios')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete studio failed: ${error.message}`);
};

// ────────────────────────────────────────────────────────────────
// ACTIVITY LOG METHODS (P3-2)
// ────────────────────────────────────────────────────────────────

export interface ActivityLog {
    id: string;
    invoice_id: string | null;
    action: string;
    actor: string;
    details: Record<string, any>;
    created_at: string;
}

export const fetchActivityLogs = async (limit: number = 100): Promise<ActivityLog[]> => {
    const { data, error } = await supabase
        .from('invoice_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`Fetch activity logs failed: ${error.message}`);
    return data || [];
};

export const logManualActivity = async (invoiceId: string | null, action: string, actor: string, details: Record<string, any> = {}): Promise<void> => {
    const { error } = await supabase
        .from('invoice_activity_logs')
        .insert({ invoice_id: invoiceId, action, actor, details });
    if (error) console.error('Log activity failed:', error.message);
};

// ────────────────────────────────────────────────────────────────
// RECURRING INVOICE METHODS (P3-3)
// ────────────────────────────────────────────────────────────────

export interface RecurringTemplate {
    id: string;
    name: string;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    next_run: string;
    client_info: any;
    studio_info: any;
    banking_info: any;
    items: any[];
    currency: string;
    tax_rate: number;
    discount_type: string;
    discount_value: number;
    payment_method: string;
    is_active: boolean;
    last_generated_at: string | null;
    created_at: string;
}

export const fetchRecurringTemplates = async (): Promise<RecurringTemplate[]> => {
    const { data, error } = await supabase
        .from('invoice_recurring')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Fetch recurring templates failed: ${error.message}`);
    return data || [];
};

export const saveRecurringTemplate = async (template: Omit<RecurringTemplate, 'id' | 'created_at' | 'last_generated_at'>): Promise<string> => {
    const { data, error } = await supabase
        .from('invoice_recurring')
        .insert(template)
        .select('id')
        .single();
    if (error) throw new Error(`Save recurring template failed: ${error.message}`);
    return data.id;
};

export const updateRecurringTemplate = async (id: string, updates: Partial<RecurringTemplate>): Promise<void> => {
    const { error } = await supabase
        .from('invoice_recurring')
        .update(updates)
        .eq('id', id);
    if (error) throw new Error(`Update recurring template failed: ${error.message}`);
};

export const deleteRecurringTemplate = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('invoice_recurring')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete recurring template failed: ${error.message}`);
};

export const toggleRecurringActive = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
        .from('invoice_recurring')
        .update({ is_active: isActive })
        .eq('id', id);
    if (error) throw new Error(`Toggle recurring active failed: ${error.message}`);
};


