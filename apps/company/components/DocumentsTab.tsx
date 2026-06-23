import React, { useState, useEffect, useRef } from 'react';
import {
  CompanyDocument, CompanyProfile,
  fetchCompanyDocuments, uploadCompanyDocument,
  getDocumentUrl, deleteCompanyDocument,
} from '../services/companyService';

const DOC_TYPES = ['GPKD', 'Đăng ký thuế', 'CCCD đại diện', 'Con dấu', 'Chữ ký', 'Điều lệ', 'Giấy ủy quyền', 'Khác'];

const fmtSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN');

interface Props {
  company: CompanyProfile;
  canEdit: boolean;
  username: string;
}

export default function DocumentsTab({ company, canEdit, username }: Props) {
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docName, setDocName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [company.id]);

  const load = async () => {
    setLoading(true);
    try {
      setDocs(await fetchCompanyDocuments(company.id));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !docType) return;
    setUploading(true);
    setError('');
    try {
      const doc = await uploadCompanyDocument(company.id, selectedFile, docType, docName || selectedFile.name, notes, username);
      setDocs(prev => [doc, ...prev]);
      setShowForm(false);
      setSelectedFile(null);
      setDocName('');
      setNotes('');
      setDocType(DOC_TYPES[0]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setError(e.message || 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (doc: CompanyDocument) => {
    setOpeningId(doc.id);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, '_blank');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!confirm(`Xoá "${doc.doc_name}"?`)) return;
    await deleteCompanyDocument(doc);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const typeColor: Record<string, string> = {
    'GPKD': '#FF9500', 'Đăng ký thuế': '#34C759', 'CCCD đại diện': '#0A84FF',
    'Con dấu': '#AF52DE', 'Chữ ký': '#FF375F', 'Điều lệ': '#5856D6',
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Giấy tờ & Hồ sơ</h2>
          <p className="text-neutral-medium text-sm mt-1">{company.entity_short} • {docs.length} tài liệu</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
            style={{ background: showForm ? '#333' : '#FF9500' }}>
            {showForm ? '✕ Huỷ' : '⬆ Upload'}
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="rounded-2xl border border-orange-500/20 p-5 space-y-4" style={{ background: 'rgba(255,149,0,0.04)' }}>
          <p className="text-orange-400 text-xs font-black uppercase tracking-wider">Upload tài liệu mới</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Loại tài liệu *</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a' }}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tên tài liệu</label>
              <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Tự động từ tên file nếu để trống"
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors placeholder:text-neutral-700"
                style={{ background: '#1a1a1a' }} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Ghi chú</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ví dụ: Bản scan màu, cấp ngày 11/02/2026..."
                className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors placeholder:text-neutral-700"
                style={{ background: '#1a1a1a' }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="text-xs text-neutral-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-black file:uppercase file:text-white file:cursor-pointer"
              style={{ '--file-bg': '#333' } as any} />
            <button onClick={handleUpload} disabled={!selectedFile || uploading}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white disabled:opacity-40 transition-all whitespace-nowrap"
              style={{ background: '#FF9500' }}>
              {uploading ? 'Đang upload...' : '⬆ Lưu'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="text-center py-12 text-neutral-600 text-sm">Đang tải...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📂</p>
          <p>Chưa có tài liệu nào được upload</p>
          {canEdit && <p className="text-xs mt-1 text-neutral-600">Nhấn ⬆ Upload để thêm tài liệu đầu tiên</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 bg-surface hover:border-primary/25 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${typeColor[doc.doc_type] || '#666'}15` }}>
                {doc.mime_type?.includes('pdf') ? '📄' : doc.mime_type?.includes('image') ? '🖼' : '📎'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{doc.doc_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg"
                    style={{ background: `${typeColor[doc.doc_type] || '#666'}20`, color: typeColor[doc.doc_type] || '#999' }}>
                    {doc.doc_type}
                  </span>
                  {doc.file_size && <span className="text-neutral-600 text-[10px]">{fmtSize(doc.file_size)}</span>}
                  <span className="text-neutral-700 text-[10px]">{fmtDate(doc.uploaded_at)}</span>
                  {doc.notes && <span className="text-neutral-600 text-[10px] italic truncate max-w-[200px]">{doc.notes}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleOpen(doc)} disabled={openingId === doc.id}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                  {openingId === doc.id ? '...' : '👁 Xem'}
                </button>
                {canEdit && (
                  <button onClick={() => handleDelete(doc)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-neutral-600 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all">
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
