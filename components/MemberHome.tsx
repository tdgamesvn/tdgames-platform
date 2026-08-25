// components/MemberHome.tsx
// Màn hình chủ cho nhân viên thường (chỉ có Portal + Company Hub).
// ponytail: không dựng lại 5 màn con — mọi ô ở đây chỉ đổi hash sang tab đã chạy thật.
import React, { useEffect, useState } from 'react';
import { AccountUser, AttRecord, AttRequest, HrChangeRequest } from '@/types';
import CheckinWidget from '@/apps/portal/components/CheckinWidget';
import { ToastNotification } from '@/components/ToastNotification';
import MemberTabBar, { MEMBER_TABBAR_PAD } from '@/components/MemberTabBar';
import { NotificationBell } from '@/components/NotificationBell';
import { getMyApps } from '@/config/apps';
import { fetchMyRecordsByRange } from '@/apps/attendance/services/attendanceService';
import { fetchYearlyBalance, getAvailableLeaveDays, fetchMyLeaveRequests } from '@/apps/portal/services/leaveService';
import { fetchMyChangeRequests, fetchMyProfile } from '@/apps/portal/services/portalService';
import { toPublicUrl } from '@/apps/hr/services/hrService';

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
  const [profile, setProfile] = useState<{ full_name?: string; position?: string; avatar_url?: string | null } | null>(null);
  const [daily, setDaily] = useState<AttRecord[]>([]);
  const [leaveLeft, setLeaveLeft] = useState<number | null>(null);
  const [pendingLeave, setPendingLeave] = useState<AttRequest[]>([]);
  const [pendingReq, setPendingReq] = useState<HrChangeRequest[]>([]);
  // ponytail: đếm lượt tải lại thay vì tách hàm fetch riêng — check-in/out xong là mọi số ở đây
  // (công tháng, đơn chờ) đều có thể đổi, tải lại cả cụm rẻ hơn nhớ cái nào phụ thuộc cái nào.
  const [reload, setReload] = useState(0);

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
    fetchMyLeaveRequests(empId, ['leave', 'forgot'])
      .then(rs => setPendingLeave(rs.filter(r => r.status === 'pending')))
      .catch(() => {});
    fetchMyChangeRequests(empId)
      .then(rs => setPendingReq(rs.filter(r => r.status === 'pending')))
      .catch(() => {});
  }, [empId, reload]);

  const name = profile?.full_name || currentUser.username;
  // fetchMyProfile select '*' nên avatar_url có sẵn — không thêm query nào.
  const avatarUrl = profile?.avatar_url ? toPublicUrl(profile.avatar_url) : '';
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
        {/* Avatar đứng cạnh tên (nó là danh tính, không phải nút công cụ); bên phải chỉ còn
            2 nút icon cùng khung 40px cho cân. min-w-0 để truncate ăn được trong flex. */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => go('portal/edit')}
            title="Hồ sơ của tôi"
            className="w-12 h-12 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-black font-black text-base border border-white/10 active:scale-[.93] transition-transform"
            style={avatarUrl ? undefined : { background: 'linear-gradient(135deg,#FF9500 0%,#E86800 100%)' }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : initials}
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-neutral-500 text-[12px] font-semibold leading-none">{greeting(new Date().getHours())}</p>
            <h1 className="text-white text-[20px] font-black leading-tight mt-1 truncate">{name}</h1>
            {profile?.position && (
              <p className="text-neutral-500 text-[10px] font-black uppercase tracking-wider mt-0.5 truncate">{profile.position}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* ponytail: dùng lại chuông của Navbar (member không thấy Navbar trên mobile). */}
            <div className="w-10 h-10 rounded-xl bg-white/[.06] border border-white/10 flex items-center justify-center">
              <NotificationBell userId={currentUser.id} theme="dark" size={22} />
            </div>
            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="w-10 h-10 rounded-xl bg-white/[.06] border border-white/10 flex items-center justify-center text-neutral-400 active:scale-[.93] active:text-red-400 active:bg-red-500/10 transition-all"
            >
              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Check-in (dùng lại widget của Portal, kèm GPS) ── */}
        {/* Mọi toast 'success' của widget đều là check-in/check-out vừa ghi DB ⇒ số liệu cũ đã hết
            hạn. Bám vào đó thay vì thêm prop onSuccess: widget không có đường thành công nào khác. */}
        {empId && (
          <CheckinWidget
            employeeId={empId}
            onToast={(message, type) => {
              setToast({ message, type });
              if (type === 'success') setReload(n => n + 1);
            }}
          />
        )}

        {/* ── KPI ── */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <button onClick={() => go('portal/tasks')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left active:scale-[.97] active:bg-white/[.04] transition-all">
            <p className="text-neutral-600 text-[9px] font-black uppercase tracking-wider">Công tháng</p>
            <p className="text-white text-[22px] font-black mt-1.5 leading-none">{workDays}</p>
          </button>
          <button onClick={() => go('portal/recurring')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left active:scale-[.97] active:bg-white/[.04] transition-all">
            <p className="text-neutral-600 text-[9px] font-black uppercase tracking-wider">Phép còn</p>
            <p className="text-[#4CAF50] text-[22px] font-black mt-1.5 leading-none">{leaveLeft ?? '—'}</p>
          </button>
          <button onClick={() => go('portal/tasks')} className="bg-surface border border-white/[.08] rounded-2xl p-3.5 text-left active:scale-[.97] active:bg-white/[.04] transition-all">
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
            // active:scale — feedback khi chạm (mobile), không phải hover:scale mà STYLE_GUIDE cấm.
            <button key={a.label} onClick={() => go(a.to)} className="flex flex-col items-center gap-2 active:scale-[.93] transition-transform">
              <div
                className="w-full aspect-square rounded-2xl border border-white/[.14] flex items-center justify-center text-[22px]"
                style={{
                  background: 'linear-gradient(160deg, rgba(255,255,255,.09), rgba(255,255,255,.03))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10), 0 2px 8px rgba(0,0,0,.35)',
                }}
              >
                {a.icon}
              </div>
              <span className="text-neutral-300 text-[10px] font-bold text-center leading-tight">{a.label}</span>
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
            {pendingLeave.map(r => {
              // Cùng bảng att_requests nên gộp một danh sách; chỉ đổi nhãn + chỗ bấm tới.
              const isForgot = r.request_type === 'forgot';
              return (
              <button key={r.id} onClick={() => go(isForgot ? 'portal/tasks' : 'portal/recurring')} className="w-full bg-surface border border-white/[.08] rounded-2xl p-4 flex items-center gap-3 text-left">
                <span className="text-[20px]">{isForgot ? '😅' : '🌴'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">{isForgot ? `Giải trình quên chấm ${r.date_from}` : `Đơn nghỉ ${r.date_from}${r.date_to !== r.date_from ? ` → ${r.date_to}` : ''}`}</p>
                  <p className="text-neutral-600 text-[11px] font-semibold truncate">{r.reason || '—'}</p>
                </div>
                <span className="text-[10px] font-black uppercase text-[#FFA726]">Chờ duyệt</span>
              </button>
              );
            })}
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

        {/* ── App đầy đủ — render từ quyền thật, ai được cấp thêm (CRM...) vẫn có lối vào ── */}
        <p className="mt-7 mb-3 text-neutral-600 text-[10px] font-black uppercase tracking-widest">Ứng dụng</p>
        <div className="grid grid-cols-2 gap-2.5">
          {getMyApps(currentUser).map(app => (
            <button
              key={app.id}
              onClick={() => go(app.id)}
              className="relative bg-surface border border-white/[.14] rounded-2xl p-4 text-left active:scale-[.97] active:border-primary/40 transition-all"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 2px 8px rgba(0,0,0,.35)' }}
            >
              {/* chevron: tín hiệu "mở được", rẻ hơn mọi animation */}
              <span className="absolute top-3.5 right-3.5 text-primary/70 text-[15px] font-black leading-none">›</span>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] bg-primary/10 border border-primary/20">{app.icon}</span>
              <p className="text-white text-[13px] font-black mt-2.5">{app.name}</p>
              <p className="text-neutral-500 text-[11px] font-semibold">{app.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberHome;
