import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CrmClient, CrmDocument, CrmProject, CrmContact, AccountUser } from '@/types';
import * as svc from '../services/crmService';
import ClientContractGenerator from './ClientContractGenerator';
import { hasAnyRole } from '@/utils/roleUtils';
import { supabase } from '@/services/supabaseClient';

const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;
const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_URL || '';
const MAX_SIZE_MB = 20;
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip';

// Convert S3 API URL to public R2 URL for preview/download
const toPublicUrl = (url: string): string => {
  if (!url || !R2_PUBLIC_BASE) return url;
  const r2Match = url.match(/https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/(.+)/);
  if (r2Match) return `${R2_PUBLIC_BASE}/${r2Match[1]}`;
  return url;
};

interface Props {
  clients: CrmClient[];
  currentUser: AccountUser;
  /** ponytail: khi set, list bị khoá theo 1 khách (dùng trong panel chi tiết khách hàng) */
  fixedClient?: CrmClient;
}

const DOC_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  contract: { label: 'Hợp đồng', icon: '📋', color: '#34C759' },
  nda:      { label: 'NDA', icon: '🔒', color: '#FF9500' },
  invoice:  { label: 'Invoice', icon: '🧾', color: '#0A84FF' },
  proposal: { label: 'Proposal', icon: '📝', color: '#AF52DE' },
  acceptance: { label: 'BB nghiệm thu', icon: '✅', color: '#30D158' },
  other:    { label: 'Khác', icon: '📎', color: '#888' },
};


const isPreviewable = (url: string) => /\.(jpg|jpeg|png|webp|gif|pdf|svg)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif|pdf|svg)/i.test(url);
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif|svg)/i.test(url);

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyForm = { client_id: '', project_id: '' as string | null, doc_type: 'contract', title: '', file_url: '', file_name: '', file_size: 0, notes: '', contract_value: '' as string, contract_currency: 'USD' as 'USD' | 'VND' };

const APPROVAL_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  pending_approval: { label: 'Chờ duyệt', color: '#FFA726', icon: '⏳' },
  approved:         { label: 'Đã duyệt', color: '#4CAF50', icon: '✅' },
  rejected:         { label: 'Từ chối',  color: '#F44336', icon: '❌' },
};

