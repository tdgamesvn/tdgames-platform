import React, { useState, useEffect } from 'react';
import { CrmClient, CrmContact, AccountUser } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { hasAnyRole } from '@/utils/roleUtils';
import ActivityTimeline from './ActivityTimeline';

interface BdUser {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  editingClient: CrmClient | null;
  onSave: (data: Omit<CrmClient, 'id' | 'created_at' | 'updated_at' | 'contacts'>) => Promise<CrmClient | null>;
  onUpdate: (id: string, data: Partial<CrmClient>) => void;
  onCancel: () => void;
  onCreateContact: (contact: Omit<CrmContact, 'id' | 'created_at'>) => void;
  onUpdateContact: (id: string, updates: Partial<CrmContact>) => void;
  onDeleteContact: (id: string) => void;
  actor?: string;
}

const INDUSTRIES = [
  'Game Development', 'Animation', 'Film & Media', 'Software', 'E-commerce',
  'Education', 'Healthcare', 'Finance', 'Entertainment', 'Consulting', 'Other'
];

const emptyContact = { name: '', role: '', email: '', phone: '', is_primary: false, notes: '' };

const ClientForm: React.FC<Props> = ({ editingClient, onSave, onUpdate, onCancel, onCreateContact, onUpdateContact, onDeleteContact, actor = '' }) => {
  const [form, setForm] = useState({
    name: '',
    client_type: 'company' as 'company' | 'individual',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    tax_code: '',
    website: '',
    industry: '',
    status: 'lead' as CrmClient['status'],
    lead_source: '',
    lead_direction: '',
    lead_source_detail: '',
    notes: '',
    tags: [] as string[],
    assigned_bd_id: null as string | null,
    assigned_bd_name: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [newContact, setNewContact] = useState({ ...emptyContact });
  const [showNewContact, setShowNewContact] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editContactData, setEditContactData] = useState({ ...emptyContact });
  const [bdUsers, setBdUsers] = useState<BdUser[]>([]);

  // Fetch BD users once on mount (same pattern as StudiosTab).
  // Lọc client-side qua hasAnyRole vì role 'bd' có thể là secondary_roles (VD: admin kiêm bd).
  useEffect(() => {
    supabase
      .from('account_users')
      .select('id, full_name, role, secondary_roles')
      .then(({ data }) => {
        if (data) setBdUsers((data as unknown as AccountUser[]).filter(u => hasAnyRole(u, ['bd'])) as unknown as BdUser[]);
      });
  }, []);

  useEffect(() => {
    if (editingClient) {
      setForm({
        name: editingClient.name || '',
        client_type: editingClient.client_type || 'company',
        contact_person: editingClient.contact_person || '',
        email: editingClient.email || '',
        phone: editingClient.phone || '',
        address: editingClient.address || '',
        country: editingClient.country || '',
        tax_code: editingClient.tax_code || '',
        website: editingClient.website || '',
        industry: editingClient.industry || '',
        status: editingClient.status || 'active',
        lead_source: editingClient.lead_source || '',
        lead_direction: editingClient.lead_direction || '',
        lead_source_detail: editingClient.lead_source_detail || '',
        notes: editingClient.notes || '',
        tags: editingClient.tags || [],
        assigned_bd_id: editingClient.assigned_bd_id || null,
        assigned_bd_name: editingClient.assigned_bd_name || '',
      });
    }
  }, [editingClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingClient) {
      onUpdate(editingClient.id, form);
    } else {
      await onSave(form);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const handleAddContact = () => {
    if (!editingClient || !newContact.name.trim()) return;
    onCreateContact({ ...newContact, client_id: editingClient.id });
    setNewContact({ ...emptyContact });
    setShowNewContact(false);
  };

  const handleSaveEditContact = () => {
    if (!editContactId) return;
    onUpdateContact(editContactId, editContactData);
    setEditContactId(null);
  };

  const contacts = editingClient?.contacts || [];

  return (
    <div className="animate-fadeInUp">
      <div style={{ marginBottom: '32px' }}>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
          {editingClient ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
        </h2>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
          {editingClient ? 'Cập nhật thông tin khách hàng' : 'Nhập thông tin khách hàng mới'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-[20px] border border-primary/10 bg-surface p-5">
        {/* Row 1: Name + Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tên khách hàng *</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ví dụ: KABAM GAMES, INC" required />
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Loại khách hàng</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={form.client_type} onChange={e => setForm({ ...form, client_type: e.target.value as any })}>
              <option value="company">Công ty</option>
              <option value="individual">Cá nhân</option>
            </select>
          </div>
        </div>

        {/* Row 2: Address */}
        <div style={{ marginBottom: '20px' }}>
          <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Địa chỉ</label>
          <input
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
            style={{ background: '#1a1a1a' }}
            value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Địa chỉ đầy đủ..." />
        </div>

        {/* Row 3: Country + TaxCode + Industry */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Quốc gia</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
              placeholder="Vietnam, USA..." />
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Mã số thuế</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.tax_code} onChange={e => setForm({ ...form, tax_code: e.target.value })}
              placeholder="Tax ID..." />
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ngành nghề</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
              <option value="">-- Chọn ngành --</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* Row 4: Website + Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Website</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="https://..." />
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Trạng thái</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
              <optgroup label="Giai đoạn tiếp cận">
                <option value="lead">⭐ Tiềm năng</option>
                <option value="contacted">📨 Đã liên hệ</option>
                <option value="no_response">⏳ Chưa phản hồi</option>
                <option value="responding">💬 Đang trao đổi</option>
              </optgroup>
              <optgroup label="Giai đoạn đàm phán">
                <option value="negotiating">🤝 Đang đàm phán</option>
                <option value="contracting">📝 Đang ký HĐ</option>
              </optgroup>
              <optgroup label="Trạng thái hợp tác">
                <option value="active">✅ Đang hợp tác</option>
                <option value="paused">⏸️ Tạm dừng</option>
                <option value="completed">🏁 Hoàn thành</option>
                <option value="lost">❌ Mất khách</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">BD phụ trách</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.assigned_bd_id || ''}
              onChange={e => {
                const bd = bdUsers.find(u => u.id === e.target.value);
                setForm({ ...form, assigned_bd_id: bd?.id || null, assigned_bd_name: bd?.full_name || '' });
              }}>
              <option value="">-- Chưa gán --</option>
              {bdUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lead Source */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Nguồn khách hàng</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })}>
              <option value="">-- Chọn nguồn --</option>
              <option value="Facebook">Facebook</option>
              <option value="Behance">Behance</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="ArtStation">ArtStation</option>
              <option value="Website">Website</option>
              <option value="Email">Email</option>
              <option value="Referral">Giới thiệu</option>
              <option value="Event">Sự kiện</option>
              <option value="Other">Khác</option>
            </select>
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Hướng tiếp cận</label>
            <select
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={form.lead_direction} onChange={e => setForm({ ...form, lead_direction: e.target.value })}>
              <option value="">-- Chọn --</option>
              <option value="inbound">📥 Khách tìm mình</option>
              <option value="outbound">📤 Mình tìm khách</option>
            </select>
          </div>
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Chi tiết nguồn</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.lead_source_detail} onChange={e => setForm({ ...form, lead_source_detail: e.target.value })}
              placeholder="Link profile, người giới thiệu..." />
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '20px' }}>
          <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tags</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {form.tags.map(tag => (
              <span key={tag} style={{
                background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: '6px',
                padding: '4px 10px', fontSize: '12px', color: '#FF9500', cursor: 'pointer',
              }} onClick={() => removeTag(tag)}>
                {tag} ×
              </span>
            ))}
            <input
              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: '#1a1a1a' }}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Nhập tag + Enter" />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '28px' }}>
          <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ghi chú</label>
          <textarea
            className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
            style={{ background: '#1a1a1a', minHeight: '80px' }}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú thêm..." />
        </div>

        {/* Save/Cancel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            Huỷ
          </button>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}>
            {editingClient ? '✏️ Cập nhật' : '＋ Thêm khách hàng'}
          </button>
        </div>
      </form>

      {/* ── Contacts Section (only when editing) ─────────────── */}
      {editingClient && (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-5" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                👥 Người liên hệ ({contacts.length})
              </h3>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Quản lý liên hệ của khách hàng</p>
            </div>
            <button onClick={() => setShowNewContact(!showNewContact)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
              ＋ Thêm liên hệ
            </button>
          </div>

          {/* New contact form */}
          {showNewContact && (
            <div className="rounded-[20px] border border-primary/10 p-6 bg-surface mb-4">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tên *</label>
                  <input
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }}
                    value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                    placeholder="Tên người liên hệ" />
                </div>
                <div>
                  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Chức vụ</label>
                  <input
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }}
                    value={newContact.role} onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                    placeholder="CEO, PM, AP..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Email</label>
                  <input
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }}
                    type="email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="email@company.com" />
                </div>
                <div>
                  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Số điện thoại</label>
                  <input
                    className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                    style={{ background: '#1a1a1a' }}
                    value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="+84..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ccc', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newContact.is_primary} onChange={e => setNewContact({ ...newContact, is_primary: e.target.checked })} />
                  Liên hệ chính
                </label>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => setShowNewContact(false)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
                  Huỷ
                </button>
                <button type="button" onClick={handleAddContact} disabled={!newContact.name.trim()}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                  Lưu liên hệ
                </button>
              </div>
            </div>
          )}

          {/* Contacts list */}
          {contacts.length === 0 && !showNewContact && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#555', fontSize: '13px' }}>
              Chưa có người liên hệ. Bấm "Thêm liên hệ" để bắt đầu.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {contacts.map(ct => (
              <div key={ct.id} style={{
                background: '#1A1A1A', border: '1px solid #333', borderRadius: '10px', padding: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {editContactId === ct.id ? (
                  /* Inline edit mode */
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }}
                        value={editContactData.name}
                        onChange={e => setEditContactData({ ...editContactData, name: e.target.value })} placeholder="Tên" />
                      <input
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }}
                        value={editContactData.role}
                        onChange={e => setEditContactData({ ...editContactData, role: e.target.value })} placeholder="Chức vụ" />
                      <input
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }}
                        value={editContactData.email}
                        onChange={e => setEditContactData({ ...editContactData, email: e.target.value })} placeholder="Email" />
                      <input
                        className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                        style={{ background: '#1a1a1a' }}
                        value={editContactData.phone}
                        onChange={e => setEditContactData({ ...editContactData, phone: e.target.value })} placeholder="SĐT" />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ccc', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editContactData.is_primary}
                          onChange={e => setEditContactData({ ...editContactData, is_primary: e.target.checked })} />
                        Liên hệ chính
                      </label>
                      <div style={{ flex: 1 }} />
                      <button type="button" onClick={() => setEditContactId(null)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
                        Huỷ
                      </button>
                      <button type="button" onClick={handleSaveEditContact}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5' }}>{ct.name}</span>
                        {ct.role && <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>• {ct.role}</span>}
                        {ct.is_primary && (
                          <span style={{
                            fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                            background: 'rgba(10,132,255,0.15)', color: '#0A84FF', textTransform: 'uppercase',
                          }}>Chính</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#888' }}>
                        {ct.email && <span>📧 {ct.email}</span>}
                        {ct.phone && <span>📱 {ct.phone}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => {
                        setEditContactId(ct.id);
                        setEditContactData({ name: ct.name, role: ct.role, email: ct.email, phone: ct.phone, is_primary: ct.is_primary, notes: ct.notes });
                      }} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✏️</button>
                      <button type="button" onClick={() => onDeleteContact(ct.id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity Timeline (only when editing) ──────────── */}
      {editingClient && (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-5" style={{ marginTop: '24px' }}>
          <ActivityTimeline clientId={editingClient.id} clientName={editingClient.name} actor={actor} />
        </div>
      )}
    </div>
  );
};

export default ClientForm;
