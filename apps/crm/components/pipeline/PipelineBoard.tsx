import React from 'react';
import type { CrmDeal, CrmDealStage } from '@/types';
import { STAGES } from './constants';
import PipelineColumn from './PipelineColumn';

interface Props {
  columns: Record<CrmDealStage, CrmDeal[]>;
  dragOverStage: CrmDealStage | null;
  onCardClick: (deal: CrmDeal) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stage: CrmDealStage) => void;
  setDragOverStage: (stage: CrmDealStage | null) => void;
}

const PipelineBoard: React.FC<Props> = ({
  columns, dragOverStage, onCardClick, onDragStart, onDragEnd, onDragOver, onDrop, setDragOverStage,
}) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:-mx-12 md:px-12" style={{ minHeight: '400px' }}>
      {STAGES.map(stage => (
        <PipelineColumn
          key={stage.key}
          stage={stage}
          deals={columns[stage.key]}
          onCardClick={onCardClick}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => { onDragOver(e); setDragOverStage(stage.key); }}
          onDrop={onDrop}
          isDragOver={dragOverStage === stage.key}
        />
      ))}
    </div>
  );
};

export default PipelineBoard;
