import React, { useEffect, useState } from 'react';
import { CompanyProfile } from '../services/companyService';
import { supabase } from '@/services/supabaseClient';

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number: string;
  swift_code?: string;
  citad_code?: string;
  bank_address?: string;
  currency: string;
  account_type: string;
  entity: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  company: CompanyProfile;
}

const currencyColor: Record<string, string> = { VND: '#34C759', USD: '#0A84FF' };

export default function BankTab({ company }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('finance_bank_accounts')
        .select('*')
        .eq('entity', company.entity_short)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setAccounts((data || []) as BankAccount[]);
      setLoading(false);
    })();
  }, [company.entity_short]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-white font-black text-base uppercase tracking-wider">🏦 Tài khoản ngân hàng</h2>
        <p className="text-neutral-500 text-xs mt-0.5">{company.entity_short} • {accounts.length} tài khoản</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-600 text-sm">Đang tải...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">🏦</p>
          <p>Chưa có tài khoản ngân hàng nào</p>
          <p className="text-xs mt-1 text-neutral-600">Thêm trong Expense → Tỷ giá hoặc liên hệ admin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map(acc => (
            <div key={acc.id}
              className="flex items-center gap-4 p-5 rounded-2xl border transition-all"
              style={{
                background: acc.sort_order === 1 ? 'rgba(255,149,0,0.04)' : 'rgba(255,255,255,0.02)',
                borderColor: acc.sort_order === 1 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)',
              }}>
              {/* Bank icon */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                🏦
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-black text-sm">{acc.bank_name}</span>
                  {acc.sort_order === 1 && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400">Chính</span>
                  )}
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                    style={{ background: `${currencyColor[acc.currency] || '#666'}20`, color: currencyColor[acc.currency] || '#999' }}>
                    {acc.currency}
                  </span>
                </div>
                <p className="text-neutral-300 font-mono text-sm mt-0.5 tracking-wider">{acc.account_number}</p>
                <p className="text-neutral-500 text-xs mt-0.5">{acc.name}</p>
                {(acc.swift_code || acc.citad_code || acc.bank_address) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {acc.swift_code && <span className="text-[10px] text-neutral-600">SWIFT: <span className="text-neutral-400 font-mono">{acc.swift_code}</span></span>}
                    {acc.citad_code && <span className="text-[10px] text-neutral-600">CITAD: <span className="text-neutral-400 font-mono">{acc.citad_code}</span></span>}
                    {acc.bank_address && <span className="text-[10px] text-neutral-600">{acc.bank_address}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-neutral-700 text-xs">
        * Để thêm / sửa tài khoản ngân hàng, vào <span className="text-neutral-500">Expense → 💱 Tỷ giá</span> tab.
      </p>
    </div>
  );
}
