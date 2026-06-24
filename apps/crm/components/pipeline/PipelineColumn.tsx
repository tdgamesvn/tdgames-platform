import React from 'react';
import type { CrmDeal, CrmDealStage } from '@/types';
import type { StageConfig } from './constants';
import { fmtValue } from './constants';
import DealCard from './DealCard';

interface Props {
  stage: StageConfig;
  deals: CrmDeal[];
  onCardClick: (deal: CrmDeal) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stage: CrmDealStage) => void;
  isDragOver: boolean;
}

const EMPTY_HINTS: Partial<Record<CrmDealStage, string>> = {
  lead:      'Thêm deal mới từ nút "+ Tạo deal"',
  won:       'Kéo deal vào đây khi chốt thành công',
  lost:      'Kéo deal vào đây khi mất',
};

const PipelineColumn: React.FC<Props> = ({
  stage, deals, onCardClick, onDragStart, onDragEnd, onDragOver, onDrop, isDragOver,
}) => {
  const total = deals.reduce((s, d) => s + d.value, 0);
  const mainCur = deals.length ? deals[0].currency : 'USD';

  return (
    <div
      className="flex flex-col rounded-2xl border min-w-[260px] max-w-[300px] flex-1 transition-all"
      style={{
        background: isDragOver ? 'rgba(255,149,0,0.04)' : 'rgba(255,255,255,0.015)',
        borderColor: isDragOver ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.06)',
      }}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.key)}
    >
      {/* Column Header */}
      <div className="p-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">{stage.icon}</span>
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: stage.color }}>
              {stage.label}
            </span>
          </div>
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
            style={{ background: `${stage.color}18`, color: stage.color }}
          >
            {deals.length}
          </span>
        </div>
        {deals.length > 0 && (
          <p className="text-[10px] text-neutral-600 font-semibold">
            {fmtValue(total, mainCur)}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {/* Drop indicator when dragging over empty column */}
        {isDragOver && deals.length === 0 && (
          <div className="border-2 border-dashed rounded-xl p-4 text-center transition-all"
            style={{ borderColor: 'rgba(255,149,0,0.4)' }}>
            <p className="text-[10px] font-semibold text-orange-400/60">Thả vào đây</p>
          </div>
        )}

        {deals.length === 0 && !isDragOver && (
          <div className="text-center py-8 text-neutral-700">
            <p className="text-2xl mb-1">{stage.icon}</p>
            <p className="text-[10px] font-semibold">Chưa có deal</p>
            {EMPTY_HINTS[stage.key] && (
              <p className="text-[9px] text-neutral-700 mt-1">{EMPTY_HINTS[stage.key]}</p>
            )}
          </div>
        )}

        {deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={() => onCardClick(deal)}
            onDragStart={(e) => onDragStart(e, deal.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

export default PipelineColumn;
