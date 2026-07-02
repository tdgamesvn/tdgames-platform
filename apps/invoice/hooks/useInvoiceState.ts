import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_INVOICE } from '@/constants';
import { InvoiceData, ServiceItem, BankingInfo, ClientRecord, StudioInfo, AccountUser } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { hasAnyRole } from '@/utils/roleUtils';
import { createAndPollDraft, getEInvoiceDetail, getEInvoiceDownloadUrl } from '../services/sePayService';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import {
  saveInvoiceToCloud,
  updateInvoiceInCloud,
  canEditInvoice,
  fetchInvoicesFromCloud,
  updateInvoiceStatusInCloud,
  updateEInvoiceInCloud,
  deleteInvoiceFromCloud,
  getNextInvoiceNumber,
  fetchClientsFromCloud,
  saveClientToCloud,
  updateClientInCloud,
} from '../services/supabaseService';
import { setHashTab } from '@/App';
import { useBankManager } from './useBankManager';
import { useStudioManager } from './useStudioManager';

type InvoiceTab = 'edit' | 'preview' | 'history' | 'dashboard' | 'activity' | 'recurring' | 'aging';
const VALID_TABS: InvoiceTab[] = ['edit', 'preview', 'history', 'dashboard', 'activity', 'recurring', 'aging'];

