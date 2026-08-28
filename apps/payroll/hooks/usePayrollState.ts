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

  /** Kéo lại ngày công/OT từ bảng chấm công đã chốt + áp lại công thức hiện hành cho cả bảng.
   *  Ngày công là ảnh chụp lúc tạo bảng, nên sửa chấm công xong KHÔNG tự vào bảng lương —
   *  đây là chỗ duy nhất kéo lại. Cũng dùng khi công thức/hệ số đổi giữa chừng. */
  const recalcAllRecords = useCallback(async () => {
    if (!activeSheet || activeSheet.status !== 'draft' || records.length === 0) return;
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    setLoading(true);
    try {
      const { records: recalced, attendanceFound, changed } =
        await svc.resyncAttendanceAndRecalc(activeSheet, records, f);
      setRecords(recalced);
      setToast(attendanceFound
        ? {
            message: changed > 0
              ? `Đã đồng bộ chấm công + tính lại ${recalced.length} người · ${changed} người đổi ngày công/OT`
              : `Đã tính lại ${recalced.length} người · ngày công/OT khớp sẵn với chấm công`,
            type: 'success',
          }
        : {
            message: `Đã áp lại công thức cho ${recalced.length} người, NHƯNG không thấy bảng chấm công`
              + ` đã chốt T${activeSheet.month}/${activeSheet.year} — ngày công giữ nguyên số cũ.`
              + ` Vào Chấm công → Chốt bảng rồi bấm lại.`,
            type: 'error',
          });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSheet, activeFormula, records]);

  /** Kế toán sửa công chuẩn của bảng (VD T9/2026: 22 T2-T6 + lễ 2/9 + nửa ngày T7 = 23).
   *  Đổi số xong phải tính lại HẾT record, không thì ratio cũ còn nguyên trong DB. */
  const updateStandardWorkDays = useCallback(async (std: number, note: string) => {
    if (!activeSheet || activeSheet.status !== 'draft') return;
    if (!Number.isFinite(std) || std <= 0 || std > 31) {
      setToast({ message: 'Công chuẩn phải trong khoảng 1–31 ngày', type: 'error' });
      return;
    }
    // Lý do bắt buộc: đổi số này là tính lại tiền cả bảng, phải có vết giải trình.
    if (!note.trim()) {
      setToast({ message: 'Phải nhập lý do đổi công chuẩn', type: 'error' });
      return;
    }
    if (std === activeSheet.standard_work_days) return;
    const f = activeFormula ?? FALLBACK_PAYROLL_FORMULA;
    setLoading(true);
    try {
      const updated = await svc.updateSheetStandardWorkDays(activeSheet.id, std, note.trim());
      const recalced = await Promise.all(records.map(r => svc.recalculateAndSave(r, f, std)));
      setActiveSheet(updated);
      setSheets(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setRecords(recalced);
      setToast({ message: `Công chuẩn ${std} ngày · đã tính lại ${recalced.length} người`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSheet, activeFormula, records]);

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
    updateRecord, saveRecord, updateStandardWorkDays, recalcAllRecords, confirmSheet, markSheetPaid, rollbackSheet, resolveDispute, refreshRecords, backToSheets,
  };
}
