import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { fetchExchangeRate, ExchangeRateData, avgRate } from './exchangeRateService';
import { upsertFxRate } from '@/apps/expense/services/fxRateService';
import { supabase } from './supabaseClient';

/**
 * RLS `finance_fx_rates_write` chỉ cho admin/ke_toan ghi (migration 20260702120000).
 * Trước đây upsert gọi vô điều kiện: chạy cả khi chưa đăng nhập và với mọi role khác
 * ⇒ mỗi lần refresh tỷ giá là một request 401. `.catch()` nuốt được lỗi JS nhưng
 * KHÔNG giấu được dòng "Failed to load resource: 401" do trình duyệt tự log —
 * muốn hết thì phải không gửi request.
 * getSession() đọc từ localStorage, không tốn thêm request mạng.
 */
/**
 * ponytail: nhớ ngày đã ghi để mount + SIGNED_IN không bắn 2-3 upsert trùng nhau.
 * Biến module-level là đủ vì provider chỉ có một instance cho cả app; reload trang
 * thì reset và ghi lại 1 lần — chấp nhận được, upsert vốn idempotent.
 * Nâng cấp: cần chặt hơn thì đọc `finance_fx_rates` của hôm nay trước khi ghi.
 */
let savedFxDate: string | null = null;

async function canWriteFxRate(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const meta = data.session?.user?.user_metadata;
  if (!meta) return false; // chưa đăng nhập
  const roles = [meta.role, ...(Array.isArray(meta.secondary_roles) ? meta.secondary_roles : [])];
  return roles.some(r => r === 'admin' || r === 'ke_toan');
}

interface ExchangeRateContextValue {
  rate: ExchangeRateData | null;
  loading: boolean;
  /** (buy + sell) / 2 — fallback to 25400 if rate not yet loaded */
  avgUsdVnd: number;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ExchangeRateContextValue | null>(null);

const REFRESH_MS = 60 * 60 * 1000; // 1 hour

export const ExchangeRateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rate, setRate] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExchangeRate();
      setRate(data);
      // Auto-save today's VCB avg rate to DB for historical reporting
      const today = new Date().toISOString().split('T')[0];
      const avg = avgRate(data);
      if (avg > 0 && savedFxDate !== today && await canWriteFxRate()) {
        // Kiểm tra LẠI sau await: trong lúc chờ canWriteFxRate(), một refresh khác
        // (StrictMode mount 2 lần ở dev, hoặc mount + SIGNED_IN sát nhau) có thể đã
        // ghi rồi. Đặt cờ ngay sau lần kiểm tra này, không có await xen giữa, nên
        // hai luồng không thể cùng lọt.
        if (savedFxDate !== today) {
          savedFxDate = today;
          upsertFxRate({
            rate_date: today,
            from_currency: 'USD',
            to_currency: 'VND',
            rate: avg,
            source: 'vcb',
          }).catch(() => { savedFxDate = null; }); // hỏng thì cho phép thử lại
        }
      }
    } catch (err) {
      console.warn('[ExchangeRate] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    // ponytail: refresh() lúc mount chạy TRƯỚC khi đăng nhập ⇒ upsert cache tỷ giá
    // xưa nay không ghi được cho ai, kể cả admin (chỉ lần refresh sau 1 tiếng mới có
    // session — thực tế gần như không bao giờ tới). Chạy lại khi đăng nhập xong.
    // Reload mà đã có session thì supabase khôi phục kịp, lần mount ở trên đã đủ.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const avgUsdVnd = rate && rate.buy > 0 && rate.sell > 0 ? avgRate(rate) : 25400;

  return (
    <Ctx.Provider value={{ rate, loading, avgUsdVnd, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export function useExchangeRate(): ExchangeRateContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useExchangeRate must be used within <ExchangeRateProvider>');
  }
  return ctx;
}