const DocumentList: React.FC<Props> = ({ clients, currentUser, fixedClient }) => {
  const [docs, setDocs] = useState<CrmDocument[]>([]);
  const [allProjects, setAllProjects] = useState<CrmProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterClient, setFilterClient] = useState(fixedClient?.id || '');
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CrmDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  // Approval state
  const [approvalNote, setApprovalNote] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [expandedApprovalId, setExpandedApprovalId] = useState<string | null>(null);
  const isAdmin = hasAnyRole(currentUser, ['admin']);

  // Contract generator state
  const [contractGenClient, setContractGenClient] = useState<CrmClient | null>(null);
  const [contractGenContacts, setContractGenContacts] = useState<CrmContact[]>([]);
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [pickerClientId, setPickerClientId] = useState('');
  const [pickerProjectId, setPickerProjectId] = useState('');

  const openContractGenerator = () => {
    const client = clients.find(c => c.id === pickerClientId);
    if (!client) return;
    setContractGenContacts(client.contacts || []);
    setContractGenClient(client);
    setShowContractPicker(false);
  };
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingScanId, setUploadingScanId] = useState<string | null>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);

  const handleUploadScan = async (docId: string, file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File quá lớn! Tối đa ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadingScanId(docId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(R2_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await svc.updateDocument(docId, {
        file_url: data.url,
        file_name: file.name,
        file_size: file.size,
      });
      load();
    } catch (err: any) {
      alert('Upload thất bại: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingScanId(null);
      if (scanFileRef.current) scanFileRef.current.value = '';
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(emptyForm);

  // Load all projects once for lookup
  useEffect(() => {
    svc.fetchProjects().then(setAllProjects).catch(() => {});
  }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await svc.fetchDocuments(filterClient || undefined);
      setDocs(data);
    } catch { } finally { setIsLoading(false); }
  };
  useEffect(() => { load(); }, [filterClient]);

  // Projects available for the selected client in the form
  const formProjects = allProjects.filter(p => !form.client_id || p.client_id === form.client_id);

  // ── Upload a file to R2 ──
  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File quá lớn! Tối đa ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(R2_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm(prev => ({
        ...prev,
        file_url: data.url,
        file_name: file.name,
        file_size: file.size,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
    } catch (err: any) {
      alert('Upload thất bại: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const uploadRef = useRef(uploadFile);
  uploadRef.current = uploadFile;

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadRef.current(file);
  };

  const handleSave = async () => {
    if (!form.client_id || !form.title.trim()) return;
    try {
      const contractValueNum = form.doc_type === 'contract' && form.contract_value !== ''
        ? parseFloat(form.contract_value)
        : null;
      const payload = {
        client_id: form.client_id,
        project_id: form.project_id || null,
        doc_type: form.doc_type as any,
        title: form.title,
        file_url: form.file_url,
        file_name: form.file_name,
        file_size: form.file_size,
        notes: form.notes,
        contract_value: contractValueNum,
        contract_currency: form.doc_type === 'contract' ? form.contract_currency : null,
      };
      if (editingDoc) {
        await svc.updateDocument(editingDoc.id, payload);
      } else {
        await svc.createDocument(payload as any);
      }
      setShowForm(false);
      setEditingDoc(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      alert('Lưu thất bại: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleEdit = (doc: CrmDocument) => {
    setEditingDoc(doc);
    setForm({
      client_id: doc.client_id,
      project_id: doc.project_id || null,
      doc_type: doc.doc_type,
      title: doc.title,
      file_url: doc.file_url || '',
      file_name: doc.file_name || '',
      file_size: doc.file_size || 0,
      notes: doc.notes || '',
      contract_value: doc.contract_value != null ? String(doc.contract_value) : '',
      contract_currency: (doc.contract_currency as 'USD' | 'VND') || 'USD',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await svc.deleteDocument(id);
      setDeleteConfirmId(null);
      load();
    } catch (err: any) {
      console.error('[CRM] Delete error:', err);
      alert('Xoá thất bại: ' + (err?.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (url: string, _filename: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await svc.approveDocument(id, currentUser.id, approvalNote || undefined);
      setExpandedApprovalId(null);
      setApprovalNote('');
      load();
    } catch (err: any) {
      alert('Duyệt thất bại: ' + (err?.message || 'Unknown error'));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!approvalNote.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    setApprovingId(id);
    try {
      await svc.rejectDocument(id, currentUser.id, approvalNote);
      setExpandedApprovalId(null);
      setApprovalNote('');
      load();
    } catch (err: any) {
      alert('Từ chối thất bại: ' + (err?.message || 'Unknown error'));
    } finally {
      setApprovingId(null);
    }
  };

  // Projects for filter bar (based on filterClient)
  const filterBarProjects = allProjects.filter(p => !filterClient || p.client_id === filterClient);

  const filtered = docs.filter(d => {
    if (filterType && d.doc_type !== filterType) return false;
    if (filterProject && d.project_id !== filterProject) return false;
    return true;
  });

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || '—';
  const projectName = (id?: string | null) => id ? (allProjects.find(p => p.id === id)?.name || null) : null;

  const typeCounts = Object.keys(DOC_TYPES).map(k => ({
    key: k, ...DOC_TYPES[k], count: docs.filter(d => d.doc_type === k).length,
  }));

  return (
    <div className="animate-fadeInUp">
      {/* ── File Preview Modal (Portal to body) ── */}
      {previewUrl && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999,
          background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }} onClick={() => setPreviewUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
            background: '#111', borderBottom: '1px solid #333',
            height: '50px', minHeight: '50px', maxHeight: '50px', flexShrink: 0,
          }}>
            <span style={{ color: '#F5F5F5', fontSize: '14px', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewTitle}</span>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#0A84FF',
              color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
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
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
            {isImageUrl(previewUrl) ? (
              <img src={previewUrl} alt={previewTitle} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
            ) : (
              <iframe src={previewUrl} title={previewTitle} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            )}
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: fixedClient ? 'center' : 'flex-start', marginBottom: fixedClient ? '16px' : '28px' }}>
        {fixedClient ? (
          // ponytail: tên khách đã là tiêu đề chính ở CrmApp — chỉ cần label section nhỏ
          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">📁 Tài liệu</p>
        ) : (<div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Tài liệu</h2>
          <p className="text-sm text-neutral-medium mt-1">Quản lý hợp đồng, NDA, invoice — upload file hoặc dán link</p>
        </div>)}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setPickerClientId(fixedClient?.id || ''); setPickerProjectId(''); setShowContractPicker(true); }}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
            📋 Tạo hợp đồng
          </button>
          <button onClick={() => { setEditingDoc(null); setForm({ ...emptyForm, client_id: fixedClient?.id || '' }); setShowForm(!showForm); }}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
            style={{ background: '#FF9500' }}>
            ＋ Thêm tài liệu
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(DOC_TYPES).length}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
        {typeCounts.map(t => (
          <div key={t.key}
            className="rounded-[20px] border bg-surface p-[14px] cursor-pointer transition-all"
            style={{ borderColor: filterType === t.key ? t.color : 'rgba(255,255,255,0.08)' }}
            onClick={() => setFilterType(filterType === t.key ? '' : t.key)}>
            <p style={{ fontSize: '20px', fontWeight: 900, color: t.color }}>{t.count}</p>
            <p style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginTop: '4px' }}>{t.icon} {t.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {!fixedClient && <select
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a', width: '260px' }}
          value={filterClient} onChange={e => {
            setFilterClient(e.target.value);
            setFilterProject('');
          }}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>}
        <select
          className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
          style={{ background: '#1a1a1a', width: '260px' }}
          value={filterProject} onChange={e => setFilterProject(e.target.value)}
          disabled={filterBarProjects.length === 0}>
          <option value="">Tất cả dự án</option>
          {filterBarProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* New / Edit doc form */}
      {showForm && (
        <div className="rounded-[20px] bg-surface border border-primary/10 p-6" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: editingDoc ? '#0A84FF' : '#FF9500', marginBottom: '16px', textTransform: 'uppercase' }}>
            {editingDoc ? '✏️ Chỉnh sửa tài liệu' : '＋ Tạo tài liệu mới'}
          </h3>

          {/* Row 1: client / project / type / title */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Khách hàng *</label>
              <select
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a', width: '100%' }}
                value={form.client_id} disabled={!!fixedClient} onChange={e => setForm({ ...form, client_id: e.target.value, project_id: null })}>
                <option value="">-- Chọn --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Dự án</label>
              <select
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a', width: '100%' }}
                value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value || null })}
                disabled={formProjects.length === 0}>
                <option value="">— Không gắn dự án —</option>
                {formProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Loại tài liệu</label>
              <select
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a', width: '100%' }}
                value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Tiêu đề *</label>
              <input
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                style={{ background: '#1a1a1a' }}
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Hợp đồng dịch vụ 2026..." />
            </div>
          </div>

          {/* Drag & Drop Upload Area */}
          <div style={{ marginBottom: '14px' }}>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Upload file hoặc dán link</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div ref={dropZoneRef}
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                onDragOver={handleDragOver} onDrop={handleDrop}>
                <input type="file" ref={fileRef} accept={ACCEPTED_TYPES} onChange={handleFileInput}
                  disabled={uploading} style={{ display: 'none' }} id="crm-doc-upload" />
                <label htmlFor="crm-doc-upload" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '20px', minHeight: '100px',
                  border: `2px dashed ${isDragging ? '#FF9500' : form.file_url && form.file_name ? '#34C759' : '#444'}`,
                  borderRadius: '10px', cursor: uploading ? 'wait' : 'pointer', transition: 'all 0.25s',
                  background: isDragging ? 'rgba(255,149,0,0.08)' : form.file_url && form.file_name ? 'rgba(52,199,89,0.06)' : 'rgba(255,255,255,0.02)',
                  transform: isDragging ? 'scale(1.01)' : 'scale(1)',
                }}>
                  {uploading ? (
                    <>
                      <div style={{ width: '28px', height: '28px', border: '3px solid #333', borderTop: '3px solid #FF9500', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: '13px', color: '#FF9500', fontWeight: 700 }}>Đang upload...</span>
                    </>
                  ) : form.file_url && form.file_name ? (
                    <>
                      <span style={{ fontSize: '28px' }}>✅</span>
                      <span style={{ fontSize: '13px', color: '#34C759', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all' }}>{form.file_name}</span>
                      {form.file_size > 0 && <span style={{ fontSize: '11px', color: '#666' }}>{formatSize(form.file_size)}</span>}
                    </>
                  ) : isDragging ? (
                    <>
                      <span style={{ fontSize: '32px' }}>📥</span>
                      <span style={{ fontSize: '14px', color: '#FF9500', fontWeight: 800 }}>Thả file vào đây!</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '28px' }}>📤</span>
                      <span style={{ fontSize: '13px', color: '#aaa', fontWeight: 600 }}>Kéo thả file vào đây</span>
                      <span style={{ fontSize: '11px', color: '#555' }}>hoặc click để chọn (tối đa {MAX_SIZE_MB}MB)</span>
                    </>
                  )}
                </label>
                {form.file_url && form.file_name && (
                  <button type="button" onClick={() => setForm({ ...form, file_url: '', file_name: '', file_size: 0 })}
                    style={{ marginTop: '8px', padding: '4px 12px', border: 'none', borderRadius: '6px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    ✕ Xoá file đã upload
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                  style={{ background: '#1a1a1a', flex: 1 }}
                  value={!form.file_name ? form.file_url : ''}
                  onChange={e => setForm({ ...form, file_url: e.target.value, file_name: '', file_size: 0 })}
                  placeholder="Hoặc dán link (Google Drive, Dropbox...)"
                  disabled={!!form.file_name} />
                <span style={{ fontSize: '11px', color: '#555', textAlign: 'center' }}>Dán link nếu file đã lưu trên cloud</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Ghi chú</label>
            <input
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú..." />
          </div>

          {/* Contract value fields — only when doc_type = 'contract' */}
          {form.doc_type === 'contract' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', marginBottom: '14px', alignItems: 'end' }}>
              <div>
                <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Giá trị hợp đồng <span style={{ color: '#555', textTransform: 'none', fontWeight: 400 }}>(tuỳ chọn)</span></label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                  style={{ background: '#1a1a1a' }}
                  value={form.contract_value}
                  onChange={e => setForm({ ...form, contract_value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div style={{ minWidth: '110px' }}>
                <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>Đơn vị</label>
                <select
                  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                  style={{ background: '#1a1a1a', width: '100%' }}
                  value={form.contract_currency}
                  onChange={e => setForm({ ...form, contract_currency: e.target.value as 'USD' | 'VND' })}
                >
                  <option value="USD">USD</option>
                  <option value="VND">VND</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); setForm(emptyForm); }}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">Huỷ</button>
            <button type="button" onClick={handleSave} disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}>
              {editingDoc ? 'Cập nhật' : 'Lưu tài liệu'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Đang tải...</p>}

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(doc => {
          const dt = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;
          const hasFile = !!doc.file_url;
          const canPreview = hasFile && isPreviewable(doc.file_url);
          const pName = projectName(doc.project_id);
          const approval = doc.approval_status ? APPROVAL_BADGE[doc.approval_status] : null;
          const isApproved = doc.approval_status === 'approved';
          const isPending = doc.approval_status === 'pending_approval';
          const canEdit = !isApproved; // Đã duyệt thì không được sửa
          return (
            <div key={doc.id}>
              <div
                className="rounded-[20px] border border-primary/10 bg-surface p-4 hover:border-primary/20 transition-all"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  ...(isPending ? { borderColor: 'rgba(255,167,38,0.25)' } : {}),
                }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '24px' }}>{dt.icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5' }}>{doc.title}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: dt.color + '20', color: dt.color, textTransform: 'uppercase' }}>{dt.label}</span>
                      {approval && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: approval.color + '20', color: approval.color, textTransform: 'uppercase' }}>
                          {approval.icon} {approval.label}
                        </span>
                      )}
                      {doc.file_name && <span style={{ fontSize: '10px', color: '#34C759', fontWeight: 600 }}>📄 {doc.file_name}</span>}
                      {doc.file_size > 0 && <span style={{ fontSize: '10px', color: '#555' }}>{formatSize(doc.file_size)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#666', flexWrap: 'wrap' }}>
                      <span>🏢 {clientName(doc.client_id)}</span>
                      {pName && <span style={{ color: '#AF52DE' }}>📁 {pName}</span>}
                      <span>📅 {new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                      {doc.approved_by && doc.approved_at && (
                        <span style={{ color: isApproved ? '#4CAF50' : '#F44336' }}>
                          {isApproved ? '✅' : '❌'} Duyệt: {new Date(doc.approved_at).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      {doc.notes && <span>📝 {doc.notes}</span>}
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px', position: 'relative', zIndex: 10 }}>
                  {/* Edit — chỉ hiện khi chưa duyệt */}
                  {canEdit && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(doc); }} title="Sửa"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✏️ Sửa</button>
                  )}
                  {/* Admin: Duyệt/Từ chối cho pending */}
                  {isAdmin && isPending && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedApprovalId(expandedApprovalId === doc.id ? null : doc.id); setApprovalNote(''); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">
                      📋 Duyệt
                    </button>
                  )}
                  {hasFile && canPreview && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(toPublicUrl(doc.file_url)); setPreviewTitle(doc.file_name || doc.title); }} title="Xem trước"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">👁️ Xem</button>
                  )}
                  {hasFile && !canPreview && (
                    <a href={toPublicUrl(doc.file_url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all" style={{ textDecoration: 'none' }}>🔗 Mở</a>
                  )}
                  {hasFile && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(toPublicUrl(doc.file_url), doc.file_name || doc.title); }} title="Tải về"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">⬇️ Tải</button>
                  )}
                  {!hasFile && (
                    <label title="Upload bản scan đã ký"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                      style={{ cursor: uploadingScanId === doc.id ? 'wait' : 'pointer', opacity: uploadingScanId === doc.id ? 0.6 : 1 }}>
                      {uploadingScanId === doc.id ? '⏳ Đang upload...' : '📤 Upload scan'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                        disabled={!!uploadingScanId}
                        onChange={(e) => { e.stopPropagation(); const f = e.target.files?.[0]; if (f) handleUploadScan(doc.id, f); }} />
                    </label>
                  )}
                  {/* Delete — admin luôn xoá được, BD chỉ xoá khi chưa duyệt */}
                  {(isAdmin || canEdit) && (
                    <>
                      {deleteConfirmId === doc.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 700, marginRight: '2px' }}>Xoá?</span>
                          <button type="button" disabled={deleting} onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                            style={{ opacity: deleting ? 0.6 : 1 }}>
                            {deleting ? '...' : '✓ Xác nhận'}
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">✕</button>
                        </div>
                      ) : (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(doc.id); }} title="Xoá"
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">🗑️</button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {/* Approval panel — mở ra khi admin click "Duyệt" */}
              {expandedApprovalId === doc.id && isPending && isAdmin && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,167,38,0.2)', borderTop: 'none',
                  borderRadius: '0 0 20px 20px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end',
                }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: '6px' }}>
                      Ghi chú (bắt buộc khi từ chối)
                    </label>
                    <input
                      className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
                      style={{ background: '#1a1a1a' }}
                      value={approvalNote}
                      onChange={e => setApprovalNote(e.target.value)}
                      placeholder="Nhập ghi chú..."
                    />
                  </div>
                  <button type="button" disabled={approvingId === doc.id} onClick={() => handleApprove(doc.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                    style={{ background: '#FF9500', whiteSpace: 'nowrap' }}>
                    {approvingId === doc.id ? '...' : '✅ Duyệt'}
                  </button>
                  <button type="button" disabled={approvingId === doc.id} onClick={() => handleReject(doc.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                    style={{ background: '#F44336', whiteSpace: 'nowrap' }}>
                    {approvingId === doc.id ? '...' : '❌ Từ chối'}
                  </button>
                  <button type="button" onClick={() => { setExpandedApprovalId(null); setApprovalNote(''); }}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
                    style={{ whiteSpace: 'nowrap' }}>
                    Huỷ
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📄</p>
          <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
          <p className="text-xs mt-1 text-neutral-700">Nhấn "Thêm tài liệu" để bắt đầu</p>
        </div>
      )}

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      {/* Contract Picker — Select Client + Project before generating */}
      {showContractPicker && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowContractPicker(false); }}>
          <div className="rounded-[20px] border border-primary/10 bg-surface animate-scaleIn w-full max-w-[480px] p-8"
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#FF9500', marginBottom: 4 }}>Tạo hợp đồng khách hàng</h3>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>Chọn khách hàng và dự án trước khi tạo hợp đồng</p>

            {/* Client select */}
            <div style={{ marginBottom: 16 }}>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>Khách hàng *</label>
              {fixedClient ? (
                <p className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white" style={{ background: '#1a1a1a' }}>{fixedClient.name}</p>
              ) : (<select value={pickerClientId} onChange={e => { setPickerClientId(e.target.value); setPickerProjectId(''); }}
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a', width: '100%' }}>
                <option value="">— Chọn khách hàng —</option>
                {clients.filter(c => c.status === 'active' || c.status === 'contracting' || c.status === 'negotiating').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>)}
              {!pickerClientId && (
                <p style={{ fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic' }}>Cần tạo thông tin khách hàng trong tab Clients trước</p>
              )}
            </div>

            {/* Project select */}
            {pickerClientId && (
              <div style={{ marginBottom: 16 }}>
                <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>Dự án</label>
                {(() => {
                  const clientProjects = allProjects.filter(p => p.client_id === pickerClientId);
                  return clientProjects.length > 0 ? (
                    <select value={pickerProjectId} onChange={e => setPickerProjectId(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                      style={{ background: '#1a1a1a', width: '100%' }}>
                      <option value="">— Không chọn dự án —</option>
                      {clientProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-500" style={{ background: '#1a1a1a' }}>
                      Chưa có dự án nào. Bạn có thể tạo dự án trong tab Projects, hoặc nhập tên dự án thủ công trong hợp đồng.
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowContractPicker(false)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all">
                Huỷ
              </button>
              <button onClick={openContractGenerator} disabled={!pickerClientId}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                style={{ background: pickerClientId ? '#10b981' : '#333' }}>
                Tiếp tục
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Contract Generator Modal */}
      {contractGenClient && (
        <ClientContractGenerator
          client={contractGenClient}
          contacts={contractGenContacts}
          projects={allProjects.filter(p => p.client_id === contractGenClient.id)}
          onClose={() => setContractGenClient(null)}
          onSaved={() => { load(); }}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
};

export default DocumentList;
