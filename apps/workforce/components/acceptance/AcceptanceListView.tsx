import React from 'react';
import { ProjectAcceptance } from '@/types';
import { StatusBadge } from '../shared/StatusBadge';
import { acceptanceNetAmount } from '../../services/projectAcceptanceService';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-dark/30 text-neutral-medium border-neutral-dark/50',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const STATUS_BAR: Record<string, string> = {
  draft: 'from-neutral-dark to-neutral-dark',
  sent: 'from-blue-500 to-blue-600',
  accepted: 'from-emerald-500 to-emerald-600',
};

interface AcceptanceListViewProps {
  acceptances: ProjectAcceptance[];
  onOpenDetail: (a: ProjectAcceptance) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
}

const fmtUSD = (n: number) => `$${n.toLocaleString('en-US')}`;

const AcceptanceListView: React.FC<AcceptanceListViewProps> = ({
  acceptances, onOpenDetail, onCreateNew, onDelete,
}) => {
  const totalAccepted = acceptances.filter(a => a.status === 'accepted').reduce((s, a) => s + acceptanceNetAmount(a), 0);
  const totalPending = acceptances.filter(a => a.status !== 'accepted').reduce((s, a) => s + acceptanceNetAmount(a), 0);

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-blue-400 uppercase tracking-tighter">Project Acceptance</h2>
          <p className="text-neutral-medium text-sm mt-1">Completed task acceptance by project — for clients</p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
        >✚ New Acceptance</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-[20px] border border-blue-500/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Total Acceptances</p>
          <p className="text-3xl font-black text-white">{acceptances.length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-blue-500/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Accepted</p>
          <p className="text-3xl font-black text-emerald-400">{acceptances.filter(a => a.status === 'accepted').length}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-blue-500/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Accepted Value</p>
          <p className="text-2xl font-black text-blue-400">{fmtUSD(totalAccepted)}</p>
        </div>
        <div className="p-5 rounded-[20px] border border-blue-500/10 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">Pending</p>
          <p className="text-2xl font-black text-amber-400">{fmtUSD(totalPending)}</p>
        </div>
      </div>

      {/* Acceptance List */}
      {acceptances.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-neutral-medium text-sm">No project acceptances yet</p>
          <p className="text-neutral-medium/60 text-xs mt-2">Click "✚ New Acceptance" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {acceptances.map(a => (
            <div
              key={a.id}
              className="group relative rounded-[20px] border border-blue-500/10 bg-surface overflow-hidden hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] cursor-pointer"
              onClick={() => onOpenDetail(a)}
            >
              <div className={`h-1 w-full bg-gradient-to-r ${STATUS_BAR[a.status]}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-base truncate">{a.project_name}</p>
                    <p className="text-neutral-medium text-xs mt-0.5 truncate">🏢 {a.client_name}{a.period ? ` — Period ${a.period}` : ''}</p>
                  </div>
                  <span className="shrink-0 ml-2 flex items-center gap-1.5">
                    <StatusBadge status={a.status} labels={STATUS_LABELS} colors={STATUS_COLORS} />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      a.account_type === 'personal'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        : 'border-blue-500/20 text-blue-400/60 bg-blue-500/5'
                    }`}>
                      {a.account_type === 'personal' ? '👤' : '🏢'}
                    </span>
                  </span>
                </div>
                <p className="text-neutral-medium text-xs">{a.total_tasks} tasks</p>
                <p className="text-blue-400 font-black text-2xl mt-3">{fmtUSD(acceptanceNetAmount(a))}</p>
                {a.notes && <p className="text-neutral-medium/60 text-[11px] mt-2 line-clamp-1 italic">📝 {a.notes}</p>}
                <p className="text-neutral-medium/30 text-[9px] mt-2">🔄 {a.created_at ? new Date(a.created_at).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</p>
              </div>

              {/* Delete action */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete(a.id!);
                }}
                className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AcceptanceListView;
