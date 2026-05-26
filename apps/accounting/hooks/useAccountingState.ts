import { useState, useEffect, useCallback } from 'react';
import {
  FixedAsset, Advance, BankStatement, BankStatementRow,
  InvoiceData, ExpenseRecord, HrEmployee, Settlement,
} from '@/types';
import * as svc from '../services/accountingService';
import type { PayrollRecordWithMeta, BhxhEmployee } from '../services/accountingService';
import { setHashTab } from '@/App';

export type AccountingTab = 'assets' | 'advances' | 'payables' | 'pnl' | 'bank' | 'vat' | 'tncn' | 'bhxh';
const VALID_TABS: AccountingTab[] = ['assets', 'advances', 'payables', 'pnl', 'bank', 'vat', 'tncn', 'bhxh'];

export function useAccountingState(currentUser: string, initialTab?: string | null) {
  const [activeTab, _setActiveTab] = useState<AccountingTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as AccountingTab))
      return initialTab as AccountingTab;
    return 'assets';
  });

  const setActiveTab = useCallback((tab: AccountingTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecordWithMeta[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [freelancerSettlements, setFreelancerSettlements] = useState<Settlement[]>([]);
  const [bhxhEmployees, setBhxhEmployees] = useState<BhxhEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, adv, stmts, invs, exps, payroll, emps, settlements, bhxhEmps] = await Promise.all([
        svc.fetchFixedAssets(),
        svc.fetchAdvances(),
        svc.fetchBankStatements(),
        svc.fetchInvoicesForAccounting(),
        svc.fetchExpensesForAccounting(),
        svc.fetchPayrollForTncn(),
        svc.fetchEmployeesForAccounting(),
        svc.fetchSettlementsForTncn(),
        svc.fetchEmployeesForBhxh(),
      ]);
      setAssets(a);
      setAdvances(adv);
      setStatements(stmts);
      setInvoices(invs);
      setExpenses(exps);
      setPayrollRecords(payroll);
      setEmployees(emps);
      setFreelancerSettlements(settlements);
      setBhxhEmployees(bhxhEmps);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Fixed Assets ──
  const addAsset = useCallback(async (asset: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>) => {
    const saved = await svc.saveFixedAsset({ ...asset, created_by: currentUser });
    setAssets(prev => [saved, ...prev]);
    return saved;
  }, [currentUser]);

  const editAsset = useCallback(async (id: string, updates: Partial<FixedAsset>) => {
    await svc.updateFixedAsset(id, updates);
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeAsset = useCallback(async (id: string) => {
    await svc.deleteFixedAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Advances ──
  const addAdvance = useCallback(async (adv: Omit<Advance, 'id' | 'created_at' | 'updated_at'>) => {
    const saved = await svc.saveAdvance({ ...adv, created_by: currentUser });
    setAdvances(prev => [saved, ...prev]);
    return saved;
  }, [currentUser]);

  const settle = useCallback(async (
    id: string,
    payload: { settled_amount: number; returned_amount: number; settlement_date: string; settlement_notes?: string }
  ) => {
    await svc.settleAdvance(id, payload);
    setAdvances(prev => prev.map(a => a.id === id ? { ...a, ...payload, status: 'settled' as const } : a));
  }, []);

  const cancel = useCallback(async (id: string) => {
    await svc.cancelAdvance(id);
    setAdvances(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a));
  }, []);

  const removeAdvance = useCallback(async (id: string) => {
    await svc.deleteAdvance(id);
    setAdvances(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Bank Reconciliation ──
  const importStatements = useCallback(async (bank: string, rows: BankStatementRow[]) => {
    await svc.importBankStatements(bank, rows);
    const fresh = await svc.fetchBankStatements();
    setStatements(fresh);
  }, []);

  const matchStatement = useCallback(async (
    id: string, matchedType: 'invoice' | 'expense' | 'advance', matchedId: string
  ) => {
    await svc.matchBankStatement(id, matchedType, matchedId);
    setStatements(prev => prev.map(s =>
      s.id === id ? { ...s, matched_type: matchedType, matched_id: matchedId } : s
    ));
  }, []);

  const unmatchStatement = useCallback(async (id: string) => {
    await svc.unmatchBankStatement(id);
    setStatements(prev => prev.map(s =>
      s.id === id ? { ...s, matched_type: undefined, matched_id: undefined } : s
    ));
  }, []);

  // Summaries
  const openAdvancesTotal = advances.filter(a => a.status === 'open').reduce((s, a) => s + a.amount, 0);
  const activeAssets = assets.filter(a => a.status === 'active');
  const monthlyDepTotal = svc.sumMonthlyDepreciation(activeAssets);

  return {
    activeTab, setActiveTab,
    assets, advances, statements, invoices, expenses, payrollRecords, employees, freelancerSettlements, bhxhEmployees,
    loading, error, reload: loadAll,
    addAsset, editAsset, removeAsset,
    addAdvance, settle, cancel, removeAdvance,
    importStatements, matchStatement, unmatchStatement,
    openAdvancesTotal, monthlyDepTotal, activeAssets,
  };
}
