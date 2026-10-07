import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import React, { useState, useEffect, useCallback } from 'react';
import { HrEmployee, AttMonthlySheet, AttMonthlyRecord } from '@/types';
import * as svc from '../services/attendanceService';

interface Props {
  employees: HrEmployee[];
}

// Ô nhập type="number" hiển thị theo locale trình duyệt (vi-VN → "2,5"), nên số tổng cũng phải
// format vi-VN — toFixed() ra "17.5" lệch dấu thập phân với các dòng chi tiết.
const fmtNum = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

const MonthlySheet: React.FC<Props> = ({ employees }) => {
  const [sheets, setSheets] = useState<AttMonthlySheet[]>([]);
  const { workspace } = useWorkspace();
  const wsSheets = sheets.filter(s => matchesWorkspace((s as any).entity, workspace)); // tách sổ
  const [selectedSheet, setSelectedSheet] = useState<AttMonthlySheet | null>(null);
  const [records, setRecords] = useState<AttMonthlyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  // Bảng "cần xử lý" = đã hết tháng (gửi xác nhận được) mà chưa chốt. Sang T10 mà T9 chưa chốt
  // thì T9 phải là thứ kế toán thấy đầu tiên, không phải bảng T10 đang chạy.
  const todayVN = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()) + 'T00:00:00');
  const needsAction = (s: AttMonthlySheet) => s.status !== 'finalized' && todayVN >= new Date(s.year, s.month, 0);
  const actionSheets = wsSheets.filter(needsAction); // mới → cũ (theo thứ tự fetch)

  // selectedSheet = null ⇒ màn danh sách. Đổi sổ mà bảng đang mở không thuộc sổ mới ⇒ về danh sách.
  useEffect(() => {
    if (selectedSheet && !wsSheets.some(s => s.id === selectedSheet.id)) setSelectedSheet(null);
  }, [sheets, workspace]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Update a record field inline ──
  const handleUpdateField = async (recordId: string, field: string, value: number | string) => {
    // Ngày công sửa tay: làm tròn 1 số + đánh dấu để cron đồng bộ ban đêm không ghi đè.
    const patch: Record<string, number | string | boolean> = field === 'work_days'
      ? { work_days: Math.round(Number(value) * 10) / 10, work_days_manual: true }
      : { [field]: value };
    try {
      await svc.updateMonthlyRecord(recordId, patch);
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...patch } : r));
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
      await svc.clearManualWorkDays(selectedSheet.id);
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

  // ── Gửi NV xác nhận ──
  const handleRequestConfirm = async () => {
    if (!selectedSheet) return;
    if (!window.confirm('Gửi thông báo cho từng nhân viên vào Portal kiểm tra và xác nhận bảng công? Gửi lại sẽ xoá các xác nhận cũ.')) return;
    try {
      const n = await svc.requestSheetConfirm(selectedSheet.id);
      const updated = { ...selectedSheet, review_sent_at: new Date().toISOString() };
      setSelectedSheet(updated);
      setSheets(prev => prev.map(s => s.id === updated.id ? updated : s));
      setRecords(await svc.fetchMonthlyRecords(selectedSheet.id));
      setToast({ message: `Đã gửi yêu cầu xác nhận tới ${n} nhân viên`, type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Finalize / reopen sheet ──
  const handleToggleStatus = async () => {
    if (!selectedSheet) return;
    const newStatus = selectedSheet.status === 'draft' ? 'finalized' : 'draft';
    // Giống bảng lương: phải gửi NV xác nhận và đủ xác nhận mới chốt được — không còn "Vẫn chốt".
    if (newStatus === 'finalized' && !canFinalize) {
      setToast({
        message: !reviewSent
          ? 'Chưa gửi NV xác nhận — gửi trước rồi mới chốt được bảng công.'
          : `Còn ${pendingConfirm.length} nhân viên chưa xác nhận: ${pendingConfirm.map(r => r.employee?.full_name).join(', ')}`,
        type: 'error',
      });
      return;
    }
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
  // Gửi NV xác nhận chỉ từ ngày cuối tháng — giữa tháng số liệu dở dang, NV thấy sẽ khó hiểu. DB cũng chặn.
  const lastDayOfSheet = selectedSheet ? new Date(selectedSheet.year, selectedSheet.month, 0) : null;
  const monthEnded = !!lastDayOfSheet && new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()) + 'T00:00:00') >= lastDayOfSheet;

  // NV bắt buộc xác nhận = đang làm, có tài khoản Portal (mới nhận được thông báo), không bị loại khỏi lương.
  const mustConfirm = records.filter(r => {
    const e = r.employee as any;
    return !!e && e.status === 'active' && !!e.auth_user_id && !e.exclude_from_payroll;
  });
  const pendingConfirm = mustConfirm.filter(r => !r.confirmed_at);
  const reviewSent = !!selectedSheet?.review_sent_at;
  const canFinalize = reviewSent && pendingConfirm.length === 0;
  // Bước tiếp theo kế toán phải làm — nút tương ứng được làm nổi bật.
  const nextStep: 'wait' | 'send' | 'collect' | 'finalize' | 'done' =
    isLocked ? 'done' : !monthEnded ? 'wait' : !reviewSent ? 'send' : pendingConfirm.length > 0 ? 'collect' : 'finalize';
  const btnPrimary = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-primary hover:opacity-90 transition-all shadow-[0_0_20px_rgba(255,149,0,0.45)] animate-pulse motion-reduce:animate-none';
  const btnSecondary = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:bg-white/5 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed';

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
      {selectedSheet ? (
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedSheet(null); setConfirmDelete(false); loadSheets(); }}
            aria-label="Về danh sách bảng công"
            className="w-10 h-10 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 transition-all">
            ←
          </button>
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Bảng chấm công / {selectedSheet.title}</p>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            Bảng chấm công
          </h1>
          <p className="text-sm text-neutral-medium mt-1">Tự tạo và cập nhật mỗi đêm từ dữ liệu chấm công</p>
        </div>
      )}

      {/* ── Màn danh sách ── */}
      {!selectedSheet && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tổng bảng công', value: wsSheets.length, color: '#FFFFFF' },
              { label: 'Cần chốt', value: actionSheets.length, color: '#FF9500' },
              { label: 'Đã chốt', value: wsSheets.filter(s => s.status === 'finalized').length, color: '#34C759' },
            ].map(k => (
              <div key={k.label} className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{k.label}</p>
                <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {isLoading && wsSheets.length === 0 ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : wsSheets.length === 0 ? (
            <div className="rounded-[20px] border border-primary/10 bg-surface text-center py-16">
              <p className="text-sm font-semibold text-white">Chưa có bảng chấm công nào</p>
              <p className="text-xs text-neutral-medium mt-1">Bảng công tháng hiện tại được hệ thống tự tạo lúc 23:30 mỗi đêm.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(new Set(wsSheets.map(s => s.year))).sort((a, b) => b - a).map(year => (
                <section key={year} className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Năm {year}</p>
                  {wsSheets.filter(s => s.year === year).map(s => {
                    const mm = String(s.month).padStart(2, '0');

                    // ── Đã chốt: chìm xuống ──
                    if (s.status === 'finalized') {
                      return (
                        <div key={s.id} onClick={() => setSelectedSheet(s)}
                          className="flex items-center gap-5 px-5 py-4 rounded-[20px] border border-white/5 bg-surface/40 opacity-60 hover:opacity-100 hover:border-primary/20 transition-all cursor-pointer group">
                          <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 bg-white/5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600 leading-none">Th</span>
                            <span className="text-lg font-black text-neutral-400 group-hover:text-primary leading-tight transition-colors">{mm}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-300 truncate">{s.title}</p>
                            <p className="text-xs text-neutral-600 mt-0.5">Kỳ công {s.month}/{s.year}</p>
                          </div>
                          <span className="text-xs font-black uppercase tracking-wider text-green-400">✓ Đã chốt</span>
                          <span className="text-xl text-neutral-600 group-hover:text-primary transition-colors">→</span>
                        </div>
                      );
                    }

                    // ── Chưa chốt: viền sáng chạy quanh. Cam = hết tháng, cần xử lý; xanh = tháng đang chạy ──
                    const urgent = needsAction(s);
                    const color = urgent ? '#FF9500' : '#0A84FF';
                    const lastDay = new Date(s.year, s.month, 0).getDate();
                    return (
                      <div key={s.id} onClick={() => setSelectedSheet(s)}
                        className="relative p-[1.5px] rounded-[20px] overflow-hidden cursor-pointer group">
                        <div className="absolute left-1/2 top-1/2 w-[200%] aspect-square -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="w-full h-full animate-spin motion-reduce:animate-none"
                            style={{
                              animationDuration: urgent ? '4s' : '8s',
                              background: `conic-gradient(from 0deg, transparent 0deg, transparent 280deg, ${color} 340deg, transparent 360deg)`,
                            }} />
                        </div>
                        <div className="absolute inset-0 rounded-[20px] border border-primary/20 pointer-events-none" />
                        <div className="relative flex items-center gap-5 p-5 rounded-[19px] bg-[#161616] group-hover:bg-[#1c1c1c] transition-colors">
                          <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
                            style={{ background: `${color}26`, boxShadow: `0 0 24px ${color}26` }}>
                            <span className="text-[9px] font-black uppercase tracking-widest leading-none" style={{ color, opacity: 0.7 }}>Th</span>
                            <span className="text-2xl font-black leading-tight" style={{ color }}>{mm}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-black text-white truncate">{s.title}</p>
                            <p className="text-xs text-neutral-medium mt-0.5">Kỳ công {s.month}/{s.year}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider" style={{ color }}>
                              <span className="relative flex w-2 h-2">
                                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping motion-reduce:animate-none" style={{ background: color }} />
                                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
                              </span>
                              {urgent ? 'Cần chốt' : 'Đang chấm công'}
                            </span>
                            <span className="text-[11px] font-semibold text-neutral-400">
                              {!urgent
                                ? `Tự cập nhật mỗi đêm · gửi xác nhận từ ${lastDay}/${s.month}`
                                : s.review_sent_at ? 'Đã gửi NV xác nhận · chờ đủ xác nhận để chốt' : 'Chưa gửi NV xác nhận'}
                            </span>
                          </div>
                          <span className="text-xl" style={{ color }}>→</span>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
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
              {!isLocked && (
                <button onClick={handleRequestConfirm} disabled={!monthEnded}
                  title={!monthEnded && lastDayOfSheet
                    ? `Tháng chưa kết thúc — gửi được từ ${lastDayOfSheet.getDate()}/${selectedSheet.month}. Bảng đang tự cập nhật mỗi đêm.`
                    : reviewSent ? 'Gửi lại sẽ xoá các xác nhận cũ — chỉ dùng khi đã sửa số liệu' : 'Thông báo từng NV vào Portal kiểm tra và xác nhận bảng công'}
                  className={nextStep === 'send' ? btnPrimary : btnSecondary}>
                  📣 {reviewSent ? 'Gửi lại NV xác nhận' : 'Gửi NV xác nhận'}
                </button>
              )}
              <button onClick={handleToggleStatus}
                disabled={!isLocked && !canFinalize}
                title={!isLocked && !canFinalize
                  ? (!reviewSent ? 'Phải gửi NV xác nhận trước' : `Còn ${pendingConfirm.length} NV chưa xác nhận`)
                  : undefined}
                className={nextStep === 'finalize' ? btnPrimary : btnSecondary}>
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

          {/* Bước tiếp theo — cho kế toán biết phải làm gì */}
          {(() => {
            const confirmed = mustConfirm.length - pendingConfirm.length;
            const steps = [
              { key: 'run', label: 'Tự cập nhật trong tháng' },
              { key: 'send', label: 'Gửi NV xác nhận' },
              { key: 'collect', label: `NV xác nhận${reviewSent ? ` (${confirmed}/${mustConfirm.length})` : ''}` },
              { key: 'finalize', label: 'Chốt bảng' },
            ];
            const current = { wait: 0, send: 1, collect: 2, finalize: 3, done: 4 }[nextStep];
            const hint = {
              wait: `Tháng chưa kết thúc — bảng tự cập nhật mỗi đêm. Từ ngày ${lastDayOfSheet?.getDate()}/${selectedSheet.month} gửi được NV xác nhận.`,
              send: 'Việc tiếp theo: bấm "Gửi NV xác nhận" để nhân viên kiểm tra bảng công trên Portal.',
              collect: `Đang chờ ${pendingConfirm.length} NV xác nhận: ${pendingConfirm.map(r => r.employee?.full_name).join(', ')}.`,
              finalize: 'Tất cả nhân viên đã xác nhận — bấm "Chốt bảng" để chuyển sang tính lương.',
              done: 'Bảng công đã chốt — Payroll dùng được số liệu này.',
            }[nextStep];
            return (
              <div className="rounded-[20px] border p-5"
                style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  {steps.map((s, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                      <React.Fragment key={s.key}>
                        {i > 0 && <span className={`h-px w-6 ${done || active ? 'bg-primary/60' : 'bg-white/10'}`} />}
                        <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          active ? 'bg-primary text-black' : done ? 'bg-primary/15 text-primary' : 'bg-white/5 text-neutral-600'}`}>
                          <span>{done ? '✓' : i + 1}</span>{s.label}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <p className={`text-sm mt-3 ${nextStep === 'done' ? 'text-green-400' : 'text-neutral-300'}`}>{hint}</p>
              </div>
            );
          })()}

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Nhân viên', value: visibleRecords.length, icon: '👥', color: '#0A84FF' },
              { label: 'Tổng ngày công', value: fmtNum(totalWorkDays), icon: '📅', color: '#34C759' },
              { label: 'Tổng OT (h)', value: fmtNum(totalOT), icon: '💪', color: '#AF52DE' },
              { label: 'Tổng nghỉ', value: fmtNum(totalAbsent), icon: '🏖️', color: '#FF9500' },
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
                    <th className="text-left py-3 px-3 whitespace-nowrap">Họ tên</th>
                    <th className="text-center py-3 px-3 w-32 bg-green-500/5">Ngày công</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày thường T2-T6 — 150%">OT thường</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày nghỉ hằng tuần T7/CN — 200%">OT T7/CN</th>
                    <th className="text-center py-3 px-3 w-24 bg-purple-500/5" title="Tăng ca ngày lễ/Tết — 300%">OT lễ/Tết</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm 22h-6h ngày thường — 200%">OT đêm</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm T7/CN — 270%">OT đêm T7/CN</th>
                    <th className="text-center py-3 px-3 w-24 bg-indigo-500/5" title="Tăng ca ban đêm lễ/Tết — 390%">OT đêm lễ/Tết</th>
                    <th className="text-center py-3 px-3 w-24 bg-orange-500/5">Đi muộn</th>
                    <th className="text-center py-3 px-3 w-24 bg-orange-500/5" title="Số ngày về sớm hơn giờ ca quá ngưỡng. Chỉ theo dõi, không trừ lương.">Về sớm</th>
                    <th className="text-center py-3 px-3 w-28 bg-red-500/5">Ngày nghỉ</th>
                    <th className="text-left py-3 px-3">Ghi chú</th>
                    <th className="text-center py-3 px-3 w-28" title="NV bấm xác nhận ở Portal sau khi HR gửi yêu cầu">Xác nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((r, idx) => (
                    <tr key={r.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] group ${isDropped(r) ? 'opacity-50' : ''}`}
                      title={isDropped(r) ? 'Nhân viên đã nghỉ việc hoặc không tính lương' : undefined}>
                      <td className="py-2 px-3 text-neutral-medium text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 text-neutral-medium text-xs font-mono">{r.employee?.employee_code || '—'}</td>
                      <td className="py-2 px-3 text-white font-semibold whitespace-nowrap">{r.employee?.full_name || '—'}</td>
                      <td className="py-2 px-3 bg-green-500/[0.02]">
                        <input
                          type="number"
                          step="0.1"
                          disabled={isLocked}
                          title={r.work_days_manual ? 'Đã sửa tay — đồng bộ tự động ban đêm không ghi đè. Bấm "Tính lại" để tính lại từ chấm công.' : undefined}
                          value={r.work_days || ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, work_days: v } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'work_days', parseFloat(e.target.value) || 0)}
                          className={inputCls + ' font-bold text-green-400 disabled:opacity-50' + (r.work_days_manual ? ' border-primary/40' : '')}
                          placeholder="0.0"
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
                      <td className="py-2 px-3 bg-orange-500/[0.02]">
                        <input
                          type="number"
                          step="1"
                          disabled={isLocked}
                          value={r.early_count || ''}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 0;
                            setRecords(prev => prev.map(x => x.id === r.id ? { ...x, early_count: v } : x));
                          }}
                          onBlur={e => handleUpdateField(r.id, 'early_count', parseInt(e.target.value) || 0)}
                          className={inputCls + ' text-orange-300 disabled:opacity-50'}
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
                      <td className="py-2 px-3 text-center text-xs font-bold">
                        {r.confirmed_at
                          ? <span className="text-green-400" title={new Date(r.confirmed_at).toLocaleString('vi-VN')}>✅ Đã xác nhận</span>
                          : selectedSheet.review_sent_at ? <span className="text-yellow-400">⏳ Chờ</span> : <span className="text-neutral-600">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/[0.1] font-black text-white">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase text-xs tracking-wider text-neutral-medium">TỔNG CỘNG</td>
                    <td className="py-3 px-3 text-center text-green-400 text-lg">{fmtNum(totalWorkDays)}</td>
                    <td colSpan={OT_FIELDS.length} className="py-3 px-3 text-center text-purple-400 text-lg">{fmtNum(totalOT)}</td>
                    <td className="py-3 px-3 text-center text-orange-400 text-lg">{records.reduce((s, r) => s + (r.late_count || 0), 0)}</td>
                    <td className="py-3 px-3 text-center text-orange-300 text-lg">{records.reduce((s, r) => s + (r.early_count || 0), 0)}</td>
                    <td className="py-3 px-3 text-center text-red-400 text-lg">{fmtNum(totalAbsent)}</td>
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
