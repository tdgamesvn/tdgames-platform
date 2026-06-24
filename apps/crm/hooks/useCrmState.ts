import { useState, useEffect, useCallback } from 'react';
import { CrmClient, CrmContact } from '@/types';
import * as svc from '../services/crmService';

export type CrmTab = 'dashboard' | 'deals' | 'clients' | 'projects' | 'documents' | 'payments' | 'activities' | 'outreach';

export function useCrmState(initialTab?: string | null) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CrmTab>(() => {
    if (initialTab === 'activities') return 'activities';
    return 'clients';
  });
  const [editingClient, setEditingClient] = useState<CrmClient | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load data ─────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await svc.fetchClients();
      setClients(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // ── Client CRUD ───────────────────────────────────────────
  const handleCreateClient = async (data: Omit<CrmClient, 'id' | 'created_at' | 'updated_at' | 'contacts'>) => {
    try {
      const newClient = await svc.createClient(data);
      await loadClients();
      showToast('Đã thêm khách hàng');
      return newClient;
    } catch (err: any) {
      showToast(err.message, 'error');
      return null;
    }
  };

  const handleUpdateClient = async (id: string, updates: Partial<CrmClient>) => {
    try {
      await svc.updateClient(id, updates);
      await loadClients();
      showToast('Đã cập nhật khách hàng');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await svc.deleteClient(id);
      await loadClients();
      showToast('Đã xoá khách hàng');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ── Contact CRUD ──────────────────────────────────────────
  const handleCreateContact = async (contact: Omit<CrmContact, 'id' | 'created_at'>) => {
    try {
      await svc.createContact(contact);
      await loadClients();
      showToast('Đã thêm liên hệ');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateContact = async (id: string, updates: Partial<CrmContact>) => {
    try {
      await svc.updateContact(id, updates);
      await loadClients();
      showToast('Đã cập nhật liên hệ');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await svc.deleteContact(id);
      await loadClients();
      showToast('Đã xoá liên hệ');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ── Filtered list ──
  const filteredClients = clients.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const contactMatch = (c.contacts || []).some(ct =>
        ct.name.toLowerCase().includes(q) ||
        ct.email.toLowerCase().includes(q) ||
        ct.phone.toLowerCase().includes(q)
      );
      if (
        !c.name.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q) &&
        !c.contact_person.toLowerCase().includes(q) &&
        !c.phone.toLowerCase().includes(q) &&
        !contactMatch
      ) return false;
    }
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterIndustry && c.industry !== filterIndustry) return false;
    return true;
  });

  // ── Derived stats ──
  const industries = [...new Set(clients.map(c => c.industry).filter(Boolean))];
  const statusCounts: Record<string, number> = {};
  clients.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  return {
    clients,
    filteredClients,
    isLoading,
    activeTab, setActiveTab,
    editingClient, setEditingClient,
    toast, setToast,
    searchQuery, setSearchQuery,
    filterStatus, setFilterStatus,
    filterIndustry, setFilterIndustry,
    industries,
    statusCounts,
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient,
    handleCreateContact,
    handleUpdateContact,
    handleDeleteContact,
    loadClients,
  };
}
