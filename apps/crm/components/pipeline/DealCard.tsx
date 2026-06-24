import React, { useState } from 'react';
import type { CrmDeal } from '@/types';
import { STAGE_MAP, fmtValue, fmtDate } from './constants';

interface Props {
  deal: CrmDeal;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

/** Days since last update (proxy for "days in current stage") */
const daysInStage = (updatedAt: string): number => {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

const DealCard: React.FC<Props> = ({ deal, onClick, onDragStart, onDragEnd }) => {
  const stage = STAGE_MAP[deal.stage];
  const [isDragging, setIsDragging] = useState(false);
  const days = daysInStage(deal.updated_at);

  return (
    <div
      draggable
      onDragStart={(e) => { setIsDragging(true); onDragStart(e); }}
      onDragEnd={() => { setIsDragging(false); onDragEnd(); }}
      onClick={onClick}
      className="rounded-xl border border-white/8 p-3.5 cursor-grab hover:border-white/15 transition-all active:cursor-grabbing"
      style={{
        background: 'rgba(255,255,255,0.02)',
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Client + Value */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600 truncate">
          {deal.client_name || 'No client'}
        </p>
        <span className="text-xs font-black text-white whitespace-nowrap">
          {fmtValue(deal.value, deal.currency)}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-white mb-2 line-clamp-2 leading-snug">{deal.title}</p>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-neutral-500">{fmtDate(deal.expected_close_date)}</span>
        <div className="flex items-center gap-1.5">
          {days > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              days > 30 ? 'text-red-400 bg-red-500/10' :
              days > 14 ? 'text-yellow-400 bg-yellow-500/10' :
              'text-neutral-500 bg-white/5'
            }`}>
              {days}d
            </span>
          )}
          {deal.probability > 0 && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
              style={{ background: `${stage.color}20`, color: stage.color }}
            >
              {deal.probability}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealCard;
