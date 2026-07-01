import React, { useState, useEffect, useRef } from 'react';
import { HrEmployee, HrDepartment, HrContract, HrSalaryComponent, HrEmployeeSalary, HrDependent, HrDependentDocument, HrPositionHistory, HrChangeRequestType } from '@/types';
import { uploadFileToR2, toPublicUrl } from '../services/hrService';
import * as svc from '../services/hrService';
import { supabase } from '@/services/supabaseClient';
import ChangeRequestForm from './ChangeRequestForm';

interface Props {
  editingEmployee: HrEmployee | null;
  departments: HrDepartment[];
  contracts: HrContract[];
  loadContracts: (employeeId: string) => void;
  onSave: (emp: any) => void;
  onUpdate: (id: string, updates: Partial<HrEmployee>) => void;
  onCancel: () => void;
  onSaveContract: (c: Omit<HrContract, 'id' | 'created_at'>) => void;
  onUpdateContract: (id: string, updates: Partial<HrContract>) => void;
  onDeleteContract: (id: string) => void;
}

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";
const sectionCls = "rounded-[20px] border border-primary/10 bg-surface p-8 space-y-6";

const SPECIALIZATION_OPTIONS = ['2D', '3D', 'VFX', 'Concept Art', 'Animation', 'Storyboard', 'Compositing', 'Rigging', 'Modeling', 'Texturing', 'Lighting', 'Motion Graphics'];

const emptyEmployee = {
  type: 'fulltime' as const,
  status: 'active' as const,
  full_name: '', avatar_url: '', email: '', work_email: '', phone: '',
  date_of_birth: null as string | null, gender: '', nationality: 'Vietnam', address: '', temp_address: '',
  // FT
  id_number: '', id_issue_date: null as string | null, id_issue_place: '',
  id_card_front_url: '', id_card_back_url: '',
  tax_code: '', insurance_number: '',
  department_id: null as string | null, position: '', level: '',
  salary: 0, salary_currency: 'VND',
  start_date: null as string | null, probation_end: null as string | null, official_date: null as string | null,
  // FL
  portfolio_url: '', specializations: [] as string[], timezone: 'UTC+7',
  rate_type: '', rate_amount: 0, rate_currency: 'USD',
  payment_method: '', payment_details: {} as Record<string, any>,
  // Discord
  discord_user_id: '',
  // Bank
  bank_name: '', bank_account: '', bank_branch: '',
  // Vehicle
  vehicle_type: '', license_plate: '', vehicle_brand: '', vehicle_color: '',
  // Meta
  notes: '', tags: [] as string[],
};

const VEHICLE_LABELS: Record<string, string> = {
  '': '-- Không có --',
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};

const emptyContract: Omit<HrContract, 'id' | 'created_at'> = {
  employee_id: '', contract_type: 'labor', title: '', contract_number: '',
  start_date: new Date().toISOString().split('T')[0], end_date: null,
  salary: 0, currency: 'VND', rate_type: '', rate_amount: 0,
  file_url: '', status: 'active', notes: '',
};

