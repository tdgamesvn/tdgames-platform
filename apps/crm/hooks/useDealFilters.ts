import { useState, useMemo } from 'react';
import type { CrmDeal, CrmDealStage } from '@/types';

export interface DealFilters {
  search: string;
  stage: CrmDealStage | 'all' | 'active';
  owner: string;       // owner_name or '' for all
  currency: string;    // 'USD' | 'VND' | '' for all
}

const DEFAULT_FILTERS: DealFilters = {
  search: '',
  stage: 'all',
  owner: '',
  currency: '',
};

export function useDealFilters(deals: CrmDeal[]) {
  const [filters, setFilters] = useState<DealFilters>(DEFAULT_FILTERS);

  const setFilter = <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const hasActiveFilters = filters.stage !== 'all' || filters.owner !== '' || filters.currency !== '';

  // ── Derived: unique owners from deals ──────────────────────
  const owners = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => { if (d.owner_name) set.add(d.owner_name); });
    return [...set].sort();
  }, [deals]);

  // ── Apply filters ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = deals;

    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q)
        || (d.client_name || '').toLowerCase().includes(q)
        || (d.owner_name || '').toLowerCase().includes(q)
      );
    }

    // Stage filter
    if (filters.stage === 'active') {
      result = result.filter(d => !['won', 'lost'].includes(d.stage));
    } else if (filters.stage !== 'all') {
      result = result.filter(d => d.stage === filters.stage);
    }

    // Owner filter
    if (filters.owner) {
      result = result.filter(d => d.owner_name === filters.owner);
    }

    // Currency filter
    if (filters.currency) {
      result = result.filter(d => d.currency === filters.currency);
    }

    return result;
  }, [deals, filters]);

  return {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    owners,
    filtered,
  };
}
