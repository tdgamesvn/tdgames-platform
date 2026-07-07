import { supabase } from '@/services/supabaseClient';
import { fetchExchangeRate, avgRate } from '@/services/exchangeRateService';
import { fetchLatestBalances } from '@/services/bankBalanceService';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

// Fallback nếu VCB edge function lỗi — chỉ dùng khi fetch thất bại.
const FALLBACK_USD_TO_VND = 25_500;

export interface MonthlyData {
  month: number;
  year: number;
  label: string;
  revenue: number;   // tổng quy đổi VND
  expense: number;
  profit: number;
}

export interface Alert {
  level: 'critical' | 'warning' | 'good' | 'info';
  icon: string;
  message: string;
  value?: string;
}

export interface CeoDashboardData {
  // ── Current month KPIs ──
  current: {
    revenue: number;    // tổng VND (đã quy đổi USD)
    expense: number;
    profit: number;
    marginPct: number;
    headcount: number;
    revenuePerHead: number;
    tasksCompleted: number;
    tasksTotal: number;
  };
  // ── Previous month (for MoM) ──
  prev: {
    revenue: number;
    expense: number;
    profit: number;
    marginPct: number;
    headcount: number;
  };
  // ── 6-month trend ──
  trend: MonthlyData[];
  // ── Alerts ──
  alerts: Alert[];
  // ── Cash flow ──
  cashFlow: {
    receivable: number;   // tổng VND
    receivableCount: number;
    workforcePayable: number;
    payrollCost: number;
  };
  // ── Team ──
  team: {
    departments: { name: string; count: number }[];
    latestPayroll: {
      title: string;
      status: string;
      totalNet: number;
      totalCost: number;
      empCount: number;
    } | null;
    contractsExpiring: number;
    pendingLeaves: number;
  };
  // ── Pipeline ──
  pipeline: {
    activeClients: number;
    activeProjects: number;
    pipelineValue: number;
    outreachLeads: number;
    outreachTier1: number;
    emailsSent: number;
    newLeadsThisMonth: number;
  };
  // ── Cash position (real bank balance) ──
  cashPosition: {
    totalVnd: number;
    accounts: { name: string; balance: number; currency: string; staleDays: number | null; source: string }[];
    staleDays: number | null;
  };
  // ── Data confidence per block ──
  confidence: {
    revenue: { mapped: number; total: number };
    projectCost: { mapped: number; total: number };
    cashPosition: { staleDays: number | null };
  };
  // ── Project profitability (estimated vs verified) ──
  projectProfitability: {
    projectId: string;
    projectName: string;
    estimatedRevenue: number;
    estimatedCost: number;
    estimatedProfit: number;
    verifiedRevenue: number;
    verifiedCost: number;
    verifiedProfit: number;
  }[];
  // ── AR/AP summary ──
  arApSummary: {
    arTotal: number;
    arBuckets: { bucket: string; total: number }[];
    apTotal: number;
    apTopVendors: { vendor: string; total: number }[];
  };
  // ── Health score ──
  healthScore: number;
  // ── Selected period ──
  selectedMonth: number;
  selectedYear: number;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function calcInvoiceTotal(items: any[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
}

function getMonthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endM = month === 12 ? 1 : month + 1;
  const endY = month === 12 ? year + 1 : year;
  const end = `${endY}-${String(endM).padStart(2, '0')}-01`;
  return { start, end };
}

function getPrevMonth(month: number, year: number) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

function getLast6Months(month: number, year: number) {
  const months: { m: number; y: number }[] = [];
  let m = month, y = year;
  for (let i = 0; i < 6; i++) {
    months.unshift({ m, y });
    if (m === 1) { m = 12; y--; } else { m--; }
  }
  return months;
}

function monthLabel(m: number) {
  return `T${m}`;
}

// ═══════════════════════════════════════════════════════════
// Main fetch
// ═══════════════════════════════════════════════════════════

export async function fetchCeoDashboard(
  targetMonth?: number,
  targetYear?: number
): Promise<CeoDashboardData> {
  const now = new Date();
  const selMonth = targetMonth || now.getMonth() + 1;
  const selYear = targetYear || now.getFullYear();
  const prev = getPrevMonth(selMonth, selYear);
  const last6 = getLast6Months(selMonth, selYear);

  let usdToVnd = FALLBACK_USD_TO_VND;
  try {
    usdToVnd = avgRate(await fetchExchangeRate());
  } catch {
    // ponytail: VCB edge function down → fall back to last known static rate,
    // dashboard still renders instead of hard-failing.
  }

  // Date range for 6-month window
  const firstMonthRange = getMonthRange(last6[0].m, last6[0].y);
  const lastMonthRange = getMonthRange(last6[5].m, last6[5].y);

  // ── Parallel queries ──
  const [
    invoiceRes,
    expenseRes,
    workerRes,
    taskRes,
    clientRes,
    projectRes,
    employeeRes,
    deptRes,
    payrollSheetRes,
    contractRes,
    leaveRes,
    outreachRes,
    emailRes,
  ] = await Promise.all([
    supabase.from('invoice_invoices').select('id, status, currency, amount_received, items, issue_date, paid_date, created_at, due_date, crm_project_id'),
    supabase.from('expense_expenses').select('id, amount, currency, type, status, expense_date, source_type, vendor, crm_project_id'),
    supabase.from('wf_workers').select('id, status'),
    supabase.from('wf_tasks').select('id, status, price, currency, exchange_rate, payment_status, created_at, crm_project_id'),
    supabase.from('crm_clients').select('id, status'),
    supabase.from('crm_projects').select('id, name, status, budget, currency'),
    supabase.from('hr_employees').select('id, status, department_id'),
    supabase.from('hr_departments').select('id, name'),
    supabase.from('pay_payroll_sheets').select('id, title, status, month, year, total_net_salary, total_company_cost')
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
    supabase.from('hr_contracts').select('id, employee_id, status, end_date').eq('status', 'active'),
    supabase.from('att_requests').select('id, status').eq('request_type', 'leave').eq('status', 'pending'),
    supabase.from('crm_outreach_leads').select('id, status, tier, created_at'),
    supabase.from('crm_email_log').select('id, status, sent_at'),
  ]);

  const invoices = invoiceRes.data || [];
  const expenses = expenseRes.data || [];
  const tasks = taskRes.data || [];
  const employees = (employeeRes.data || []);
  const depts = deptRes.data || [];
  const contracts = contractRes.data || [];
  const leads = outreachRes.data || [];
  const emails = emailRes.data || [];

  // ── Build department map ──
  const deptMap: Record<string, string> = {};
  for (const d of depts) deptMap[d.id] = d.name;

  const activeEmployees = employees.filter((e: any) => e.status === 'active');

  // ═══════════════════════════════════════════════════════════
  // 6-Month Trend
  // ═══════════════════════════════════════════════════════════

  const trend: MonthlyData[] = last6.map(({ m, y }) => {
    // Revenue from invoices (paid in this month) — quy đổi tất cả sang VND
    let rev = 0;
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      const d = new Date(inv.paid_date || inv.issue_date || inv.created_at);
      if (d.getMonth() + 1 !== m || d.getFullYear() !== y) continue;
      const total = inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items);
      rev += (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    }

    // Expenses this month
    let exp = 0;
    for (const e of expenses) {
      if (e.type === 'revenue') continue;
      const d = new Date(e.expense_date);
      if (d.getMonth() + 1 !== m || d.getFullYear() !== y) continue;
      exp += Number(e.amount) || 0;
    }

    return { month: m, year: y, label: monthLabel(m), revenue: rev, expense: exp, profit: rev - exp };
  });

