import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HrEmployee, HrDepartment, HrEquipmentHandover, HrEquipmentHandoverItem } from '@/types';
import * as svc from '../services/hrService';
import EquipmentHandoverPrint from './EquipmentHandoverPrint';

const inputCls =
  'w-full bg-white/5 border border-primary/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/40';
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1 block';

const emptyItem = (): Omit<HrEquipmentHandoverItem, 'id' | 'handover_id'> => ({
  name: '',
  description: '',
  quantity: 1,
  unit: 'cái',
  serial_number: '',
  condition_notes: '',
  sort_order: 0,
});

interface Props {
  employee: HrEmployee;
  department: HrDepartment | undefined;
  onListChange?: () => void;
}

const EquipmentHandoverSection: React.FC<Props> = ({ employee, department, onListChange }) => {
  const [list, setList] = useState<HrEquipmentHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [printHandover, setPrintHandover] = useState<HrEquipmentHandover | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const signedPdfInputRef = useRef<HTMLInputElement>(null);
  const pendingHandoverIdRef = useRef<string | null>(null);
  const [uploadingPdfHandoverId, setUploadingPdfHandoverId] = useState<string | null>(null);

  const editingHandoverSnapshot =
    editingId && editingId !== 'new' ? list.find(h => h.id === editingId) : undefined;

  const triggerSignedPdfUpload = (handoverId: string) => {
    pendingHandoverIdRef.current = handoverId;
    signedPdfInputRef.current?.click();
  };

  const handleSignedPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const hid = pendingHandoverIdRef.current;
    e.target.value = '';
    pendingHandoverIdRef.current = null;
    if (!file || !hid) return;
    if (!file.type.includes('pdf')) {
      alert('Vui lòng chọn file PDF.');
      return;
    }
    setUploadingPdfHandoverId(hid);
    try {
      const { url } = await svc.uploadFileToR2(file);
      await svc.updateEquipmentHandover(hid, employee.id, { file_url: url });
      await reload();
      onListChange?.();
    } catch (err: any) {
      alert(err.message || 'Upload thất bại');
    } finally {
      setUploadingPdfHandoverId(null);
    }
  };

  const [form, setForm] = useState({
    handover_number: '',
    handover_date: new Date().toISOString().slice(0, 10),
    status: 'draft' as HrEquipmentHandover['status'],
    location: '',
    giver_name: '',
    receiver_ack: '',
    notes: '',
    items: [emptyItem()],
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.fetchEquipmentHandovers(employee.id);
      setList(data);
    } catch (e) {
      console.error(e);
      alert('Không tải được danh sách biên bản bàn giao.');
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetFormNew = () => {
    setForm({
      handover_number: `BBBG-${new Date().getFullYear()}-${String(list.length + 1).padStart(3, '0')}`,
      handover_date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      location: '',
      giver_name: '',
      receiver_ack: '',
      notes: '',
      items: [emptyItem()],
    });
    setEditingId('new');
  };

  const startEdit = (h: HrEquipmentHandover) => {
    setForm({
      handover_number: h.handover_number,
      handover_date: h.handover_date.slice(0, 10),
      status: h.status,
      location: h.location,
      giver_name: h.giver_name,
      receiver_ack: h.receiver_ack,
      notes: h.notes,
      items:
        h.items && h.items.length
          ? h.items.map(i => ({
              name: i.name,
              description: i.description,
              quantity: Number(i.quantity),
              unit: i.unit,
              serial_number: i.serial_number,
              condition_notes: i.condition_notes,
              sort_order: i.sort_order,
            }))
          : [emptyItem()],
    });
    setEditingId(h.id);
  };

  const save = async () => {
    const cleanItems = form.items.filter(i => i.name.trim());
    if (!form.giver_name.trim()) {
      alert('Vui lòng nhập tên người / bộ phận bàn giao.');
      return;
    }
    setSaving(true);
    try {
      if (editingId === 'new') {
        await svc.saveEquipmentHandover({
          employee_id: employee.id,
          handover_number: form.handover_number,
          handover_date: form.handover_date,
          status: form.status,
          location: form.location,
          giver_name: form.giver_name,
          receiver_ack: form.receiver_ack,
          notes: form.notes,
          file_url: '',
          items: cleanItems,
        });
      } else if (editingId) {
        await svc.updateEquipmentHandover(editingId, employee.id, {
          handover_number: form.handover_number,
          handover_date: form.handover_date,
          status: form.status,
          location: form.location,
          giver_name: form.giver_name,
          receiver_ack: form.receiver_ack,
          notes: form.notes,
          items: cleanItems,
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
      await svc.deleteEquipmentHandover(id);
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
      <input
        ref={signedPdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-hidden
        onChange={handleSignedPdfChange}
      />
      <p className="text-neutral-medium text-xs rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <span className="text-emerald-400/90 font-bold">PDF đã ký:</span> In biên bản → các bên ký → upload file PDF đã ký vào đúng biên bản để lưu trữ, xem lại và tải về khi cần.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-neutral-medium text-sm">
          Lưu biên bản bàn giao thiết bị / dụng cụ; in để ký và lưu hồ sơ.
        </p>
        {!editingId && (
          <button
            type="button"
            onClick={resetFormNew}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase text-white"
            style={{ background: 'linear-gradient(135deg, #34C759, #30D158)' }}
          >
            + Tạo biên bản
          </button>
        )}
      </div>

      {editingId && (
        <div className="rounded-[20px] border border-primary/20 bg-surface p-6 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
            {editingId === 'new' ? 'Biên bản mới' : 'Chỉnh sửa biên bản'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Số biên bản</label>
              <input
                className={inputCls}
                value={form.handover_number}
                onChange={e => setForm(f => ({ ...f, handover_number: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Ngày lập</label>
              <input
                type="date"
                className={inputCls}
                style={{ colorScheme: 'dark' }}
                value={form.handover_date}
                onChange={e => setForm(f => ({ ...f, handover_date: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Địa điểm bàn giao</label>
              <input
                className={inputCls}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Văn phòng / kho / …"
              />
            </div>
            <div>
              <label className={labelCls}>Bên giao (họ tên / BP)</label>
              <input
                className={inputCls}
                value={form.giver_name}
                onChange={e => setForm(f => ({ ...f, giver_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Trạng thái hồ sơ</label>
              <select
                className={inputCls}
                style={{ colorScheme: 'dark' }}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as HrEquipmentHandover['status'] }))}
              >
                <option value="draft">Nháp</option>
                <option value="signed">Đã ký</option>
                <option value="returned">Đã hoàn trả</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Ghi chú</label>
              <input
                className={inputCls}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Xác nhận phía nhận (tùy chọn, in lên biên bản)</label>
              <input
                className={inputCls}
                value={form.receiver_ack}
                onChange={e => setForm(f => ({ ...f, receiver_ack: e.target.value }))}
                placeholder="Đã nhận đủ theo danh mục…"
              />
            </div>
          </div>

          <div>
            <p className={labelCls + ' mt-2'}>Danh mục tài sản / dụng cụ</p>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
                >
                  <div className="md:col-span-4">
                    <input
                      className={inputCls}
                      placeholder="Tên (*)"
                      value={it.name}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], name: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={inputCls}
                      placeholder="SL"
                      value={it.quantity}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], quantity: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      className={inputCls}
                      placeholder="ĐVT"
                      value={it.unit}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], unit: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <input
                      className={inputCls}
                      placeholder="Số seri / mã"
                      value={it.serial_number}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], serial_number: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-6">
                    <input
                      className={inputCls}
                      placeholder="Mô tả ngắn"
                      value={it.description}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], description: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <input
                      className={inputCls}
                      placeholder="Tình trạng khi bàn giao"
                      value={it.condition_notes}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => {
                          const items = [...f.items];
                          items[idx] = { ...items[idx], condition_notes: v };
                          return { ...f, items };
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      className="w-full py-2 rounded-lg text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10"
                      onClick={() =>
                        setForm(f => ({
                          ...f,
                          items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items,
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-primary hover:underline"
                onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}
              >
                + Thêm dòng
              </button>
            </div>
          </div>

          {editingId !== 'new' && editingHandoverSnapshot && (
            <div className="rounded-xl border border-emerald-500/20 bg-white/[0.02] p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">PDF đã ký (lưu trữ)</p>
              {editingHandoverSnapshot.file_url ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <a
                    href={svc.toPublicUrl(editingHandoverSnapshot.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline font-bold"
                  >
                    Mở xem PDF
                  </a>
                  <a
                    href={svc.toPublicUrl(editingHandoverSnapshot.file_url)}
                    download
                    className="text-xs text-cyan-400 hover:underline font-bold"
                  >
                    Tải về
                  </a>
                  <button
                    type="button"
                    onClick={() => triggerSignedPdfUpload(editingHandoverSnapshot.id)}
                    disabled={uploadingPdfHandoverId === editingHandoverSnapshot.id}
                    className="text-xs font-bold text-amber-400 hover:underline disabled:opacity-50"
                  >
                    {uploadingPdfHandoverId === editingHandoverSnapshot.id ? 'Đang upload…' : 'Thay PDF đã ký'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerSignedPdfUpload(editingHandoverSnapshot.id)}
                  disabled={uploadingPdfHandoverId === editingHandoverSnapshot.id}
                  className="text-xs font-black px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {uploadingPdfHandoverId === editingHandoverSnapshot.id ? '⏳ Đang upload…' : '📤 Upload PDF đã ký'}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
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
        <p className="text-neutral-medium text-sm text-center py-12">Chưa có biên bản bàn giao.</p>
      ) : (
        !editingId && (
          <div className="space-y-3">
            {list.map(h => (
              <div key={h.id} className="rounded-[16px] border border-primary/10 bg-surface p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold">
                    {h.handover_number || 'Biên bản'} — {h.handover_date.slice(0, 10)}
                  </p>
                  <p className="text-neutral-medium text-xs mt-1">
                    Bên giao: {h.giver_name || '—'} · {h.items?.length || 0} mục
                  </p>
                  {h.file_url ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="text-[10px] font-bold text-emerald-400/90">📄 Đã lưu PDF đã ký</span>
                      <a
                        href={svc.toPublicUrl(h.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-400 hover:underline"
                      >
                        Mở xem
                      </a>
                      <a
                        href={svc.toPublicUrl(h.file_url)}
                        download
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        Tải về
                      </a>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-500/85 mt-2">Chưa có PDF đã ký — upload sau khi các bên ký.</p>
                  )}
                  <span
                    className={`inline-block mt-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      h.status === 'signed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : h.status === 'returned'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-white/10 text-neutral-medium'
                    }`}
                  >
                    {h.status === 'draft' ? 'Nháp' : h.status === 'signed' ? 'Đã ký' : 'Hoàn trả'}
                  </span>
                </div>
                <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => triggerSignedPdfUpload(h.id)}
                    disabled={uploadingPdfHandoverId === h.id}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {uploadingPdfHandoverId === h.id ? '⏳ Đang upload…' : h.file_url ? '📤 Thay PDF đã ký' : '📤 Upload PDF đã ký'}
                  </button>
                  <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setPrintHandover(h)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #34C759, #30D158)' }}
                  >
                    🖨️ In biên bản
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(h)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}
                  >
                    Sửa
                  </button>
                  {confirmDelete === h.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(h.id)}
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
                      onClick={() => setConfirmDelete(h.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-500/20"
                    >
                      Xóa
                    </button>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {printHandover && (
        <EquipmentHandoverPrint
          employee={employee}
          department={department}
          handover={printHandover}
          onClose={() => setPrintHandover(null)}
        />
      )}
    </div>
  );
};

export default EquipmentHandoverSection;
