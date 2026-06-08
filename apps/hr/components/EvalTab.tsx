import React from 'react';
import { HrEmployee, AccountUser } from '@/types';
import EvalCycleList from './eval/EvalCycleList';

interface EvalTabProps {
  employees: HrEmployee[];
  currentUser: AccountUser;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const EvalTab: React.FC<EvalTabProps> = ({ employees, currentUser, onToast }) => {
  return (
    <div className="animate-fadeInUp">
      <EvalCycleList
        employees={employees}
        currentUser={currentUser}
        onToast={onToast}
      />
    </div>
  );
};

export default EvalTab;
