import React, { useEffect } from 'react';

export interface HelpSection {
  title: string;
  items: string[];
  type?: 'steps' | 'tips' | 'info' | 'warning';
}

export interface HelpContent {
  tabId: string;
  tabLabel: string;
  icon: string;
  summary: string;
  sections: HelpSection[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  appName: string;
  appIcon: string;
  contents: HelpContent[];     // one per tab
  activeTabId: string;
}

const SECTION_STYLES: Record<string, { border: string; bg: string; iconColor: string; icon: string }> = {
  steps:   { border: 'border-orange-500/30', bg: 'bg-orange-500/5',   iconColor: 'text-orange-400',  icon: '▶' },
  tips:    { border: 'border-sky-500/30',    bg: 'bg-sky-500/5',      iconColor: 'text-sky-400',     icon: '💡' },
  info:    { border: 'border-white/10',      bg: 'bg-white/3',        iconColor: 'text-neutral-400', icon: 'ℹ' },
  warning: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5',   iconColor: 'text-yellow-400',  icon: '⚠' },
};

export default function HelpPanel({ open, onClose, appName, appIcon, contents, activeTabId }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const [selectedTab, setSelectedTab] = React.useState(activeTabId);

  // Sync selected tab when activeTabId changes from parent
  useEffect(() => {
    if (open) setSelectedTab(activeTabId);
  }, [activeTabId, open]);

  const current = contents.find(c => c.tabId === selectedTab) ?? contents[0];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-all duration-300 ${open ? 'bg-black/40 backdrop-blur-sm pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '420px', maxWidth: '95vw', background: '#111111', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{appIcon}</span>
                <span className="text-neutral-500 text-xs uppercase tracking-widest font-bold">Hướng dẫn sử dụng</span>
              </div>
              <h2 className="text-white font-black text-base uppercase tracking-wider">{appName}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/8 transition-all shrink-0 mt-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab pills */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {contents.map(c => (
              <button
                key={c.tabId}
                onClick={() => setSelectedTab(c.tabId)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  selectedTab === c.tabId
                    ? 'text-white'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                }`}
                style={selectedTab === c.tabId ? { background: '#FF9500' } : {}}
              >
                <span>{c.icon}</span>
                <span>{c.tabLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {current && (
            <>
              {/* Summary */}
              <div className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{current.icon}</span>
                  <h3 className="text-white font-black text-sm uppercase tracking-wider">{current.tabLabel}</h3>
                </div>
                <p className="text-neutral-400 text-sm leading-relaxed">{current.summary}</p>
              </div>

              {/* Sections */}
              {current.sections.map((section, si) => {
                const type = section.type ?? 'info';
                const style = SECTION_STYLES[type];
                return (
                  <div key={si} className={`rounded-2xl border ${style.border} ${style.bg} p-4`}>
                    <h4 className={`text-xs font-black uppercase tracking-wider mb-3 ${style.iconColor}`}>
                      {style.icon} {section.title}
                    </h4>
                    <ul className="space-y-2">
                      {section.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2 text-sm text-neutral-300 leading-relaxed">
                          {type === 'steps' ? (
                            <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black flex items-center justify-center mt-0.5">
                              {ii + 1}
                            </span>
                          ) : (
                            <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
                              type === 'warning' ? 'bg-yellow-400' : type === 'tips' ? 'bg-sky-400' : 'bg-neutral-500'
                            }`} />
                          )}
                          <span dangerouslySetInnerHTML={{ __html: item }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/8">
          <p className="text-neutral-600 text-xs text-center">
            Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white/8 text-neutral-400 font-mono text-[10px]">Esc</kbd> để đóng
          </p>
        </div>
      </div>
    </>
  );
}
