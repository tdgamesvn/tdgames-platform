import React from 'react';
import { AccountUser } from '@/types';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

const TaxPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <button onClick={onBack} className="text-neutral-medium text-xs font-bold uppercase tracking-wider mb-4">
        ← Trang chủ
      </button>
      <h1 className="text-2xl font-black mb-2">🧾 Tax Portal</h1>
      <p className="text-neutral-medium text-sm">Xin chào {currentUser.username}. Các tab dữ liệu sẽ có ở Task 4.</p>
    </div>
  );
};

export default TaxPortalApp;
