// apps/tax-portal/services/taxPortalExportService.ts
import * as XLSX from 'xlsx';
import type { TaxInvoice, TaxExpense, TaxBankSnapshot, TaxSaving, TaxLoan, TaxBhxhPayment, TaxFxRate, TaxPayrollRecord } from './taxPortalService';

// Same pattern as apps/accounting/components/VatTab.tsx's exportCSV — kept
// local (not shared) because each domain's column set is different and this
// repo's existing convention (VatTab/TncnTab) already duplicates this small
// helper per-file rather than extracting it.
function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportInvoicesCSV(rows: TaxInvoice[]) {
  const headers = ['ID', 'Trạng thái', 'Tiền tệ', 'Đã thu', 'Ngày xuất', 'Ngày thanh toán', 'Pháp nhân'];
  const csvRows = rows.map(r => [r.id, r.status, r.currency, r.amount_received ?? 0, r.issue_date || '', r.paid_date || '', r.billing_entity || '']);
  downloadCSV(headers, csvRows, `TaxPortal_HoaDon_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportExpensesCSV(rows: TaxExpense[]) {
  const headers = ['ID', 'Số tiền', 'Tiền tệ', 'Loại', 'Trạng thái', 'Ngày', 'NCC'];
  const csvRows = rows.map(r => [r.id, r.amount, r.currency, r.type, r.status, r.expense_date, r.vendor || '']);
  downloadCSV(headers, csvRows, `TaxPortal_ChiPhi_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBankSnapshotsCSV(rows: TaxBankSnapshot[]) {
  const headers = ['Tài khoản', 'Số dư', 'Ngày', 'Nguồn'];
  const csvRows = rows.map(r => [r.account_id, r.balance, r.snapshot_date, r.source]);
  downloadCSV(headers, csvRows, `TaxPortal_SoDuNganHang_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportSavingsLoansCSV(savings: TaxSaving[], loans: TaxLoan[]) {
  const headers = ['Loại', 'Số tiền', 'Đối tác', 'Lãi suất', 'Ngày bắt đầu', 'Ngày đến hạn', 'Trạng thái'];
  const csvRows = [
    ...savings.map(s => ['Tiết kiệm', s.amount, s.bank_name || '', s.interest_rate ?? '', s.start_date, s.maturity_date || '', s.status]),
    ...loans.map(l => ['Vay', l.amount, l.lender || '', l.interest_rate ?? '', l.start_date, l.due_date || '', l.status]),
  ];
  downloadCSV(headers, csvRows, `TaxPortal_TietKiemVay_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBhxhCSV(rows: TaxBhxhPayment[]) {
  const headers = ['ID', 'Số tiền', 'Ngày', 'Kỳ'];
  const csvRows = rows.map(r => [r.id, r.amount, r.payment_date, r.period || '']);
  downloadCSV(headers, csvRows, `TaxPortal_BHXH_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportFxRatesCSV(rows: TaxFxRate[]) {
  const headers = ['Ngày', 'Từ', 'Đến', 'Tỷ giá', 'Nguồn'];
  const csvRows = rows.map(r => [r.rate_date, r.from_currency, r.to_currency, r.rate, r.source]);
  downloadCSV(headers, csvRows, `TaxPortal_TyGia_${new Date().toISOString().slice(0, 10)}.csv`);
}

// Excel (not CSV) — same xlsx library + pattern as apps/payroll/services/payrollExportService.ts.
export function exportPayrollExcel(records: TaxPayrollRecord[], sheetTitle: string) {
  const rows = records.map(r => ({
    'Nhân viên ID': r.employee_id,
    'Lương gộp': r.gross_salary,
    'BHXH (NV)': r.bhxh_employee,
    'BHXH (CT)': r.bhxh_company,
    'PIT': r.pit,
    'Lương thực nhận': r.net_salary,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
  XLSX.writeFile(wb, `TaxPortal_Luong_${sheetTitle.replace(/\s/g, '_')}.xlsx`);
}
