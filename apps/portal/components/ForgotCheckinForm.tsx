// apps/portal/components/ForgotCheckinForm.tsx
// Đơn giải trình quên chấm công. Chấm công chặn cứng theo GPS (phải đứng trong bán kính VP),
// nên đây là lối duy nhất để ngày quên bấm vẫn được tính — Admin/HR duyệt ở tab "📝 Đơn từ".
import React, { useEffect, useState } from 'react';
import { submitForgotRequest, fetchMyRecordsByRange } from '@/apps/attendance/services/attendanceService';

interface Props {
  employeeId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const today = () => new Date().toLocaleDateString('sv-SE'); // sv-SE = YYYY-MM-DD theo giờ máy

const ForgotCheckinForm: React.FC<Props> = ({ employeeId, onToast }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today());
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [reason, setReason] = useState('');
  const [gapDays, setGapDays] = useState<string[]>([]);

  // Đỏ chỉ bật khi THẬT SỰ có ngày thiếu công, không thì nó là báo động giả và người ta quen mắt.
  // Chỉ đếm ngày đã có check-in mà thiếu check-out: ngày trống hoàn toàn thì mơ hồ (nghỉ phép,
  // ngày lễ, mới vào làm) — báo bừa còn tệ hơn không báo. Hôm nay không tính vì đang làm dở.
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    fetchMyRecordsByRange(employeeId, `${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`)
      .then(rs => setGapDays(
        rs.filter(r => r.date < today() && r.check_in && !r.check_out).map(r => r.date),
      ))
      // Không nuốt im lặng: hỏng cái này thì nút mất tông cảnh báo mà không ai biết vì sao.
      .catch(e => console.error('Không đọc được bảng công để dò ngày thiếu giờ ra:', e));
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
    // Không dùng animate-pulse — nút luôn hiện, nhấp nháy cả ngày sẽ thành nhiễu.
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full mb-6 rounded-xl border px-4 py-3.5 text-left flex items-center gap-3 active:scale-[.97] transition-all ${
          hasGap ? 'border-[#FF3B30]/40 bg-[#FF3B30]/[.08]' : 'border-white/10 bg-white/[.03]'
        }`}
        style={hasGap ? { boxShadow: '0 0 18px rgba(255,59,48,.20), inset 0 1px 0 rgba(255,255,255,.06)' } : undefined}
      >
        <span
          className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center text-[19px] ${
            hasGap ? 'bg-[#FF3B30]/15 border-[#FF3B30]/30' : 'bg-white/[.04] border-white/10'
          }`}
          style={hasGap ? { boxShadow: '0 0 12px rgba(255,59,48,.25)' } : undefined}
        >
          🆘
        </span>
        <span className="min-w-0">
          <span className={`block text-[13px] font-black ${hasGap ? 'text-[#FF6B60]' : 'text-white'}`}>
            {hasGap ? `${gapDays.length} ngày thiếu giờ ra` : 'Quên chấm công?'}
          </span>
          <span className="block text-neutral-400 text-[11px] font-semibold mt-0.5">
            {hasGap
              ? `Gần nhất ${gapDays[0]} — gửi giải trình kẻo mất công`
              : 'Gửi đơn giải trình để Admin/HR duyệt tính công'}
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
