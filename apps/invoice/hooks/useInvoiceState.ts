import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_INVOICE } from '@/constants';
import { InvoiceData, ServiceItem, BankingInfo, ClientRecord, StudioInfo, AccountUser } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { createAndPollDraft, getEInvoiceDetail } from '../services/sePayService';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import {
  saveInvoiceToCloud,
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
    currentUser?.role === 'admin' || currentUser?.role === 'ke_toan'
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
    bankMgr.loadBanks(activeTab === 'edit');
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
    if (activeTab === 'history' || activeTab === 'dashboard' || activeTab === 'aging') loadHistory();
  }, [activeTab]);

  // ── Realtime Subscription (P3-1) ──
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
  const handleSaveClient = async () => {
    const ci = invoice.clientInfo;
    if (!ci.name) return notify('Please enter a client name.', 'error');
    try {
      const existing = clients.find(c => c.name.toLowerCase() === ci.name.toLowerCase());
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
  const handleSaveToCloud = async () => {
    setIsLoading(true);
    try { await saveInvoiceToCloud(invoice); notify("Invoice synced to Cloud!", "success"); if (activeTab === 'history') loadHistory(); }
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
      const result = await saveInvoiceToCloud(pendingInvoiceToSave);
      notify('Đã lưu hoá đơn lên Cloud!', 'success');
      const savedInvoice = { ...pendingInvoiceToSave, id: result.id };
      setInvoice(prev => ({ ...prev, id: result.id }));
      if (activeTab === 'history') loadHistory();
      getNextInvoiceNumber().then(nextNum => { setInvoice(prev => ({ ...prev, invoiceNumber: nextNum })); });
      if (!pendingInvoiceToSave.einvoice_status || pendingInvoiceToSave.einvoice_status === 'none' || pendingInvoiceToSave.einvoice_status === '' || pendingInvoiceToSave.einvoice_status === 'failed') {
        setEInvoiceTargetInvoice(savedInvoice);
        setShowEInvoicePrompt(true);
      }
    } catch (e: any) { notify('Lỗi lưu hoá đơn: ' + e.message, 'error'); }
    finally { setShowSaveConfirm(false); setPendingInvoiceToSave(null); }
  };

  const handleDismissSave = () => { setShowSaveConfirm(false); setPendingInvoiceToSave(null); };

  // ── Export ──
  const handleExport = async (format: 'pdf' | 'png' | 'excel' | 'word') => {
    const { exportToPDF, exportToPNG, exportToExcel, exportToWord } = await import('../services/exportService');
    const fileName = `Invoice_${invoice.invoiceNumber}`;
    setIsExporting(format);
    try {
      if (format === 'pdf' || format === 'png' || format === 'word') {
        if (activeTab !== 'preview') { setActiveTab('preview'); await new Promise(resolve => setTimeout(resolve, 1200)); }
      }
      switch (format) {
        case 'pdf': await exportToPDF('invoice-capture', fileName); break;
        case 'png': await exportToPNG('invoice-capture', fileName, invoice.theme); break;
        case 'excel': exportToExcel(invoice, fileName); break;
        case 'word': exportToWord('invoice-capture', fileName); break;
      }
      if (format === 'pdf') { setPendingInvoiceToSave(invoice); setShowSaveConfirm(true); }
    } catch (error) { console.error("Export failed:", error); notify("Error exporting file. Please try again.", "error"); }
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
    const params = new URLSearchParams({
      reference_code: inv.einvoice_reference_code || '',
      tracking_code: inv.einvoice_tracking_code || '',
      pdf_url: inv.einvoice_pdf_url || '',
      filename: `eInvoice_${inv.einvoice_reference_code || inv.invoiceNumber}`,
    });
    window.open(`https://n8n.tdconsulting.vn/webhook/sepay-invoice-download?${params.toString()}`, '_blank');
  };

  // ── Sync eInvoice statuses from SePay ─────────────────────────
  const [isSyncingEInvoices, setIsSyncingEInvoices] = useState(false);

  const syncEInvoiceStatuses = async () => {
    // Use latest history from DB
    await loadHistory();
    // Wait a tick for state to settle, then sync from the fetched data
    setIsSyncingEInvoices(true);
  };

  // Effect: when isSyncingEInvoices turns true, do the actual sync using latest history
  useEffect(() => {
    if (!isSyncingEInvoices) return;
    const doSync = async () => {
      const drafts = history.filter(inv => inv.einvoice_status === 'draft' && inv.einvoice_reference_code);
      if (drafts.length === 0) {
        setIsSyncingEInvoices(false);
        notify('No draft invoices to sync', 'warning');
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
      notify(parts.length > 0 ? `Sync: ${parts.join(', ')}` : `${drafts.length} draft invoices — no changes`, parts.length > 0 ? 'success' : 'warning');
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
