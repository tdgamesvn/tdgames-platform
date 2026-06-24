import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CrmStudio, StudioLead, StudioStats, StudioFilters,
  fetchStudios, fetchStudioStats, fetchLeadsByStudio,
  updateStudioBdStatus, STUDIO_PAGE_SIZE,
} from '../services/studioService';

// ── Color maps ─────────────────────────────────────────────────────────────
const BD_STATUS_COLOR: Record<string, string> = {
  uncontacted: '#9D9C9D',
  outreached:  '#2196F3',
  responding:  '#34C759',
  proposal:    '#FF9500',
  client:      '#AF52DE',
};
const BD_STATUS_LABEL: Record<string, string> = {
  uncontacted: 'Chưa contact',
  outreached:  'Đã gửi mail',
  responding:  'Đang reply',
  proposal:    'Đề xuất',
  client:      'Khách hàng',
};
const SOURCE_COLOR: Record<string, string> = {
  hiring:     '#FF375F',
  discovered: '#0A84FF',
  both:       '#FF9500',
};
const SOURCE_LABEL: Record<string, string> = {
  hiring:     'Hiring',
  discovered: 'Apollo',
  both:       'Cả hai',
};
const OUTREACH_STATUS_COLOR: Record<string, string> = {
  pending:          '#9D9C9D',
  initial_sent:     '#2196F3',
  followup1_sent:   '#FF9500',
  followup2_sent:   '#FFA726',
  replied:          '#34C759',
  unsubscribed:     '#F44336',
  bounced:          '#F44336',
};

