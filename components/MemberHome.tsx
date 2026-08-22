// components/MemberHome.tsx
// Màn hình chủ cho nhân viên thường (chỉ có Portal + Company Hub).
// ponytail: không dựng lại 5 màn con — mọi ô ở đây chỉ đổi hash sang tab đã chạy thật.
import React, { useEffect, useState } from 'react';
import { AccountUser, AttRecord, AttRequest, HrChangeRequest } from '@/types';
import CheckinWidget from '@/apps/portal/components/CheckinWidget';
import { ToastNotification } from '@/components/ToastNotification';
import MemberTabBar, { MEMBER_TABBAR_PAD } from '@/components/MemberTabBar';
import { fetchMyRecordsByRange } from '@/apps/attendance/services/attendanceService';
import { fetchYearlyBalance, getAvailableLeaveDays, fetchMyLeaveRequests } from '@/apps/portal/services/leaveService';
import { fetchMyChangeRequests, fetchMyProfile } from '@/apps/portal/services/portalService';

interface Props {
  currentUser: AccountUser;
  onLogout: () => void;
}

/** Đổi hash để App.tsx mở đúng app + tab (hashchange listener bắt được). */
const go = (target: string) => { window.location.hash = target; };

function greeting(h: number): string {
  if (h < 11) return 'Chào buổi sáng,';
  if (h < 14) return 'Chào buổi trưa,';
  if (h < 18) return 'Chào buổi chiều,';
  return 'Chào buổi tối,';
}

