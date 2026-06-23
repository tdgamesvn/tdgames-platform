import React, { useState, useEffect } from 'react';
import { Worker, WorkerContract } from '@/types';

interface WorkerFormProps {
  editingWorker: Worker | null;
  contracts: WorkerContract[];
  loadContracts: (workerId: string) => void;
  onSave: (w: Omit<Worker, 'id' | 'created_at'>) => void;
  onUpdate: (id: string, updates: Partial<Worker>) => void;
  onCancel: () => void;
  onSaveContract: (c: Omit<WorkerContract, 'id' | 'created_at'>) => void;
  onUpdateContract: (id: string, updates: Partial<WorkerContract>) => void;
  onDeleteContract: (id: string) => void;
}

const emptyWorker: Omit<Worker, 'id' | 'created_at'> = {
  full_name: '', email: '', phone: '', type: 'freelancer',
  bank_name: '', bank_account: '', tax_code: '', notes: '', is_active: true,
};

const emptyContract: Omit<WorkerContract, 'id' | 'created_at'> = {
  worker_id: '', title: '', start_date: new Date().toISOString().split('T')[0],
  end_date: null, rate_type: 'per_task', rate_amount: 0, currency: 'VND',
  status: 'active', notes: '',
};

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";
const btnPrimary = "flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02] active:scale-[0.98]";
const btnSecondary = "flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest border border-primary/10 text-neutral-medium hover:text-white hover:border-primary/30 transition-all";

const WorkerForm: React.FC<WorkerFormProps> = ({
  editingWorker, contracts, loadContracts,
  onSave, onUpdate, onCancel,
  onSaveContract, onUpdateContract, onDeleteContract,
}) => {
  const [form, setForm] = useState(emptyWorker);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [showContractForm, setShowContractForm] = useState(false);
  const isEdit = !!editingWorker;

  useEffect(() => {
    if (editingWorker) {
      setForm({
        full_name: editingWorker.full_name, email: editingWorker.email,
        phone: editingWorker.phone, type: editingWorker.type,
        bank_name: editingWorker.bank_name, bank_account: editingWorker.bank_account,
        tax_code: editingWorker.tax_code, notes: editingWorker.notes,
        is_active: editingWorker.is_active,
      });
      loadContracts(editingWorker.id!);
    } else {
      setForm(emptyWorker);
    }
  }, [editingWorker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    if (isEdit) {
      onUpdate(editingWorker!.id!, form);
    } else {
      onSave(form);
    }
  };

  const handleContractSubmit = () => {
    if (!contractForm.title.trim() || !editingWorker) return;
    onSaveContract({ ...contractForm, worker_id: editingWorker.id! });
    setContractForm({ ...emptyContract, worker_id: editingWorker.id! });
    setShowContractForm(false);
  };

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">
          {isEdit ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự'}
        </h2>
        <p className="text-neutral-medium text-sm mt-1">
          {isEdit ? `Cập nhật thông tin — ${editingWorker!.full_name}` : 'Nhập thông tin nhân sự mới'}
        </p>
      </div>

      {/* Worker Form */}
      <form onSubmit={handleSubmit} className="rounded-[20px] border border-primary/10 bg-surface p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Họ tên *</label>
            <input className={inputCls} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" required />
          </div>
          <div>
            <label className={labelCls}>Loại nhân sự</label>
            <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              <option value="freelancer">Freelancer</option>
              <option value="inhouse">Inhouse</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div>
            <label className={labelCls}>Số điện thoại</label>
            <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0912 345 678" />
          </div>
          <div>
            <label className={labelCls}>Ngân hàng</label>
            <input className={inputCls} value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="MB Bank" />
          </div>
          <div>
            <label className={labelCls}>Số tài khoản</label>
            <input className={inputCls} value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} placeholder="12345678" />
          </div>
          <div>
            <label className={labelCls}>Mã số thuế</label>
            <input className={inputCls} value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))} placeholder="MST" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ghi chú</label>
          <textarea className={inputCls + " min-h-[80px] resize-none"} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ghi chú thêm..." />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>Huỷ</button>
          <button type="submit" className={btnPrimary}>
            {isEdit ? '💾 Cập nhật' : '✚ Thêm nhân sự'}
          </button>
        </div>
      </form>

      {/* Contracts Section (only for editing) */}
      {isEdit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Hợp đồng</h3>
            <button
              onClick={() => setShowContractForm(!showContractForm)}
              className="text-xs font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors"
            >
              {showContractForm ? '✕ Đóng' : '✚ Thêm hợp đồng'}
            </button>
          </div>

          {/* Contract Add Form */}
          {showContractForm && (
            <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tên hợp đồng *</label>
                  <input className={inputCls} value={contractForm.title} onChange={e => setContractForm(c => ({ ...c, title: e.target.value }))} placeholder="HĐ tháng 3/2026" />
                </div>
                <div>
                  <label className={labelCls}>Loại rate</label>
                  <select className={inputCls} value={contractForm.rate_type} onChange={e => setContractForm(c => ({ ...c, rate_type: e.target.value as any }))}>
                    <option value="per_task">Per Task</option>
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mức giá</label>
                  <input type="number" className={inputCls} value={contractForm.rate_amount} onChange={e => setContractForm(c => ({ ...c, rate_amount: +e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Tiền tệ</label>
                  <select className={inputCls} value={contractForm.currency} onChange={e => setContractForm(c => ({ ...c, currency: e.target.value }))}>
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ngày bắt đầu</label>
                  <input type="date" className={inputCls} value={contractForm.start_date} onChange={e => setContractForm(c => ({ ...c, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Ngày kết thúc</label>
                  <input type="date" className={inputCls} value={contractForm.end_date || ''} onChange={e => setContractForm(c => ({ ...c, end_date: e.target.value || null }))} />
                </div>
              </div>
              <button type="button" onClick={handleContractSubmit} className="py-3 px-8 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow transition-all hover:shadow-btn-glow-hover">
                ✚ Thêm hợp đồng
              </button>
            </div>
          )}

          {/* Contract List */}
          {contracts.length === 0 ? (
            <p className="text-neutral-medium text-sm text-center py-8">Chưa có hợp đồng</p>
          ) : (
            <div className="space-y-3">
              {contracts.map(c => (
                <div key={c.id} className="group relative rounded-[16px] border border-primary/10 bg-surface p-4 flex items-center justify-between hover:border-primary/30 transition-all">
                  <div>
                    <p className="text-white font-bold text-sm">{c.title}</p>
                    <p className="text-neutral-medium text-xs mt-1">
                      {c.rate_type === 'per_task' ? 'Per Task' : c.rate_type === 'monthly' ? 'Monthly' : 'Hourly'} — {c.rate_amount.toLocaleString()} {c.currency}
                    </p>
                    <p className="text-neutral-medium/60 text-[11px] mt-0.5">
                      {c.start_date} → {c.end_date || '∞'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                      c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                      c.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{c.status}</span>
                    <button onClick={() => { if (confirm('Xóa hợp đồng này?')) onDeleteContract(c.id!); }}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-medium hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerForm;
