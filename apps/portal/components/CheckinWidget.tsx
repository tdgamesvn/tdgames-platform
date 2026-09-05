// apps/portal/components/CheckinWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { AttRecord, AttOfficeConfig } from '@/types';
import {
  fetchOfficeConfig,
  fetchMyTodayRecord,
  selfCheckIn,
  selfCheckOut,
  fetchRemoteStatus,
  haversineDistance,
  todayVN,
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
// vài km ⇒ cả check-in lẫn check-out chỉ mở trên điện thoại (check-out cũng phải đo vị trí,
// kẻo về nhà rồi mới bấm vẫn tính đủ công). Chặn nhầm lẫn, KHÔNG phải chặn gian lận — đổi
// user-agent là qua được; chặn thật phải nằm ở RLS.
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
  // Màn "ngoài vùng"/"chưa cấp quyền" dùng chung cho cả check-in lẫn check-out, nên phải nhớ
  // bấm "Thử lại" thì quay về trạng thái nào.
  const [retryTo, setRetryTo] = useState<'not_checked_in' | 'checked_in' | 'checked_out'>('not_checked_in');
  const [remoteStatus, setRemoteStatus] = useState<'approved' | 'pending' | null>(null);
  const [liveTimer, setLiveTimer] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load office config + today's record on mount
  useEffect(() => {
    const today = todayVN();
    Promise.all([
      fetchOfficeConfig(),
      fetchMyTodayRecord(employeeId),
      fetchRemoteStatus(employeeId, today),
    ]).then(([config, todayRecord, remote]) => {
      setOfficeConfig(config);
      setRemoteStatus(remote);
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

    // Đơn WFH có thể vừa được duyệt sau khi trang đã mở ⇒ hỏi lại DB đúng lúc bấm thay vì đọc
    // state cache từ lúc mount. Không có dòng này thì duyệt xong vẫn phải F5 mới bỏ qua GPS.
    // ponytail: 1 query mỗi lần bấm, rẻ hơn realtime subscription hay polling nền.
    const remoteToday = await fetchRemoteStatus(employeeId, todayVN())
      .catch(() => remoteStatus);
    setRemoteStatus(remoteToday);

    // Remote day: bypass geo (đơn còn 'pending' thì vẫn phải đứng ở VP — RLS cũng chặn)
    if (remoteToday === 'approved') {
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
    setRetryTo('not_checked_in');
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

  type StampField = 'check_out' | 'ot_check_in' | 'ot_check_out';

  const saveStamp = async (field: StampField, back: WidgetState) => {
    if (!record) return;
    try {
      const r = await selfCheckOut(record.id, field);
      setRecord(r);
      setState('checked_out');
      if (field === 'check_out') {
        const { hm, dayFraction } = formatDuration(r.check_in!, r.check_out!);
        onToast(`✅ Check out — ${hm} (${dayFraction} ngày công)`, 'success');
      } else if (field === 'ot_check_in') {
        onToast('🟠 Bắt đầu tăng ca', 'success');
      } else {
        onToast(`🟣 Kết thúc tăng ca — ${formatDuration(r.ot_check_in!, r.ot_check_out!).hm}`, 'success');
      }
    } catch {
      onToast('Lỗi khi lưu. Thử lại sau.', 'error');
      setState(back);
    }
  };

  /**
   * Check-out và bấm giờ OT đều phải ở trong bán kính VP — về nhà rồi mới bấm thì không tính.
   * Quên bấm ⇒ hôm sau làm đơn giải trình cho Admin duyệt (không mở cửa sau ở đây).
   */
  const handleStamp = async (field: StampField) => {
    if (!record) return;
    const back: WidgetState = field === 'check_out' ? 'checked_in' : 'checked_out';
    // Ngày WFH đã được duyệt thì không có VP nào để đứng gần.
    if (remoteStatus === 'approved' || record.method === 'remote') return saveStamp(field, back);

    setRetryTo(back);
    if (!officeConfig || !navigator.geolocation) {
      setState('gps_denied');
      return;
    }
    setState('gps_requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude, pos.coords.longitude, officeConfig.lat, officeConfig.lng,
        );
        if (dist > officeConfig.radius_meters) {
          setOutOfRangeDistance(Math.round(dist));
          setState('out_of_range');
          return;
        }
        saveStamp(field, back);
      },
      () => setState('gps_denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
        {remoteStatus && (
          <span style={{
            fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
            background: remoteStatus === 'approved' ? 'rgba(6,182,212,0.1)' : 'rgba(255,149,0,0.1)',
            color: remoteStatus === 'approved' ? '#06B6D4' : '#FF9500', textTransform: 'uppercase',
          }}>
            {remoteStatus === 'approved' ? '🏠 Remote' : '⏳ Đơn WFH chờ duyệt'}
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
            onClick={() => setState(retryTo)}
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
            Cần ở trong bán kính {officeConfig?.radius_meters ?? 300}m để chấm công.
            Quên chấm thì hôm sau làm đơn giải trình để Admin duyệt.
          </p>
          <button
            onClick={() => setState(retryTo)}
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
          {isMobileDevice ? (
            <button
              onClick={() => handleStamp('check_out')}
              style={{
                background: 'transparent', border: '1px solid #FF9500', borderRadius: '12px',
                color: '#FF9500', padding: '12px 32px', fontSize: '14px', fontWeight: 800,
                cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
              }}
            >
              🏁 CHECK OUT
            </button>
          ) : (
            <p style={{ color: '#888', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
              📱 Check out bằng điện thoại — máy tính không đo được vị trí lúc tan làm.
            </p>
          )}
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

          {/* Tăng ca — chỉ hiện sau khi đã chốt ca chính.
              ponytail: 1 lượt OT/ngày. Bấm xong là khoá, muốn sửa thì làm đơn cho HR. */}
          {isMobileDevice && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
              {!record.ot_check_in && (
                <button
                  onClick={() => handleStamp('ot_check_in')}
                  style={{
                    background: 'transparent', border: '1px solid #FF9500', borderRadius: '12px',
                    color: '#FF9500', padding: '12px 32px', fontSize: '14px', fontWeight: 800,
                    cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
                  }}
                >
                  🟠 CHECK IN OT
                </button>
              )}

              {record.ot_check_in && !record.ot_check_out && (
                <>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                    🟠 Tăng ca từ <strong style={{ color: '#F5F5F5' }}>{formatTime(record.ot_check_in)}</strong>
                  </p>
                  <button
                    onClick={() => handleStamp('ot_check_out')}
                    style={{
                      background: 'transparent', border: '1px solid #9B59B6', borderRadius: '12px',
                      color: '#9B59B6', padding: '12px 32px', fontSize: '14px', fontWeight: 800,
                      cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
                    }}
                  >
                    🟣 CHECK OUT OT
                  </button>
                </>
              )}

              {record.ot_check_in && record.ot_check_out && (
                <p style={{ fontSize: '12px', color: '#888' }}>
                  🟣 Tăng ca {formatTime(record.ot_check_in)} → {formatTime(record.ot_check_out)}
                  {' '}<strong style={{ color: '#9B59B6' }}>
                    ({formatDuration(record.ot_check_in, record.ot_check_out).hm})
                  </strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckinWidget;
