import { supabase } from '@/services/supabaseClient';
import { fetchEmployees } from '@/apps/hr/services/hrService';
import { acceptanceNetAmount } from './projectAcceptanceService';

export interface FulltimeKPI {
  employeeId: string;
  workerId: string;
  fullName: string;
  period: string; // "YYYY-MM"
  totalCompanyCost: number; // Cost in VND
  totalTaskRevenue: number; // Revenue in USD
  totalTaskCount: number;
  profitLoss: number; // P&L in VND (assuming exchange rate)
  roiPercent: number;
  kpiScore: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
  // KPI target (chỉ tham khảo, không đẩy vào payroll)
  grossActual: number;        // VND — gross thực tế từ payroll (mọi status, ưu tiên confirmed/paid)
  kpiTargetVND: number;       // grossActual × multiplier
  kpiPercent: number | null;  // revenueVND / target × 100 (null nếu chưa có payroll)
  kpiBonusVND: number;        // max(0, revenueVND − target) × bonusPercent%
  kpiMultiplier: number;
  kpiBonusPercent: number;
  tasks: FulltimeTaskDetail[]; // chi tiết task nghiệm thu trong tháng (drill-down)
}

export interface FulltimeTaskDetail {
  title: string;
  project: string;
  client: string;
  priceUSD: number;
}

export interface KpiSettings {
  multiplier: number;
  bonusPercent: number;
}

export interface FreelancerPaymentSummary {
  workerId: string;
  workerName: string;
  taskCount: number;
  totalAmount: number; // Original currency amount (chỉ tổng giá tasks, CHƯA gồm bonus)
  currency: string;
  bonusAmount: number; // Original currency (thuế tính trên total + bonus)
  taxAmount: number;
  netAmount: number; // VND (đã quy đổi từ currency gốc theo exchangeRate)
  paymentStatus: string;
}

export interface MonthlyFinancialSummary {
  period: { month: number; year: number };
  
  // Revenue
  totalRevenue: number;            // Total from acceptances (USD)
  revenueCurrency: string;         // USD
  revenueVND: number;              // Converted to VND
  
  // Costs
  fulltimePayroll: number;         // Total fulltime cost (VND)
  freelancerPayments: number;      // Total freelancer cost (VND)
  operationalExpenses: number;     // Other expenses (VND)
  totalCost: number;               // Total cost (VND)
  
  // P&L
  grossProfit: number;             // P&L in VND
  profitMargin: number;            // % ROI
  
  // Breakdowns
  fulltimeBreakdown: FulltimeKPI[];
  freelancerBreakdown: FreelancerPaymentSummary[];
  kpiSettings: KpiSettings;        // global config hiện hành
  projected: ProjectedSummary;     // số DỰ KIẾN của tháng đang chạy
}

/**
 * Dự kiến = số sẽ về nếu tháng chạy trọn: task đã làm xong (chưa nghiệm thu) + lương
 * đủ công. Khác "thực tế" ở chỗ không chờ chốt phiếu nghiệm thu / bảng lương / quyết toán.
 */
export interface ProjectedSummary {
  revenueVND: number;
  fulltimeCost: number;
  freelancerCost: number;
  totalCost: number;
  grossProfit: number;
  taskCount: number;          // số task tính vào doanh thu dự kiến
  tasksWithoutPrice: number;  // task đủ điều kiện nhưng CHƯA nhập giá khách → doanh thu bị thiếu
  payrollSource: 'sheet-thang-nay' | 'sheet-thang-truoc' | 'khong-co';
}

// Trạng thái ClickUp coi là CHƯA làm xong ⇒ không tính doanh thu dự kiến.
// Sếp chốt: mới / đang làm / pending / cancelled thì bỏ, còn lại (review, fix,
// complete, approved, Closed...) đều tính.
const NOT_YET_DONE = new Set([
  'new', 'new request', 'to do', 'todo', 'open', 'backlog', 'planning', 'lead_check',
  'in progress', 'in_progress', 'pending', 'cancelled', 'canceled',
]);

