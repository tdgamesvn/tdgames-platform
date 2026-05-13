import React, { useCallback, useEffect, useState } from 'react';
import { HrParkingRegistration, HrParkingVehicleType } from '@/types';
import {
  fetchMyParkingRegistrations,
  saveMyParkingRegistration,
  updateMyParkingRegistration,
  deleteMyParkingRegistration,
} from '../services/portalService';

const VEHICLE_LABELS: Record<HrParkingVehicleType, string> = {
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '12px 16px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
};

interface Props {
  employeeId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const ParkingTab: React.FC<Props> = ({ employeeId, onToast }) => {
  const [list, setList] = useState<HrParkingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [vehicleType, setVehicleType] = useState<HrParkingVehicleType>('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [color, setColor] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyParkingRegistrations(employeeId);
      setList(data);
    } catch (e: any) {
      onToast(e.message || 'Không tải được danh sách', 'error');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setVehicleType('motorcycle');
    setLicensePlate('');
    setColor('');
    setVehicleBrand('');
    setEditingId('new');
  };

  const startEdit = (r: HrParkingRegistration) => {
    setVehicleType(r.vehicle_type);
    setLicensePlate(r.license_plate);
    setColor(r.color);
    setVehicleBrand(r.vehicle_brand || '');
    setEditingId(r.id);
  };

  const save = async () => {
    const plate = licensePlate.trim();
    if (!plate) {
      onToast('Vui lòng nhập biển số xe', 'error');
      return;
    }
    if (!color.trim()) {
      onToast('Vui lòng nhập màu xe', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId === 'new') {
        await saveMyParkingRegistration(employeeId, { vehicle_type: vehicleType, license_plate: plate, color: color.trim(), vehicle_brand: vehicleBrand.trim() });
        onToast('Đã thêm đăng ký gửi xe', 'success');
      } else if (editingId) {
        await updateMyParkingRegistration(editingId, employeeId, {
          vehicle_type: vehicleType,
          license_plate: plate,
          color: color.trim(),
          vehicle_brand: vehicleBrand.trim(),
        });
        onToast('Đã cập nhật', 'success');
      }
      setEditingId(null);
      await load();
    } catch (e: any) {
      onToast(e.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMyParkingRegistration(id, employeeId);
      onToast('Đã xóa đăng ký', 'success');
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      onToast(e.message || 'Xóa thất bại', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p className="animate-pulse" style={{ color: '#888' }}>Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
          Gửi xe
        </h2>
        <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
          Đăng ký phương tiện (loại xe, nhãn hiệu, màu, biển số) để làm thẻ / bảo vệ.
        </p>
      </div>

      {!editingId && (
        <button
          type="button"
          onClick={startNew}
          style={{
            marginBottom: 20,
            padding: '12px 20px',
            borderRadius: 12,
            border: 'none',
            fontWeight: 800,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: '#0F0F0F',
          }}
        >
          + Thêm xe
        </button>
      )}

      {editingId && (
        <div
          style={{
            background: '#161616',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 900, color: '#F59E0B', textTransform: 'uppercase', marginBottom: 16 }}>
            {editingId === 'new' ? 'Đăng ký mới' : 'Sửa thông tin xe'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#9D9C9D', textTransform: 'uppercase', marginBottom: 6 }}>
                Loại xe
              </label>
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value as HrParkingVehicleType)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                {(Object.keys(VEHICLE_LABELS) as HrParkingVehicleType[]).map(k => (
                  <option key={k} value={k} style={{ background: '#1A1A1A' }}>{VEHICLE_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#9D9C9D', textTransform: 'uppercase', marginBottom: 6 }}>
                Nhãn hiệu xe
              </label>
              <input
                type="text"
                value={vehicleBrand}
                onChange={e => setVehicleBrand(e.target.value)}
                placeholder="Honda, Yamaha, Toyota…"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#9D9C9D', textTransform: 'uppercase', marginBottom: 6 }}>
                Màu xe
              </label>
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="Ví dụ: Đen, Trắng, Xám…"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#9D9C9D', textTransform: 'uppercase', marginBottom: 6 }}>
                Biển số xe
              </label>
              <input
                type="text"
                value={licensePlate}
                onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="59A1-123.45"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                fontWeight: 800,
                fontSize: 11,
                textTransform: 'uppercase',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                color: '#fff',
              }}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#9D9C9D',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && !editingId ? (
        <p style={{ textAlign: 'center', color: '#666', padding: 40 }}>Chưa có xe nào được đăng ký.</p>
      ) : (
        !editingId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map(r => (
              <div
                key={r.id}
                style={{
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                    {VEHICLE_LABELS[r.vehicle_type]}{r.vehicle_brand ? ` · ${r.vehicle_brand}` : ''} · <span style={{ color: '#F59E0B' }}>{r.license_plate}</span>
                  </p>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Màu: {r.color || '—'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #FF9500, #FF6B00)',
                      color: '#fff',
                    }}
                  >
                    Sửa
                  </button>
                  {confirmDelete === r.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                          background: '#DC2626',
                          color: '#fff',
                        }}
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'transparent',
                          color: '#888',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(r.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(239,68,68,0.4)',
                        background: 'transparent',
                        color: '#F87171',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default ParkingTab;
