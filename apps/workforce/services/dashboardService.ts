import { supabase } from '@/services/supabaseClient';
import { fetchEmployees } from '@/apps/hr/services/hrService';
import { acceptanceNetAmount } from './projectAcceptanceService';
import { estimateMonthlyPayroll } from '@/apps/payroll/services/payrollService';

export interface FulltimeKPI {
  employeeId: string;
  workerId: string;
  fullName: string;
  period: string; // "YYYY-MM"
  totalCompanyCost: number; // Cost in VND
  totalTaskRevenue: number; // Revenue in USD
  totalTaskCount: number;
  // Phiếu nghiệm thu draft/sent (khách chưa duyệt) — KHÔNG vào Thực tế, chỉ vào Dự kiến.
  // Tách riêng để gộp kỳ: tháng đã qua vẫn giữ phần này trong Dự kiến (phiếu còn treo chờ khách).
  pendingRevenueUSD: number;
  pendingTaskCount: number;
  pendingTasks: FulltimeTaskDetail[];
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
  // ── DỰ KIẾN: task đã làm xong nhưng CHƯA nghiệm thu + lương ước (sheet tháng này,
  // không có thì sheet tháng gần nhất). Cùng công thức KPI/thưởng như số thực tế.
  projTaskCount: number;
  projRevenueUSD: number;
  projCost: number;             // VND
  projGross: number;            // VND — gross dùng để tính target dự kiến
  projKpiPercent: number | null;
  projBonusVND: number;
  projTasks: FulltimeTaskDetail[];
}

export interface FulltimeTaskDetail {
  title: string;
  project: string;
  client: string;
  priceUSD: number;     // giá trị hiệu suất (đã trừ FIX, đã chia share)
  fixCount: number;     // số lần task bị trả về FIX (log từ lúc deploy)
  penaltyPct: number;   // % đã trừ
}

export interface KpiSettings {
  multiplier: number;
  bonusPercent: number;
  fixPenaltyStep: number;  // % trừ mỗi lần FIX (sau số lần miễn)
  fixPenaltyFree: number;  // số lần FIX đầu không trừ
  fixPenaltyCap: number;   // trần % trừ
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
  tasksWithoutDate: number;   // task xong nhưng KHÔNG có ngày nào → rơi khỏi mọi tháng, mất hẳn
  pendingAcceptanceCount: number; // phiếu nghiệm thu đã lập (draft/sent) chưa được khách duyệt
  pendingAcceptanceVND: number;   // tiền của các phiếu đó — đã cộng vào revenueVND dự kiến
  duplicateTasks: number;         // task trùng tên trong cùng tháng → doanh thu dự kiến cộng đôi
  duplicateRevenueUSD: number;    // phần tiền thừa do trùng (tổng client_price của bản dư)
  payrollSource: 'sheet-thang-nay' | 'sheet-thang-truoc' | 'uoc-tinh-nhap' | 'khong-co';
}

// Trạng thái ClickUp được tính vào doanh thu dự kiến. Sếp chốt 2026-08-27: WHITELIST —
// chỉ 4 nhóm này, mọi trạng thái khác (kể cả lạ/mới thêm trên ClickUp) đều bỏ.
// Trước đây là blacklist (liệt kê cái CHƯA xong) ⇒ ClickUp thêm status mới là nó tự lọt
// vào dự kiến mà không ai biết. Whitelist thì rủi ro ngược lại — thiếu tiền chứ không
// thừa tiền — và badge "task chưa nhập giá / chưa có ngày" sẽ lộ ra.
// ClickUp KHÔNG có status 'done' thật (sếp nêu 'done' = 'completed'/'complete');
// giữ cả 'done' phòng khi ClickUp thêm sau.
// Cố tình LOẠI: fix (đang sửa lại, chưa xong), internal review, lead_check.
const DONE_STATUSES = new Set([
  'client_review', 'approved', 'closed', 'done', 'completed', 'complete',
]);

