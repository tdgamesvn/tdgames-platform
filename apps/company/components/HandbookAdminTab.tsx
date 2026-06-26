import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HandbookCategory, HandbookArticle } from '@/types';
import {
  fetchCategories, createCategory, updateCategory, deleteCategory,
  fetchArticles, createArticle, updateArticle, deleteArticle,
  fetchAdminRequiredArticles, batchUpdateArticleOrder,
} from '@/apps/handbook/services/handbookService';

interface Props {
  adminUserId: string;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const EMPTY_CAT = { title: '', icon: '📄' };
const EMPTY_ART = { title: '', content: '', is_published: false, is_required: false };

// ─────────────────────────────────────────────────────────────
export default function HandbookAdminTab({ adminUserId, onToast }: Props) {
  const [categories, setCategories]       = useState<HandbookCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [articles, setArticles]           = useState<HandbookArticle[]>([]);
  const [loadingCats, setLoadingCats]     = useState(true);
  const [loadingArts, setLoadingArts]     = useState(false);
  const [showRequired, setShowRequired]   = useState(false);

  // Editing state
  const [editCat, setEditCat] = useState<{ id?: string; title: string; icon: string } | null>(null);
  const [editArt, setEditArt] = useState<Partial<HandbookArticle> & { isNew?: boolean } | null>(null);
  const [saving, setSaving]   = useState(false);

  // Drag-to-reorder state
  const dragIndexRef  = useRef<number | null>(null);
  const [dragOver, setDragOver]   = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── load categories ─────────────────────────────────────────
  const loadCats = useCallback(async () => {
    setLoadingCats(true);
    try { setCategories(await fetchCategories()); }
    catch (e: any) { onToast(e.message, 'error'); }
    finally { setLoadingCats(false); }
  }, [onToast]);

  useEffect(() => { loadCats(); }, [loadCats]);

  // ── load articles ──────────────────────────────────────────
  useEffect(() => {
    if (showRequired) {
      setLoadingArts(true);
      fetchAdminRequiredArticles()
        .then(setArticles)
        .catch((e: any) => onToast(e.message, 'error'))
        .finally(() => setLoadingArts(false));
      return;
    }
    if (!selectedCatId) { setArticles([]); return; }
    setLoadingArts(true);
    fetchArticles(selectedCatId)
      .then(setArticles)
      .catch((e: any) => onToast(e.message, 'error'))
      .finally(() => setLoadingArts(false));
  }, [selectedCatId, showRequired, onToast]);

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
        setShowRequired(false);
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
    // In required view, use the article's own category_id (editing only, no new article)
    const catId = showRequired ? (editArt?.category_id ?? null) : selectedCatId;
    if (!editArt || !editArt.title?.trim() || !catId) return;
    setSaving(true);
    try {
      if (editArt.id) {
        const updated = await updateArticle(editArt.id, {
          title: editArt.title.trim(),
          content: editArt.content ?? '',
          is_published: editArt.is_published ?? false,
          is_required: editArt.is_required ?? false,
        });
        if (showRequired && !updated.is_required) {
          // Removed required flag → remove from list
          setArticles(as => as.filter(a => a.id !== updated.id));
        } else {
          setArticles(as => as.map(a => a.id === updated.id ? updated : a));
        }
        onToast('Đã cập nhật bài viết', 'success');
      } else {
        const created = await createArticle({
          category_id: catId,
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

  const toggleRequired = async (art: HandbookArticle) => {
    try {
      const updated = await updateArticle(art.id, { is_required: !art.is_required });
      if (showRequired && !updated.is_required) {
        // Unchecked in required view → remove from list
        setArticles(as => as.filter(a => a.id !== updated.id));
      } else {
        setArticles(as => as.map(a => a.id === updated.id ? updated : a));
      }
      onToast(updated.is_required ? '📌 Đã đánh dấu bắt buộc' : 'Đã bỏ đánh dấu bắt buộc', 'success');
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

  // ── Drag-to-reorder handlers ────────────────────────────────
  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDragOver(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      dragIndexRef.current = null;
      setDragOver(null);
      setIsDragging(false);
      return;
    }

    // Reorder articles array
    const reordered = [...articles];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    // Assign new order_index (0-based sequential)
    const updated = reordered.map((a, i) => ({ ...a, order_index: i }));
    setArticles(updated);

    dragIndexRef.current = null;
    setDragOver(null);
    setIsDragging(false);

    // Persist to DB
    try {
      await batchUpdateArticleOrder(updated.map(a => ({ id: a.id, order_index: a.order_index })));
      onToast('Đã cập nhật thứ tự', 'success');
    } catch (e: any) {
      onToast(e.message, 'error');
      // Revert on error
      setArticles(articles);
    }
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOver(null);
    setIsDragging(false);
  };

  // ── Helpers ─────────────────────────────────────────────────
  const selectedCat = categories.find(c => c.id === selectedCatId);
  const isRightVisible = showRequired || !!selectedCatId;

  // In required view: look up category name from categories list
  const getCatLabel = (catId: string) => {
    const c = categories.find(c => c.id === catId);
    return c ? `${c.icon} ${c.title}` : '—';
  };

  const rightTitle = showRequired
    ? `📌 Bắt buộc onboarding`
    : `${selectedCat?.icon ?? ''} ${selectedCat?.title ?? ''}`;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* ── LEFT: Categories + Required pill ─────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">

        {/* 📌 Bắt buộc đọc — special view */}
        <button
          onClick={() => { setShowRequired(true); setSelectedCatId(null); setEditArt(null); setEditCat(null); }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all"
          style={showRequired
            ? { background: 'rgba(255,149,0,0.12)', borderColor: 'rgba(255,149,0,0.4)', color: '#FF9500' }
            : { background: 'rgba(255,149,0,0.04)', borderColor: 'rgba(255,149,0,0.18)', color: 'rgba(255,149,0,0.65)' }
          }
        >
          <span className="text-base">📌</span>
          <span className="flex-1">Bắt buộc đọc</span>
          {showRequired && articles.length > 0 && (
            <span className="text-[10px] font-black opacity-70">{articles.length}</span>
          )}
        </button>

        <div className="border-t border-white/6 pt-1" />

        {/* Danh mục header + add button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Danh mục</span>
          <button
            onClick={() => { setEditCat({ ...EMPTY_CAT }); setEditArt(null); }}
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
            style={{ background: '#FF9500', color: '#fff' }}
          >
            + Thêm
          </button>
        </div>

        {/* Category form (inline, new) */}
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
                    onClick={() => { setSelectedCatId(cat.id); setShowRequired(false); setEditArt(null); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group"
                    style={!showRequired && selectedCatId === cat.id
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
        {!isRightVisible ? (
          <div className="flex items-center justify-center flex-1 text-neutral-600 text-sm">
            ← Chọn danh mục hoặc xem <span className="text-orange-400/60 font-bold mx-1">📌 Bắt buộc đọc</span>
          </div>
        ) : editArt ? (
          /* ── Article Editor ─────────────────────────────── */
          <div className="bg-[#1a1a1a] border border-primary/10 rounded-[20px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                {editArt.id ? 'Sửa bài viết' : 'Bài viết mới'}
                {' — '}
                {showRequired && editArt.category_id
                  ? getCatLabel(editArt.category_id)
                  : `${selectedCat?.icon} ${selectedCat?.title}`}
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
              placeholder="Nội dung chính sách, quy định..."
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
          /* ── Article List ────────────────────────────────── */
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">
                {rightTitle}
                <span className="ml-2 text-neutral-600 font-bold text-xs">({articles.length} bài)</span>
              </span>
              {/* Only show "new article" button when in a category view */}
              {!showRequired && (
                <button
                  onClick={() => setEditArt({ ...EMPTY_ART, isNew: true })}
                  className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: '#FF9500', color: '#fff' }}
                >
                  + Bài viết mới
                </button>
              )}
            </div>

            {loadingArts ? (
              <p className="text-neutral-600 text-sm py-8 text-center">Đang tải...</p>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-neutral-600">
                <span className="text-4xl">{showRequired ? '📌' : '📝'}</span>
                <p className="text-sm">
                  {showRequired
                    ? 'Chưa có bài nào được đánh dấu bắt buộc'
                    : 'Chưa có bài viết nào'}
                </p>
                {showRequired && (
                  <p className="text-xs text-neutral-700 text-center max-w-[280px] leading-relaxed">
                    Vào từng danh mục → sửa bài viết → bật toggle <strong>📌 Bắt buộc onboarding</strong>
                  </p>
                )}
                {!showRequired && (
                  <button
                    onClick={() => setEditArt({ ...EMPTY_ART, isNew: true })}
                    className="text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-neutral-400 hover:text-white transition-all"
                  >
                    + Tạo bài viết đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* In required view, show an info banner */}
                {showRequired && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-orange-500/8 border border-orange-500/15 mb-1">
                    <span className="text-sm mt-0.5">ℹ️</span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Nhân viên mới sẽ bắt buộc đọc và xác nhận <strong className="text-white">{articles.length} bài</strong> này khi lần đầu đăng nhập.
                      Bấm <strong>📌</strong> để bật/tắt nhanh.
                    </p>
                  </div>
                )}

                {articles.map((art, idx) => (
                  <div
                    key={art.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="bg-[#1a1a1a] border rounded-[20px] px-4 py-3 flex items-start gap-3 group transition-all"
                    style={{
                      borderColor: dragOver === idx
                        ? 'rgba(255,149,0,0.5)'
                        : 'rgba(255,149,0,0.1)',
                      opacity: isDragging && dragIndexRef.current === idx ? 0.4 : 1,
                      cursor: isDragging ? 'grabbing' : 'default',
                      background: dragOver === idx ? 'rgba(255,149,0,0.06)' : '#1a1a1a',
                    }}
                  >
                    {/* Drag handle */}
                    <div
                      className="flex-shrink-0 flex items-center self-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 select-none"
                      title="Kéo để sắp xếp"
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
                        <circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/>
                        <circle cx="2.5" cy="13.5" r="1.5"/><circle cx="7.5" cy="13.5" r="1.5"/>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-bold truncate">{art.title}</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${art.is_published ? 'bg-green-500/15 text-green-400' : 'bg-white/8 text-neutral-500'}`}>
                          {art.is_published ? 'Công khai' : 'Nháp'}
                        </span>
                        {art.is_required && !showRequired && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">
                            📌 Bắt buộc
                          </span>
                        )}
                      </div>

                      {/* In required view: show which category this article belongs to */}
                      {showRequired && (
                        <span className="text-[10px] text-neutral-600 font-bold mb-1 block">
                          {getCatLabel(art.category_id)}
                        </span>
                      )}

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
                      {/* Quick required toggle */}
                      <button
                        onClick={() => toggleRequired(art)}
                        title={art.is_required ? 'Bỏ bắt buộc' : 'Đánh dấu bắt buộc'}
                        className="p-1.5 rounded-lg transition-all text-xs"
                        style={art.is_required
                          ? { color: '#FF9500', background: 'rgba(255,149,0,0.1)' }
                          : { color: '#555', background: 'transparent' }
                        }
                        onMouseEnter={e => { if (!art.is_required) e.currentTarget.style.color = '#FF9500'; }}
                        onMouseLeave={e => { if (!art.is_required) e.currentTarget.style.color = '#555'; }}
                      >
                        📌
                      </button>
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
