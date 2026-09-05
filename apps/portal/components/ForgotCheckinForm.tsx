// apps/portal/components/ForgotCheckinForm.tsx
// Đơn giải trình quên chấm công. Chấm công chặn cứng theo GPS (phải đứng trong bán kính VP),
// nên đây là lối duy nhất để ngày quên bấm vẫn được tính — Admin/HR duyệt ở tab "📝 Đơn từ".
import React, { useEffect, useState } from 'react';
import { submitForgotRequest, fetchMyRecordsByRange, fetchHolidays } from '@/apps/attendance/services/attendanceService';
import { fetchMyLeaveRequests } from '@/apps/portal/services/leaveService';
import { fetchMyProfile } from '@/apps/portal/services/portalService';

interface Props {
  employeeId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

// Ngày hệ thống chấm công bắt đầu áp dụng. Không có mốc này thì mọi nhân viên mở app lên đều
// thấy "15 ngày chưa đủ công" cho những ngày trước khi tính năng tồn tại — báo động sai hàng
// loạt ngay ngày đầu triển khai. Đổi mốc nếu công ty chốt ngày áp dụng khác.
const GO_LIVE = '2026-08-24';

const today = () => new Date().toLocaleDateString('sv-SE'); // sv-SE = YYYY-MM-DD theo giờ máy

const ForgotCheckinForm: React.FC<Props> = ({ employeeId, onToast }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today());
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [reason, setReason] = useState('');
  const [gapDays, setGapDays] = useState<string[]>([]);