// ── Studio Detail Drawer (Portal) ──────────────────────────────────────────
const StudioDrawer: React.FC<{
  studio: CrmStudio;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}> = ({ studio, onClose, onStatusChange }) => {
  const [leads, setLeads] = useState<StudioLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [localStatus, setLocalStatus] = useState(studio.bd_status);

  useEffect(() => {
    fetchLeadsByStudio(studio.id)
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [studio.id]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await onStatusChange(studio.id, newStatus);
      setLocalStatus(newStatus as CrmStudio['bd_status']);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const color = BD_STATUS_COLOR[localStatus] ?? '#9D9C9D';

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 flex flex-col overflow-hidden"
        style={{
          width: '460px', height: '100%',
          background: '#1A1A1A',
          borderLeft: '1px solid rgba(255,149,0,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/5">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              className="text-base font-black uppercase tracking-wider text-white truncate"
              title={studio.studio_name}
            >
              {studio.studio_name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {studio.country && (
                <span className="text-xs text-neutral-medium">📍 {studio.country}</span>
              )}
              {studio.domain && (
                <a
                  href={`https://${studio.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-400 hover:underline"
                >
                  🔗 {studio.domain}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-neutral-medium hover:text-white transition-all text-lg leading-none"
          >✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Badges + BD status selector */}
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
              style={{ background: `${SOURCE_COLOR[studio.source]}20`, color: SOURCE_COLOR[studio.source] }}
            >
              {SOURCE_LABEL[studio.source]}
            </span>
            <span className="text-[10px] text-neutral-medium font-semibold">
              {studio.contacts_found} contact{studio.contacts_found !== 1 ? 's' : ''}
            </span>
          </div>

          {/* BD Status selector */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">
              BD Status
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BD_STATUS_LABEL).map(([key, label]) => {
                const c = BD_STATUS_COLOR[key];
                const active = localStatus === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    disabled={updatingStatus}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                    style={active
                      ? { background: `${c}25`, color: c, border: `1px solid ${c}50` }
                      : { background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Careers link */}
          {studio.careers_link && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">
                Tuyển dụng
              </p>
              <a
                href={studio.careers_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-400 hover:underline break-all"
              >
                {studio.careers_link}
              </a>
            </div>
          )}

          {/* Leads */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-3">
              Contacts ({leads.length})
            </p>
            {loading ? (
              <p className="text-xs text-neutral-medium animate-td-pulse">Đang tải...</p>
            ) : leads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-xs text-neutral-medium">Chưa có contact nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map(lead => {
                  const sc = OUTREACH_STATUS_COLOR[lead.outreach_status] ?? '#9D9C9D';
                  return (
                    <div
                      key={lead.id}
                      className="rounded-[20px] border border-primary/10 bg-surface p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div style={{ minWidth: 0 }}>
                          <p className="text-sm font-semibold text-white truncate">
                            {lead.contact_name || '—'}
                          </p>
                          <p className="text-xs text-neutral-medium truncate">{lead.email}</p>
                          {lead.job_title && (
                            <p className="text-[10px] text-neutral-600 mt-0.5">{lead.job_title}</p>
                          )}
                        </div>
                        <span
                          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0"
                          style={{ background: `${sc}20`, color: sc }}
                        >
                          {lead.outreach_status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {lead.initial_sent_at && (
                        <p className="text-[10px] text-neutral-600 mt-1.5">
                          Sent {new Date(lead.initial_sent_at).toLocaleDateString('vi-VN')}
                          {lead.replied_at && ` · Replied ${new Date(lead.replied_at).toLocaleDateString('vi-VN')}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Main StudiosTab ─────────────────────────────────────────────────────────
const StudiosTab: React.FC = () => {
  const [studios, setStudios]       = useState<CrmStudio[]>([]);
  const [total, setTotal]           = useState(0);
  const [stats, setStats]           = useState<StudioStats | null>(null);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState<StudioFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected]     = useState<CrmStudio | null>(null);
  const searchTimeout               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / STUDIO_PAGE_SIZE);

  const load = useCallback(async (p: number, f: StudioFilters) => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        fetchStudios(p, f),
        p === 0 ? fetchStudioStats() : Promise.resolve(null),
      ]);
      setStudios(res.studios);
      setTotal(res.total);
      if (s) setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + stats
  useEffect(() => { load(0, {}); }, [load]);

  const applyFilters = (newFilters: StudioFilters) => {
    setFilters(newFilters);
    setPage(0);
    load(0, newFilters);
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const f = { ...filters, search: val };
      applyFilters(f);
    }, 350);
  };

  const handleFilterChange = (key: keyof StudioFilters, val: string) => {
    const f = { ...filters, search: searchInput, [key]: val || undefined };
    applyFilters(f);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    load(p, { ...filters, search: searchInput || undefined });
  };

  const handleStatusChange = async (id: number, bd_status: string) => {
    await updateStudioBdStatus(id, bd_status);
    setStudios(prev => prev.map(s => s.id === id ? { ...s, bd_status: bd_status as CrmStudio['bd_status'] } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, bd_status: bd_status as CrmStudio['bd_status'] } : prev);
    // Refresh stats
    fetchStudioStats().then(s => { if (s) setStats(s); });
  };

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
          Game Studios
        </h2>
        <p className="text-sm text-neutral-medium mt-1">
          Danh sách {stats?.total ?? '…'} studios — BD pipeline tracking
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Tổng',       value: stats.total,       color: '#F2F2F2' },
            { label: 'Chưa contact', value: stats.uncontacted, color: BD_STATUS_COLOR.uncontacted },
            { label: 'Đã gửi mail',  value: stats.outreached,  color: BD_STATUS_COLOR.outreached },
            { label: 'Đang reply',   value: stats.responding,  color: BD_STATUS_COLOR.responding },
            { label: 'Đề xuất',      value: stats.proposal,    color: BD_STATUS_COLOR.proposal },
            { label: 'Khách hàng',   value: stats.client,      color: BD_STATUS_COLOR.client },
          ].map(item => (
            <div key={item.label} className="rounded-[20px] border border-primary/10 p-4 bg-surface space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{item.label}</p>
              <p className="text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Tìm studio..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a', width: '220px' }}
        />
        <select
          value={filters.source ?? ''}
          onChange={e => handleFilterChange('source', e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a' }}
        >
          <option value="">Tất cả nguồn</option>
          <option value="hiring">Hiring signal</option>
          <option value="discovered">Apollo</option>
          <option value="both">Cả hai</option>
        </select>
        <select
          value={filters.bd_status ?? ''}
          onChange={e => handleFilterChange('bd_status', e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a' }}
        >
          <option value="">Tất cả BD status</option>
          {Object.entries(BD_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(filters.source || filters.bd_status || searchInput) && (
          <button
            onClick={() => {
              setSearchInput('');
              applyFilters({});
            }}
            className="px-3 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
          >
            Xoá filter
          </button>
        )}
        <span className="text-xs text-neutral-medium ml-auto">
          {total} kết quả
        </span>
      </div>

      {/* Table */}
      <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <p className="text-xs text-neutral-medium animate-td-pulse">Đang tải studios...</p>
          </div>
        ) : studios.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🎮</p>
            <p className="text-neutral-600 text-sm">Không tìm thấy studio nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600">Studio</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 hidden md:table-cell">Quốc gia</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 hidden lg:table-cell">Domain</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600">Nguồn</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600">BD Status</th>
                <th className="text-right px-5 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 hidden sm:table-cell">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {studios.map(studio => {
                const sc = SOURCE_COLOR[studio.source];
                const bc = BD_STATUS_COLOR[studio.bd_status];
                const isActive = selected?.id === studio.id;
                return (
                  <tr
                    key={studio.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    style={isActive ? { background: 'rgba(255,255,255,0.04)' } : {}}
                    onClick={() => setSelected(isActive ? null : studio)}
                  >
                    {/* Name */}
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-white truncate" style={{ maxWidth: '220px' }}>
                        {studio.studio_name}
                      </p>
                    </td>
                    {/* Country */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-neutral-medium">
                        {studio.country ?? '—'}
                      </span>
                    </td>
                    {/* Domain */}
                    <td className="px-4 py-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                      {studio.domain ? (
                        <a
                          href={`https://${studio.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:underline"
                        >
                          {studio.domain}
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${sc}20`, color: sc }}
                      >
                        {SOURCE_LABEL[studio.source]}
                      </span>
                    </td>
                    {/* BD Status */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${bc}20`, color: bc }}
                      >
                        {BD_STATUS_LABEL[studio.bd_status]}
                      </span>
                    </td>
                    {/* Contacts */}
                    <td className="px-5 py-3 text-right hidden sm:table-cell">
                      <span className="text-sm font-semibold text-white">{studio.contacts_found}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-medium">
            Trang {page + 1} / {totalPages} · {total} studios
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
            >← Trước</button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
            >Sau →</button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <StudioDrawer
          studio={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default StudiosTab;
