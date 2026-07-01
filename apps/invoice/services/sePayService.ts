import { InvoiceData } from '@/types';

// ── Config ──────────────────────────────────────────────────────
const EDGE_FUNCTION_URL = import.meta.env.VITE_SEPAY_EDGE_FUNCTION_URL;
const API_KEY = import.meta.env.VITE_SEPAY_API_KEY || 'tdgames-sepay-2026';

// ── Helpers ─────────────────────────────────────────────────────

async function callProxy(action: string, payload: Record<string, unknown> = {}) {
    const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({ action, payload }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : (data.message || `Proxy error (${res.status})`));
    }
    // If data.error is a boolean true, it's a debug response from the proxy — don't throw here,
    // let createDraftEInvoice handle it to extract the details
    if (typeof data.error === 'string') {
        throw new Error(data.error);
    }
    return data;
}

// ── Tax rate mapping ────────────────────────────────────────────
// SePay API accepts: -2 (exempt), -1 (not declared), 0, 5, 8, 10
function mapTaxRate(rate: number | undefined): number {
    if (rate === undefined || rate === null) return -2; // default: exempt
    // Direct match for valid SePay rates
    if ([-2, -1, 0, 5, 8, 10].includes(rate)) return rate;
    // Closest match for other values
    if (rate <= 0) return 0;
    if (rate <= 5) return 5;
    if (rate <= 8) return 8;
    return 10;
}

// ── Data mapping ────────────────────────────────────────────────
// Maps our InvoiceData to SePay API payload format
// Ref: POST v1/invoices/create
// Edge Function proxy injects: provider_account_id, template_code, invoice_series, is_draft

function mapInvoiceToSePay(invoice: InvoiceData, exchangeRate?: number) {
    // Parse clientInfo/items if they come as JSON strings (e.g., from NocoDB history)
    let client = invoice.clientInfo || { name: '', address: '', contactPerson: '', email: '' };
    if (typeof client === 'string') {
        try { client = JSON.parse(client); } catch { client = { name: '', address: '', contactPerson: '', email: '' }; }
    }
    
    let items = invoice.items || [];
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
    }

    // Pre-flight validation
    if (!client.name?.trim()) {
        throw new Error('Client name is required. Please fill in Client Details before creating an eInvoice.');
    }
    if (!items.length) {
        throw new Error('At least one invoice item is required. Please add items before creating an eInvoice.');
    }

    // Determine if we need currency conversion (USD → VND)
    const needsConversion = invoice.currency === 'USD' && exchangeRate && exchangeRate > 0;

    // Determine buyer type
    // SePay/CQT (VN tax authority) only accepts Vietnamese MST format for buyer.tax_code
    // (10 digits, optionally with a -XXX branch suffix). Foreign tax IDs (e.g. Spanish CIF
    // "B64965437") are rejected by SePay validation, causing eInvoice creation to fail silently.
    const rawTaxCode = client.taxCode?.trim() || '';
    const isValidVnTaxCode = /^\d{10}(-\d{3})?$/.test(rawTaxCode);
    const hasForeignTaxCode = rawTaxCode.length > 0 && !isValidVnTaxCode;
    const hasTaxCode = isValidVnTaxCode;
    const isIndividual = client.clientType === 'individual';

    // Build invoice items per SePay API spec
    const sePayItems = items.map((item, idx) => {
        const unitPriceVND = needsConversion ? Math.round(item.unitPrice * exchangeRate) : item.unitPrice;
        const totalUSD = item.quantity * item.unitPrice;
        
        // Append USD info to description when converting
        let itemName = item.description;
        if (needsConversion) {
            itemName = `${item.description} (USD ${item.unitPrice.toLocaleString('en-US')} x ${exchangeRate.toLocaleString('vi-VN')} = ${unitPriceVND.toLocaleString('vi-VN')} VND/unit)`;
        }

        return {
            line_number: idx + 1,
            line_type: 1, // 1=normal product/service
            item_code: `SV${String(idx + 1).padStart(3, '0')}`,
            item_name: itemName,
            unit: 'Service',
            quantity: item.quantity,
            unit_price: unitPriceVND,
            tax_rate: mapTaxRate(invoice.taxRate),
        };
    });

    // Handle discount (total level → add line_type: 3)
    if (invoice.discountValue > 0) {
        const subtotal = items.reduce(
            (sum, i) => sum + i.quantity * i.unitPrice,
            0
        );
        let discountAmount: number;
        if (invoice.discountType === 'percentage') {
            discountAmount = subtotal * (invoice.discountValue / 100);
        } else {
            discountAmount = invoice.discountValue;
        }

        // Convert discount to VND if needed
        const discountVND = needsConversion ? Math.round(discountAmount * exchangeRate) : discountAmount;
        const discountLabel = invoice.discountType === 'percentage'
            ? `Discount ${invoice.discountValue}%`
            : `Discount`;
        const discountName = needsConversion
            ? `${discountLabel} (USD ${discountAmount.toLocaleString('en-US')} x ${exchangeRate.toLocaleString('vi-VN')})`
            : discountLabel;

        sePayItems.push({
            line_number: sePayItems.length + 1,
            line_type: 3, // 3=commercial discount line
            item_name: discountName,
            tax_rate: mapTaxRate(invoice.taxRate),
            before_discount_and_tax_amount: discountVND,
        } as any);
    }

    // Format date: YYYY-MM-DD HH:mm:ss
    const issuedDate = invoice.issueDate
        ? `${invoice.issueDate} 00:00:00`
        : new Date().toISOString().slice(0, 19).replace('T', ' ');

    return {
        buyer: {
            type: isIndividual ? 'personal' : (hasTaxCode ? 'company' : 'personal'),
            name: client.name,
            tax_code: hasTaxCode ? rawTaxCode : '',
            address: client.address || '',
            email: client.email || '',
            phone: isIndividual ? (client.contactPerson || '') : '',
        },
        items: sePayItems,
        currency: needsConversion ? 'VND' : (invoice.currency || 'USD'),
        issued_date: issuedDate,
        payment_method: invoice.payment_method || 'CK',
        notes: [
            needsConversion ? `Original currency: USD | Exchange rate: 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VND` : '',
            hasForeignTaxCode ? `Foreign tax ID: ${rawTaxCode}` : '',
            (invoice as any).notes || '',
        ].filter(Boolean).join(' | '),
    };
}

