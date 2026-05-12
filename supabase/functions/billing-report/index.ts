import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-billing-api-key",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Helper: compute invoice total from items ──
function calcInvoiceTotal(items: any[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, params = {} } = body;

    // ════════════════════════════════════════════════════════════
    // ACTION: overview — Tổng quan toàn bộ hệ thống
    // ════════════════════════════════════════════════════════════
    if (action === "overview") {
      const [invRes, expRes, wkRes, taskRes, clientRes, projRes, empRes, deptRes, paySheetRes] = await Promise.all([
        supabase.from("invoice_invoices").select("status, amount_received, items, currency, created_at"),
        supabase.from("expense_expenses").select("amount, currency, type, status, expense_date"),
        supabase.from("wf_workers").select("id, name, status"),
        supabase.from("wf_tasks").select("status, price, currency, exchange_rate, payment_status"),
        supabase.from("crm_clients").select("id, name, status"),
        supabase.from("crm_projects").select("id, name, status"),
        supabase.from("hr_employees").select("id, full_name, status, department_id, position"),
        supabase.from("hr_departments").select("id, name"),
        supabase.from("pay_payroll_sheets").select("id, title, status, month, year, total_net_salary, total_company_cost").order("year", { ascending: false }).order("month", { ascending: false }).limit(3),
      ]);

      const invoices = invRes.data || [];
      const expenses = expRes.data || [];
      const employees = empRes.data || [];

      // Revenue
      let totalRevenue = 0;
      let paidCount = 0;
      for (const inv of invoices) {
        if (inv.status === "paid") {
          paidCount++;
          totalRevenue += inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items);
        }
      }

      // Expenses
      const expenseItems = expenses.filter((e: any) => e.type === "expense" || !e.type);
      const revenueItems = expenses.filter((e: any) => e.type === "revenue");
      const totalExpense = expenseItems.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      const totalRevenueFromExp = revenueItems.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      // Workforce
      const tasks = taskRes.data || [];
      let workforcePayable = 0;
      for (const t of tasks) {
        const price = Number(t.price) || 0;
        const rate = Number(t.exchange_rate) || 1;
        workforcePayable += t.currency === "USD" ? price * rate : price;
      }

      // HR
      const activeEmployees = employees.filter((e: any) => e.status === "active");
      const depts = deptRes.data || [];

      return json({
        success: true,
        data: {
          summary: {
            total_invoices: invoices.length,
            paid_invoices: paidCount,
            pending_invoices: invoices.length - paidCount,
            total_revenue: totalRevenue,
            total_expense: totalExpense,
            profit_loss: totalRevenue - totalExpense,
            active_employees: activeEmployees.length,
            total_workers: (wkRes.data || []).length,
            total_tasks: tasks.length,
            tasks_completed: tasks.filter((t: any) => t.status === "completed" || t.status === "approved").length,
            tasks_pending: tasks.filter((t: any) => t.status !== "completed" && t.status !== "approved").length,
            workforce_payable_vnd: workforcePayable,
            total_clients: (clientRes.data || []).length,
            total_projects: (projRes.data || []).length,
            departments: depts.length,
          },
          recent_payroll: (paySheetRes.data || []).map((s: any) => ({
            title: s.title,
            status: s.status,
            month: s.month,
            year: s.year,
          })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: revenue_report — Doanh thu theo tháng/client
    // ════════════════════════════════════════════════════════════
    if (action === "revenue_report") {
      const year = params.year || new Date().getFullYear();
      const { data: invoices } = await supabase
        .from("invoice_invoices")
        .select("id, invoice_number, status, currency, amount_received, items, client_name, issue_date, paid_date, created_at");

      const rows = (invoices || []).filter((inv: any) => {
        const d = new Date(inv.issue_date || inv.created_at);
        return d.getFullYear() === year;
      });

      // Monthly breakdown
      const monthly: Record<number, { count: number; total: number; paid: number }> = {};
      for (let m = 1; m <= 12; m++) monthly[m] = { count: 0, total: 0, paid: 0 };

      // By client
      const byClient: Record<string, { count: number; total: number }> = {};

      for (const inv of rows) {
        const d = new Date(inv.issue_date || inv.created_at);
        const m = d.getMonth() + 1;
        const total = inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items);
        monthly[m].count++;
        monthly[m].total += total;
        if (inv.status === "paid") monthly[m].paid++;

        const cn = inv.client_name || "Unknown";
        if (!byClient[cn]) byClient[cn] = { count: 0, total: 0 };
        byClient[cn].count++;
        byClient[cn].total += total;
      }

      return json({
        success: true,
        data: {
          year,
          total_invoices: rows.length,
          total_revenue: rows.reduce((s: number, inv: any) => s + (inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items)), 0),
          monthly: Object.entries(monthly).map(([m, v]) => ({ month: Number(m), ...v })),
          by_client: Object.entries(byClient)
            .map(([name, v]) => ({ client: name, ...v }))
            .sort((a, b) => b.total - a.total),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: expense_report — Chi phí theo category/tháng
    // ════════════════════════════════════════════════════════════
    if (action === "expense_report") {
      const year = params.year || new Date().getFullYear();
      const [expRes, catRes, budgetRes] = await Promise.all([
        supabase.from("expense_expenses").select("*, category:expense_categories(name)"),
        supabase.from("expense_categories").select("*"),
        supabase.from("expense_budgets").select("*").eq("year", year),
      ]);

      const expenses = (expRes.data || []).filter((e: any) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === year;
      });

      // Monthly breakdown
      const monthly: Record<number, { expense: number; revenue: number }> = {};
      for (let m = 1; m <= 12; m++) monthly[m] = { expense: 0, revenue: 0 };

      const byCategory: Record<string, number> = {};

      for (const e of expenses) {
        const d = new Date(e.expense_date);
        const m = d.getMonth() + 1;
        const amt = Number(e.amount) || 0;
        if (e.type === "revenue") {
          monthly[m].revenue += amt;
        } else {
          monthly[m].expense += amt;
          const catName = e.category?.name || "Uncategorized";
          byCategory[catName] = (byCategory[catName] || 0) + amt;
        }
      }

      return json({
        success: true,
        data: {
          year,
          total_expense: expenses.filter((e: any) => e.type !== "revenue").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0),
          total_revenue: expenses.filter((e: any) => e.type === "revenue").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0),
          monthly: Object.entries(monthly).map(([m, v]) => ({ month: Number(m), ...v, pl: v.revenue - v.expense })),
          by_category: Object.entries(byCategory)
            .map(([name, amount]) => ({ category: name, amount }))
            .sort((a, b) => b.amount - a.amount),
          budgets: (budgetRes.data || []).map((b: any) => ({
            month: b.month,
            label: b.label,
            amount: b.amount,
            currency: b.currency,
          })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: hr_summary — Nhân sự
    // ════════════════════════════════════════════════════════════
    if (action === "hr_summary") {
      const [empRes, deptRes, contractRes, leaveRes] = await Promise.all([
        supabase.from("hr_employees").select("id, full_name, email, status, position, department_id, join_date, employee_code"),
        supabase.from("hr_departments").select("id, name"),
        supabase.from("hr_contracts").select("id, employee_id, type, status, start_date, end_date, base_salary"),
        supabase.from("att_requests").select("id, employee_id, status, leave_type, date_from, date_to").eq("request_type", "leave").eq("status", "pending"),
      ]);

      const employees = empRes.data || [];
      const depts = deptRes.data || [];
      const contracts = contractRes.data || [];
      const deptMap: Record<string, string> = {};
      for (const d of depts) deptMap[d.id] = d.name;

      const active = employees.filter((e: any) => e.status === "active");
      const byDept: Record<string, number> = {};
      for (const emp of active) {
        const dname = deptMap[emp.department_id] || "Khác";
        byDept[dname] = (byDept[dname] || 0) + 1;
      }

      // Contracts expiring soon (within 30 days)
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const expiringSoon = contracts.filter((c: any) => {
        if (c.status !== "active") return false;
        if (!c.end_date) return false;
        const end = new Date(c.end_date);
        return end >= now && end <= in30;
      });

      return json({
        success: true,
        data: {
          total_employees: employees.length,
          active_employees: active.length,
          inactive_employees: employees.length - active.length,
          by_department: Object.entries(byDept).map(([dept, count]) => ({ department: dept, count })),
          contracts_expiring_soon: expiringSoon.length,
          expiring_contracts: expiringSoon.map((c: any) => ({
            employee_id: c.employee_id,
            type: c.type,
            end_date: c.end_date,
            base_salary: c.base_salary,
          })),
          pending_leave_requests: (leaveRes.data || []).length,
          employees_list: active.map((e: any) => ({
            name: e.full_name,
            position: e.position,
            department: deptMap[e.department_id] || "Khác",
            join_date: e.join_date,
          })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: payroll_summary — Bảng lương
    // ════════════════════════════════════════════════════════════
    if (action === "payroll_summary") {
      const year = params.year || new Date().getFullYear();
      const { data: sheets } = await supabase
        .from("pay_payroll_sheets")
        .select("*")
        .eq("year", year)
        .order("month");

      const result = [];
      for (const sheet of sheets || []) {
        const { data: records } = await supabase
          .from("pay_payroll_records")
          .select("net_salary, total_company_cost, base_salary")
          .eq("sheet_id", sheet.id);
        const recs = records || [];
        result.push({
          month: sheet.month,
          title: sheet.title,
          status: sheet.status,
          employee_count: recs.length,
          total_net: recs.reduce((s: number, r: any) => s + (Number(r.net_salary) || 0), 0),
          total_company_cost: recs.reduce((s: number, r: any) => s + (Number(r.total_company_cost) || 0), 0),
          total_base: recs.reduce((s: number, r: any) => s + (Number(r.base_salary) || 0), 0),
        });
      }

      return json({
        success: true,
        data: {
          year,
          sheets: result,
          annual_total_net: result.reduce((s, r) => s + r.total_net, 0),
          annual_total_company_cost: result.reduce((s, r) => s + r.total_company_cost, 0),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: workforce_status — Dự án & nhân lực
    // ════════════════════════════════════════════════════════════
    if (action === "workforce_status") {
      const [wkRes, taskRes, settleRes, paRes] = await Promise.all([
        supabase.from("wf_workers").select("id, name, status, role, hourly_rate, currency"),
        supabase.from("wf_tasks").select("id, title, status, price, currency, exchange_rate, payment_status, worker_id, project_name, deadline"),
        supabase.from("wf_settlements").select("id, status, total_amount, currency, created_at, worker_id").order("created_at", { ascending: false }).limit(20),
        supabase.from("wf_project_acceptances").select("id, project_name, status, total_value, currency, acceptance_date").order("acceptance_date", { ascending: false }).limit(10),
      ]);

      const workers = wkRes.data || [];
      const tasks = taskRes.data || [];
      const settlements = settleRes.data || [];

      // Task stats
      const tasksByStatus: Record<string, number> = {};
      let totalPayable = 0;
      for (const t of tasks) {
        tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
        if (t.payment_status !== "paid") {
          const price = Number(t.price) || 0;
          const rate = Number(t.exchange_rate) || 1;
          totalPayable += t.currency === "USD" ? price * rate : price;
        }
      }

      return json({
        success: true,
        data: {
          workers: { total: workers.length, active: workers.filter((w: any) => w.status === "active").length },
          tasks: { total: tasks.length, by_status: tasksByStatus, total_payable_vnd: totalPayable },
          recent_settlements: settlements.map((s: any) => ({
            status: s.status,
            total_amount: s.total_amount,
            currency: s.currency,
            date: s.created_at,
          })),
          recent_acceptances: (paRes.data || []).map((a: any) => ({
            project: a.project_name,
            status: a.status,
            value: a.total_value,
            currency: a.currency,
            date: a.acceptance_date,
          })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: crm_pipeline — Khách hàng & dự án
    // ════════════════════════════════════════════════════════════
    if (action === "crm_pipeline") {
      const [clientRes, projRes, docRes] = await Promise.all([
        supabase.from("crm_clients").select("id, name, client_type, status, email, contact_person"),
        supabase.from("crm_projects").select("id, name, status, client_id, start_date, end_date, budget, currency"),
        supabase.from("crm_documents").select("id, project_id, type, status"),
      ]);

      const clients = clientRes.data || [];
      const projects = projRes.data || [];
      const docs = docRes.data || [];

      const projsByStatus: Record<string, number> = {};
      for (const p of projects) projsByStatus[p.status || "unknown"] = (projsByStatus[p.status || "unknown"] || 0) + 1;

      return json({
        success: true,
        data: {
          clients: { total: clients.length, active: clients.filter((c: any) => c.status === "active").length },
          projects: { total: projects.length, by_status: projsByStatus },
          documents: { total: docs.length },
          top_clients: clients.slice(0, 10).map((c: any) => ({
            name: c.name,
            type: c.client_type,
            status: c.status,
            contact: c.contact_person,
          })),
          active_projects: projects
            .filter((p: any) => p.status === "active" || p.status === "in_progress")
            .map((p: any) => ({
              name: p.name,
              status: p.status,
              budget: p.budget,
              currency: p.currency,
              start: p.start_date,
              end: p.end_date,
            })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: outreach_stats — Email outreach
    // ════════════════════════════════════════════════════════════
    if (action === "outreach_stats") {
      const [leadRes, emailRes, batchRes] = await Promise.all([
        supabase.from("crm_outreach_leads").select("id, studio_name, status, tier, email_status"),
        supabase.from("crm_email_log").select("id, status, sent_at, template_type"),
        supabase.from("crm_outreach_batch_log").select("*").order("started_at", { ascending: false }).limit(10),
      ]);

      const leads = leadRes.data || [];
      const emails = emailRes.data || [];

      const leadsByStatus: Record<string, number> = {};
      const leadsByTier: Record<string, number> = {};
      for (const l of leads) {
        leadsByStatus[l.status || "new"] = (leadsByStatus[l.status || "new"] || 0) + 1;
        leadsByTier[l.tier || "unknown"] = (leadsByTier[l.tier || "unknown"] || 0) + 1;
      }

      const emailsByStatus: Record<string, number> = {};
      for (const e of emails) emailsByStatus[e.status || "unknown"] = (emailsByStatus[e.status || "unknown"] || 0) + 1;

      return json({
        success: true,
        data: {
          leads: { total: leads.length, by_status: leadsByStatus, by_tier: leadsByTier },
          emails: { total: emails.length, by_status: emailsByStatus },
          recent_batches: (batchRes.data || []).map((b: any) => ({
            started: b.started_at,
            sent: b.emails_sent,
            failed: b.emails_failed,
            status: b.status,
          })),
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: attendance_report — Chấm công
    // ════════════════════════════════════════════════════════════
    if (action === "attendance_report") {
      const month = params.month || new Date().getMonth() + 1;
      const year = params.year || new Date().getFullYear();

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [attRes, leaveRes, empRes] = await Promise.all([
        supabase.from("att_records").select("*").gte("date", startDate).lt("date", endDate),
        supabase.from("att_requests").select("*").eq("request_type", "leave").gte("date_from", startDate).lt("date_from", endDate),
        supabase.from("hr_employees").select("id, full_name, status").eq("status", "active"),
      ]);

      const records = attRes.data || [];
      const leaves = leaveRes.data || [];

      return json({
        success: true,
        data: {
          month,
          year,
          total_records: records.length,
          total_employees: (empRes.data || []).length,
          leave_requests: {
            total: leaves.length,
            pending: leaves.filter((l: any) => l.status === "pending").length,
            approved: leaves.filter((l: any) => l.status === "approved").length,
            rejected: leaves.filter((l: any) => l.status === "rejected").length,
          },
        },
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: monthly_kpi — KPI dashboard
    // ════════════════════════════════════════════════════════════
    if (action === "monthly_kpi") {
      const month = params.month || new Date().getMonth() + 1;
      const year = params.year || new Date().getFullYear();

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [invRes, expRes, taskRes, empRes] = await Promise.all([
        supabase.from("invoice_invoices").select("status, amount_received, items, paid_date, issue_date, created_at"),
        supabase.from("expense_expenses").select("amount, type, expense_date").gte("expense_date", startDate).lt("expense_date", endDate),
        supabase.from("wf_tasks").select("status, price, currency, exchange_rate, created_at"),
        supabase.from("hr_employees").select("id, status").eq("status", "active"),
      ]);

      // Revenue this month (paid invoices)
      const invoices = (invRes.data || []).filter((inv: any) => {
        const d = new Date(inv.paid_date || inv.issue_date || inv.created_at);
        return d.getMonth() + 1 === month && d.getFullYear() === year && inv.status === "paid";
      });
      const monthRevenue = invoices.reduce((s: number, inv: any) => {
        return s + (inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items));
      }, 0);

      // Expenses this month
      const expenses = expRes.data || [];
      const monthExpense = expenses.filter((e: any) => e.type !== "revenue").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      // Tasks completed this month
      const monthTasks = (taskRes.data || []).filter((t: any) => {
        const d = new Date(t.created_at);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      return json({
        success: true,
        data: {
          month,
          year,
          revenue: monthRevenue,
          expense: monthExpense,
          profit_loss: monthRevenue - monthExpense,
          burn_rate: monthExpense,
          headcount: (empRes.data || []).length,
          tasks_created: monthTasks.length,
          tasks_completed: monthTasks.filter((t: any) => t.status === "completed" || t.status === "approved").length,
          revenue_per_employee: (empRes.data || []).length > 0 ? Math.round(monthRevenue / (empRes.data || []).length) : 0,
        },
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    return json({ success: false, error: err.message }, 500);
  }
});
