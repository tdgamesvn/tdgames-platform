// apps/tax-portal/components/TaxPortalAssetsTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxSavings, fetchTaxLoans, fetchTaxBhxhPayments, fetchTaxFxRates, fetchTaxFixedAssets, TaxSaving, TaxLoan, TaxBhxhPayment, TaxFxRate, TaxFixedAsset } from '../services/taxPortalService';
import { exportSavingsLoansCSV, exportBhxhCSV, exportFxRatesCSV, exportFixedAssetsCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalAssetsTab: React.FC = () => {
  const [savings, setSavings] = useState<TaxSaving[]>([]);
  const [loans, setLoans] = useState<TaxLoan[]>([]);
  const [bhxh, setBhxh] = useState<TaxBhxhPayment[]>([]);
  const [fx, setFx] = useState<TaxFxRate[]>([]);
  const [assets, setAssets] = useState<TaxFixedAsset[]>([]);

  useEffect(() => {
    Promise.all([fetchTaxSavings(), fetchTaxLoans(), fetchTaxBhxhPayments(), fetchTaxFxRates(), fetchTaxFixedAssets()])
      .then(([s, l, b, f, a]) => { setSavings(s); setLoans(l); setBhxh(b); setFx(f); setAssets(a); });
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-primary/10 rounded-[20px] p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">Tài sản cố định</h3>
          <button onClick={() => exportFixedAssetsCSV(assets)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{assets.length} tài sản, tổng nguyên giá {fmt(assets.reduce((s, a) => s + a.cost, 0))} đ</p>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">Tiết kiệm & Vay</h3>
          <button onClick={() => exportSavingsLoansCSV(savings, loans)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{savings.length} khoản tiết kiệm, {loans.length} khoản vay</p>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">BHXH</h3>
          <button onClick={() => exportBhxhCSV(bhxh)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{bhxh.length} lần đóng, tổng {fmt(bhxh.reduce((s, b) => s + b.amount, 0))} đ</p>
      </div>
      <div className="bg-surface border border-primary/10 rounded-[20px] p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">Tỷ giá</h3>
          <button onClick={() => exportFxRatesCSV(fx)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{fx.length} bản ghi tỷ giá</p>
      </div>
    </div>
  );
};

export default TaxPortalAssetsTab;
