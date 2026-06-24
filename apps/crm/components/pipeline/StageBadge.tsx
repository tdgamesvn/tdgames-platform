import React from 'react';
import type { CrmDealStage } from '@/types';
import { STAGE_MAP } from './constants';

interface Props {
  stage: CrmDealStage;
  showIcon?: boolean;
  className?: string;
}

const StageBadge: React.FC<Props> = ({ stage, showIcon = true, className = '' }) => {
  const cfg = STAGE_MAP[stage];
  if (!cfg) return null;

  return (
    <span
      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${className}`}
      style={{ background: `${cfg.color}20`, color: cfg.color }}
    >
      {showIcon && `${cfg.icon} `}{cfg.label}
    </span>
  );
};

export default StageBadge;
