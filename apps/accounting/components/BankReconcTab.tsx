import React, { useState, useRef, useMemo } from 'react';
import { BankStatement, BankStatementRow, InvoiceData, ExpenseRecord, Advance } from '@/types';

interface Props {
  statements: BankStatement[];
  invoices: InvoiceData[];
  expenses: ExpenseRecord[];
  advances: Advance[];
  vcbAvgRate?: number; // VND per 1 USD — for matching USD invoices
  onImport: (bank: string, rows: BankStatementRow[]) => Promise<void>;
  onMatch: (id: string, matchedType: 'invoice' | 'expense' | 'advance', matchedId: string) => Promise<void>;
  onUnmatch: (id: string) => Promise<void>;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

// ── Parsers ──────────────────────────────────────────────────────

function parseTechcombank(text: string): BankStatementRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    // Expected: Date, Description, Debit, Credit, Balance
    if (cols.length < 4) continue;
    const [dateRaw, description, debitRaw, creditRaw] = cols;
    // Parse date DD/MM/YYYY or YYYY-MM-DD
    const date = parseDate(dateRaw);
    if (!date) continue;
    const debit = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);
    if (debit > 0) rows.push({ transaction_date: date, description, amount: debit, transaction_type: 'debit' });
    if (credit > 0) rows.push({ transaction_date: date, description, amount: credit, transaction_type: 'credit' });
  }
  return rows;
}

function parseBIDV(text: string): BankStatementRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    // Expected: STT, Ngày GD, Số tham chiếu, Mô tả, Phát sinh Nợ, Phát sinh Có, Số dư
    if (cols.length < 6) continue;
    const [, dateRaw, refCode, description, debitRaw, creditRaw] = cols;
    const date = parseDate(dateRaw);
    if (!date) continue;
    const debit = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);
    if (debit > 0) rows.push({ transaction_date: date, description, amount: debit, transaction_type: 'debit', reference_code: refCode });
    if (credit > 0) rows.push({ transaction_date: date, description, amount: credit, transaction_type: 'credit', reference_code: refCode });
  }
  return rows;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // DD/MM/YYYY
  const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  // YYYY-MM-DD
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return raw;
  return null;
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function detectBank(text: string): 'techcombank' | 'bidv' | null {
  const upper = text.slice(0, 500).toUpperCase();
  if (upper.includes('TECHCOMBANK') || upper.includes('TCB')) return 'techcombank';
  if (upper.includes('BIDV')) return 'bidv';
  // Try by column headers
  if (upper.includes('PHAT SINH NO') || upper.includes('PHÁT SINH NỢ')) return 'bidv';
  return 'techcombank'; // default
}

// ── Auto-match ────────────────────────────────────────────────────

/** Tính tổng tiền thực tế của invoice (sau discount + VAT), đã quy về VND */
function calcInvoiceTotalVnd(inv: InvoiceData, usdRate: number): number {
  const raw = (inv.items || []).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const afterDiscount = inv.discountType === 'percentage'
    ? raw * (1 - (inv.discountValue || 0) / 100)
    : raw - (inv.discountValue || 0);
  const total = afterDiscount * (1 + (inv.taxRate || 0) / 100);
  return inv.currency === 'USD' ? total * usdRate : total;
}

