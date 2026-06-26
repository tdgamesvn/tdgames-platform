import React, { useState, useEffect } from 'react';
import { AccountUser } from '@/types';
import { fetchRequiredArticles, submitOnboardingAcks } from '@/apps/handbook/services/handbookService';
import type { HandbookArticle } from '@/types';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Props {
  currentUser: AccountUser;
  onComplete: () => void;
}

export function OnboardingScreen({ currentUser, onComplete }: Props) {
  const [articles, setArticles] = useState<HandbookArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchRequiredArticles()
      .then(arts => {
        setArticles(arts);
        // Auto-expand bài đầu tiên
        if (arts.length > 0) setExpandedId(arts[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const allChecked = articles.length > 0 && checked.size === articles.length;

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-expand bài tiếp theo chưa xác nhận
        const currentIdx = articles.findIndex(a => a.id === id);
        const nextArticle = articles.slice(currentIdx + 1).find(a => !next.has(a.id));
        if (nextArticle) {
          setExpandedId(nextArticle.id);
          // Scroll tới bài tiếp theo sau khi DOM cập nhật
          setTimeout(() => {
            document.getElementById(`onboarding-article-${nextArticle.id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        } else {
          // Đã xác nhận hết — collapse bài hiện tại
          setExpandedId(null);
        }
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allChecked || !currentUser.employee_id) return;
    setSubmitting(true);
    setError('');
    try {
      await submitOnboardingAcks(currentUser.employee_id, [...checked]);
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu xác nhận');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <p className="text-neutral-600 text-sm animate-pulse">Đang tải nội quy công ty...</p>
      </div>
    );
  }

  // Success screen — sau khi submit xong
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6" style={{ backgroundColor: '#0F0F0F' }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute rounded-full blur-[120px] opacity-20"
            style={{ width: '500px', height: '500px', background: 'radial-gradient(circle, #FF9500 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center gap-6">
          {/* Checkmark */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: 'rgba(52,199,89,0.12)', border: '2px solid rgba(52,199,89,0.3)' }}>
            ✅
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-2">Hoàn tất onboarding!</h2>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Bạn đã xác nhận đầy đủ nội quy. Tham gia Discord để kết nối với đồng đội nhé!
            </p>
          </div>

          {/* Discord CTA */}
          <a
            href="https://discord.gg/jKUP2MM9r"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 rounded-[20px] flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#5865F2', color: '#fff' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.136 18.116a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Discord TD Games
          </a>

          {/* Skip / Enter app */}
          <button
            onClick={onComplete}
            className="text-neutral-600 text-xs font-black uppercase tracking-widest hover:text-neutral-400 transition-colors"
          >
            Vào app →
          </button>
        </div>
      </div>
    );
  }

  // Nếu không có bài nào bắt buộc (admin chưa set) — bỏ qua
  if (articles.length === 0) {
    onComplete();
    return null;
  }

  const doneCount = checked.size;
  const totalCount = articles.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full blur-[120px] opacity-15"
          style={{ width: '600px', height: '600px', background: 'radial-gradient(circle, #FF9500 0%, transparent 70%)', top: '-200px', left: '-150px' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 pt-12 pb-8 px-6 text-center">
        <img
          src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png"
          alt="TD Games"
          className="w-12 h-12 object-contain mx-auto mb-4"
        />
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">
          Chào mừng, {currentUser.username}! 👋
        </h1>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Trước khi bắt đầu, vui lòng đọc và xác nhận từng nội quy bắt buộc dưới đây.
        </p>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 px-6 max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Tiến độ xác nhận</span>
          <span className="text-[10px] font-black text-primary">{doneCount}/{totalCount} bài</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: '#FF9500' }}
          />
        </div>
      </div>

      {/* Article list */}
      <main className="relative z-10 flex-1 px-6 max-w-2xl mx-auto w-full space-y-3 pb-8">
        {articles.map((art, idx) => {
          const isChecked = checked.has(art.id);
          const isExpanded = expandedId === art.id;

          return (
            <div
              key={art.id}
              id={`onboarding-article-${art.id}`}
              className="rounded-[20px] border transition-all overflow-hidden"
              style={{
                borderColor: isChecked ? 'rgba(52,199,89,0.3)' : 'rgba(255,149,0,0.15)',
                background: isChecked ? 'rgba(52,199,89,0.04)' : 'rgba(255,149,0,0.03)',
              }}
            >
              {/* Article header — click to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : art.id)}
                className="w-full flex items-center gap-4 p-4 text-left"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: isChecked ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.1)', color: isChecked ? '#34C759' : '#FF9500' }}>
                  {isChecked ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${isChecked ? 'text-neutral-400 line-through' : 'text-white'}`}>
                    {art.title}
                  </p>
                </div>
                <span className="text-neutral-600 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Article content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="border-t border-white/5 pt-4">
                    <MarkdownRenderer content={art.content} />
                  </div>

                  {/* Acknowledge checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:border-primary/20 transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(art.id)}
                      className="w-4 h-4 mt-0.5 accent-orange-500 flex-shrink-0"
                    />
                    <span className="text-xs text-neutral-400 leading-snug">
                      Tôi đã đọc và hiểu nội quy này. Tôi đồng ý tuân thủ theo quy định của công ty.
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Footer CTA */}
      <footer className="relative z-10 px-6 py-6 border-t border-white/5 max-w-2xl mx-auto w-full">
        {error && (
          <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          className="w-full py-4 rounded-[20px] font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: allChecked ? '#FF9500' : 'rgba(255,149,0,0.2)', color: allChecked ? '#000' : '#FF9500' }}
        >
          {submitting ? 'Đang lưu...' : allChecked ? '🚀 Bắt đầu sử dụng TD Games Platform' : `Còn ${totalCount - doneCount} bài chưa xác nhận`}
        </button>
        <p className="text-center text-neutral-700 text-[10px] mt-3">
          Bằng cách ấn nút trên, bạn xác nhận đã đọc và đồng ý toàn bộ nội quy.
        </p>
      </footer>
    </div>
  );
}
