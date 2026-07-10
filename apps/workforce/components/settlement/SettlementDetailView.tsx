import React, { useState, useEffect } from 'react';
import { Worker, WorkforceTask, Settlement } from '@/types';
import * as svc from '../../services/workforceService';
import { BackButton } from '../shared/BackButton';
import { CompanySelector, CompanyId } from '../shared/CompanySelector';
import { StatusBadge } from '../shared/StatusBadge';
import { SignedScanButton } from '../shared/SignedScanButton';
import { exportSettlementPdf } from './settlementPdfExport';

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";

const STATUS_LABELS: Record<string, string> = { draft: 'Bản nháp', sent: 'Đã gửi', accepted: 'Đã chấp nhận', paid: 'Đã thanh toán' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-dark/30 text-neutral-medium border-neutral-dark/50',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const STATUS_FLOW: Record<string, string> = { draft: 'sent', sent: 'accepted', accepted: 'paid' };
const STATUS_NEXT_LABEL: Record<string, string> = { draft: '📤 Gửi nghiệm thu', sent: '✅ Chấp nhận', accepted: '💰 Đã thanh toán' };

const fmt = (n: number) => n.toLocaleString();

interface SettlementDetailViewProps {
  settlement: Settlement;
  workers: Worker[];
  allTasks?: WorkforceTask[];
  vcbSellRate: number;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Settlement>) => void;
  onDelete: (id: string) => void;
  onRequestConfirm: (message: string, onConfirm: () => void, subMessage?: string) => void;
}

