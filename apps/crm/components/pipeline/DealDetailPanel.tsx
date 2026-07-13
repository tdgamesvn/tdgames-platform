import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { AccountUser, CrmDeal, CrmDealStage, CrmActivity, CrmDocument, CrmQuotation, CrmQuotationItem } from '@/types';
import { STAGES, STAGE_MAP, fmtValue, fmtDate } from './constants';
import StageBadge from './StageBadge';
import { fetchActivities, createActivity, fetchDocuments, fetchQuotations, createQuotation, updateQuotation, deleteQuotation } from '../../services/crmService';

// ── Types ─────────────────────────────────────────────────────
type DetailTab = 'overview' | 'activity' | 'documents' | 'quotations';

interface Props {
  deal: CrmDeal;
  currentUser: AccountUser;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onStageChange: (id: string, stage: CrmDealStage) => void;
  onUpdateField: (id: string, field: string, value: any) => Promise<void>;
}

// ── Activity & Document type metadata ─────────────────────────
const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  call:          { icon: '📞', label: 'Gọi điện',    color: '#34C759' },
  email:         { icon: '📧', label: 'Email',       color: '#0A84FF' },
  meeting:       { icon: '🤝', label: 'Meeting',     color: '#FF9500' },
  note:          { icon: '📝', label: 'Ghi chú',     color: '#AF52DE' },
  status_change: { icon: '🔄', label: 'Đổi trạng thái', color: '#FF3B30' },
};

const DOC_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  contract: { label: 'Hợp đồng', icon: '📋', color: '#34C759' },
  nda:      { label: 'NDA',      icon: '🔒', color: '#FF9500' },
  invoice:  { label: 'Invoice',  icon: '🧾', color: '#0A84FF' },
  proposal: { label: 'Proposal', icon: '📝', color: '#AF52DE' },
  other:    { label: 'Khác',     icon: '📎', color: '#888' },
};

// ── Tab definitions ───────────────────────────────────────────
const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'overview',    label: 'Tổng quan',  icon: '📊' },
  { key: 'activity',    label: 'Hoạt động',  icon: '📋' },
  { key: 'documents',   label: 'Tài liệu',   icon: '📁' },
  { key: 'quotations',  label: 'Báo giá',    icon: '💰' },
];

// ═══════════════════════════════════════════════════════════════
// MINI ACTIVITY LIST (embedded, read + quick-add)
// ═══════════════════════════════════════════════════════════════

