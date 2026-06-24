import React from 'react';
import type { CrmDealStage } from '@/types';
import type { DealFilters } from '../../hooks/useDealFilters';
import { STAGES, CURRENCIES } from './constants';

interface Props {
  filters: DealFilters;
  onFilterChange: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  owners: string[];
  totalCount: number;
  filteredCount: number;
}

type StageOption = CrmDealStage | 'all' | 'active';

const STAGE_OPTIONS: { key: StageOption; label: string }[] = [
  { key: 'all',    label: 'Tất cả' },
  { key: 'active', label: 'Đang xử lý' },
  ...STAGES.map(s => ({ key: s.key as StageOption, label: `${s.icon} ${s.label}` })),
];

const PipelineFilters: React.FC<Props> = ({
  filters, onFilterChange, onReset, hasActiveFilters, owners, totalCount, filteredCount,
}) => {
  const selectCls = 'px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 outline-none focus:border-orange-500/50 transition-colors';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Stage filter pills */}
      <div className="flex gap-1">
        {STAGE_OPTIONS.slice(0, 3).map(opt => (
          <button
            key={opt.key}
            onClick={() => onFilterChange('stage', opt.key)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
            style={{
              background: filters.stage === opt.key ? 'rgba(255,149,0,0.15)' : 'transparent',
              border: `1px solid ${filters.stage === opt.key ? 'rgba(255,149,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: filters.stage === opt.key ? '#FF9500' : '#666',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stage dropdown for specific stages */}
      <select
        value={['all', 'active'].includes(filters.stage) ? '' : filters.stage}
        onChange={e => onFilterChange('stage', (e.target.value || 'all') as StageOption)}
        className={selectCls}
        style={{ background: '#1a1a1a' }}
      >
        <option value="">Stage cụ thể</option>
        {STAGES.map(s => (
          <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
        ))}
      </select>

      {/* Owner filter */}
      {owners.length > 1 && (
        <select
          value={filters.owner}
          onChange={e => onFilterChange('owner', e.target.value)}
          className={selectCls}
          style={{ background: '#1a1a1a' }}
        >
          <option value="">Tất cả owner</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {/* Currency filter */}
      <select
        value={filters.currency}
        onChange={e => onFilterChange('currency', e.target.value)}
        className={selectCls}
        style={{ background: '#1a1a1a' }}
      >
        <option value="">Tất cả tiền tệ</option>
        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Active filter indicator + reset */}
      {hasActiveFilters && (
        <>
          <span className="text-[10px] text-neutral-500">
            {filteredCount}/{totalCount} deals
          </span>
          <button
            onClick={onReset}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400/70 border border-red-500/20 hover:bg-red-500/10 transition-all"
          >
            ✕ Xóa lọc
          </button>
        </>
      )}
    </div>
  );
};

export default PipelineFilters;