// ── Public API ──────────────────────────────────────────────────

export interface CreateDraftResult {
    tracking_code: string;
}

export interface CheckStatusResult {
    success: boolean;
    data?: {
        reference_code?: string;
        status?: string;
        message?: string;
        invoice?: {
            reference_code?: string;
            pdf_url?: string;
            invoice_number?: string;
            status?: string;
        };
    };
}

/**
 * Create a draft eInvoice via the Edge Function proxy.
 * Returns tracking_code for polling.
 * @param exchangeRate — optional USD→VND rate for foreign currency invoices
 */
export async function createDraftEInvoice(invoice: InvoiceData, exchangeRate?: number): Promise<CreateDraftResult> {
    const sePayPayload = mapInvoiceToSePay(invoice, exchangeRate);
    const result = await callProxy('create-draft', sePayPayload);
    
    // Check if proxy returned a debug error object (SePay returned 400)
    if (result?.error === true && result?.sepay_response) {
        console.error('[eInvoice Debug]', JSON.stringify(result, null, 2));
        const sePayError = result.sepay_response?.error || {};
        const sePayMsg = sePayError.message || result.sepay_response?.message || 'Unknown error';
        const details = sePayError.details ? '\n\nValidation errors:\n' + JSON.stringify(sePayError.details, null, 2) : '';
        throw new Error(`SePay: ${sePayMsg}${details}\n\nConfig: ${JSON.stringify(result.config)}\n\nPayload sent: ${JSON.stringify(result.sent_payload, null, 2)}`);
    }
    
    // SePay returns { success: true, data: { tracking_code, tracking_url, message } }
    const trackingCode =
        result?.data?.tracking_code || result?.tracking_code;
    if (!trackingCode) {
        throw new Error('No tracking_code received from SePay');
    }
    return { tracking_code: trackingCode };
}

/**
 * Poll the status of a draft eInvoice creation.
 */
export async function checkEInvoiceStatus(
    trackingCode: string
): Promise<CheckStatusResult> {
    return callProxy('check-status', { tracking_code: trackingCode });
}

/**
 * Full flow: create draft → poll until complete → return result.
 * @param exchangeRate — optional USD→VND rate for foreign currency invoices
 */
export async function createAndPollDraft(
    invoice: InvoiceData,
    onProgress?: (msg: string) => void,
    exchangeRate?: number
): Promise<{
    reference_code: string;
    tracking_code: string;
    pdf_url: string;
    invoice_number?: string;
}> {
    onProgress?.('Sending invoice to SePay...');
    const { tracking_code } = await createDraftEInvoice(invoice, exchangeRate);
    onProgress?.(`Sent. Tracking: ${tracking_code}`);

    // Poll max 30 times, 2s interval
    const MAX_POLLS = 30;
    const POLL_INTERVAL = 2000;

    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        onProgress?.(`Checking result... (${i + 1}/${MAX_POLLS})`);

        const result = await checkEInvoiceStatus(tracking_code);
        const status = (result?.data?.status || '').toLowerCase();

        if (status === 'success') {
            console.log('[eInvoice] Poll success result:', JSON.stringify(result, null, 2));
            const inv = result.data?.invoice;
            return {
                reference_code: inv?.reference_code || result.data?.reference_code || '',
                tracking_code,
                pdf_url: inv?.pdf_url || '',
                invoice_number: inv?.invoice_number,
            };
        }

        // Check for failure
        if (status === 'failed') {
            throw new Error(result.data?.message || 'SePay returned an error creating the invoice');
        }
    }

    throw new Error('Timeout: SePay did not respond within 60 seconds. Please try again.');
}

/**
 * Get the current detail/status of an eInvoice from SePay.
 * Uses GET /v1/invoices/{reference_code}
 * Returns null if deleted on SePay (404 or cancelled).
 */
export async function getEInvoiceDetail(
    referenceCode: string
): Promise<{
    status: 'draft' | 'issued' | 'cancelled';
    invoice_number?: string;
    pdf_url?: string;
} | null> {
    try {
        const result = await callProxy('get-invoice-detail', { reference_code: referenceCode });
        const inv = result?.data || result;

        // Edge Function returns _deleted: true for 404
        if (inv._deleted || inv.status === 'deleted') {
            return null;
        }

        // document_type 3 = cancelled/deleted on SePay
        if (inv.document_type === 3 || inv.status === 'cancelled') {
            return null;
        }

        return {
            status: inv.status || 'draft',
            invoice_number: inv.invoice_number,
            pdf_url: inv.pdf_url,
        };
    } catch (err: any) {
        // Fallback: 404 or not found in error message
        if (err?.message?.includes('404') || err?.message?.toLowerCase()?.includes('not found')) {
            return null;
        }
        throw err;
    }
}
