import { useState, useEffect, useCallback, useRef } from 'react';
import type { CrmDeal, CrmDealStage } from '@/types';
import * as svc from '../services/crmService';
import { useDealFilters } from './useDealFilters';

export function useDealPipeline() {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CrmDealStage | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const dragDealId = useRef<string | null>(null);

  // ── Filters ─────────────────────────────────────────────────
  const dealFilters = useDealFilters(deals);

  // ── Toast helper ────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load ────────────────────────────────────────────────────
  const loadDeals = useCallback(async () => {
    try {
      const data = await svc.fetchDeals();
      setDeals(data);
    } catch (err) {
      console.error('fetchDeals error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // ── Refetch on tab focus ───────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') loadDeals();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [loadDeals]);

  // ── Group filtered deals by stage ─────────────────────────
  const columns: Record<CrmDealStage, CrmDeal[]> = {
    lead: [], contacted: [], negotiating: [], proposal_sent: [], contracting: [], won: [], lost: [],
  };
  dealFilters.filtered.forEach(d => { columns[d.stage]?.push(d); });

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragStart = (_e: React.DragEvent, dealId: string) => {
    dragDealId.current = dealId;
  };

  const handleDragEnd = () => {
    setDragOverStage(null);
    dragDealId.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (_e: React.DragEvent, newStage: CrmDealStage) => {
    setDragOverStage(null);
    const id = dragDealId.current;
    if (!id) return;
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.stage === newStage) return;

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: newStage, updated_at: new Date().toISOString() } : d));
    if (selectedDeal?.id === id) setSelectedDeal(prev => prev ? { ...prev, stage: newStage } : null);

    try {
      await svc.updateDealStage(id, newStage);
      const stageLabel = newStage === 'won' ? '🎉 Won' : newStage === 'lost' ? '❌ Lost' : newStage;
      showToast(`Chuyển deal sang ${stageLabel}`);
    } catch {
      showToast('Lỗi chuyển stage, đang khôi phục...', 'error');
      loadDeals();
    }
    dragDealId.current = null;
  };

  // ── Stage change (from detail panel) ──────────────────────
  const handleStageChange = async (id: string, newStage: CrmDealStage) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage: newStage } : d));
    if (selectedDeal?.id === id) setSelectedDeal(prev => prev ? { ...prev, stage: newStage } : null);
    try {
      await svc.updateDealStage(id, newStage);
      showToast(`Đã chuyển sang ${newStage}`);
    } catch {
      showToast('Lỗi chuyển stage', 'error');
      loadDeals();
    }
  };

  // ── Inline field update ───────────────────────────────────
  const updateDealField = async (id: string, field: string, value: any) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    if (selectedDeal?.id === id) setSelectedDeal(prev => prev ? { ...prev, [field]: value } : null);
    try {
      await svc.updateDeal(id, { [field]: value } as any);
      showToast('Đã cập nhật');
    } catch {
      showToast('Lỗi cập nhật', 'error');
      loadDeals();
    }
  };

  // ── CRUD ──────────────────────────────────────────────────
  const handleSave = async (data: any) => {
    try {
      if (editingDeal) {
        await svc.updateDeal(editingDeal.id, data);
        showToast('Đã cập nhật deal');
      } else {
        await svc.createDeal(data);
        showToast('Đã tạo deal mới');
      }
      await loadDeals();
      setEditingDeal(null);
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu deal', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setDeals(prev => prev.filter(d => d.id !== id));
    setSelectedDeal(null);
    try {
      await svc.deleteDeal(id);
      showToast('Đã xoá deal');
    } catch {
      showToast('Lỗi xoá deal', 'error');
      loadDeals();
    }
  };

  // ── Modal helpers ─────────────────────────────────────────
  const openCreateModal = () => { setEditingDeal(null); setShowModal(true); };
  const openEditModal = (deal: CrmDeal) => { setEditingDeal(deal); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingDeal(null); };

  return {
    // Data
    deals,
    columns,
    isLoading,

    // Filters (delegated)
    filters: dealFilters.filters,
    setFilter: dealFilters.setFilter,
    resetFilters: dealFilters.resetFilters,
    hasActiveFilters: dealFilters.hasActiveFilters,
    owners: dealFilters.owners,
    filteredDeals: dealFilters.filtered,

    // Toast
    toast, setToast,

    // Selection
    showModal, editingDeal,
    selectedDeal, setSelectedDeal,
    dragOverStage, setDragOverStage,

    // Drag
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,

    // CRUD
    handleSave,
    handleDelete,
    handleStageChange,
    updateDealField,

    // Modal
    openCreateModal,
    openEditModal,
    closeModal,
  };
}
