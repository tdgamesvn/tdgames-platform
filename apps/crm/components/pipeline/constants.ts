import type { CrmDealStage } from '@/types';

// ── Stage definitions ─────────────────────────────────────────
export interface StageConfig {
  key: CrmDealStage;
  label: string;
  color: string;
  icon: string;
}

export const STAGES: StageConfig[] = [
  { key: 'lead',          label: 'Lead',        color: '#9D9C9D', icon: '🎯' },
  { key: 'contacted',     label: 'Contacted',   color: '#0A84FF', icon: '📞' },
  { key: 'negotiating',   label: 'Negotiating', color: '#AF52DE', icon: '💬' },
  { key: 'proposal_sent', label: 'Proposal',    color: '#FFA726', icon: '📄' },
  { key: 'contracting',   label: 'Contracting', color: '#FF9500', icon: '📝' },
  { key: 'won',           label: 'Won',         color: '#4CAF50', icon: '🎉' },
  { key: 'lost',          label: 'Lost',        color: '#F44336', icon: '❌' },
];

export const STAGE_MAP: Record<CrmDealStage, StageConfig> =
  Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<CrmDealStage, StageConfig>;

export const CURRENCIES = ['USD', 'VND'] as const;

// ── Formatters ────────────────────────────────────────────────
export const fmtValue = (v: number, cur: string): string =>
  cur === 'VND'
    ? v.toLocaleString('vi-VN') + '₫'
    : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0 });

export const fmtDate = (d: string): string =>
  d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
