import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import { useState, useEffect, useCallback } from 'react';
import { HrEmployee, AttShift, AttRecord, AttRequest, AttEmployeeShift } from '@/types';
import * as svc from '../services/attendanceService';
import { fetchEmployees } from '@/apps/hr/services/hrService';
import { setHashTab } from '@/App';

export type AttTab = 'dashboard' | 'log' | 'shifts' | 'reports' | 'leaves';
const VALID_TABS: AttTab[] = ['dashboard', 'log', 'shifts', 'reports', 'leaves'];

export function useAttendanceState(initialTab?: string | null) {
  const { workspace } = useWorkspace();
  const [activeTab, _setActiveTab] = useState<AttTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as AttTab)) return initialTab as AttTab;
    return 'dashboard';
  });
  const setActiveTab = useCallback((tab: AttTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Core data ──
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [shifts, setShifts] = useState<AttShift[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [requests, setRequests] = useState<AttRequest[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<AttEmployeeShift[]>([]);

  // ── Filters ──
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchEmployees(),
        svc.fetchShifts(),
        svc.fetchRecords({ date: selectedDate }),
        svc.fetchRequests(),
        svc.fetchEmployeeShifts(),
      ]);
      // Chỉ nhân viên đang làm việc + không bị loại khỏi bảng lương mới hiện trong chấm công
      if (results[0].status === 'fulfilled') setEmployees(results[0].value.filter((e: HrEmployee) =>
        (e.type === 'fulltime' || e.type === 'parttime') && e.status === 'active' && !e.exclude_from_payroll));
      if (results[1].status === 'fulfilled') setShifts(results[1].value);
      if (results[2].status === 'fulfilled') setRecords(results[2].value);
      if (results[3].status === 'fulfilled') setRequests(results[3].value);
      if (results[4].status === 'fulfilled') setEmployeeShifts(results[4].value);
    } catch (e: any) {
      setToast({ message: e.message || 'Lỗi tải dữ liệu', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Shift CRUD ──
  const handleSaveShift = async (shift: Omit<AttShift, 'id' | 'created_at'>) => {
    try {
      const saved = await svc.saveShift(shift);
      setShifts(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setToast({ message: `Đã tạo ca "${saved.name}"`, type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleUpdateShift = async (id: string, updates: Partial<AttShift>) => {
    try {
      await svc.updateShift(id, updates);
      setShifts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      setToast({ message: 'Đã cập nhật ca', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleDeleteShift = async (id: string) => {
    try {
      await svc.deleteShift(id);
      setShifts(prev => prev.filter(s => s.id !== id));
      setToast({ message: 'Đã xóa ca', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  // ── Check-in/out ──
  const handleCheckIn = async (employeeId: string, method: string = 'manual', shiftId?: string) => {
    try {
      const record = await svc.checkIn(employeeId, method, shiftId);
      setRecords(prev => {
        const idx = prev.findIndex(r => r.id === record.id);
        if (idx >= 0) return prev.map(r => r.id === record.id ? record : r);
        return [record, ...prev];
      });
      const action = record.check_out ? 'Check-out' : 'Check-in';
      setToast({ message: `${action} thành công: ${record.employee?.full_name || ''}`, type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  // ── Request CRUD ──
  const handleSaveRequest = async (req: Omit<AttRequest, 'id' | 'created_at' | 'approved_at' | 'employee'>) => {
    try {
      const saved = await svc.saveRequest(req);
      setRequests(prev => [saved, ...prev]);
      setToast({ message: 'Đã gửi đơn', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleApproveRequest = async (id: string, approvedBy: string, note: string = '') => {
    try {
      await svc.approveRequest(id, approvedBy, note);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const, approved_by: approvedBy, reviewer_note: note } : r));
      setToast({ message: 'Đã duyệt đơn', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleRejectRequest = async (id: string, approvedBy: string, note: string = '') => {
    try {
      await svc.rejectRequest(id, approvedBy, note);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const, approved_by: approvedBy, reviewer_note: note } : r));
      setToast({ message: 'Đã từ chối đơn', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  // ── Employee Shifts ──
  const handleSaveEmployeeShift = async (es: Omit<AttEmployeeShift, 'id' | 'created_at' | 'shift' | 'employee'>) => {
    try {
      const saved = await svc.saveEmployeeShift(es);
      setEmployeeShifts(prev => [saved, ...prev]);
      setToast({ message: 'Đã phân ca', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleDeleteEmployeeShift = async (id: string) => {
    try {
      await svc.deleteEmployeeShift(id);
      setEmployeeShifts(prev => prev.filter(e => e.id !== id));
      setToast({ message: 'Đã xóa phân ca', type: 'success' });
    } catch (e: any) { setToast({ message: e.message, type: 'error' }); }
  };

  // ── Computed ──
  // Tách sổ: filter client-side theo workspace (đổi sổ không cần refetch)
  const wsEmployees = employees.filter(e => matchesWorkspace(e.entity, workspace));
  const empIds = new Set(wsEmployees.map(e => e.id));
  const wsShifts = shifts.filter(s => matchesWorkspace((s as any).entity, workspace));
  const wsRequests = requests.filter(r => empIds.has(r.employee_id));
  const wsRecords = records.filter(r => empIds.has(r.employee_id));
  const wsEmployeeShifts = employeeShifts.filter(es => empIds.has(es.employee_id));

  const todayRecords = wsRecords.filter(r => r.date === selectedDate);
  const checkedInCount = todayRecords.filter(r => r.check_in && !r.check_out).length;
  const completedCount = todayRecords.filter(r => r.check_in && r.check_out).length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length;
  const pendingRequests = wsRequests.filter(r => r.status === 'pending');

  return {
    activeTab, setActiveTab,
    isLoading, toast, setToast,
    employees: wsEmployees, shifts: wsShifts, records: wsRecords, requests: wsRequests, employeeShifts: wsEmployeeShifts,
    selectedDate, setSelectedDate,
    todayRecords, checkedInCount, completedCount, lateCount, pendingRequests,
    handleSaveShift, handleUpdateShift, handleDeleteShift,
    handleCheckIn,
    handleSaveRequest, handleApproveRequest, handleRejectRequest,
    handleSaveEmployeeShift, handleDeleteEmployeeShift,
    loadAll,
  };
}
