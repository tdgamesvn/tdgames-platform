import React, { useState, useEffect } from 'react';
import { fetchActivityLogs, ActivityLog } from '../services/supabaseService';
import { Button } from '@/components/Button';

interface ActivityLogTabProps {
  theme: string;
}

const ACTION_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  created: { icon: '📥', label: 'Created', color: 'text-status-success' },
  updated: { icon: '✏️', label: 'Updated', color: 'text-status-info' },
  status_changed: { icon: '🔄', label: 'Status Changed', color: 'text-status-warning' },
  deleted: { icon: '🗑️', label: 'Deleted', color: 'text-status-error' },
  einvoice_draft: { icon: '📄', label: 'eInvoice Draft', color: 'text-emerald-400' },
  einvoice_failed: { icon: '❌', label: 'eInvoice Failed', color: 'text-status-error' },
  email_sent: { icon: '✉️', label: 'Email Sent', color: 'text-blue-400' },
};

const getActionConfig = (action: string) =>
  ACTION_CONFIG[action] || { icon: '📋', label: action, color: 'text-neutral-medium' };

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ theme }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchActivityLogs(200);
      setLogs(data);
    } catch (e: any) {
      console.error('Failed to load activity logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = filterAction ? logs.filter(l => l.action === filterAction) : logs;
  const actionTypes = Array.from(new Set<string>(logs.map(l => l.action))).sort();

  return (
    <div className="animate-fadeInUp space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">📋 Activity Log</h2>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>Invoice operation history</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'bg-surface border-white/10 text-white' : 'bg-white border-gray-200 text-black'}`}
          >
            <option value="">All ({logs.length})</option>
            {actionTypes.map(a => {
              const cfg = getActionConfig(a);
              return <option key={a} value={a}>{cfg.icon} {cfg.label}</option>;
            })}
          </select>
          <Button onClick={loadLogs} variant="ghost" size="sm" disabled={isLoading}>{isLoading ? 'Loading...' : 'Refresh'}</Button>
        </div>
      </div>

      {/* Timeline */}
      <div className={`p-8 rounded-[24px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl opacity-30">📋</span>
            </div>
            <p className="opacity-30 font-black uppercase tracking-widest text-xs">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className={`absolute left-[19px] top-0 bottom-0 w-[2px] ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />

            <div className="space-y-1">
              {filteredLogs.map((log, idx) => {
                const cfg = getActionConfig(log.action);
                const invNum = log.details?.invoice_number || log.details?.invoiceNumber || '—';
                const clientName = log.details?.client_name || '';

                return (
                  <div key={log.id} className="relative flex items-start gap-4 pl-0 group">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-110 ${theme === 'dark' ? 'bg-surface border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
                      <span className="text-base">{cfg.icon}</span>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 py-3 px-4 rounded-xl transition-colors ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-black ${cfg.color}`}>{cfg.label}</span>
                          <span className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white/80' : 'text-black/70'}`}>{invNum}</span>
                          {clientName && <span className={`text-[10px] truncate ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>• {clientName}</span>}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                          {formatTime(log.created_at)}
                        </span>
                      </div>
                      {/* Detail chips for status changes */}
                      {log.details?.old_status && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.details.old_status === 'paid' ? 'bg-status-success/20 text-status-success' : 'bg-status-warning/20 text-status-warning'}`}>
                            {log.details.old_status}
                          </span>
                          <span className="text-[10px] text-neutral-medium">→</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.details.new_status === 'paid' ? 'bg-status-success/20 text-status-success' : 'bg-status-warning/20 text-status-warning'}`}>
                            {log.details.new_status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
