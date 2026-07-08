// apps/tax-portal/components/TaxPortalOverviewTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxInvoices, fetchTaxExpenses, fetchTaxPayrollSheets } from '../services/taxPortalService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalOverviewTab: React.FC = () => {
  const [totals, setTotals] = useState({ revenue: 0, expense: 0, invoiceCount: 0, sheetCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTaxInvoices(), fetchTaxExpenses(), fetchTaxPayrollSheets()]).then(([invoices, expenses, sheets]) => {
      const revenue = invoices.reduce((s, i) => s + (i.amount_received || 0), 0);
      const expense = expenses.reduce((s, e) => s + e.amount, 0);
      setTotals({ revenue, expense, invoiceCount: invoices.length, sheetCount: sheets.length });
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-neutral-medium text-sm">Đang tải...</p>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="p-4 rounded-[20px] bg-surface border border-primary/10">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Doanh thu đã thu</p>
        <p className="text-2xl font-black text-white">{fmt(totals.revenue)} đ</p>
      </div>
      <div className="p-4 rounded-[20px] bg-surface border border-primary/10">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Tổng chi phí</p>
        <p className="text-2xl font-black text-white">{fmt(totals.expense)} đ</p>
      </div>
      <div className="p-4 rounded-[20px] bg-surface border border-primary/10">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Số hoá đơn</p>
        <p className="text-2xl font-black text-white">{totals.invoiceCount}</p>
      </div>
      <div className="p-4 rounded-[20px] bg-surface border border-primary/10">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Bảng lương</p>
        <p className="text-2xl font-black text-white">{totals.sheetCount}</p>
      </div>
    </div>
  );
};

export default TaxPortalOverviewTab;
