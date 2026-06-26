import React, { useState, useEffect, useMemo } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser, HandbookCategory, HandbookArticle } from '@/types';
import { Navbar } from '@/components/Navbar';
import { ToastNotification } from '@/components/ToastNotification';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import { fetchCategories, fetchArticles } from '../services/handbookService';

interface HandbookAppProps {
  currentUser: AccountUser;
  onBack: () => void;
}

const TAB_LABELS: Record<string, string> = {
  history: '📖 Sổ tay',
};

// ─────────────────────────────────────────────────────────────
export default function HandbookApp({ currentUser, onBack }: HandbookAppProps) {
  const [categories, setCategories]       = useState<HandbookCategory[]>([]);
  const [articles, setArticles]           = useState<HandbookArticle[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HandbookArticle | null>(null);
  const [search, setSearch]               = useState('');
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { rate: vcbRate, loading: vcbRateLoading } = useExchangeRate();

  // Load all published data once
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchArticles(undefined, true)])
      .then(([cats, arts]) => {
        setCategories(cats);
        setArticles(arts);
        if (cats.length > 0) setSelectedCatId(cats[0].id);
      })
      .catch((e: any) => setToast({ message: e.message, type: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  // Filtered articles based on category + search
  const visibleArticles = useMemo(() => {
    let list = articles;
    if (selectedCatId && !search) list = list.filter(a => a.category_id === selectedCatId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [articles, selectedCatId, search]);

  // Count articles per category
  const articleCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    articles.forEach(a => { map[a.category_id] = (map[a.category_id] ?? 0) + 1; });
    return map;
  }, [articles]);

  const handleSelectArticle = (art: HandbookArticle) => {
    setSelectedArticle(art);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => setSelectedArticle(null);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {toast && (
        <ToastNotification
          message={{ text: toast.message, type: toast.type }}
          onDismiss={() => setToast(null)}
        />
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab="history"
        accessibleTabs={['history']}
        onTabChange={() => {}}
        onLogout={onBack}
        onBack={onBack}
        vcbRate={vcbRate}
        vcbRateLoading={vcbRateLoading}
        appName="Sổ tay"
        tabLabels={TAB_LABELS}
      />

      <main className="flex-1 p-6 md:p-10 max-w-[1400px] mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-40 text-neutral-600 text-sm">Đang tải...</div>
        ) : (
          <div className="flex gap-6">
            {/* ── Sidebar: Categories ────────────────────────── */}
            <aside className="w-64 flex-shrink-0 flex flex-col gap-2">
              {/* Search */}
              <div className="relative mb-2">
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedArticle(null); if (e.target.value) setSelectedCatId(null); }}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 pl-8 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-primary/40"
                  placeholder="Tìm kiếm..."
                />
                <span className="absolute left-2.5 top-2.5 text-neutral-600 text-sm">🔍</span>
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-neutral-600 hover:text-white text-xs">✕</button>
                )}
              </div>

              {/* "Tất cả" pill (only when not searching) */}
              {!search && (
                <button
                  onClick={() => { setSelectedCatId(null); setSelectedArticle(null); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition-all"
                  style={!selectedCatId
                    ? { background: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.3)', color: '#FF9500' }
                    : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#9D9C9D' }
                  }
                >
                  <span>📚</span>
                  <span className="flex-1">Tất cả</span>
                  <span className="text-[10px] font-black opacity-50">{articles.length}</span>
                </button>
              )}

              {!search && categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCatId(cat.id); setSelectedArticle(null); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all"
                  style={selectedCatId === cat.id
                    ? { background: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.3)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#9D9C9D' }
                  }
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1 leading-snug">{cat.title}</span>
                  {(articleCountMap[cat.id] ?? 0) > 0 && (
                    <span className="text-[10px] font-black opacity-40">{articleCountMap[cat.id]}</span>
                  )}
                </button>
              ))}
            </aside>

            {/* ── Main content ──────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Article Reader */}
              {selectedArticle ? (
                <ArticleReader article={selectedArticle} onBack={handleBackToList} />
              ) : (
                /* Article List */
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="mb-2">
                    {search ? (
                      <p className="text-neutral-500 text-sm">
                        Kết quả cho <span className="text-white font-bold">"{search}"</span> — {visibleArticles.length} bài
                      </p>
                    ) : (
                      <p className="text-neutral-500 text-sm">
                        {selectedCatId
                          ? `${categories.find(c => c.id === selectedCatId)?.icon} ${categories.find(c => c.id === selectedCatId)?.title}`
                          : '📚 Tất cả bài viết'}
                        <span className="ml-2 text-neutral-700">({visibleArticles.length} bài)</span>
                      </p>
                    )}
                  </div>

                  {visibleArticles.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-24 text-neutral-600">
                      <span className="text-4xl">{search ? '🔍' : '📭'}</span>
                      <p className="text-sm">{search ? 'Không tìm thấy bài nào' : 'Danh mục này chưa có bài viết'}</p>
                    </div>
                  ) : (
                    visibleArticles.map(art => (
                      <ArticleCard
                        key={art.id}
                        article={art}
                        category={categories.find(c => c.id === art.category_id)}
                        showCategory={!selectedCatId || !!search}
                        onClick={() => handleSelectArticle(art)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Sổ tay nhân viên
      </footer>
    </div>
  );
}

// ── Article Card (list view) ──────────────────────────────────
interface ArticleCardProps {
  article: HandbookArticle;
  category?: HandbookCategory;
  showCategory: boolean;
  onClick: () => void;
}

function ArticleCard({ article, category, showCategory, onClick }: ArticleCardProps) {
  const preview = article.content.replace(/\n+/g, ' ').slice(0, 160);
  return (
    <button
      onClick={onClick}
      className="bg-surface border border-white/8 rounded-xl px-5 py-4 text-left w-full hover:border-white/20 transition-all group"
    >
      {showCategory && category && (
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-2 block">
          {category.icon} {category.title}
        </span>
      )}
      <h3 className="text-white font-bold text-sm mb-1.5 group-hover:text-primary transition-colors">
        {article.title}
      </h3>
      {preview && (
        <p className="text-neutral-500 text-xs leading-relaxed line-clamp-2">{preview}{article.content.length > 160 ? '…' : ''}</p>
      )}
      <span className="text-neutral-700 text-[10px] mt-2 block">
        Cập nhật {new Date(article.updated_at).toLocaleDateString('vi-VN')}
      </span>
    </button>
  );
}

// ── Article Reader (detail view) ──────────────────────────────
interface ArticleReaderProps {
  article: HandbookArticle;
  onBack: () => void;
}

function ArticleReader({ article, onBack }: ArticleReaderProps) {
  return (
    <div className="bg-surface border border-white/8 rounded-xl p-6 md:p-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors text-xs font-bold mb-6"
      >
        ← Quay lại danh sách
      </button>

      <h1 className="text-white text-xl font-black mb-3 leading-snug">{article.title}</h1>
      <p className="text-neutral-600 text-[10px] font-black uppercase tracking-wider mb-8">
        Cập nhật {new Date(article.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </p>

      <div
        className="text-neutral-300 text-sm leading-7 whitespace-pre-wrap"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        {article.content || <span className="text-neutral-700 italic">Bài viết chưa có nội dung.</span>}
      </div>
    </div>
  );
}
