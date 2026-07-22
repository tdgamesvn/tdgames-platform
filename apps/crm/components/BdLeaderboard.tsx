import React, { useEffect, useState } from 'react';
import { fetchBdFunnel, BdFunnelRow } from '../services/crmService';

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

const BdLeaderboard: React.FC = () => {
  const [rows, setRows] = useState<BdFunnelRow[]>([]);
  useEffect(() => { fetchBdFunnel().then(setRows).catch(() => setRows([])); }, []);
  if (rows.length === 0) return null;

  return (
    <div className="bg-surface border border-white/8 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">Leaderboard BD — funnel outreach → revenue</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] font-black text-neutral-600 uppercase tracking-wider text-left">
            <th className="py-2">BD</th><th>Sent</th><th>Replied</th><th>Reply %</th>
            <th>Deals</th><th>Won</th><th>Won value</th><th>Attainment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.bdId} className="border-t border-white/5 text-neutral-300">
              <td className="py-2 font-semibold text-white">{r.bdName || r.bdId.slice(0, 8)}</td>
              <td>{r.sent}</td><td>{r.replied}</td><td>{pct(r.replied, r.sent)}</td>
              <td>{r.deals}</td><td>{r.won}</td>
              <td className="font-black text-status-success">${r.wonValue.toLocaleString()}</td>
              <td>{pct(r.wonValue, r.targetUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BdLeaderboard;
