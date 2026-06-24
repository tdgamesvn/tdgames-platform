import React from 'react';
import type { CrmDeal } from '@/types';
import { fmtValue } from './constants';

interface Props {
  deals: CrmDeal[];         // all deals (unfiltered) for global stats
  filteredDeals: CrmDeal[]; // filtered deals for scoped stats
  hasActiveFilters: boolean;
}

const PipelineMetrics: React.FC<Props> = ({ deals, filteredDeals, hasActiveFilters }) => {
  // Use filtered deals for display, show "of total" when filtered
  const source = hasActiveFilters ? filteredDeals : deals;

  const activeDeals = source.filter(d => !['won', 'lost'].includes(d.stage));
  const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
  const wonDeals = source.filter(d => d.stage === 'won');
  const totalWon = wonDeals.reduce((s, d) => s + d.value, 0);
  const closedDeals = source.filter(d => ['won', 'lost'].includes(d.stage));
  const winRate = closedDeals.length > 0
    ? Math.round((wonDeals.length / closedDeals.length) * 100)
    : 0;

  const cards = [
    {
      label: 'Pipeline Value',
      value: fmtValue(totalPipeline, 'USD'),
      sub: hasActiveFilters
        ? `${activeDeals.length} active (${deals.filter(d => !['won', 'lost'].includes(d.stage)).length} tổng)`
        : `${activeDeals.length} active deals`,
    },
    {
      label: 'Total Won',
      value: fmtValue(totalWon, 'USD'),
      sub: `${wonDeals.length} deals`,
      valueColor: 'text-status-success',
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      sub: closedDeals.length > 0 ? `${wonDeals.length}W / ${closedDeals.length - wonDeals.length}L` : undefined,
    },
    {
      label: 'Total Deals',
      value: `${source.length}`,
      sub: hasActiveFilters ? `/ ${deals.length} tổng` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-[20px] border border-primary/10 p-4 space-y-1 bg-surface">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{c.label}</p>
          <p className={`text-2xl font-black ${c.valueColor || 'text-white'}`}>{c.value}</p>
          {c.sub && <p className="text-xs font-semibold text-neutral-500">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
};

export default PipelineMetrics;