const MemberHome: React.FC<Props> = ({ currentUser, onLogout }) => {
  const empId = currentUser.employee_id;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string; position?: string } | null>(null);
  const [daily, setDaily] = useState<AttRecord[]>([]);
  const [leaveLeft, setLeaveLeft] = useState<number | null>(null);
  const [pendingLeave, setPendingLeave] = useState<AttRequest[]>([]);
  const [pendingReq, setPendingReq] = useState<HrChangeRequest[]>([]);

  useEffect(() => {
    if (!empId) return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Không dùng toISOString() — GMT+7 lùi 1 ngày, mất ngày cuối tháng.
    const to = `${ym}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    fetchMyProfile(empId).then(setProfile).catch(() => {});
    fetchMyRecordsByRange(empId, `${ym}-01`, to).then(setDaily).catch(() => {});
    fetchYearlyBalance(empId, now.getFullYear())
      .then(b => setLeaveLeft(getAvailableLeaveDays(b).available))
      .catch(() => {});
    fetchMyLeaveRequests(empId)
      .then(rs => setPendingLeave(rs.filter(r => r.status === 'pending')))
      .catch(() => {});
    fetchMyChangeRequests(empId)
      .then(rs => setPendingReq(rs.filter(r => r.status === 'pending')))
      .catch(() => {});
  }, [empId]);

  const name = profile?.full_name || currentUser.username;
  const initials = name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const workDays = daily.filter(r => r.check_in).length;
  const lateDays = daily.filter(r => r.status === 'late').length;
  const todo = pendingLeave.length + pendingReq.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0F0F' }}>
      {toast && (
        <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />
      )}

      <MemberTabBar currentUser={currentUser} />
      {/* max-w-md vừa điện thoại; desktop nới ra kẻo thành cột hẹp giữa màn hình trống hoác. */}
      <div className={`max-w-md sm:max-w-2xl mx-auto px-5 pt-6 sm:pt-10 pb-16 ${MEMBER_TABBAR_PAD}`}>
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-500 text-[13px] font-semibold">{greeting(new Date().getHours())}</p>
            <h1 className="text-white text-[26px] font-black leading-tight mt-0.5">{name}</h1>
            {profile?.position && (
              <p className="text-neutral-600 text-[11px] font-black uppercase tracking-wider mt-1">{profile.position}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go('portal/edit')}
              title="Hồ sơ của tôi"
              className="w-12 h-12 rounded-full flex items-center justify-center text-black font-black text-lg"
              style={{ background: 'linear-gradient(135deg,#FF9500 0%,#E86800 100%)' }}
            >
              {initials}
            </button>
            <button onClick={onLogout} title="Đăng xuất" className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Check-in (dùng lại widget của Portal, kèm GPS) ── */}
        {empId && <CheckinWidget employeeId={empId} onToast={(message, type) => setToast({ message, type })} />}

        {/* ── KPI ── */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <button onClick={() => go('portal/tasks')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left">
            <p className="text-neutral-600 text-[9px] font-black uppercase tracking-wider">Công tháng</p>
            <p className="text-white text-[22px] font-black mt-1.5 leading-none">{workDays}</p>
          </button>
          <button onClick={() => go('portal/recurring')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left">
            <p className="text-neutral-600 text-[9px] font-black uppercase tracking-wider">Phép còn</p>
            <p className="text-[#4CAF50] text-[22px] font-black mt-1.5 leading-none">{leaveLeft ?? '—'}</p>
          </button>
          <button onClick={() => go('portal/tasks')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left">
            <p className="text-neutral-600 text-[9px] font-black uppercase tracking-wider">Đi muộn</p>
            <p className={`text-[22px] font-black mt-1.5 leading-none ${lateDays ? 'text-[#FFA726]' : 'text-white'}`}>{lateDays}</p>
          </button>
        </div>

        {/* ── Thao tác nhanh ── */}
        <p className="mt-7 mb-3 text-neutral-600 text-[10px] font-black uppercase tracking-widest">Thao tác nhanh</p>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: '🌴', label: 'Xin nghỉ',    to: 'portal/recurring' },
            { icon: '📝', label: 'Đề xuất',     to: 'portal/proposals' },
            { icon: '💵', label: 'Phiếu lương', to: 'portal/activity' },
            { icon: '👥', label: 'Danh bạ',     to: 'handbook/activity' },
          ].map(a => (
            <button key={a.label} onClick={() => go(a.to)} className="flex flex-col items-center gap-2">
              <div className="w-full aspect-square rounded-2xl bg-surface border border-white/[.08] flex items-center justify-center text-[22px]">{a.icon}</div>
              <span className="text-neutral-400 text-[10px] font-bold text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>

        {/* ── Cần bạn xử lý ── */}
        <p className="mt-7 mb-3 text-neutral-600 text-[10px] font-black uppercase tracking-widest">
          Đang chờ duyệt {todo > 0 && <span className="text-primary">· {todo}</span>}
        </p>
        {todo === 0 ? (
          <div className="bg-surface border border-white/[.08] rounded-2xl p-5 text-center">
            <p className="text-neutral-600 text-[13px] font-semibold">Không có đơn nào đang chờ</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingLeave.map(r => (
              <button key={r.id} onClick={() => go('portal/recurring')} className="w-full bg-surface border border-white/[.08] rounded-2xl p-4 flex items-center gap-3 text-left">
                <span className="text-[20px]">🌴</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">Đơn nghỉ {r.date_from}{r.date_to !== r.date_from ? ` → ${r.date_to}` : ''}</p>
                  <p className="text-neutral-600 text-[11px] font-semibold truncate">{r.reason || '—'}</p>
                </div>
                <span className="text-[10px] font-black uppercase text-[#FFA726]">Chờ duyệt</span>
              </button>
            ))}
            {pendingReq.map(r => (
              <button key={r.id} onClick={() => go('portal/proposals')} className="w-full bg-surface border border-white/[.08] rounded-2xl p-4 flex items-center gap-3 text-left">
                <span className="text-[20px]">📝</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">Đề xuất · {r.request_type}</p>
                  <p className="text-neutral-600 text-[11px] font-semibold truncate">{r.reason || '—'}</p>
                </div>
                <span className="text-[10px] font-black uppercase text-[#FFA726]">Chờ duyệt</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 2 app đầy đủ ── */}
        <p className="mt-7 mb-3 text-neutral-600 text-[10px] font-black uppercase tracking-widest">Ứng dụng</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => go('portal')} className="bg-surface border border-white/[.08] rounded-2xl p-4 text-left">
            <span className="text-[22px]">🏠</span>
            <p className="text-white text-[13px] font-black mt-2">Employee Portal</p>
            <p className="text-neutral-600 text-[11px] font-semibold">Lương, công, hồ sơ</p>
          </button>
          <button onClick={() => go('handbook')} className="bg-surface border border-white/[.08] rounded-2xl p-4 text-left">
            <span className="text-[22px]">🏢</span>
            <p className="text-white text-[13px] font-black mt-2">Company Hub</p>
            <p className="text-neutral-600 text-[11px] font-semibold">Nội quy, tài liệu</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberHome;
