import React, { useState, useEffect, useMemo } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser, HandbookCategory, HandbookArticle, HrEmployee, HrDepartment } from '@/types';
import { Navbar } from '@/components/Navbar';
import { ToastNotification } from '@/components/ToastNotification';
import { fetchCategories, fetchArticles } from '../services/handbookService';
import { fetchEmployeeDirectory, fetchDepartments } from '@/apps/portal/services/portalService';
import { toPublicUrl } from '@/apps/hr/services/hrService';

interface HandbookAppProps {
  currentUser: AccountUser;
  onBack: () => void;
}

type DirectoryEmployee = Pick<
  HrEmployee,
  'id' | 'full_name' | 'email' | 'work_email' | 'phone' | 'position' | 'avatar_url' | 'status' | 'type' | 'department_id' | 'date_of_birth' | 'address'
>;
type DepartmentLite = Pick<HrDepartment, 'id' | 'name'>;
type HandbookTab = 'articles' | 'directory';

const TAB_LABELS: Record<string, string> = {
  history:  '🏢 Company Hub',
  activity: '👥 Danh bạ',
};
const TAB_MAP: Record<HandbookTab, string> = {
  articles:  'history',
  directory: 'activity',
};
const REVERSE_TAB: Record<string, HandbookTab> = {
  history:  'articles',
  activity: 'directory',
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

  const [activeTab, setActiveTab]       = useState<HandbookTab>('articles');
  const [showRequired, setShowRequired] = useState(false);
  const [employees, setEmployees]       = useState<DirectoryEmployee[]>([]);
  const [departments, setDepartments]   = useState<DepartmentLite[]>([]);
  const [dirLoading, setDirLoading]     = useState(false);

  const navbarTab = TAB_MAP[activeTab];
  const handleNavChange = (tab: string) => {
    const mapped = REVERSE_TAB[tab];
    if (mapped) setActiveTab(mapped);
  };
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

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

  // Lazy-load employee directory on first activation
  useEffect(() => {
    if (activeTab !== 'directory') return;
    if (employees.length > 0) return; // already loaded
    setDirLoading(true);
    Promise.all([fetchEmployeeDirectory(), fetchDepartments()])
      .then(([emps, deps]) => { setEmployees(emps); setDepartments(deps); })
      .catch((e: any) => setToast({ message: e.message, type: 'error' }))
      .finally(() => setDirLoading(false));
  }, [activeTab]);

  // Count required articles
  const requiredCount = useMemo(() => articles.filter(a => a.is_required).length, [articles]);

  // Filtered articles based on category + search + required filter
  const visibleArticles = useMemo(() => {
    if (showRequired) return articles.filter(a => a.is_required);
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
  }, [articles, selectedCatId, search, showRequired]);

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
        activeTab={navbarTab}
        accessibleTabs={['history', 'activity']}
        onTabChange={handleNavChange}
        onLogout={onBack}
        onBack={onBack}
        appName="Company Hub"
        tabLabels={TAB_LABELS}
      />

      <main className="flex-1 p-6 md:p-10 max-w-[1400px] mx-auto w-full">

        {/* ── Directory tab ── */}
        {activeTab === 'directory' && (
          <div className="animate-fadeInUp">
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                👥 Danh bạ nhân viên
              </h2>
              <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
                Thông tin liên lạc nội bộ — read only
              </p>
            </div>
            {dirLoading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
              </div>
            ) : employees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
                <p style={{ fontSize: '48px', marginBottom: '12px' }}>👤</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có nhân viên nào</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {employees.map(emp => {
                  const avatarSrc = emp.avatar_url ? toPublicUrl(emp.avatar_url) : '';
                  return (
                    <div key={emp.id} style={{
                      background: '#161616', border: '1px solid #222', borderRadius: '20px',
                      display: 'flex', overflow: 'hidden',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D440'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; }}
                    >
                      {/* Avatar — full height */}
                      <div style={{
                        width: '120px', minHeight: '140px', flexShrink: 0,
                        background: avatarSrc
                          ? `url(${avatarSrc}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRight: '1px solid #222',
                      }}>
                        {!avatarSrc && (
                          <span style={{ fontSize: '40px', fontWeight: 900, color: '#fff', opacity: 0.8 }}>
                            {emp.full_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <p style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>{emp.full_name}</p>
                          <span style={{
                            fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                            textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0,
                            background: emp.status === 'active' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                            color: emp.status === 'active' ? '#34C759' : '#FF3B30',
                          }}>
                            {emp.type === 'fulltime' ? 'FT' : emp.type === 'parttime' ? 'PT' : 'FL'}
                          </span>
                        </div>
                        {emp.position && (
                          <p style={{ fontSize: '13px', color: '#06B6D4', fontWeight: 600 }}>{emp.position}</p>
                        )}
                        {emp.department_id && deptMap[emp.department_id] && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '6px',
                            background: 'rgba(6,182,212,0.08)', color: '#06B6D4', alignSelf: 'flex-start',
                          }}>
                            {deptMap[emp.department_id]}
                          </span>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                          {emp.work_email && <span style={{ fontSize: '11px', color: '#888' }}>💼 {emp.work_email}</span>}
                          {emp.phone && <span style={{ fontSize: '11px', color: '#888' }}>📱 {emp.phone}</span>}
                          {emp.date_of_birth && (
                            <span style={{ fontSize: '11px', color: '#888' }}>🎂 {new Date(emp.date_of_birth).toLocaleDateString('vi-VN')}</span>
                          )}
                          {emp.address && (
                            <span style={{ fontSize: '11px', color: '#888', lineHeight: '1.3' }}>📍 {emp.address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Articles tab ── */}
        {activeTab === 'articles' && (loading ? (
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

              {/* 📌 Bắt buộc đọc — top of sidebar */}
              {!search && requiredCount > 0 && (
                <button
                  onClick={() => { setShowRequired(true); setSelectedCatId(null); setSelectedArticle(null); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all"
                  style={showRequired
                    ? { background: 'rgba(255,149,0,0.12)', borderColor: 'rgba(255,149,0,0.4)', color: '#FF9500' }
                    : { background: 'rgba(255,149,0,0.05)', borderColor: 'rgba(255,149,0,0.2)', color: 'rgba(255,149,0,0.75)' }
                  }
                >
                  <span className="text-base">📌</span>
                  <span className="flex-1">Bắt buộc đọc</span>
                  <span className="text-[10px] font-black" style={{ opacity: showRequired ? 0.8 : 0.5 }}>{requiredCount}</span>
                </button>
              )}

              {/* "Tất cả" pill (only when not searching) */}
              {!search && (
                <button
                  onClick={() => { setSelectedCatId(null); setSelectedArticle(null); setShowRequired(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition-all"
                  style={!selectedCatId && !showRequired
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
                  onClick={() => { setSelectedCatId(cat.id); setSelectedArticle(null); setShowRequired(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all"
                  style={!showRequired && selectedCatId === cat.id
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
                    ) : showRequired ? (
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black" style={{ color: '#FF9500' }}>
                          📌 Bắt buộc đọc
                        </p>
                        <span className="text-neutral-700 text-xs">({visibleArticles.length} bài)</span>
                      </div>
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
                        showCategory={!selectedCatId || !!search || showRequired}
                        isRequired={art.is_required}
                        onClick={() => handleSelectArticle(art)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>

      <footer className="py-12 border-t border-white/5 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Company Hub
      </footer>
    </div>
  );
}

// ── Article Card (list view) ──────────────────────────────────
interface ArticleCardProps {
  article: HandbookArticle;
  category?: HandbookCategory;
  showCategory: boolean;
  isRequired?: boolean;
  onClick: () => void;
}

function ArticleCard({ article, category, showCategory, isRequired, onClick }: ArticleCardProps) {
  const preview = article.content.replace(/\n+/g, ' ').slice(0, 160);
  return (
    <button
      onClick={onClick}
      className="bg-surface border border-primary/10 rounded-[20px] px-5 py-4 text-left w-full hover:border-primary/25 transition-all group"
      style={isRequired ? { borderColor: 'rgba(255,149,0,0.2)' } : {}}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {showCategory && category && (
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
            {category.icon} {category.title}
          </span>
        )}
        {isRequired && (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 flex-shrink-0">
            📌 Bắt buộc
          </span>
        )}
      </div>
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
    <div className="bg-surface border border-primary/10 rounded-[20px] p-6 md:p-8">
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
