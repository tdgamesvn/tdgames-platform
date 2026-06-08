import React from 'react';
import { AccountUser } from '@/types';
import PortalEvalList from './eval/PortalEvalList';

interface EvalTabProps {
  currentUser:    AccountUser;
  onToast:        (msg: string, type: 'success' | 'error') => void;
  initialCycleId?: string; // deep-link: auto-open a specific cycle
}

const EvalTab: React.FC<EvalTabProps> = ({ currentUser, onToast, initialCycleId }) => {
  if (!currentUser.employee_id) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px',
        background: '#161616', borderRadius: '16px', border: '1px solid #222',
      }}>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
          Tài khoản chưa liên kết nhân viên
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>
          Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp">
      <PortalEvalList
        employeeId={currentUser.employee_id}
        userId={currentUser.id}
        onToast={onToast}
        initialCycleId={initialCycleId}
      />
    </div>
  );
};

export default EvalTab;
