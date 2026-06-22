import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CrmClient, CrmDocument, CrmProject, CrmContact } from '@/types';
import * as svc from '../services/crmService';
import ClientContractGenerator from './ClientContractGenerator';

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
}

const DOC_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  contract: { label: 'Hợp đồng', icon: '📋', color: '#34C759' },
  nda:      { label: 'NDA', icon: '🔒', color: '#FF9500' },
  invoice:  { label: 'Invoice', icon: '🧾', color: '#0A84FF' },
  proposal: { label: 'Proposal', icon: '📝', color: '#AF52DE' },
  other:    { label: 'Khác', icon: '📎', color: '#888' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1A1A1A', border: '1px solid #333',
  borderRadius: '8px', color: '#F5F5F5', fontSize: '13px', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888',
};

const isPreviewable = (url: string) => /\.(jpg|jpeg|png|webp|gif|pdf|svg)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif|pdf|svg)/i.test(url);
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || /\.(jpg|jpeg|png|webp|gif|svg)/i.test(url);

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyForm = { client_id: '', project_id: '' as string | null, doc_type: 'contract', title: '', file_url: '', file_name: '', file_size: 0, notes: '' };

const DocumentList: React.FC<Props> = ({ clients }) => {
  const [docs, setDocs] = useState<CrmDocument[]>([]);
  const [allProjects, setAllProjects] = useState<CrmProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CrmDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

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
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(R2_UPLOAD_URL, { method: 'POST', body: fd });
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
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(R2_UPLOAD_URL, { method: 'POST', body: fd });
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
      const payload = {
        client_id: form.client_id,
        project_id: form.project_id || null,
        doc_type: form.doc_type as any,
        title: form.title,
        file_url: form.file_url,
        file_name: form.file_name,
        file_size: form.file_size,
        notes: form.notes,
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>Tài liệu</h2>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Quản lý hợp đồng, NDA, invoice — upload file hoặc dán link</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setPickerClientId(''); setPickerProjectId(''); setShowContractPicker(true); }} style={{
            padding: '12px 24px', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '10px', background: 'rgba(16,185,129,0.1)',
            color: '#10b981', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase',
          }}>📋 Tạo hợp đồng</button>
          <button onClick={() => { setEditingDoc(null); setForm(emptyForm); setShowForm(!showForm); }} style={{
            padding: '12px 24px', border: 'none', borderRadius: '10px', background: '#FF9500',
            color: '#000', fontWeight: 800, fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase',
          }}>＋ Thêm tài liệu</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(DOC_TYPES).length}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
        {typeCounts.map(t => (
          <div key={t.key} style={{
            background: '#161616', border: `1px solid ${filterType === t.key ? t.color : '#222'}`, borderRadius: '10px',
            padding: '14px', cursor: 'pointer', transition: 'all 0.2s',
          }} onClick={() => setFilterType(filterType === t.key ? '' : t.key)}>
            <p style={{ fontSize: '20px', fontWeight: 900, color: t.color }}>{t.count}</p>
            <p style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginTop: '4px' }}>{t.icon} {t.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select style={{ ...inputStyle, width: '260px' }} value={filterClient} onChange={e => {
          setFilterClient(e.target.value);
          setFilterProject('');
        }}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={{ ...inputStyle, width: '260px' }} value={filterProject} onChange={e => setFilterProject(e.target.value)}
          disabled={filterBarProjects.length === 0}>
          <option value="">Tất cả dự án</option>
          {filterBarProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* New / Edit doc form */}
      {showForm && (
        <div style={{ background: '#161616', border: `1px solid ${editingDoc ? '#0A84FF' : '#FF9500'}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: editingDoc ? '#0A84FF' : '#FF9500', marginBottom: '16px', textTransform: 'uppercase' }}>
            {editingDoc ? '✏️ Chỉnh sửa tài liệu' : '＋ Tạo tài liệu mới'}
          </h3>

          {/* Row 1: client / project / type / title */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Khách hàng *</label>
              <select style={inputStyle} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, project_id: null })}>
                <option value="">-- Chọn --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Dự án</label>
              <select style={inputStyle} value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value || null })}
                disabled={formProjects.length === 0}>
                <option value="">— Không gắn dự án —</option>
                {formProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Loại tài liệu</label>
              <select style={inputStyle} value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tiêu đề *</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Hợp đồng dịch vụ 2026..." />
            </div>
          </div>

          {/* Drag & Drop Upload Area */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Upload file hoặc dán link</label>
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
                <input style={{ ...inputStyle, flex: 1 }}
                  value={!form.file_name ? form.file_url : ''}
                  onChange={e => setForm({ ...form, file_url: e.target.value, file_name: '', file_size: 0 })}
                  placeholder="Hoặc dán link (Google Drive, Dropbox...)"
                  disabled={!!form.file_name} />
                <span style={{ fontSize: '11px', color: '#555', textAlign: 'center' }}>Dán link nếu file đã lưu trên cloud</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Ghi chú</label>
            <input style={inputStyle} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ghi chú..." />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); setForm(emptyForm); }}
              style={{ padding: '8px 16px', border: '1px solid #333', borderRadius: '8px', background: 'transparent', color: '#ccc', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Huỷ</button>
            <button type="button" onClick={handleSave} disabled={uploading}
              style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: editingDoc ? '#0A84FF' : '#FF9500', color: editingDoc ? '#fff' : '#000', fontSize: '12px', fontWeight: 800, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
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
          return (
            <div key={doc.id} style={{
              background: '#161616', border: '1px solid #222', borderRadius: '10px', padding: '16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = dt.color; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#222'; }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '24px' }}>{dt.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5' }}>{doc.title}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: dt.color + '20', color: dt.color, textTransform: 'uppercase' }}>{dt.label}</span>
                    {doc.file_name && <span style={{ fontSize: '10px', color: '#34C759', fontWeight: 600 }}>📄 {doc.file_name}</span>}
                    {doc.file_size > 0 && <span style={{ fontSize: '10px', color: '#555' }}>{formatSize(doc.file_size)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#666', flexWrap: 'wrap' }}>
                    <span>🏢 {clientName(doc.client_id)}</span>
                    {pName && <span style={{ color: '#AF52DE' }}>📁 {pName}</span>}
                    <span>📅 {new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                    {doc.notes && <span>📝 {doc.notes}</span>}
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px', position: 'relative', zIndex: 10 }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(doc); }} title="Sửa"
                  style={{ padding: '7px 12px', border: '1px solid #FF950030', borderRadius: '6px', background: 'rgba(255,149,0,0.1)', color: '#FF9500', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>✏️ Sửa</button>
                {hasFile && canPreview && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(toPublicUrl(doc.file_url)); setPreviewTitle(doc.file_name || doc.title); }} title="Xem trước"
                    style={{ padding: '7px 12px', border: '1px solid #0A84FF30', borderRadius: '6px', background: 'rgba(10,132,255,0.1)', color: '#0A84FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>👁️ Xem</button>
                )}
                {hasFile && !canPreview && (
                  <a href={toPublicUrl(doc.file_url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    style={{ padding: '7px 12px', border: '1px solid #0A84FF30', borderRadius: '6px', textDecoration: 'none', background: 'rgba(10,132,255,0.1)', color: '#0A84FF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🔗 Mở</a>
                )}
                {hasFile && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(toPublicUrl(doc.file_url), doc.file_name || doc.title); }} title="Tải về"
                    style={{ padding: '7px 12px', border: '1px solid #34C75930', borderRadius: '6px', background: 'rgba(52,199,89,0.1)', color: '#34C759', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>⬇️ Tải</button>
                )}
                {!hasFile && (
                  <label title="Upload bản scan đã ký"
                    style={{ padding: '7px 12px', border: '1px solid #AF52DE30', borderRadius: '6px', background: 'rgba(175,82,222,0.1)', color: '#AF52DE', fontSize: '12px', fontWeight: 700, cursor: uploadingScanId === doc.id ? 'wait' : 'pointer', opacity: uploadingScanId === doc.id ? 0.6 : 1 }}>
                    {uploadingScanId === doc.id ? '⏳ Đang upload...' : '📤 Upload scan'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                      disabled={!!uploadingScanId}
                      onChange={(e) => { e.stopPropagation(); const f = e.target.files?.[0]; if (f) handleUploadScan(doc.id, f); }} />
                  </label>
                )}
                {deleteConfirmId === doc.id ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 700, marginRight: '2px' }}>Xoá?</span>
                    <button type="button" disabled={deleting} onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      style={{ padding: '7px 12px', border: 'none', borderRadius: '6px', background: '#FF453A', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? '...' : '✓ Xác nhận'}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                      style={{ padding: '7px 10px', border: '1px solid #333', borderRadius: '6px', background: 'transparent', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(doc.id); }} title="Xoá"
                    style={{ padding: '7px 12px', border: '1px solid #FF453A30', borderRadius: '6px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#555' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📄</p>
          <p style={{ fontSize: '14px' }}>Chưa có tài liệu nào</p>
        </div>
      )}

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      {/* Contract Picker — Select Client + Project before generating */}
      {showContractPicker && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowContractPicker(false); }}>
          <div style={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 20, width: '100%', maxWidth: 480, padding: 32 }}
            className="animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#FF9500', marginBottom: 4 }}>Tạo hợp đồng khách hàng</h3>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>Chọn khách hàng và dự án trước khi tạo hợp đồng</p>

            {/* Client select */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>Khách hàng *</label>
              <select value={pickerClientId} onChange={e => { setPickerClientId(e.target.value); setPickerProjectId(''); }}
                style={{ width: '100%', padding: '10px 14px', background: '#111', border: '1px solid #333', borderRadius: 10, color: '#F5F5F5', fontSize: 13, outline: 'none', colorScheme: 'dark' }}>
                <option value="">— Chọn khách hàng —</option>
                {clients.filter(c => c.status === 'active' || c.status === 'contracting' || c.status === 'negotiating').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!pickerClientId && (
                <p style={{ fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic' }}>Cần tạo thông tin khách hàng trong tab Clients trước</p>
              )}
            </div>

            {/* Project select */}
            {pickerClientId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>Dự án</label>
                {(() => {
                  const clientProjects = allProjects.filter(p => p.client_id === pickerClientId);
                  return clientProjects.length > 0 ? (
                    <select value={pickerProjectId} onChange={e => setPickerProjectId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', background: '#111', border: '1px solid #333', borderRadius: 10, color: '#F5F5F5', fontSize: 13, outline: 'none', colorScheme: 'dark' }}>
                      <option value="">— Không chọn dự án —</option>
                      {clientProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ fontSize: 12, color: '#666', padding: '10px 14px', background: '#111', border: '1px solid #333', borderRadius: 10 }}>
                      Chưa có dự án nào. Bạn có thể tạo dự án trong tab Projects, hoặc nhập tên dự án thủ công trong hợp đồng.
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowContractPicker(false)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #333', background: 'transparent', color: '#888', fontWeight: 800, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}>
                Huỷ
              </button>
              <button onClick={openContractGenerator} disabled={!pickerClientId}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: pickerClientId ? '#10b981' : '#333', color: pickerClientId ? '#fff' : '#666', fontWeight: 800, fontSize: 12, cursor: pickerClientId ? 'pointer' : 'not-allowed', textTransform: 'uppercase' }}>
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
          onSaved={() => { loadDocs(); }}
        />
      )}
    </div>
  );
};

export default DocumentList;