  // Dò ngày thiếu công trong tháng. Phải tính cả ngày TRỐNG HOÀN TOÀN (quên bấm cả ngày là ca
  // phổ biến nhất), nên cần loại trừ đủ: cuối tuần, ngày lễ, ngày nghỉ phép đã duyệt, ngày trước
  // khi vào làm, và ngày đã có đơn giải trình đang chờ / đã duyệt (khỏi gửi trùng).
  // Hôm nay không tính vì đang làm dở.
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    Promise.all([
      fetchMyRecordsByRange(employeeId, `${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`),
      fetchHolidays(),
      fetchMyLeaveRequests(employeeId, ['leave', 'forgot']),
      fetchMyProfile(employeeId),
    ])
      .then(([records, holidays, reqs, profile]) => {
        const startDate: string = (profile as { start_date?: string })?.start_date || '';
        // Làm bù (kind='makeup') KHÔNG che ngày: hôm đó vẫn phải chấm công như ngày thường.
        const inKind = (d: string, kind: 'makeup' | 'other') =>
          holidays.some(h => (kind === 'makeup') === (h.kind === 'makeup') && d >= h.date_from && d <= h.date_to);
        const covered = (d: string) =>
          inKind(d, 'other') ||
          reqs.some(r =>
            r.status !== 'rejected' && d >= r.date_from && d <= r.date_to &&
            // Đơn remote vẫn phải chấm công (chỉ miễn GPS) nên không tính là được che.
            (r.request_type === 'forgot' || r.leave_type !== 'remote'));

        const gaps: string[] = [];
        for (let day = 1; day <= last; day++) {
          const d = `${ym}-${String(day).padStart(2, '0')}`;
          if (d >= today()) break;
          if (d < GO_LIVE) continue;
          if (startDate && d < startDate) continue;
          const dow = new Date(`${d}T00:00:00`).getDay();
          if ((dow === 0 || dow === 6) && !inKind(d, 'makeup')) continue;
          if (covered(d)) continue;
          const rec = records.find(r => r.date === d);
          if (rec?.check_in && rec?.check_out) continue;
          gaps.push(d);
        }
        setGapDays(gaps.reverse()); // gần nhất lên đầu
      })
      // Không nuốt im lặng: hỏng cái này thì nút biến mất mà không ai biết vì sao.
      .catch(e => console.error('Không dò được ngày thiếu công:', e));
  }, [employeeId]);

  const inputCls = 'w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm';

  const submit = async () => {
    if (!timeFrom && !timeTo) return onToast('Nhập giờ vào hoặc giờ ra thực tế', 'error');
    if (!reason.trim()) return onToast('Nhập lý do quên chấm công', 'error');
    setSaving(true);
    try {
      await submitForgotRequest(employeeId, date, timeFrom || null, timeTo || null, reason.trim());
      onToast('✅ Đã gửi đơn giải trình, chờ Admin/HR duyệt', 'success');
      setOpen(false);
      setTimeFrom(''); setTimeTo(''); setReason('');
    } catch {
      onToast('Gửi đơn thất bại. Thử lại sau.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasGap = gapDays.length > 0;

  if (!open) {
    // Sạch công thì không có gì để cảnh báo — thu về một dòng chữ mảnh thay vì khối đỏ chiếm chỗ.
    // Vẫn giữ lối vào vì có người cần giải trình ngày của tháng trước, lúc đó tháng này đã sạch.
    if (!hasGap) {
      return (
        <button onClick={() => setOpen(true)} className="mb-6 text-neutral-500 text-[11px] font-semibold underline underline-offset-2 active:text-primary">
          Cần giải trình ngày chấm công cũ?
        </button>
      );
    }

    // Không dùng animate-pulse — nhấp nháy liên tục sẽ thành nhiễu.
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mb-6 rounded-xl border border-[#FF3B30]/40 bg-[#FF3B30]/[.08] px-4 py-3.5 text-left flex items-center gap-3 active:scale-[.97] transition-all"
        style={{ boxShadow: '0 0 18px rgba(255,59,48,.20), inset 0 1px 0 rgba(255,255,255,.06)' }}
      >
        <span
          className="w-10 h-10 shrink-0 rounded-xl bg-[#FF3B30]/15 border border-[#FF3B30]/30 flex items-center justify-center text-[19px]"
          style={{ boxShadow: '0 0 12px rgba(255,59,48,.25)' }}
        >
          🆘
        </span>
        <span className="min-w-0">
          <span className="block text-[#FF6B60] text-[13px] font-black">
            {gapDays.length} ngày chưa đủ công
          </span>
          <span className="block text-neutral-400 text-[11px] font-semibold mt-0.5">
            Gần nhất {gapDays[0]} — gửi giải trình kẻo mất công
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-white/[.08] bg-surface p-4">
      <p className="text-white text-[13px] font-black mb-3">😅 Đơn giải trình quên chấm công</p>

      <label className="block text-neutral-600 text-[10px] font-black uppercase tracking-wider mb-1">Ngày quên chấm</label>
      {/* max=hôm nay: giải trình cho ngày đã qua, không xin trước cho tương lai. */}
      <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className={`${inputCls} mb-3`} />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-neutral-600 text-[10px] font-black uppercase tracking-wider mb-1">Giờ vào thực tế</label>
          <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-neutral-600 text-[10px] font-black uppercase tracking-wider mb-1">Giờ ra thực tế</label>
          <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className={inputCls} />
        </div>
      </div>
      <p className="text-neutral-600 text-[10px] font-semibold mb-3">
        Chỉ quên một chiều thì bỏ trống chiều còn lại — giờ đã chấm thật sẽ được giữ nguyên.
      </p>

      <label className="block text-neutral-600 text-[10px] font-black uppercase tracking-wider mb-1">Lý do</label>
      <textarea
        value={reason} onChange={e => setReason(e.target.value)} rows={2}
        placeholder="VD: Hết pin điện thoại lúc tan làm"
        className={`${inputCls} mb-4 resize-none`}
      />

      <div className="flex gap-2">
        <button
          onClick={submit} disabled={saving}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-black text-[13px] font-black disabled:opacity-50 active:scale-[.97] transition-all"
        >
          {saving ? 'Đang gửi...' : 'Gửi đơn'}
        </button>
        <button
          onClick={() => setOpen(false)} disabled={saving}
          className="rounded-lg border border-white/10 px-4 py-2.5 text-neutral-400 text-[13px] font-black active:scale-[.97] transition-all"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
};

export default ForgotCheckinForm;