/** Lưu config KPI: employeeId=null → global, ngược lại → override per nhân viên */
export async function saveKpiSettings(employeeId: string | null, s: KpiSettings): Promise<void> {
  const payload = {
    multiplier: s.multiplier, bonus_percent: s.bonusPercent,
    fix_penalty_step: s.fixPenaltyStep, fix_penalty_free: s.fixPenaltyFree, fix_penalty_cap: s.fixPenaltyCap,
    updated_at: new Date().toISOString(),
  };
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
  // Lấy MỌI trạng thái: accepted → Thực tế (công ty + từng NV); draft/sent → Dự kiến
  // (công ty: pendingAcceptances; NV: projByWorker). Sếp chốt 2026-09-15: hai cột NV phải
  // cộng lại đúng bằng tổng công ty, phiếu khách chưa duyệt không được tính vào Thực tế.
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
      // Per-nhân-viên: CỘNG DỒN (2 sổ TD GAMES / TD CONSULTING = 2 sheet cùng tháng),
      // ưu tiên nhóm sheet confirmed/paid, không có mới lấy nhóm draft — giống loadSheetCosts.
      const draftCost = new Map<string, number>();
      const draftGross = new Map<string, number>();
      payrollRecords.forEach(r => {
        const cost = Number(r.total_company_cost || 0);
        const isConfirmed = confirmedSheetIds.has(r.sheet_id);
        if (isConfirmed) fulltimePayroll += cost; // P&L công ty: chỉ số thực
        const [cm, gm] = isConfirmed ? [fulltimeCostsMap, fulltimeGrossMap] : [draftCost, draftGross];
        cm.set(r.employee_id, (cm.get(r.employee_id) || 0) + cost);
        gm.set(r.employee_id, (gm.get(r.employee_id) || 0) + Number(r.gross_actual || 0));
      });
      draftCost.forEach((c, id) => {
        if (fulltimeCostsMap.has(id)) return;
        fulltimeCostsMap.set(id, c);
        fulltimeGrossMap.set(id, draftGross.get(id) || 0);
      });
    }
  }

  // 2b. KPI settings (global + override per nhân viên)
  const { data: kpiRows } = await supabase
    .from('wf_kpi_settings')
    .select('employee_id, multiplier, bonus_percent, fix_penalty_step, fix_penalty_free, fix_penalty_cap');
  let kpiSettings: KpiSettings = { multiplier: 3, bonusPercent: 20, fixPenaltyStep: 5, fixPenaltyFree: 1, fixPenaltyCap: 30 };
  const kpiOverrides = new Map<string, KpiSettings>();
  (kpiRows || []).forEach((r: any) => {
    const s: KpiSettings = {
      multiplier: Number(r.multiplier), bonusPercent: Number(r.bonus_percent),
      fixPenaltyStep: Number(r.fix_penalty_step ?? 5), fixPenaltyFree: Number(r.fix_penalty_free ?? 1), fixPenaltyCap: Number(r.fix_penalty_cap ?? 30),
    };
    if (r.employee_id) kpiOverrides.set(r.employee_id, s);
    else kpiSettings = s;
  });

  // 2c. Số lần task bị trả về FIX (log do trigger DB trên wf_tasks ghi — mọi nguồn: webhook/cron/Sync tay) ⇒ trừ giá trị hiệu suất của
  // người làm. Doanh thu công ty (P&L, phiếu nghiệm thu) KHÔNG đổi — chỉ bảng KPI per NV.
  const { data: fixLogs } = await supabase
    .from('wf_task_status_log').select('task_id').ilike('to_status', 'fix');
  const fixCountMap = new Map<string, number>();
  (fixLogs || []).forEach((r: any) => fixCountMap.set(r.task_id, (fixCountMap.get(r.task_id) || 0) + 1));
  const fixPenaltyPct = (taskId: string) =>
    Math.min(kpiSettings.fixPenaltyCap, Math.max(0, (fixCountMap.get(taskId) || 0) - kpiSettings.fixPenaltyFree) * kpiSettings.fixPenaltyStep);

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
  // getDate() chứ KHÔNG toISOString(): máy múi giờ +7 thì toISOString lùi 1 ngày ⇒ ngày 30/31 rớt khỏi tháng.
  const endOfMonth = `${startOfMonth.slice(0, 8)}${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  
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

  // ── 5. DỰ KIẾN (tính TRƯỚC bảng KPI để mỗi nhân sự có số dự kiến của riêng mình) ──
  // Doanh thu dự kiến: task đã làm xong nhưng CHƯA nằm trong phiếu nghiệm thu nào.
  const [{ data: acceptedTaskIds }, { data: settledTaskIds }, { data: ftRows }] = await Promise.all([
    supabase.from('wf_project_acceptance_tasks').select('task_id'),
    // Task đã nằm trong phiếu thanh toán freelancer (mọi status, kể cả draft) ⇒ tiền đã
    // tính ở freelancerPayments (dòng ~251) → không cộng lại vào projFreelancer (đếm đôi).
    supabase.from('wf_settlement_tasks').select('task_id'),
    // Worker là nhân viên fulltime ⇒ chi phí nằm ở payroll; task.price (nếu lỡ nhập) không
    // phải chi phí freelancer.
    supabase.from('hr_employees').select('worker_id').not('worker_id', 'is', null),
  ]);
  const inAcceptance = new Set((acceptedTaskIds || []).map((r: any) => r.task_id));
  const inSettlement = new Set((settledTaskIds || []).map((r: any) => r.task_id));
  const fulltimeWorkerSet = new Set((ftRows || []).map((r: any) => r.worker_id as string));
  const { data: openTasks } = await supabase
    .from('wf_tasks')
    .select('id, title, project, client_name, clickup_folder_name, client_price, price, currency, clickup_status, payment_status, clickup_space_name, completed_at, closed_date, clickup_updated_at');
  // Space nội bộ (marketing/BD/R&D): có task nhưng không bán cho khách ⇒ không đòi giá.
  const { data: spaceRows } = await supabase
    .from('wf_space_settings').select('space_name').eq('is_internal', true);
  const internalSpaces = new Set((spaceRows || []).map((r: any) => r.space_name));

  let projRevenueUSD = 0, projFreelancer = 0, projTaskCount = 0, tasksWithoutPrice = 0, tasksWithoutDate = 0;
  const projTaskMap = new Map<string, any>();
  const internalTaskIds = new Set<string>();
  const projFreelancerCandidates = new Map<string, number>(); // task_id → VND, chốt sau khi biết assignee
  (openTasks || []).forEach((t: any) => {
    if (inAcceptance.has(t.id)) return;
    if (!DONE_STATUSES.has(String(t.clickup_status || '').toLowerCase().trim())) return;
    // Chỉ task LÀM XONG TRONG THÁNG đang xem (trước đây không lọc ngày nên tháng nào
    // cũng gộp cả task tồn từ 2025).
    // Task chờ khách duyệt (client_review…) chưa đóng nên ClickUp KHÔNG trả date_done ⇒
    // lấy clickup_updated_at (ngày task chuyển động lần cuối trên ClickUp) làm mốc, nếu
    // không cả đống task đang treo tiền bị giấu mất.
    // ponytail: KHÔNG dùng updated_at/synced_at của DB — chúng là ngày bấm Sync, sync
    // một phát là cả task từ tháng 4 nhảy vào tháng hiện tại. start_date cũng không dùng
    // (kéo task về tháng bắt đầu, task xong tháng này mà khởi động tháng trước sẽ mất).
    const doneAt = t.completed_at || t.closed_date || t.clickup_updated_at;
    const isInternal = internalSpaces.has(t.clickup_space_name);
    // Trống cả 3 cột ngày ⇒ task rơi khỏi MỌI tháng, không ai thấy, tiền mất im lặng.
    // Không đoán ngày thay (start_date/created_at kéo task về sai tháng) — đếm để cảnh báo,
    // sếp sửa trên ClickUp rồi sync là số tự về đúng.
    if (!doneAt) { if (!isInternal) tasksWithoutDate++; return; }
    if (doneAt < startOfMonth || doneAt > endOfMonth) return;
    // Space nội bộ: không bán cho khách ⇒ không có doanh thu dù client_price lỡ > 0
    // (trước đây tiền cộng vào nhưng task không đếm ⇒ lệch). Chi phí freelancer thì vẫn thật.
    if (isInternal) internalTaskIds.add(t.id);
    else {
      projTaskCount++;
      const cp = Number(t.client_price || 0);
      if (cp > 0) projRevenueUSD += cp;
      else tasksWithoutPrice++;
    }
    if (t.payment_status !== 'paid' && !inSettlement.has(t.id)) {
      const p = Number(t.price || 0);
      if (p > 0) projFreelancerCandidates.set(t.id, t.currency === 'USD' ? p * exchangeRate : p);
    }
    projTaskMap.set(t.id, t);
  });

  // Task TRÙNG TÊN trong cùng tháng dự kiến ⇒ ClickUp bị tạo 2 lần, doanh thu cộng đôi.
  // ponytail: chỉ ĐẾM, không tự loại bản dư — nguồn thật nằm trên ClickUp, xoá nhầm thì
  // mất luôn task hợp lệ (làm lại lần 2 cũng trùng tên). Sếp xoá trên ClickUp + sync là hết.
  const byTitle = new Map<string, any[]>();
  projTaskMap.forEach((t: any) => {
    const k = String(t.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!k) return;
    byTitle.set(k, [...(byTitle.get(k) || []), t]);
  });
  let duplicateTasks = 0, duplicateRevenueUSD = 0;
  byTitle.forEach(list => {
    if (list.length < 2) return;
    duplicateTasks += list.length - 1;
    duplicateRevenueUSD += list.slice(1).reduce((s, t) => s + Number(t.client_price || 0), 0);
  });

  // Chia doanh thu dự kiến cho người làm theo share_pct (cùng quy tắc với số thực tế)
  const projByWorker = new Map<string, { count: number; revenue: number; tasks: FulltimeTaskDetail[] }>();
  if (projTaskMap.size > 0) {
    const { data: projAssg } = await supabase
      .from('wf_task_assignees')
      .select('task_id, worker_id, share_pct')
      .in('task_id', [...projTaskMap.keys()]);
    // Chi phí freelancer dự kiến: bỏ task mà MỌI người làm đều là fulltime (đã có payroll).
    // Task chưa gán ai thì vẫn tính (không biết ai làm ⇒ giữ nguyên hành vi cũ).
    const assgByTask = new Map<string, string[]>();
    (projAssg || []).forEach((a: any) =>
      assgByTask.set(a.task_id, [...(assgByTask.get(a.task_id) || []), a.worker_id]));
    projFreelancerCandidates.forEach((vnd, taskId) => {
      const ws = assgByTask.get(taskId) || [];
      if (ws.length > 0 && ws.every(w => fulltimeWorkerSet.has(w))) return;
      projFreelancer += vnd;
    });
    (projAssg || []).forEach((a: any) => {
      const t = projTaskMap.get(a.task_id);
      if (!t || internalTaskIds.has(t.id)) return;
      const cur = projByWorker.get(a.worker_id) || { count: 0, revenue: 0, tasks: [] as FulltimeTaskDetail[] };
      const penaltyPct = fixPenaltyPct(t.id);
      const price = Number(t.client_price || 0) * Number(a.share_pct || 0) / 100 * (1 - penaltyPct / 100);
      cur.count += 1;
      cur.revenue += price;
      cur.tasks.push({
        title: t.title || '(không tên)',
        project: t.project || t.clickup_folder_name || '',
        client: t.client_name || t.clickup_space_name || '',
        priceUSD: price,
        fixCount: fixCountMap.get(t.id) || 0,
        penaltyPct,
      });
      projByWorker.set(a.worker_id, cur);
    });
  }

  // Chi phí lương dự kiến: sheet tháng này (kể cả draft) → không có thì lấy sheet gần nhất
  // đã chốt, coi như tháng này mọi người làm đủ công y như tháng trước.
  // ponytail: xấp xỉ bằng tháng trước thay vì dựng lại calculatePayroll từ hr_employee_salary.
  // Người mới vào / nghỉ giữa tháng sẽ lệch — nâng cấp khi con số này bị soi kỹ.
  let projFulltime = 0;
  let payrollSource: ProjectedSummary['payrollSource'] = 'khong-co';
  const projCostMap = new Map<string, number>();   // employee_id -> chi phí công ty dự kiến
  const projGrossMap = new Map<string, number>();  // employee_id -> gross dự kiến
  const loadSheetCosts = async (ids: string[]) => {
    const { data } = await supabase.from('pay_payroll_records')
      .select('employee_id, total_company_cost, gross_actual').in('sheet_id', ids);
    let sum = 0;
    (data || []).forEach((r: any) => {
      const c = Number(r.total_company_cost || 0);
      sum += c;
      projCostMap.set(r.employee_id, (projCostMap.get(r.employee_id) || 0) + c);
      projGrossMap.set(r.employee_id, (projGrossMap.get(r.employee_id) || 0) + Number(r.gross_actual || 0));
    });
    return sum;
  };
  if (sheets && sheets.length > 0) {
    projFulltime = await loadSheetCosts(sheets.map(s => s.id));
    payrollSource = 'sheet-thang-nay';
  } else {
    const { data: prev } = await supabase
      .from('pay_payroll_sheets').select('id')
      .in('status', ['confirmed', 'paid'])
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
    if (prev && prev.length > 0) {
      projFulltime = await loadSheetCosts([prev[0].id]);
      payrollSource = 'sheet-thang-truoc';
    }
  }

  // Chưa có sheet của tháng này ⇒ tự tính lương NHÁP theo hợp đồng, giả định đủ công.
  // Chạy đúng engine calculatePayroll (thuế, BHXH, thử việc) nên sát bảng lương thật;
  // kế toán nhập chấm công / chốt sheet là số thật thay thế ngay.
  if (payrollSource !== 'sheet-thang-nay') {
    const draft = await estimateMonthlyPayroll(month, year);
    if (draft.size > 0) {
      projFulltime = 0;
      projCostMap.clear();
      projGrossMap.clear();
      draft.forEach((v, empId) => {
        projCostMap.set(empId, v.companyCost);
        projGrossMap.set(empId, v.grossActual);
        projFulltime += v.companyCost;
      });
      payrollSource = 'uoc-tinh-nhap';
    }
  }

  // Dự kiến = số sẽ về nếu tháng chạy trọn = ĐÃ chốt + CHỜ chốt (sếp chốt 2026-09-10).
  // Lương thì luôn cả tháng đủ công; doanh thu / freelancer cộng thực tế vào phần chờ.
  // CHỜ chốt gồm 2 lớp: (a) task xong chưa vào phiếu (projRevenueUSD) và (b) phiếu nghiệm
  // thu đã lập nhưng khách chưa duyệt (draft/sent). Trước đây (b) rơi khỏi CẢ thực tế
  // (chỉ accepted) LẪN dự kiến (task đã nằm trong phiếu bị loại ở vòng lặp trên) ⇒ tiền
  // biến mất, còn bảng KPI nhân sự vẫn tính mọi phiếu nên cộng dòng ≠ tổng công ty.
  const pendingAcceptances = (acceptances || []).filter(acc => acc.status !== 'accepted');
  const pendingAcceptanceUSD = pendingAcceptances.reduce((sum, acc) => sum + acceptanceNetAmount(acc), 0);
  const pendingAcceptanceVND = pendingAcceptanceUSD * exchangeRate;
  const projRevenueTotalVND = revenueVND + pendingAcceptanceVND + projRevenueUSD * exchangeRate;
  const projFreelancerTotal = freelancerPayments + projFreelancer;
  const projTotalCost = projFulltime + projFreelancerTotal + operationalExpenses;
  const projected: ProjectedSummary = {
    revenueVND: projRevenueTotalVND,
    fulltimeCost: projFulltime,
    freelancerCost: projFreelancerTotal,
    totalCost: projTotalCost,
    grossProfit: projRevenueTotalVND - projTotalCost,
    taskCount: projTaskCount,
    tasksWithoutPrice,
    tasksWithoutDate,
    pendingAcceptanceCount: pendingAcceptances.length,
    pendingAcceptanceVND,
    duplicateTasks,
    duplicateRevenueUSD,
    payrollSource,
  };

  // 6. Calculate Fulltime KPI
  // We need tasks completed by fulltime workers in this period, and their client_price
  // Không lọc status=active: NV đã nghỉ vẫn phải hiện ở tháng họ còn lương / task,
  // không thì xem lại tháng cũ mất dòng, cộng các dòng ≠ tổng công ty. Lọc ở dưới.
  const { data: hrEmployees } = await supabase
    .from('hr_employees')
    .select('id, full_name, type, status, worker_id')
    .eq('type', 'fulltime');
    
  const fulltimeBreakdown: FulltimeKPI[] = [];
  
  if (hrEmployees) {
    const fulltimeWorkerIds = hrEmployees.map(e => e.worker_id).filter(Boolean) as string[];
    
    // Fetch tasks linked to acceptances in this period
    // Thực tế NV = task trong phiếu ĐÃ DUYỆT (accepted) — cùng quy tắc với Thực tế công ty (dòng ~152).
    // Phiếu draft/sent (khách chưa duyệt) → đẩy sang projByWorker (cột Dự kiến), cùng quy tắc với
    // pendingAcceptances của tổng công ty. Trước 2026-09-15 Thực tế NV tính cả phiếu chưa duyệt
    // ⇒ ROI/hạng KPI/thưởng trả trên tiền khách chưa chốt, cộng dòng NV ≠ tổng công ty.
    let taskRevenues = new Map<string, { count: number, revenue: number, tasks: FulltimeTaskDetail[] }>();
    const pendingRevenues = new Map<string, { count: number, revenue: number, tasks: FulltimeTaskDetail[] }>();

    if (acceptances && acceptances.length > 0 && fulltimeWorkerIds.length > 0) {
      const acceptanceIds = acceptances.map(a => a.id);
      // Discount của phiếu phân bổ theo tỷ lệ vào từng task ⇒ cộng các dòng NV = tổng công ty.
      // (Phiếu chỉ có draft/sent/accepted — không có trạng thái huỷ để loại.)
      const discountFactor = new Map(acceptances.map(a => [
        a.id, Number(a.total_amount) > 0 ? acceptanceNetAmount(a) / Number(a.total_amount) : 1,
      ]));
      const accStatus = new Map(acceptances.map(a => [a.id, a.status]));

      // Get acceptance tasks
      const { data: accTasks } = await supabase
        .from('wf_project_acceptance_tasks')
        .select('acceptance_id, task_id, client_price')
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
            const target = accStatus.get(at.acceptance_id) === 'accepted' ? taskRevenues : pendingRevenues;
            for (const a of byTask.get(at.task_id) || []) {
              const current = target.get(a.worker_id) || { count: 0, revenue: 0, tasks: [] as FulltimeTaskDetail[] };
              const penaltyPct = fixPenaltyPct(at.task_id);
              const price = Number(at.client_price || 0) * (discountFactor.get(at.acceptance_id) ?? 1)
                * Number(a.share_pct || 0) / 100 * (1 - penaltyPct / 100);
              current.count += 1;
              current.revenue += price;
              current.tasks.push({
                title: info.title || '(không tên)',
                project: info.project || info.clickup_folder_name || '',
                client: info.client_name || info.clickup_space_name || '',
                priceUSD: price,
                fixCount: fixCountMap.get(at.task_id) || 0,
                penaltyPct,
              });
              target.set(a.worker_id, current);
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

      // Dự kiến per nhân viên: đã nghiệm thu + phiếu chờ khách duyệt + task xong chưa vào phiếu,
      // so với lương cả tháng — cùng 3 lớp với Dự kiến công ty.
      const projData = workerId ? projByWorker.get(workerId) : null;
      const pendData = workerId ? pendingRevenues.get(workerId) : null;
      const pendingRevenueUSD = pendData?.revenue || 0;
      const projRevUSD = revUSD + pendingRevenueUSD + (projData?.revenue || 0);
      const projRevVND = projRevUSD * exchangeRate;
      const projCost = projCostMap.get(emp.id) ?? cost;
      // NV đã nghỉ mà tháng này không có lương, không có task ⇒ bỏ qua
      if (emp.status !== 'active' && cost === 0 && count === 0 && projRevUSD === 0 && projCost === 0) return;
      const projGross = projGrossMap.get(emp.id) ?? gross;
      const projTarget = projGross * s.multiplier;
      const projKpiPercent = projTarget > 0 ? (projRevVND / projTarget) * 100 : null;
      const projBonusVND = projTarget > 0 ? Math.max(0, projRevVND - projTarget) * s.bonusPercent / 100 : 0;

      fulltimeBreakdown.push({
        projTaskCount: count + (pendData?.count || 0) + (projData?.count || 0),
        projRevenueUSD: projRevUSD,
        projCost,
        projGross,
        projKpiPercent,
        projBonusVND,
        projTasks: [...(taskData?.tasks || []), ...(pendData?.tasks || []), ...(projData?.tasks || [])].sort((a, b) => b.priceUSD - a.priceUSD),
        pendingRevenueUSD,
        pendingTaskCount: pendData?.count || 0,
        pendingTasks: pendData?.tasks || [],
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

/**
 * Gộp nhiều tháng thành một báo cáo. Chạy lại getDashboardData cho từng tháng rồi cộng dồn.
 *
 * ponytail: gọi song song N lần thay vì viết query gộp — mỗi tháng đã có sẵn toàn bộ logic
 * (lương nháp, phiếu nghiệm thu, task dự kiến) và N ở đây là 3-12, không phải 1000. Viết
 * query gộp là nhân đôi công thức để tiết kiệm vài trăm ms.
 * Số tỷ lệ (ROI, %KPI, thưởng) KHÔNG cộng được — phải tính lại trên tổng.
 */
export async function getDashboardDataRange(
  months: { month: number; year: number }[],
  exchangeRate: number = 25000,
  accountTypeFilter: 'all' | 'company' | 'personal' = 'all',
): Promise<MonthlyFinancialSummary> {
  const raw = await Promise.all(
    months.map(m => getDashboardData(m.month, m.year, exchangeRate, accountTypeFilter)),
  );

  // Tháng ĐÃ QUA thì "dự kiến" của nó chính là số thực tế đã chốt — không còn gì để đoán.
  // Chỉ tháng đang chạy (và tháng tương lai) mới dùng số dự kiến. Nhờ vậy cột Dự kiến của
  // cả kỳ = thực tế các tháng trước + dự kiến tháng này, đúng như cách đọc báo cáo.
  const now = new Date();
  const curKey = now.getFullYear() * 12 + now.getMonth() + 1;
  const parts = raw.map((p, i) => {
    const isPast = months[i].year * 12 + months[i].month < curKey;
    if (!isPast) return p;
    return {
      ...p,
      // Riêng phiếu nghiệm thu đã LẬP cho tháng đó mà khách chưa duyệt thì vẫn là tiền sắp về
      // (vd 2 phiếu sent period 2026-08 lập ngày 3/9) ⇒ giữ trong Dự kiến, không gập mất.
      projected: {
        ...p.projected,
        revenueVND: p.revenueVND + p.projected.pendingAcceptanceVND,
        fulltimeCost: p.fulltimePayroll,
        freelancerCost: p.freelancerPayments,
        totalCost: p.totalCost,
        grossProfit: p.revenueVND + p.projected.pendingAcceptanceVND - p.totalCost,
        taskCount: 0,
        tasksWithoutPrice: 0,
      },
      fulltimeBreakdown: p.fulltimeBreakdown.map(k => ({
        ...k,
        projTaskCount: k.totalTaskCount + k.pendingTaskCount,
        projRevenueUSD: k.totalTaskRevenue + k.pendingRevenueUSD,
        projCost: k.totalCompanyCost,
        projGross: k.grossActual,
        projTasks: [...k.tasks, ...k.pendingTasks],
      })),
    };
  });
  if (parts.length === 1) return parts[0];

  const last = parts[parts.length - 1];
  const s = last.kpiSettings;
  const sum = (pick: (p: MonthlyFinancialSummary) => number) => parts.reduce((a, p) => a + pick(p), 0);

  // ── Nhân sự fulltime: gộp theo employeeId ──
  const empMap = new Map<string, FulltimeKPI>();
  parts.forEach(p => p.fulltimeBreakdown.forEach(k => {
    const cur = empMap.get(k.employeeId);
    if (!cur) { empMap.set(k.employeeId, { ...k, tasks: [...k.tasks], projTasks: [...k.projTasks] }); return; }
    cur.totalCompanyCost += k.totalCompanyCost;
    cur.totalTaskRevenue += k.totalTaskRevenue;
    cur.totalTaskCount += k.totalTaskCount;
    cur.grossActual += k.grossActual;
    cur.projTaskCount += k.projTaskCount;
    cur.projRevenueUSD += k.projRevenueUSD;
    cur.projCost += k.projCost;
    cur.projGross += k.projGross;
    cur.pendingRevenueUSD += k.pendingRevenueUSD;
    cur.pendingTaskCount += k.pendingTaskCount;
    cur.pendingTasks.push(...k.pendingTasks);
    cur.tasks.push(...k.tasks);
    cur.projTasks.push(...k.projTasks);
  }));
  const fulltimeBreakdown = [...empMap.values()].map(k => {
    const revVND = k.totalTaskRevenue * exchangeRate;
    const projRevVND = k.projRevenueUSD * exchangeRate;
    const pnl = revVND - k.totalCompanyCost;
    const roi = k.totalCompanyCost > 0 ? (pnl / k.totalCompanyCost) * 100 : 0;
    let kpiScore: FulltimeKPI['kpiScore'] = 'N/A';
    if (k.totalCompanyCost > 0) {
      if (roi >= 150) kpiScore = 'A';
      else if (roi >= 100) kpiScore = 'B';
      else if (roi >= 50) kpiScore = 'C';
      else if (roi > 0) kpiScore = 'D';
      else kpiScore = 'F';
    }
    const target = k.grossActual * k.kpiMultiplier;
    const projTarget = k.projGross * k.kpiMultiplier;
    return {
      ...k,
      period: `${months[0].year}-${String(months[0].month).padStart(2, '0')} → ${months[months.length - 1].year}-${String(months[months.length - 1].month).padStart(2, '0')}`,
      profitLoss: pnl,
      roiPercent: roi,
      kpiScore,
      kpiTargetVND: target,
      kpiPercent: target > 0 ? (revVND / target) * 100 : null,
      kpiBonusVND: target > 0 ? Math.max(0, revVND - target) * k.kpiBonusPercent / 100 : 0,
      projKpiPercent: projTarget > 0 ? (projRevVND / projTarget) * 100 : null,
      projBonusVND: projTarget > 0 ? Math.max(0, projRevVND - projTarget) * k.kpiBonusPercent / 100 : 0,
    };
  });

  // ── Freelancer: gộp theo workerId ──
  const flMap = new Map<string, FreelancerPaymentSummary>();
  parts.forEach(p => p.freelancerBreakdown.forEach(f => {
    const cur = flMap.get(f.workerId);
    if (!cur) { flMap.set(f.workerId, { ...f }); return; }
    cur.taskCount += f.taskCount;
    cur.totalAmount += f.totalAmount;
    cur.bonusAmount += f.bonusAmount;
    cur.taxAmount += f.taxAmount;
    cur.netAmount += f.netAmount;
    // Nhiều tháng gộp lại thì trạng thái trả tiền không còn là một giá trị duy nhất.
    if (cur.paymentStatus !== f.paymentStatus) cur.paymentStatus = 'mixed';
  }));

  const totalCost = sum(p => p.totalCost);
  const grossProfit = sum(p => p.grossProfit);
  const projTotalCost = sum(p => p.projected.totalCost);
  return {
    period: last.period,
    totalRevenue: sum(p => p.totalRevenue),
    revenueCurrency: last.revenueCurrency,
    revenueVND: sum(p => p.revenueVND),
    fulltimePayroll: sum(p => p.fulltimePayroll),
    freelancerPayments: sum(p => p.freelancerPayments),
    operationalExpenses: sum(p => p.operationalExpenses),
    totalCost,
    grossProfit,
    profitMargin: totalCost > 0 ? (grossProfit / totalCost) * 100 : 0,
    fulltimeBreakdown,
    freelancerBreakdown: [...flMap.values()],
    kpiSettings: s,
    projected: {
      revenueVND: sum(p => p.projected.revenueVND),
      fulltimeCost: sum(p => p.projected.fulltimeCost),
      freelancerCost: sum(p => p.projected.freelancerCost),
      totalCost: projTotalCost,
      grossProfit: sum(p => p.projected.grossProfit),
      taskCount: sum(p => p.projected.taskCount),
      tasksWithoutPrice: sum(p => p.projected.tasksWithoutPrice),
      // Đếm toàn cục (task không có ngày thì không thuộc tháng nào) ⇒ lấy 1 lần, không cộng dồn N tháng.
      tasksWithoutDate: last.projected.tasksWithoutDate,
      pendingAcceptanceCount: sum(p => p.projected.pendingAcceptanceCount),
      pendingAcceptanceVND: sum(p => p.projected.pendingAcceptanceVND),
      duplicateTasks: sum(p => p.projected.duplicateTasks),
      duplicateRevenueUSD: sum(p => p.projected.duplicateRevenueUSD),
      payrollSource: last.projected.payrollSource,
    },
  };
}
