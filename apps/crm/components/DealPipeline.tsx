import React from 'react';
import type { AccountUser, CrmClient } from '@/types';
import { hasRole, hasAnyRole } from '@/utils/roleUtils';
import { ToastNotification } from '@/components/ToastNotification';
import { useDealPipeline } from '../hooks/useDealPipeline';
import { PipelineBoard, PipelineMetrics, PipelineFilters, DealFormModal, DealDetailPanel } from './pipeline';

interface Props {
  currentUser: AccountUser;
  clients: CrmClient[];
}

const DealPipeline: React.FC<Props> = ({ currentUser, clients }) => {
  // BD-restricted view: has 'bd' but no admin/ke_toan (primary OR secondary)
  const isBd = hasRole(currentUser, 'bd') && !hasAnyRole(currentUser, ['admin', 'ke_toan']);
  const p = useDealPipeline(isBd ? currentUser.id : undefined);

  return (
    <div className="animate-fadeInUp space-y-6">
      {/* ── Toast ── */}
      {p.toast && (
        <ToastNotification
          message={{ text: p.toast.message, type: p.toast.type }}
          onDismiss={() => p.setToast(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Deal Pipeline</h2>
        <div className="flex items-center gap-3">
          <input
            value={p.filters.search}
            onChange={e => p.setFilter('search', e.target.value)}
            placeholder="Tìm deal / khách hàng..."
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-56"
            style={{ background: '#1a1a1a' }}
          />
          <button
            onClick={p.openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all"
            style={{ background: '#FF9500' }}
          >
            + Tạo deal
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <PipelineFilters
        filters={p.filters}
        onFilterChange={p.setFilter}
        onReset={p.resetFilters}
        hasActiveFilters={p.hasActiveFilters}
        owners={p.owners}
        totalCount={p.deals.length}
        filteredCount={p.filteredDeals.length}
      />

      {/* ── KPI Cards ── */}
      <PipelineMetrics
        deals={p.deals}
        filteredDeals={p.filteredDeals}
        hasActiveFilters={p.hasActiveFilters}
      />

      {/* ── Kanban Board ── */}
      {p.isLoading ? (
        <div className="text-center py-16">
          <p className="text-neutral-600 text-sm animate-td-pulse">Đang tải pipeline...</p>
        </div>
      ) : (
        <PipelineBoard
          columns={p.columns}
          dragOverStage={p.dragOverStage}
          onCardClick={(d) => p.setSelectedDeal(d)}
          onDragStart={p.handleDragStart}
          onDragEnd={p.handleDragEnd}
          onDragOver={p.handleDragOver}
          onDrop={p.handleDrop}
          setDragOverStage={p.setDragOverStage}
        />
      )}

      {/* ── Add/Edit Modal ── */}
      {p.showModal && (
        <DealFormModal
          clients={clients}
          currentUser={currentUser}
          editDeal={p.editingDeal}
          onSave={p.handleSave}
          onClose={p.closeModal}
        />
      )}

      {/* ── Detail Panel ── */}
      {p.selectedDeal && (
        <DealDetailPanel
          deal={p.selectedDeal}
          currentUser={currentUser}
          onClose={() => p.setSelectedDeal(null)}
          onEdit={() => {
            p.openEditModal(p.selectedDeal!);
            p.setSelectedDeal(null);
          }}
          onDelete={p.handleDelete}
          onStageChange={p.handleStageChange}
          onUpdateField={p.updateDealField}
        />
      )}
    </div>
  );
};

export default DealPipeline;