const EmployeeForm: React.FC<Props> = ({
  editingEmployee, departments, contracts, loadContracts,
  onSave, onUpdate, onCancel,
  onSaveContract, onUpdateContract, onDeleteContract,
}) => {
  const [form, setForm] = useState<typeof emptyEmployee>(emptyEmployee);
  const [tagInput, setTagInput] = useState('');
  const [contractForm, setContractForm] = useState(emptyContract);
  const [showContractForm, setShowContractForm] = useState(false);
  const [pendingContractPdf, setPendingContractPdf] = useState<File | null>(null);
  const contractListPdfInputRef = useRef<HTMLInputElement>(null);
  const pendingListContractIdRef = useRef<string | null>(null);
  const [uploadingContractPdfId, setUploadingContractPdfId] = useState<string | null>(null);
  const isEdit = !!editingEmployee;
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [workEmailError, setWorkEmailError] = useState('');

  // Required fields definition per employee type
  const requiredFields: { key: string; label: string }[] = [
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email cá nhân' },
    ...(form.type === 'freelancer' ? [
      // Freelancer: chỉ bắt buộc full_name + email, còn lại tuỳ chọn
    ] : form.type === 'fulltime' ? [
      { key: 'phone', label: 'SĐT' },
      { key: 'date_of_birth', label: 'Ngày sinh' },
      { key: 'gender', label: 'Giới tính' },
      { key: 'address', label: 'Địa chỉ thường trú' },
      { key: 'id_number', label: 'CMND/CCCD' },
      { key: 'work_email', label: 'Email công việc' },
      { key: 'temp_address', label: 'Địa chỉ tạm trú' },
      { key: 'id_issue_date', label: 'Ngày cấp CMND' },
      { key: 'id_issue_place', label: 'Nơi cấp' },
      { key: 'department_id', label: 'Phòng ban' },
      { key: 'position', label: 'Chức danh' },
      { key: 'start_date', label: 'Ngày bắt đầu' },
    ] : [
      // parttime
      { key: 'phone', label: 'SĐT' },
      { key: 'date_of_birth', label: 'Ngày sinh' },
      { key: 'gender', label: 'Giới tính' },
      { key: 'address', label: 'Địa chỉ thường trú' },
      { key: 'id_number', label: 'CMND/CCCD' },
      { key: 'work_email', label: 'Email công việc' },
      { key: 'temp_address', label: 'Địa chỉ tạm trú' },
      { key: 'id_issue_date', label: 'Ngày cấp CMND' },
      { key: 'id_issue_place', label: 'Nơi cấp' },
      { key: 'department_id', label: 'Phòng ban' },
      { key: 'position', label: 'Chức danh' },
      { key: 'start_date', label: 'Ngày bắt đầu' },
    ]),
  ];
  const missingRequired = requiredFields.filter(f => {
    const val = (form as any)[f.key];
    return !val || (typeof val === 'string' && !val.trim());
  });
  const isFieldMissing = (key: string) => showValidation && missingRequired.some(f => f.key === key);
  const reqStar = (key: string) => requiredFields.some(f => f.key === key) ? ' *' : '';

  // Salary components state
  const [salaryComponents, setSalaryComponents] = useState<HrSalaryComponent[]>([]);
  const [salaryAmounts, setSalaryAmounts] = useState<Record<string, number>>({});
  const [existingSalaryIds, setExistingSalaryIds] = useState<Record<string, string>>({});
  const [loadingSalary, setLoadingSalary] = useState(false);

  // Dependents state
  const [dependents, setDependents] = useState<HrDependent[]>([]);
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [expandedDepId, setExpandedDepId] = useState<string | null>(null);
  const [confirmDeleteDepId, setConfirmDeleteDepId] = useState<string | null>(null);
  const [depForm, setDepForm] = useState({ full_name: '', relationship: 'child' as string, date_of_birth: '', id_number: '', tax_code: '', deduction_from: '', deduction_to: '', notes: '' });
  const [uploadingDocDepId, setUploadingDocDepId] = useState<string | null>(null);
  const [docUploadType, setDocUploadType] = useState('cccd');
  const depDocRef = useRef<HTMLInputElement>(null);

  // Change request form state
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [changeRequestType, setChangeRequestType] = useState<HrChangeRequestType | null>(null);

  // Photo upload state
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  const handlePhotoUpload = async (field: 'avatar_url' | 'id_card_front_url' | 'id_card_back_url', file: File) => {
    const setLoading = field === 'avatar_url' ? setUploadingAvatar : field === 'id_card_front_url' ? setUploadingFront : setUploadingBack;
    const ref = field === 'avatar_url' ? avatarFileRef : field === 'id_card_front_url' ? frontFileRef : backFileRef;
    setLoading(true);
    try {
      const result = await uploadFileToR2(file);
      setForm(f => ({ ...f, [field]: result.url }));
    } catch (err: any) { alert('Upload th\u1ea5t b\u1ea1i: ' + (err.message || '')); }
    finally { setLoading(false); if (ref.current) ref.current.value = ''; }
  };

  // Load salary components
  useEffect(() => {
    const loadComps = async () => {
      setLoadingSalary(true);
      try {
        const comps = await svc.fetchSalaryComponents();
        setSalaryComponents(comps.filter(c => c.is_active));
      } catch {}
      finally { setLoadingSalary(false); }
    };
    loadComps();
  }, []);

  useEffect(() => {
    if (editingEmployee) {
      // Load existing salary data for this employee
      const loadEmpSalary = async () => {
        try {
          const items = await svc.fetchEmployeeSalary(editingEmployee.id);
          const amounts: Record<string, number> = {};
          const ids: Record<string, string> = {};
          // Only use currently-active salary records (effective_to is null)
          items.filter(it => !it.effective_to).forEach(it => { amounts[it.component_id] = it.amount; ids[it.component_id] = it.id; });
          setSalaryAmounts(amounts);
          setExistingSalaryIds(ids);
        } catch {}
      };
      loadEmpSalary();

      // Load dependents
      svc.fetchDependents(editingEmployee.id).then(setDependents).catch(() => {});

      setForm({
        type: editingEmployee.type,
        status: editingEmployee.status,
        full_name: editingEmployee.full_name || '',
        avatar_url: editingEmployee.avatar_url || '',
        email: editingEmployee.email || '',
        work_email: editingEmployee.work_email || '',
        phone: editingEmployee.phone || '',
        date_of_birth: editingEmployee.date_of_birth,
        gender: editingEmployee.gender || '',
        nationality: editingEmployee.nationality || 'Vietnam',
        address: editingEmployee.address || '',
        temp_address: editingEmployee.temp_address || '',
        id_number: editingEmployee.id_number || '',
        id_issue_date: editingEmployee.id_issue_date,
        id_issue_place: editingEmployee.id_issue_place || '',
        id_card_front_url: editingEmployee.id_card_front_url || '',
        id_card_back_url: editingEmployee.id_card_back_url || '',
        tax_code: editingEmployee.tax_code || '',
        insurance_number: editingEmployee.insurance_number || '',
        department_id: editingEmployee.department_id,
        position: editingEmployee.position || '',
        level: editingEmployee.level || '',
        salary: editingEmployee.salary || 0,
        salary_currency: editingEmployee.salary_currency || 'VND',
        start_date: editingEmployee.start_date,
        probation_end: editingEmployee.probation_end,
        official_date: editingEmployee.official_date,
        portfolio_url: editingEmployee.portfolio_url || '',
        specializations: editingEmployee.specializations || [],
        timezone: editingEmployee.timezone || 'UTC+7',
        rate_type: editingEmployee.rate_type || '',
        rate_amount: editingEmployee.rate_amount || 0,
        rate_currency: editingEmployee.rate_currency || 'USD',
        payment_method: editingEmployee.payment_method || '',
        payment_details: editingEmployee.payment_details || {},
        discord_user_id: editingEmployee.discord_user_id || '',
        bank_name: editingEmployee.bank_name || '',
        bank_account: editingEmployee.bank_account || '',
        bank_branch: editingEmployee.bank_branch || '',
        notes: editingEmployee.notes || '',
        tags: editingEmployee.tags || [],
        exclude_from_payroll: editingEmployee.exclude_from_payroll || false,
        is_hidden: editingEmployee.is_hidden || false,
      });
      loadContracts(editingEmployee.id);
    } else {
      setForm(emptyEmployee);
      setSalaryAmounts({});
      setExistingSalaryIds({});
      setDependents([]);
    }
  }, [editingEmployee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Prevent double-click
    setShowValidation(true);
    setEmailError('');
    setWorkEmailError('');
    if (missingRequired.length > 0) return;

    // Check duplicate work_email (only for non-freelancer, and only if work_email is non-empty)
    const workEmailVal = (form.work_email || '').trim().toLowerCase();
    if (workEmailVal && (!isEdit || (isEdit && (editingEmployee!.work_email || '') !== workEmailVal))) {
      const { data: existing } = await supabase
        .from('hr_employees')
        .select('id, full_name')
        .eq('work_email', workEmailVal)
        .maybeSingle();
      if (existing && (!isEdit || existing.id !== editingEmployee!.id)) {
        setWorkEmailError(`Email công việc "${form.work_email}" đã tồn tại (${existing.full_name}). Vui lòng dùng email khác.`);
        return;
      }
    }

    setSaving(true);
    try {
      // Calculate total gross from salary components
      const totalGross = (Object.values(salaryAmounts) as number[]).reduce((s, v) => s + (v || 0), 0);
      const formWithSalary = { ...form, salary: totalGross };

      if (isEdit) {
        // Upsert salary records first
        for (const comp of salaryComponents) {
          const amt = salaryAmounts[comp.id] || 0;
          const existingId = existingSalaryIds[comp.id];
          try {
            if (existingId) {
              await svc.updateEmployeeSalary(existingId, { amount: amt });
            } else if (amt > 0) {
              await svc.saveEmployeeSalary({
                employee_id: editingEmployee!.id, component_id: comp.id,
                amount: amt, note: '', effective_from: new Date().toISOString().split('T')[0], effective_to: null,
              });
            }
          } catch {}
        }

        // Normal save + navigate (sensitive changes go through change request flow)
        onUpdate(editingEmployee!.id, formWithSalary);
      } else {
        // For new employee, pass salary amounts so parent can save after employee is created
        (formWithSalary as any)._salaryAmounts = salaryAmounts;
        onSave(formWithSalary);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSpec = (spec: string) => {
    setForm(f => ({
      ...f,
      specializations: f.specializations.includes(spec)
        ? f.specializations.filter(s => s !== spec)
        : [...f.specializations, spec],
    }));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
      setTagInput('');
    }
  };

  const handleContractSubmit = async () => {
    if (!contractForm.title.trim() || !editingEmployee) return;
    let file_url = contractForm.file_url;
    if (pendingContractPdf) {
      if (!pendingContractPdf.type.includes('pdf')) {
        alert('File đính kèm phải là PDF.');
        return;
      }
      try {
        const r = await uploadFileToR2(pendingContractPdf);
        file_url = r.url;
      } catch (e: any) {
        alert(e.message || 'Upload PDF thất bại');
        return;
      }
    }
    onSaveContract({ ...contractForm, employee_id: editingEmployee.id, file_url });
    setContractForm({ ...emptyContract, employee_id: editingEmployee.id });
    setPendingContractPdf(null);
    setShowContractForm(false);
  };

  const triggerListContractPdf = (contractId: string) => {
    pendingListContractIdRef.current = contractId;
    contractListPdfInputRef.current?.click();
  };

  const handleListContractPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const cid = pendingListContractIdRef.current;
    e.target.value = '';
    pendingListContractIdRef.current = null;
    if (!file || !cid || !editingEmployee) return;
    if (!file.type.includes('pdf')) {
      alert('Vui lòng chọn file PDF.');
      return;
    }
    setUploadingContractPdfId(cid);
    try {
      const { url } = await uploadFileToR2(file);
      await onUpdateContract(cid, { file_url: url });
      loadContracts(editingEmployee.id);
    } catch (err: any) {
      alert(err.message || 'Upload thất bại');
    } finally {
      setUploadingContractPdfId(null);
    }
  };

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF375F' }}>
          {isEdit ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}
        </h2>
        <p className="text-neutral-medium text-sm mt-1">
          {isEdit ? `Cập nhật — ${editingEmployee!.full_name} (${editingEmployee!.employee_code})` : 'Nhập thông tin nhân sự mới'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Section: Basic Info ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Thông tin cơ bản</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Họ tên{reqStar('full_name')}</label>
              <input className={inputCls} style={isFieldMissing('full_name') ? { borderColor: '#FF453A' } : {}} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className={labelCls}>Loại nhân sự *</label>
              <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                <option value="fulltime">Fulltime</option>
                <option value="freelancer">Freelancer</option>
                <option value="parttime">Part-time</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Trạng thái</label>
              <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                <option value="active">Đang làm việc</option>
                <option value="inactive">Nghỉ việc</option>
                <option value="offboarded">Offboarded</option>
                <option value="blacklist">Blacklist</option>
              </select>
            </div>
            <div className="flex flex-col justify-center">
              <label className={labelCls}>Bảng lương</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-orange-500"
                  checked={!!(form as any).exclude_from_payroll}
                  onChange={e => setForm(f => ({ ...f, exclude_from_payroll: e.target.checked }))}
                />
                <span className="text-xs text-neutral-medium">Không tính lương tự động</span>
              </label>
              {(form as any).exclude_from_payroll && (
                <p className="text-[10px] text-orange-400 mt-1">⚠️ NV này sẽ không xuất hiện trong bảng lương mới</p>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <label className={labelCls}>Danh bạ</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-orange-500"
                  checked={!!(form as any).is_hidden}
                  onChange={e => setForm(f => ({ ...f, is_hidden: e.target.checked }))}
                />
                <span className="text-xs text-neutral-medium">Ẩn khỏi danh bạ</span>
              </label>
              {(form as any).is_hidden && (
                <p className="text-[10px] text-blue-400 mt-1">👻 NV này không hiển thị trong Company Hub</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Email cá nhân{reqStar('email')}</label>
              <input className={inputCls} style={isFieldMissing('email') || emailError ? { borderColor: '#FF453A' } : {}} value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setEmailError(''); }} placeholder="email.canhan@gmail.com" />
              {emailError && <p className="text-red-400 text-xs mt-1 font-bold">⚠️ {emailError}</p>}
            </div>
            <div>
              <label className={labelCls}>Email công việc{reqStar('work_email')}{form.type === 'freelancer' ? ' (tuỳ chọn)' : ''}</label>
              <input className={inputCls} style={isFieldMissing('work_email') || workEmailError ? { borderColor: '#FF453A' } : {}} value={form.work_email} onChange={e => { setForm(f => ({ ...f, work_email: e.target.value })); setWorkEmailError(''); }} placeholder="ten@tdgamestudio.com" />
              {workEmailError && <p className="text-red-400 text-xs mt-1 font-bold">⚠️ {workEmailError}</p>}
            </div>
            <div>
              <label className={labelCls}>Số điện thoại{reqStar('phone')}</label>
              <input className={inputCls} style={isFieldMissing('phone') ? { borderColor: '#FF453A' } : {}} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0912 345 678" />
            </div>
            <div>
              <label className={labelCls}>Discord User ID</label>
              <input className={inputCls} value={(form as any).discord_user_id || ''} onChange={e => setForm(f => ({ ...f, discord_user_id: e.target.value }))} placeholder="VD: 123456789012345678" />
              <p className="text-neutral-600 text-[10px] mt-1">Dùng cho thông báo chấm công qua Discord</p>
            </div>
            <div>
              <label className={labelCls}>Ngày sinh{reqStar('date_of_birth')}</label>
              <input type="date" className={inputCls} style={isFieldMissing('date_of_birth') ? { borderColor: '#FF453A' } : {}} value={form.date_of_birth || ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value || null }))} />
            </div>
            <div>
              <label className={labelCls}>Giới tính{reqStar('gender')}</label>
              <select className={inputCls} style={isFieldMissing('gender') ? { borderColor: '#FF453A' } : {}} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">-- Chọn --</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            {form.type !== 'freelancer' && (
              <div>
                <label className={labelCls}>Quốc tịch</label>
                <input className={inputCls} value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
              </div>
            )}
            <div className="md:col-span-3">
              <label className={labelCls}>Địa chỉ thường trú{reqStar('address')}</label>
              <input className={inputCls} style={isFieldMissing('address') ? { borderColor: '#FF453A' } : {}} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Số nhà, đường, quận, TP..." />
            </div>
            {form.type !== 'freelancer' && (
              <div className="md:col-span-3">
                <label className={labelCls}>Địa chỉ tạm trú{reqStar('temp_address')}</label>
                <input className={inputCls} style={isFieldMissing('temp_address') ? { borderColor: '#FF453A' } : {}} value={form.temp_address} onChange={e => setForm(f => ({ ...f, temp_address: e.target.value }))} placeholder="Nếu giống thường trú, điền lại" />
              </div>
            )}
          </div>
        </div>

        {/* ── Section: CCCD & Photos ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">
            {form.type === 'freelancer' ? '🪪 CMND / CCCD' : '🪪 CMND / CCCD & Ảnh nhân sự'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Số CMND/CCCD{reqStar('id_number')}</label>
              <input className={inputCls} style={isFieldMissing('id_number') ? { borderColor: '#FF453A' } : {}} value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Ngày cấp{reqStar('id_issue_date')}</label>
              <input type="date" className={inputCls} style={isFieldMissing('id_issue_date') ? { borderColor: '#FF453A' } : {}} value={form.id_issue_date || ''} onChange={e => setForm(f => ({ ...f, id_issue_date: e.target.value || null }))} />
            </div>
            <div>
              <label className={labelCls}>Nơi cấp{reqStar('id_issue_place')}</label>
              <input className={inputCls} style={isFieldMissing('id_issue_place') ? { borderColor: '#FF453A' } : {}} value={form.id_issue_place} onChange={e => setForm(f => ({ ...f, id_issue_place: e.target.value }))} />
            </div>
          </div>
          {/* Photo uploads — only for fulltime/parttime */}
          {form.type !== 'freelancer' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {/* Avatar */}
              <div>
                <label className={labelCls}>Ảnh nhân sự</label>
                <input type="file" ref={avatarFileRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('avatar_url', f); }} />
                {form.avatar_url ? (
                  <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1/1' }}
                    onClick={() => avatarFileRef.current?.click()}>
                    <img src={toPublicUrl(form.avatar_url)} alt="Avatar" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">📷 Đổi ảnh</span>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => avatarFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-primary/40 ${uploadingAvatar ? 'border-primary/30 bg-primary/5' : 'border-primary/10 bg-white/[0.02]'}`}
                    style={{ aspectRatio: '1/1' }}>
                    {uploadingAvatar ? (
                      <><div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" /><span className="text-xs font-bold text-primary">Đang upload...</span></>
                    ) : (
                      <><span className="text-3xl">👤</span><span className="text-xs text-neutral-medium">Upload ảnh nhân sự</span></>
                    )}
                  </div>
                )}
              </div>
              {/* CCCD Front */}
              <div>
                <label className={labelCls}>CCCD Mặt trước</label>
                <input type="file" ref={frontFileRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('id_card_front_url', f); }} />
                {form.id_card_front_url ? (
                  <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1.6/1' }}
                    onClick={() => frontFileRef.current?.click()}>
                    <img src={toPublicUrl(form.id_card_front_url)} alt="CCCD Mặt trước" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">🔄 Thay ảnh</span>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => frontFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-primary/40 ${uploadingFront ? 'border-primary/30 bg-primary/5' : 'border-primary/10 bg-white/[0.02]'}`}
                    style={{ aspectRatio: '1.6/1' }}>
                    {uploadingFront ? (
                      <><div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" /><span className="text-xs font-bold text-primary">Đang upload...</span></>
                    ) : (
                      <><span className="text-3xl">📷</span><span className="text-xs text-neutral-medium">Upload mặt trước</span></>
                    )}
                  </div>
                )}
              </div>
              {/* CCCD Back */}
              <div>
                <label className={labelCls}>CCCD Mặt sau</label>
                <input type="file" ref={backFileRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload('id_card_back_url', f); }} />
                {form.id_card_back_url ? (
                  <div className="relative group rounded-xl overflow-hidden border border-primary/10 cursor-pointer" style={{ aspectRatio: '1.6/1' }}
                    onClick={() => backFileRef.current?.click()}>
                    <img src={toPublicUrl(form.id_card_back_url)} alt="CCCD Mặt sau" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">🔄 Thay ảnh</span>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => backFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-primary/40 ${uploadingBack ? 'border-primary/30 bg-primary/5' : 'border-primary/10 bg-white/[0.02]'}`}
                    style={{ aspectRatio: '1.6/1' }}>
                    {uploadingBack ? (
                      <><div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" /><span className="text-xs font-bold text-primary">Đang upload...</span></>
                    ) : (
                      <><span className="text-3xl">📷</span><span className="text-xs text-neutral-medium">Upload mặt sau</span></>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Section: Fulltime/Parttime-specific ── */}
        {(form.type === 'fulltime' || form.type === 'parttime') && (
          <div className={sectionCls}>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">
              {form.type === 'fulltime' ? '🏢 Thông tin Fulltime' : '🏢 Thông tin Part-time'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelCls}>Mã số thuế cá nhân</label>
                <input className={inputCls} value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))} />
              </div>
              {form.type === 'fulltime' && (
                <div>
                  <label className={labelCls}>Số sổ bảo hiểm</label>
                  <input className={inputCls} value={form.insurance_number} onChange={e => setForm(f => ({ ...f, insurance_number: e.target.value }))} />
                </div>
              )}
              <div>
                <label className={labelCls}>Phòng ban{reqStar('department_id')}</label>
              <select className={inputCls + (isEdit ? ' opacity-60 cursor-not-allowed' : '')} style={isFieldMissing('department_id') ? { borderColor: '#FF453A' } : {}} value={form.department_id || ''} onChange={e => !isEdit && setForm(f => ({ ...f, department_id: e.target.value || null }))} disabled={isEdit}>
                  <option value="">-- Chọn --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Chức danh{reqStar('position')}</label>
              <input className={inputCls + (isEdit ? ' opacity-60 cursor-not-allowed' : '')} style={isFieldMissing('position') ? { borderColor: '#FF453A' } : {}} value={form.position} onChange={e => !isEdit && setForm(f => ({ ...f, position: e.target.value }))} readOnly={isEdit} placeholder="Senior Artist" />
              </div>
              <div>
                <label className={labelCls}>Cấp bậc</label>
                <select className={inputCls + (isEdit ? ' opacity-60 cursor-not-allowed' : '')} value={form.level} onChange={e => !isEdit && setForm(f => ({ ...f, level: e.target.value }))} disabled={isEdit}>
                  <option value="">-- Chọn --</option>
                  <option value="Intern">Intern</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                  <option value="Manager">Manager</option>
                  <option value="Director">Director</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ngày bắt đầu{reqStar('start_date')}</label>
                <input type="date" className={inputCls} style={isFieldMissing('start_date') ? { borderColor: '#FF453A' } : {}} value={form.start_date || ''} onChange={e => {
                  const val = e.target.value || null;
                  setForm(f => {
                    const updated = { ...f, start_date: val };
                    // Auto-calculate probation end = start_date + 2 months, official_date = probation_end + 1
                    if (val) {
                      const d = new Date(val);
                      d.setMonth(d.getMonth() + 2);
                      updated.probation_end = d.toISOString().split('T')[0];
                      const o = new Date(d);
                      o.setDate(o.getDate() + 1);
                      updated.official_date = o.toISOString().split('T')[0];
                    }
                    return updated;
                  });
                }} />
              </div>
              <div>
                <label className={labelCls}>Ngày hết thử việc</label>
                <input type="date" className={inputCls} value={form.probation_end || ''} onChange={e => {
                  const val = e.target.value || null;
                  setForm(f => {
                    const updated = { ...f, probation_end: val };
                    if (val) {
                      const d = new Date(val);
                      d.setDate(d.getDate() + 1);
                      updated.official_date = d.toISOString().split('T')[0];
                    }
                    return updated;
                  });
                }} />
              </div>
              <div>
                <label className={labelCls}>Ngày chính thức</label>
                <input type="date" className={inputCls + (isEdit ? ' opacity-60 cursor-not-allowed' : '')} value={form.official_date || ''} onChange={e => !isEdit && setForm(f => ({ ...f, official_date: e.target.value || null }))} readOnly={isEdit} />
                {!isEdit && <p className="text-[11px] text-neutral-medium/60 mt-1">Mặc định = ngày hết thử việc + 1. Sửa nếu lên chính thức sớm/muộn.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Locked fields banner (edit mode) ── */}
        {isEdit && (form.type === 'fulltime' || form.type === 'parttime') && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/20" style={{ background: 'rgba(255,149,0,0.04)' }}>
            <span className="text-orange-400 text-sm">🔒</span>
            <span className="text-orange-300/80 text-xs font-semibold flex-1">
              Lương, chức vụ, phòng ban chỉ thay đổi qua đơn đề xuất.
            </span>
            <button type="button" onClick={() => setShowChangeRequestForm(true)}
              className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
              Tạo đề xuất
            </button>
          </div>
        )}

        {/* ── Section: Salary Structure (Fulltime/Parttime only) ── */}
        {(form.type === 'fulltime' || form.type === 'parttime') && (
          <div className={sectionCls}>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">💰 Cấu trúc lương</h3>
            {loadingSalary ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="space-y-3">
                  {salaryComponents.map(comp => (
                    <div key={comp.id} className="flex items-center gap-4 p-3 rounded-xl bg-black/20 border border-white/[0.04]">
                      <span className="flex-1 text-white font-bold text-sm">{comp.name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className={'w-40 px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm text-right outline-none focus:border-emerald-500/40 transition-colors' + (isEdit ? ' opacity-60 cursor-not-allowed' : '')}
                          value={salaryAmounts[comp.id] || ''}
                          onChange={e => !isEdit && setSalaryAmounts(prev => ({ ...prev, [comp.id]: +e.target.value }))}
                          readOnly={isEdit}
                          placeholder="0"
                        />
                        <span className="text-neutral-medium text-xs w-8">VNĐ</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Total gross */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-emerald-500/20">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Tổng Gross</span>
                  <div>
                    <span className="text-white font-black text-xl">{(Object.values(salaryAmounts) as number[]).reduce((s, v) => s + (v || 0), 0).toLocaleString()}</span>
                    <span className="text-neutral-medium text-xs ml-1">VNĐ</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Section: Dependents (Fulltime only) ── */}
        {form.type === 'fulltime' && isEdit && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">👨‍👩‍👧‍👦 Người phụ thuộc</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowAddDependent(!showAddDependent)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
                  style={{ background: 'linear-gradient(135deg, #5E5CE6, #0A84FF)' }}>
                  {showAddDependent ? '✕ Đóng' : '+ Thêm NPT'}
                </button>
              </div>
            </div>

            {/* Add dependent form */}
            {showAddDependent && (
              <div className="p-4 rounded-xl bg-black/30 border border-primary/10 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Họ tên *</label>
                    <input className={inputCls} value={depForm.full_name} onChange={e => setDepForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn B" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Quan hệ *</label>
                    <select className={inputCls} value={depForm.relationship} onChange={e => setDepForm(f => ({ ...f, relationship: e.target.value }))}>
                      <option value="child">Con</option>
                      <option value="spouse">Vợ/Chồng</option>
                      <option value="parent">Bố/Mẹ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Ngày sinh</label>
                    <input type="date" className={inputCls} value={depForm.date_of_birth} onChange={e => setDepForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">CMND/CCCD</label>
                    <input className={inputCls} value={depForm.id_number} onChange={e => setDepForm(f => ({ ...f, id_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">MST (nếu có)</label>
                    <input className={inputCls} value={depForm.tax_code} onChange={e => setDepForm(f => ({ ...f, tax_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Giảm trừ từ</label>
                    <input type="date" className={inputCls} value={depForm.deduction_from} onChange={e => setDepForm(f => ({ ...f, deduction_from: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={async () => {
                    if (!depForm.full_name.trim()) return;
                    try {
                      const saved = await svc.saveDependent({
                        employee_id: editingEmployee!.id,
                        full_name: depForm.full_name,
                        relationship: depForm.relationship as any,
                        date_of_birth: depForm.date_of_birth || null,
                        id_number: depForm.id_number,
                        tax_code: depForm.tax_code,
                        deduction_from: depForm.deduction_from || null,
                        deduction_to: depForm.deduction_to || null,
                        status: 'active',
                        notes: depForm.notes,
                      });
                      setDependents(prev => [...prev, saved]);
                      setDepForm({ full_name: '', relationship: 'child', date_of_birth: '', id_number: '', tax_code: '', deduction_from: '', deduction_to: '', notes: '' });
                      setShowAddDependent(false);
                    } catch (err: any) { alert(err.message); }
                  }} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold">💾 Lưu</button>
                  <button type="button" onClick={() => setShowAddDependent(false)} className="px-4 py-2 rounded-lg bg-white/10 text-neutral-medium text-xs font-bold">Hủy</button>
                </div>
              </div>
            )}

            {/* Dependents list */}
            <div className="space-y-3 mt-4">
              {dependents.length === 0 && !showAddDependent && (
                <div className="text-center py-6 opacity-40">
                  <div className="text-3xl mb-2">👨‍👩‍👧‍👦</div>
                  <p className="text-sm">Chưa có người phụ thuộc nào</p>
                </div>
              )}
              {dependents.map(dep => {
                const relLabel = dep.relationship === 'child' ? 'Con' : dep.relationship === 'spouse' ? 'Vợ/Chồng' : dep.relationship === 'parent' ? 'Bố/Mẹ' : 'Khác';
                const isExpanded = expandedDepId === dep.id;
                return (
                  <div key={dep.id} className="rounded-[16px] border border-primary/10 bg-black/20 overflow-hidden">
                    {/* Header row */}
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedDepId(isExpanded ? null : dep.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{dep.relationship === 'child' ? '👶' : dep.relationship === 'spouse' ? '💍' : dep.relationship === 'parent' ? '👴' : '👤'}</span>
                        <div>
                          <p className="text-white font-bold text-sm">{dep.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400">{relLabel}</span>
                            {dep.date_of_birth && <span className="text-neutral-medium text-[10px]">🎂 {dep.date_of_birth}</span>}
                            {dep.id_number && <span className="text-neutral-medium text-[10px]">🆔 {dep.id_number}</span>}
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${dep.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {dep.status === 'active' ? 'Đang GT' : 'Ngưng'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-medium text-xs">{dep.documents?.length || 0} giấy tờ</span>
                        <span className="text-neutral-medium text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded: documents + actions */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-3">
                        {/* Documents list */}
                        {(dep.documents || []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">📄 Giấy tờ đính kèm</p>
                            {dep.documents!.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.04]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 whitespace-nowrap">
                                    {doc.doc_type === 'cccd' ? 'CCCD' : doc.doc_type === 'birth_cert' ? 'Khai sinh' : doc.doc_type === 'residence' ? 'Cư trú' : doc.doc_type === 'student_card' ? 'Thẻ SV' : doc.doc_type === 'disability_cert' ? 'Khuyết tật' : doc.doc_type === 'adoption' ? 'Nhận nuôi' : doc.doc_type === 'income_cert' ? 'Thu nhập' : 'Khác'}
                                  </span>
                                  <a href={toPublicUrl(doc.file_url)} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline truncate">{doc.file_name || 'Xem file'}</a>
                                </div>
                                <button type="button" onClick={async () => {
                                  try { await svc.deleteDependentDocument(doc.id); setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, documents: d.documents?.filter(dd => dd.id !== doc.id) } : d)); } catch {}
                                }} className="text-red-400 hover:text-red-300 text-[10px] font-bold px-2 py-1 rounded hover:bg-red-500/10 transition-all">Xóa</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload document */}
                        <div className="flex items-center gap-2">
                          <input type="file" ref={depDocRef} accept=".jpg,.jpeg,.png,.webp,.pdf" style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingDocDepId(dep.id);
                              try {
                                const result = await uploadFileToR2(file);
                                const saved = await svc.saveDependentDocument({
                                  dependent_id: dep.id, doc_type: docUploadType, file_url: result.url, file_name: file.name, notes: '',
                                });
                                setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, documents: [...(d.documents || []), saved] } : d));
                              } catch (err: any) { alert('Upload lỗi: ' + (err.message || '')); }
                              finally { setUploadingDocDepId(null); if (depDocRef.current) depDocRef.current.value = ''; }
                            }} />
                          <select className="px-2 py-1.5 rounded-lg bg-black/30 border border-primary/10 text-white text-[11px] outline-none"
                            value={docUploadType} onChange={e => setDocUploadType(e.target.value)}>
                            <option value="cccd">CMND/CCCD</option>
                            <option value="birth_cert">Giấy khai sinh</option>
                            <option value="residence">Xác nhận cư trú</option>
                            <option value="student_card">Thẻ sinh viên</option>
                            <option value="disability_cert">XN khuyết tật</option>
                            <option value="adoption">QĐ nhận nuôi</option>
                            <option value="income_cert">XN thu nhập</option>
                            <option value="other">Khác</option>
                          </select>
                          <button type="button" onClick={() => depDocRef.current?.click()}
                            disabled={uploadingDocDepId === dep.id}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-bold hover:bg-blue-500/30 transition-all disabled:opacity-30">
                            {uploadingDocDepId === dep.id ? 'Đang upload...' : '📎 Upload giấy tờ'}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                          <button type="button" onClick={async () => {
                            const newStatus = dep.status === 'active' ? 'inactive' : 'active';
                            try { await svc.updateDependent(dep.id, { status: newStatus }); setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, status: newStatus as any } : d)); } catch {}
                          }} className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${dep.status === 'active' ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                            {dep.status === 'active' ? '⏸ Tạm ngưng GT' : '▶ Kích hoạt GT'}
                          </button>
                          {confirmDeleteDepId === dep.id ? (
                            <div className="flex gap-1">
                              <button type="button" onClick={async () => {
                                try { await svc.deleteDependent(dep.id); setDependents(prev => prev.filter(d => d.id !== dep.id)); setConfirmDeleteDepId(null); } catch {}
                              }} className="px-3 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">Xác nhận xóa</button>
                              <button type="button" onClick={() => setConfirmDeleteDepId(null)} className="px-3 py-1 rounded-lg bg-white/10 text-neutral-medium text-[10px] font-bold">Hủy</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setConfirmDeleteDepId(dep.id)} className="text-[10px] font-bold px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">🗑️ Xóa NPT</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section: Freelancer-specific ── */}
        {form.type === 'freelancer' && (
          <div className={sectionCls}>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">🌍 Thông tin Freelancer</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelCls}>Chức danh</label>
                <input className={inputCls} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="VFX Artist, Concept Artist..." />
              </div>
              <div>
                <label className={labelCls}>Portfolio URL</label>
                <input className={inputCls} value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://artstation.com/..." />
              </div>
              <div>
                <label className={labelCls}>Mã số thuế cá nhân</label>
                <input className={inputCls} value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))} placeholder="Để kê khai thuế TNCN khoán" />
              </div>
              <div>
                <label className={labelCls}>Loại rate</label>
                <select className={inputCls} value={form.rate_type} onChange={e => setForm(f => ({ ...f, rate_type: e.target.value }))}>
                  <option value="">-- Chọn --</option>
                  <option value="hourly">Per Hour</option>
                  <option value="per_shot">Per Shot</option>
                  <option value="per_deliverable">Per Deliverable</option>
                  <option value="per_task">Per Task</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Mức giá</label>
                <div className="flex gap-2">
                  <input type="number" className={inputCls + " flex-1"} value={form.rate_amount} onChange={e => setForm(f => ({ ...f, rate_amount: +e.target.value }))} />
                  <select className={inputCls + " w-24"} value={form.rate_currency} onChange={e => setForm(f => ({ ...f, rate_currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            </div>
            {/* Specializations */}
            <div>
              <label className={labelCls}>Chuyên môn</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATION_OPTIONS.map(spec => (
                  <button key={spec} type="button" onClick={() => toggleSpec(spec)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${form.specializations.includes(spec) ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-white/5 text-neutral-medium border border-transparent hover:border-white/10'}`}>
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Banking ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">🏦 Thông tin Ngân hàng</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Ngân hàng</label>
              <input className={inputCls} value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="MB Bank" />
            </div>
            <div>
              <label className={labelCls}>Số tài khoản</label>
              <input className={inputCls} value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Tên chủ tài khoản</label>
              <input className={inputCls} value={form.bank_branch} onChange={e => setForm(f => ({ ...f, bank_branch: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ── Section: Vehicle Info ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">🚗 Xe & Gửi xe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Loại xe</label>
              <select
                className={inputCls}
                style={{ colorScheme: 'dark' }}
                value={form.vehicle_type}
                onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
              >
                {Object.entries(VEHICLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nhãn hiệu xe</label>
              <input
                className={inputCls}
                value={form.vehicle_brand}
                onChange={e => setForm(f => ({ ...f, vehicle_brand: e.target.value }))}
                placeholder="Honda, Yamaha, Toyota…"
              />
            </div>
            <div>
              <label className={labelCls}>Màu xe</label>
              <input
                className={inputCls}
                value={form.vehicle_color}
                onChange={e => setForm(f => ({ ...f, vehicle_color: e.target.value }))}
                placeholder="Đen, Trắng, Xám…"
              />
            </div>
            <div>
              <label className={labelCls}>Biển số xe</label>
              <input
                className={inputCls}
                value={form.license_plate}
                onChange={e => setForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))}
                placeholder="59A1-123.45"
              />
            </div>
          </div>
        </div>

        {/* ── Section: Notes & Tags ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">📝 Ghi chú & Tags</h3>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea className={inputCls + " min-h-[80px] resize-none"} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ghi chú thêm..." />
          </div>
          <div>
            <label className={labelCls}>Tags</label>
            <div className="flex gap-2 items-center">
              <input className={inputCls + " flex-1"} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Nhập tag rồi Enter..." />
              <button type="button" onClick={addTag} className="px-4 py-3 rounded-xl bg-white/5 text-neutral-medium hover:text-white text-sm font-bold transition-all">+</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-neutral-light text-xs">
                    {t}
                    <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} className="text-red-400 hover:text-red-300">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Buttons ── */}
        {/* Validation warning */}
        {showValidation && missingRequired.length > 0 && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-400 text-sm font-bold">⚠️ Vui lòng điền đầy đủ các trường bắt buộc:</p>
            <p className="text-red-400/80 text-xs mt-1">{missingRequired.map(f => f.label).join(', ')}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button type="button" onClick={onCancel} disabled={saving} className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest border border-primary/10 text-neutral-medium hover:text-white hover:border-primary/30 transition-all disabled:opacity-30">Huỷ</button>
          <button type="submit" disabled={saving} className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100" style={{ background: saving ? '#555' : 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xử lý...
              </span>
            ) : isEdit ? '💾 Cập nhật' : '✚ Thêm nhân sự'}
          </button>
        </div>
      </form>

      {/* ── Contracts (editing only) ── */}
      {isEdit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">📄 Hợp đồng</h3>
            <button onClick={() => setShowContractForm(!showContractForm)} className="text-xs font-black uppercase tracking-widest hover:opacity-80 transition-colors" style={{ color: '#FF375F' }}>
              {showContractForm ? '✕ Đóng' : '✚ Thêm hợp đồng'}
            </button>
          </div>

          {showContractForm && (
            <div className={sectionCls}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Tên hợp đồng *</label>
                  <input className={inputCls} value={contractForm.title} onChange={e => setContractForm(c => ({ ...c, title: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Loại</label>
                  <select className={inputCls} value={contractForm.contract_type} onChange={e => setContractForm(c => ({ ...c, contract_type: e.target.value as any }))}>
                    <option value="labor">Hợp đồng lao động</option>
                    <option value="service">Hợp đồng dịch vụ</option>
                    <option value="nda">NDA</option>
                    <option value="appendix">Phụ lục</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Số hợp đồng</label>
                  <input className={inputCls} value={contractForm.contract_number} onChange={e => setContractForm(c => ({ ...c, contract_number: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Bắt đầu</label>
                  <input type="date" className={inputCls} value={contractForm.start_date} onChange={e => setContractForm(c => ({ ...c, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Kết thúc</label>
                  <input type="date" className={inputCls} value={contractForm.end_date || ''} onChange={e => setContractForm(c => ({ ...c, end_date: e.target.value || null }))} />
                </div>
                <div>
                  <label className={labelCls}>Trạng thái</label>
                  <select className={inputCls} value={contractForm.status} onChange={e => setContractForm(c => ({ ...c, status: e.target.value as any }))}>
                    <option value="active">Đang hiệu lực</option>
                    <option value="expired">Hết hạn</option>
                    <option value="terminated">Đã kết thúc</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>PDF đã ký (tùy chọn — upload sau khi các bên ký)</label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="block w-full text-sm text-neutral-medium file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white"
                    onChange={e => setPendingContractPdf(e.target.files?.[0] || null)}
                  />
                  {pendingContractPdf && (
                    <p className="text-[11px] text-emerald-400/90 mt-1">Đã chọn: {pendingContractPdf.name}</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => void handleContractSubmit()} className="py-3 px-8 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-btn-glow transition-all hover:shadow-btn-glow-hover" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
                ✚ Thêm hợp đồng
              </button>
            </div>
          )}

          <input
            ref={contractListPdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            aria-hidden
            onChange={handleListContractPdfChange}
          />
          {contracts.length === 0 ? (
            <p className="text-neutral-medium text-sm text-center py-8">Chưa có hợp đồng</p>
          ) : (
            <div className="space-y-3">
              {contracts.map(c => (
                <div key={c.id} className="group relative rounded-[16px] border border-primary/10 bg-surface p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-primary/30 transition-all">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm">{c.title}</p>
                    <p className="text-neutral-medium text-xs mt-1">
                      {c.contract_type === 'labor' ? 'HĐ Lao động' : c.contract_type === 'service' ? 'HĐ Dịch vụ' : c.contract_type === 'nda' ? 'NDA' : 'Phụ lục'}
                      {c.contract_number && ` — ${c.contract_number}`}
                    </p>
                    <p className="text-neutral-medium/60 text-[11px] mt-0.5">
                      {c.start_date} → {c.end_date || '∞'}
                    </p>
                    {c.file_url ? (
                      <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                        <a href={toPublicUrl(c.file_url)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">PDF đã ký</a>
                        <a href={toPublicUrl(c.file_url)} download className="text-cyan-400 hover:underline">Tải về</a>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-500/70 mt-1.5">Chưa có PDF đã ký</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => triggerListContractPdf(c.id)}
                      disabled={uploadingContractPdfId === c.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      {uploadingContractPdfId === c.id ? '…' : c.file_url ? 'Thay PDF' : 'Upload PDF'}
                    </button>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'expired' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>{c.status}</span>
                    <button onClick={() => { if (confirm('Xóa hợp đồng này?')) onDeleteContract(c.id); }} className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-medium hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
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

export default EmployeeForm;