/** Lưu config KPI: employeeId=null → global, ngược lại → override per nhân viên */
export async function saveKpiSettings(employeeId: string | null, multiplier: number, bonusPercent: number): Promise<void> {
  const payload = { multiplier, bonus_percent: bonusPercent, updated_at: new Date().toISOString() };
  if (employeeId) {
    const { error } = await supabase.from('wf_kpi_settings')
      .upsert({ employee_id: employeeId, ...payload }, { onConflict: 'employee_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('wf_kpi_settings').update(payload).is('employee_id', null);
    if (error) throw error;
  }
}

export async function getDashboardData(month: number, year: number, exchangeRate: number = 25000, accountTypeFilter: 'all' | 'company' | 'personal' = 'all'): Promise<MonthlyFinancialSummary> {
  const periodStr = `${year}-${month.toString().padStart(2, '0')}`;
  
  // 1. Get Revenue (Project Acceptances in this period)
  // Lấy MỌI trạng thái: bảng KPI per-nhân-viên (tham khảo) cần số ngay từ khi phiếu
  // nghiệm thu được TẠO; riêng P&L tổng công ty chỉ tính phiếu đã 'accepted'.
  let acceptanceQuery = supabase
    .from('wf_project_acceptances')
    .select('id, total_amount, currency, status, discount_type, discount_value')
    .eq('period', periodStr);
  if (accountTypeFilter !== 'all') acceptanceQuery = acceptanceQuery.eq('account_type', accountTypeFilter);
  const { data: acceptances } = await acceptanceQuery;

  // P&L tổng: chỉ phiếu accepted (số thực)
  const totalRevenueUSD = (acceptances || [])
    .filter(acc => acc.status === 'accepted')
    .reduce((sum, acc) => sum + acceptanceNetAmount(acc), 0);
  const revenueVND = totalRevenueUSD * exchangeRate;

  // 2. Get Fulltime Payroll Cost
  // We need the sheet for the specific month/year
  // Lấy MỌI sheet của tháng (kể cả draft): bảng KPI per-nhân-viên cần gross ngay từ
  // khi bảng lương được TẠO (chưa confirm thì mới còn cửa nhập thưởng).
  // Riêng tổng chi phí Fulltime Payroll (P&L công ty) chỉ tính sheet confirmed/paid.
  const { data: sheets } = await supabase
    .from('pay_payroll_sheets')
    .select('id, status')
    .eq('month', month)
    .eq('year', year);

  let fulltimePayroll = 0;
  const fulltimeCostsMap = new Map<string, number>(); // employee_id -> cost
  const fulltimeGrossMap = new Map<string, number>(); // employee_id -> gross_actual

  if (sheets && sheets.length > 0) {
    const confirmedSheetIds = new Set(
      sheets.filter(s => ['confirmed', 'paid'].includes(s.status)).map(s => s.id)
    );
    const sheetIds = sheets.map(s => s.id);
    const { data: payrollRecords } = await supabase
      .from('pay_payroll_records')
      .select('employee_id, total_company_cost, gross_actual, sheet_id')
      .in('sheet_id', sheetIds);

    if (payrollRecords) {
      payrollRecords.forEach(r => {
        const cost = Number(r.total_company_cost || 0);
        const isConfirmed = confirmedSheetIds.has(r.sheet_id);
        if (isConfirmed) fulltimePayroll += cost; // P&L công ty: chỉ số thực
        // Per-nhân-viên: ưu tiên record từ sheet confirmed/paid, fallback draft
        if (isConfirmed || !fulltimeCostsMap.has(r.employee_id)) {
          fulltimeCostsMap.set(r.employee_id, cost);
          fulltimeGrossMap.set(r.employee_id, Number(r.gross_actual || 0));
        }
      });
    }
  }

  // 2b. KPI settings (global + override per nhân viên)
  const { data: kpiRows } = await supabase
    .from('wf_kpi_settings')
    .select('employee_id, multiplier, bonus_percent');
  let kpiSettings: KpiSettings = { multiplier: 3, bonusPercent: 20 };
  const kpiOverrides = new Map<string, KpiSettings>();
  (kpiRows || []).forEach((r: any) => {
    const s = { multiplier: Number(r.multiplier), bonusPercent: Number(r.bonus_percent) };
    if (r.employee_id) kpiOverrides.set(r.employee_id, s);
    else kpiSettings = s;
  });

  // 3. Get Freelancer Payments (Settlements)
  let settlementQuery = supabase
    .from('wf_settlements')
    .select('worker_id, total_tasks, total_amount, currency, bonus_amount, tax_amount, net_amount, status, account_type, worker:wf_workers(full_name)')
    .eq('period', periodStr);
  if (accountTypeFilter !== 'all') settlementQuery = settlementQuery.eq('account_type', accountTypeFilter);
  const { data: settlements } = await settlementQuery;

  let freelancerPayments = 0;
  const freelancerBreakdown: FreelancerPaymentSummary[] = [];
  
  if (settlements) {
    settlements.forEach(s => {
      // net_amount lưu theo currency của settlement (USD hoặc VND) → quy đổi VND tại đây
      // để cả P&L tổng lẫn bảng breakdown đồng nhất đơn vị.
      const netRaw = Number(s.net_amount || 0);
      const net = s.currency === 'USD' ? netRaw * exchangeRate : netRaw;
      freelancerPayments += net;

      freelancerBreakdown.push({
        workerId: s.worker_id,
        workerName: (s.worker as any)?.full_name || 'Unknown',
        taskCount: s.total_tasks || 0,
        totalAmount: Number(s.total_amount || 0),
        currency: s.currency,
        bonusAmount: Number(s.bonus_amount || 0),
        taxAmount: Number(s.tax_amount || 0),
        netAmount: net,
        paymentStatus: s.status
      });
    });
  }

  // 4. Get Operational Expenses (manual + invoice only, exclude auto-synced payroll/settlement to avoid double-counting)
  // Assuming expense_date is like "YYYY-MM-DD"
  const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
  
  let expenseQuery = supabase
    .from('expense_expenses')
    .select('amount, currency, source_type, type')
    .gte('expense_date', startOfMonth)
    .lte('expense_date', endOfMonth)
    .eq('status', 'approved')
    .eq('type', 'expense') // Only expenses, not revenue
    .not('source_type', 'in', '("payroll","settlement")'); // Exclude auto-synced (already counted above)
  if (accountTypeFilter !== 'all') expenseQuery = expenseQuery.eq('account_type', accountTypeFilter);
  const { data: expenses } = await expenseQuery;

  let operationalExpenses = 0;
  if (expenses) {
    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      // Simplify: assume expenses are in VND. If USD, convert.
      operationalExpenses += (e.currency === 'USD' ? amt * exchangeRate : amt);
    });
  }

  const totalCost = fulltimePayroll + freelancerPayments + operationalExpenses;
  const grossProfit = revenueVND - totalCost;
  const profitMargin = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;

  // 5. Calculate Fulltime KPI
  // We need tasks completed by fulltime workers in this period, and their client_price
  const { data: hrEmployees } = await supabase
    .from('hr_employees')
    .select('id, full_name, type, status, worker_id')
    .eq('type', 'fulltime')
    .eq('status', 'active');
    
  const fulltimeBreakdown: FulltimeKPI[] = [];
  
  if (hrEmployees) {
    const fulltimeWorkerIds = hrEmployees.map(e => e.worker_id).filter(Boolean) as string[];
    
    // Fetch tasks linked to acceptances in this period
    // A task's revenue is recognized when its acceptance is approved in this period
    let taskRevenues = new Map<string, { count: number, revenue: number, tasks: FulltimeTaskDetail[] }>();
    
    if (acceptances && acceptances.length > 0 && fulltimeWorkerIds.length > 0) {
      const acceptanceIds = acceptances.map(a => a.id);
      
      // Get acceptance tasks
      const { data: accTasks } = await supabase
        .from('wf_project_acceptance_tasks')
        .select('task_id, client_price')
        .in('acceptance_id', acceptanceIds);
        
      if (accTasks && accTasks.length > 0) {
        const taskIds = accTasks.map(at => at.task_id);
        
        // Task info + người làm (1 task có thể nhiều người ⇒ doanh thu chia theo share_pct)
        const { data: tasksInfo } = await supabase
          .from('wf_tasks')
          .select('id, title, project, client_name, clickup_space_name, clickup_folder_name')
          .in('id', taskIds);
        const { data: assg } = await supabase
          .from('wf_task_assignees')
          .select('task_id, worker_id, share_pct')
          .in('task_id', taskIds)
          .in('worker_id', fulltimeWorkerIds);

        if (tasksInfo && assg) {
          const taskInfoMap = new Map<string, any>();
          tasksInfo.forEach(t => taskInfoMap.set(t.id, t));
          const byTask = new Map<string, any[]>();
          assg.forEach(a => byTask.set(a.task_id, [...(byTask.get(a.task_id) || []), a]));

          accTasks.forEach(at => {
            const info = taskInfoMap.get(at.task_id);
            if (!info) return;
            for (const a of byTask.get(at.task_id) || []) {
              const current = taskRevenues.get(a.worker_id) || { count: 0, revenue: 0, tasks: [] as FulltimeTaskDetail[] };
              const price = Number(at.client_price || 0) * Number(a.share_pct || 0) / 100;
              current.count += 1;
              current.revenue += price;
              current.tasks.push({
                title: info.title || '(không tên)',
                project: info.project || info.clickup_folder_name || '',
                client: info.client_name || info.clickup_space_name || '',
                priceUSD: price,
              });
              taskRevenues.set(a.worker_id, current);
            }
          });
        }
      }
    }

    hrEmployees.forEach(emp => {
      const cost = fulltimeCostsMap.get(emp.id) || 0;
      const workerId = emp.worker_id;
      const taskData = workerId ? taskRevenues.get(workerId) : null;
      
      const revUSD = taskData?.revenue || 0;
      const revVND = revUSD * exchangeRate;
      const count = taskData?.count || 0;
      
      const pnl = revVND - cost;
      const roi = cost > 0 ? (pnl / cost) * 100 : 0;
      
      let kpiScore: FulltimeKPI['kpiScore'] = 'N/A';
      if (cost > 0 || revUSD > 0) {
        if (roi >= 150) kpiScore = 'A';
        else if (roi >= 100) kpiScore = 'B';
        else if (roi >= 50) kpiScore = 'C';
        else if (roi > 0) kpiScore = 'D';
        else kpiScore = 'F';
      }

      // KPI target = gross thực tế × multiplier (tham khảo)
      const gross = fulltimeGrossMap.get(emp.id) || 0;
      const s = kpiOverrides.get(emp.id) || kpiSettings;
      const kpiTargetVND = gross * s.multiplier;
      const kpiPercent = kpiTargetVND > 0 ? (revVND / kpiTargetVND) * 100 : null;
      const kpiBonusVND = kpiTargetVND > 0 ? Math.max(0, revVND - kpiTargetVND) * s.bonusPercent / 100 : 0;

      fulltimeBreakdown.push({
        employeeId: emp.id,
        workerId: workerId || '',
        fullName: emp.full_name,
        period: periodStr,
        totalCompanyCost: cost,
        totalTaskRevenue: revUSD,
        totalTaskCount: count,
        profitLoss: pnl,
        roiPercent: roi,
        kpiScore,
        grossActual: gross,
        kpiTargetVND,
        kpiPercent,
        kpiBonusVND,
        kpiMultiplier: s.multiplier,
        kpiBonusPercent: s.bonusPercent,
        tasks: (taskData?.tasks || []).slice().sort((a, b) => b.priceUSD - a.priceUSD)
      });
    });
  }
  
  // Sort fulltime breakdown by ROI descending
  fulltimeBreakdown.sort((a, b) => b.roiPercent - a.roiPercent);

  // ── 6. DỰ KIẾN ────────────────────────────────────────────────
  // Doanh thu dự kiến: task đã làm xong nhưng CHƯA nằm trong phiếu nghiệm thu nào.
  const { data: acceptedTaskIds } = await supabase.from('wf_project_acceptance_tasks').select('task_id');
  const inAcceptance = new Set((acceptedTaskIds || []).map((r: any) => r.task_id));
  const { data: openTasks } = await supabase
    .from('wf_tasks')
    .select('id, client_price, price, currency, clickup_status, payment_status, clickup_space_name');
  // Space nội bộ (marketing/BD/R&D): có task nhưng không bán cho khách ⇒ không đòi giá.
  const { data: spaceRows } = await supabase
    .from('wf_space_settings').select('space_name').eq('is_internal', true);
  const internalSpaces = new Set((spaceRows || []).map((r: any) => r.space_name));

  let projRevenueUSD = 0, projFreelancer = 0, projTaskCount = 0, tasksWithoutPrice = 0;
  (openTasks || []).forEach((t: any) => {
    if (inAcceptance.has(t.id)) return;
    if (NOT_YET_DONE.has(String(t.clickup_status || '').toLowerCase().trim())) return;
    const isInternal = internalSpaces.has(t.clickup_space_name);
    if (!isInternal) projTaskCount++;
    const cp = Number(t.client_price || 0);
    if (cp > 0) projRevenueUSD += cp;
    else if (!isInternal) tasksWithoutPrice++;
    if (t.payment_status !== 'paid') {
      const p = Number(t.price || 0);
      projFreelancer += t.currency === 'USD' ? p * exchangeRate : p;
    }
  });

  // Chi phí lương dự kiến: sheet tháng này (kể cả draft) → không có thì lấy sheet gần nhất
  // đã chốt, coi như tháng này mọi người làm đủ công y như tháng trước.
  // ponytail: xấp xỉ bằng tháng trước thay vì dựng lại calculatePayroll từ hr_employee_salary.
  // Người mới vào / nghỉ giữa tháng sẽ lệch — nâng cấp khi con số này bị soi kỹ.
  let projFulltime = 0;
  let payrollSource: ProjectedSummary['payrollSource'] = 'khong-co';
  const sumSheetCost = async (ids: string[]) => {
    const { data } = await supabase.from('pay_payroll_records').select('total_company_cost').in('sheet_id', ids);
    return (data || []).reduce((s: number, r: any) => s + Number(r.total_company_cost || 0), 0);
  };
  if (sheets && sheets.length > 0) {
    projFulltime = await sumSheetCost(sheets.map(s => s.id));
    payrollSource = 'sheet-thang-nay';
  } else {
    const { data: prev } = await supabase
      .from('pay_payroll_sheets').select('id')
      .in('status', ['confirmed', 'paid'])
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
    if (prev && prev.length > 0) {
      projFulltime = await sumSheetCost([prev[0].id]);
      payrollSource = 'sheet-thang-truoc';
    }
  }

  const projTotalCost = projFulltime + projFreelancer + operationalExpenses;
  const projected: ProjectedSummary = {
    revenueVND: projRevenueUSD * exchangeRate,
    fulltimeCost: projFulltime,
    freelancerCost: projFreelancer,
    totalCost: projTotalCost,
    grossProfit: projRevenueUSD * exchangeRate - projTotalCost,
    taskCount: projTaskCount,
    tasksWithoutPrice,
    payrollSource,
  };

  return {
    period: { month, year },
    projected,
    totalRevenue: totalRevenueUSD,
    revenueCurrency: 'USD',
    revenueVND,
    fulltimePayroll,
    freelancerPayments,
    operationalExpenses,
    totalCost,
    grossProfit,
    profitMargin,
    fulltimeBreakdown,
    freelancerBreakdown,
    kpiSettings
  };
}
