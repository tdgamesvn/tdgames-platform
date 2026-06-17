import React from 'react';
import { AiEpisode } from '../services/aiAgentService';
import { fmtDate } from '../utils';

interface MemoryPanelProps {
  episodes: AiEpisode[];
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ episodes }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base font-black text-white uppercase tracking-wider">🧠 Bộ nhớ Agent</span>
      <span className="text-[9px] font-bold text-neutral-600 uppercase">{episodes.length} sự kiện gần nhất</span>
    </div>
    {episodes.length === 0 ? (
      <div className="text-center py-16">
        <p className="text-3xl mb-3">🧠</p>
        <p className="text-neutral-600 text-sm">Agent chưa có ký ức nào</p>
      </div>
    ) : (
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
        {episodes.map((ep, i) => (
          <div key={ep.id} className="relative pb-4">
            <div className="absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white/20"
              style={{ background: i === 0 ? '#FF9500' : '#1a1a1a' }} />
            <div className="rounded-xl border border-white/8 p-3 ml-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">{ep.event_type}</span>
                <span className="text-[9px] text-neutral-600">{fmtDate(ep.created_at)}</span>
                <span className="text-[9px] font-bold text-neutral-700">imp:{ep.importance}</span>
              </div>
              <p className="text-xs text-neutral-medium leading-relaxed">{ep.summary}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default MemoryPanel;
