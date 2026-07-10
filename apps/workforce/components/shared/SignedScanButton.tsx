import React, { useRef, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

// ponytail: tái dùng edge function r2-expense-upload (đã deploy) như ExpenseForm/DocumentList
const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;
const MAX_SIZE_MB = 10;

interface SignedScanButtonProps {
  signedFileUrl?: string | null;
  onUploaded: (url: string) => void;
}

/** Upload bản scan biên bản nghiệm thu đã ký (dùng chung Acceptance + Settlement) */
export const SignedScanButton: React.FC<SignedScanButtonProps> = ({ signedFileUrl, onUploaded }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) { alert(`File quá lớn! Tối đa ${MAX_SIZE_MB}MB.`); return; }
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
      onUploaded(data.url);
    } catch (err: any) {
      alert('Upload thất bại: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />
      {signedFileUrl && (
        <a href={signedFileUrl} target="_blank" rel="noreferrer"
          className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all">
          📎 Xem bản ký
        </a>
      )}
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40">
        {uploading ? '⏳ Đang tải...' : signedFileUrl ? '🔁 Thay bản ký' : '📤 Up bản ký'}
      </button>
    </>
  );
};
