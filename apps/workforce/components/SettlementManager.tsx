import React, { useState } from 'react';
import { Worker, WorkforceTask, Settlement } from '@/types';
import { ConfirmModal, useConfirmModal } from './shared/ConfirmModal';
import SettlementListView from './settlement/SettlementListView';
import SettlementCreateView from './settlement/SettlementCreateView';
import SettlementDetailView from './settlement/SettlementDetailView';

interface SettlementManagerProps {
  settlements: Settlement[];
  workers: Worker[];
  tasks: WorkforceTask[];
  vcbSellRate: number;
  onCreateSettlement: (workerId: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType: 'percent' | 'amount', bonusValue: number, taxRate: number, accountType: 'company' | 'personal') => void;
  onUpdateSettlement: (id: string, updates: Partial<Settlement>) => void;
  onDeleteSettlement: (id: string) => void;
}

type View = 'list' | 'create' | 'detail';

const SettlementManager: React.FC<SettlementManagerProps> = ({
  settlements,
  workers,
  tasks,
  vcbSellRate,
  onCreateSettlement,
  onUpdateSettlement,
  onDeleteSettlement,
}) => {
  const [view, setView] = useState<View>('list');
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);
  const { modal, confirm, close } = useConfirmModal();

  const openDetail = (s: Settlement) => {
    setDetailSettlement(s);
    setView('detail');
  };

  const handleDeleteFromList = (id: string) => {
    confirm('Xóa nghiệm thu này?', () => {
      onDeleteSettlement(id);
      close();
    }, 'Task sẽ được rollback về CHƯA THANH TOÁN.');
  };

  if (view === 'detail' && detailSettlement) {
    return (
      <>
        {modal && <ConfirmModal message={modal.message} subMessage={modal.subMessage} onConfirm={modal.onConfirm} onCancel={close} />}
        <SettlementDetailView
          settlement={detailSettlement}
          workers={workers}
          allTasks={tasks}
          vcbSellRate={vcbSellRate}
          onBack={() => setView('list')}
          onUpdate={onUpdateSettlement}
          onDelete={onDeleteSettlement}
          onRequestConfirm={(msg, cb, sub) => confirm(msg, () => { cb(); close(); }, sub)}
        />
      </>
    );
  }

  if (view === 'create') {
    return (
      <SettlementCreateView
        workers={workers}
        tasks={tasks}
        vcbSellRate={vcbSellRate}
        onBack={() => setView('list')}
        onCreate={onCreateSettlement}
      />
    );
  }

  return (
    <>
      {modal && <ConfirmModal message={modal.message} subMessage={modal.subMessage} onConfirm={modal.onConfirm} onCancel={close} />}
      <SettlementListView
        settlements={settlements}
        workers={workers}
        vcbSellRate={vcbSellRate}
        onOpenDetail={openDetail}
        onCreateNew={() => setView('create')}
        onDelete={handleDeleteFromList}
      />
    </>
  );
};

export default SettlementManager;
