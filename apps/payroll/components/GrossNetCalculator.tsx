import React, { useState, useMemo } from 'react';
import { calcGrossToNet, solveNetToGross } from '../services/payrollService';
import { FALLBACK_PAYROLL_FORMULA } from '../services/payrollFormulaService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

type Mode = 'gross-to-net' | 'net-to-gross';

const GrossNetCalculator: React.FC = () => {
  const [mode, setMode] = useState<Mode>('gross-to-net');
  const [amount, setAmount] = useState(15000000);
  const [dependents, setDependents] = useState(0);
  const [isProbation, setIsProbation] = useState(false);
  const [hasBhxh, setHasBhxh] = useState(true);

  const formula = FALLBACK_PAYROLL_FORMULA;

  const result = useMemo(() => {
    if (!amount || amount <= 0) return null;
    return mode === 'gross-to-net'
      ? calcGrossToNet(amount, dependents, isProbation, hasBhxh, formula)
      : solveNetToGross(amount, dependents, isProbation, hasBhxh, formula);
  }, [amount, dependents, isProbation, hasBhxh, mode]);

  const inputLabel = mode === 'gross-to-net' ? 'Lương Gross' : 'Lương Net mong muốn';

  return (
    <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full animate-fadeInUp">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            Tính lương Gross — Net
          </h2>
          <p className="text-neutral-medium text-sm mt-1">Công cụ tính lương nhanh theo quy định thuế TNCN Việt Nam</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left: Input Form ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Mode Toggle */}
          <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-3">Chế độ tính</p>
            <div className="flex gap-2">
              {([
                { key: 'gross-to-net' as Mode, label: 'Gross → Net', icon: '⬇️' },
                { key: 'net-to-gross' as Mode, label: 'Net → Gross', icon: '⬆️' },
              ]).map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${mode === m.key ? 'text-black' : 'text-neutral-medium border border-white/10 hover:bg-white/5'}`}
                  style={mode === m.key ? { background: '#FF9500' } : {}}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Salary Input */}
          <div className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">{inputLabel} (VND) *</label>
              <input
                type="number"
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors text-right font-mono"
                style={{ background: '#1a1a1a' }}
                placeholder="15,000,000"
              />
              {amount > 0 && (
                <p className="text-[10px] text-neutral-600 text-right">{fmt(amount)} VND</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Số người phụ thuộc</label>
              <select
                value={dependents}
                onChange={e => setDependents(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
                style={{ background: '#1a1a1a' }}
              >
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} người {n > 0 ? `(giảm trừ ${fmt(n * formula.dependentDeduction)})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isProbation}
                  onChange={e => setIsProbation(e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-300">Thử việc</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBhxh}
                  onChange={e => setHasBhxh(e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-300">Đóng BHXH</span>
              </label>
            </div>
          </div>

          {/* Formula Info */}
          <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-2">Công thức áp dụng</p>
            <div className="space-y-1 text-[11px] text-neutral-400">
              <p>BHXH NV: <span className="text-white font-mono">{(formula.bhEmployeeRate * 100).toFixed(1)}%</span></p>
              <p>BHXH Cty: <span className="text-white font-mono">{(formula.bhCompanyRate * 100).toFixed(1)}%</span></p>
              <p>Giảm trừ bản thân: <span className="text-white font-mono">{fmt(formula.personalDeduction)}</span></p>
              <p>Giảm trừ phụ thuộc: <span className="text-white font-mono">{fmt(formula.dependentDeduction)}/người</span></p>
              {isProbation && <p>Thuế thử việc: <span className="text-orange-400 font-mono">{(formula.probationPitRate * 100)}% flat</span></p>}
            </div>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="text-center py-20 text-neutral-700 text-sm rounded-[20px] border border-primary/10 bg-surface">
              <p className="text-3xl mb-3">🧮</p>
              <p>Nhập số tiền để bắt đầu tính</p>
            </div>
          ) : (
            <>
              {/* Big Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-[20px] border border-emerald-500/20 bg-surface p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400/70 mb-1">Lương Gross</p>
                  <p className="text-xl md:text-2xl font-black text-emerald-400 tabular-nums">{fmt(result.grossActual)}</p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">VND / tháng</p>
                </div>
                <div className="rounded-[20px] border border-primary/20 bg-surface p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary/70 mb-1">Lương Net</p>
                  <p className="text-xl md:text-2xl font-black text-primary tabular-nums">{fmt(result.netSalary)}</p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">VND / tháng</p>
                </div>
                <div className="rounded-[20px] border border-blue-500/20 bg-surface p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-400/70 mb-1">Chi phí Công ty</p>
                  <p className="text-xl md:text-2xl font-black text-blue-400 tabular-nums">{fmt(result.totalCompanyCost)}</p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">VND / tháng</p>
                </div>
              </div>

              {/* Breakdown Table */}
              <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-4">Chi tiết tính lương</p>
                <table className="w-full text-sm">
                  <tbody>
                    <Row label="Lương Gross" value={result.grossActual} bold color="text-emerald-400" />
                    <Divider />
                    <Row label="BHXH nhân viên" value={-result.employeeBhxh} note={hasBhxh ? `${(formula.bhEmployeeRate * 100).toFixed(1)}%` : 'Miễn'} color="text-red-400" />
                    <Divider />
                    <Row label="Thu nhập chịu thuế" value={result.taxableIncome} />
                    <Row label="Giảm trừ bản thân" value={-formula.personalDeduction} color="text-neutral-500" />
                    {dependents > 0 && (
                      <Row label={`Giảm trừ ${dependents} phụ thuộc`} value={-(dependents * formula.dependentDeduction)} color="text-neutral-500" />
                    )}
                    {hasBhxh && <Row label="Trừ BHXH" value={-result.employeeBhxh} color="text-neutral-500" />}
                    <Row label="Thu nhập tính thuế" value={result.assessableIncome} note={result.assessableIncome <= 0 ? 'Không phát sinh thuế' : ''} />
                    <Divider />
                    <Row label={isProbation ? 'Thuế TNCN (10% flat)' : 'Thuế TNCN (lũy tiến)'} value={-result.pit} color="text-red-400" />
                    <Divider />
                    <Row label="LƯƠNG NET" value={result.netSalary} bold color="text-primary" />
                    <Divider />
                    <Row label="BHXH công ty" value={result.companyBhxh} note={hasBhxh ? `${(formula.bhCompanyRate * 100).toFixed(1)}%` : 'Miễn'} color="text-blue-400" />
                    <Row label="TỔNG CHI PHÍ CÔNG TY" value={result.totalCompanyCost} bold color="text-blue-400" />
                  </tbody>
                </table>
              </div>

              {/* Tax Brackets */}
              {!isProbation && result.assessableIncome > 0 && (
                <div className="rounded-[20px] border border-primary/10 bg-surface p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-3">Biểu thuế lũy tiến</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-neutral-medium">
                        <th className="text-left py-1.5 font-black uppercase tracking-wider">Bậc</th>
                        <th className="text-right py-1.5 font-black uppercase tracking-wider">Mức chịu thuế</th>
                        <th className="text-right py-1.5 font-black uppercase tracking-wider">Thuế suất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formula.taxBrackets.map((b, i) => {
                        const prevLimit = i > 0 ? formula.taxBrackets[i - 1].limit : 0;
                        const isActive = result.assessableIncome > prevLimit;
                        return (
                          <tr key={i} className={`border-t border-white/5 ${isActive ? 'text-white' : 'text-neutral-700'}`}>
                            <td className="py-1.5">{i + 1}</td>
                            <td className="py-1.5 text-right font-mono">
                              {b.limit === Infinity ? `Trên ${fmt(prevLimit)}` : `${fmt(prevLimit)} → ${fmt(b.limit)}`}
                            </td>
                            <td className="py-1.5 text-right font-mono" style={isActive ? { color: '#FF9500' } : {}}>
                              {(b.rate * 100)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
};

// ── Sub-components ──

function Row({ label, value, note, bold, color }: { label: string; value: number; note?: string; bold?: boolean; color?: string }) {
  return (
    <tr>
      <td className={`py-1.5 ${bold ? 'font-black text-white' : 'text-neutral-300'}`}>{label}</td>
      <td className={`py-1.5 text-right font-mono tabular-nums ${bold ? 'font-black' : 'font-semibold'} ${color || 'text-white'}`}>
        {value < 0 ? `- ${fmt(Math.abs(value))}` : fmt(value)}
      </td>
      {note && <td className="py-1.5 text-right text-[10px] text-neutral-600 pl-2">{note}</td>}
    </tr>
  );
}

function Divider() {
  return <tr><td colSpan={3} className="py-1"><div className="border-t border-white/5" /></td></tr>;
}

export default GrossNetCalculator;
