import { useState, useEffect, useCallback } from 'react';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
import { supabase } from '@/services/supabaseClient';
import * as svc from '../services/payrollService';
import { FALLBACK_PAYROLL_FORMULA } from '../services/payrollFormulaService';

export type PayrollView = 'sheets' | 'detail';

async function getSessionUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export function usePayrollState(initialTab?: string | null) {
  const [view, setView] = useState<PayrollView>('sheets');
  const [sheets, setSheets] = useState<PayPayrollSheet[]>([]);
  const [records, setRecords] = useState<PayPayrollRecord[]>([]);
  const [activeSheet, setActiveSheet] = useState<PayPayrollSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeFormula, setActiveFormula] = useState<PayrollFormulaConfig | null>(null);

  const loadSheets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.fetchPayrollSheets();
      setSheets(data);
      const tab = initialTab?.trim();
      if (tab && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tab)) {
        const sheet = data.find(s => s.id === tab);
        if (sheet) {
          const formula = await svc.resolveFormulaForSheet(sheet);
          setActiveFormula(formula);
          setActiveSheet(sheet);
          const recs = await svc.fetchPayrollRecords(sheet.id);
          setRecords(recs);
          setView('detail');
        }
      }
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [initialTab]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const createSheet = useCallback(async (month: number, year: number) => {
    setLoading(true);
    try {
      // Check if attendance sheet for this month is finalized
      const { data: attSheets } = await supabase
        .from('att_monthly_sheets')
        .select('id, status')
        .eq('month', month)
        .eq('year', year);

      if (!attSheets || attSheets.length === 0) {
        setToast({ message: `⚠️ Chưa có bảng chấm công Tháng ${month}/${year}. Vui lòng tạo bảng chấm công trước.`, type: 'error' });
        setLoading(false);
        return;
      }

      const attSheet = attSheets[0];
      if (attSheet.status !== 'finalized') {
        setToast({ message: `⚠️ Bảng chấm công Tháng ${month}/${year} chưa được chốt. Vui lòng chốt bảng công trước khi tính lương.`, type: 'error' });
        setLoading(false);
        return;
      }

      const { sheet, records: recs } = await svc.createPayrollSheet(month, year);
      const formula = await svc.resolveFormulaForSheet(sheet);
      setActiveFormula(formula);
      setSheets(prev => [sheet, ...prev]);
      setActiveSheet(sheet);
      setRecords(recs);
      setView('detail');
      setToast({ message: `Đã tạo bảng lương Tháng ${month}/${year}`, type: 'success' });
    } catch (err: any) {
      const code = err?.code;
      const msg = String(err?.message || '');
      if (code === '23505' || msg.includes('pay_payroll_sheets_month_year_key') || msg.toLowerCase().includes('duplicate')) {
        setToast({
          message: `Đã có bảng lương Tháng ${month}/${year}. Chọn bảng trong danh sách để mở.`,
          type: 'error',
        });
      } else {
        setToast({ message: err.message, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const openSheet = useCallback(async (sheet: PayPayrollSheet) => {
    setLoading(true);
    try {
      const formula = await svc.resolveFormulaForSheet(sheet);
      setActiveFormula(formula);
      setActiveSheet(sheet);
      const data = await svc.fetchPayrollRecords(sheet.id);
      setRecords(data);
      setView('detail');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSheet = useCallback(async (id: string) => {
    try {
      await svc.deletePayrollSheet(id);
      setSheets(prev => prev.filter(s => s.id !== id));
      if (activeSheet?.id === id) {
        setActiveSheet(null);
        setRecords([]);
        setView('sheets');
      }
      setToast({ message: 'Đã xoá bảng lương', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeSheet]);

  const updateRecord = useCallback(async (id: string, field: string, value: number) => {
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    setRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      return svc.recalculateRecord(updated, f);
    }));
  }, [activeFormula]);

  const saveRecord = useCallback(async (rec: PayPayrollRecord) => {
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    try {
      await svc.recalculateAndSave(rec, f);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeFormula]);

  const confirmSheet = useCallback(async () => {
    if (!activeSheet) return;
    try {
      const uid = await getSessionUserId();
      const updated = await svc.updateSheetStatus(activeSheet.id, 'confirmed', { userId: uid, setConfirmedBy: true });
      setActiveSheet(updated);
      setSheets(prev => prev.map(s => s.id === activeSheet.id ? updated : s));
      setToast({ message: 'Đã xác nhận bảng lương', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeSheet]);

  const markSheetPaid = useCallback(async () => {
    if (!activeSheet || activeSheet.status !== 'confirmed') return;
    try {
      const uid = await getSessionUserId();
      const updated = await svc.updateSheetStatus(activeSheet.id, 'paid', { userId: uid, setPaidBy: true });
      setActiveSheet(updated);
      setSheets(prev => prev.map(s => s.id === activeSheet.id ? updated : s));
      setToast({ message: 'Đã đánh dấu đã trả lương', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeSheet]);

  const rollbackSheet = useCallback(async () => {
    if (!activeSheet || activeSheet.status === 'paid') return;
    try {
      const updated = await svc.updateSheetStatus(activeSheet.id, 'draft');
      setActiveSheet(updated);
      setSheets(prev => prev.map(s => s.id === activeSheet.id ? updated : s));
      setToast({ message: 'Đã huỷ xác nhận — bảng lương quay lại Nháp', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeSheet]);

  const backToSheets = useCallback(() => {
    setView('sheets');
    setActiveSheet(null);
    setRecords([]);
    setActiveFormula(null);
  }, []);

  return {
    view, sheets, records, activeSheet, activeFormula, loading, toast,
    setToast, createSheet, openSheet, deleteSheet,
    updateRecord, saveRecord, confirmSheet, markSheetPaid, rollbackSheet, backToSheets,
  };
}
