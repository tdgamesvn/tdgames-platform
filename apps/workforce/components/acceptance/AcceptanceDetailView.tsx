import React, { useState, useEffect } from 'react';
import { ProjectAcceptance, WorkforceTask } from '@/types';
import * as paSvc from '../../services/projectAcceptanceService';
import { BackButton } from '../shared/BackButton';
import { CompanySelector, CompanyId } from '../shared/CompanySelector';
import { StatusBadge } from '../shared/StatusBadge';
import { SignedScanButton } from '../shared/SignedScanButton';
import { getClickupStatusStyle, exportAcceptancePdf } from './acceptancePdfExport';

type AcceptanceTask = WorkforceTask & { client_price: number; acceptance_note: string };

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-dark/30 text-neutral-medium border-neutral-dark/50',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const STATUS_FLOW: Record<string, string> = { draft: 'sent', sent: 'accepted' };
const STATUS_NEXT_LABEL: Record<string, string> = { draft: '📤 Send to Client', sent: '✅ Client Accepted' };

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US')}`;
const calcDiscount = paSvc.calcDiscount;

interface AcceptanceDetailViewProps {
  acceptance: ProjectAcceptance;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<ProjectAcceptance>) => void;
  onDelete: (id: string) => void;
  onRequestConfirm: (message: string, onConfirm: () => void) => void;
}

