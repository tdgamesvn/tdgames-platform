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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allChecked || !currentUser.employee_id) return;
    setSubmitting(true);
    setError('');
    try {
      await submitOnboardingAcks(currentUser.employee_id, [...checked]);
      onComplete();
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
