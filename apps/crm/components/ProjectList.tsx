import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { CrmClient, CrmProject, CrmProjectFile, CrmDocument, AccountUser } from '@/types';
import * as svc from '../services/crmService';
import type { InvoiceRecord } from '../services/crmService';
import PaymentScheduleSection from './PaymentScheduleSection';

const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;
const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_URL || '';
const MAX_SIZE_MB = 20;
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip,.rar,.7z,.fig,.sketch,.psd,.ai';

// Convert S3 API URL to public R2 URL for preview/download
const toPublicUrl = (url: string): string => {
  if (!url || !R2_PUBLIC_BASE) return url;
  const r2Match = url.match(/https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/(.+)/);
  if (r2Match) return `${R2_PUBLIC_BASE}/${r2Match[1]}`;
  return url;
};

interface Props {
  clients: CrmClient[];
  currentUser?: AccountUser;
}

const PROJECT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Đang chạy', color: '#34C759', bg: 'rgba(52,199,89,0.12)' },
  completed: { label: 'Hoàn thành', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' },
  paused:    { label: 'Tạm dừng', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  cancelled: { label: 'Đã huỷ', color: '#FF453A', bg: 'rgba(255,69,58,0.12)' },
};


const isPreviewable = (url: string) => /\.(jpg|jpeg|png|webp|gif|pdf|svg)/i.test(url);
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)/i.test(url);

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ProjectList: React.FC<Props> = ({ clients, currentUser }) => {
  const canDelete = currentUser?.role !== 'bd';
  const [projects, setProjects] = useState<CrmProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<CrmProject | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newFileForm, setNewFileForm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteFileConfirmId, setDeleteFileConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Billing panel: invoices linked per project ──
  const [billingMap, setBillingMap] = useState<Record<string, InvoiceRecord[]>>({});
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  const loadBilling = async (projectId: string) => {
    if (billingMap[projectId] !== undefined) return; // already loaded
    setBillingLoading(projectId);
    try {
      const invs = await svc.fetchInvoicesByProject(projectId);
      setBillingMap(prev => ({ ...prev, [projectId]: invs }));
    } catch { setBillingMap(prev => ({ ...prev, [projectId]: [] })); }
    finally { setBillingLoading(null); }
  };

  // ── CRM Documents linked per project ──
  const [docsMap, setDocsMap] = useState<Record<string, CrmDocument[]>>({});

  const loadProjectDocs = async (projectId: string) => {
    if (docsMap[projectId] !== undefined) return; // already loaded
    try {
      const docs = await svc.fetchDocumentsByProject(projectId);
      setDocsMap(prev => ({ ...prev, [projectId]: docs }));
    } catch { setDocsMap(prev => ({ ...prev, [projectId]: [] })); }
  };

  const emptyForm = {
    client_id: '', name: '', description: '', status: 'active', start_date: '', end_date: '',
    budget: 0, currency: 'USD', notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [fileForm, setFileForm] = useState({ title: '', file_url: '', file_type: 'link' as 'link' | 'document' | 'image' | 'other', file_name: '', file_size: 0, notes: '' });

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await svc.fetchProjects(filterClient || undefined);
      setProjects(data);
    } catch { } finally { setIsLoading(false); }
  };
  useEffect(() => { load(); }, [filterClient]);

  // ── Upload file ──
  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File quá lớn! Tối đa ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(R2_UPLOAD_URL, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let ftype: 'document' | 'image' | 'link' | 'other' = 'other';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) ftype = 'document';
      else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) ftype = 'image';
      setFileForm(prev => ({
        ...prev, file_url: data.url, file_name: file.name, file_size: file.size, file_type: ftype,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
    } catch (err: any) {
      alert('Upload thất bại: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  // Drag & Drop
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, []);

  const handleSave = async () => {
    if (!form.client_id || !form.name.trim()) return;
    try {
      if (editingProject) {
        await svc.updateProject(editingProject.id, form as any);
      } else {
        await svc.createProject(form as any);
      }
      setShowForm(false);
      setEditingProject(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      alert('Lưu thất bại: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleEditProject = (proj: CrmProject) => {
    setEditingProject(proj);
    setForm({
      client_id: proj.client_id,
      name: proj.name,
      description: proj.description || '',
      status: proj.status,
      start_date: proj.start_date || '',
      end_date: proj.end_date || '',
      budget: proj.budget || 0,
      currency: proj.currency || 'USD',
      notes: proj.notes || '',
    });
    setShowForm(true);
  };

  const handleStatusChange = async (projId: string, newStatus: string) => {
    try {
      await svc.updateProject(projId, { status: newStatus } as any);
      load();
    } catch (err: any) {
      alert('Cập nhật trạng thái thất bại: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleAddFile = async (projectId: string) => {
    if (!fileForm.title.trim() || !fileForm.file_url.trim()) return;
    try {
      await svc.createProjectFile({ ...fileForm, project_id: projectId });
      setNewFileForm(null);
      setFileForm({ title: '', file_url: '', file_type: 'link', file_name: '', file_size: 0, notes: '' });
      load();
    } catch { }
  };

  const handleDeleteFile = async (id: string) => {
    setDeleting(true);
    try {
      await svc.deleteProjectFile(id);
      setDeleteFileConfirmId(null);
      load();
    } catch (err: any) {
      console.error('[CRM] Delete file error:', err);
      alert('Xoá thất bại: ' + (err?.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setDeleting(true);
    try {
      await svc.deleteProject(id);
      setDeleteConfirmId(null);
      load();
    } catch (err: any) {
      console.error('[CRM] Delete project error:', err);
      alert('Xoá thất bại: ' + (err?.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (url: string, _filename: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filtered = projects.filter(p => !filterStatus || p.status === filterStatus);
  const clientName = (id: string) => clients.find(c => c.id === id)?.name || '—';

  return (
    <div className="animate-fadeInUp">
      {/* ── Preview Modal (Portal to body) ── */}
      {previewUrl && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999,
          background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }} onClick={() => setPreviewUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
            background: '#111', borderBottom: '1px solid #333',
            height: '50px', minHeight: '50px', maxHeight: '50px', flexShrink: 0,
          }}>
            <span style={{ color: '#F5F5F5', fontSize: '14px', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewTitle}</span>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#0A84FF',
              color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
            }}>🔗 Mở tab mới</a>
            <button onClick={(e) => { e.stopPropagation(); handleDownload(previewUrl!, previewTitle); }} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#34C759',
              color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>⬇️ Download</button>
            <button onClick={() => setPreviewUrl(null)} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#FF453A',
              color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>✕ Đóng</button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', height: 'calc(100vh - 50px)', overflow: 'hidden',
          }}>
            {isImageUrl(previewUrl) ? (
              <img src={previewUrl} alt={previewTitle} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
            ) : (
              <iframe src={previewUrl} title={previewTitle} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            )}
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Dự án</h2>
          <p className="text-sm text-neutral-medium mt-1">Theo dõi dự án theo khách hàng</p>
        </div>
        <button onClick={() => { setEditingProject(null); setForm(emptyForm); setShowForm(!showForm); }}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
          style={{ background: '#FF9500' }}>＋ Thêm dự án</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select className="flex-1 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors" style={{ background: '#1a1a1a' }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors" style={{ background: '#1a1a1a', width: '180px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* New project form */}
      {showForm && (
        <div className="rounded-[20px] border border-primary/10 p-6 bg-surface" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Khách hàng *</label>
              <select className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                <option value="">-- Chọn --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tên dự án *</label>
              <input className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Project Orca..." /></div>
          </div>
          <div style={{ marginBottom: '14px' }}><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Mô tả</label>
            <textarea className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none" style={{ background: '#1a1a1a', minHeight: '60px' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ngày bắt đầu</label>
              <input type="date" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ngày kết thúc</label>
              <input type="date" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Budget</label>
              <input type="number" className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={form.budget} onChange={e => setForm({ ...form, budget: +e.target.value })} /></div>
            <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tiền tệ</label>
              <select className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors" style={{ background: '#1a1a1a' }} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option><option value="VND">VND</option>
              </select></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowForm(false); setEditingProject(null); setForm(emptyForm); }}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">Huỷ</button>
            <button type="button" onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>{editingProject ? 'Cập nhật' : 'Lưu dự án'}</button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Đang tải...</p>}

      {/* Project cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(proj => {
          const st = PROJECT_STATUS[proj.status] || PROJECT_STATUS.active;
          const isExpanded = expandedId === proj.id;
          return (
            <div key={proj.id} className="rounded-[20px] border border-primary/10 p-4 bg-surface hover:border-primary/20 transition-all" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => { const next = isExpanded ? null : proj.id; setExpandedId(next); if (next) { loadBilling(next); loadProjectDocs(next); } }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#F5F5F5' }}>{proj.name}</span>
                    {/* Inline status dropdown */}
                    <select
                      value={proj.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); handleStatusChange(proj.id, e.target.value); }}
                      style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
                        background: st.bg, color: st.color, textTransform: 'uppercase',
                        border: `1px solid ${st.color}30`, cursor: 'pointer', outline: 'none',
                        appearance: 'none', WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='${encodeURIComponent(st.color)}' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: '20px',
                      }}
                    >
                      {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                        <option key={k} value={k} style={{ background: '#1A1A1A', color: v.color }}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888' }}>
                    <span>🏢 {clientName(proj.client_id)}</span>
                    {proj.start_date && <span>📅 {proj.start_date}</span>}
                    {proj.budget > 0 && <span>💰 {proj.budget.toLocaleString()} {proj.currency}</span>}
                    <span>📎 {proj.files?.length || 0} tài liệu</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 10 }} onClick={e => e.stopPropagation()}>
                  {deleteConfirmId === proj.id ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 700 }}>Xoá?</span>
                      <button type="button" disabled={deleting}
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                        style={{ background: '#FF453A' }}>{deleting ? '...' : '✓'}</button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✕</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleEditProject(proj); }} title="Sửa"
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✏️ Sửa</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(proj.id); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">🗑️</button>
                    </>
                  )}
                  <span style={{ padding: '6px 10px', fontSize: '12px', color: '#555' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #222', padding: '20px', background: '#111' }}>
                  {proj.description && <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '16px' }}>{proj.description}</p>}

                  {/* ── Billing Progress Panel ── */}
                  {(() => {
                    const invs = billingMap[proj.id] || [];
                    const isLoadingBilling = billingLoading === proj.id;
                    const budget = proj.budget || 0;
                    const currency = proj.currency || 'USD';
                    const fmt = (n: number) => currency === 'VND'
                      ? n.toLocaleString('vi-VN') + ' ₫'
                      : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    const totalInvoiced = invs.reduce((s, inv) => s + svc.calcInvoiceTotal(inv), 0);
                    const totalPaid = invs.filter(i => i.status === 'paid').reduce((s, inv) => s + svc.calcInvoiceTotal(inv), 0);
                    const pct = budget > 0 ? Math.min(100, Math.round(totalInvoiced / budget * 100)) : 0;
                    const pctPaid = budget > 0 ? Math.min(100, Math.round(totalPaid / budget * 100)) : 0;
                    const INV_STATUS: Record<string, { label: string; color: string }> = {
                      pending: { label: 'Chờ TT', color: '#FF9500' },
                      paid:    { label: 'Đã TT',  color: '#34C759' },
                      cancelled: { label: 'Huỷ',  color: '#FF3B30' },
                    };
                    return (
                      <div style={{ marginBottom: '20px', background: '#0F0F0F', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '12px' }}>
                          📊 Billing Progress {invs.length > 0 && <span style={{ color: '#555' }}>· {invs.length} hoá đơn</span>}
                        </h4>
                        {isLoadingBilling ? (
                          <p style={{ color: '#555', fontSize: '12px' }}>Đang tải...</p>
                        ) : (
                          <>
                            {/* Summary row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                              {[
                                { label: 'Hợp đồng', value: budget > 0 ? fmt(budget) : '—', color: '#888' },
                                { label: 'Đã xuất HĐ', value: invs.length > 0 ? fmt(totalInvoiced) : '—', color: '#0A84FF' },
                                { label: 'Đã thu', value: invs.length > 0 ? fmt(totalPaid) : '—', color: '#34C759' },
                              ].map(({ label, value, color }) => (
                                <div key={label} style={{ background: '#161616', borderRadius: '8px', padding: '10px 12px' }}>
                                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</p>
                                  <p style={{ fontSize: '14px', fontWeight: 900, color }}>{value}</p>
                                </div>
                              ))}
                            </div>
                            {/* Progress bar */}
                            {budget > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '10px', color: '#555' }}>Đã xuất / Hợp đồng</span>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: pct >= 100 ? '#34C759' : '#0A84FF' }}>{pct}%</span>
                                </div>
                                <div style={{ height: '6px', background: '#222', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: '#0A84FF', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctPaid}%`, background: '#34C759', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                </div>
                                <p style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>Xanh lá = đã thu · Xanh dương = đã xuất HĐ</p>
                              </div>
                            )}
                            {/* Invoice list */}
                            {invs.length === 0 ? (
                              <p style={{ fontSize: '12px', color: '#444', textAlign: 'center', padding: '12px 0' }}>Chưa có hoá đơn liên kết</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {invs.map(inv => {
                                  const st = INV_STATUS[inv.status] || INV_STATUS.pending;
                                  const total = svc.calcInvoiceTotal(inv);
                                  const fmtCur = (n: number) => inv.currency === 'VND'
                                    ? n.toLocaleString('vi-VN') + ' ₫'
                                    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0 });
                                  return (
                                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#161616', borderRadius: '8px', border: '1px solid #1e1e1e' }}>
                                      <div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F5F5' }}>{inv.invoice_number}</span>
                                        <span style={{ fontSize: '10px', color: '#555', marginLeft: '8px' }}>{new Date(inv.created_at).toLocaleDateString('vi-VN')}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: st.color }}>{fmtCur(total)}</span>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: st.color + '15', color: st.color }}>{st.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Payment Schedule Section ── */}
                  <PaymentScheduleSection
                    projectId={proj.id}
                    projectCurrency={proj.currency || 'VND'}
                    currentUser={currentUser ?? null}
                  />

                  {/* ── CRM Documents linked to this project ── */}
                  {(() => {
                    const crmDocs = docsMap[proj.id] || [];
                    if (crmDocs.length === 0) return null;
                    const DOC_TYPE_ICON: Record<string, string> = {
                      contract: '📋', nda: '🔒', invoice: '🧾', proposal: '📝', other: '📎',
                    };
                    const DOC_TYPE_LABEL: Record<string, string> = {
                      contract: 'Hợp đồng', nda: 'NDA', invoice: 'Invoice', proposal: 'Proposal', other: 'Khác',
                    };
                    const DOC_TYPE_COLOR: Record<string, string> = {
                      contract: '#34C759', nda: '#FF9500', invoice: '#0A84FF', proposal: '#AF52DE', other: '#888',
                    };
                    return (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '10px' }}>
                          📋 Tài liệu CRM ({crmDocs.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {crmDocs.map(doc => {
                            const icon = DOC_TYPE_ICON[doc.doc_type] || '📎';
                            const label = DOC_TYPE_LABEL[doc.doc_type] || 'Khác';
                            const color = DOC_TYPE_COLOR[doc.doc_type] || '#888';
                            const canPrev = doc.file_url && isPreviewable(doc.file_url);
                            const pubUrl = doc.file_url ? toPublicUrl(doc.file_url) : '';
                            return (
                              <div key={doc.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 14px', background: '#1A1A1A', borderRadius: '8px',
                                border: `1px solid ${color}20`,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                  <span style={{ fontSize: '16px' }}>{icon}</span>
                                  <div>
                                    <span style={{ color: '#F5F5F5', fontSize: '13px', fontWeight: 600 }}>{doc.title}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', background: color + '20', color }}>{label}</span>
                                    {doc.file_name && <span style={{ fontSize: '10px', color: '#34C759', fontWeight: 600, marginLeft: '8px' }}>{doc.file_name}</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                  {canPrev ? (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(pubUrl); setPreviewTitle(doc.file_name || doc.title); }}
                                      style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(10,132,255,0.12)', color: '#0A84FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                      👁️ Xem
                                    </button>
                                  ) : pubUrl ? (
                                    <a href={pubUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                      style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(10,132,255,0.12)', color: '#0A84FF', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                                      🔗 Mở
                                    </a>
                                  ) : null}
                                  {pubUrl && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(pubUrl, doc.file_name || doc.title); }}
                                      style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(52,199,89,0.12)', color: '#34C759', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                      ⬇️
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>
                      📎 Tài liệu & Link ({proj.files?.length || 0})
                    </h4>
                    <button onClick={() => { setNewFileForm(newFileForm === proj.id ? null : proj.id); setFileForm({ title: '', file_url: '', file_type: 'link', file_name: '', file_size: 0, notes: '' }); }}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                      style={{ background: '#FF9500' }}>＋ Thêm</button>
                  </div>

                  {/* New file form with drag-drop */}
                  {newFileForm === proj.id && (
                    <div className="rounded-[20px] border border-primary/10 p-6 bg-surface" style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tiêu đề *</label>
                          <input className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a' }} value={fileForm.title} onChange={e => setFileForm({ ...fileForm, title: e.target.value })} placeholder="Tên tài liệu" /></div>
                        <div><label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Loại</label>
                          <select className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors" style={{ background: '#1a1a1a' }} value={fileForm.file_type} onChange={e => setFileForm({ ...fileForm, file_type: e.target.value as any })}>
                            <option value="link">🔗 Link</option><option value="document">📄 Tài liệu</option>
                            <option value="image">🖼️ Hình ảnh</option><option value="other">📦 Khác</option>
                          </select></div>
                      </div>

                      {/* Upload or Link */}
                      <div style={{ marginBottom: '10px' }}>
                        <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Upload file hoặc dán link</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div ref={dropRef} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
                            <input type="file" ref={fileRef} accept={ACCEPTED_TYPES} onChange={handleFileInput}
                              disabled={uploading} style={{ display: 'none' }} id="crm-proj-file-upload" />
                            <label htmlFor="crm-proj-file-upload" style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              padding: '16px', minHeight: '80px',
                              border: `2px dashed ${isDragging ? '#FF9500' : fileForm.file_name ? '#34C759' : '#444'}`,
                              borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', transition: 'all 0.25s',
                              background: isDragging ? 'rgba(255,149,0,0.08)' : fileForm.file_name ? 'rgba(52,199,89,0.06)' : 'transparent',
                              transform: isDragging ? 'scale(1.01)' : 'scale(1)',
                            }}>
                              {uploading ? (
                                <><div style={{ width: '22px', height: '22px', border: '2px solid #333', borderTop: '2px solid #FF9500', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ fontSize: '12px', color: '#FF9500', fontWeight: 700 }}>Đang upload...</span></>
                              ) : fileForm.file_name ? (
                                <><span style={{ fontSize: '22px' }}>✅</span>
                                <span style={{ fontSize: '12px', color: '#34C759', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all' }}>{fileForm.file_name}</span>
                                {fileForm.file_size > 0 && <span style={{ fontSize: '10px', color: '#666' }}>{formatSize(fileForm.file_size)}</span>}</>
                              ) : isDragging ? (
                                <><span style={{ fontSize: '24px' }}>📥</span><span style={{ fontSize: '12px', color: '#FF9500', fontWeight: 800 }}>Thả file vào đây!</span></>
                              ) : (
                                <><span style={{ fontSize: '22px' }}>📤</span><span style={{ fontSize: '11px', color: '#aaa', fontWeight: 600 }}>Kéo thả hoặc click</span></>
                              )}
                            </label>
                            {fileForm.file_name && (
                              <button type="button" onClick={() => setFileForm({ ...fileForm, file_url: '', file_name: '', file_size: 0, file_type: 'link' })}
                                style={{ marginTop: '6px', padding: '3px 8px', border: 'none', borderRadius: '4px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                ✕ Xoá file
                              </button>
                            )}
                          </div>
                          <div>
                            <input className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full" style={{ background: '#1a1a1a', height: '100%' }}
                              value={!fileForm.file_name ? fileForm.file_url : ''} onChange={e => setFileForm({ ...fileForm, file_url: e.target.value, file_name: '', file_size: 0 })}
                              placeholder="Hoặc dán link (https://...)" disabled={!!fileForm.file_name} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setNewFileForm(null); setFileForm({ title: '', file_url: '', file_type: 'link', file_name: '', file_size: 0, notes: '' }); }}
                          className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">Huỷ</button>
                        <button onClick={() => handleAddFile(proj.id)} disabled={uploading}
                          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                          style={{ background: '#FF9500' }}>Lưu</button>
                      </div>
                    </div>
                  )}

                  {/* File list */}
                  {(proj.files || []).length === 0 ? (
                    <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Chưa có tài liệu</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(proj.files || []).map(f => {
                        const canPreview = isPreviewable(f.file_url);
                        return (
                          <div key={f.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
                            background: '#1A1A1A', borderRadius: '8px', border: '1px solid #222',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <span style={{ fontSize: '16px' }}>
                                {f.file_type === 'link' ? '🔗' : f.file_type === 'document' ? '📄' : f.file_type === 'image' ? '🖼️' : '📎'}
                              </span>
                              <span style={{ color: '#F5F5F5', fontSize: '13px', fontWeight: 600 }}>{f.title}</span>
                              {f.file_name && <span style={{ fontSize: '10px', color: '#34C759', fontWeight: 600 }}>({f.file_name})</span>}
                              {f.notes && <span style={{ color: '#555', fontSize: '11px' }}>{f.notes}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative', zIndex: 10 }}>
                              {canPreview && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(toPublicUrl(f.file_url)); setPreviewTitle(f.file_name || f.title); }}
                                  style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(10,132,255,0.12)', color: '#0A84FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                  👁️ Xem
                                </button>
                              )}
                              {!canPreview && f.file_url && (
                                <a href={toPublicUrl(f.file_url)} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(10,132,255,0.12)', color: '#0A84FF', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                                  🔗 Mở
                                </a>
                              )}
                              {f.file_url && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(toPublicUrl(f.file_url), f.file_name || f.title); }}
                                  style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', background: 'rgba(52,199,89,0.12)', color: '#34C759', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                  ⬇️
                                </button>
                              )}
                              {deleteFileConfirmId === f.id ? (
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  <button type="button" disabled={deleting}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                                    style={{ background: '#FF453A' }}>{deleting ? '...' : '✓'}</button>
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); setDeleteFileConfirmId(null); }}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✕</button>
                                </div>
                              ) : (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteFileConfirmId(f.id); }}
                                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✕</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📁</p>
          <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
          <p className="text-xs mt-1 text-neutral-700">Nhấn "Thêm dự án" để bắt đầu</p>
        </div>
      )}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ProjectList;
