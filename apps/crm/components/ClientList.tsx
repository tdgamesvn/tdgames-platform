import React, { useState } from 'react';
import { CrmClient, AccountUser } from '@/types';
import { Button } from '@/components/Button';

interface Props {
  clients: CrmClient[];
  isLoading: boolean;
  searchQuery: string; setSearchQuery: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterIndustry: string; setFilterIndustry: (v: string) => void;
  industries: string[];
  statusCounts: Record<string, number>;
  totalClients: number;
  onEdit: (client: CrmClient) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  currentUser?: AccountUser;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  lead:        { label: 'Tiềm năng', color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', icon: '⭐' },
  contacted:   { label: 'Đã liên hệ', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)', icon: '📨' },
  no_response: { label: 'Chưa phản hồi', color: '#FF9500', bg: 'rgba(255,149,0,0.12)', icon: '⏳' },
  responding:  { label: 'Đang trao đổi', color: '#64D2FF', bg: 'rgba(100,210,255,0.12)', icon: '💬' },
  negotiating: { label: 'Đang đàm phán', color: '#BF5AF2', bg: 'rgba(191,90,242,0.12)', icon: '🤝' },
  contracting: { label: 'Đang ký HĐ', color: '#FF375F', bg: 'rgba(255,55,95,0.12)', icon: '📝' },
  active:      { label: 'Đang hợp tác', color: '#34C759', bg: 'rgba(52,199,89,0.12)', icon: '✅' },
  paused:      { label: 'Tạm dừng', color: '#888', bg: 'rgba(136,136,136,0.12)', icon: '⏸️' },
  completed:   { label: 'Hoàn thành', color: '#30D158', bg: 'rgba(48,209,88,0.12)', icon: '🏁' },
  lost:        { label: 'Mất khách', color: '#FF453A', bg: 'rgba(255,69,58,0.12)', icon: '❌' },
};

const ClientList: React.FC<Props> = ({
  clients, isLoading, searchQuery, setSearchQuery, filterStatus, setFilterStatus,
  filterIndustry, setFilterIndustry, industries, statusCounts, totalClients,
  onEdit, onDelete, onRefresh, onAdd, currentUser,
}) => {
  const canDelete = currentUser?.role !== 'bd';
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            Khách hàng
          </h2>
          <p className="text-sm text-neutral-medium mt-1">Quản lý thông tin khách hàng tập trung</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={onAdd} variant="primary" size="sm">＋ Thêm khách hàng</Button>
          <Button onClick={onRefresh} variant="ghost" size="sm" disabled={isLoading}>
            {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats Cards — dynamic from actual data */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(statusCounts).length + 1, 6)}, 1fr)`, gap: '12px' }}>
        <div className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Tổng khách hàng</p>
          <p className="text-2xl font-black" style={{ color: '#FF9500' }}>{totalClients}</p>
        </div>
        {Object.entries(STATUS_CONFIG).filter(([k]) => (statusCounts[k] || 0) > 0).map(([key, cfg]) => (
          <div key={key} className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1 cursor-pointer transition-all"
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '')}>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{cfg.icon} {cfg.label}</p>
            <p className="text-2xl font-black text-white">{statusCounts[key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a', flex: 1, minWidth: '250px' }}
          placeholder="🔍 Tìm theo tên, email, liên hệ, SĐT..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
          style={{ background: '#1a1a1a', minWidth: '150px', width: 'auto' }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
          style={{ background: '#1a1a1a', minWidth: '150px', width: 'auto' }}
          value={filterIndustry}
          onChange={e => setFilterIndustry(e.target.value)}>
          <option value="">Tất cả ngành</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Client Cards */}
      {clients.length === 0 && !isLoading && (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-neutral-600 text-sm">Chưa có khách hàng nào</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {clients.map(client => {
          const sc = STATUS_CONFIG[client.status] || STATUS_CONFIG.active;
          return (
            <div key={client.id}
              className="flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface"
              style={{ cursor: 'pointer' }}
              onClick={() => onEdit(client)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF9500'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
            >
              {/* Left: Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>{client.name}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                    background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{sc.label}</span>
                  {client.client_type === 'individual' && (
                    <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>👤 Cá nhân</span>
                  )}
                  {(client.contacts?.length || 0) > 0 && (
                    <span style={{ fontSize: '11px', color: '#0A84FF', fontWeight: 600 }}>
                      👥 {client.contacts!.length} liên hệ
                    </span>
                  )}
                  {client.assigned_bd_name && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                      background: 'rgba(175,82,222,0.12)', color: '#AF52DE' }}>
                      BD: {client.assigned_bd_name}
                    </span>
                  )}
                </div>
                {/* Show contacts */}
                {client.contacts && client.contacts.length > 0 ? (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888', flexWrap: 'wrap' }}>
                    {client.contacts.slice(0, 3).map(ct => (
                      <span key={ct.id} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: ct.is_primary ? '#0A84FF' : '#666' }}>👤</span>
                        <span>{ct.name}</span>
                        {ct.role && <span style={{ color: '#555' }}>({ct.role})</span>}
                        {ct.email && <span>· {ct.email}</span>}
                      </span>
                    ))}
                    {client.contacts.length > 3 && (
                      <span style={{ color: '#555' }}>+{client.contacts.length - 3} khác</span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#888', flexWrap: 'wrap' }}>
                    {client.country && <span>🌍 {client.country}</span>}
                    {client.industry && <span>🏭 {client.industry}</span>}
                  </div>
                )}
                {client.tags && client.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {client.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                        background: 'rgba(255,149,0,0.1)', color: '#FF9500', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onEdit(client)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                >✏️ Sửa</button>
                {canDelete && (deleteConfirm === client.id ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => { onDelete(client.id); setDeleteConfirm(null); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >Xác nhận</button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                    >Huỷ</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(client.id)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
                  >🗑️</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientList;
