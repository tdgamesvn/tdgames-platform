import { useWorkspace, matchesWorkspace, getWorkspace } from '@/services/WorkspaceContext';
import { useState, useEffect, useCallback } from 'react';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
import { supabase } from '@/services/supabaseClient';
import * as svc from '../services/payrollService';
import { FALLBACK_PAYROLL_FORMULA } from '../services/payrollFormulaService';
import { resolvePayslipDispute } from '@/apps/portal/services/portalService';

export type PayrollView = 'sheets' | 'detail';

async function getSessionUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export function usePayrollState(initialTab?: string | null) {
  const { workspace } = useWorkspace();
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
        .eq('entity', getWorkspace()) // đọc lúc action — tránh stale closure deps
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

  /** Làm mới danh sách records (fetch lại từ DB) — dùng khi cần sync thủ công. */
  const refreshRecords = useCallback(async () => {
    if (!activeSheet) return;
    setLoading(true);
    try {
      const data = await svc.fetchPayrollRecords(activeSheet.id);
      setRecords(data);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSheet]);

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

  const updateRecord = useCallback(async (id: string, field: string, value: number | string) => {
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    const std = activeSheet?.standard_work_days;
    setRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Chỉ recalculate cho numeric fields — string fields (bonus_reason) không ảnh hưởng tính lương
      if (typeof value === 'string') return updated as PayPayrollRecord;
      return svc.recalculateRecord(updated, f, std);
    }));
  }, [activeFormula, activeSheet]);

  const saveRecord = useCallback(async (rec: PayPayrollRecord) => {
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    const std = activeSheet?.standard_work_days;
    try {
      await svc.recalculateAndSave(rec, f, std);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, [activeFormula, activeSheet]);

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

  // Realtime: cập nhật employee_status ngay khi nhân viên xác nhận/khiếu nại từ portal
  useEffect(() => {
    if (!activeSheet) return;
    const sheetId = activeSheet.id;
    const channel = supabase
      .channel(`payroll_records_ack_${sheetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pay_payroll_records',
          filter: `sheet_id=eq.${sheetId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.id) return;
          setRecords(prev => prev.map(r =>
            r.id === updated.id
              ? {
                  ...r,
                  employee_status: updated.employee_status,
                  employee_confirmed_at: updated.employee_confirmed_at,
                  employee_comment: updated.employee_comment,
                }
              : r,
          ));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSheet]);

  const resolveDispute = useCallback(async (recordId: string) => {
    try {
      await resolvePayslipDispute(recordId);
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, employee_status: 'resolved' as const } : r,
      ));
      setToast({ message: 'Đã đánh dấu giải quyết khiếu nại', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  }, []);

  const backToSheets = useCallback(() => {
    setView('sheets');
    setActiveSheet(null);
    setRecords([]);
    setActiveFormula(null);
  }, []);

  return {
    view, sheets: sheets.filter(s => matchesWorkspace((s as any).entity, workspace)), records, activeSheet, activeFormula, loading, toast,
    setToast, createSheet, openSheet, deleteSheet,
    updateRecord, saveRecord, confirmSheet, markSheetPaid, rollbackSheet, resolveDispute, refreshRecords, backToSheets,
  };
}
