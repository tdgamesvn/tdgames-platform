// apps/tax-portal/components/TaxPortalPayrollTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxPayrollSheets, fetchTaxPayrollRecords, TaxPayrollSheet, TaxPayrollRecord } from '../services/taxPortalService';
import { exportPayrollExcel } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalPayrollTab: React.FC = () => {
  const [sheets, setSheets] = useState<TaxPayrollSheet[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [records, setRecords] = useState<TaxPayrollRecord[]>([]);

  useEffect(() => {
    fetchTaxPayrollSheets().then(s => {
      setSheets(s);
      if (s.length) setSelected(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (selected) fetchTaxPayrollRecords(selected).then(setRecords);
  }, [selected]);

  const currentSheet = sheets.find(s => s.id === selected);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          {sheets.map(s => <option key={s.id} value={s.id}>{s.title} (T{s.month}/{s.year})</option>)}
        </select>
        <button onClick={() => exportPayrollExcel(records, currentSheet?.title || 'unknown')}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất Excel
        </button>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/10">
              <th className="p-3">Nhân viên</th>
              <th className="p-3 text-right">Lương gộp</th>
              <th className="p-3 text-right">BHXH (NV)</th>
              <th className="p-3 text-right">PIT</th>
              <th className="p-3 text-right">Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.employee_id}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.gross_salary)}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.bhxh_employee)}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.pit)}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.net_salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalPayrollTab;
