// components/MemberTabBar.tsx
// Thanh điều hướng đáy cho nhân viên thường — thứ làm cho web trông ra "app".
// ponytail: tự ẩn khi không phải member-only hoặc khi màn rộng (sm:hidden),
// nên chỗ gọi chỉ cần <MemberTabBar currentUser={u} /> mà không cần điều kiện.
import React, { useEffect, useState } from 'react';
import { AccountUser } from '@/types';
import { isMemberOnly } from '@/config/apps';

/** Chiều cao thanh (px) — content phải chừa đúng chỗ này, xem MEMBER_TABBAR_PAD. */
const ITEMS = [
  { hash: '',                  label: 'Trang chủ', d: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5' },
  { hash: 'portal/tasks',      label: 'Chấm công', d: 'M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { hash: 'portal/activity',   label: 'Lương',     d: 'M3 7h18v10H3zM12 12h.01M7 12h.01M17 12h.01' },
  { hash: 'portal/recurring',  label: 'Nghỉ phép', d: 'M8 3v4M16 3v4M3.5 9.5h17M5 5.5h14v15H5z' },
  { hash: 'portal/edit',       label: 'Cá nhân',   d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0' },
];

/**
 * Class chừa chỗ cho thanh đáy — dán vào container nội dung của màn member.
 * Mốc `md` (768px) phải KHỚP với Navbar, xem chú thích ở dưới.
 */
export const MEMBER_TABBAR_PAD = 'pb-[76px] md:pb-0';

const MemberTabBar: React.FC<{ currentUser: AccountUser }> = ({ currentUser }) => {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    const sync = () => setHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  if (!isMemberOnly(currentUser)) return null;

  // 'portal' trần (không có tab) coi như đang ở Bảng lương — đúng tab mặc định của PortalApp.
  const current = hash === 'portal' ? 'portal/activity' : hash;

  return (
    <nav
      // md:hidden (768px) chứ KHÔNG phải sm — Navbar chỉ hiện dải tab desktop từ `md` trở lên.
      // Dùng sm sẽ tạo vùng chết 640–767px: thanh này đã ẩn mà dải desktop chưa hiện, và dải tab
      // mobile thì đang bị hideMobileTabs tắt ⇒ nhân viên kẹt trong Portal, không chuyển được màn.
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#141414]/95 backdrop-blur-lg border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {ITEMS.map(it => {
          const active = current === it.hash;
          return (
            <button
              key={it.label}
              onClick={() => { window.location.hash = it.hash; }}
              aria-current={active ? 'page' : undefined}
              // min-h-[56px]: vượt ngưỡng chạm 44px của iOS
              className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 active:bg-white/5 transition-colors"
            >
              <svg
                className="w-[22px] h-[22px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? '#FF9500' : '#6B6B6B'}
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={it.d} />
              </svg>
              <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${active ? 'text-primary' : 'text-neutral-500'}`}>
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MemberTabBar;
