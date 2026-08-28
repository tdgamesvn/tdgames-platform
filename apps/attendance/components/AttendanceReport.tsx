import React, { useState, useEffect } from 'react';
import { HrEmployee, AttShift, AttRecord } from '@/types';
import { fetchRecordsByRange } from '../services/attendanceService';

interface Props {
  employees: HrEmployee[];
  shifts: AttShift[];
}

type Period = 'week' | 'month';

const AttendanceReport: React.FC<Props> = ({ employees, shifts }) => {
  const [period, setPeriod] = useState<Period>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateRange = () => {
    if (period === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { from, to } = getDateRange();
        const data = await fetchRecordsByRange(from, to);
        setRecords(data);
      } catch {}
      finally { setIsLoading(false); }
    };
    load();
  }, [period, selectedMonth]);

  const cardCls = 'rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl';

  // Aggregate by employee
  const empStats = employees.filter(e => e.status === 'active').map(emp => {
    const empRecords = records.filter(r => r.employee_id === emp.id);
    const totalDays = empRecords.length;
    const presentDays = empRecords.filter(r => r.status === 'present').length;
    const lateDays = empRecords.filter(r => r.status === 'late').length;
    const totalLateMinutes = empRecords.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
    const totalEarlyMinutes = empRecords.reduce((sum, r) => sum + (r.early_minutes || 0), 0);
    const totalOTMinutes = empRecords.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0);
    const totalWorkHours = empRecords.reduce((sum, r) => {
      if (!r.check_in || !r.check_out) return sum;
      return sum + (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
    }, 0);
    return { emp, totalDays, presentDays, lateDays, totalLateMinutes, totalEarlyMinutes, totalOTMinutes, totalWorkHours };
  });

  // Summary
  const totalRecords = records.length;
  const totalLate = records.filter(r => r.status === 'late').length;
  const totalOTHours = Math.round(records.reduce((s, r) => s + (r.overtime_minutes || 0), 0) / 60 * 10) / 10;
  const avgWorkHours = empStats.length > 0
    ? Math.round(empStats.reduce((s, e) => s + e.totalWorkHours, 0) / empStats.length * 10) / 10
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent uppercase tracking-tight">
            📈 Báo cáo
          </h1>
          <p className="text-neutral-medium text-sm mt-1">Tổng hợp chấm công theo kỳ</p>
        </div>
        <div className="flex gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)}
            className="px-4 py-2 rounded-xl bg-surface border border-primary/10 text-white text-sm">
            <option value="week">Tuần này</option>
            <option value="month">Theo tháng</option>
          </select>
          {period === 'month' && (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="px-4 py-2 rounded-xl bg-surface border border-primary/10 text-white text-sm" />
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng bản ghi', value: totalRecords, icon: '📋', color: '#0A84FF' },
          { label: 'Đi muộn', value: totalLate, icon: '⏰', color: '#FF9500' },
          { label: 'Tổng OT', value: `${totalOTHours}h`, icon: '💪', color: '#AF52DE' },
          { label: 'TB giờ/NV', value: `${avgWorkHours}h`, icon: '📊', color: '#34C759' },
        ].map(s => (
          <div key={s.label} className={cardCls + ' text-center'}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-neutral-medium mt-1 uppercase tracking-wide font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Employee breakdown */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">👥 Chi tiết theo nhân viên</h3>
        {isLoading ? (
          <div className="text-center py-8 opacity-40">Đang tải...</div>
        ) : empStats.length === 0 ? (
          <div className="text-center py-8 opacity-40">Không có dữ liệu</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-neutral-medium text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-2">Nhân viên</th>
                  <th className="text-center py-3 px-2">Ngày công</th>
                  <th className="text-center py-3 px-2">Đúng giờ</th>
                  <th className="text-center py-3 px-2">Đi muộn</th>
                  <th className="text-center py-3 px-2">Muộn (phút)</th>
                  <th className="text-center py-3 px-2">Về sớm (phút)</th>
                  <th className="text-center py-3 px-2">OT (phút)</th>
                  <th className="text-center py-3 px-2">Tổng giờ</th>
                </tr>
              </thead>
              <tbody>
                {empStats.map(({ emp, totalDays, presentDays, lateDays, totalLateMinutes, totalEarlyMinutes, totalOTMinutes, totalWorkHours }) => (
                  <tr key={emp.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-3 px-2">
                      <div className="text-white font-semibold">{emp.full_name}</div>
                      <div className="text-[10px] text-neutral-medium">{emp.employee_code}</div>
                    </td>
                    <td className="py-3 px-2 text-center text-white font-bold">{totalDays}</td>
                    <td className="py-3 px-2 text-center text-green-400 font-bold">{presentDays}</td>
                    <td className="py-3 px-2 text-center text-orange-400 font-bold">{lateDays}</td>
                    <td className="py-3 px-2 text-center text-orange-400">{totalLateMinutes > 0 ? `${totalLateMinutes}p` : '—'}</td>
                    <td className="py-3 px-2 text-center text-red-400">{totalEarlyMinutes > 0 ? `${totalEarlyMinutes}p` : '—'}</td>
                    <td className="py-3 px-2 text-center text-purple-400">{totalOTMinutes > 0 ? `${totalOTMinutes}p` : '—'}</td>
                    <td className="py-3 px-2 text-center text-white font-bold">{Math.round(totalWorkHours * 10) / 10}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