  // ── Current & Previous month data ──
  const curData = trend.find(t => t.month === selMonth && t.year === selYear)!;
  const prevData = trend.find(t => t.month === prev.month && t.year === prev.year);

  const curMargin = curData.revenue > 0 ? (curData.profit / curData.revenue) * 100 : 0;
  const prevMargin = prevData && prevData.revenue > 0 ? (prevData.profit / prevData.revenue) * 100 : 0;

  // ═══════════════════════════════════════════════════════════
  // Cash Flow — Receivables (unpaid invoices)
  // ═══════════════════════════════════════════════════════════

  let receivable = 0, receivableCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    const total = calcInvoiceTotal(inv.items);
    receivable += (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    receivableCount++;
  }

  let workforcePayable = 0;
  for (const t of tasks) {
    if (t.payment_status === 'paid') continue;
    const price = Number(t.price) || 0;
    const rate = Number(t.exchange_rate) || usdToVnd;
    workforcePayable += t.currency === 'USD' ? price * rate : price;
  }

  // Payroll
  let latestPayroll: CeoDashboardData['team']['latestPayroll'] = null;
  const latestSheet = payrollSheetRes.data?.[0];
  if (latestSheet) {
    const { data: records } = await supabase
      .from('pay_payroll_records')
      .select('net_salary, total_company_cost')
      .eq('sheet_id', latestSheet.id);
    const recs = records || [];
    latestPayroll = {
      title: latestSheet.title,
      status: latestSheet.status,
      totalNet: recs.reduce((s: number, r: any) => s + (Number(r.net_salary) || 0), 0),
      totalCost: recs.reduce((s: number, r: any) => s + (Number(r.total_company_cost) || 0), 0),
      empCount: recs.length,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Tasks
  // ═══════════════════════════════════════════════════════════

  // Tasks for current month
  const monthTasks = tasks.filter(t => {
    const d = new Date(t.created_at);
    return d.getMonth() + 1 === selMonth && d.getFullYear() === selYear;
  });
  const tasksCompleted = monthTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;

  // ═══════════════════════════════════════════════════════════
  // Team
  // ═══════════════════════════════════════════════════════════

  const deptCount: Record<string, number> = {};
  for (const emp of activeEmployees) {
    const dname = deptMap[(emp as any).department_id] || 'Khác';
    deptCount[dname] = (deptCount[dname] || 0) + 1;
  }
  const departments = Object.entries(deptCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Contracts expiring in 30 days
  const in30d = new Date(Date.now() + 30 * 86400000);
  const contractsExpiring = contracts.filter((c: any) => {
    if (!c.end_date) return false;
    const end = new Date(c.end_date);
    return end >= new Date() && end <= in30d;
  }).length;

  const pendingLeaves = (leaveRes.data || []).length;

  // ═══════════════════════════════════════════════════════════
  // Pipeline
  // ═══════════════════════════════════════════════════════════

  const clients = clientRes.data || [];
  const projects = projectRes.data || [];
  const activeClients = clients.filter((c: any) => c.status === 'active').length;
  const activeProjects = projects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;

  let pipelineValue = 0;
  for (const p of projects) {
    if (p.status !== 'active' && p.status !== 'in_progress') continue;
    pipelineValue += Number(p.budget) || 0;
  }

  const outreachTier1 = leads.filter((l: any) => l.tier === 1 || l.tier === 'tier_1').length;
  const emailsSent = emails.filter((e: any) => e.status === 'sent').length;

  // New leads this month
  const curRange = getMonthRange(selMonth, selYear);
  const newLeadsThisMonth = leads.filter((l: any) => {
    const d = new Date(l.created_at);
    return d >= new Date(curRange.start) && d < new Date(curRange.end);
  }).length;

  // ═══════════════════════════════════════════════════════════
  // Alerts
  // ═══════════════════════════════════════════════════════════

  const alerts: Alert[] = [];

  // 🔴 Overdue invoices (>30 days)
  const overdueInvoices = invoices.filter(inv => {
    if (inv.status === 'paid') return false;
    const d = new Date(inv.issue_date || inv.created_at);
    return (Date.now() - d.getTime()) > 30 * 86400000;
  });
  if (overdueInvoices.length > 0) {
    const total = overdueInvoices.reduce((s, inv) => s + calcInvoiceTotal(inv.items), 0);
    alerts.push({
      level: 'critical', icon: '🔴',
      message: `${overdueInvoices.length} hoá đơn quá hạn > 30 ngày`,
      value: `${Math.round(total).toLocaleString('vi-VN')} đ`,
    });
  }

  // 🔴 P&L negative
  if (curData.profit < 0) {
    alerts.push({
      level: 'critical', icon: '🔴',
      message: 'Tháng này đang LỖ',
      value: `${Math.round(curData.profit).toLocaleString('vi-VN')} đ`,
    });
  }

  // 🟡 Burn rate increase
  if (prevData && prevData.expense > 0) {
    const burnIncrease = ((curData.expense - prevData.expense) / prevData.expense) * 100;
    if (burnIncrease > 20) {
      alerts.push({
        level: 'warning', icon: '🟡',
        message: `Burn rate tăng ${burnIncrease.toFixed(0)}% so với tháng trước`,
      });
    }
  }

  // 🟡 Contracts expiring
  if (contractsExpiring > 0) {
    alerts.push({
      level: 'warning', icon: '🟡',
      message: `${contractsExpiring} hợp đồng hết hạn trong 30 ngày tới`,
    });
  }

  // 🟡 Pending leaves
  if (pendingLeaves > 0) {
    alerts.push({
      level: 'warning', icon: '🟡',
      message: `${pendingLeaves} đơn nghỉ phép chờ duyệt`,
    });
  }

  // 🟢 Good task completion
  const taskRate = monthTasks.length > 0 ? (tasksCompleted / monthTasks.length) * 100 : 100;
  if (taskRate >= 80 && monthTasks.length > 0) {
    alerts.push({
      level: 'good', icon: '🟢',
      message: `Task completion rate: ${taskRate.toFixed(0)}%`,
    });
  }

  // 🔵 New leads
  if (newLeadsThisMonth > 0) {
    alerts.push({
      level: 'info', icon: '🔵',
      message: `${newLeadsThisMonth} leads mới tháng này`,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Health Score
  // ═══════════════════════════════════════════════════════════

  // P&L score (40%) — profit > 0 = 100, break-even = 50, loss = 0
  let plScore = 50;
  if (curData.revenue > 0) {
    plScore = Math.min(100, Math.max(0, (curData.profit / curData.revenue) * 200 + 50));
  } else if (curData.expense > 0) {
    plScore = 0;
  }

  // Task rate (20%)
  const taskScore = taskRate;

  // AR aging (20%) — no overdue = 100, each overdue -20
  const arScore = Math.max(0, 100 - overdueInvoices.length * 25);

  // Headcount stability (20%) — no change = 100, small change ok
  let headcountScore = 100;
  // Simple: if we have prev month data, check if headcount changed dramatically
  // For now, stable = 100
  if (prevData && prevData.revenue > 0) {
    const revChange = Math.abs((curData.revenue - prevData.revenue) / prevData.revenue);
    headcountScore = Math.max(50, 100 - revChange * 100);
  }

  const healthScore = Math.round(
    plScore * 0.4 + taskScore * 0.2 + arScore * 0.2 + headcountScore * 0.2
  );

  // ═══════════════════════════════════════════════════════════
  // Cash Position — real bank balances (Task 4)
  // ═══════════════════════════════════════════════════════════

  const balances = await fetchLatestBalances().catch(() => []);
  const bankAccountsRes = await supabase.from('finance_bank_accounts').select('id, name, currency');
  const bankAccounts = bankAccountsRes.data || [];
  const bankAccMap: Record<string, { name: string; currency: string }> = {};
  for (const a of bankAccounts) bankAccMap[a.id] = { name: (a as any).name, currency: (a as any).currency };

  const nowTs = Date.now();
  const cashAccounts = balances.map(b => {
    const staleDays = Math.floor((nowTs - new Date(b.snapshot_date).getTime()) / 86400000);
    const meta = bankAccMap[b.account_id] || { name: 'Unknown', currency: 'VND' };
    return { name: meta.name, balance: b.balance, currency: meta.currency, staleDays, source: b.source };
  });
  const totalVnd = cashAccounts.reduce((s, a) => s + (a.currency === 'VND' ? a.balance : a.balance * usdToVnd), 0);
  const maxStale = cashAccounts.length ? Math.max(...cashAccounts.map(a => a.staleDays)) : null;

  // ═══════════════════════════════════════════════════════════
  // Confidence — % of rows mapped to a project (Task 4)
  // ═══════════════════════════════════════════════════════════

  const revMapped = invoices.filter((i: any) => i.crm_project_id).length;
  const costItems = [...expenses.filter((e: any) => e.type !== 'revenue'), ...tasks];
  const costMapped = costItems.filter((x: any) => x.crm_project_id).length;

  // ═══════════════════════════════════════════════════════════
  // Project Profitability — estimated vs verified (Task 4)
  // ═══════════════════════════════════════════════════════════

  const projMap: Record<string, { name: string }> = {};
  for (const p of projects) projMap[p.id] = { name: (p as any).name };

  const profitByProject: Record<string, any> = {};
  const ensureProj = (id: string) => {
    if (!profitByProject[id]) {
      profitByProject[id] = {
        projectId: id, projectName: projMap[id]?.name || 'Unknown',
        estimatedRevenue: 0, estimatedCost: 0, verifiedRevenue: 0, verifiedCost: 0,
      };
    }
    return profitByProject[id];
  };

  for (const inv of invoices) {
    const pid = (inv as any).crm_project_id;
    if (!pid) continue;
    const total = inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items);
    const vnd = (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    const p = ensureProj(pid);
    p.estimatedRevenue += vnd;
    if (inv.status === 'paid') p.verifiedRevenue += vnd;
  }
  for (const t of tasks) {
    const pid = (t as any).crm_project_id;
    if (!pid) continue;
    const price = Number(t.price) || 0;
    const rate = Number(t.exchange_rate) || usdToVnd;
    const vnd = t.currency === 'USD' ? price * rate : price;
    const p = ensureProj(pid);
    p.estimatedCost += vnd;
    if (t.payment_status === 'paid') p.verifiedCost += vnd;
  }
  for (const e of expenses) {
    if (e.type === 'revenue') continue;
    const pid = (e as any).crm_project_id;
    if (!pid) continue;
    const vnd = (e.currency || 'VND') === 'VND' ? Number(e.amount) : Number(e.amount) * usdToVnd;
    const p = ensureProj(pid);
    p.estimatedCost += vnd;
    if (e.status === 'paid') p.verifiedCost += vnd;
  }

  const projectProfitability = Object.values(profitByProject).map((p: any) => ({
    ...p,
    estimatedProfit: p.estimatedRevenue - p.estimatedCost,
    verifiedProfit: p.verifiedRevenue - p.verifiedCost,
  }));

  // ═══════════════════════════════════════════════════════════
  // AR/AP Summary (Task 4)
  // ═══════════════════════════════════════════════════════════

  const arBucketDefs = [
    { key: 'current', label: 'Chưa đến hạn', max: 0 },
    { key: '1-30', label: '1–30 ngày', max: 30 },
    { key: '31-60', label: '31–60 ngày', max: 60 },
    { key: '61-90', label: '61–90 ngày', max: 90 },
    { key: '90+', label: 'Trên 90 ngày', max: Infinity },
  ];
  const arBucketTotals: Record<string, number> = {};
  for (const b of arBucketDefs) arBucketTotals[b.key] = 0;
  let arTotal = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    const total = calcInvoiceTotal(inv.items);
    const vnd = (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    const due = new Date((inv as any).due_date || inv.issue_date || inv.created_at);
    const dpd = Math.floor((Date.now() - due.getTime()) / 86400000);
    const bucket = dpd <= 0 ? 'current' : dpd <= 30 ? '1-30' : dpd <= 60 ? '31-60' : dpd <= 90 ? '61-90' : '90+';
    arBucketTotals[bucket] += vnd;
    arTotal += vnd;
  }

  const apByVendor: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'revenue' || e.status === 'paid') continue;
    const vendor = (e as any).vendor?.trim() || '(Không có nhà cung cấp)';
    const vnd = (e.currency || 'VND') === 'VND' ? Number(e.amount) : Number(e.amount) * usdToVnd;
    apByVendor[vendor] = (apByVendor[vendor] || 0) + vnd;
  }
  const apTopVendors = Object.entries(apByVendor)
    .map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const apTotal = Object.values(apByVendor).reduce((s, v) => s + v, 0);

  // ═══════════════════════════════════════════════════════════
  // Return
  // ═══════════════════════════════════════════════════════════

  return {
    current: {
      revenue: curData.revenue,
      expense: curData.expense,
      profit: curData.profit,
      marginPct: curMargin,
      headcount: activeEmployees.length,
      revenuePerHead: activeEmployees.length > 0 ? Math.round(curData.revenue / activeEmployees.length) : 0,
      tasksCompleted,
      tasksTotal: monthTasks.length,
    },
    prev: {
      revenue: prevData?.revenue || 0,
      expense: prevData?.expense || 0,
      profit: prevData?.profit || 0,
      marginPct: prevMargin,
      headcount: activeEmployees.length,
    },
    trend,
    alerts,
    cashFlow: {
      receivable,
      receivableCount,
      workforcePayable,
      payrollCost: latestPayroll?.totalCost || 0,
    },
    team: {
      departments,
      latestPayroll,
      contractsExpiring,
      pendingLeaves,
    },
    pipeline: {
      activeClients,
      activeProjects,
      pipelineValue,
      outreachLeads: leads.length,
      outreachTier1,
      emailsSent,
      newLeadsThisMonth,
    },
    cashPosition: { totalVnd, accounts: cashAccounts, staleDays: maxStale },
    confidence: {
      revenue: { mapped: revMapped, total: invoices.length },
      projectCost: { mapped: costMapped, total: costItems.length },
      cashPosition: { staleDays: maxStale },
    },
    projectProfitability,
    arApSummary: {
      arTotal,
      arBuckets: arBucketDefs.map(b => ({ bucket: b.label, total: arBucketTotals[b.key] })),
      apTotal,
      apTopVendors,
    },
    healthScore,
    selectedMonth: selMonth,
    selectedYear: selYear,
  };
}
