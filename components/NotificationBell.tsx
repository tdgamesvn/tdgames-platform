import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification, enablePush, pushPermission } from '@/services/notificationService';

const TYPE_ICONS: Record<string, string> = {
  leave_approved:  '✅',
  leave_rejected:  '❌',
  leave_new:       '📋',
  payslip_created: '💰',
  payslip_withdrawn: '↩️',
  expense_approved:'✅',
  expense_rejected:'❌',
  invoice_overdue: '⚠️',
  broadcast:       '📢',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

// `notifications.body` chứa <strong> vì notify-email dùng chung field này để in đậm nhãn.
// Chỗ nào hiện text thuần thì phải gỡ tag — cùng regex notify-email đang dùng cho bản text.
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '');

interface NotificationBellProps {
  userId: string;
  theme: string;
  /** Cỡ icon chuông. Mặc định 20 = Navbar desktop; màn mobile truyền to hơn cho đủ vùng chạm. */
  size?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, theme, size = 20 }) => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const [pushPerm, setPushPerm] = useState(pushPermission());
  const panelRef = useRef<HTMLDivElement>(null);
  const dark = theme === 'dark';

  const handleEnablePush = async () => {
    try {
      setPushPerm(await enablePush(userId));
    } catch (e) {
      console.error('Bật thông báo đẩy thất bại:', e);
      alert('Không bật được thông báo đẩy trên thiết bị này.');
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClickNotification = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id);
    if (n.link) window.location.hash = n.link.replace(/^#/, '');
    setOpen(false);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Thông báo"
        style={{
          position: 'relative',
          padding: '8px',
          borderRadius: '12px',
          border: 'none',
          background: open
            ? dark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)'
            : 'transparent',
          cursor: 'pointer',
          color: dark ? '#aaa' : '#555',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Bell SVG */}
        <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            borderRadius: '8px',
            background: '#FF3B30',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="notif-panel" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          // min(): màn hẹp (iPhone SE) panel neo phải sẽ tràn mép trái nếu cứng 360px.
          width: 'min(360px, calc(100vw - 24px))',
          maxHeight: '480px',
          borderRadius: '16px',
          border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`,
          background: dark ? '#161616' : '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 200,
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${dark ? '#222' : '#f0f0f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: dark ? '#F5F5F5' : '#111' }}>
              🔔 Thông báo {unreadCount > 0 && (
                <span style={{ color: '#FF9500', marginLeft: '4px' }}>({unreadCount} mới)</span>
              )}
            </span>
            {pushPerm === 'default' && (
              <button
                onClick={handleEnablePush}
                title="Nhận thông báo ngay cả khi không mở app"
                style={{
                  fontSize: '11px', fontWeight: 700, color: '#FF9500',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: '8px', marginLeft: 'auto',
                }}
              >
                🔔 Bật đẩy
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                style={{
                  fontSize: '11px', fontWeight: 700, color: '#FF9500',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: '8px',
                }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px', textAlign: 'center',
                color: dark ? '#555' : '#aaa', fontSize: '13px',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔕</div>
                Chưa có thông báo nào
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  style={{
                    padding: '14px 20px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${dark ? '#1a1a1a' : '#f5f5f5'}`,
                    background: n.is_read
                      ? 'transparent'
                      : dark ? 'rgba(255,149,0,0.05)' : 'rgba(255,149,0,0.04)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = n.is_read
                      ? 'transparent'
                      : dark ? 'rgba(255,149,0,0.05)' : 'rgba(255,149,0,0.04)';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: dark ? '#222' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                  }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <p style={{
                        fontSize: '13px', fontWeight: n.is_read ? 600 : 800,
                        color: dark ? '#F5F5F5' : '#111', margin: 0, flex: 1,
                        lineHeight: 1.3,
                      }}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: '#FF9500', flexShrink: 0, marginTop: '4px',
                        }} />
                      )}
                    </div>
                    {n.body && (
                      <p style={{
                        fontSize: '11px', color: dark ? '#888' : '#666',
                        margin: '3px 0 0 0', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                      }}>
                        {stripTags(n.body)}
                      </p>
                    )}
                    <p style={{
                      fontSize: '10px', color: dark ? '#555' : '#bbb',
                      margin: '4px 0 0 0', fontWeight: 600,
                    }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
