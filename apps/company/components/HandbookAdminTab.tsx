import React, { useState, useEffect, useCallback } from 'react';
import { HandbookCategory, HandbookArticle } from '@/types';
import {
  fetchCategories, createCategory, updateCategory, deleteCategory,
  fetchArticles, createArticle, updateArticle, deleteArticle,
} from '@/apps/handbook/services/handbookService';

interface Props {
  adminUserId: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const EMPTY_CAT = { title: '', icon: '📄' };
const EMPTY_ART = { title: '', content: '', is_published: false, is_required: false };

// ─────────────────────────────────────────────────────────────
export default function HandbookAdminTab({ adminUserId, onToast }: Props) {
  const [categories, setCategories]     = useState<HandbookCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [articles, setArticles]         = useState<HandbookArticle[]>([]);
  const [loadingCats, setLoadingCats]   = useState(true);
  const [loadingArts, setLoadingArts]   = useState(false);

  // Editing state
  const [editCat, setEditCat]   = useState<{ id?: string; title: string; icon: string } | null>(null);
  const [editArt, setEditArt]   = useState<Partial<HandbookArticle> & { isNew?: boolean } | null>(null);
  const [saving, setSaving]     = useState(false);

  // ── load categories ─────────────────────────────────────────
  const loadCats = useCallback(async () => {
    setLoadingCats(true);
    try { setCategories(await fetchCategories()); }
    catch (e: any) { onToast(e.message, 'error'); }
    finally { setLoadingCats(false); }
  }, [onToast]);

  useEffect(() => { loadCats(); }, [loadCats]);

  // ── load articles when category selected ───────────────────
  useEffect(() => {
    if (!selectedCatId) { setArticles([]); return; }
    setLoadingArts(true);
    fetchArticles(selectedCatId)
      .then(setArticles)
      .catch((e: any) => onToast(e.message, 'error'))
      .finally(() => setLoadingArts(false));
  }, [selectedCatId, onToast]);

  // ── Category CRUD ───────────────────────────────────────────
  const saveCat = async () => {
    if (!editCat || !editCat.title.trim()) return;
    setSaving(true);
    try {
      if (editCat.id) {
        const updated = await updateCategory(editCat.id, { title: editCat.title.trim(), icon: editCat.icon });
        setCategories(cs => cs.map(c => c.id === editCat.id ? { ...c, ...updated } : c));
        onToast('Đã cập nhật danh mục', 'success');
      } else {
        const created = await createCategory({ title: editCat.title.trim(), icon: editCat.icon, order_index: categories.length });
        setCategories(cs => [...cs, created]);
        setSelectedCatId(created.id);
        onToast('Đã tạo danh mục', 'success');
      }
      setEditCat(null);
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const removeCat = async (id: string) => {
    if (!confirm('Xóa danh mục này và toàn bộ bài viết trong đó?')) return;
    try {
      await deleteCategory(id);
      setCategories(cs => cs.filter(c => c.id !== id));
      if (selectedCatId === id) { setSelectedCatId(null); setEditArt(null); }
      onToast('Đã xóa danh mục', 'success');
    } catch (e: any) { onToast(e.message, 'error'); }
  };

  // ── Article CRUD ────────────────────────────────────────────
  const saveArt = async () => {
    if (!editArt || !editArt.title?.trim() || !selectedCatId) return;
    setSaving(true);
    try {
      if (editArt.id) {
        const updated = await updateArticle(editArt.id, {
          title: editArt.title.trim(),
          content: editArt.content ?? '',
          is_published: editArt.is_published ?? false,
          is_required: editArt.is_required ?? false,
        });
        setArticles(as => as.map(a => a.id === updated.id ? updated : a));
        onToast('Đã cập nhật bài viết', 'success');
      } else {
        const created = await createArticle({
          category_id: selectedCatId,
          title: editArt.title.trim(),
          content: editArt.content ?? '',
          is_published: editArt.is_published ?? false,
          is_required: editArt.is_required ?? false,
          order_index: articles.length,
          created_by: adminUserId,
        });
        setArticles(as => [...as, created]);
        onToast('Đã tạo bài viết', 'success');
      }
      setEditArt(null);
    } catch (e: any) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const togglePublish = async (art: HandbookArticle) => {
    try {
      const updated = await updateArticle(art.id, { is_published: !art.is_published });
      setArticles(as => as.map(a => a.id === updated.id ? updated : a));
      onToast(updated.is_published ? 'Đã công khai' : 'Đã ẩn bài viết', 'success');
    } catch (e: any) { onToast(e.message, 'error'); }
  };

  const removeArt = async (id: string) => {
    if (!confirm('Xóa bài viết này?')) return;
    try {
      await deleteArticle(id);
      setArticles(as => as.filter(a => a.id !== id));
      if (editArt?.id === id) setEditArt(null);
      onToast('Đã xóa bài viết', 'success');
    } catch (e: any) { onToast(e.message, 'error'); }
  };

  // ── Render ──────────────────────────────────────────────────
  const selectedCat = categories.find(c => c.id === selectedCatId);

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* ── LEFT: Categories ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Danh mục</span>
          <button
            onClick={() => { setEditCat({ ...EMPTY_CAT }); setEditArt(null); }}
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
            style={{ background: '#FF9500', color: '#fff' }}
          >
            + Thêm
          </button>
        </div>

        {/* Category form (inline) */}
        {editCat && !editCat.id && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={editCat.icon}
                onChange={e => setEditCat(c => c && { ...c, icon: e.target.value })}
                className="w-12 bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm text-white"
                placeholder="📄"
                maxLength={4}
              />
              <input
                autoFocus
                value={editCat.title}
                onChange={e => setEditCat(c => c && { ...c, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && saveCat()}
                className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600"
                placeholder="Tên danh mục..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditCat(null)} className="text-[10px] font-black uppercase px-3 py-1 rounded-lg bg-white/5 text-neutral-400">Hủy</button>
              <button onClick={saveCat} disabled={saving} className="text-[10px] font-black uppercase px-3 py-1 rounded-lg" style={{ background: '#FF9500', color: '#fff' }}>
                {saving ? '...' : 'Lưu'}
              </button>
            </div>
          </div>
        )}

        {loadingCats ? (
          <p className="text-neutral-600 text-xs py-4 text-center">Đang tải...</p>
        ) : categories.length === 0 ? (
          <p className="text-neutral-600 text-xs py-4 text-center">Chưa có danh mục</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {categories.map(cat => (
              <div key={cat.id}>
                {/* Edit form for this category */}
                {editCat?.id === cat.id ? (
                  <div className="bg-[#1a1a1a] border border-primary/30 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        value={editCat.icon}
                        onChange={e => setEditCat(c => c && { ...c, icon: e.target.value })}
                        className="w-12 bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm text-white"
                        maxLength={4}
                      />
                      <input
                        autoFocus
                        value={editCat.title}
                        onChange={e => setEditCat(c => c && { ...c, title: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveCat()}
                        className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditCat(null)} className="text-[10px] font-black uppercase px-3 py-1 rounded-lg bg-white/5 text-neutral-400">Hủy</button>
                      <button onClick={saveCat} disabled={saving} className="text-[10px] font-black uppercase px-3 py-1 rounded-lg" style={{ background: '#FF9500', color: '#fff' }}>
                        {saving ? '...' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSelectedCatId(cat.id); setEditArt(null); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group"
                    style={selectedCatId === cat.id
                      ? { background: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.3)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#9D9C9D' }
                    }
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="flex-1 text-xs font-bold truncate">{cat.title}</span>
                    <span className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditCat({ id: cat.id, title: cat.title, icon: cat.icon }); }}
                        className="p-1 rounded text-neutral-500 hover:text-white"
                        title="Sửa"
                      >✏️</button>
                      <button
                        onClick={e => { e.stopPropagation(); removeCat(cat.id); }}
                        className="p-1 rounded text-neutral-500 hover:text-red-400"
                        title="Xóa"
                      >🗑️</button>
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Articles ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4">
        {!selectedCatId ? (
          <div className="flex items-center justify-center flex-1 text-neutral-600 text-sm">
            ← Chọn danh mục để xem bài viết
          </div>
        ) : editArt ? (
          /* Article Editor */
          <div className="bg-[#1a1a1a] border border-primary/10 rounded-[20px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                {editArt.id ? 'Sửa bài viết' : 'Bài viết mới'} — {selectedCat?.icon} {selectedCat?.title}
              </span>
              <button onClick={() => setEditArt(null)} className="text-neutral-500 hover:text-white text-sm">✕ Hủy</button>
            </div>

            <input
              autoFocus
              value={editArt.title ?? ''}
              onChange={e => setEditArt(a => a && { ...a, title: e.target.value })}
              className="bg-[#111] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-bold placeholder-neutral-600 w-full"
              placeholder="Tiêu đề bài viết..."
            />

            <textarea
              value={editArt.content ?? ''}
              onChange={e => setEditArt(a => a && { ...a, content: e.target.value })}
              className="bg-[#111] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-neutral-600 w-full resize-y leading-relaxed"
              placeholder="Nội dung chính sách, quy định... (hỗ trợ xuống dòng tự do)"
              rows={16}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setEditArt(a => a && { ...a, is_published: !a.is_published })}
                    className="w-10 h-5 rounded-full transition-all relative"
                    style={{ background: editArt.is_published ? '#FF9500' : 'rgba(255,255,255,0.1)' }}
                  >
                    <div className="absolute top-0.5 transition-all w-4 h-4 bg-white rounded-full shadow"
                      style={{ left: editArt.is_published ? '22px' : '2px' }} />
                  </div>
                  <span className="text-xs font-bold text-neutral-400">
                    {editArt.is_published ? '✅ Đang công khai' : '⬜ Bản nháp'}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setEditArt(a => a && { ...a, is_required: !a.is_required })}
                    className="w-10 h-5 rounded-full transition-all relative"
                    style={{ background: editArt.is_required ? '#FF9500' : 'rgba(255,255,255,0.1)' }}
                  >
                    <div className="absolute top-0.5 transition-all w-4 h-4 bg-white rounded-full shadow"
                      style={{ left: editArt.is_required ? '22px' : '2px' }} />
                  </div>
                  <span className="text-xs font-bold text-neutral-400">
                    {editArt.is_required ? '📌 Bắt buộc onboarding' : '⬜ Không bắt buộc'}
                  </span>
                </label>
              </div>

              <button
                onClick={saveArt}
                disabled={saving || !editArt.title?.trim()}
                className="px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40"
                style={{ background: '#FF9500', color: '#fff' }}
              >
                {saving ? 'Đang lưu...' : 'Lưu bài viết'}
              </button>
            </div>
          </div>
        ) : (
          /* Article List */
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">
                {selectedCat?.icon} {selectedCat?.title}
                <span className="ml-2 text-neutral-600 font-bold text-xs">({articles.length} bài)</span>
              </span>
              <button
                onClick={() => setEditArt({ ...EMPTY_ART, isNew: true })}
                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#FF9500', color: '#fff' }}
              >
                + Bài viết mới
              </button>
            </div>

            {loadingArts ? (
              <p className="text-neutral-600 text-sm py-8 text-center">Đang tải...</p>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-neutral-600">
                <span className="text-4xl">📝</span>
                <p className="text-sm">Chưa có bài viết nào</p>
                <button
                  onClick={() => setEditArt({ ...EMPTY_ART, isNew: true })}
                  className="text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-neutral-400 hover:text-white transition-all"
                >
                  + Tạo bài viết đầu tiên
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {articles.map(art => (
                  <div
                    key={art.id}
                    className="bg-[#1a1a1a] border border-primary/10 rounded-[20px] px-4 py-3 flex items-start gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-bold truncate">{art.title}</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${art.is_published ? 'bg-green-500/15 text-green-400' : 'bg-white/8 text-neutral-500'}`}>
                          {art.is_published ? 'Công khai' : 'Nháp'}
                        </span>
                        {art.is_required && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">
                            📌 Bắt buộc
                          </span>
                        )}
                      </div>
                      {art.content && (
                        <p className="text-neutral-500 text-xs leading-snug line-clamp-2">
                          {art.content.slice(0, 120)}{art.content.length > 120 ? '…' : ''}
                        </p>
                      )}
                      <span className="text-neutral-700 text-[10px] mt-1 block">
                        Cập nhật {new Date(art.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <button
                        onClick={() => togglePublish(art)}
                        title={art.is_published ? 'Ẩn bài viết' : 'Công khai'}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/8 transition-all text-xs"
                      >
                        {art.is_published ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={() => setEditArt({ ...art })}
                        title="Sửa"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/8 transition-all text-xs"
                      >✏️</button>
                      <button
                        onClick={() => removeArt(art.id)}
                        title="Xóa"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
                      >🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
