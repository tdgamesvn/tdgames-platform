import React, { useState, useCallback } from 'react';
import { BankingInfo } from '@/types';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  saveBankToCloud,
  fetchBanksFromCloud,
  deleteBankFromCloud,
  updateBankInCloud,
  setDefaultBankInCloud,
} from '../services/supabaseService';

type BankRecord = BankingInfo & { id: string; isDefault: boolean; entity: string };
type Notify = (msg: string, type?: 'success' | 'warning' | 'error') => void;

const EMPTY_BANK: BankingInfo = {
  alias: '', accountName: '', accountNumber: '', bankName: '',
  branchName: '', bankAddress: '', citadCode: '', swiftCode: '',
};

export function useBankManager(notify: Notify, applyBankToInvoice: (info: BankingInfo) => void) {
  const [allBanks, setBanks] = useState<BankRecord[]>([]);
  const { workspace } = useWorkspace();
  // ponytail: filter theo sổ tại 1 điểm chung — dropdown + manager + default đều ăn theo
  const banks = allBanks.filter(b => matchesWorkspace(b.entity, workspace));
  const [showBankManager, setShowBankManager] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankData, setEditingBankData] = useState<BankingInfo | null>(null);
  const [newBank, setNewBank] = useState<BankingInfo>(EMPTY_BANK);
  const [isLoading, setIsLoading] = useState(false);

  const loadBanks = useCallback(async (autoApplyDefault = false) => {
    const data = await fetchBanksFromCloud();
    setBanks(data);
    const inBook = data.filter(b => matchesWorkspace(b.entity, workspace));
    if (autoApplyDefault) {
      const def = inBook.find(b => b.isDefault);
      if (def) {
        const { id, isDefault, entity, ...info } = def;
        applyBankToInvoice(info);
      }
    }
    return inBook;
  }, [applyBankToInvoice, workspace]);

  const handleAddBank = async () => {
    if (!newBank.accountName || !newBank.accountNumber || !newBank.alias) {
      notify('Please enter Alias, Account Name and Account Number.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await saveBankToCloud(newBank);
      notify('Account saved!', 'success');
      setNewBank(EMPTY_BANK);
      await loadBanks();
    } catch (e: any) {
      notify('Error saving account: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Delete this bank account?')) return;
    try {
      await deleteBankFromCloud(id);
      await loadBanks();
      notify('Account deleted.', 'success');
    } catch {
      notify('Cannot delete.', 'error');
    }
  };

  const handleSetDefaultBank = async (id: string) => {
    try {
      await setDefaultBankInCloud(id, banks);
      const updated = await fetchBanksFromCloud();
      setBanks(updated);
      const def = updated.find(b => b.id === id);
      if (def) {
        const { id: _i, isDefault: _d, entity: _e, ...info } = def;
        applyBankToInvoice(info);
      }
      notify('Default account set!', 'success');
    } catch (e: any) {
      notify('Error setting default: ' + e.message, 'error');
    }
  };

  const handleEditBank = (bank: BankRecord) => {
    setEditingBankId(bank.id);
    const { id, isDefault, entity, ...info } = bank;
    setEditingBankData(info);
  };

  const handleCancelEdit = () => {
    setEditingBankId(null);
    setEditingBankData(null);
  };

  const handleUpdateBank = async () => {
    if (!editingBankId || !editingBankData) return;
    setIsLoading(true);
    try {
      await updateBankInCloud(editingBankId, editingBankData);
      notify('Account updated!', 'success');
      setEditingBankId(null);
      setEditingBankData(null);
      await loadBanks();
    } catch (e: any) {
      notify('Update error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bankId = e.target.value;
    if (!bankId) return;
    const selected = banks.find(b => b.id === bankId);
    if (selected) {
      const { id, isDefault, entity, ...info } = selected;
      applyBankToInvoice(info);
    }
  };

  return {
    banks, showBankManager, setShowBankManager,
    editingBankId, editingBankData, setEditingBankData,
    newBank, setNewBank,
    isBankLoading: isLoading,
    loadBanks,
    handleAddBank, handleDeleteBank, handleSetDefaultBank,
    handleEditBank, handleCancelEdit, handleUpdateBank, handleBankSelect,
  };
}
