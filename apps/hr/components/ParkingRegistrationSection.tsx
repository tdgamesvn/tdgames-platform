import React, { useCallback, useEffect, useState } from 'react';
import { HrEmployee, HrParkingRegistration, HrParkingVehicleType } from '@/types';
import * as svc from '../services/hrService';

const inputCls =
  'w-full bg-white/5 border border-primary/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/40';
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1 block';

const VEHICLE_LABELS: Record<HrParkingVehicleType, string> = {
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};

function buildParkingPayload(
  employeeId: string,
  vehicle_type: HrParkingVehicleType,
  license_plate: string,
  color: string,
  vehicle_brand: string,
): Omit<HrParkingRegistration, 'id' | 'created_at' | 'updated_at'> {
  return {
    employee_id: employeeId,
    vehicle_type,
    license_plate: license_plate.trim(),
    color: color.trim(),
    vehicle_brand: vehicle_brand.trim(),
    vehicle_model: '',
    card_number: '',
    parking_area: '',
    registered_at: new Date().toISOString().slice(0, 10),
    effective_from: null,
    effective_to: null,
    status: 'active',
    notes: '',
  };
}

interface Props {
  employee: HrEmployee;
  onListChange?: () => void;
}

const ParkingRegistrationSection: React.FC<Props> = ({ employee, onListChange }) => {
  const [list, setList] = useState<HrParkingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [vehicleType, setVehicleType] = useState<HrParkingVehicleType>('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [color, setColor] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.fetchParkingRegistrations(employee.id);
      setList(data);
    } catch (e) {
      console.error(e);
      alert('Không tải được đăng ký gửi xe.');
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      alert('Vui lòng nhập biển số xe.');
      return;
    }
    if (!color.trim()) {
      alert('Vui lòng nhập màu xe.');
      return;
    }
    const payload = buildParkingPayload(employee.id, vehicleType, plate, color, vehicleBrand);
    setSaving(true);
    try {
      if (editingId === 'new') {
        await svc.saveParkingRegistration(payload);
      } else if (editingId) {
        await svc.updateParkingRegistration(editingId, {
          vehicle_type: payload.vehicle_type,
          license_plate: payload.license_plate,
          color: payload.color,
          vehicle_brand: payload.vehicle_brand,
          vehicle_model: '',
          card_number: '',
          parking_area: '',
          registered_at: payload.registered_at,
          effective_from: null,
          effective_to: null,
          status: 'active',
          notes: '',
        });
      }
      setEditingId(null);
      await reload();
      onListChange?.();
    } catch (err: any) {
      alert(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteParkingRegistration(id);
      setConfirmDelete(null);
      await reload();
      onListChange?.();
    } catch (err: any) {
      alert(err.message || 'Xóa thất bại');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-neutral-medium text-sm">
          Đăng ký gửi xe: loại xe, nhãn hiệu, màu, biển số. Nhân viên có thể tự khai trên Employee Portal.
        </p>
        {!editingId && (
          <button
            type="button"
            onClick={startNew}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
          >
            + Thêm xe
          </button>
        )}
      </div>

      {editingId && (
        <div className="rounded-[20px] border border-primary/20 bg-surface p-6 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">
            {editingId === 'new' ? 'Đăng ký mới' : 'Sửa đăng ký'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Loại xe</label>
              <select
                className={inputCls}
                style={{ colorScheme: 'dark' }}
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value as HrParkingVehicleType)}
              >
                {(Object.keys(VEHICLE_LABELS) as HrParkingVehicleType[]).map(k => (
                  <option key={k} value={k}>
                    {VEHICLE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nhãn hiệu xe</label>
              <input
                className={inputCls}
                value={vehicleBrand}
                onChange={e => setVehicleBrand(e.target.value)}
                placeholder="Honda, Yamaha, Toyota…"
              />
            </div>
            <div>
              <label className={labelCls}>Màu xe</label>
              <input
                className={inputCls}
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="Đen, trắng…"
              />
            </div>
            <div>
              <label className={labelCls}>Biển số</label>
              <input
                className={inputCls}
                value={licensePlate}
                onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="59A1-123.45"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' }}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase border border-white/10 text-neutral-medium"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && !editingId ? (
        <p className="text-neutral-medium text-sm text-center py-12">Chưa có đăng ký gửi xe.</p>
      ) : (
        !editingId && (
          <div className="space-y-3">
            {list.map(r => (
              <div
                key={r.id}
                className="rounded-[16px] border border-primary/10 bg-surface p-5 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-white font-bold">
                    {VEHICLE_LABELS[r.vehicle_type]}{r.vehicle_brand ? ` · ${r.vehicle_brand}` : ''} — <span className="text-cyan-400">{r.license_plate}</span>
                  </p>
                  <p className="text-neutral-medium text-xs mt-1">Màu: {r.color || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}
                  >
                    Sửa
                  </button>
                  {confirmDelete === r.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #FF453A, #FF375F)' }}
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-neutral-medium"
                      >
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-500/20"
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

export default ParkingRegistrationSection;
