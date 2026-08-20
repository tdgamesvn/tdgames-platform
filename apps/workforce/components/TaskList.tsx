import React, { useState, useEffect } from 'react';
import { Worker, WorkforceTask } from '@/types';
import * as clickup from '../services/clickupService';
import { ClickUpConfig, ListContext } from '../services/clickupService';
import * as wfSvc from '../services/workforceService';
import { supabase } from '@/services/supabaseClient';

interface TaskListProps {
  tasks: WorkforceTask[];
  workers: Worker[];
  isLoading: boolean;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterWorker: string;
  setFilterWorker: (v: string) => void;
  onUpdate: (id: string, updates: Partial<WorkforceTask>) => void | Promise<void>;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
  vcbSellRate: number;
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

const CLICKUP_STATUSES = [
  'client_review', 'fix', 'lead_check', 'closed', 'approved', 'new request', 'in progress', 'canceled'
];

const TaskList: React.FC<TaskListProps> = ({
  tasks, workers, isLoading,
  filterStatus, setFilterStatus,
  filterWorker, setFilterWorker,
  onUpdate, onRefresh, onToast, vcbSellRate,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; total: number } | null>(null);
  const [config, setConfig] = useState<ClickUpConfig | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterSpace, setFilterSpace] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [filterList, setFilterList] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('unpaid');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState('VND');
  const [editRate, setEditRate] = useState('');
  const [editBonus, setEditBonus] = useState('');
  const [editBonusNote, setEditBonusNote] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editClientPrice, setEditClientPrice] = useState('');
  const [editClientCurrency, setEditClientCurrency] = useState('USD');
  const [editShares, setEditShares] = useState<{ worker_id: string; share_pct: number }[]>([]);

  useEffect(() => {
    clickup.loadConfig().then(c => setConfig(c)).catch(() => {});
  }, []);

  // Apply local hierarchy filters
  const filteredDisplayTasks = tasks.filter(t => {
    if (filterSpace && t.clickup_space_name !== filterSpace) return false;
    if (filterFolder && t.clickup_folder_name !== filterFolder) return false;
    if (filterList && t.clickup_list_name !== filterList) return false;
    if (filterPaymentStatus) {
      if (filterPaymentStatus === 'unpaid' && t.payment_status === 'paid') return false;
      if (filterPaymentStatus === 'paid' && t.payment_status !== 'paid') return false;
    }
    if (selectedStatuses.length > 0) {
      if (!t.clickup_status || !selectedStatuses.includes(t.clickup_status.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const totalPrice = filteredDisplayTasks.reduce((s, t) => s + (t.price || 0), 0);
  const totalClientUSD = filteredDisplayTasks.filter(t => (t.client_currency || 'USD') === 'USD').reduce((s, t) => s + (t.client_price || 0), 0);
  const totalClientVND = filteredDisplayTasks.filter(t => t.client_currency === 'VND').reduce((s, t) => s + (t.client_price || 0), 0);
  const closedCount = filteredDisplayTasks.filter(t => !!t.closed_date).length;
  const unpaidCount = filteredDisplayTasks.filter(t => t.payment_status !== 'paid' && !!t.closed_date).length;

  // ── Map ClickUp status → our status ──
  const mapStatus = (clickupStatus: string): WorkforceTask['status'] => {
    const lower = clickupStatus.toLowerCase();
    if (['closed', 'done', 'complete', 'approved'].some(s => lower.includes(s))) return 'approved';
    if (['rejected', 'cancelled', 'canceled'].some(s => lower.includes(s))) return 'rejected';
    // Only internal review/QA = completed; client_review remains in_progress
    if (lower.includes('client')) return 'in_progress';
    if (['review', 'qa', 'testing'].some(s => lower.includes(s))) return 'completed';
    return 'in_progress';
  };

  const nameOf = (workerId: string) => workers.find(w => w.id === workerId)?.full_name || '—';
  const assigneeNames = (t: WorkforceTask) =>
    (t.assignees || []).map(a => a.worker?.full_name || nameOf(a.worker_id)).join(', ');

  /** Đồng bộ danh sách người làm từ ClickUp, GIỮ NGUYÊN % sếp đã chỉnh tay. */
  const syncAssignees = async (taskId: string, matched: Worker[]) => {
    const { data: cur } = await supabase
      .from('wf_task_assignees').select('worker_id, share_pct').eq('task_id', taskId);
    const curMap = new Map((cur || []).map((a: any) => [a.worker_id as string, Number(a.share_pct)]));
    const ids = matched.map(w => w.id!);
    if (ids.length === curMap.size && ids.every(id => curMap.has(id))) return; // không đổi

    // Danh sách người làm thay đổi ⇒ chia đều lại cho tất cả (2 người = 50/50).
    // ponytail: cách cũ chỉ cho người mới phần % còn trống, nên task 1 người (100%)
    // thêm người thứ 2 thì người đó nhận 0% — doanh thu/lương không về tay ai.
    // Đánh đổi: % sếp chỉnh tay bị reset KHI danh sách người đổi (sync cùng danh sách
    // đã return ở trên nên không đụng). Chỉnh lại trong modal sửa giá nếu cần.
    const shares = wfSvc.splitShares(ids.length);
    await wfSvc.setTaskAssignees(taskId, ids.map((id, i) => ({ worker_id: id, share_pct: shares[i] })));
  };

  // Toggle thanh toán: đổi cho TẤT CẢ người của task (đúng hành vi cũ khi task 1 người).
  const togglePayment = async (t: WorkforceTask) => {
    const next = t.payment_status === 'paid' ? 'unpaid' : 'paid';
    try {
      if (next === 'paid' && t.currency === 'USD' && vcbSellRate > 0) {
        await onUpdate(t.id!, { exchange_rate: vcbSellRate });
      }
      await wfSvc.setTaskPayment(t.id!, next);
      onToast(next === 'paid' ? '💰 Đã đánh dấu thanh toán' : '⏳ Đã chuyển về chưa thanh toán', 'success');
      onRefresh();
    } catch (e: any) {
      onToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  // ── Modal sửa giá (dùng chung cho board + list) ──
  const openEditor = (t: WorkforceTask) => {
    setEditingPriceId(t.id!);
    setEditPrice(t.price > 0 ? String(t.price) : '');
    setEditCurrency(t.currency || 'VND');
    setEditRate(
      t.payment_status === 'paid' && t.exchange_rate > 0
        ? String(t.exchange_rate)
        : (t.currency === 'USD' && vcbSellRate > 0 ? String(vcbSellRate) : '')
    );
    setEditBonus(t.bonus > 0 ? String(t.bonus) : '');
    setEditBonusNote(t.bonus_note || '');
    setEditNotes(t.notes || '');
    setEditClientPrice(t.client_price > 0 ? String(t.client_price) : '');
    setEditClientCurrency(t.client_currency || 'USD');
    setEditShares((t.assignees || []).map(a => ({ worker_id: a.worker_id, share_pct: Number(a.share_pct) })));
  };

  const shareTotal = editShares.reduce((s, a) => s + (Number(a.share_pct) || 0), 0);
  const shareInvalid = editShares.length > 1 && shareTotal !== 100;

  const saveEditor = async (taskId: string) => {
    if (shareInvalid) return;
    await onUpdate(taskId, {
      price: parseFloat(editPrice) || 0,
      currency: editCurrency,
      exchange_rate: parseFloat(editRate) || 0,
      bonus: parseFloat(editBonus) || 0,
      bonus_note: editBonusNote,
      notes: editNotes,
      client_price: parseFloat(editClientPrice) || 0,
      client_currency: editClientCurrency,
    });
    if (editShares.length > 1) {
      try {
        await wfSvc.setTaskAssignees(taskId, editShares);
        onRefresh();
      } catch (e: any) {
        onToast(`Lỗi lưu tỉ lệ chia: ${e.message}`, 'error');
      }
    }
    setEditingPriceId(null);
  };

  const renderShareEditor = () => {
    if (editShares.length < 2) return null; // task 1 người: giữ y hệt hôm nay
    const price = parseFloat(editPrice) || 0;
    return (
      <div className="border-t border-primary/10 pt-2 mt-1 space-y-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-primary/70">👥 Chia cho {editShares.length} người</p>
        {editShares.map((a, i) => (
          <div key={a.worker_id} className="flex items-center gap-2">
            <span className="flex-1 text-xs text-neutral-light truncate">{nameOf(a.worker_id)}</span>
            <input
              type="number"
              value={a.share_pct}
              onChange={e => setEditShares(prev => prev.map((x, j) => j === i ? { ...x, share_pct: parseFloat(e.target.value) || 0 } : x))}
              className="w-16 bg-surface border border-primary/20 text-white rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:border-primary/50"
            />
            <span className="text-[10px] text-neutral-medium">%</span>
            <span className="text-[11px] font-bold text-emerald-400 w-28 text-right">
              {Math.round(price * (Number(a.share_pct) || 0) / 100).toLocaleString()} {editCurrency}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => setEditShares(prev => wfSvc.splitShares(prev.length).map((p, i) => ({ ...prev[i], share_pct: p })))}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80"
          >⚖️ Chia đều</button>
          <span className={`text-[11px] font-black ${shareTotal === 100 ? 'text-emerald-400' : 'text-red-400'}`}>
            Tổng: {shareTotal}%
          </span>
        </div>
      </div>
    );
  };

  // ── Sync from ClickUp ──
  const handleSync = async () => {
    if (!config) {
      onToast('Chưa cấu hình ClickUp — vào tab Cấu hình để thiết lập', 'error');
      return;
    }

    setSyncing(true);
    setSyncResult(null);
    try {
      // 1. Dynamically fetch ALL spaces & lists from the team
      onToast('🔍 Đang quét toàn bộ Workspace...', 'success');
      const spacesData = await clickup.fetchSpaces(config.api_token, config.team_id);
      const allSpaces = spacesData.spaces || [];
      
      const allListContexts: ListContext[] = [];
      const allListIds: string[] = [];
      
      for (const sp of allSpaces) {
        const listsData = await clickup.fetchLists(config.api_token, sp.id);
        const lists = listsData.lists || [];
        for (const l of lists) {
          allListIds.push(l.id);
          allListContexts.push({
            list_id: l.id,
            list_name: l.name,
            folder_name: l.folder || null,
            space_name: sp.name,
          });
        }
      }

      if (allListIds.length === 0) {
        onToast('Không tìm thấy list nào trong workspace', 'error');
        setSyncing(false);
        return;
      }

      onToast(`📋 Tìm thấy ${allListIds.length} lists từ ${allSpaces.length} spaces. Đang sync tasks...`, 'success');

      // 2. Fetch tasks from ClickUp with hierarchy context
      const data = await clickup.syncTasks(config.api_token, config.team_id, allListIds, allListContexts);
      const clickupTasks = data.tasks;

      // 2. Build worker email → worker map
      const emailToWorker = new Map<string, Worker>();
      for (const w of workers) {
        if (w.email) emailToWorker.set(w.email.toLowerCase(), w);
      }

      // 3. Upsert tasks matched by email — check DB directly (not stale in-memory array)
      let synced = 0;
      let skipped = 0;

      for (const ct of clickupTasks) {
        // TẤT CẢ người được assign trên ClickUp (trước đây `break` ở người đầu tiên
        // ⇒ task nhiều người bị tách thành nhiều dòng wf_tasks ⇒ doanh thu đếm 2 lần).
        const matchedWorkers = ct.assignee_emails
          .map(e => emailToWorker.get(e))
          .filter((w): w is Worker => !!w);

        if (matchedWorkers.length === 0) {
          skipped++;
          continue;
        }

        // 1 clickup_task_id = 1 dòng wf_tasks (không còn tra kèm worker_id)
        const { data: existingRows } = await supabase
          .from('wf_tasks')
          .select('id')
          .eq('clickup_task_id', ct.clickup_task_id);
        // ponytail: dữ liệu prod đã dọn hết dòng trùng (2026-08-19). Guard này chỉ để sync
        // không tự chọn bừa nếu lại có 2 dòng cùng clickup_task_id — dọn tay rồi sync lại.
        if (existingRows && existingRows.length > 1) {
          skipped++;
          continue;
        }
        const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

        const ourStatus = mapStatus(ct.clickup_status);
        const startDate = ct.date_created ? ct.date_created.split('T')[0] : null;
        // Use date_done if available; fallback to date_updated for closed/approved tasks
        let closedDate = ct.date_done ? ct.date_done.split('T')[0] : null;
        if (!closedDate && (ourStatus === 'approved' || ourStatus === 'completed') && ct.date_updated) {
          closedDate = ct.date_updated.split('T')[0];
        }
        // Task chưa done (client_review…) không có date_done. Lưu riêng date_updated của
        // ClickUp để dashboard có mốc phân tháng — KHÔNG dùng cột updated_at của DB vì
        // updateTask ghi đè nó mỗi lần bấm Sync.
        const clickupUpdatedAt = ct.date_updated ? ct.date_updated.split('T')[0] : null;

        if (existing) {
          // Update existing — also update project name in case folder was renamed on ClickUp
          await wfSvc.updateTask(existing.id, {
            title: ct.title,
            project: ct.folder_name || ct.list_name || '',
            client_name: ct.space_name || '',
            clickup_status: ct.clickup_status,
            status: ourStatus,
            start_date: startDate,
            closed_date: closedDate,
            completed_at: closedDate,
            clickup_updated_at: clickupUpdatedAt,
            clickup_space_name: ct.space_name || null,
            clickup_folder_name: ct.folder_name || null,
            clickup_list_name: ct.list_name || null,
            synced_at: new Date().toISOString(),
          });
          await syncAssignees(existing.id, matchedWorkers);
        } else {
          // Insert new
          await wfSvc.saveTask({
            project: ct.folder_name || ct.list_name || '',
            client_name: ct.space_name || '',
            title: ct.title,
            clickup_task_id: ct.clickup_task_id,
            clickup_list_id: ct.clickup_list_id,
            clickup_status: ct.clickup_status,
            clickup_space_name: ct.space_name || null,
            clickup_folder_name: ct.folder_name || null,
            clickup_list_name: ct.list_name || null,
            status: ourStatus,
            price: 0,
            currency: 'VND',
            exchange_rate: 0,
            bonus: 0,
            bonus_note: '',
            start_date: startDate,
            closed_date: closedDate,
            completed_at: closedDate,
            clickup_updated_at: clickupUpdatedAt,
            approved_at: ourStatus === 'approved' ? (closedDate || new Date().toISOString().split('T')[0]) : null,
            payment_status: 'unpaid',
            notes: '',
            synced_at: new Date().toISOString(),
            client_price: 0,
            client_currency: 'USD',
          }, matchedWorkers.map((w, i) => ({
            worker_id: w.id!,
            share_pct: wfSvc.splitShares(matchedWorkers.length)[i],
          })));
        }
        synced++;
      }

      // 4. Batch-update folder/space/list names for ALL tasks in DB
      //    This handles renamed folders on ClickUp: old tasks (possibly archived)
      //    still have stale names. We propagate the latest name from ClickUp.
      const listNameMap = new Map<string, { space: string | null; folder: string | null; list: string | null }>();
      for (const ctx of allListContexts) {
        listNameMap.set(ctx.list_id, {
          space: ctx.space_name || null,
          folder: ctx.folder_name || null,
          list: ctx.list_name || null,
        });
      }
      for (const [listId, names] of listNameMap) {
        await supabase
          .from('wf_tasks')
          .update({
            clickup_space_name: names.space,
            clickup_folder_name: names.folder,
            clickup_list_name: names.list,
            project: names.folder || names.list || '',
          })
          .eq('clickup_list_id', listId);
      }

      // 5. Update last sync time
      await clickup.updateConfigSyncTime();
      setSyncResult({ synced, skipped, total: clickupTasks.length });
      onToast(`Đồng bộ xong: ${synced} tasks synced, ${skipped} bỏ qua (không match email)`, 'success');
      onRefresh();
    } catch (e: any) {
      onToast(`Lỗi sync: ${e.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Task</h2>
          <p className="text-neutral-medium text-sm mt-1">Đồng bộ task từ ClickUp theo email nhân sự</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? '⏳ Đang sync...' : '🔄 Sync ClickUp'}
        </button>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className="rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✅</span>
          <div>
            <p className="text-white text-sm font-bold">Sync hoàn tất</p>
            <p className="text-neutral-medium text-xs">
              Tổng: {syncResult.total} tasks | Synced: {syncResult.synced} | Bỏ qua: {syncResult.skipped} (email không match)
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Tổng task</p>
          <p className="text-3xl font-black text-white">{filteredDisplayTasks.length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Đã đóng</p>
          <p className="text-3xl font-black text-emerald-400">{closedCount}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Chưa thanh toán</p>
          <p className="text-3xl font-black text-amber-400">{unpaidCount}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-primary/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Tổng giá trị</p>
          <p className="text-lg font-black text-primary">🟠 {totalPrice.toLocaleString()} <span className="text-xs text-neutral-medium font-medium">Trả NL</span></p>
          <p className="text-base font-black text-blue-400">🔵 {totalClientUSD > 0 ? `$${totalClientUSD.toLocaleString()}` : ''}{totalClientUSD > 0 && totalClientVND > 0 ? ' + ' : ''}{totalClientVND > 0 ? `${totalClientVND.toLocaleString()} ₫` : ''}{totalClientUSD === 0 && totalClientVND === 0 ? '—' : ''} <span className="text-xs text-neutral-medium font-medium">Thu KH</span></p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        {/* Custom Multi-Select for Status */}
        <div className="relative">
          <button 
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none hover:border-primary/40 transition-all flex items-center gap-2"
          >
            {selectedStatuses.length === 0 ? 'Tất cả trạng thái' : `Đã chọn ${selectedStatuses.length} trạng thái`}
            <svg className="w-4 h-4 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {isStatusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-56 bg-surface border border-primary/20 rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="p-2 max-h-64 overflow-y-auto">
                  {CLICKUP_STATUSES.map(s => {
                    const isSelected = selectedStatuses.includes(s);
                    return (
                      <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedStatuses(prev => prev.filter(x => x !== s));
                            } else {
                              setSelectedStatuses(prev => [...prev, s]);
                            }
                          }}
                          className="w-4 h-4 rounded border-primary/30 text-primary focus:ring-primary/30 bg-transparent"
                        />
                        <span className="text-sm text-neutral-light font-bold capitalize">{s.replace('_', ' ')}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedStatuses.length > 0 && (
                  <div className="p-2 border-t border-primary/10">
                    <button 
                      onClick={() => setSelectedStatuses([])}
                      className="w-full text-center text-xs font-bold text-red-400 hover:text-red-300 py-1"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <select className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all" value={filterPaymentStatus} onChange={e => setFilterPaymentStatus(e.target.value)}>
          <option value="">Tất cả thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="paid">Đã thanh toán</option>
        </select>
        <select className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
          <option value="">Tất cả nhân sự</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
        </select>
        <select className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all" value={filterSpace} onChange={e => { setFilterSpace(e.target.value); setFilterFolder(''); setFilterList(''); }}>
          <option value="">Tất cả khách hàng</option>
          {[...new Set(tasks.map(t => t.clickup_space_name).filter(Boolean))].sort().map(s => <option key={s} value={s!}>{s}</option>)}
        </select>
        <select className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all" value={filterFolder} onChange={e => { setFilterFolder(e.target.value); setFilterList(''); }}>
          <option value="">Tất cả project</option>
          {[...new Set(tasks.filter(t => !filterSpace || t.clickup_space_name === filterSpace).map(t => t.clickup_folder_name).filter(Boolean))].sort().map(f => <option key={f} value={f!}>{f}</option>)}
        </select>
        <select className="bg-surface border border-primary/10 text-neutral-light rounded-xl px-4 h-[44px] text-sm focus:outline-none focus:border-primary/40 transition-all" value={filterList} onChange={e => setFilterList(e.target.value)}>
          <option value="">Tất cả list</option>
          {[...new Set(tasks.filter(t => (!filterSpace || t.clickup_space_name === filterSpace) && (!filterFolder || t.clickup_folder_name === filterFolder)).map(t => t.clickup_list_name).filter(Boolean))].sort().map(l => <option key={l} value={l!}>{l}</option>)}
        </select>
        <span className="text-neutral-medium text-xs ml-auto mr-3">{filteredDisplayTasks.length} / {tasks.length} tasks</span>
        {/* View Toggle */}
        <div className="flex items-center bg-surface border border-primary/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 h-[44px] text-sm font-bold transition-all flex items-center gap-1.5 ${viewMode === 'board' ? 'bg-primary/20 text-primary' : 'text-neutral-medium hover:text-white'}`}
            title="Board View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 h-[44px] text-sm font-bold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-neutral-medium hover:text-white'}`}
            title="List View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            List
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && tasks.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <p className="text-neutral-medium text-sm">Chưa có task nào</p>
          <p className="text-neutral-medium/60 text-xs mt-2">Nhấn "🔄 Sync ClickUp" để đồng bộ task từ ClickUp</p>
        </div>
      )}

      {/* Task Cards — Board View */}
      {!isLoading && tasks.length > 0 && viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDisplayTasks.map(t => {
            const workerName = assigneeNames(t) || 'Chưa assign';
            const isFromClickUp = !!t.clickup_task_id;
            return (
              <div key={t.id} className="group relative rounded-[20px] border border-primary/10 bg-surface overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-card-glow">
                <div className={`h-1 w-full bg-gradient-to-r ${
                  t.status === 'approved' ? 'from-emerald-500 to-emerald-600' :
                  t.status === 'completed' ? 'from-yellow-500 to-yellow-600' :
                  t.status === 'rejected' ? 'from-red-500 to-red-600' :
                  'from-blue-500 to-blue-600'
                }`} />
                <div className="p-5">
                  {/* Row 1: Title + Status badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-bold text-sm line-clamp-2 leading-snug">{t.title}</h3>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      t.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      t.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400' :
                      t.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{STATUS_LABELS[t.status]}</span>
                  </div>

                  {/* Row 2: Breadcrumb hierarchy (Space | Folder | List) */}
                  {(t.clickup_space_name || t.clickup_folder_name || t.clickup_list_name) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-medium/70 mb-2 flex-wrap">
                      {t.clickup_space_name && <span className="bg-white/5 px-1.5 py-0.5 rounded">{t.clickup_space_name}</span>}
                      {t.clickup_space_name && t.clickup_folder_name && <span className="text-neutral-medium/30">|</span>}
                      {t.clickup_folder_name && <span className="bg-white/5 px-1.5 py-0.5 rounded">{t.clickup_folder_name}</span>}
                      {(t.clickup_space_name || t.clickup_folder_name) && t.clickup_list_name && <span className="text-neutral-medium/30">|</span>}
                      {t.clickup_list_name && <span className="bg-white/5 px-1.5 py-0.5 rounded">{t.clickup_list_name}</span>}
                    </div>
                  )}

                  {/* Row 3: Worker + Dates (spread across) */}
                  <div className="flex items-center justify-between text-xs text-neutral-medium mb-2">
                    <span>👤 {workerName}</span>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-medium/50">
                      {t.start_date && <span>🟢 {t.start_date}</span>}
                      {t.closed_date && <span>🔴 {t.closed_date}</span>}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/5 my-2" />

                  {/* Row 4: ClickUp Status + Payment Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isFromClickUp && t.clickup_status && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/20">
                        {t.clickup_status}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        togglePayment(t);
                      }}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-md cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                        t.payment_status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      }`}
                      title="Click để đổi trạng thái thanh toán"
                    >
                      {t.payment_status === 'paid' ? '💰 Đã TT' : '⏳ Chưa TT'}
                    </button>
                    {t.synced_at && (
                      <span className="text-neutral-medium/30 text-[9px] ml-auto">🔄 {new Date(t.synced_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  {/* Price Editor */}
                  {editingPriceId === t.id ? (
                    <div className="mt-3 space-y-2 p-3 rounded-xl bg-black/30 border border-primary/20">
                      {/* Worker Price + Currency */}
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">🟠 Giá trả người làm</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          placeholder="Giá tiền"
                          className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const next = editCurrency === 'VND' ? 'USD' : 'VND';
                            setEditCurrency(next);
                            if (next === 'USD' && vcbSellRate > 0) setEditRate(String(vcbSellRate));
                            if (next === 'VND') setEditRate('');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                            editCurrency === 'USD'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-primary/20 text-primary border-primary/30'
                          }`}
                        >
                          {editCurrency}
                        </button>
                      </div>
                      {/* Exchange rate row (USD only) */}
                      {editCurrency === 'USD' && (
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-medium text-[10px] whitespace-nowrap">Tỉ giá:</span>
                          <input
                            type="number"
                            value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                            placeholder="VD: 25500"
                            className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                          />
                          {editPrice && editRate && (
                            <span className="text-emerald-400 text-[10px] font-bold whitespace-nowrap">
                              = {(parseFloat(editPrice) * parseFloat(editRate)).toLocaleString()} VNĐ
                            </span>
                          )}
                        </div>
                      )}
                      {/* Bonus */}
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-medium text-[10px] whitespace-nowrap">Bonus:</span>
                        <input
                          type="number"
                          value={editBonus}
                          onChange={e => setEditBonus(e.target.value)}
                          placeholder="0"
                          className="w-28 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                        />
                        <input
                          type="text"
                          value={editBonusNote}
                          onChange={e => setEditBonusNote(e.target.value)}
                          placeholder="Lý do bonus"
                          className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      {/* Notes */}
                      <input
                        type="text"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Ghi chú"
                        className="w-full bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                      />
                      {/* Client Price */}
                      <div className="border-t border-primary/10 pt-2 mt-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 mb-1">🔵 Giá thu khách hàng</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editClientPrice}
                            onChange={e => setEditClientPrice(e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-surface border border-blue-500/20 text-blue-400 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-blue-500/50"
                          />
                          <button
                            onClick={() => setEditClientCurrency(prev => prev === 'USD' ? 'VND' : 'USD')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${editClientCurrency === 'USD' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                          >{editClientCurrency}</button>
                        </div>
                      </div>
                      {renderShareEditor()}
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditor(t.id!)}
                          disabled={shareInvalid}
                          className="flex-1 py-1.5 rounded-lg bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >Lưu</button>
                        <button
                          onClick={() => setEditingPriceId(null)}
                          className="flex-1 py-1.5 rounded-lg border border-primary/20 text-neutral-medium font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                        >Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mt-3 cursor-pointer group/price hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all"
                      onClick={() => openEditor(t)}
                    >
                      {/* Worker cost — orange */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-amber-500/60 w-[46px] shrink-0">Trả NL</span>
                        <p className="text-primary font-black text-base">
                          {t.price > 0 ? t.price.toLocaleString() : '—'}
                          <span className="text-[10px] text-neutral-medium ml-1">{t.currency}</span>
                        </p>
                        <span className="text-[10px] text-neutral-medium/40 ml-auto opacity-0 group-hover/price:opacity-100 transition-opacity">✏️</span>
                      </div>
                      {t.currency === 'USD' && t.price > 0 && (() => {
                        const isPaid = t.payment_status === 'paid';
                        const rate = isPaid && t.exchange_rate > 0 ? t.exchange_rate : vcbSellRate;
                        if (rate <= 0) return null;
                        return (
                          <p className="text-emerald-400/80 text-[10px] font-bold ml-[52px]">
                            = {(t.price * rate).toLocaleString()} VNĐ (tỉ giá: {rate.toLocaleString()}{!isPaid ? ' ⚡ live' : ' 🔒'})
                          </p>
                        );
                      })()}
                      {/* Client revenue — blue */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-blue-400/60 w-[46px] shrink-0">Thu KH</span>
                        {t.client_price > 0 ? (
                          <p className="text-blue-400 font-bold text-base">
                            {(t.client_currency || 'USD') === 'USD' ? '$' : ''}{t.client_price.toLocaleString()}
                            <span className="text-[10px] text-neutral-medium ml-1">{t.client_currency || 'USD'}</span>
                          </p>
                        ) : (
                          <p className="text-neutral-medium/30 text-xs italic">chưa có</p>
                        )}
                      </div>
                      {t.bonus > 0 && (
                        <p className="text-yellow-400/80 text-[10px] font-bold ml-[52px]">
                          + Bonus: {t.bonus.toLocaleString()} {t.currency}{t.bonus_note ? ` — ${t.bonus_note}` : ''}
                        </p>
                      )}
                      {t.notes && (
                        <p className="text-neutral-medium/50 text-[10px] mt-0.5 italic ml-[52px]">📝 {t.notes}</p>
                      )}
                    </div>
                  )}
                </div>


              </div>
            );
          })}
        </div>
      )}

      {/* Task Table — List View */}
      {!isLoading && tasks.length > 0 && viewMode === 'list' && (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10">
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">#</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium min-w-[280px]">Task</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">Nhân sự</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">Trạng thái</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">Thanh toán</th>
                  <th className="text-right px-5 py-4 text-[10px] font-black uppercase tracking-widest text-amber-500/70">Trả NL</th>
                  <th className="text-right px-5 py-4 text-[10px] font-black uppercase tracking-widest text-blue-400/70">Thu KH</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">Ngày tạo</th>
                  <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-medium">Ngày đóng</th>
                </tr>
              </thead>
              <tbody>
                {filteredDisplayTasks.map((t, idx) => {
                  const workerName = assigneeNames(t) || '—';
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-white/5 hover:bg-white/3 transition-all cursor-pointer ${
                        editingPriceId === t.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        if (editingPriceId === t.id) return;
                        openEditor(t);
                      }}
                    >
                      <td className="px-5 py-3 text-neutral-medium/50 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <p className="text-white font-semibold text-sm leading-snug line-clamp-1">{t.title}</p>
                        {(t.clickup_space_name || t.clickup_folder_name || t.clickup_list_name) && (
                          <p className="text-[10px] text-neutral-medium/50 mt-0.5">
                            {[t.clickup_space_name, t.clickup_folder_name, t.clickup_list_name].filter(Boolean).join(' › ')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-medium text-xs whitespace-nowrap">{workerName}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                          t.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                          t.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400' :
                          t.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>{STATUS_LABELS[t.status]}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            togglePayment(t);
                          }}
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-md cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                            t.payment_status === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          }`}
                          title="Click để đổi trạng thái thanh toán"
                        >
                          {t.payment_status === 'paid' ? 'Đã TT' : 'Chưa TT'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-primary font-bold text-sm">
                          {t.price > 0 ? t.price.toLocaleString() : '—'}
                        </span>
                        <span className="text-neutral-medium/50 text-[10px] ml-1">{t.currency}</span>
                        {t.bonus > 0 && (
                          <p className="text-yellow-400/70 text-[10px] font-bold">+{t.bonus.toLocaleString()}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {t.client_price > 0 ? (
                          <>
                            <span className="text-blue-400 font-bold text-sm">{(t.client_currency || 'USD') === 'USD' ? '$' : ''}{t.client_price.toLocaleString()}</span>
                            <span className="text-neutral-medium/50 text-[10px] ml-1">{t.client_currency || 'USD'}</span>
                          </>
                        ) : (
                          <span className="text-neutral-medium/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-medium/50 text-xs whitespace-nowrap">{t.start_date || '—'}</td>
                      <td className="px-5 py-3 text-neutral-medium/50 text-xs whitespace-nowrap">{t.closed_date || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inline Price Editor (appears below table when a row is clicked) */}
          {editingPriceId && (
            <div className="border-t border-primary/20 p-5 bg-black/20">
              <div className="max-w-2xl space-y-3">
                <p className="text-white font-bold text-sm mb-2">
                  ✏️ {filteredDisplayTasks.find(t => t.id === editingPriceId)?.title}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70 mb-1">🟠 Giá trả người làm</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Giá tiền"
                    className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" autoFocus />
                  <button onClick={() => { const next = editCurrency === 'VND' ? 'USD' : 'VND'; setEditCurrency(next); if (next === 'USD' && vcbSellRate > 0) setEditRate(String(vcbSellRate)); if (next === 'VND') setEditRate(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border transition-all ${editCurrency === 'USD' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-primary/20 text-primary border-primary/30'}`}>{editCurrency}</button>
                </div>
                {editCurrency === 'USD' && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-medium text-[10px]">Tỉ giá:</span>
                    <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} placeholder="VD: 25500"
                      className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
                    {editPrice && editRate && <span className="text-emerald-400 text-[10px] font-bold">= {(parseFloat(editPrice) * parseFloat(editRate)).toLocaleString()} VNĐ</span>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-neutral-medium text-[10px]">Bonus:</span>
                  <input type="number" value={editBonus} onChange={e => setEditBonus(e.target.value)} placeholder="0"
                    className="w-28 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
                  <input type="text" value={editBonusNote} onChange={e => setEditBonusNote(e.target.value)} placeholder="Lý do bonus"
                    className="flex-1 bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Ghi chú"
                  className="w-full bg-surface border border-primary/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
                {/* Client Price */}
                <div className="border-t border-primary/10 pt-2 mt-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 mb-1">🔵 Giá thu khách hàng</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={editClientPrice} onChange={e => setEditClientPrice(e.target.value)} placeholder="0"
                      className="w-40 bg-surface border border-blue-500/20 text-blue-400 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-blue-500/50" />
                    <button onClick={() => setEditClientCurrency(prev => prev === 'USD' ? 'VND' : 'USD')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${editClientCurrency === 'USD' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>{editClientCurrency}</button>
                  </div>
                </div>
                {renderShareEditor()}
                <div className="flex gap-2">
                  <button onClick={() => saveEditor(editingPriceId!)} disabled={shareInvalid}
                    className="py-1.5 px-6 rounded-lg bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Lưu</button>
                  <button onClick={() => setEditingPriceId(null)}
                    className="py-1.5 px-6 rounded-lg border border-primary/20 text-neutral-medium font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">Hủy</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskList;
