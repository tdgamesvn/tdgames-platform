import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import { useState, useEffect, useCallback } from 'react';
import {
  FixedAsset, Advance, BankStatement, BankStatementRow,
  InvoiceData, ExpenseRecord, HrEmployee, Settlement,
  SavingsDeposit, LoanRecord,
} from '@/types';
import * as svc from '../services/accountingService';
import type { PayrollRecordWithMeta, BhxhEmployee } from '../services/accountingService';
import { fetchSavings } from '../services/savingsService';
import { fetchLoans } from '../services/loansService';
import { setHashTab } from '@/App';
import { supabase } from '@/services/supabaseClient';

export type AccountingTab = 'assets' | 'advances' | 'payables' | 'pnl' | 'bank' | 'vat' | 'tncn' | 'bhxh' | 'savings' | 'loans' | 'bank-balance';
const VALID_TABS: AccountingTab[] = ['assets', 'advances', 'payables', 'pnl', 'bank', 'vat', 'tncn', 'bhxh', 'savings', 'loans', 'bank-balance'];

export function useAccountingState(currentUser: string, initialTab?: string | null) {
  const { workspace } = useWorkspace();
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
  const [savings, setSavings] = useState<SavingsDeposit[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, adv, stmts, invs, exps, payroll, emps, settlements, bhxhEmps, savs, lns] = await Promise.all([
        svc.fetchFixedAssets(),
        svc.fetchAdvances(),
        svc.fetchBankStatements(),
        svc.fetchInvoicesForAccounting(),
        svc.fetchExpensesForAccounting(),
        svc.fetchPayrollForTncn(),
        svc.fetchEmployeesForAccounting(),
        svc.fetchSettlementsForTncn(),
        svc.fetchEmployeesForBhxh(),
        fetchSavings(),
        fetchLoans(),
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
      setSavings(savs);
      setLoans(lns);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: cập nhật expense_expenses khi Workforce ghi payment (INSERT/UPDATE)
  // Fix bug: Công nợ phải trả không cập nhật sau khi thanh toán nghiệm thu
  useEffect(() => {
    const channel = supabase
      .channel('accounting_expense_expenses_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expense_expenses' },
        (payload) => {
          setExpenses(prev => {
            // Tránh duplicate nếu đã có
            if (prev.find(e => e.id === payload.new.id)) return prev;
            return [payload.new as ExpenseRecord, ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'expense_expenses' },
        (payload) => {
          setExpenses(prev => prev.map(e =>
            e.id === payload.new.id ? { ...e, ...(payload.new as ExpenseRecord) } : e,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expense_expenses' },
        (payload) => {
          setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    // Tách sổ: filter client-side theo workspace (reactive khi đổi sổ)
    assets: assets.filter(x => matchesWorkspace((x as any).entity, workspace)),
    advances: advances.filter(x => matchesWorkspace((x as any).entity, workspace)),
    savings: savings.filter(x => matchesWorkspace((x as any).entity, workspace)),
    loans: loans.filter(x => matchesWorkspace((x as any).entity, workspace)),
    statements, invoices, expenses, payrollRecords, employees, freelancerSettlements, bhxhEmployees,
    loading, error, reload: loadAll,
    addAsset, editAsset, removeAsset,
    addAdvance, settle, cancel, removeAdvance,
    importStatements, matchStatement, unmatchStatement,
    openAdvancesTotal, monthlyDepTotal, activeAssets,
  };
}
