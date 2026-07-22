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
      className="rounded-[20px] border border-primary/10 p-3.5 cursor-grab hover:border-primary/20 transition-all active:cursor-grabbing"
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500">{fmtDate(deal.expected_close_date)}</span>
          {deal.next_follow_up && (() => {
            const fuDays = Math.floor((new Date(deal.next_follow_up).getTime() - Date.now()) / 86_400_000);
            const isOverdue = fuDays < 0;
            const isToday = fuDays === 0;
            return (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                isOverdue ? 'text-red-400 bg-red-500/10' :
                isToday ? 'text-orange-400 bg-orange-500/10' :
                'text-blue-400 bg-blue-500/10'
              }`} title={`Follow-up: ${fmtDate(deal.next_follow_up)}`}>
                📌{isOverdue ? `${Math.abs(fuDays)}d` : isToday ? '!' : `${fuDays}d`}
              </span>
            );
          })()}
          {deal.stage_entered_at && !['won', 'lost'].includes(deal.stage) && (() => {
            const agingDays = Math.floor((Date.now() - new Date(deal.stage_entered_at).getTime()) / 86_400_000);
            return agingDays >= 14 ? (
              <span className="text-[10px] font-black uppercase text-status-error" title={`Nằm ở stage này ${agingDays} ngày`}>
                🔥 {agingDays}d
              </span>
            ) : null;
          })()}
        </div>
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
