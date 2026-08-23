import React, { useState, useEffect } from 'react';
import { MonthlyFinancialSummary, getDashboardData, getDashboardDataRange, saveKpiSettings } from '../services/dashboardService';

interface FinancialDashboardProps {
  vcbAvgRate: number;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ vcbAvgRate }) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  // Tháng bắt đầu của khoảng xem (YYYY-MM). Rỗng/sau tháng Đến ⇒ chỉ xem 1 tháng.
  const [from, setFrom] = useState<string>('');
  const exchangeRate = vcbAvgRate;
  const [data, setData] = useState<MonthlyFinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<'all' | 'company' | 'personal'>('all');
  // Drill-down chi tiết task per nhân viên
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  // KPI config editor (chỉ tham khảo, không đẩy vào payroll)
  const [editKpi, setEditKpi] = useState(false);
  // Bảng hiệu suất: xem số thực tế (đã nghiệm thu + lương chốt) hay số dự kiến
  const [showProj, setShowProj] = useState(false);
  const [multInput, setMultInput] = useState('3');
  const [pctInput, setPctInput] = useState('20');

  const saveKpi = async () => {
    try {
      await saveKpiSettings(null, Number(multInput) || 3, Number(pctInput) || 20);
      setEditKpi(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Không lưu được cấu hình KPI');
    }
  };

  useEffect(() => {
    loadData();
  }, [month, year, from, vcbAvgRate, accountFilter]);

  /** Mọi tháng trong khoảng Từ → Đến (bao gồm 2 đầu). Từ > Đến ⇒ chỉ lấy tháng Đến. */
  const monthsInRange = () => {
    const [fy, fm] = from.split('-').map(Number);
    const list: { month: number; year: number }[] = [];
    if (!fy || !fm || fy * 12 + fm > year * 12 + month) return [{ month, year }];
    for (let k = fy * 12 + fm; k <= year * 12 + month; k++) {
      list.push({ month: ((k - 1) % 12) + 1, year: Math.floor((k - 1) / 12) });
    }
    return list;
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = monthsInRange();
      const result = range.length > 1
        ? await getDashboardDataRange(range, exchangeRate, accountFilter)
        : await getDashboardData(month, year, exchangeRate, accountFilter);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter" style={{ color: '#E5A023' }}>
            Tổng Quan Tài Chính
          </h2>
          <p className="text-neutral-medium text-sm mt-1">Báo cáo doanh thu, chi phí và hiệu suất nhân sự</p>
        </div>
        <div className="flex items-center gap-3 bg-surface border border-primary/10 rounded-xl p-2">
          <div className="flex items-center bg-white/5 border border-primary/10 rounded-lg px-2 py-1 text-xs mr-2">
            <span className="text-neutral-medium mr-1 font-bold">1 USD =</span>
            <span className="text-white font-bold">{exchangeRate.toLocaleString()}</span>
            <span className="text-neutral-medium ml-1">VND</span>
          </div>

          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-transparent text-white font-bold px-2 py-1 focus:outline-none cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m} className="bg-surface text-white">Tháng {m}</option>
            ))}
          </select>
          <span className="text-neutral-medium">/</span>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-white font-bold px-2 py-1 focus:outline-none cursor-pointer"
          >
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y} className="bg-surface text-white">{y}</option>
            ))}
          </select>
          {/* Gộp khoảng: để trống = chỉ xem tháng đã chọn ở trên (tháng KẾT THÚC của khoảng) */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Từ</span>
            <input
              type="month"
              value={from}
              max={`${year}-${String(month).padStart(2, '0')}`}
              onChange={(e) => setFrom(e.target.value)}
              title="Gộp từ tháng này đến tháng đã chọn. Bỏ trống = chỉ xem 1 tháng."
              className="bg-transparent text-white font-bold px-1 py-1 text-sm focus:outline-none cursor-pointer [color-scheme:dark]"
            />
            {from && (
              <button onClick={() => setFrom('')} title="Bỏ gộp, xem 1 tháng"
                className="text-neutral-medium hover:text-white px-1 font-black">×</button>
            )}
          </div>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4 text-neutral-medium hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Account Type Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mr-2">Tài khoản:</span>
        {[
          { key: 'all' as const, label: '📊 Tất cả', color: 'border-primary/40 bg-primary/10 text-primary' },
          { key: 'company' as const, label: '🏢 Công ty', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
          { key: 'personal' as const, label: '👤 Cá nhân', color: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setAccountFilter(opt.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              accountFilter === opt.key
                ? opt.color
                : 'border-primary/10 text-neutral-medium hover:border-primary/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-bold mb-2">Đã có lỗi xảy ra</p>
          <p className="text-neutral-medium text-sm">{error}</p>
        </div>
      ) : data ? (
        <div className="animate-fadeInUp space-y-6">
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-primary/10 bg-surface relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-1">Doanh Thu</p>
              <p className="text-3xl font-black text-emerald-400">{formatVND(data.revenueVND)}</p>
              <p className="text-xs text-neutral-medium mt-1">≈ {formatUSD(data.totalRevenue)}</p>
              <p className="text-[11px] text-emerald-400/60 mt-2 border-t border-white/5 pt-2">
                Dự kiến: <span className="font-black">{formatVND(data.projected.revenueVND)}</span>
                <span className="text-neutral-medium"> · {data.projected.taskCount} task xong chưa nghiệm thu</span>
              </p>
              {data.projected.tasksWithoutPrice > 0 && (
                <p className="text-[11px] text-amber-400/80 mt-1">⚠️ {data.projected.tasksWithoutPrice} task chưa nhập giá khách</p>
              )}
            </div>
            
            <div className="p-5 rounded-2xl border border-primary/10 bg-surface relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-1">Chi Phí</p>
              <p className="text-3xl font-black text-red-400">{formatVND(data.totalCost)}</p>
              <p className="text-[11px] text-red-400/60 mt-2 border-t border-white/5 pt-2">
                Dự kiến: <span className="font-black">{formatVND(data.projected.totalCost)}</span>
                <span className="text-neutral-medium"> · lương {data.projected.payrollSource === 'sheet-thang-nay' ? 'bảng lương tháng này' : data.projected.payrollSource === 'uoc-tinh-nhap' ? 'tính nháp theo hợp đồng (đủ công)' : data.projected.payrollSource === 'sheet-thang-truoc' ? 'ước theo tháng trước' : 'chưa có dữ liệu'}</span>
              </p>
            </div>
            
            <div className="p-5 rounded-2xl border border-primary/10 bg-surface relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-1">Lợi Nhuận</p>
              <p className={`text-3xl font-black ${data.grossProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatVND(data.grossProfit)}
              </p>
              <p className={`text-[11px] mt-2 border-t border-white/5 pt-2 ${data.projected.grossProfit >= 0 ? 'text-blue-400/60' : 'text-red-400/60'}`}>
                Dự kiến: <span className="font-black">{formatVND(data.projected.grossProfit)}</span>
              </p>
            </div>
            
            <div className="p-5 rounded-2xl border border-primary/10 bg-surface relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-1">ROI</p>
              <p className={`text-3xl font-black ${data.profitMargin >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                {data.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-neutral-medium mt-1">
                {data.profitMargin >= 0 ? 'Profitable' : 'Loss'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cost Breakdown */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-6 rounded-2xl border border-primary/10 bg-surface">
                <h3 className="text-lg font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Cơ Cấu Chi Phí
                </h3>
                
                <div className="space-y-4">
                  {[
                    { label: 'Fulltime Payroll', hint: 'Lương & bảo hiểm (gross)', actual: data.fulltimePayroll, proj: data.projected.fulltimeCost },
                    { label: 'Freelancer Payments', hint: 'Thanh toán nghiệm thu', actual: data.freelancerPayments, proj: data.projected.freelancerCost },
                    { label: 'Operational Expenses', hint: 'Chi phí vận hành khác', actual: data.operationalExpenses, proj: data.operationalExpenses },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-end border-b border-white/5 pb-3">
                      <div>
                        <p className="text-sm font-bold text-white">{row.label}</p>
                        <p className="text-[10px] text-neutral-medium mt-0.5">{row.hint}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold">{formatVND(row.actual)}</p>
                        <p className="text-[10px] font-mono text-neutral-medium mt-0.5">DK: {formatVND(row.proj)}</p>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs font-black uppercase text-neutral-medium">Tổng Chi Phí</p>
                    <div className="text-right">
                      <p className="text-lg font-black text-red-400">{formatVND(data.totalCost)}</p>
                      <p className="text-[10px] font-mono text-red-400/60">DK: {formatVND(data.projected.totalCost)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fulltime Performance */}
            <div className="lg:col-span-2">
              <div className="p-6 rounded-2xl border border-primary/10 bg-surface h-full">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h3 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Hiệu Suất Nhân Sự Fulltime
                  </h3>
                  <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px] font-black uppercase tracking-wider">
                    {[
                      { key: false, label: 'Thực tế', hint: 'Phiếu nghiệm thu đã chốt + bảng lương tháng này' },
                      { key: true, label: 'Dự kiến', hint: 'Task đã xong chưa nghiệm thu + lương nháp tính theo hợp đồng (giả định đủ công), tự thay bằng số thật khi chốt bảng lương' },
                    ].map(o => (
                      <button
                        key={String(o.key)}
                        onClick={() => setShowProj(o.key)}
                        title={o.hint}
                        className={`px-3 py-1.5 transition-colors ${showProj === o.key ? 'bg-primary text-black' : 'text-neutral-medium hover:text-white'}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {editKpi ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-neutral-medium font-bold">Target ×</span>
                      <input type="number" step="0.1" min="0" value={multInput} onChange={e => setMultInput(e.target.value)}
                        className="w-16 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-white font-bold focus:outline-none focus:border-primary/50" />
                      <span className="text-neutral-medium font-bold">lương · Thưởng</span>
                      <input type="number" step="1" min="0" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)}
                        className="w-14 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-white font-bold focus:outline-none focus:border-primary/50" />
                      <span className="text-neutral-medium font-bold">% dư</span>
                      <button onClick={saveKpi} className="px-2.5 py-1 rounded-lg bg-primary text-black text-[10px] font-black uppercase hover:opacity-90">Lưu</button>
                      <button onClick={() => setEditKpi(false)} className="px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-black uppercase text-neutral-medium hover:text-white">Hủy</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setMultInput(String(data.kpiSettings.multiplier)); setPctInput(String(data.kpiSettings.bonusPercent)); setEditKpi(true); }}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-wider text-neutral-medium hover:text-white hover:border-primary/30 transition-colors"
                      title="Chỉnh mục tiêu KPI (chỉ tham khảo, không ảnh hưởng bảng lương)"
                    >
                      Target ×{data.kpiSettings.multiplier} lương · Thưởng {data.kpiSettings.bonusPercent}% dư ✎
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-neutral-medium border-b border-primary/10">
                        <th className="pb-3 font-medium">Nhân sự</th>
                        <th className="pb-3 font-medium text-center">Tasks</th>
                        <th className="pb-3 font-medium text-right">Doanh Thu</th>
                        <th className="pb-3 font-medium text-right">Chi Phí</th>
                        <th className="pb-3 font-medium text-right">Lãi/Lỗ</th>
                        <th className="pb-3 font-medium text-center">% KPI</th>
                        <th className="pb-3 font-medium text-right">Thưởng (tham khảo)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5 text-neutral-light">
                      {data.fulltimeBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-medium text-xs">
                            Không có dữ liệu nhân sự fulltime trong tháng này
                          </td>
                        </tr>
                      ) : (
                        data.fulltimeBreakdown.map(emp => {
                          const revUSD = showProj ? emp.projRevenueUSD : emp.totalTaskRevenue;
                          const cost = showProj ? emp.projCost : emp.totalCompanyCost;
                          const gross = showProj ? emp.projGross : emp.grossActual;
                          const v = {
                            count: showProj ? emp.projTaskCount : emp.totalTaskCount,
                            revVND: revUSD * exchangeRate,
                            cost,
                            pnl: revUSD * exchangeRate - cost,
                            kpiPercent: showProj ? emp.projKpiPercent : emp.kpiPercent,
                            bonus: showProj ? emp.projBonusVND : emp.kpiBonusVND,
                            target: gross * emp.kpiMultiplier,
                            gross,
                            tasks: showProj ? emp.projTasks : emp.tasks,
                          };
                          return (
                          <React.Fragment key={emp.employeeId}>
                          <tr
                            onClick={() => setExpandedEmp(prev => prev === emp.employeeId ? null : emp.employeeId)}
                            className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                            title="Bấm để xem chi tiết task"
                          >
                            <td className="py-3 font-bold text-white">
                              <span className={`inline-block mr-1.5 text-[9px] text-neutral-medium transition-transform ${expandedEmp === emp.employeeId ? 'rotate-90' : ''}`}>▶</span>
                              {emp.fullName}
                            </td>
                            <td className="py-3 text-center">{v.count}</td>
                            <td className="py-3 text-right font-mono text-emerald-400">{formatVND(v.revVND)}</td>
                            <td className="py-3 text-right font-mono text-red-400">{formatVND(v.cost)}</td>
                            <td className="py-3 text-right font-mono">
                              <span className={v.pnl >= 0 ? 'text-blue-400' : 'text-orange-400'}>
                                {v.pnl >= 0 ? '+' : ''}{formatVND(v.pnl)}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              {v.kpiPercent == null ? (
                                <span className="text-[10px] text-neutral-medium" title={showProj ? 'Chưa có bảng lương nào để ước target' : 'Chưa tạo bảng lương tháng này (KPI hiện ngay khi bảng lương được tạo, kể cả draft)'}>—</span>
                              ) : (
                                <div className="inline-flex flex-col items-center gap-1 min-w-[72px]" title={`Target: ${formatVND(v.target)} (gross ${formatVND(v.gross)} × ${emp.kpiMultiplier})`}>
                                  <span className={`text-xs font-black ${v.kpiPercent >= 100 ? 'text-emerald-400' : v.kpiPercent >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {v.kpiPercent.toFixed(0)}%
                                  </span>
                                  <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${v.kpiPercent >= 100 ? 'bg-emerald-400' : v.kpiPercent >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                                      style={{ width: `${Math.min(100, v.kpiPercent)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 text-right font-mono">
                              {v.bonus > 0 ? (
                                <span className="text-emerald-400 font-bold" title={`(Doanh thu − Target) × ${emp.kpiBonusPercent}% — nhập tay vào bảng lương nếu duyệt`}>
                                  {formatVND(v.bonus)}
                                </span>
                              ) : (
                                <span className="text-neutral-medium">—</span>
                              )}
                            </td>
                          </tr>
                          {expandedEmp === emp.employeeId && (
                            <tr>
                              <td colSpan={7} className="py-3 px-4 bg-white/[0.02]">
                                {v.tasks.length === 0 ? (
                                  <p className="text-xs text-neutral-medium">{showProj ? 'Chưa có task xong chờ nghiệm thu' : 'Chưa có task nghiệm thu trong tháng này'}</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-xs">
                                      <thead>
                                        <tr className="text-[9px] font-black uppercase tracking-widest text-neutral-600 border-b border-white/5">
                                          <th className="pb-2 text-left font-medium">Task</th>
                                          <th className="pb-2 text-left font-medium">Dự án</th>
                                          <th className="pb-2 text-left font-medium">Khách hàng</th>
                                          <th className="pb-2 text-right font-medium">Số tiền</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5">
                                        {v.tasks.map((t, i) => (
                                          <tr key={i}>
                                            <td className="py-1.5 pr-3 text-white">{t.title}</td>
                                            <td className="py-1.5 pr-3 text-neutral-light">{t.project || '—'}</td>
                                            <td className="py-1.5 pr-3 text-neutral-light">{t.client || '—'}</td>
                                            <td className="py-1.5 text-right font-mono">
                                              <span className="text-emerald-400 font-bold">{formatUSD(t.priceUSD)}</span>
                                              <span className="text-neutral-medium ml-2">≈ {formatVND(t.priceUSD * exchangeRate)}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          {/* Freelancer Payments Table */}
          <div className="p-6 rounded-2xl border border-primary/10 bg-surface">
             <h3 className="text-lg font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Thanh Toán Freelancer (Nghiệm thu)
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-neutral-medium border-b border-primary/10">
                      <th className="pb-3 font-medium">Freelancer</th>
                      <th className="pb-3 font-medium text-center">Tasks</th>
                      <th className="pb-3 font-medium text-right">Tổng Tiền</th>
                      <th className="pb-3 font-medium text-right">Bonus</th>
                      <th className="pb-3 font-medium text-right">Thuế</th>
                      <th className="pb-3 font-medium text-right">Thực Nhận</th>
                      <th className="pb-3 font-medium text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5 text-neutral-light">
                    {data.freelancerBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-medium text-xs">
                          Không có phiếu nghiệm thu freelancer trong tháng này
                        </td>
                      </tr>
                    ) : (
                      data.freelancerBreakdown.map((f, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 font-bold text-white">{f.workerName}</td>
                          <td className="py-3 text-center">{f.taskCount}</td>
                          <td className="py-3 text-right font-mono">{formatVND(f.currency === 'USD' ? f.totalAmount * exchangeRate : f.totalAmount)}</td>
                          <td className="py-3 text-right font-mono">
                            {f.bonusAmount > 0 ? (
                              <span className="text-yellow-400">+{formatVND(f.currency === 'USD' ? f.bonusAmount * exchangeRate : f.bonusAmount)}</span>
                            ) : (
                              <span className="text-neutral-medium">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-mono text-orange-400">{formatVND(f.currency === 'USD' ? f.taxAmount * exchangeRate : f.taxAmount)}</td>
                          <td className="py-3 text-right font-mono font-bold text-blue-400">{formatVND(f.netAmount)}</td>
                          <td className="py-3 text-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                              f.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                              f.paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-neutral-500/20 text-neutral-400'
                            }`}>
                              {f.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
          </div>
          
        </div>
      ) : null}
    </div>
  );
};