function autoMatchCandidate(
  stmt: BankStatement,
  invoices: InvoiceData[],
  expenses: ExpenseRecord[],
  advances: Advance[],
  usdRate: number
): { type: 'invoice' | 'expense' | 'advance'; id: string; label: string } | null {
  const stmtDate = new Date(stmt.transaction_date);
  const withinDays = (dateStr: string | undefined, days = 3) => {
    if (!dateStr) return false;
    const diff = Math.abs(new Date(dateStr).getTime() - stmtDate.getTime()) / 86400000;
    return diff <= days;
  };
  const amtMatch = (a: number) => Math.abs(a - stmt.amount) / Math.max(stmt.amount, 1) <= 0.01;

  if (stmt.transaction_type === 'credit') {
    // Credit = tiền vào → match invoice paid (so sánh tổng tiền sau discount + VAT, quy về VND)
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      const totalVnd = calcInvoiceTotalVnd(inv, usdRate);
      if (amtMatch(totalVnd) && withinDays(inv.paidDate)) {
        return { type: 'invoice', id: inv.id!, label: `HĐ ${inv.invoiceNumber} — ${inv.clientInfo?.name}` };
      }
    }
  } else {
    // Debit = tiền ra → match expense paid / advance
    for (const exp of expenses) {
      if (exp.status !== 'paid') continue;
      const expVnd = exp.currency === 'USD' ? exp.amount * usdRate : exp.amount;
      if (amtMatch(expVnd) && withinDays(exp.expense_date)) {
        return { type: 'expense', id: exp.id!, label: `CP: ${exp.title}` };
      }
    }
    for (const adv of advances) {
      if (adv.status !== 'open') continue;
      // Advance amounts are always VND
      if (amtMatch(adv.amount) && withinDays(adv.advance_date)) {
        return { type: 'advance', id: adv.id!, label: `TU: ${adv.purpose} — ${adv.recipient_name}` };
      }
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────

export default function BankReconcTab({ statements, invoices, expenses, advances, vcbAvgRate, onImport, onMatch, onUnmatch }: Props) {
  const usdRate = vcbAvgRate || 25000;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterMatch, setFilterMatch] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [manualType, setManualType] = useState<'invoice' | 'expense' | 'advance'>('invoice');
  const [manualId, setManualId] = useState('');

  const filtered = useMemo(() => {
    return statements.filter(s => {
      if (filterBank !== 'all' && s.bank_name !== filterBank) return false;
      if (filterMatch === 'matched' && !s.matched_id) return false;
      if (filterMatch === 'unmatched' && s.matched_id) return false;
      return true;
    }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [statements, filterBank, filterMatch]);

  const totalDebit = filtered.filter(s => s.transaction_type === 'debit').reduce((s, r) => s + r.amount, 0);
  const totalCredit = filtered.filter(s => s.transaction_type === 'credit').reduce((s, r) => s + r.amount, 0);
  const matched = filtered.filter(s => s.matched_id).length;
  const unmatched = filtered.filter(s => !s.matched_id).length;

  const banks = [...new Set(statements.map(s => s.bank_name))];

  async function handleFile(file: File) {
    setImportError(null);
    setImportSuccess(null);
    setImporting(true);
    try {
      const text = await file.text();
      const bank = detectBank(text);
      if (!bank) throw new Error('Không nhận ra định dạng ngân hàng');
      const rows = bank === 'bidv' ? parseBIDV(text) : parseTechcombank(text);
      if (rows.length === 0) throw new Error('Không đọc được giao dịch nào từ file. Kiểm tra định dạng CSV.');
      await onImport(bank, rows);
      setImportSuccess(`✅ Import ${rows.length} giao dịch từ ${bank === 'bidv' ? 'BIDV' : 'Techcombank'}`);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function getMatchLabel(stmt: BankStatement): string {
    if (!stmt.matched_id || !stmt.matched_type) return '';
    if (stmt.matched_type === 'invoice') {
      const inv = invoices.find(i => i.id === stmt.matched_id);
      return inv ? `HĐ ${inv.invoiceNumber}` : stmt.matched_id;
    }
    if (stmt.matched_type === 'expense') {
      const exp = expenses.find(e => e.id === stmt.matched_id);
      return exp ? exp.title : stmt.matched_id;
    }
    if (stmt.matched_type === 'advance') {
      const adv = advances.find(a => a.id === stmt.matched_id);
      return adv ? adv.purpose : stmt.matched_id;
    }
    return stmt.matched_id;
  }

  const invoiceOptions = invoices.filter(i => i.status === 'paid');
  const expenseOptions = expenses.filter(e => e.status === 'paid' && e.currency === 'VND');
  const advanceOptions = advances.filter(a => a.status === 'open');

  const manualOptions = useMemo(() => {
    if (manualType === 'invoice') return invoiceOptions.map(i => ({ id: i.id!, label: `${i.invoiceNumber} — ${i.clientInfo?.name}` }));
    if (manualType === 'expense') return expenseOptions.map(e => ({ id: e.id!, label: e.title }));
    return advanceOptions.map(a => ({ id: a.id!, label: `${a.purpose} — ${a.recipient_name}` }));
  }, [manualType, invoiceOptions, expenseOptions, advanceOptions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Đối chiếu ngân hàng</h2>
          <p className="text-neutral-medium text-sm mt-1">Import sao kê CSV · Auto-match hoá đơn & chi phí</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider text-white transition-all hover:opacity-80 disabled:opacity-40"
          style={{ background: '#FF9500' }}>
          {importing ? '⏳ Đang import...' : '⬆️ Import CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {/* Format hint */}
      <div className="rounded-xl border border-white/5 p-4 text-xs text-neutral-500 space-y-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="font-bold text-neutral-400 mb-2">Định dạng CSV được hỗ trợ:</p>
        <p>• <span className="text-neutral-300">Techcombank:</span> Date, Description, Debit, Credit, Balance</p>
        <p>• <span className="text-neutral-300">BIDV:</span> STT, Ngày GD, Số tham chiếu, Mô tả, Phát sinh Nợ, Phát sinh Có, Số dư</p>
        <p className="text-neutral-600 mt-1">Ngân hàng tự động nhận biết theo nội dung file. Ngày dạng DD/MM/YYYY hoặc YYYY-MM-DD.</p>
      </div>

      {/* Alerts */}
      {importError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">❌ {importError}</div>
      )}
      {importSuccess && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-emerald-400 text-sm">{importSuccess}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Phát sinh Nợ', value: fmt(totalDebit), color: 'text-orange-400' },
          { label: 'Phát sinh Có', value: fmt(totalCredit), color: 'text-emerald-400' },
          { label: 'Đã khớp', value: String(matched), color: 'text-sky-400' },
          { label: 'Chưa khớp', value: String(unmatched), color: unmatched > 0 ? 'text-yellow-400' : 'text-neutral-500' },
        ].map(c => (
          <div key={c.label} className="rounded-[20px] border border-primary/10 bg-surface p-4">
            <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterBank} onChange={e => setFilterBank(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
          style={{ background: '#1a1a1a' }}>
          <option value="all">Tất cả ngân hàng</option>
          {banks.map(b => <option key={b} value={b}>{b === 'techcombank' ? 'Techcombank' : 'BIDV'}</option>)}
        </select>
        {(['all', 'matched', 'unmatched'] as const).map(f => (
          <button key={f} onClick={() => setFilterMatch(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${filterMatch === f ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>
            {f === 'all' ? 'Tất cả' : f === 'matched' ? '✓ Đã khớp' : '? Chưa khớp'}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-600 text-sm">
          {statements.length === 0 ? 'Chưa có giao dịch. Import file CSV để bắt đầu.' : 'Không có giao dịch phù hợp bộ lọc.'}
        </div>
      ) : (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Ngày</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Mô tả</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Ngân hàng</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Phát sinh Nợ</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Phát sinh Có</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Khớp với</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(stmt => {
                const auto = !stmt.matched_id ? autoMatchCandidate(stmt, invoices, expenses, advances, usdRate) : null;
                const isMatchingThis = matchingId === stmt.id;
                return (
                  <React.Fragment key={stmt.id}>
                    <tr className={`border-b border-white/3 hover:bg-white/2 transition-colors ${isMatchingThis ? 'bg-white/3' : ''}`}>
                      <td className="px-4 py-2.5 text-neutral-400 font-mono">{stmt.transaction_date}</td>
                      <td className="px-4 py-2.5 text-neutral-300 max-w-xs truncate" title={stmt.description}>{stmt.description}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-white/5 text-neutral-400">
                          {stmt.bank_name === 'techcombank' ? 'TCB' : 'BIDV'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-orange-400 font-mono">
                        {stmt.transaction_type === 'debit' ? fmt(stmt.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">
                        {stmt.transaction_type === 'credit' ? fmt(stmt.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {stmt.matched_id ? (
                          <span className="text-sky-400 font-semibold">{getMatchLabel(stmt)}</span>
                        ) : auto ? (
                          <span className="text-yellow-400/70 italic text-[10px]">~{auto.label}</span>
                        ) : (
                          <span className="text-neutral-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {stmt.matched_id ? (
                          <button onClick={() => onUnmatch(stmt.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-black text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            Bỏ khớp
                          </button>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            {auto && (
                              <button onClick={() => onMatch(stmt.id, auto.type, auto.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                                Auto ✓
                              </button>
                            )}
                            <button onClick={() => setMatchingId(isMatchingThis ? null : stmt.id)}
                              className="px-2 py-1 rounded-lg text-[10px] font-black text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-all">
                              Khớp
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Manual match panel */}
                    {isMatchingThis && (
                      <tr className="border-b border-white/5 bg-sky-500/5">
                        <td colSpan={7} className="px-8 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <select value={manualType} onChange={e => { setManualType(e.target.value as any); setManualId(''); }}
                              className="px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
                              style={{ background: '#1a1a1a' }}>
                              <option value="invoice">Hoá đơn</option>
                              <option value="expense">Chi phí</option>
                              <option value="advance">Tạm ứng</option>
                            </select>
                            <select value={manualId} onChange={e => setManualId(e.target.value)}
                              className="flex-1 min-w-48 px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
                              style={{ background: '#1a1a1a' }}>
                              <option value="">-- Chọn --</option>
                              {manualOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>
                            <button
                              disabled={!manualId}
                              onClick={async () => {
                                if (!manualId) return;
                                await onMatch(stmt.id, manualType, manualId);
                                setMatchingId(null);
                                setManualId('');
                              }}
                              className="px-4 py-1.5 rounded-xl text-xs font-black text-white disabled:opacity-30 transition-all"
                              style={{ background: '#FF9500' }}>
                              Xác nhận
                            </button>
                            <button onClick={() => setMatchingId(null)}
                              className="px-3 py-1.5 rounded-xl text-xs text-neutral-500 hover:text-white transition-all">
                              Huỷ
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
