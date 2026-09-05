import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import React, { useState, useEffect, useCallback } from 'react';
import { HrEmployee, AttMonthlySheet, AttMonthlyRecord } from '@/types';
import * as svc from '../services/attendanceService';

interface Props {
  employees: HrEmployee[];
}

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const MonthlySheet: React.FC<Props> = ({ employees }) => {
  const [sheets, setSheets] = useState<AttMonthlySheet[]>([]);
  const { workspace } = useWorkspace();
  const wsSheets = sheets.filter(s => matchesWorkspace((s as any).entity, workspace)); // tách sổ
  const [selectedSheet, setSelectedSheet] = useState<AttMonthlySheet | null>(null);
  const [records, setRecords] = useState<AttMonthlyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [endDates, setEndDates] = useState<Record<string, string>>({});

  useEffect(() => { svc.fetchEmployeeEndDates().then(setEndDates).catch(() => {}); }, []);

  // ── Load sheets ──
  const loadSheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await svc.fetchMonthlySheets();
      setSheets(data);
      if (data.length > 0 && !selectedSheet) setSelectedSheet(data[0]);
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  // ── Load records when sheet changes ──
  useEffect(() => {
    if (!selectedSheet) { setRecords([]); return; }
    const load = async () => {
      try {
        const data = await svc.fetchMonthlyRecords(selectedSheet.id);
        setRecords(data);
      } catch (e: any) {
        setToast({ message: e.message, type: 'error' });
      }
    };
    load();
  }, [selectedSheet?.id]);

  // ── Create new sheet ──
  const handleCreate = async () => {
    try {
      const existing = wsSheets.find(s => s.month === createMonth && s.year === createYear);
      if (existing) {
        setToast({ message: `Bảng chấm công Tháng ${createMonth}/${createYear} đã tồn tại!`, type: 'error' });
        return;
      }
      const { sheet, records: recs } = await svc.createMonthlySheet(createMonth, createYear, employees);
      setSheets(prev => [sheet, ...prev]);
      setSelectedSheet(sheet);
      setRecords(recs);
      setShowCreate(false);
      setToast({ message: `Đã tạo ${sheet.title}`, type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Update a record field inline ──
  const handleUpdateField = async (recordId: string, field: string, value: number | string) => {
    try {
      await svc.updateMonthlyRecord(recordId, { [field]: value });
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, [field]: value } : r));
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Tính work_days từ chấm công hằng ngày ──
  const handleSync = async () => {
    if (!selectedSheet) return;
    if (!window.confirm('Tính lại sẽ GHI ĐÈ cột Ngày công (và OT cuối tuần của ngày có lịch OT) kể cả số đã sửa tay. Tiếp tục?')) return;
    setIsSyncing(true);
    try {
      const { updated, missing_checkout, holiday_days, ot_weekend_updated } = await svc.syncMonthWorkDays(selectedSheet.id);
      setRecords(await svc.fetchMonthlyRecords(selectedSheet.id));
      setToast({
        message: `Đã tính ${updated} nhân viên từ dữ liệu chấm công`
          + (holiday_days > 0 ? ` · +${holiday_days} công lễ cho NV chính thức (thử việc không cộng)` : '')
          + (ot_weekend_updated > 0 ? ` · ${ot_weekend_updated} NV có giờ OT cuối tuần theo lịch OT` : '')
          + (missing_checkout > 0 ? ` · ⚠️ ${missing_checkout} ngày thiếu giờ ra, phải sửa tay` : ''),
        type: 'success',
      });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Finalize / reopen sheet ──
  const handleToggleStatus = async () => {
    if (!selectedSheet) return;
    const newStatus = selectedSheet.status === 'draft' ? 'finalized' : 'draft';
    try {
      await svc.updateMonthlySheet(selectedSheet.id, { status: newStatus });
      const updated = { ...selectedSheet, status: newStatus as 'draft' | 'finalized' };
      setSelectedSheet(updated);
      setSheets(prev => prev.map(s => s.id === updated.id ? updated : s));
      setToast({ message: newStatus === 'finalized' ? 'Đã chốt bảng công' : 'Đã mở lại bảng công', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Delete sheet ──
  const handleDelete = async () => {
    if (!selectedSheet) return;
    try {
      await svc.deleteMonthlySheet(selectedSheet.id);
      setSheets(prev => prev.filter(s => s.id !== selectedSheet.id));
      setSelectedSheet(null);
      setRecords([]);
      setToast({ message: 'Đã xóa bảng công', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // OT tách theo loại ngày + ca ngày/đêm để payroll áp đúng hệ số.
  // Ngày 150/200/300% (BLLĐ 2019 Đ.98) · Đêm 200/270/390% (NĐ 145/2020 Đ.57)
  const OT_FIELDS = [
    { key: 'ot_hours', cls: 'text-purple-400' },
    { key: 'ot_hours_weekend', cls: 'text-purple-300' },
    { key: 'ot_hours_holiday', cls: 'text-pink-400' },
    { key: 'ot_hours_night', cls: 'text-indigo-400' },
    { key: 'ot_hours_night_weekend', cls: 'text-indigo-300' },
    { key: 'ot_hours_night_holiday', cls: 'text-sky-400' },
  ] as const;

  const cardCls = 'rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl';
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm text-center focus:border-orange-400/50 outline-none transition-colors';

  // Nhân viên nghỉ việc / tích "không tính lương" thì bỏ khỏi bảng. Bộ lọc ở
  // useAttendanceState chỉ chạy lúc TẠO bảng — ai đổi trạng thái sau đó vẫn còn dòng trong DB.
  const isDropped = (r: AttMonthlyRecord) =>
    !!r.employee && (r.employee.status !== 'active' || (r.employee as any).exclude_from_payroll === true);

  // Nghỉ TRONG tháng của bảng này thì vẫn phải hiện — họ còn lương tháng cuối.
  // Chỉ ẩn từ tháng SAU ngày nghỉ trở đi.
  const monthStart = selectedSheet
    ? `${selectedSheet.year}-${String(selectedSheet.month).padStart(2, '0')}-01` : '';
  const leftBeforeThisMonth = (r: AttMonthlyRecord) => {
    const end = endDates[r.employee_id];
    // Không có ngày nghỉ (bị sửa tay ô Trạng thái, không qua đơn) ⇒ không dám khẳng định
    // nghỉ từ bao giờ. Lùi về quy tắc phòng thủ: chỉ ẩn khi dòng còn trắng.
    if (!end) return !(r.work_days || 0) && !(r.late_count || 0) && !(r.absent_days || 0)
      && !OT_FIELDS.some(f => (r as any)[f.key] || 0);
    return end < monthStart;
  };

  const isHidden = (r: AttMonthlyRecord) => isDropped(r) && leftBeforeThisMonth(r);
  const hiddenCount = records.filter(isHidden).length;
  const visibleRecords = showHidden ? records : records.filter(r => !isHidden(r));

  const totalWorkDays = records.reduce((s, r) => s + (r.work_days || 0), 0);
  const totalOT = records.reduce((s, r) => s + OT_FIELDS.reduce((a, f) => a + ((r as any)[f.key] || 0), 0), 0);
  const totalAbsent = records.reduce((s, r) => s + (r.absent_days || 0), 0);
  const isLocked = selectedSheet?.status === 'finalized';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-fadeIn ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent uppercase tracking-tight">
            📋 Bảng chấm công
          </h1>
          <p className="text-neutral-medium text-sm mt-1">Tạo và quản lý bảng chấm công theo tháng</p>
        </div>
        <div className="flex gap-3">
          {/* Sheet selector */}
          {wsSheets.length > 0 && (
            <select
              value={selectedSheet?.id || ''}
              onChange={e => { const s = sheets.find(s => s.id === e.target.value); if (s) setSelectedSheet(s); }}
              className="px-4 py-2 rounded-xl bg-surface border border-primary/10 text-white text-sm"
            >
              {wsSheets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.status === 'finalized' ? '✅' : '📝'}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => setShowCreate(!showCreate)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-black text-sm uppercase tracking-wide hover:scale-105 transition-all">
            + Tạo bảng công
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={cardCls}>
          <h3 className="text-lg font-black text-white uppercase mb-4">➕ Tạo bảng chấm công mới</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Tháng</label>
              <select value={createMonth} onChange={e => setCreateMonth(+e.target.value)}
                className="px-4 py-3 rounded-xl bg-black/30 border border-primary/10 text-white text-sm w-40">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Năm</label>
              <input type="number" value={createYear} onChange={e => setCreateYear(+e.target.value)}
                className="px-4 py-3 rounded-xl bg-black/30 border border-primary/10 text-white text-sm w-32" />
            </div>
            <div className="text-sm text-neutral-medium">
              <span className="text-orange-400 font-bold">{employees.length}</span> nhân viên (fulltime + parttime)
            </div>
            <button onClick={handleCreate}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black text-sm uppercase tracking-wide hover:scale-105 transition-all">
              ✅ Tạo
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-3 rounded-xl bg-white/[0.05] text-neutral-medium font-bold text-sm">Hủy</button>
          </div>
        </div>
      )}

      {/* No sheets */}
      {!isLoading && wsSheets.length === 0 && !showCreate && (
        <div className="text-center py-20 opacity-40">
          <div className="text-6xl mb-4">📋</div>
          <div className="text-xl font-bold">Chưa có bảng chấm công nào</div>
          <div className="text-sm mt-2">Nhấn "Tạo bảng công" để bắt đầu</div>
        </div>
      )}

      {/* Sheet content */}
      {selectedSheet && (
        <>
          {/* Sheet info bar */}
          <div className={cardCls + ' flex flex-col md:flex-row md:items-center justify-between gap-4'}>
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-white">{selectedSheet.title}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isLocked ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {isLocked ? '✅ Đã chốt' : '📝 Nháp'}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSync} disabled={isLocked || isSyncing}
                title="Tính lại cột Ngày công từ dữ liệu check-in/check-out trong tháng. Ghi đè số đang có, sửa tay lại được."
                className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xs hover:bg-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {isSyncing ? '⏳ Đang tính...' : '🔄 Tính từ chấm công'}
              </button>
              <button onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${isLocked ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                {isLocked ? '🔓 Mở lại' : '🔒 Chốt bảng'}
              </button>
              {confirmDelete ? (
                <>
                  <button onClick={() => { handleDelete(); setConfirmDelete(false); }} className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all">
                    Xác nhận xóa
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-xl bg-white/10 text-neutral-medium font-bold text-xs hover:bg-white/20 transition-all">
                    Hủy
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold text-xs hover:bg-red-500/30 transition-all">
                  🗑️ Xóa
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Nhân viên', value: visibleRecords.length, icon: '👥', color: '#0A84FF' },
              { label: 'Tổng ngày công', value: totalWorkDays.toFixed(2), icon: '📅', color: '#34C759' },
              { label: 'Tổng OT (h)', value: totalOT.toFixed(1), icon: '💪', color: '#AF52DE' },
              { label: 'Tổng nghỉ', value: totalAbsent.toFixed(2), icon: '🏖️', color: '#FF9500' },
            ].map(s => (
              <div key={s.label} className={cardCls + ' text-center'}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-neutral-medium uppercase tracking-wide font-bold mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Records table */}
          <div className={cardCls}>
            {hiddenCount > 0 && (
              <div className="flex items-center justify-between mb-4 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-xs text-neutral-medium">
                  Đã ẩn <span className="text-orange-400 font-bold">{hiddenCount}</span> nhân viên
                  nghỉ việc / không tính lương (dòng chưa có số liệu)
                </span>
                <button onClick={() => setShowHidden(v => !v)}
                  className="px-3 py-1 rounded-lg bg-white/[0.05] text-neutral-medium font-bold text-xs hover:bg-white/10 transition-all">
                  {showHidden ? 'Ẩn lại' : 'Hiện'}
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-neutral-medium text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-3 w-8">#</th>
                    <th className="text-left py-3 px-3">Mã NV</th>
                    <th className="text-left py-3 px-3">Họ tên</th>
                    <th className="text-center py-3 px-3 w-32 bg-green-500/5">Ngày công</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày thường T2-T6 — 150%">OT thường</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày nghỉ hằng tuần T7/CN — 200%">OT T7/CN</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày lễ/Tết — 300%">OT lễ/Tết</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm 22h-6h ngày thường — 200%">OT đêm</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm T7/CN — 270%">OT đêm T7/CN</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm lễ/Tết — 390%">OT đêm lễ/Tết</th>
                    <th className="text-center py-3 px-3 w-24 bg-orange-500/5">Đi muộn</th>
                    <th className="text-center py-3 px-3 w-28 bg-red-500/5">Ngày nghỉ</th>
                    <th className="text-left py-3 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((r, idx) => (
                    <tr key={r.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] group ${isDropped(r) ? 'opacity-50' : ''}`}
                      title={isDropped(r) ? 'Nhân viên đã nghỉ việc hoặc không tính lương' : undefined}>
                      <td className="py-2 px-3 text-neutral-medium text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 text-neutral-medium text-xs font-mono">{r.employee?.employee_code || '—'}</td>
                      <td className="py-2 px-3 text-white font-semibold">{r.employee?.full_name || '—'}</td>
                      <td className="py-2 px-3 bg-green-500/[0.02]">
                        <input
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          value={r.work_days || ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, work_days: v } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'work_days', parseFloat(e.target.value) || 0)}
                          className={inputCls + ' font-bold text-green-400 disabled:opacity-50'}
                          placeholder="0.00"
                        />
                      </td>
                      {OT_FIELDS.map(f => (
                        <td key={f.key} className="py-2 px-3 bg-purple-500/[0.02]">
                          <input
                            type="number"
                            step="0.5"
                            disabled={isLocked}
                            value={(r as any)[f.key] || ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              setRecords(prev => prev.map(x => x.id === r.id ? { ...x, [f.key]: v } : x));
                            }}
                            onBlur={e => handleUpdateField(r.id, f.key, parseFloat(e.target.value) || 0)}
                            className={inputCls + ` ${f.cls} disabled:opacity-50`}
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 bg-orange-500/[0.02]">
                        <input
                          type="number"
                          step="1"
                          disabled={isLocked}
                          value={r.late_count || ''}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 0;
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, late_count: v } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'late_count', parseInt(e.target.value) || 0)}
                          className={inputCls + ' text-orange-400 disabled:opacity-50'}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-3 bg-red-500/[0.02]">
                        <input
                          type="number"
                          step="0.5"
                          disabled={isLocked}
                          value={r.absent_days || ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, absent_days: v } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'absent_days', parseFloat(e.target.value) || 0)}
                          className={inputCls + ' text-red-400 disabled:opacity-50'}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={r.note || ''}
                          onChange={e => {
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, note: e.target.value } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'note', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-neutral-medium text-sm focus:border-orange-400/50 outline-none transition-colors disabled:opacity-50"
                          placeholder="Ghi chú..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/[0.1] font-black text-white">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase text-xs tracking-wider text-neutral-medium">TỔNG CỘNG</td>
                    <td className="py-3 px-3 text-center text-green-400 text-lg">{totalWorkDays.toFixed(2)}</td>
                    <td colSpan={OT_FIELDS.length} className="py-3 px-3 text-center text-purple-400 text-lg">{totalOT.toFixed(1)}</td>
                    <td className="py-3 px-3 text-center text-orange-400 text-lg">{records.reduce((s, r) => s + (r.late_count || 0), 0)}</td>
                    <td className="py-3 px-3 text-center text-red-400 text-lg">{totalAbsent.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlySheet;
