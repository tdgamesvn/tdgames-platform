import React, { useState, useEffect } from 'react';
import { WorkforceTask } from '@/types';
import { fetchAcceptedTaskIds } from '../../services/projectAcceptanceService';
import * as wfSvc from '../../services/workforceService';
import { BackButton } from '../shared/BackButton';
import { getClickupStatusStyle } from './acceptancePdfExport';

const CLICKUP_STATUS_PALETTE = [
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'bg-red-500/20 text-red-400 border-red-500/30',
  'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
];

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";

interface AcceptanceCreateViewProps {
  tasks: WorkforceTask[];
  onBack: () => void;
  onCreate: (projectName: string, clientName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, clientPrices?: Record<string, number>, accountType?: 'company' | 'personal') => void;
  onRefresh?: () => void;
}

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US')}`;

const AcceptanceCreateView: React.FC<AcceptanceCreateViewProps> = ({ tasks, onBack, onCreate, onRefresh }) => {
  const [selClient, setSelClient] = useState('');
  const [selProject, setSelProject] = useState('');
  const [selPeriod, setSelPeriod] = useState('');
  const [selNotes, setSelNotes] = useState('');
  const [selTaskIds, setSelTaskIds] = useState<string[]>([]);
  const [selClickupStatusFilter, setSelClickupStatusFilter] = useState<string[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [acceptedTaskIds, setAcceptedTaskIds] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [localExcluded, setLocalExcluded] = useState<Set<string>>(new Set());
  const [selAccountType, setSelAccountType] = useState<'company' | 'personal'>('company');
  const [showAllMonths, setShowAllMonths] = useState(false);

  // Load task IDs that are already accepted (on mount)
  useEffect(() => {
    fetchAcceptedTaskIds().then(setAcceptedTaskIds).catch(() => {});
  }, []);

  // Build local excluded set from task data
  useEffect(() => {
    setLocalExcluded(new Set(tasks.filter(t => t.exclude_from_acceptance).map(t => t.id!)));
  }, [tasks]);

  const handleExcludeTask = async (taskId: string, exclude: boolean) => {
    await wfSvc.updateTask(taskId, { exclude_from_acceptance: exclude });
    setLocalExcluded(prev => {
      const next = new Set(prev);
      if (exclude) next.add(taskId); else next.delete(taskId);
      return next;
    });
    setSelTaskIds(prev => prev.filter(id => id !== taskId));
  };

  // Filter out already-accepted + excluded tasks from the full list (original behaviour)
  const availableTasks = tasks.filter(t => !acceptedTaskIds.has(t.id!) && !localExcluded.has(t.id!));
  const excludedTasks = tasks.filter(t => localExcluded.has(t.id!) && !acceptedTaskIds.has(t.id!));

  // Unique clients & projects (from available tasks only)
  const uniqueClients = [...new Set(availableTasks.map(t => t.clickup_space_name).filter(Boolean))].sort() as string[];
  const uniqueProjects = [...new Set(
    availableTasks
      .filter(t => !selClient || t.clickup_space_name === selClient)
      .map(t => t.clickup_folder_name)
      .filter(Boolean)
  )].sort() as string[];

  // Scoped tasks (from available only)
  const scopedTasks = availableTasks.filter(t => {
    if (selClient && t.clickup_space_name !== selClient) return false;
    if (selProject && t.clickup_folder_name !== selProject) return false;
    return true;
  });

  const availableClickupStatuses = [...new Set(scopedTasks.map(t => t.clickup_status).filter(Boolean))].sort() as string[];

  const eligibleTasks = scopedTasks.filter(t => {
    // Period-based date filter (when a period is selected and showAllMonths is OFF)
    if (selPeriod && !showAllMonths) {
      const refDate = t.closed_date || t.completed_at || t.approved_at;
      if (!refDate || !refDate.startsWith(selPeriod)) return false;
    }
    // ClickUp status filter
    if (selClickupStatusFilter.length > 0 && !selClickupStatusFilter.includes(t.clickup_status || '')) return false;
    return true;
  });

  const toggleStatusFilter = (status: string) => {
    setSelClickupStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    setSelTaskIds([]);
    setCustomPrices({});
  };

  const selectAllStatuses = () => { setSelClickupStatusFilter([...availableClickupStatuses]); setSelTaskIds([]); setCustomPrices({}); };
  const deselectAllStatuses = () => { setSelClickupStatusFilter([]); setSelTaskIds([]); setCustomPrices({}); };

  const selectedTasksData = eligibleTasks.filter(t => selTaskIds.includes(t.id!));
  const selectedTotal = selectedTasksData.reduce((s, t) => s + (customPrices[t.id!] ?? 0), 0);

  const toggleTask = (tid: string) => {
    setSelTaskIds(prev => {
      if (prev.includes(tid)) return prev.filter(i => i !== tid);
      // Auto-fill client_price from task when selecting
      const task = eligibleTasks.find(t => t.id === tid);
      if (task && task.client_price > 0 && !(tid in customPrices)) {
        setCustomPrices(p => ({ ...p, [tid]: task.client_price }));
      }
      return [...prev, tid];
    });
  };
  const selectAll = () => {
    if (selTaskIds.length === eligibleTasks.length) {
      setSelTaskIds([]);
    } else {
      const allIds = eligibleTasks.map(t => t.id!);
      // Auto-fill all client prices from tasks
      const prices = { ...customPrices };
      eligibleTasks.forEach(t => {
        if (t.client_price > 0 && !(t.id! in prices)) prices[t.id!] = t.client_price;
      });
      setCustomPrices(prices);
      setSelTaskIds(allIds);
    }
  };
  const setCustomPrice = (taskId: string, price: number) => setCustomPrices(prev => ({ ...prev, [taskId]: price }));

  const handleCreate = () => {
    if (!selProject || selTaskIds.length === 0) return;
    const clientName = selClient || selectedTasksData[0]?.clickup_space_name || '';
    onCreate(selProject, clientName, selPeriod, selTaskIds, selectedTotal, 'USD', selNotes, customPrices, selAccountType);
    onBack();
  };

  return (
    <div className="animate-fadeInUp space-y-6">
      <div className="flex items-center gap-4">
        <BackButton onClick={onBack} />
        <h2 className="text-3xl font-black text-blue-400 uppercase tracking-tighter">New Project Acceptance</h2>
      </div>

      <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Client (Space)</label>
            <select className={inputCls} value={selClient} onChange={e => { setSelClient(e.target.value); setSelProject(''); setSelTaskIds([]); setCustomPrices({}); setSelClickupStatusFilter([]); }}>
              <option value="">-- All clients --</option>
              {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Project (Folder) *</label>
            <select className={inputCls} value={selProject} onChange={e => { setSelProject(e.target.value); setSelTaskIds([]); setCustomPrices({}); setSelClickupStatusFilter([]); }}>
              <option value="">-- Select project --</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Period</label>
            <input type="month" className={inputCls} value={selPeriod} onChange={e => setSelPeriod(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input className={inputCls} value={selNotes} onChange={e => setSelNotes(e.target.value)} placeholder="Notes for client..." />
          </div>
        </div>

        {/* Account Type Toggle */}
        <div>
          <label className={labelCls}>Khách thanh toán qua</label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => setSelAccountType('company')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                selAccountType === 'company'
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                  : 'border-primary/10 text-neutral-medium hover:border-primary/20'
              }`}>
              🏢 TK Công ty
              <span className="block text-[9px] mt-0.5 opacity-60">Xuất hoá đơn, tính thuế</span>
            </button>
            <button type="button"
              onClick={() => setSelAccountType('personal')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                selAccountType === 'personal'
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                  : 'border-primary/10 text-neutral-medium hover:border-primary/20'
              }`}>
              👤 TK Cá nhân
              <span className="block text-[9px] mt-0.5 opacity-60">Theo dõi nội bộ</span>
            </button>
          </div>
        </div>

        {/* ClickUp Status Filter + All-months toggle */}
        {(selProject || selClient) && (
          <div>
            <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <label className={labelCls + ' !mb-0'}>
                  Filter by ClickUp Status ({selClickupStatusFilter.length}/{availableClickupStatuses.length})
                </label>
                {/* Show-all-months toggle */}
                {selPeriod && (
                  <button
                    onClick={() => { setShowAllMonths(v => !v); setSelTaskIds([]); setCustomPrices({}); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      showAllMonths
                        ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                        : 'text-neutral-medium border-white/10 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[10px]">{showAllMonths ? '✓' : '○'}</span>
                    Hiện tất cả tháng
                  </button>
                )}
                {selPeriod && !showAllMonths && (
                  <span className="text-[10px] text-neutral-medium/50">
                    💡 Chỉ hiện task có ngày đóng trong tháng {selPeriod}
                  </span>
                )}
                {showAllMonths && (
                  <span className="text-[10px] text-orange-400/60">
                    ⚡ Bỏ giới hạn tháng — hiện tất cả task chưa nghiệm thu
                  </span>
                )}
              </div>
              {availableClickupStatuses.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={selectAllStatuses} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold">Select all</button>
                  <span className="text-neutral-medium/30">|</span>
                  <button onClick={deselectAllStatuses} className="text-[10px] text-neutral-medium hover:text-white transition-colors font-bold">Clear</button>
                </div>
              )}
            </div>
            {availableClickupStatuses.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {availableClickupStatuses.map((status, idx) => {
                  const isActive = selClickupStatusFilter.includes(status);
                  const colorCls = CLICKUP_STATUS_PALETTE[idx % CLICKUP_STATUS_PALETTE.length];
                  const count = scopedTasks.filter(t => t.clickup_status === status).length;
                  return (
                    <button key={status} onClick={() => toggleStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider transition-all border ${
                        isActive ? colorCls : 'text-neutral-medium/50 border-primary/10 hover:text-white hover:bg-white/5'
                      }`}>
                      {isActive ? '✓ ' : ''}{status} <span className="opacity-50 ml-1">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            {selClickupStatusFilter.length === 0 && availableClickupStatuses.length > 0 && (
              <p className="text-neutral-medium/40 text-[10px] mt-1.5">
                💡 No status filter — showing all {eligibleTasks.length} eligible tasks
              </p>
            )}
          </div>
        )}

        {/* Task Selection */}
        {(selProject || selClient) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium">
                Select tasks ({selTaskIds.length}/{eligibleTasks.length})
              </p>
              <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-bold">
                {selTaskIds.length === eligibleTasks.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {eligibleTasks.length === 0 ? (
              <p className="text-neutral-medium text-sm py-4 text-center">No tasks match the current filter</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {(() => {
                  const createListGroups = new Map<string, WorkforceTask[]>();
                  eligibleTasks.forEach(t => {
                    const ln = t.clickup_list_name || 'Other';
                    if (!createListGroups.has(ln)) createListGroups.set(ln, []);
                    createListGroups.get(ln)!.push(t);
                  });
                  return Array.from(createListGroups.entries()).map(([listName, groupTasks]) => (
                    <div key={listName} className="mb-3">
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-primary/10 mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                          {listName}
                          <span className="text-neutral-medium/50 font-medium ml-2 normal-case tracking-normal">{groupTasks.length} tasks</span>
                        </span>
                        <span className="text-[10px] text-neutral-medium/50">
                          {groupTasks.filter(t => selTaskIds.includes(t.id!)).length} selected
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {groupTasks.map(t => {
                          const isSelected = selTaskIds.includes(t.id!);
                          const clientPrice = customPrices[t.id!] ?? 0;
                          const clickupStatus = t.clickup_status || t.status || '';
                          const statusStyle = getClickupStatusStyle(clickupStatus);
                          return (
                            <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              isSelected ? 'border-blue-500/40 bg-blue-500/5' : 'border-primary/10 hover:border-primary/20'
                            }`}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleTask(t.id!)}
                                className="accent-blue-500 w-4 h-4 shrink-0 cursor-pointer" />
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTask(t.id!)}>
                                <div className="flex items-center gap-2">
                                  <p className="text-white text-sm font-medium truncate">{t.title}</p>
                                  <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-md capitalize ${statusStyle.className}`}>
                                    {clickupStatus}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-medium/50 mt-0.5">
                                  {t.closed_date && <span>Closed: {t.closed_date}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className="text-neutral-medium/40 text-xs">$</span>
                                <input type="number" min="0" step="1" value={clientPrice || ''}
                                  onChange={e => setCustomPrice(t.id!, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-24 bg-transparent border border-primary/10 rounded-lg px-3 py-1.5 text-blue-400 font-bold text-sm text-right focus:outline-none focus:border-blue-500/40 transition-all placeholder-neutral-medium/20"
                                />
                                <span className="text-neutral-medium/40 text-[10px]">USD</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleExcludeTask(t.id!, true); }}
                                  className="text-neutral-medium/30 hover:text-red-400 transition-colors ml-1"
                                  title="Ẩn task khỏi nghiệm thu (không ảnh hưởng ClickUp)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-primary/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Total Client Amount</p>
                <p className="text-2xl font-black text-blue-400">{fmtUSD(selectedTotal)}</p>
              </div>
              <button
                onClick={handleCreate}
                disabled={selTaskIds.length === 0 || !selProject}
                className="py-3 px-8 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
              >✚ Create Acceptance</button>
            </div>
          </div>
        )}
      </div>

      {/* Excluded Tasks Panel */}
      {excludedTasks.length > 0 && (
        <div className="rounded-[20px] border border-red-500/10 bg-surface p-4">
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-2 w-full text-left"
          >
            <svg className={`w-4 h-4 text-neutral-medium transition-transform ${showExcluded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">
              Ẩn khỏi nghiệm thu ({excludedTasks.length} tasks)
            </span>
          </button>
          {showExcluded && (
            <div className="mt-3 space-y-1.5">
              {excludedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-red-500/10 bg-red-500/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-medium text-sm truncate line-through opacity-60">{t.title}</p>
                    <p className="text-[10px] text-neutral-medium/40">{t.clickup_folder_name} › {t.clickup_list_name}</p>
                  </div>
                  <button
                    onClick={() => handleExcludeTask(t.id!, false)}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2.5 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/10"
                  >
                    ↩ Khôi phục
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcceptanceCreateView;
