import React, { useState, useEffect, useMemo } from 'react';
import { FxRate, fetchFxRates, upsertFxRate, deleteFxRate, getLatestRate } from '../services/fxRateService';

const fmtRate = (r: number) => r.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');

const FxRateManager: React.FC = () => {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formRate, setFormRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = async () => {
    setIsLoading(true);
    try { setRates(await fetchFxRates()); }
    catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const latestUsdVnd = useMemo(() => getLatestRate('USD', 'VND', rates), [rates]);

  const yearRates = useMemo(() =>
    rates.filter(r => new Date(r.rate_date).getFullYear() === selectedYear)
      .sort((a, b) => b.rate_date.localeCompare(a.rate_date)),
    [rates, selectedYear]
  );

  const years = useMemo(() => {
    const ys = new Set(rates.map(r => new Date(r.rate_date).getFullYear()));
    ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [rates]);

  const handleSave = async () => {
    if (!formDate || !formRate) return;
    setSaving(true);
    try {
      await upsertFxRate({
        rate_date: formDate,
        from_currency: 'USD',
        to_currency: 'VND',
        rate: parseFloat(formRate.replace(/[^0-9.]/g, '')),
        source: 'manual',
      });
      setShowForm(false);
      setFormRate('');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteFxRate(id); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const inp: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10, border: '1px solid #333',
    background: '#0F0F0F', color: '#F5F5F5', fontSize: 14, outline: 'none', width: '100%',
  };

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#34C759', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            💱 Tỷ giá
          </h2>
          <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
            Quản lý tỷ giá USD/VND dùng cho quy đổi P&amp;L
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '10px 24px', borderRadius: 12, border: 'none', fontWeight: 800,
          fontSize: 13, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
          background: showForm ? '#333' : 'linear-gradient(135deg,#34C759,#28a745)',
          color: showForm ? '#aaa' : '#000',
        }}>
          {showForm ? '✕ Đóng' : '+ Thêm tỷ giá'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: '#FF3B30', fontSize: 13, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Latest rate card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(52,199,89,0.15),rgba(40,167,69,0.08))', border: '1px solid rgba(52,199,89,0.25)', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tỷ giá mới nhất</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#34C759' }}>
            {latestUsdVnd ? fmtRate(latestUsdVnd.rate) : '—'}
          </p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            VND / USD {latestUsdVnd ? `· ${fmtDate(latestUsdVnd.rate_date)}` : '· Chưa có dữ liệu'}
          </p>
        </div>
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tổng bản ghi</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: '#F5F5F5' }}>{rates.length}</p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>mốc tỷ giá đã nhập</p>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#F5F5F5', marginBottom: 16 }}>➕ Thêm mốc tỷ giá USD → VND</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Ngày áp dụng</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>1 USD = ? VND</label>
              <input
                type="text" inputMode="numeric" placeholder="vd: 25450"
                value={formRate} onChange={e => setFormRate(e.target.value)}
                style={inp}
              />
            </div>
            <button onClick={handleSave} disabled={saving || !formDate || !formRate} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none', fontWeight: 800,
              fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              background: '#34C759', color: '#000', whiteSpace: 'nowrap',
            }}>
              {saving ? '...' : 'Lưu'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#555', marginTop: 10 }}>
            💡 Nguồn tham khảo: Vietcombank, BIDV, hoặc NHNN. Mốc cùng ngày sẽ được ghi đè.
          </p>
        </div>
      )}

      {/* Year filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', fontWeight: 700,
            fontSize: 12, cursor: 'pointer',
            background: selectedYear === y ? '#34C759' : '#222', color: selectedYear === y ? '#000' : '#888',
          }}>{y}</button>
        ))}
      </div>

      {/* Rate table */}
      {isLoading ? (
        <p style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 40 }}>Đang tải...</p>
      ) : yearRates.length === 0 ? (
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>💱</p>
          <p style={{ fontWeight: 800, color: '#F5F5F5', fontSize: 15 }}>Chưa có dữ liệu tỷ giá năm {selectedYear}</p>
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>Thêm ít nhất 1 mốc tỷ giá để hệ thống quy đổi P&L chính xác</p>
        </div>
      ) : (
        <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px', padding: '12px 20px', borderBottom: '1px solid #222', background: '#0F0F0F' }}>
            {['Ngày', 'Từ', 'Sang', 'Tỷ giá (1 USD)', 'Nguồn', ''].map((h, i) => (
              <p key={i} style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</p>
            ))}
          </div>
          {yearRates.map((r, idx) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px', padding: '13px 20px', borderBottom: idx < yearRates.length - 1 ? '1px solid #1a1a1a' : 'none', alignItems: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F5F5F5' }}>{fmtDate(r.rate_date)}</p>
              <p style={{ fontSize: 13, color: '#888' }}>{r.from_currency}</p>
              <p style={{ fontSize: 13, color: '#888' }}>{r.to_currency}</p>
              <p style={{ fontSize: 14, fontWeight: 900, color: '#34C759', textAlign: 'right' }}>{fmtRate(r.rate)}</p>
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => r.id && handleDelete(r.id)} style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid #333',
                  background: 'transparent', color: '#FF3B30', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage note */}
      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.15)', fontSize: 12, color: '#34C759' }}>
        ℹ️ Tỷ giá này được dùng để quy đổi doanh thu/chi phí USD sang VND trong báo cáo P&L. Hệ thống tự động chọn mốc tỷ giá gần nhất trước ngày giao dịch.
      </div>
    </div>
  );
};

export default FxRateManager;
