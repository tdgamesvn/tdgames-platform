// apps/tax-portal/components/TaxPortalExpenseTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxExpenses, TaxExpense } from '../services/taxPortalService';
import { exportExpensesCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalExpenseTab: React.FC = () => {
  const [rows, setRows] = useState<TaxExpense[]>([]);
  useEffect(() => { fetchTaxExpenses().then(setRows); }, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportExpensesCSV(rows)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/10">
              <th className="p-3">Ngày</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Diễn giải</th>
              <th className="p-3">NCC</th>
              <th className="p-3 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.expense_date}</td>
                <td className="p-3 text-neutral-medium">{r.type}</td>
                <td className="p-3 text-white">{r.description || '—'}</td>
                <td className="p-3 text-neutral-medium">{r.vendor || '—'}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.amount)} {r.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalExpenseTab;
