import React, { useEffect, useState } from 'react';
import { fetchBankAccounts, BankAccount } from '@/apps/expense/services/bankAccountService';
import { fetchLatestBalances, addBalanceSnapshot, BankBalanceSnapshot } from '@/services/bankBalanceService';
import { AccountUser } from '@/types';

interface Props { currentUser: AccountUser }

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const BankBalanceEntryTab: React.FC<Props> = ({ currentUser }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [latest, setLatest] = useState<BankBalanceSnapshot[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    Promise.all([fetchBankAccounts(), fetchLatestBalances()]).then(([a, l]) => {
      setAccounts(a);
      setLatest(l);
    });
  };
  useEffect(load, []);

  const latestFor = (accId: string) => latest.find(l => l.account_id === accId);
  const staleDays = (dateStr?: string) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  };

  const save = async (accId: string) => {
    const val = Number(draft[accId]);
    if (!val && val !== 0) return;
    setSaving(accId);
    try {
      await addBalanceSnapshot({
        account_id: accId,
        balance: val,
        snapshot_date: new Date().toISOString().slice(0, 10),
        source: 'manual',
        recorded_by: currentUser.username,
      });
      setDraft(d => ({ ...d, [accId]: '' }));
      load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      {accounts.map(acc => {
        const l = latestFor(acc.id);
        const stale = staleDays(l?.snapshot_date);
        return (
          <div key={acc.id} className="bg-surface border border-primary/10 rounded-[20px] p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold text-sm">{acc.name} <span className="text-neutral-medium text-xs">({acc.bank_name})</span></p>
              <p className="text-xs text-neutral-medium mt-1">
                Số dư gần nhất: <span className="text-white font-bold">{l ? fmt(l.balance) : '—'}</span> {acc.currency}
                {stale !== null && (
                  <span className={`ml-2 text-[10px] font-black uppercase ${stale > 7 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stale === 0 ? 'Hôm nay' : `${stale} ngày trước`}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Số dư mới"
                value={draft[acc.id] || ''}
                onChange={e => setDraft(d => ({ ...d, [acc.id]: e.target.value }))}
                className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 w-32 text-sm text-white" />
              <button onClick={() => save(acc.id)} disabled={saving === acc.id}
                className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg disabled:opacity-50">
                {saving === acc.id ? '...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BankBalanceEntryTab;