const SettlementDetailView: React.FC<SettlementDetailViewProps> = ({
  settlement: initialSettlement, workers, allTasks = [], vcbSellRate,
  onBack, onUpdate, onDelete, onRequestConfirm,
}) => {
  const [s, setS] = useState(initialSettlement);
  const [detailTasks, setDetailTasks] = useState<WorkforceTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selCompany, setSelCompany] = useState<CompanyId>('tdgames');

  // Edit mode
  const canEdit = s.status === 'draft' || s.status === 'sent';
  const [editing, setEditing] = useState(false);
  const [editBonusType, setEditBonusType] = useState(s.bonus_type || 'amount');
  const [editBonusValue, setEditBonusValue] = useState(s.bonus_value || 0);
  const [editTaxRate, setEditTaxRate] = useState(s.tax_rate ?? 10);
  const [editNotes, setEditNotes] = useState(s.notes || '');
  const [editTaskIds, setEditTaskIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingTasks(true);
    svc.fetchSettlementTasks(s.id!).then(setDetailTasks).catch(() => setDetailTasks([])).finally(() => setLoadingTasks(false));
  }, [s.id]);

  // Init edit task IDs when tasks load
  useEffect(() => {
    if (detailTasks.length > 0 && editTaskIds.length === 0) {
      setEditTaskIds(detailTasks.map(t => t.id!));
    }
  }, [detailTasks]);

  // Available tasks for this worker (unpaid + currently in this settlement)
  const availableTasks = allTasks.filter(t => {
    if (t.worker_id !== s.worker_id) return false;
    if (editTaskIds.includes(t.id!)) return true;
    if (t.payment_status === 'paid') return false;
    return true;
  });

  const editSelectedTasks = availableTasks.filter(t => editTaskIds.includes(t.id!));
  const editTotal = editSelectedTasks.reduce((sum, t) => sum + (t.price || 0) + (t.bonus || 0), 0);
  const editPreview = svc.computeSettlementTotals(editTotal, editBonusType, editBonusValue, editTaxRate);

  // Dominant currency from selected priced tasks
  const editCurrency = (() => {
    const priced = editSelectedTasks.filter(t => (t.price || 0) > 0);
    if (priced.length === 0) return s.currency || 'VND';
    const counts: Record<string, number> = {};
    priced.forEach(t => { counts[t.currency] = (counts[t.currency] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const handleSaveEdit = async () => {
    if (editTaskIds.length === 0) return;
    setSaving(true);
    try {
      const accountType = editTaxRate === 0 ? 'personal' : 'company';
      await svc.updateSettlementTasks(
        s.id!, editTaskIds, editTotal, editCurrency,
        editBonusType, editBonusValue, editTaxRate, editNotes, accountType
      );
      // Refresh
      const updatedTasks = await svc.fetchSettlementTasks(s.id!);
      setDetailTasks(updatedTasks);
      const updatedFields: Partial<Settlement> = {
        total_tasks: editTaskIds.length,
        total_amount: editTotal,
        currency: editCurrency,
        bonus_type: editBonusType,
        bonus_value: editBonusValue,
        bonus_amount: editPreview.bonusAmount,
        tax_rate: editTaxRate,
        tax_amount: editPreview.taxAmount,
        net_amount: editPreview.netAmount,
        notes: editNotes,
        account_type: editTaxRate === 0 ? 'personal' : 'company',
      };
      setS(prev => ({ ...prev, ...updatedFields }));
      // Đồng bộ lại mảng settlements ở component cha — nếu không, quay lại danh sách
      // rồi mở lại settlement này sẽ nhận prop cũ (chưa có thay đổi) và trông như mất data.
      onUpdate(s.id!, updatedFields);
      setEditing(false);
    } catch (e: any) {
      alert(e.message || 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  };

  const workerObj = s.worker || workers.find(w => w.id === s.worker_id);
  const workerName = workerObj?.full_name || '???';
  const nextStatus = STATUS_FLOW[s.status];
  const totalPrice = detailTasks.reduce((sum, t) => sum + (t.price || 0), 0);
  const totalBonus = detailTasks.reduce((sum, t) => sum + (t.bonus || 0), 0);
  const totalVND = detailTasks.reduce((sum, t) => {
    if (t.currency === 'USD') {
      const rate = t.payment_status === 'paid' && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate;
      return rate > 0 ? sum + t.price * rate : sum;
    }
    if (t.currency === 'VND') return sum + t.price;
    return sum;
  }, 0);

  const handleStatusAdvance = () => {
    if (!nextStatus) return;
    if (nextStatus === 'paid') {
      onRequestConfirm('Xác nhận đã thanh toán?', () => {
        onUpdate(s.id!, { status: nextStatus as any });
        setS({ ...s, status: nextStatus as any });
      }, 'Tất cả task sẽ được đánh dấu ĐÃ THANH TOÁN.');
      return;
    }
    onUpdate(s.id!, { status: nextStatus as any });
    setS({ ...s, status: nextStatus as any });
  };

  const handleExportPDF = () => exportSettlementPdf(s, detailTasks, workers, vcbSellRate, selCompany);

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <BackButton onClick={onBack} />
        <div className="flex-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Nghiệm Thu</h2>
          <p className="text-neutral-medium text-sm">{workerName}{s.project_name ? ` · ${s.project_name}` : ''} — Kỳ {s.period}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={s.status} labels={STATUS_LABELS} colors={STATUS_COLORS} size="md" />
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
            s.account_type === 'personal'
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
              : 'border-primary/20 text-primary/60 bg-primary/5'
          }`}>
            {s.account_type === 'personal' ? '👤 Cá nhân' : '🏢 Công ty'}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {nextStatus && !editing && (
          <button onClick={handleStatusAdvance}
            className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02]"
          >{STATUS_NEXT_LABEL[s.status]}</button>
        )}
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-all"
          >✏️ Chỉnh sửa</button>
        )}
        {editing && (
          <>
            <button onClick={handleSaveEdit} disabled={saving || editTaskIds.length === 0}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-30"
            >{saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}</button>
            <button onClick={() => { setEditing(false); setEditTaskIds(detailTasks.map(t => t.id!)); setEditBonusType(s.bonus_type); setEditBonusValue(s.bonus_value); setEditTaxRate(s.tax_rate); setEditNotes(s.notes || ''); }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-neutral-dark text-neutral-medium hover:text-white transition-all"
            >✕ Hủy</button>
          </>
        )}
        {!editing && <CompanySelector selected={selCompany} onChange={setSelCompany} />}
        {!editing && <button onClick={handleExportPDF}
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-primary/20 text-primary hover:bg-primary/10 transition-all">
          📄 Export PDF
        </button>}
        {!editing && <SignedScanButton
          signedFileUrl={s.signed_file_url}
          onUploaded={url => { onUpdate(s.id!, { signed_file_url: url }); setS(prev => ({ ...prev, signed_file_url: url })); }}
        />}
        {!editing && <button
          onClick={() => onRequestConfirm('Xóa nghiệm thu này?', () => { onDelete(s.id!); onBack(); }, 'Task sẽ được rollback về CHƯA THANH TOÁN.')}
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all ml-auto"
        >🗑 Xóa</button>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Số task</p>
          <p className="text-2xl font-black text-white">{detailTasks.length}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Tổng giá tasks</p>
          <p className="text-2xl font-black text-primary">{fmt(totalPrice)}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Bonus ({s.bonus_type === 'percent' ? `${s.bonus_value}%` : 'Cố định'})</p>
          <p className="text-2xl font-black text-yellow-400">+{fmt(s.bonus_amount || 0)}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">
            {(s.tax_rate || 0) > 0 ? `Thuế TNCN (${s.tax_rate}%)` : '👤 Cá nhân — Miễn thuế'}
          </p>
          <p className={`text-2xl font-black ${(s.tax_rate || 0) > 0 ? 'text-red-400' : 'text-emerald-400/60'}`}>{(s.tax_rate || 0) > 0 ? `-${fmt(s.tax_amount || 0)}` : '0'}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface border-emerald-500/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">THỰC NHẬN</p>
          <p className="text-2xl font-black text-emerald-400">{fmt(s.net_amount || 0)}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-primary/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Quy đổi VNĐ</p>
          <p className="text-xl font-black text-neutral-medium">{fmt(totalVND)}</p>
        </div>
      </div>

      {/* Edit Panel */}
      {editing && (
        <div className="rounded-[20px] border border-blue-500/20 bg-surface p-6 space-y-5">
          <p className="text-xs font-black uppercase tracking-widest text-blue-400">✏️ Chỉnh sửa nghiệm thu</p>

          {/* Bonus + Tax */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block">Loại Bonus</label>
              <select className={inputCls} value={editBonusType} onChange={e => setEditBonusType(e.target.value as any)}>
                <option value="amount">Số tiền cụ thể</option>
                <option value="percent">Theo %</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block">{editBonusType === 'percent' ? 'Bonus (%)' : 'Bonus (số tiền)'}</label>
              <input type="number" className={inputCls} value={editBonusValue || ''} onChange={e => setEditBonusValue(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block">Thanh toán qua</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditTaxRate(10)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${editTaxRate === 10 ? 'border-primary/40 bg-primary/10 text-primary' : 'border-primary/10 text-neutral-medium hover:border-primary/20'}`}>
                  🏢 Công ty<span className="block text-[9px] mt-0.5 opacity-60">Trừ 10% TNCN</span>
                </button>
                <button type="button" onClick={() => setEditTaxRate(0)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${editTaxRate === 0 ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' : 'border-primary/10 text-neutral-medium hover:border-primary/20'}`}>
                  👤 Cá nhân<span className="block text-[9px] mt-0.5 opacity-60">Không trừ thuế</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block">Ghi chú</label>
            <input className={inputCls} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Ghi chú..." />
          </div>

          {/* Task Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium">
                Chọn task ({editTaskIds.length}/{availableTasks.length})
              </p>
              <button onClick={() => setEditTaskIds(editTaskIds.length === availableTasks.length ? [] : availableTasks.map(t => t.id!))}
                className="text-xs text-primary hover:text-primary-dark transition-colors font-bold">
                {editTaskIds.length === availableTasks.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {availableTasks.map(t => {
                const isSelected = editTaskIds.includes(t.id!);
                return (
                  <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-primary/10 hover:border-primary/20'}`}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => setEditTaskIds(prev => prev.includes(t.id!) ? prev.filter(i => i !== t.id!) : [...prev, t.id!])}
                      className="accent-primary w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t.title}</p>
                      <p className="text-neutral-medium/50 text-[10px]">{t.closed_date ? `Closed: ${t.closed_date}` : t.clickup_status || ''}</p>
                    </div>
                    <p className="text-primary font-bold text-sm shrink-0">{t.price > 0 ? fmt(t.price) : '—'} <span className="text-[10px] text-neutral-medium">{t.currency}</span></p>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Edit Preview */}
          <div className="p-4 rounded-xl bg-black/30 space-y-2 text-sm">
            <div className="flex justify-between text-neutral-medium">
              <span>Tổng giá tasks ({editTaskIds.length} tasks)</span>
              <span className="text-primary font-bold">{fmt(editTotal)} {editCurrency}</span>
            </div>
            {editPreview.bonusAmount > 0 && (
              <div className="flex justify-between text-yellow-400">
                <span>+ Bonus {editBonusType === 'percent' ? `(${editBonusValue}%)` : '(cố định)'}</span>
                <span className="font-bold">+{fmt(editPreview.bonusAmount)}</span>
              </div>
            )}
            {editTaxRate > 0 ? (
              <div className="flex justify-between text-red-400">
                <span>− Thuế TNCN ({editTaxRate}%)</span>
                <span className="font-bold">-{fmt(editPreview.taxAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-emerald-400/60">
                <span>👤 Cá nhân — Miễn thuế</span>
                <span className="font-bold">0</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-400 font-black text-base pt-2 border-t border-white/10">
              <span>💰 THỰC NHẬN</span>
              <span>{fmt(editPreview.netAmount)} {editCurrency}</span>
            </div>
          </div>
        </div>
      )}

      {!editing && s.notes && (
        <div className="px-4 py-3 rounded-xl border border-primary/10 bg-surface text-neutral-medium text-sm">
          📝 <span className="italic">{s.notes}</span>
        </div>
      )}

      {/* Bank info */}
      <div className="px-5 py-4 rounded-[16px] border border-primary/10 bg-surface">
        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-3">🏦 Thông tin thanh toán</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-neutral-medium/60 uppercase tracking-wider">Ngân hàng</p>
            <p className="text-white font-bold text-sm mt-0.5">{workerObj?.bank_name || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-medium/60 uppercase tracking-wider">Số tài khoản</p>
            <p className="text-white font-bold text-sm mt-0.5 font-mono">{workerObj?.bank_account || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-medium/60 uppercase tracking-wider">Chủ tài khoản</p>
            <p className="text-white font-bold text-sm mt-0.5">{workerObj?.full_name || '—'}</p>
          </div>
        </div>
      </div>

      {/* Task table */}
      <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium min-w-[200px]">Task</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Project</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium whitespace-nowrap">Ngày đóng</th>
                <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Giá</th>
                <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Tiền tệ</th>
                <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium whitespace-nowrap">VNĐ</th>
                <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Bonus</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium whitespace-nowrap">Lý do Bonus</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {loadingTasks ? (
                <tr><td colSpan={10} className="text-center py-8 text-neutral-medium">Đang tải...</td></tr>
              ) : detailTasks.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-neutral-medium">Không có task</td></tr>
              ) : detailTasks.map((t, i) => {
                const effectiveRate = t.payment_status === 'paid' && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate;
                const vndEquiv = t.currency === 'USD' && effectiveRate > 0 ? t.price * effectiveRate : null;
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-neutral-medium/50">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{t.title}</td>
                    <td className="px-4 py-3 text-neutral-medium text-xs">{t.clickup_folder_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-medium text-xs whitespace-nowrap">{t.closed_date || '—'}</td>
                    <td className="px-4 py-3 text-right text-primary font-bold">{t.price > 0 ? fmt(t.price) : '—'}</td>
                    <td className="px-4 py-3 text-center text-neutral-medium text-xs">{t.currency}</td>
                    <td className="px-4 py-3 text-right text-emerald-400/80 text-xs">{vndEquiv ? fmt(vndEquiv) : ''}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 font-bold">{t.bonus > 0 ? fmt(t.bonus) : ''}</td>
                    <td className="px-4 py-3 text-neutral-medium/60 text-xs max-w-[120px] truncate">{t.bonus_note || ''}</td>
                    <td className="px-4 py-3 text-neutral-medium/60 text-xs max-w-[120px] truncate">{t.notes || ''}</td>
                  </tr>
                );
              })}
            </tbody>
            {detailTasks.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-primary/20">
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-neutral-medium">Tổng giá tasks</td>
                  <td className="px-4 py-3 text-right text-primary font-black text-base">{fmt(totalPrice)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-bold text-xs">{totalVND > 0 ? fmt(totalVND) : ''}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-black">{totalBonus > 0 ? fmt(totalBonus) : ''}</td>
                  <td colSpan={2}></td>
                </tr>
                {(s.bonus_amount || 0) > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest text-yellow-400">+ Bonus ({s.bonus_type === 'percent' ? `${s.bonus_value}%` : 'Cố định'})</td>
                    <td colSpan={2} className="px-4 py-2 text-right text-yellow-400 font-bold">+{fmt(s.bonus_amount || 0)} <span className="text-xs text-neutral-medium">{s.currency}</span></td>
                    <td colSpan={4}></td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className={`px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest ${(s.tax_rate || 0) > 0 ? 'text-red-400' : 'text-emerald-400/60'}`}>
                    {(s.tax_rate || 0) > 0 ? `− Thuế TNCN (${s.tax_rate}%)` : '👤 Cá nhân — Miễn thuế'}
                  </td>
                  <td colSpan={2} className={`px-4 py-2 text-right font-bold ${(s.tax_rate || 0) > 0 ? 'text-red-400' : 'text-emerald-400/60'}`}>{(s.tax_rate || 0) > 0 ? `-${fmt(s.tax_amount || 0)}` : '0'} <span className="text-xs text-neutral-medium">{s.currency}</span></td>
                  <td colSpan={4}></td>
                </tr>
                <tr className="border-t-2 border-emerald-500/30">
                  <td colSpan={4} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-emerald-400">💰 THỰC NHẬN</td>
                  <td colSpan={2} className="px-4 py-3 text-right">
                    <span className="text-emerald-400 font-black text-xl">{fmt(s.net_amount || 0)} <span className="text-xs text-neutral-medium">{s.currency}</span></span>
                    {s.currency !== 'VND' && totalVND > 0 && (
                      <div className="text-neutral-medium text-xs mt-0.5">≈ {fmt(Math.round(totalVND * (1 - (s.tax_rate || 10) / 100)))} VNĐ</div>
                    )}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-neutral-medium/30 text-[10px] text-right">Tạo lúc: {s.created_at ? new Date(s.created_at).toLocaleString('vi-VN') : '—'}</p>
    </div>
  );
};

export default SettlementDetailView;