const AcceptanceDetailView: React.FC<AcceptanceDetailViewProps> = ({
  acceptance: initialAcceptance, onBack, onUpdate, onDelete, onRequestConfirm,
}) => {
  const [a, setA] = useState(initialAcceptance);
  const [detailTasks, setDetailTasks] = useState<AcceptanceTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selCompany, setSelCompany] = useState<CompanyId>('tdgames');

  useEffect(() => {
    setLoadingTasks(true);
    paSvc.fetchProjectAcceptanceTasks(a.id!).then(setDetailTasks).catch(() => setDetailTasks([])).finally(() => setLoadingTasks(false));
  }, [a.id]);

  const nextStatus = STATUS_FLOW[a.status];
  const totalClientPrice = detailTasks.reduce((sum, t) => sum + (t.client_price || 0), 0);
  const discountAmount = calcDiscount(totalClientPrice, a.discount_type, a.discount_value);
  const netTotal = Math.max(0, totalClientPrice - discountAmount);

  const handleDiscountChange = (field: 'discount_type' | 'discount_value', val: any) => {
    const updates = { [field]: val };
    onUpdate(a.id!, updates);
    setA(prev => ({ ...prev, ...updates }));
  };

  const handleUpdateDetailPrice = async (taskId: string, newPrice: number) => {
    setDetailTasks(prev => prev.map(t => t.id === taskId ? { ...t, client_price: newPrice } : t));
    try {
      await paSvc.updateAcceptanceTaskClientPrice(a.id!, taskId, newPrice);
      const newTotal = await paSvc.recalcAcceptanceTotal(a.id!);
      setA(prev => ({ ...prev, total_amount: newTotal }));
      onUpdate(a.id!, { total_amount: newTotal });
    } catch { /* revert if needed */ }
  };

  const handleUpdateDetailNote = async (taskId: string, newNote: string) => {
    setDetailTasks(prev => prev.map(t => t.id === taskId ? { ...t, acceptance_note: newNote } : t));
    try {
      await paSvc.updateAcceptanceTaskNote(a.id!, taskId, newNote);
    } catch { /* revert if needed */ }
  };

  const handleExportPDF = () => exportAcceptancePdf(a, detailTasks, selCompany);

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <BackButton onClick={onBack} />
        <div className="flex-1">
          <h2 className="text-3xl font-black text-blue-400 uppercase tracking-tighter">Project Acceptance</h2>
          <p className="text-neutral-medium text-sm">{a.client_name} — {a.project_name}{a.period ? ` — Period ${a.period}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={a.status} labels={STATUS_LABELS} colors={STATUS_COLORS} size="md" />
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
            a.account_type === 'personal'
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
              : 'border-blue-500/20 text-blue-400/60 bg-blue-500/5'
          }`}>
            {a.account_type === 'personal' ? '👤 Cá nhân' : '🏢 Công ty'}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {nextStatus && (
          <button
            onClick={() => { onUpdate(a.id!, { status: nextStatus as any }); setA({ ...a, status: nextStatus as any }); }}
            className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
          >{STATUS_NEXT_LABEL[a.status]}</button>
        )}
        <CompanySelector selected={selCompany} onChange={setSelCompany} />
        <button onClick={handleExportPDF}
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-all">
          📄 Export PDF
        </button>
        <SignedScanButton
          signedFileUrl={a.signed_file_url}
          onUploaded={url => { onUpdate(a.id!, { signed_file_url: url }); setA(prev => ({ ...prev, signed_file_url: url })); }}
        />
        <button
          onClick={() => onRequestConfirm('Delete this project acceptance?', () => { onDelete(a.id!); onBack(); })}
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all ml-auto"
        >🗑 Delete</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-[16px] border border-blue-500/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Client</p>
          <p className="text-lg font-black text-white truncate">{a.client_name}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-blue-500/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Project</p>
          <p className="text-lg font-black text-blue-400 truncate">{a.project_name}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-blue-500/10 bg-surface">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium mb-1">Tasks</p>
          <p className="text-2xl font-black text-white">{detailTasks.length}</p>
        </div>
        <div className="p-4 rounded-[16px] border border-blue-500/10 bg-surface border-blue-500/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">NET TOTAL</p>
          <p className="text-2xl font-black text-blue-400">{fmtUSD(netTotal)}</p>
          {(a.discount_value || 0) > 0 && (
            <p className="text-[10px] text-neutral-medium/50 mt-0.5">
              Subtotal: {fmtUSD(totalClientPrice)} − Discount: {fmtUSD(discountAmount)}
            </p>
          )}
        </div>
      </div>

      {a.notes && (
        <div className="px-4 py-3 rounded-xl border border-primary/10 bg-surface text-neutral-medium text-sm">
          📝 <span className="italic">{a.notes}</span>
        </div>
      )}

      {/* Task table */}
      <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-primary/10 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Tasks — Client Pricing (USD)</p>
          <p className="text-[10px] text-neutral-medium/50">Click any price to edit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium w-8">#</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium min-w-[250px]">Task Description</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium whitespace-nowrap">Completed</th>
                <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium">Client Price (USD)</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-medium min-w-[150px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loadingTasks ? (
                <tr><td colSpan={6} className="text-center py-8 text-neutral-medium">Loading...</td></tr>
              ) : detailTasks.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-neutral-medium">No tasks</td></tr>
              ) : (() => {
                const listGroups = new Map<string, AcceptanceTask[]>();
                detailTasks.forEach(t => {
                  const ln = t.clickup_list_name || 'Other';
                  if (!listGroups.has(ln)) listGroups.set(ln, []);
                  listGroups.get(ln)!.push(t);
                });
                let idx = 0;
                return Array.from(listGroups.entries()).map(([listName, groupTasks]) => {
                  const sub = groupTasks.reduce((s, t) => s + (t.client_price || 0), 0);
                  return (
                    <React.Fragment key={listName}>
                      <tr className="bg-white/[0.03]">
                        <td colSpan={6} className="px-4 py-2.5 border-b border-primary/20">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              {listName}
                              <span className="text-neutral-medium/50 font-medium ml-2 normal-case tracking-normal">{groupTasks.length} tasks</span>
                            </span>
                            <span className="text-[10px] font-bold text-blue-400/70">{fmtUSD(sub)}</span>
                          </div>
                        </td>
                      </tr>
                      {groupTasks.map(t => {
                        idx++;
                        const clickupStatus = t.clickup_status || t.status || '';
                        const style = getClickupStatusStyle(clickupStatus);
                        return (
                          <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-neutral-medium/50">{idx}</td>
                            <td className="px-4 py-3 text-white font-medium">{t.title}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md capitalize ${style.className}`}>{clickupStatus}</span>
                            </td>
                            <td className="px-4 py-3 text-neutral-medium text-xs whitespace-nowrap">{t.closed_date || '\u2014'}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <span className="text-neutral-medium/40 text-xs">$</span>
                                <input type="number" min="0" step="1" defaultValue={t.client_price || ''}
                                  onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== t.client_price) handleUpdateDetailPrice(t.id!, v); }}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                  placeholder="0"
                                  className="w-28 bg-transparent border border-primary/10 rounded-lg px-3 py-1.5 text-blue-400 font-bold text-sm text-right focus:outline-none focus:border-blue-500/40 transition-all placeholder-neutral-medium/20 hover:border-primary/20"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" defaultValue={t.acceptance_note || ''}
                                onBlur={e => { const v = e.target.value.trim(); if (v !== (t.acceptance_note || '')) handleUpdateDetailNote(t.id!, v); }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                placeholder="Add note..."
                                className="w-full bg-transparent border border-primary/10 rounded-lg px-3 py-1.5 text-neutral-medium text-xs focus:outline-none focus:border-blue-500/40 transition-all placeholder-neutral-medium/20 hover:border-primary/20"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
            {detailTasks.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-blue-500/20">
                  <td colSpan={5} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-neutral-medium">Subtotal</td>
                  <td className="px-4 py-3 text-right text-blue-400 font-black text-base">{fmtUSD(totalClientPrice)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Discount controls */}
      <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-4">Discount</p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center rounded-xl border border-primary/10 overflow-hidden">
            <button onClick={() => handleDiscountChange('discount_type', 'amount')}
              className={`px-4 py-2.5 text-xs font-bold tracking-wider transition-all ${a.discount_type === 'amount' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-medium hover:text-white hover:bg-white/5'}`}
            >$ Fixed Amount</button>
            <button onClick={() => handleDiscountChange('discount_type', 'percent')}
              className={`px-4 py-2.5 text-xs font-bold tracking-wider transition-all ${a.discount_type === 'percent' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-medium hover:text-white hover:bg-white/5'}`}
            >% Percentage</button>
          </div>
          <div className="flex items-center gap-2">
            {a.discount_type === 'amount' && <span className="text-neutral-medium/40 text-sm">$</span>}
            <input type="number" min="0" step="1" defaultValue={a.discount_value || ''} key={`disc-${a.discount_type}`}
              onBlur={e => handleDiscountChange('discount_value', parseFloat(e.target.value) || 0)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="0"
              className="w-32 bg-transparent border border-primary/10 rounded-lg px-3 py-2 text-blue-400 font-bold text-sm text-right focus:outline-none focus:border-blue-500/40 transition-all placeholder-neutral-medium/20"
            />
            {a.discount_type === 'percent' && <span className="text-neutral-medium/40 text-sm">%</span>}
          </div>
          {(a.discount_value || 0) > 0 && (
            <div className="ml-auto flex items-center gap-6">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-medium">Discount</p>
                <p className="text-red-400 font-bold text-lg">-{fmtUSD(discountAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Net Total</p>
                <p className="text-blue-400 font-black text-2xl">{fmtUSD(netTotal)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-neutral-medium/30 text-[10px] text-right">Created: {a.created_at ? new Date(a.created_at).toLocaleString('en-US') : '—'}</p>
    </div>
  );
};

export default AcceptanceDetailView;
