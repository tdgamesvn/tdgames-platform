// apps/tax-portal/components/TaxPortalInvoiceTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxInvoices, TaxInvoice } from '../services/taxPortalService';
import { exportInvoicesCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalInvoiceTab: React.FC = () => {
  const [rows, setRows] = useState<TaxInvoice[]>([]);
  useEffect(() => { fetchTaxInvoices().then(setRows); }, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportInvoicesCSV(rows)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/8">
              <th className="p-3">Ngày xuất</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Pháp nhân</th>
              <th className="p-3 text-right">Đã thu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.issue_date || '—'}</td>
                <td className="p-3 text-neutral-medium">{r.status}</td>
                <td className="p-3 text-neutral-medium">{r.billing_entity || '—'}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.amount_received || 0)} {r.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalInvoiceTab;
