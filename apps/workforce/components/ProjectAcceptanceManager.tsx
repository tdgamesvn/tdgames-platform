import React, { useState } from 'react';
import { WorkforceTask, ProjectAcceptance, AcceptanceExtraItem } from '@/types';
import { ConfirmModal, useConfirmModal } from './shared/ConfirmModal';
import AcceptanceListView from './acceptance/AcceptanceListView';
import AcceptanceCreateView from './acceptance/AcceptanceCreateView';
import AcceptanceDetailView from './acceptance/AcceptanceDetailView';

interface ProjectAcceptanceManagerProps {
  acceptances: ProjectAcceptance[];
  tasks: WorkforceTask[];
  vcbSellRate: number;
  onCreateAcceptance: (projectName: string, clientName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, clientPrices?: Record<string, number>, accountType?: 'company' | 'personal', extraItems?: AcceptanceExtraItem[]) => void;
  onUpdateAcceptance: (id: string, updates: Partial<ProjectAcceptance>) => void;
  onDeleteAcceptance: (id: string) => void;
}

type View = 'list' | 'create' | 'detail';

const ProjectAcceptanceManager: React.FC<ProjectAcceptanceManagerProps> = ({
  acceptances,
  tasks,
  vcbSellRate,
  onCreateAcceptance,
  onUpdateAcceptance,
  onDeleteAcceptance,
}) => {
  const [view, setView] = useState<View>('list');
  const [detailAcceptance, setDetailAcceptance] = useState<ProjectAcceptance | null>(null);
  const { modal, confirm, close } = useConfirmModal();

  const openDetail = (a: ProjectAcceptance) => {
    setDetailAcceptance(a);
    setView('detail');
  };

  const handleDeleteFromList = (id: string) => {
    confirm('Delete this project acceptance?', () => {
      onDeleteAcceptance(id);
      close();
    });
  };

  if (view === 'detail' && detailAcceptance) {
    return (
      <>
        {modal && <ConfirmModal message={modal.message} subMessage={modal.subMessage} onConfirm={modal.onConfirm} onCancel={close} />}
        <AcceptanceDetailView
          acceptance={detailAcceptance}
          onBack={() => setView('list')}
          onUpdate={onUpdateAcceptance}
          onDelete={onDeleteAcceptance}
          onRequestConfirm={(msg, cb) => confirm(msg, () => { cb(); close(); })}
        />
      </>
    );
  }

  if (view === 'create') {
    return (
      <AcceptanceCreateView
        tasks={tasks}
        onBack={() => setView('list')}
        onCreate={onCreateAcceptance}
      />
    );
  }

  return (
    <>
      {modal && <ConfirmModal message={modal.message} subMessage={modal.subMessage} onConfirm={modal.onConfirm} onCancel={close} />}
      <AcceptanceListView
        acceptances={acceptances}
        onOpenDetail={openDetail}
        onCreateNew={() => setView('create')}
        onDelete={handleDeleteFromList}
      />
    </>
  );
};

export default ProjectAcceptanceManager;