const MiniActivityList: React.FC<{ clientId: string; clientName: string; currentUser: AccountUser }> = ({ clientId, clientName, currentUser }) => {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<CrmActivity['activity_type']>('note');
  const [formTitle, setFormTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setActivities(await fetchActivities(clientId, 20)); } catch { }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleQuickAdd = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      await createActivity({
        client_id: clientId,
        activity_type: formType,
        title: formTitle.trim(),
        description: '',
        outcome: '',
        activity_date: new Date().toISOString(),
        actor: currentUser.username,
      });
      setFormTitle('');
      setShowForm(false);
      await load();
    } catch { }
    finally { setSaving(false); }
  };

  const fmtTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-3">
      {/* Quick add button */}
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          Hoạt động ({activities.length})
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
        >
          + Thêm
        </button>
      </div>

      {/* Quick add form */}
      {showForm && (
        <div className="rounded-xl border border-white/10 p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex gap-2">
            <select
              value={formType}
              onChange={e => setFormType(e.target.value as any)}
              className="px-2 py-1.5 rounded-lg text-xs text-white border border-white/10 outline-none"
              style={{ background: '#1a1a1a' }}
            >
              {Object.entries(TYPE_META).filter(([k]) => k !== 'status_change').map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Tiêu đề..."
              className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
              Huỷ
            </button>
            <button onClick={handleQuickAdd} disabled={saving || !formTitle.trim()}
              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {saving ? '...' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      {/* Activity list */}
      {loading ? (
        <p className="text-xs text-neutral-600 animate-td-pulse py-4 text-center">Đang tải...</p>
      ) : activities.length === 0 ? (
        <div className="text-center py-6 text-neutral-700">
          <p className="text-2xl mb-1">📋</p>
          <p className="text-[10px] font-semibold">Chưa có hoạt động</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(act => {
            const meta = TYPE_META[act.activity_type] || TYPE_META.note;
            return (
              <div key={act.id} className="flex gap-3 items-start p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${meta.color}15` }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{act.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{ background: `${meta.color}15`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-neutral-600">{fmtTime(act.activity_date)}</span>
                  </div>
                  {act.description && (
                    <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2">{act.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MINI DOCUMENT LIST (embedded, read-only)
// ═══════════════════════════════════════════════════════════════

const MiniDocumentList: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [docs, setDocs] = useState<CrmDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDocuments(clientId)
      .then(d => setDocs(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_URL || '';
  const toPublicUrl = (url: string): string => {
    if (!url || !R2_PUBLIC_BASE) return url;
    const r2Match = url.match(/https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/(.+)/);
    if (r2Match) return `${R2_PUBLIC_BASE}/${r2Match[1]}`;
    return url;
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        Tài liệu ({docs.length})
      </p>

      {loading ? (
        <p className="text-xs text-neutral-600 animate-td-pulse py-4 text-center">Đang tải...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-neutral-700">
          <p className="text-2xl mb-1">📁</p>
          <p className="text-[10px] font-semibold">Chưa có tài liệu</p>
          <p className="text-[10px] text-neutral-700 mt-1">Vào tab Tài liệu để upload</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const meta = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;
            return (
              <a
                key={doc.id}
                href={toPublicUrl(doc.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 items-center p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${meta.color}15` }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{doc.title || doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{ background: `${meta.color}15`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-neutral-600">{fmtDate(doc.created_at)}</span>
                  </div>
                </div>
                <span className="text-neutral-600 text-xs">↗</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MINI QUOTATION LIST (embedded, create + list + status)
// ═══════════════════════════════════════════════════════════════

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Nháp',      color: '#9D9C9D' },
  sent:     { label: 'Đã gửi',    color: '#0A84FF' },
  accepted: { label: 'Chấp nhận', color: '#4CAF50' },
  rejected: { label: 'Từ chối',   color: '#F44336' },
  expired:  { label: 'Hết hạn',   color: '#FFA726' },
};

const emptyItem: CrmQuotationItem = { description: '', quantity: 1, unit: 'service', unit_price: 0 };

const MiniQuotationList: React.FC<{
  dealId: string; clientId: string; dealTitle: string; currency: 'USD' | 'VND'; dealValue: number; currentUser: AccountUser;
}> = ({ dealId, clientId, dealTitle, currency, dealValue, currentUser }) => {
  const [quotations, setQuotations] = useState<CrmQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CrmQuotationItem[]>([{ ...emptyItem }]);
  const [title, setTitle] = useState(dealTitle);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    try { setQuotations(await fetchQuotations(dealId)); } catch { }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleCreate = async () => {
    if (!items.some(i => i.description.trim())) return;
    setSaving(true);
    const validItems = items.filter(i => i.description.trim());
    const now = new Date();
    const validUntil = new Date(now.getTime() + parseInt(validDays) * 86_400_000).toISOString().split('T')[0];
    const num = `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(quotations.length + 1).padStart(3, '0')}`;
    try {
      await createQuotation({
        deal_id: dealId,
        client_id: clientId,
        quotation_number: num,
        title,
        items: validItems,
        currency,
        discount: 0,
        tax_rate: 0,
        subtotal,
        total: subtotal,
        status: 'draft',
        valid_until: validUntil,
        notes,
        created_by: currentUser.id,
      });
      setShowForm(false);
      setItems([{ ...emptyItem }]);
      setNotes('');
      await load();
    } catch { }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateQuotation(id, { status } as any);
      await load();
    } catch { }
  };

  const updateItem = (idx: number, field: keyof CrmQuotationItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const inputCls = 'px-2 py-1.5 rounded-lg text-xs text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          Báo giá ({quotations.length})
        </p>
        <button onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
          + Tạo báo giá
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-orange-500/20 p-4 space-y-3" style={{ background: 'rgba(255,149,0,0.03)' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề báo giá"
            className={`${inputCls} w-full`} style={{ background: '#1a1a1a' }} />

          {/* Line items */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1">
              <p className="col-span-5 text-[9px] font-black uppercase text-neutral-700">Mô tả</p>
              <p className="col-span-2 text-[9px] font-black uppercase text-neutral-700">SL</p>
              <p className="col-span-2 text-[9px] font-black uppercase text-neutral-700">ĐVT</p>
              <p className="col-span-3 text-[9px] font-black uppercase text-neutral-700">Đơn giá</p>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1">
                <input className={`col-span-5 ${inputCls}`} style={{ background: '#1a1a1a' }}
                  value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Dịch vụ..." />
                <input type="number" className={`col-span-2 ${inputCls}`} style={{ background: '#1a1a1a' }}
                  value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                <input className={`col-span-2 ${inputCls}`} style={{ background: '#1a1a1a' }}
                  value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                <div className="col-span-3 flex gap-1">
                  <input type="number" className={`flex-1 ${inputCls}`} style={{ background: '#1a1a1a' }}
                    value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400/50 hover:text-red-400 text-xs px-1">✕</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setItems(prev => [...prev, { ...emptyItem }])}
              className="text-[10px] text-orange-400/60 hover:text-orange-400 font-semibold transition-colors">
              + Thêm dòng
            </button>
          </div>

          {/* Subtotal */}
          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <span className="text-[10px] font-black uppercase text-neutral-600">Tổng</span>
            <span className="text-sm font-black text-white">{fmtValue(subtotal, currency)}</span>
          </div>

          {/* Valid days + notes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] font-black uppercase text-neutral-700 mb-1">Hiệu lực (ngày)</p>
              <input type="number" value={validDays} onChange={e => setValidDays(e.target.value)}
                className={`w-full ${inputCls}`} style={{ background: '#1a1a1a' }} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-neutral-700 mb-1">Ghi chú</p>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Điều khoản..."
                className={`w-full ${inputCls}`} style={{ background: '#1a1a1a' }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
              Huỷ
            </button>
            <button onClick={handleCreate} disabled={saving || !items.some(i => i.description.trim())}
              className="px-3 py-1 rounded-lg text-[10px] font-black uppercase text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {saving ? '...' : 'Tạo'}
            </button>
          </div>
        </div>
      )}

      {/* Quotation list */}
      {loading ? (
        <p className="text-xs text-neutral-600 animate-td-pulse py-4 text-center">Đang tải...</p>
      ) : quotations.length === 0 && !showForm ? (
        <div className="text-center py-6 text-neutral-700">
          <p className="text-2xl mb-1">💰</p>
          <p className="text-[10px] font-semibold">Chưa có báo giá</p>
          <p className="text-[9px] text-neutral-700 mt-1">Tạo báo giá để gửi cho khách hàng</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const sb = STATUS_BADGE[q.status] || STATUS_BADGE.draft;
            return (
              <div key={q.id} className="rounded-xl border border-white/5 p-3 hover:border-white/10 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{q.title || q.quotation_number}</p>
                    <p className="text-[10px] text-neutral-600">{q.quotation_number} • {fmtDate(q.created_at)}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                    style={{ background: `${sb.color}20`, color: sb.color }}>
                    {sb.label}
                  </span>
                </div>

                {/* Items summary */}
                <div className="space-y-0.5 mb-2">
                  {(q.items || []).slice(0, 3).map((item: CrmQuotationItem, i: number) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="text-neutral-400 truncate">{item.description}</span>
                      <span className="text-neutral-500 whitespace-nowrap ml-2">
                        {item.quantity} × {fmtValue(item.unit_price, q.currency)}
                      </span>
                    </div>
                  ))}
                  {(q.items || []).length > 3 && (
                    <p className="text-[9px] text-neutral-600">+{q.items.length - 3} dòng khác</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">{fmtValue(q.total, q.currency)}</span>
                  {/* Status change buttons */}
                  {q.status === 'draft' && (
                    <button onClick={() => handleStatusChange(q.id, 'sent')}
                      className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 transition-all">
                      Đánh dấu đã gửi
                    </button>
                  )}
                  {q.status === 'sent' && (
                    <div className="flex gap-1">
                      <button onClick={() => handleStatusChange(q.id, 'accepted')}
                        className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-green-400 border border-green-500/20 hover:bg-green-500/10 transition-all">
                        Chấp nhận
                      </button>
                      <button onClick={() => handleStatusChange(q.id, 'rejected')}
                        className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// INLINE EDIT FIELD
// ═══════════════════════════════════════════════════════════════

const InlineEditField: React.FC<{
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: 'text' | 'textarea' | 'number';
  placeholder?: string;
  suffix?: string;
}> = ({ label, value, onSave, type = 'text', placeholder = '', suffix }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch { }
    finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <div className="group cursor-pointer" onClick={() => setEditing(true)}>
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">{label}</p>
        {type === 'textarea' ? (
          <div className="rounded-xl border border-white/8 p-3 min-h-[60px] hover:border-white/15 transition-all"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {value || <span className="text-neutral-600 italic">{placeholder || 'Nhấn để thêm...'}</span>}
            </p>
          </div>
        ) : (
          <div className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 transition-all -mx-2">
            <span className="text-xs font-semibold text-white">{value}{suffix}</span>
            <span className="text-[10px] text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">{label}</p>
      {type === 'textarea' ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={4}
          autoFocus
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-xs text-white border border-orange-500/50 outline-none transition-colors resize-none"
          style={{ background: '#1a1a1a' }}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        />
      ) : (
        <input
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-xs text-white border border-orange-500/50 outline-none transition-colors"
          style={{ background: '#1a1a1a' }}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
        />
      )}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={() => { setDraft(value); setEditing(false); }}
          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
          Huỷ
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-white transition-all disabled:opacity-50"
          style={{ background: '#FF9500' }}>
          {saving ? '...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════

const DealDetailPanel: React.FC<Props> = ({ deal, currentUser, onClose, onEdit, onDelete, onStageChange, onUpdateField }) => {
  const stage = STAGE_MAP[deal.stage];
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 border-l border-white/10 overflow-y-auto flex flex-col"
        style={{ width: '480px', background: '#111' }}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 border-b border-white/8" style={{ background: '#111' }}>
          <div className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">
                  {deal.client_name}
                </p>
                <h3 className="text-base font-black text-white leading-snug">{deal.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <StageBadge stage={deal.stage} />
                  <span className="text-sm font-black text-white">{fmtValue(deal.value, deal.currency)}</span>
                </div>
              </div>
              <button onClick={onClose}
                className="text-neutral-500 hover:text-white transition-colors text-lg p-1">✕</button>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex px-5 gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-2 rounded-t-lg text-[10px] font-black uppercase tracking-wider transition-all"
                style={{
                  color: activeTab === tab.key ? '#FF9500' : '#666',
                  background: activeTab === tab.key ? 'rgba(255,149,0,0.08)' : 'transparent',
                  borderBottom: activeTab === tab.key ? '2px solid #FF9500' : '2px solid transparent',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* ════ OVERVIEW TAB ════ */}
          {activeTab === 'overview' && (
            <>
              {/* Quick Info */}
              <div className="rounded-[20px] border border-primary/10 p-4 space-y-3 bg-surface">
                {[
                  { label: 'Owner', value: deal.owner_name || '—' },
                  { label: 'Dự kiến chốt', value: fmtDate(deal.expected_close_date) },
                  ...(deal.actual_close_date ? [{ label: 'Ngày chốt thực tế', value: fmtDate(deal.actual_close_date) }] : []),
                  { label: 'Tiền tệ', value: deal.currency },
                  { label: 'Tạo lúc', value: fmtDate(deal.created_at) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{row.label}</span>
                    <span className="text-xs font-semibold text-white">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Probability — inline editable */}
              <InlineEditField
                label="Xác suất thắng"
                value={deal.probability.toString()}
                suffix="%"
                type="number"
                onSave={async (v) => { await onUpdateField(deal.id, 'probability', parseInt(v) || 0); }}
              />

              {/* Follow-up date — inline editable */}
              <div className="group cursor-pointer" onClick={() => {
                const input = document.createElement('input');
                input.type = 'date';
                input.value = deal.next_follow_up || '';
                input.onchange = () => { onUpdateField(deal.id, 'next_follow_up', input.value || null); };
                input.click();
              }}>
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1">📌 Follow-up tiếp</p>
                <div className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 transition-all -mx-2">
                  {deal.next_follow_up ? (() => {
                    const fuDays = Math.floor((new Date(deal.next_follow_up).getTime() - Date.now()) / 86_400_000);
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{fmtDate(deal.next_follow_up)}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          fuDays < 0 ? 'text-red-400 bg-red-500/10' :
                          fuDays === 0 ? 'text-orange-400 bg-orange-500/10' :
                          'text-blue-400 bg-blue-500/10'
                        }`}>
                          {fuDays < 0 ? `Quá hạn ${Math.abs(fuDays)}d` : fuDays === 0 ? 'Hôm nay' : `${fuDays}d nữa`}
                        </span>
                      </div>
                    );
                  })() : (
                    <span className="text-xs text-neutral-600 italic">Nhấn để đặt lịch...</span>
                  )}
                  <span className="text-[10px] text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                </div>
              </div>

              {/* Notes — inline editable */}
              <InlineEditField
                label="Ghi chú"
                value={deal.notes || ''}
                type="textarea"
                placeholder="Nhấn để thêm ghi chú..."
                onSave={async (v) => { await onUpdateField(deal.id, 'notes', v); }}
              />

              {/* Lost reason */}
              {deal.lost_reason && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-500/70 mb-2">Lý do mất deal</p>
                  <div className="rounded-xl border border-red-500/20 p-4" style={{ background: 'rgba(244,67,54,0.05)' }}>
                    <p className="text-xs text-red-400 whitespace-pre-wrap">{deal.lost_reason}</p>
                  </div>
                </div>
              )}

              {/* Move Stage */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2">Chuyển giai đoạn</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => onStageChange(deal.id, s.key)}
                      disabled={s.key === deal.stage}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-30"
                      style={{
                        background: s.key === deal.stage ? `${s.color}25` : 'transparent',
                        color: s.key === deal.stage ? s.color : '#666',
                        border: `1px solid ${s.key === deal.stage ? s.color + '40' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={onEdit}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
                  Chỉnh sửa
                </button>
                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button onClick={() => onDelete(deal.id)}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">
                      Xác nhận xoá
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                      Huỷ
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-500 border border-white/10 hover:text-red-400 hover:border-red-500/30 transition-all">
                    Xoá
                  </button>
                )}
              </div>
            </>
          )}

          {/* ════ ACTIVITY TAB ════ */}
          {activeTab === 'activity' && (
            <MiniActivityList clientId={deal.client_id} clientName={deal.client_name || ''} currentUser={currentUser} />
          )}

          {/* ════ DOCUMENTS TAB ════ */}
          {activeTab === 'documents' && (
            <MiniDocumentList clientId={deal.client_id} />
          )}

          {/* ════ QUOTATIONS TAB ════ */}
          {activeTab === 'quotations' && (
            <MiniQuotationList dealId={deal.id} clientId={deal.client_id} dealTitle={deal.title} currency={deal.currency} dealValue={deal.value} currentUser={currentUser} />
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default DealDetailPanel;
