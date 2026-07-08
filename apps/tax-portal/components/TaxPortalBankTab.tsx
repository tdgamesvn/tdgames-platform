// apps/tax-portal/components/TaxPortalBankTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxBankAccounts, fetchTaxBankSnapshots, TaxBankAccount, TaxBankSnapshot } from '../services/taxPortalService';
import { exportBankSnapshotsCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalBankTab: React.FC = () => {
  const [accounts, setAccounts] = useState<TaxBankAccount[]>([]);
  const [snapshots, setSnapshots] = useState<TaxBankSnapshot[]>([]);

  useEffect(() => {
    Promise.all([fetchTaxBankAccounts(), fetchTaxBankSnapshots()]).then(([a, s]) => {
      setAccounts(a);
      setSnapshots(s);
    });
  }, []);

  const accName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportBankSnapshotsCSV(snapshots)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/10">
              <th className="p-3">Tài khoản</th>
              <th className="p-3">Ngày</th>
              <th className="p-3 text-right">Số dư</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map(s => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="p-3 text-white">{accName(s.account_id)}</td>
                <td className="p-3 text-neutral-medium">{s.snapshot_date}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(s.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalBankTab;
