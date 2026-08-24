// apps/portal/components/CheckinWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { AttRecord, AttOfficeConfig } from '@/types';
import {
  fetchOfficeConfig,
  fetchMyTodayRecord,
  selfCheckIn,
  selfCheckOut,
  checkRemoteApproved,
  haversineDistance,
} from '@/apps/attendance/services/attendanceService';

interface Props {
  employeeId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type WidgetState =
  | 'loading'
  | 'not_checked_in'
  | 'gps_requesting'
  | 'gps_denied'
  | 'out_of_range'
  | 'checked_in'
  | 'checked_out';

// ponytail: máy tính không có chip GPS — trình duyệt đoán vị trí từ wifi/IP, lệch 100m tới
// vài km ⇒ chấm công chỉ mở trên điện thoại. Chặn nhầm lẫn, KHÔNG phải chặn gian lận (đổi
// user-agent là qua được) — nên chỉ giấu nút CHECK IN, check-out vẫn bấm được ở mọi máy.
// maxTouchPoints: iPadOS 13+ khai UA y hệt macOS, không bắt được bằng regex.
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(checkInIso: string, checkOutIso?: string): { hm: string; dayFraction: string } {
  const start = new Date(checkInIso).getTime();
  const end = checkOutIso ? new Date(checkOutIso).getTime() : Date.now();
  const totalMs = Math.max(0, end - start);
  const totalMins = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hours = totalMs / 3_600_000;
  const dayFraction = (hours / 8).toFixed(2);
  return { hm: `${h}h ${m}p`, dayFraction };
}

const CheckinWidget: React.FC<Props> = ({ employeeId, onToast }) => {
  const [state, setState] = useState<WidgetState>('loading');
  const [record, setRecord] = useState<AttRecord | null>(null);
  const [officeConfig, setOfficeConfig] = useState<AttOfficeConfig | null>(null);
  const [outOfRangeDistance, setOutOfRangeDistance] = useState<number>(0);
  const [isRemoteDay, setIsRemoteDay] = useState(false);
  const [liveTimer, setLiveTimer] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load office config + today's record on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      fetchOfficeConfig(),
      fetchMyTodayRecord(employeeId),
      checkRemoteApproved(employeeId, today),
    ]).then(([config, todayRecord, isRemote]) => {
      setOfficeConfig(config);
      setIsRemoteDay(isRemote);
      if (todayRecord) {
        setRecord(todayRecord);
        setState(todayRecord.check_out ? 'checked_out' : 'checked_in');
      } else {
        setState('not_checked_in');
      }
    }).catch(() => setState('not_checked_in'));
  }, [employeeId]);

  // Live timer when checked in but not out
  useEffect(() => {
    if (state === 'checked_in' && record?.check_in) {
      const update = () => {
        const { hm } = formatDuration(record.check_in!);
        setLiveTimer(hm);
      };
      update();
      timerRef.current = setInterval(update, 30000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, record]);

  const handleCheckIn = async () => {
    if (!officeConfig) return;

    // Remote day: bypass geo
    if (isRemoteDay) {
      setState('gps_requesting');
      try {
        const r = await selfCheckIn(employeeId, 0, 0, 'remote');
        setRecord(r);
        setState('checked_in');
        onToast('✅ Đã check in (Remote)', 'success');
      } catch {
        onToast('Lỗi check in. Thử lại sau.', 'error');
        setState('not_checked_in');
      }
      return;
    }

    // Office day: require GPS
    if (!navigator.geolocation) {
      setState('gps_denied');
      return;
    }
    setState('gps_requesting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          officeConfig.lat,
          officeConfig.lng
        );
        if (dist > officeConfig.radius_meters) {
          setOutOfRangeDistance(Math.round(dist));
          setState('out_of_range');
          return;
        }
        try {
          const r = await selfCheckIn(employeeId, pos.coords.latitude, pos.coords.longitude, 'geo');
          setRecord(r);
          setState('checked_in');
          onToast('✅ Chấm công thành công!', 'success');
        } catch {
          onToast('Lỗi khi lưu check in. Thử lại sau.', 'error');
          setState('not_checked_in');
        }
      },
      () => setState('gps_denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckOut = async () => {
    if (!record) return;
    try {
      const r = await selfCheckOut(record.id);
      setRecord(r);
      setState('checked_out');
      const { hm, dayFraction } = formatDuration(r.check_in!, r.check_out!);
      onToast(`✅ Check out — ${hm} (${dayFraction} ngày công)`, 'success');
    } catch {
      onToast('Lỗi khi lưu check out. Thử lại sau.', 'error');
    }
  };

  const card: React.CSSProperties = {
    background: '#161616',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  };

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hôm nay
          </p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#ccc', marginTop: '2px' }}>{today}</p>
        </div>
        {isRemoteDay && (
          <span style={{
            fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
            background: 'rgba(6,182,212,0.1)', color: '#06B6D4', textTransform: 'uppercase',
          }}>
            🏠 Remote
          </span>
        )}
      </div>

      {/* States */}
      {state === 'loading' && (
        <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Đang tải...</p>
      )}

      {state === 'not_checked_in' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Bạn chưa chấm công hôm nay</p>
          {isMobileDevice ? (
            <button
              onClick={handleCheckIn}
              style={{
                background: '#FF9500', color: '#000', border: 'none', borderRadius: '12px',
                padding: '14px 40px', fontSize: '15px', fontWeight: 900, cursor: 'pointer',
                letterSpacing: '-0.01em', width: '100%', maxWidth: '280px',
              }}
            >
              📍 CHECK IN
            </button>
          ) : (
            <div style={{
              border: '1px solid rgba(255,255,255,.10)', borderRadius: '12px',
              background: 'rgba(255,255,255,.04)', padding: '14px 16px',
              maxWidth: '320px', margin: '0 auto',
            }}>
              <p style={{ color: '#F5F5F5', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                📱 Chấm công bằng điện thoại
              </p>
              <p style={{ color: '#888', fontSize: '12px', lineHeight: 1.5 }}>
                Máy tính không có GPS, vị trí bị lệch cả km nên dễ chấm sai chỗ.
              </p>
            </div>
          )}
        </div>
      )}

      {state === 'gps_requesting' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p className="animate-pulse" style={{ color: '#FF9500', fontSize: '13px', fontWeight: 700 }}>
            📡 Đang xác định vị trí...
          </p>
        </div>
      )}

      {state === 'gps_denied' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '12px' }}>
            ⚠️ Vui lòng cho phép quyền vị trí trong trình duyệt
          </p>
          <button
            onClick={() => setState('not_checked_in')}
            style={{
              background: 'transparent', border: '1px solid #444', borderRadius: '8px',
              color: '#ccc', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {state === 'out_of_range' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '4px' }}>
            📍 Bạn đang cách văn phòng ~{outOfRangeDistance}m
          </p>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
            Cần ở trong bán kính {officeConfig?.radius_meters ?? 300}m để chấm công
          </p>
          <button
            onClick={() => setState('not_checked_in')}
            style={{
              background: 'transparent', border: '1px solid #444', borderRadius: '8px',
              color: '#ccc', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {state === 'checked_in' && record?.check_in && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#34C759', boxShadow: '0 0 6px #34C75988', flexShrink: 0,
            }} />
            <div>
              <p style={{ fontSize: '13px', color: '#ccc' }}>
                Vào lúc <strong style={{ color: '#F5F5F5' }}>{formatTime(record.check_in)}</strong>
                {record.method === 'remote' && (
                  <span style={{ color: '#06B6D4', fontSize: '11px', marginLeft: '8px' }}>🏠 Remote</span>
                )}
              </p>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                ⏱ Đang làm: {liveTimer}
              </p>
            </div>
          </div>
          <button
            onClick={handleCheckOut}
            style={{
              background: 'transparent', border: '1px solid #FF9500', borderRadius: '12px',
              color: '#FF9500', padding: '12px 32px', fontSize: '14px', fontWeight: 800,
              cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
            }}
          >
            🏁 CHECK OUT
          </button>
        </div>
      )}

      {state === 'checked_out' && record?.check_in && record?.check_out && (
        <div style={{
          background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
          borderRadius: '12px', padding: '16px 20px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: '#34C759', marginBottom: '8px' }}>
            ✅ Hoàn thành ngày làm việc
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Vào</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#F5F5F5' }}>{formatTime(record.check_in)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Ra</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#F5F5F5' }}>{formatTime(record.check_out)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Giờ làm</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#FF9500' }}>
                {formatDuration(record.check_in, record.check_out).hm}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Ngày công</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#34C759' }}>
                {formatDuration(record.check_in, record.check_out).dayFraction}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinWidget;