export function useInvoiceState(initialTab?: string | null) {
  // ── Core State ──
  // Auth is managed by App.tsx via Supabase Auth. This hook receives currentUser via setCurrentUser.
  const [currentUser, _setCurrentUser] = useState<AccountUser | null>(null);

  const setCurrentUser = (user: AccountUser | null) => {
    _setCurrentUser(user);
  };
  const [invoice, setInvoice] = useState<InvoiceData>(DEFAULT_INVOICE);
  const [activeTab, _setActiveTab] = useState<InvoiceTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as InvoiceTab)) return initialTab as InvoiceTab;
    return 'edit';
  });
  const setActiveTab = useCallback((tab: InvoiceTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);

  const accessibleTabs: Array<'edit' | 'preview' | 'history' | 'dashboard' | 'activity' | 'recurring' | 'aging'> =
    currentUser && hasAnyRole(currentUser, ['admin', 'ke_toan'])
      ? ['edit', 'preview', 'history', 'dashboard', 'aging', 'activity', 'recurring']
      : ['edit', 'preview'];

  // ── Data State ──
  const [history, setHistory] = useState<InvoiceData[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [crmProjects, setCrmProjects] = useState<{ id: string; name: string; client_id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<{ text: string, type: 'success' | 'warning' | 'error' } | null>(null);

  const notify = useCallback((text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setLastMessage({ text, type });
  }, []);

  // ── Bank/Studio sub-managers ──
  const applyBankToInvoice = useCallback((info: BankingInfo) => {
    setInvoice(prev => ({ ...prev, bankingInfo: info }));
  }, []);
  const applyStudioToInvoice = useCallback((info: StudioInfo) => {
    setInvoice(prev => ({ ...prev, studioInfo: info }));
  }, []);

  const bankMgr = useBankManager(notify, applyBankToInvoice);
  const studioMgr = useStudioManager(notify, applyStudioToInvoice);

  // ── Client Suggestions ──
  const [clientSuggestions, setClientSuggestions] = useState<ClientRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── eInvoice State ──
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [eInvoiceProgress, setEInvoiceProgress] = useState<string | null>(null);
  const [eInvoiceResult, setEInvoiceResult] = useState<{ pdf_url: string; reference_code: string; tracking_code: string } | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [eInvoiceError, setEInvoiceError] = useState<string | null>(null);
  const [showEInvoicePrompt, setShowEInvoicePrompt] = useState(false);
  const [eInvoiceTargetInvoice, setEInvoiceTargetInvoice] = useState<InvoiceData | null>(null);

  // ── Exchange Rate (USD→VND for eInvoice) ──
  const [showExchangeRateModal, setShowExchangeRateModal] = useState(false);
  // ── Live VCB Exchange Rate (shared via Context) ──
  const { rate: vcbRate, loading: vcbRateLoading, avgUsdVnd } = useExchangeRate();
  const [exchangeRate, setExchangeRate] = useState<number>(25400);
  const [exchangeRateTarget, setExchangeRateTarget] = useState<InvoiceData | null>(null);

  // Auto-sync exchangeRate input from shared VCB context whenever it updates
  useEffect(() => { setExchangeRate(avgUsdVnd); }, [avgUsdVnd]);

  // ── Save-after-export ──
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingInvoiceToSave, setPendingInvoiceToSave] = useState<InvoiceData | null>(null);

  // ── Filters ──
  const [filterStudio, setFilterStudio] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // ── Reset confirm ──
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);

  // ── Email modal (P3-4) ──
  const [emailInvoice, setEmailInvoice] = useState<InvoiceData | null>(null);

  // ── Effects ──
  useEffect(() => {
    const shouldAutoApplyBank = activeTab === 'edit' && !skipBankAutoApplyRef.current;
    skipBankAutoApplyRef.current = false;
    bankMgr.loadBanks(shouldAutoApplyBank);
    loadClients();
    studioMgr.loadStudios().then(data => {
      if (activeTab === 'edit') {
        const def = data.find(s => s.isDefault);
        if (def) {
          const { id, isDefault, ...info } = def;
          updateInvoice('studioInfo', info);
        }
      }
    });
    if (activeTab === 'history') {
      // Tự động check trạng thái ký số SePay mỗi lần vào History, âm thầm (silent) — trước đây
      // draft chỉ được cập nhật thành "issued" khi người dùng tự bấm nút "🔄 Refresh", nên nhiều
      // hoá đơn đã ký số thật trên SePay vẫn hiển thị "Nháp" mãi vì không ai nhớ bấm.
      syncEInvoiceStatuses({ silent: true });
    } else if (activeTab === 'dashboard' || activeTab === 'aging') {
      loadHistory();
    }
  }, [activeTab]);

  // ── Realtime Subscription (P3-1) ──
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const skipBankAutoApplyRef = useRef(false);

  useEffect(() => {
    if (!currentUser) {
      // Cleanup if user logged out
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    // Subscribe to invoice_invoices changes
    const channel = supabase
      .channel('invoice-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_invoices' },
        (payload) => {
          // Auto-refresh history data
          loadHistory();

          // Show toast based on event type
          const eventLabels: Record<string, string> = {
            INSERT: '📥 New invoice created',
            UPDATE: '✏️ Invoice updated',
            DELETE: '🗑️ Invoice deleted',
          };
          const msg = eventLabels[payload.eventType] || 'Data changed';
          setLastMessage({ text: msg, type: 'success' });
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [currentUser]);

  useEffect(() => {
    getNextInvoiceNumber().then(nextNum => {
      setInvoice(prev => ({ ...prev, invoiceNumber: nextNum }));
    });
  }, []);

  useEffect(() => {
    if (lastMessage) {
      const timer = setTimeout(() => setLastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastMessage]);

  // ── Data Loading ──
  const loadHistory = async () => {
    setIsLoading(true);
    const data = await fetchInvoicesFromCloud();
    setHistory(data);
    setIsLoading(false);
  };

  const loadClients = async () => {
    const data = await fetchClientsFromCloud();
    setClients(data);
  };

  const loadCrmProjects = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('crm_projects')
        .select('id, name, client_id')
        .order('name');
      setCrmProjects(data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadCrmProjects(); }, [loadCrmProjects]);

  // ── Invoice Helpers ──
  const updateInvoice = (path: string, value: any) => {
    setInvoice(prev => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...prev, [keys[0]]: value };
      const newPrev = JSON.parse(JSON.stringify(prev));
      let current = newPrev;
      for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
      current[keys[keys.length - 1]] = value;
      return newPrev;
    });
  };

  const updateItem = (id: string, field: keyof ServiceItem, value: any) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const formatCurrencySimple = (val: number, curr: string) => {
    return new Intl.NumberFormat(curr === 'VND' ? 'vi-VN' : 'en-US', {
      style: 'currency', currency: curr
    }).format(val);
  };

  const filteredHistory = history.filter(inv => {
    if (filterStudio && inv.studioInfo?.name !== filterStudio) return false;
    if (filterClient && inv.clientInfo?.name !== filterClient) return false;
    const issueDate = inv.issueDate || '';
    if (filterDateFrom && issueDate < filterDateFrom) return false;
    if (filterDateTo && issueDate > filterDateTo) return false;
    return true;
  });

  // ── Client Handlers ──
  // Normalize name for dedup matching: lowercase, strip punctuation/extra whitespace
  // so "Social Point SL" and "Social Point, S.L." are recognized as the same client.
  const normalizeClientName = (name: string) =>
    name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

  const handleSaveClient = async () => {
    const ci = invoice.clientInfo;
    if (!ci.name) return notify('Please enter a client name.', 'error');
    try {
      const existing = clients.find(c => normalizeClientName(c.name) === normalizeClientName(ci.name));
      if (existing) { await updateClientInCloud(existing.id, ci); notify('Client info updated!', 'success'); }
      else { await saveClientToCloud(ci); notify('New client saved!', 'success'); }
      await loadClients();
    } catch (e: any) { notify('Error saving client: ' + e.message, 'error'); }
  };

  const handleSelectClient = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    if (!c) return;
    const { id: _id, ...info } = c;
    updateInvoice('clientInfo', info);
    if (c.defaultPoNumber) updateInvoice('poNumber', c.defaultPoNumber);
    if (c.defaultServiceLocation) updateInvoice('serviceLocation', c.defaultServiceLocation);
  };

  // ── Invoice CRUD ──
  /**
   * Lưu hoá đơn: nếu đã có `id` (đang sửa từ History) VÀ hoá đơn còn pending +
   * chưa xuất eInvoice → UPDATE bản ghi hiện tại. Ngược lại → INSERT bản mới.
   * Guard `canEditInvoice` chặn ghi đè lên hoá đơn đã paid/đã xuất eInvoice
   * (dùng Duplicate để tạo bản mới trong trường hợp đó).
   */
  const persistInvoice = async (data: InvoiceData): Promise<{ id: string; wasUpdate: boolean }> => {
    if (data.id) {
      if (!canEditInvoice(data)) {
        throw new Error('Hoá đơn này đã thanh toán hoặc đã xuất eInvoice, không thể ghi đè. Hãy dùng chức năng Duplicate để tạo bản mới.');
      }
      const result = await updateInvoiceInCloud(data.id, data);
      return { id: result.id, wasUpdate: true };
    }
    const result = await saveInvoiceToCloud(data);
    return { id: result.id, wasUpdate: false };
  };

  const handleSaveToCloud = async () => {
    setIsLoading(true);
    try {
      const { id, wasUpdate } = await persistInvoice(invoice);
      if (!wasUpdate) setInvoice(prev => ({ ...prev, id }));
      notify(wasUpdate ? "Invoice updated!" : "Invoice synced to Cloud!", "success");
      if (activeTab === 'history') loadHistory();
    }
    catch (error: any) { notify("Error saving invoice: " + error.message, "error"); }
    finally { setIsLoading(false); }
  };

  // ── Payment Modal State ──
  const [paymentModal, setPaymentModal] = useState<{
    id: string;
    invoiceTotal: number;
    currency: string;
    amountReceived: number;
    transferFee: number;
  } | null>(null);

  /** Calculate invoice total from items, discount, tax */
  const calcInvoiceTotal = (inv: InvoiceData): number => {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const subtotal = items.reduce((a: number, i: any) => a + i.quantity * i.unitPrice, 0);
    const disc = inv.discountType === 'percentage' ? subtotal * (inv.discountValue / 100) : inv.discountValue;
    const afterDisc = Math.max(0, subtotal - disc);
    const tax = afterDisc * (inv.taxRate / 100);
    return afterDisc + tax;
  };

  const toggleStatus = async (id: string, currentStatus: InvoiceData['status']) => {
    if (currentStatus === 'paid') {
      // Revert to pending — no modal needed
      try {
        await updateInvoiceStatusInCloud(id, 'pending');
        setHistory(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'pending', paidDate: undefined, amount_received: undefined, transfer_fee: undefined } : inv));
        notify('Switched to Pending.', 'success');
      } catch { notify('Error updating status.', 'error'); }
      return;
    }
    // Mark as paid — show payment modal
    const inv = history.find(h => h.id === id);
    if (!inv) return;
    const total = calcInvoiceTotal(inv);
    setPaymentModal({
      id,
      invoiceTotal: total,
      currency: inv.currency || 'USD',
      amountReceived: total, // default = full amount
      transferFee: 0,
    });
  };

  const confirmPayment = async () => {
    if (!paymentModal) return;
    const { id, amountReceived, transferFee } = paymentModal;
    const paidDate = new Date().toISOString().split('T')[0];
    try {
      await updateInvoiceStatusInCloud(id, 'paid', paidDate, amountReceived, transferFee);
      setHistory(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid' as const, paidDate, amount_received: amountReceived, transfer_fee: transferFee } : inv));
      notify('Payment confirmed!', 'success');
    } catch { notify('Error updating status.', 'error'); }
    setPaymentModal(null);
  };

  // ── Delete confirm (custom modal instead of native confirm) ──
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; hasDraft: boolean } | null>(null);

  const handleDeleteInvoice = (id: string) => {
    const inv = history.find(h => h.id === id);
    const hasDraft = inv?.einvoice_status === 'draft';
    setDeleteConfirm({ id, hasDraft });
  };

  const confirmDeleteInvoice = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteInvoiceFromCloud(deleteConfirm.id);
      setHistory(prev => prev.filter(inv => inv.id !== deleteConfirm.id));
      notify('Invoice deleted.', 'success');
    } catch (e: any) {
      notify('Error deleting invoice: ' + e.message, 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const loadFromHistory = (item: InvoiceData) => {
    skipBankAutoApplyRef.current = true;
    setInvoice(item);
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Clone an invoice: copy all data, reset id + invoice number + dates + eInvoice status */
  const handleDuplicateInvoice = async (item: InvoiceData) => {
    const nextNum = await getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setInvoice({
      ...item,
      id: undefined,
      invoiceNumber: nextNum,
      issueDate: today,
      dueDate,
      status: 'pending',
      paidDate: undefined,
      einvoice_status: undefined,
      einvoice_reference_code: undefined,
      einvoice_tracking_code: undefined,
      einvoice_pdf_url: undefined,
      createdAt: undefined,
    });
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('Invoice cloned — edit and save!', 'success');
  };

  const handleConfirmSave = async () => {
    if (!pendingInvoiceToSave) return;
    try {
      const { id, wasUpdate } = await persistInvoice(pendingInvoiceToSave);
      notify(wasUpdate ? 'Đã cập nhật hoá đơn!' : 'Đã lưu hoá đơn lên Cloud!', 'success');
      const savedInvoice = { ...pendingInvoiceToSave, id };
      setInvoice(prev => ({ ...prev, id }));
      if (activeTab === 'history') loadHistory();
      // Chỉ tự động lấy số hoá đơn kế tiếp khi vừa TẠO MỚI (chuẩn bị form cho hoá đơn tiếp theo).
      // Khi vừa SỬA hoá đơn cũ, giữ nguyên invoiceNumber đang hiển thị để không gây nhầm lẫn.
      if (!wasUpdate) {
        getNextInvoiceNumber().then(nextNum => { setInvoice(prev => ({ ...prev, invoiceNumber: nextNum })); });
      }
      if (!pendingInvoiceToSave.einvoice_status || pendingInvoiceToSave.einvoice_status === 'none' || pendingInvoiceToSave.einvoice_status === '' || pendingInvoiceToSave.einvoice_status === 'failed') {
        setEInvoiceTargetInvoice(savedInvoice);
        setShowEInvoicePrompt(true);
      }
    } catch (e: any) { notify('Lỗi lưu hoá đơn: ' + e.message, 'error'); }
    finally { setShowSaveConfirm(false); setPendingInvoiceToSave(null); }
  };

  const handleDismissSave = () => { setShowSaveConfirm(false); setPendingInvoiceToSave(null); };

  // ── Export ──
  /**
   * @param opts.targetInvoice — hoá đơn cần export, mặc định là `invoice` đang load trong editor.
   *   Truyền tường minh khi export từ nơi khác editor (vd: nút "Tải PDF" trong History) để tránh
   *   đọc nhầm giá trị `invoice` cũ trong closure (setInvoice là async, chưa kịp cập nhật).
   * @param opts.skipSavePrompt — bỏ qua modal "Save Invoice?" sau khi export PDF — dùng khi chỉ
   *   đang TẢI LẠI PDF của hoá đơn đã lưu sẵn (History), không phải tạo/sửa hoá đơn mới.
   */
  const handleExport = async (
    format: 'pdf' | 'png' | 'excel' | 'word',
    opts?: { targetInvoice?: InvoiceData; skipSavePrompt?: boolean }
  ) => {
    const targetInvoice = opts?.targetInvoice || invoice;
    setIsExporting(format);
    try {
      const { exportToPDF, exportToPNG, exportToExcel, exportToWord } = await import('../services/exportService');
      const fileName = `Invoice_${targetInvoice.invoiceNumber}`;
      if (format === 'pdf' || format === 'png' || format === 'word') {
        // Luôn chờ render lại khi có targetInvoice tường minh (dữ liệu invoice vừa đổi qua setInvoice
        // ở caller, cần đợi React re-render InvoicePreview trước khi capture/print), hoặc khi đang
        // không ở tab preview.
        if (activeTab !== 'preview' || opts?.targetInvoice) {
          setActiveTab('preview');
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }
      switch (format) {
        case 'pdf': await exportToPDF('invoice-capture', fileName); break;
        case 'png': await exportToPNG('invoice-capture', fileName, targetInvoice.theme); break;
        case 'excel': exportToExcel(targetInvoice, fileName); break;
        case 'word': exportToWord('invoice-capture', fileName); break;
      }
      if (format === 'pdf' && !opts?.skipSavePrompt) { setPendingInvoiceToSave(targetInvoice); setShowSaveConfirm(true); }
    } catch (error: any) {
      console.error("Export failed:", error);
      const isStaleChunk = /dynamically imported module|module script failed|Failed to fetch|Importing a module/i.test(error?.message || '');
      if (isStaleChunk) {
        notify("Ứng dụng vừa có bản cập nhật mới. Đang tải lại trang, vui lòng thử export lại sau khi trang tải xong...", "error");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        notify("Error exporting file. Please try again.", "error");
      }
    }
    finally { setIsExporting(null); }
  };

  // ── eInvoice ──
  const handleCreateEInvoice = async (targetInv?: InvoiceData) => {
    const inv = targetInv || invoice;
    setShowEInvoicePrompt(false);

    // If invoice is in USD, show exchange rate modal first
    if (inv.currency === 'USD') {
      setExchangeRateTarget(inv);
      setShowExchangeRateModal(true);
      return;
    }

    // VND invoice — proceed directly
    await executeCreateEInvoice(inv);
  };

  /** Called after exchange rate is confirmed for USD invoices, or directly for VND */
  const confirmCreateEInvoiceWithRate = async () => {
    if (!exchangeRateTarget) return;
    setShowExchangeRateModal(false);
    await executeCreateEInvoice(exchangeRateTarget, exchangeRate);
    setExchangeRateTarget(null);
  };

  const executeCreateEInvoice = async (inv: InvoiceData, rate?: number) => {
    // SePay từ chối issued_date < ngày hiện tại (không cho phát hành hoá đơn lùi ngày).
    // Chặn sớm ở đây để báo lỗi rõ ràng bằng tiếng Việt, thay vì để SePay trả lỗi JSON thô.
    const today = new Date().toISOString().split('T')[0];
    if (inv.issueDate && inv.issueDate < today) {
      notify(`Ngày lập hoá đơn (${inv.issueDate}) đã qua ngày hôm nay (${today}). SePay không cho phép phát hành hoá đơn lùi ngày — vui lòng vào tab EDIT, cập nhật "Ngày lập" thành ${today} hoặc mới hơn rồi thử phát hành eInvoice lại.`, 'error');
      return;
    }
    setShowEInvoiceModal(true);
    setEInvoiceProgress('Initializing...');
    setEInvoiceResult(null);
    setEInvoiceError(null);
    try {
      const result = await createAndPollDraft(inv, (msg) => setEInvoiceProgress(msg), rate);
      setEInvoiceResult(result);
      setEInvoiceProgress(null);
      setInvoice(prev => ({ ...prev, einvoice_status: 'draft', einvoice_reference_code: result.reference_code, einvoice_tracking_code: result.tracking_code, einvoice_pdf_url: result.pdf_url }));
      if (inv.id) {
        try { await updateEInvoiceInCloud(inv.id, { einvoice_status: 'draft', einvoice_reference_code: result.reference_code, einvoice_tracking_code: result.tracking_code, einvoice_pdf_url: result.pdf_url }); loadHistory(); } catch { }
      }
      notify('eInvoice draft created successfully!', 'success');
    } catch (err: any) {
      setEInvoiceError(err.message || 'Unknown error');
      setEInvoiceProgress(null);
      setInvoice(prev => ({ ...prev, einvoice_status: 'failed' }));
      if (inv.id) { try { await updateEInvoiceInCloud(inv.id, { einvoice_status: 'failed' }); } catch { } }
    } finally { setEInvoiceTargetInvoice(null); }
  };

  const handleResetEInvoice = (invId: string) => { setResetConfirmId(invId); };

  const confirmResetEInvoice = async () => {
    if (!resetConfirmId) return;
    const invId = resetConfirmId;
    setResetConfirmId(null);
    try {
      await updateEInvoiceInCloud(invId, { einvoice_status: '', einvoice_reference_code: '', einvoice_tracking_code: '', einvoice_pdf_url: '' });
      loadHistory();
      notify('eInvoice status reset', 'success');
    } catch (err) { console.error('[Reset] FAILED:', err); notify('Error resetting eInvoice', 'error'); }
  };

  const handleDownloadEInvoice = (inv: InvoiceData) => {
    const url = getEInvoiceDownloadUrl({
      referenceCode: inv.einvoice_reference_code || '',
      trackingCode: inv.einvoice_tracking_code || '',
      pdfUrl: inv.einvoice_pdf_url || '',
      filename: `eInvoice_${inv.einvoice_reference_code || inv.invoiceNumber}`,
    });
    window.open(url, '_blank');
  };

  /**
   * Tải lại PDF hoá đơn TD Games (bản Preview thương hiệu — khác với eInvoice PDF của SePay ở trên)
   * trực tiếp từ History, không cần bấm Edit rồi vào tab Preview thủ công.
   * Bấm nút → hỏi Light/Dark Theme trước (popup, giống resetConfirmId) → chọn xong mới thực sự
   * export, để không phụ thuộc theme đã lưu sẵn của hoá đơn đó.
   */
  const [pdfThemeChoiceInv, setPdfThemeChoiceInv] = useState<InvoiceData | null>(null);

  const handleDownloadInvoicePdf = (inv: InvoiceData) => { setPdfThemeChoiceInv(inv); };

  const cancelDownloadInvoicePdf = () => setPdfThemeChoiceInv(null);

  const confirmDownloadInvoicePdf = async (theme: 'dark' | 'light') => {
    const inv = pdfThemeChoiceInv;
    setPdfThemeChoiceInv(null);
    if (!inv) return;
    const target = { ...inv, theme };
    const cameFromHistory = activeTab === 'history';
    skipBankAutoApplyRef.current = true;
    setInvoice(target);
    await handleExport('pdf', { targetInvoice: target, skipSavePrompt: true });
    if (cameFromHistory) {
      const restoreHistory = () => { setActiveTab('history'); window.removeEventListener('afterprint', restoreHistory); };
      window.addEventListener('afterprint', restoreHistory);
      // Fallback dọn listener nếu 'afterprint' không bắn (một số trình duyệt/luồng in đặc biệt)
      setTimeout(() => window.removeEventListener('afterprint', restoreHistory), 60000);
    }
  };

  // ── Sync eInvoice statuses from SePay ─────────────────────────
  const [isSyncingEInvoices, setIsSyncingEInvoices] = useState(false);
  // silent=true: chạy ngầm khi vào tab History (không thấy toast trừ khi có thay đổi thật) —
  // khác với bấm nút "🔄 Refresh" thủ công (silent=false, luôn báo kết quả kể cả "không có gì mới").
  const silentSyncRef = useRef(false);

  const syncEInvoiceStatuses = async (opts?: { silent?: boolean }) => {
    silentSyncRef.current = !!opts?.silent;
    // Use latest history from DB
    await loadHistory();
    // Wait a tick for state to settle, then sync from the fetched data
    setIsSyncingEInvoices(true);
  };

  // Effect: when isSyncingEInvoices turns true, do the actual sync using latest history
  useEffect(() => {
    if (!isSyncingEInvoices) return;
    const doSync = async () => {
      const silent = silentSyncRef.current;
      const drafts = history.filter(inv => inv.einvoice_status === 'draft' && inv.einvoice_reference_code);
      if (drafts.length === 0) {
        setIsSyncingEInvoices(false);
        if (!silent) notify('No draft invoices to sync', 'warning');
        return;
      }

      let updated = 0;
      let deleted = 0;
      let errors = 0;

      for (const inv of drafts) {
        try {
          const detail = await getEInvoiceDetail(inv.einvoice_reference_code!);
          if (detail === null) {
            await updateEInvoiceInCloud(inv.id!, { einvoice_status: '', einvoice_reference_code: '', einvoice_tracking_code: '', einvoice_pdf_url: '', einvoice_invoice_number: '' });
            deleted++;
          } else if (detail.status === 'issued') {
            await updateEInvoiceInCloud(inv.id!, {
              einvoice_status: 'issued',
              einvoice_reference_code: inv.einvoice_reference_code,
              einvoice_tracking_code: inv.einvoice_tracking_code,
              einvoice_pdf_url: detail.pdf_url || inv.einvoice_pdf_url,
              einvoice_invoice_number: detail.invoice_number || '',
            });
            updated++;
          } else if (detail.status === 'cancelled') {
            await updateEInvoiceInCloud(inv.id!, { einvoice_status: '', einvoice_reference_code: '', einvoice_tracking_code: '', einvoice_pdf_url: '', einvoice_invoice_number: '' });
            deleted++;
          }
        } catch (err) {
          console.error(`[Sync] Error checking ${inv.einvoice_reference_code}:`, err);
          errors++;
        }
      }

      setIsSyncingEInvoices(false);
      loadHistory();
      const parts = [];
      if (updated > 0) parts.push(`${updated} signed`);
      if (deleted > 0) parts.push(`${deleted} removed`);
      if (errors > 0) parts.push(`${errors} errors`);
      // Silent mode: chỉ báo toast khi có thay đổi thật (tránh làm phiền mỗi lần vào History mà không có gì mới)
      if (!silent || parts.length > 0) {
        notify(parts.length > 0 ? `Sync: ${parts.join(', ')}` : `${drafts.length} draft invoices — no changes`, parts.length > 0 ? 'success' : 'warning');
      }
    };
    doSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncingEInvoices]);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('edit');
  };

  return {
    // Core
    currentUser, setCurrentUser, invoice, setInvoice, activeTab, setActiveTab, accessibleTabs,
    // Data
    history, clients, crmProjects, isLoading, isExporting, lastMessage, setLastMessage,
    filteredHistory, formatCurrencySimple,
    // Bank manager (sub-hook)
    banks: bankMgr.banks,
    showBankManager: bankMgr.showBankManager, setShowBankManager: bankMgr.setShowBankManager,
    editingBankId: bankMgr.editingBankId,
    editingBankData: bankMgr.editingBankData, setEditingBankData: bankMgr.setEditingBankData,
    newBank: bankMgr.newBank, setNewBank: bankMgr.setNewBank,
    handleAddBank: bankMgr.handleAddBank,
    handleDeleteBank: bankMgr.handleDeleteBank,
    handleSetDefaultBank: bankMgr.handleSetDefaultBank,
    handleEditBank: bankMgr.handleEditBank,
    handleCancelEdit: bankMgr.handleCancelEdit,
    handleUpdateBank: bankMgr.handleUpdateBank,
    handleBankSelect: bankMgr.handleBankSelect,
    // Studio manager (sub-hook)
    studios: studioMgr.studios,
    showStudioManager: studioMgr.showStudioManager, setShowStudioManager: studioMgr.setShowStudioManager,
    editingStudioId: studioMgr.editingStudioId, setEditingStudioId: studioMgr.setEditingStudioId,
    editingStudioData: studioMgr.editingStudioData, setEditingStudioData: studioMgr.setEditingStudioData,
    newStudio: studioMgr.newStudio, setNewStudio: studioMgr.setNewStudio,
    handleAddStudio: studioMgr.handleAddStudio,
    handleSetDefaultStudio: studioMgr.handleSetDefaultStudio,
    handleDeleteStudio: studioMgr.handleDeleteStudio,
    handleEditStudio: studioMgr.handleEditStudio,
    handleUpdateStudio: studioMgr.handleUpdateStudio,
    // Client suggestions
    clientSuggestions, setClientSuggestions, showSuggestions, setShowSuggestions,
    // eInvoice
    showEInvoiceModal, eInvoiceProgress, eInvoiceResult, eInvoiceError, pdfDownloading,
    showEInvoicePrompt, eInvoiceTargetInvoice,
    setShowEInvoicePrompt, setEInvoiceTargetInvoice, setShowEInvoiceModal, setEInvoiceResult, setEInvoiceError,
    // Save confirm
    showSaveConfirm, pendingInvoiceToSave,
    // Filters
    filterStudio, setFilterStudio, filterClient, setFilterClient,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    // Reset
    resetConfirmId, setResetConfirmId,
    // Handlers
    updateInvoice, updateItem, notify,
    handleLogout, loadHistory,
    handleSaveClient, handleSelectClient,
    handleSaveToCloud, toggleStatus, handleDeleteInvoice, loadFromHistory, handleDuplicateInvoice,
    // Payment modal
    paymentModal, setPaymentModal, confirmPayment,
    deleteConfirm, setDeleteConfirm, confirmDeleteInvoice,
    handleConfirmSave, handleDismissSave,
    handleExport,
    handleCreateEInvoice, handleResetEInvoice, confirmResetEInvoice, handleDownloadEInvoice,
    handleDownloadInvoicePdf, pdfThemeChoiceInv, confirmDownloadInvoicePdf, cancelDownloadInvoicePdf,
    // Sync eInvoice
    syncEInvoiceStatuses, isSyncingEInvoices,
    // Exchange rate (USD→VND)
    showExchangeRateModal, setShowExchangeRateModal, exchangeRate, setExchangeRate, exchangeRateTarget, confirmCreateEInvoiceWithRate,
    // Live VCB rate
    vcbRate, vcbRateLoading,
    // Email (P3-4)
    emailInvoice, setEmailInvoice,
  };
}
