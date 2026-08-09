import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { HrEmployee, HrDepartment, HrContract, HrEvaluation, HrProjectHistory, AccountUser, WorkforceTask, HrEmployeeTimelineEvent } from '@/types';
import * as svc from '../services/hrService';
import { uploadFileToR2, toPublicUrl, updateContract, deleteContract, updateEmployeeRole, hardDeleteEmployee } from '../services/hrService';
import { getDashboardData, FulltimeKPI } from '@/apps/workforce/services/dashboardService';
import { supabase } from '@/services/supabaseClient';
import DocumentManager from './DocumentManager';
import ContractGenerator from './ContractGenerator';
import EquipmentHandoverSection from './EquipmentHandoverSection';
import { hasRole } from '@/utils/roleUtils';

interface Props {
  employee: HrEmployee;
  departments: HrDepartment[];
  currentUser: AccountUser;
  onBack: () => void;
  onEdit: (e: HrEmployee) => void;
}

type DetailTab = 'info' | 'tasks' | 'contracts' | 'equipment' | 'evaluations' | 'projects' | 'documents' | 'timeline';

const EmployeeDetail: React.FC<Props> = ({ employee, departments, currentUser, onBack, onEdit }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [timeline, setTimeline] = useState<HrEmployeeTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  useEffect(() => {
    if (activeTab !== 'timeline') return;
    setLoadingTimeline(true);
    supabase.from('hr_employee_timeline').select('*').eq('employee_id', employee.id).order('event_date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => { setTimeline((data as HrEmployeeTimelineEvent[]) || []); setLoadingTimeline(false); });
  }, [activeTab, employee.id]);
  const [showContractGen, setShowContractGen] = useState(false);
  const [viewingContract, setViewingContract] = useState<HrContract | null>(null);
  const [editingContract, setEditingContract] = useState<HrContract | null>(null);
  const [editContractForm, setEditContractForm] = useState<Partial<HrContract>>({});
  const [savingContractEdit, setSavingContractEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // inline delete confirm
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [evaluations, setEvaluations] = useState<HrEvaluation[]>([]);
  const [projectHistory, setProjectHistory] = useState<HrProjectHistory[]>([]);
  const [wfTasks, setWfTasks] = useState<WorkforceTask[]>([]);
  const [recentKPI, setRecentKPI] = useState<FulltimeKPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [equipmentCount, setEquipmentCount] = useState(0);

  // Role change state
  const [currentRole, setCurrentRole] = useState<string>('');
  const [changingRole, setChangingRole] = useState(false);
  const [roleToast, setRoleToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Hard delete state (admin only)
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);

  const ROLE_OPTIONS = [
    { value: 'member', label: '👤 Nhân viên', color: '#888' },
    { value: 'ke_toan', label: '📊 Kế toán', color: '#F59E0B' },
    { value: 'hr', label: '🧑‍💼 HR', color: '#06B6D4' },
    { value: 'admin', label: '👑 Admin', color: '#FF375F' },
    { value: 'freelancer', label: '🤝 Freelancer', color: '#5E5CE6' },
    { value: 'bd', label: '💼 Business Dev', color: '#34D399' },
  ];

  // CCCD upload state
  const [cccdFront, setCccdFront] = useState(employee.id_card_front_url || '');
  const [cccdBack, setCccdBack] = useState(employee.id_card_back_url || '');
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [cccdPreview, setCccdPreview] = useState<string | null>(null);
  const [cccdPreviewLabel, setCccdPreviewLabel] = useState('');
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(employee.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarLightbox, setAvatarLightbox] = useState(false);
  const [downloadingAvatar, setDownloadingAvatar] = useState(false);

  const isAdmin = hasRole(currentUser, 'admin');
  const isHrOnly = hasRole(currentUser, 'hr') && !isAdmin;

  const handleDownloadAvatar = async () => {
    if (!avatarUrl) return;
    setDownloadingAvatar(true);
    try {
      const response = await fetch(toPublicUrl(avatarUrl));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const ext = avatarUrl.split('.').pop()?.split('?')[0] || 'jpg';
      a.download = `avatar-${employee.full_name.replace(/\s+/g, '-')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch { alert('Tải ảnh thất bại'); }
    finally { setDownloadingAvatar(false); }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const result = await uploadFileToR2(file);
      setAvatarUrl(result.url);
      await svc.updateEmployee(employee.id, { avatar_url: result.url });
    } catch (err: any) { alert('Upload thất bại: ' + (err.message || '')); }
    finally { setUploadingAvatar(false); if (avatarRef.current) avatarRef.current.value = ''; }
  };

  const handleCccdUpload = async (side: 'front' | 'back', file: File) => {
    if (side === 'front') setUploadingFront(true); else setUploadingBack(true);
    try {
      const result = await uploadFileToR2(file);
      const url = result.url;
      if (side === 'front') { setCccdFront(url); await svc.updateEmployee(employee.id, { id_card_front_url: url }); }
      else { setCccdBack(url); await svc.updateEmployee(employee.id, { id_card_back_url: url }); }
    } catch (err: any) { alert('Upload thất bại: ' + (err.message || '')); }
    finally {
      if (side === 'front') { setUploadingFront(false); if (frontRef.current) frontRef.current.value = ''; }
      else { setUploadingBack(false); if (backRef.current) backRef.current.value = ''; }
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const office = employee.type === 'fulltime' || employee.type === 'parttime';
        const [c, e, p, handovers] = await Promise.all([
          svc.fetchContracts(employee.id),
          svc.fetchEvaluations(employee.id),
          svc.fetchProjectHistory(employee.id),
          office ? svc.fetchEquipmentHandovers(employee.id) : Promise.resolve([]),
        ]);
        setContracts(c);
        setEvaluations(e);
        setProjectHistory(p);
        setEquipmentCount(office ? handovers.length : 0);

        if (employee.worker_id) {
          // Fetch tasks for this worker
          const { data: tasksData } = await supabase
            .from('wf_tasks')
            .select('*')
            .eq('worker_id', employee.worker_id)
            .order('created_at', { ascending: false });
          if (tasksData) {
            setWfTasks(tasksData as WorkforceTask[]);
          }

          // Fetch KPI for previous month (or current)
          if (employee.type === 'fulltime') {
            const now = new Date();
            const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-indexed
            const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const dashData = await getDashboardData(lastMonth, year);
            const myKpi = dashData.fulltimeBreakdown.find(b => b.workerId === employee.worker_id);
            if (myKpi) {
              setRecentKPI(myKpi);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading detail data:', err);
      }
      finally { setLoading(false); }
    };
    load();

    // Check current auth role
    const checkRole = async () => {
      const authEmail = employee.type === 'freelancer' ? employee.email : employee.work_email;
      if (!authEmail) {
        setCurrentRole('no_account');
        return;
      }
      try {
        const { data: { session } } = await (await import('@/services/supabaseClient')).supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'check_email', email: authEmail }),
          }
        );
        const result = await res.json();
        if (result.success && result.exists) {
          setCurrentRole(result.role || 'member');
          if (Array.isArray(result.secondary_roles)) setSecondaryRoles(result.secondary_roles);
        } else {
          setCurrentRole('no_account');
        }
      } catch {
        setCurrentRole('no_account');
      }
    };
    checkRole();
  }, [employee.id]);

  // Secondary roles state
  const [secondaryRoles, setSecondaryRoles] = useState<string[]>([]);
  const [savingSecondary, setSavingSecondary] = useState(false);

  const handleToggleSecondaryRole = async (toggleRole: string) => {
    const authEmail = employee.type === 'freelancer' ? employee.email : employee.work_email;
    if (!authEmail) return;

    const newRoles = secondaryRoles.includes(toggleRole)
      ? secondaryRoles.filter(r => r !== toggleRole)
      : [...secondaryRoles, toggleRole];

    setSavingSecondary(true);
    try {
      const { data: { session } } = await (await import('@/services/supabaseClient')).supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'update_secondary_roles', email: authEmail, secondary_roles: newRoles }),
      });
      const result = await res.json();
      if (result.success) {
        setSecondaryRoles(newRoles);
        setRoleToast({ msg: `✅ Cập nhật roles phụ thành công`, type: 'success' });
      } else {
        throw new Error(result.error || 'Lỗi cập nhật');
      }
    } catch (err: any) {
      setRoleToast({ msg: err.message || 'Lỗi cập nhật roles phụ', type: 'error' });
    } finally {
      setSavingSecondary(false);
      setTimeout(() => setRoleToast(null), 3000);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    const authEmail = employee.type === 'freelancer' ? employee.email : employee.work_email;
    if (!authEmail) {
      setRoleToast({ msg: 'Không tìm thấy email để cập nhật role', type: 'error' });
      return;
    }
    setChangingRole(true);
    setRoleToast(null);
    try {
      const msg = await updateEmployeeRole(authEmail, newRole);
      setCurrentRole(newRole);
      setRoleToast({ msg: `✅ Đã đổi role → ${ROLE_OPTIONS.find(r => r.value === newRole)?.label || newRole}`, type: 'success' });
    } catch (err: any) {
      setRoleToast({ msg: err.message || 'Lỗi cập nhật role', type: 'error' });
    } finally {
      setChangingRole(false);
      setTimeout(() => setRoleToast(null), 4000);
    }
  };

  // State for creating account
  const [newAccountRole, setNewAccountRole] = useState('member');

  const handleCreateAccount = async () => {
    const authEmail = employee.type === 'freelancer' ? employee.email : employee.work_email;
    if (!authEmail) {
      setRoleToast({ msg: 'Nhân viên chưa có email. Vào Sửa → thêm email trước.', type: 'error' });
      return;
    }
    setChangingRole(true);
    setRoleToast(null);
    try {
      const { data: { session } } = await (await import('@/services/supabaseClient')).supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      const edgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`;

      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: authEmail,
          full_name: employee.full_name,
          employee_id: employee.id,
          role: newAccountRole,
          ...(employee.type === 'freelancer' ? { worker_id: employee.id } : {}),
        }),
      });
      const result = await res.json();

      if (result.success) {
        setCurrentRole(newAccountRole);
        const msg = result.invited
          ? `✅ Đã tạo tài khoản & gửi email mời (role: ${ROLE_OPTIONS.find(r => r.value === newAccountRole)?.label || newAccountRole})`
          : `✅ Tài khoản đã tồn tại — đã cập nhật role → ${ROLE_OPTIONS.find(r => r.value === newAccountRole)?.label || newAccountRole}`;
        setRoleToast({ msg, type: 'success' });
      } else if (result.error?.includes('already been registered')) {
        // User already exists but was missed by listUsers — fallback to update_role
        const updateRes = await fetch(edgeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'update_role', email: authEmail, role: newAccountRole }),
        });
        const updateResult = await updateRes.json();
        if (updateResult.success) {
          setCurrentRole(newAccountRole);
          setRoleToast({ msg: `✅ Tài khoản đã tồn tại — đã cập nhật role → ${ROLE_OPTIONS.find(r => r.value === newAccountRole)?.label || newAccountRole}`, type: 'success' });
        } else {
          throw new Error(updateResult.error || 'Lỗi cập nhật role');
        }
      } else {
        throw new Error(result.error || 'Lỗi tạo tài khoản');
      }
    } catch (err: any) {
      setRoleToast({ msg: err.message || 'Lỗi tạo tài khoản', type: 'error' });
    } finally {
      setChangingRole(false);
      setTimeout(() => setRoleToast(null), 6000);
    }
  };

  const refreshContracts = async () => {
    const c = await svc.fetchContracts(employee.id);
    setContracts(c);
  };

  const signedPdfInputRef = useRef<HTMLInputElement>(null);
  /** Gắn PDF vào hợp đồng có sẵn, hoặc tạo bản ghi mới khi chưa có hợp đồng */
  type PendingSignedPdf = { mode: 'attach'; contractId: string } | { mode: 'create' };
  const pendingSignedPdfRef = useRef<PendingSignedPdf | null>(null);
  const CREATING_SIGNED_PDF = '__creating_signed_pdf__';
  const [uploadingSignedPdfId, setUploadingSignedPdfId] = useState<string | null>(null);

  const triggerSignedPdfUpload = (contractId: string) => {
    pendingSignedPdfRef.current = { mode: 'attach', contractId };
    signedPdfInputRef.current?.click();
  };

  const triggerSignedPdfUploadNewContract = () => {
    pendingSignedPdfRef.current = { mode: 'create' };
    signedPdfInputRef.current?.click();
  };

  const handleSignedPdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingSignedPdfRef.current;
    e.target.value = '';
    pendingSignedPdfRef.current = null;
    if (!file || !pending) return;
    if (!file.type.includes('pdf')) {
      alert('Vui lòng chọn file PDF.');
      return;
    }

    if (pending.mode === 'create') {
      setUploadingSignedPdfId(CREATING_SIGNED_PDF);
      try {
        const { url } = await uploadFileToR2(file);
        const isFreelancer = employee.type === 'freelancer';
        const today = new Date().toISOString().split('T')[0];
        await svc.saveContract({
          employee_id: employee.id,
          contract_type: isFreelancer ? 'service' : 'labor',
          title: `PDF đã ký — ${new Date().toLocaleDateString('vi-VN')}`,
          contract_number: '',
          start_date: today,
          end_date: null,
          salary: 0,
          currency: employee.rate_currency || 'VND',
          rate_type: employee.rate_type || '',
          rate_amount: employee.rate_amount || 0,
          file_url: url,
          status: 'active',
          notes: 'Hồ sơ tạo khi upload bản PDF đã ký.',
        });
        await refreshContracts();
      } catch (err: any) {
        alert(err.message || 'Upload thất bại');
      } finally {
        setUploadingSignedPdfId(null);
      }
      return;
    }

    const contractId = pending.contractId;
    setUploadingSignedPdfId(contractId);
    try {
      const { url } = await uploadFileToR2(file);
      await updateContract(contractId, { file_url: url });
      await refreshContracts();
      if (editingContract?.id === contractId) {
        setEditContractForm(f => ({ ...f, file_url: url }));
      }
    } catch (err: any) {
      alert(err.message || 'Upload thất bại');
    } finally {
      setUploadingSignedPdfId(null);
    }
  };

  const handleEditContract = (c: HrContract) => {
    setEditingContract(c);
    setEditContractForm({
      title: c.title,
      contract_number: c.contract_number,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      notes: c.notes,
      file_url: c.file_url,
    });
  };

  const handleSaveContractEdit = async () => {
    if (!editingContract) return;
    setSavingContractEdit(true);
    try {
      await updateContract(editingContract.id, editContractForm);
      await refreshContracts();
      setEditingContract(null);
    } catch (err: any) { alert('Lưu thất bại: ' + (err.message || '')); }
    finally { setSavingContractEdit(false); }
  };

  const handleDeleteContract = async (c: HrContract) => {
    try {
      await deleteContract(c.id);
      setConfirmDeleteId(null);
      await refreshContracts();
    } catch (err: any) { alert('Xóa thất bại: ' + (err.message || '')); }
  };



  const dept = departments.find(d => d.id === employee.department_id);
  /** Bàn giao dụng cụ & gửi xe chỉ áp dụng nhân viên tại văn phòng (FT/PT), không áp dụng freelancer. */
  const isOfficeStaffType = employee.type === 'fulltime' || employee.type === 'parttime';
  const wfTaskStatusClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-white/10 text-neutral-medium';
    }
  };
  const wfTaskStatusLabel: Record<string, string> = {
    in_progress: 'Đang làm',
    completed: 'Hoàn thành',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
  };

  const reloadEquipmentCount = useCallback(async () => {
    if (!isOfficeStaffType) return;
    try {
      const h = await svc.fetchEquipmentHandovers(employee.id);
      setEquipmentCount(h.length);
    } catch {
      /* ignore */
    }
  }, [employee.id, isOfficeStaffType]);

  useEffect(() => {
    if (!isOfficeStaffType && activeTab === 'equipment') {
      setActiveTab('info');
    }
  }, [employee.type, activeTab, isOfficeStaffType]);

  const tabCls = (t: DetailTab) => `px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white/10 text-white' : 'text-neutral-medium hover:text-white hover:bg-white/5'}`;

  const infoPair = (label: string, value: string | number | null | undefined) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between items-start py-2 border-b border-white/5">
        <span className="text-neutral-medium text-xs font-bold uppercase tracking-wide">{label}</span>
        <span className="text-white text-sm text-right max-w-[60%]">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      </div>
    );
  };

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header Card */}
      <div className="rounded-[24px] border border-primary/10 bg-surface overflow-hidden">
        <div className="h-2 w-full" style={{
          background: employee.type === 'fulltime' ? 'linear-gradient(90deg, #34C759, #30D158)' :
            employee.type === 'freelancer' ? 'linear-gradient(90deg, #0A84FF, #5E5CE6)' :
            'linear-gradient(90deg, #FF9500, #FF6B00)',
        }} />
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <input type="file" ref={avatarRef} accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} id="avatar-upload"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              <div className="relative group w-20 h-20 rounded-[20px] overflow-hidden cursor-pointer flex-shrink-0"
                onClick={() => {
                  if (isAdmin && avatarUrl) { setAvatarLightbox(true); }
                  else { avatarRef.current?.click(); }
                }}>
                {uploadingAvatar ? (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : avatarUrl ? (
                  <>
                    <img src={toPublicUrl(avatarUrl)} alt={employee.full_name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">{isAdmin ? '🔍 Xem ảnh' : '📷 Đổi ảnh'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>
                      {employee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">📷 Thêm ảnh</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">{employee.full_name}</h2>
                <p className="text-neutral-medium/60 text-sm font-mono mt-1">{employee.employee_code}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${employee.type === 'fulltime' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>{employee.type}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${employee.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{employee.status}</span>
                  {employee.position && <span className="text-[11px] text-neutral-medium">• {employee.position}</span>}
                  {dept && <span className="text-[11px] text-neutral-medium">• {dept.name}</span>}
                  {recentKPI && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ml-2 border ${
                      recentKPI.kpiScore === 'A' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      recentKPI.kpiScore === 'B' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                      recentKPI.kpiScore === 'C' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      recentKPI.kpiScore === 'D' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                      recentKPI.kpiScore === 'F' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-white/5 text-neutral-medium border-white/10'
                    }`} title={`ROI: ${recentKPI.roiPercent.toFixed(1)}%`}>
                      KPI: {recentKPI.kpiScore}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                {/* ponytail: hợp đồng in cả bảng lương/rate → hr thuần không được mở. */}
                {!isHrOnly && (employee.type === 'fulltime' || employee.type === 'freelancer') && (
                  <button onClick={() => setShowContractGen(true)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80" style={{ background: employee.type === 'freelancer' ? 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)' : 'linear-gradient(135deg, #34C759 0%, #30D158 100%)' }}>📝 Xuất hợp đồng</button>
                )}
                <button onClick={() => onEdit(employee)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80" style={{ background: 'linear-gradient(135deg, #FF375F 0%, #FF6B81 100%)' }}>✏️ Sửa</button>
                {hasRole(currentUser, 'admin') && (
                  hardDeleteConfirm ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          setHardDeleting(true);
                          try {
                            await hardDeleteEmployee(employee.id);
                            onBack();
                          } catch (err: any) {
                            setRoleToast({ msg: err.message || 'Lỗi xóa', type: 'error' });
                            setHardDeleteConfirm(false);
                          } finally { setHardDeleting(false); }
                        }}
                        disabled={hardDeleting}
                        className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)' }}
                      >
                        {hardDeleting ? '⏳ Đang xóa...' : '⚠️ XÁC NHẬN XÓA'}
                      </button>
                      <button onClick={() => setHardDeleteConfirm(false)} className="px-3 py-2 rounded-xl border border-white/10 text-neutral-medium text-xs font-black uppercase hover:text-white transition-all">Hủy</button>
                    </div>
                  ) : (
                    <button onClick={() => setHardDeleteConfirm(true)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">🗑️ Xóa vĩnh viễn</button>
                  )
                )}
                <button onClick={onBack} className="px-4 py-2 rounded-xl border border-primary/10 text-neutral-medium text-xs font-black uppercase tracking-widest hover:text-white hover:border-primary/30 transition-all">← Quay lại</button>
              </div>
              {/* Role Changer */}
              {currentRole && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Role:</span>
                  {currentRole === 'no_account' ? (
                    <>
                      <select
                        value={newAccountRole}
                        onChange={e => setNewAccountRole(e.target.value)}
                        disabled={changingRole}
                        className="bg-white/5 border border-primary/10 rounded-lg px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-primary/40 transition-all disabled:opacity-50"
                        style={{ colorScheme: 'dark' }}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleCreateAccount}
                        disabled={changingRole}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
                      >
                        {changingRole ? '⏳ Đang tạo...' : '📧 Tạo tài khoản & Gửi invite'}
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={currentRole}
                        onChange={e => handleRoleChange(e.target.value)}
                        disabled={changingRole}
                        className="bg-white/5 border border-primary/10 rounded-lg px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-primary/40 transition-all disabled:opacity-50"
                        style={{ colorScheme: 'dark' }}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {changingRole && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                    </>
                  )}
                  {/* Secondary roles checkboxes */}
                  {currentRole && currentRole !== 'no_account' && (
                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/10">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-medium">+</span>
                      {ROLE_OPTIONS.filter(r => r.value !== currentRole).map(r => {
                        const active = secondaryRoles.includes(r.value);
                        return (
                          <button
                            key={r.value}
                            onClick={() => handleToggleSecondaryRole(r.value)}
                            disabled={savingSecondary}
                            className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                            style={{
                              background: active ? `${r.color}20` : 'rgba(255,255,255,0.04)',
                              color: active ? r.color : '#666',
                              border: `1px solid ${active ? `${r.color}40` : 'rgba(255,255,255,0.08)'}`,
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {roleToast && (
                    <span className={`text-[11px] font-bold ${roleToast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {roleToast.msg}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button className={tabCls('info')} onClick={() => setActiveTab('info')}>📋 Thông tin</button>
        <button className={tabCls('tasks')} onClick={() => setActiveTab('tasks')}>🎯 Lịch sử Task ({wfTasks.length})</button>
        {/* HR không quản lý hợp đồng — RLS đã cắt quyền đọc, tab sẽ luôn rỗng */}
        {!isHrOnly && <button className={tabCls('contracts')} onClick={() => setActiveTab('contracts')}>📄 Hợp đồng ({contracts.length})</button>}
        {isOfficeStaffType && (
          <>
            <button className={tabCls('equipment')} onClick={() => setActiveTab('equipment')}>🧰 Bàn giao dụng cụ ({equipmentCount})</button>
          </>
        )}
        <button className={tabCls('evaluations')} onClick={() => setActiveTab('evaluations')}>⭐ Đánh giá ({evaluations.length})</button>
        <button className={tabCls('projects')} onClick={() => setActiveTab('projects')}>📁 Dự án ({projectHistory.length})</button>
        <button className={tabCls('documents')} onClick={() => setActiveTab('documents')}>🗂️ Hồ sơ</button>
        <button className={tabCls('timeline')} onClick={() => setActiveTab('timeline')}>📜 Lịch sử công tác</button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Avatar Lightbox (Admin only) */}
      {avatarLightbox && avatarUrl && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}
          onClick={() => setAvatarLightbox(false)}>
          {/* Toolbar */}
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)', height: '52px', flexShrink: 0 }}>
            <span style={{ color: '#F5F5F5', fontSize: '14px', fontWeight: 700, flex: 1 }}>
              👤 {employee.full_name}
            </span>
            <button
              onClick={handleDownloadAvatar}
              disabled={downloadingAvatar}
              style={{ padding: '6px 16px', borderRadius: '8px', background: '#FF9500', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: downloadingAvatar ? 'not-allowed' : 'pointer', border: 'none', opacity: downloadingAvatar ? 0.6 : 1, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {downloadingAvatar ? '⏳ Đang tải...' : '⬇️ Tải về máy'}
            </button>
            <button
              onClick={() => setAvatarLightbox(false)}
              style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#ccc', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}>
              ✕ Đóng
            </button>
          </div>
          {/* Image area */}
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <img
              src={toPublicUrl(avatarUrl)}
              alt={employee.full_name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
            />
          </div>
          {/* Hint */}
          <div style={{ textAlign: 'center', padding: '12px', color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
            Click bên ngoài để đóng
          </div>
        </div>,
        document.body
      )}

      {/* CCCD Preview Modal */}
      {cccdPreview && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column' }}
          onClick={() => setCccdPreview(null)}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', background: '#111', borderBottom: '1px solid #333', height: '50px', flexShrink: 0 }}>
            <span style={{ color: '#F5F5F5', fontSize: '14px', fontWeight: 700, flex: 1 }}>{cccdPreviewLabel}</span>
            <a href={cccdPreview} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: '6px', background: '#0A84FF', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none', border: 'none' }}>🔗 Mở tab mới</a>
            <button onClick={() => setCccdPreview(null)} style={{ padding: '6px 14px', borderRadius: '6px', background: '#FF453A', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none' }}>✕ Đóng</button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', height: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={cccdPreview} alt={cccdPreviewLabel} style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }} />
          </div>
        </div>,
        document.body
      )}

      {/* Info Tab */}
      {!loading && activeTab === 'info' && (() => {
        // Quick overview computations
        const tenure = (() => {
          if (!employee.start_date) return '—';
          const start = new Date(employee.start_date);
          const now = new Date();
          const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
          if (totalMonths < 1) return '< 1 tháng';
          if (totalMonths < 12) return `${totalMonths} tháng`;
          const years = Math.floor(totalMonths / 12);
          const remainMonths = totalMonths % 12;
          return remainMonths > 0 ? `${years} năm ${remainMonths} tháng` : `${years} năm`;
        })();
        const probationStatus = (() => {
          if (!employee.probation_end) return null;
          const end = new Date(employee.probation_end);
          const now = new Date();
          if (employee.official_date) return { text: 'Chính thức', color: '#34C759' };
          if (now >= end) return { text: 'Đã hết thử việc', color: '#FFD60A' };
          const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { text: `Còn ${daysLeft} ngày`, color: daysLeft <= 14 ? '#FF9F0A' : '#0A84FF' };
        })();
        const activeContracts = contracts.filter(c => c.status === 'active').length;
        return (
        <div className="space-y-6">
          {/* Quick Overview Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-[20px] border border-primary/10 bg-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Thâm niên</p>
              <p className="text-xl font-black text-white mt-1">{tenure}</p>
              {employee.start_date && <p className="text-[11px] text-neutral-medium mt-0.5">Từ {employee.start_date}</p>}
            </div>
            <div className="rounded-[20px] border border-primary/10 bg-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Hợp đồng</p>
              <p className="text-xl font-black text-white mt-1">{activeContracts > 0 ? `${activeContracts} hiệu lực` : 'Chưa có'}</p>
              {contracts.length > 0 && <p className="text-[11px] text-neutral-medium mt-0.5">Tổng: {contracts.length}</p>}
            </div>
            {employee.type === 'fulltime' && probationStatus && (
              <div className="rounded-[20px] border border-primary/10 bg-surface p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Thử việc</p>
                <p className="text-xl font-black mt-1" style={{ color: probationStatus.color }}>{probationStatus.text}</p>
                {employee.probation_end && <p className="text-[11px] text-neutral-medium mt-0.5">Hết: {employee.probation_end}</p>}
              </div>
            )}
            <div className="rounded-[20px] border border-primary/10 bg-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{employee.type === 'fulltime' ? 'KPI gần nhất' : 'Tasks'}</p>
              {employee.type === 'fulltime' ? (
                <>
                  <p className={`text-xl font-black mt-1 ${recentKPI ? '' : 'text-neutral-medium'}`} style={recentKPI ? { color: recentKPI.kpiScore === 'A' ? '#34C759' : recentKPI.kpiScore === 'B' ? '#0A84FF' : recentKPI.kpiScore === 'C' ? '#FFD60A' : recentKPI.kpiScore === 'D' ? '#FF9F0A' : '#FF453A' } : {}}>
                    {recentKPI?.kpiScore || '—'}
                  </p>
                  {recentKPI && <p className="text-[11px] text-neutral-medium mt-0.5">ROI: {recentKPI.roiPercent.toFixed(1)}%</p>}
                </>
              ) : (
                <>
                  <p className="text-xl font-black text-white mt-1">{wfTasks.length}</p>
                  <p className="text-[11px] text-neutral-medium mt-0.5">{wfTasks.filter(t => t.status === 'completed' || t.status === 'approved').length} hoàn thành</p>
                </>
              )}
            </div>
          </div>

          {/* Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Thông tin cá nhân</h3>
            {infoPair('Email', employee.email)}
            {infoPair('Email công ty', employee.work_email)}
            {infoPair('Điện thoại', employee.phone)}
            {infoPair('Ngày sinh', employee.date_of_birth)}
            {infoPair('Giới tính', employee.gender === 'male' ? 'Nam' : employee.gender === 'female' ? 'Nữ' : employee.gender)}
            {infoPair('Quốc tịch', employee.nationality)}
            {infoPair('Địa chỉ', employee.address)}
            {infoPair('Địa chỉ tạm trú', employee.temp_address)}
          </div>
          <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
            {employee.type === 'fulltime' ? (
              <>
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Fulltime</h3>
                {infoPair('CMND/CCCD', employee.id_number)}
                {infoPair('Ngày cấp', employee.id_issue_date)}
                {infoPair('Nơi cấp', employee.id_issue_place)}
                {infoPair('MST cá nhân', employee.tax_code)}
                {infoPair('Số sổ BH', employee.insurance_number)}
                {infoPair('Phòng ban', dept?.name)}
                {infoPair('Chức danh', employee.position)}
                {infoPair('Cấp bậc', employee.level)}
                {infoPair('Ngày bắt đầu', employee.start_date)}
                {infoPair('Hết thử việc', employee.probation_end)}
                {infoPair('Ngày chính thức', employee.official_date)}
                {employee.exclude_from_payroll && infoPair('Lương tự động', '❌ Không tính')}
              </>
            ) : (
              <>
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Freelancer</h3>
                {infoPair('Portfolio', employee.portfolio_url)}
                {infoPair('Chuyên môn', employee.specializations?.join(', '))}
                {infoPair('Múi giờ', employee.timezone)}
                {!isHrOnly && infoPair('Rate', employee.rate_amount && employee.rate_amount > 0 ? `${employee.rate_amount.toLocaleString()} ${employee.rate_currency}/${employee.rate_type}` : '')}
                {infoPair('Thanh toán', employee.payment_method)}
              </>
            )}
          </div>
          <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Ngân hàng</h3>
            {infoPair('Ngân hàng', employee.bank_name)}
            {infoPair('Số TK', employee.bank_account)}
            {infoPair('Tên chủ TK', employee.bank_branch)}
          </div>
          {employee.discord_user_id && (
            <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">💬 Discord</h3>
              {infoPair('User ID', employee.discord_user_id)}
            </div>
          )}
          {(employee.license_plate || employee.vehicle_type) && (
            <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">🚗 Xe & Gửi xe</h3>
              {infoPair('Loại xe', ({
                motorcycle: 'Xe máy', car: 'Ô tô', bicycle: 'Xe đạp',
                electric_bike: 'Xe máy điện', other: 'Khác',
              } as Record<string, string>)[employee.vehicle_type] || employee.vehicle_type)}
              {infoPair('Nhãn hiệu', employee.vehicle_brand)}
              {infoPair('Màu xe', employee.vehicle_color)}
              {infoPair('Biển số', employee.license_plate)}
            </div>
          )}
          {employee.notes && (
            <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Ghi chú</h3>
              <p className="text-neutral-light text-sm whitespace-pre-wrap">{employee.notes}</p>
              {employee.tags && employee.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {employee.tags.map(t => (
                    <span key={t} className="px-3 py-1 rounded-full bg-white/5 text-neutral-medium text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        );
      })()}

      {/* Tasks Tab */}
      {!loading && activeTab === 'tasks' && (
        <div className="space-y-4">
          {!employee.worker_id ? (
            <div className="text-center py-12 rounded-[20px] border border-dashed border-primary/20 bg-primary/5">
              <p className="text-primary font-bold">Chưa đồng bộ sang Workforce</p>
              <p className="text-neutral-medium text-xs mt-1">Vui lòng bấm nút "Đồng bộ WF" ở danh sách nhân sự để theo dõi Task.</p>
            </div>
          ) : wfTasks.length === 0 ? (
            <p className="text-neutral-medium text-sm text-center py-12">Chưa có task nào được ghi nhận</p>
          ) : (
            <>
              <p className="text-neutral-medium text-xs rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="text-cyan-400/90 font-bold">Đồng bộ Workforce:</span> danh sách chỉ đọc từ Workforce (sync
                ClickUp). Tại đây chỉ xem <span className="text-white/80">tên task, dự án, khách hàng, trạng thái</span>
                — cập nhật giá / ghi chú / sync task trong module Workforce.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wfTasks.map(t => {
                  const st = (t.status || 'in_progress') as string;
                  const projectLabel =
                    t.project?.trim() || t.clickup_folder_name || t.clickup_list_name || '';
                  const clientLabel =
                    t.client_name?.trim() || t.clickup_space_name || '';
                  return (
                    <div
                      key={t.id}
                      className="rounded-[16px] border border-primary/10 bg-surface p-5 hover:border-primary/30 transition-all"
                    >
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <h4 className="text-white font-bold text-sm leading-snug min-w-0">{t.title}</h4>
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex-shrink-0 ${wfTaskStatusClass(st)}`}
                        >
                          {wfTaskStatusLabel[st] || st.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[12px]">
                        <p className="text-neutral-medium">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/35 mr-2">Dự án</span>
                          <span className="text-white/90">{projectLabel || '—'}</span>
                        </p>
                        <p className="text-neutral-medium">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/35 mr-2">Khách hàng</span>
                          <span className="text-white/90">{clientLabel || '—'}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Equipment handover Tab — chỉ FT/PT */}
      {!loading && isOfficeStaffType && activeTab === 'equipment' && (
        <EquipmentHandoverSection
          employee={employee}
          department={dept}
          onListChange={reloadEquipmentCount}
        />
      )}


      {/* Contracts Tab */}
      {!loading && !isHrOnly && activeTab === 'contracts' && (
        <div className="space-y-4">
          <input
            ref={signedPdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            aria-hidden
            onChange={handleSignedPdfFileChange}
          />
          <p className="text-neutral-medium text-xs rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
            <span className="text-emerald-400/90 font-bold">PDF đã ký:</span> Xuất hợp đồng → gửi ký → upload file PDF đã ký vào đây để lưu trữ, xem lại và tải về khi cần.
          </p>
          {contracts.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-emerald-500/20 bg-white/[0.02] px-6 py-10 text-center space-y-4">
              <p className="text-white font-bold text-sm">Chưa có hợp đồng trong hồ sơ</p>
              <p className="text-neutral-medium text-xs max-w-lg mx-auto leading-relaxed">
                Nút <span className="text-white/90 font-semibold">Xuất hợp đồng</span> (phía trên) tạo bản nháp và có thể lưu vào hồ sơ sau khi in.
                Nếu bạn đã có sẵn bản PDF đã ký, dùng nút bên dưới để lưu trữ ngay — không cần tạo hợp đồng trước.
              </p>
              <button
                type="button"
                onClick={triggerSignedPdfUploadNewContract}
                disabled={uploadingSignedPdfId === CREATING_SIGNED_PDF}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-black text-white border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
              >
                {uploadingSignedPdfId === CREATING_SIGNED_PDF ? '⏳ Đang upload…' : '📤 Upload PDF đã ký'}
              </button>
            </div>
          ) : contracts.map(c => (
            <div key={c.id} className="rounded-[16px] border border-primary/10 bg-surface p-5">
              {editingContract?.id === c.id ? (
                // ── Inline Edit Form ──
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">✏️ Chỉnh sửa hợp đồng</p>
                  {[
                    { label: 'Tiêu đề', key: 'title', type: 'text' },
                    { label: 'Số HĐ', key: 'contract_number', type: 'text' },
                    { label: 'Ngày ký', key: 'start_date', type: 'date' },
                    { label: 'Ngày kết thúc', key: 'end_date', type: 'date' },
                  ].map(({ label, key, type }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-neutral-medium text-xs w-24 flex-shrink-0">{label}</span>
                      <input
                        type={type}
                        value={(editContractForm as any)[key] || ''}
                        onChange={e => setEditContractForm(p => ({ ...p, [key]: e.target.value || null }))}
                        className="flex-1 bg-white/5 border border-primary/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-blue-500/50"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-medium text-xs w-24">Trạng thái</span>
                    <select
                      value={editContractForm.status || 'active'}
                      onChange={e => setEditContractForm(p => ({ ...p, status: e.target.value as HrContract['status'] }))}
                      className="flex-1 bg-white/5 border border-primary/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-medium text-xs w-24">Ghi chú</span>
                    <input
                      type="text"
                      value={editContractForm.notes || ''}
                      onChange={e => setEditContractForm(p => ({ ...p, notes: e.target.value }))}
                      className="flex-1 bg-white/5 border border-primary/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">PDF đã ký (lưu trữ)</p>
                    {(editContractForm as Partial<HrContract>).file_url ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <a
                          href={toPublicUrl((editContractForm as Partial<HrContract>).file_url!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          Xem PDF hiện tại
                        </a>
                        <button
                          type="button"
                          onClick={() => editingContract && triggerSignedPdfUpload(editingContract.id)}
                          disabled={uploadingSignedPdfId === editingContract?.id}
                          className="text-xs font-bold text-amber-400 hover:underline"
                        >
                          {uploadingSignedPdfId === editingContract?.id ? 'Đang tải…' : 'Thay file PDF'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => editingContract && triggerSignedPdfUpload(editingContract.id)}
                        disabled={uploadingSignedPdfId === editingContract?.id}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        {uploadingSignedPdfId === editingContract?.id ? 'Đang upload…' : '📤 Upload PDF đã ký'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveContractEdit} disabled={savingContractEdit}
                      className="px-4 py-1.5 rounded-lg text-xs font-black text-white"
                      style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)', opacity: savingContractEdit ? 0.5 : 1 }}>
                      {savingContractEdit ? 'Đang lưu...' : '✅ Lưu'}
                    </button>
                    <button onClick={() => setEditingContract(null)}
                      className="px-4 py-1.5 rounded-lg text-xs font-black border border-primary/10 text-neutral-medium hover:text-white transition-all">
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                // ── Display Row ──
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold truncate">{c.title}</p>
                    <p className="text-neutral-medium text-xs mt-1">
                      {c.contract_type === 'labor' ? 'HĐ Lao động' : c.contract_type === 'service' ? 'HĐ Dịch vụ' : c.contract_type === 'nda' ? 'NDA' : c.contract_type.toUpperCase()}
                      {c.contract_number && ` — ${c.contract_number}`}
                    </p>
                    <p className="text-neutral-medium/60 text-[11px] mt-1">{c.start_date} → {c.end_date || '∞'}</p>
                    {c.notes && <p className="text-neutral-medium/40 text-[10px] mt-1 truncate">{c.notes}</p>}
                    {c.file_url ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className="text-[10px] font-bold text-emerald-400/90">📄 Đã lưu PDF đã ký</span>
                        <a
                          href={toPublicUrl(c.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400 hover:underline"
                        >
                          Mở xem
                        </a>
                        <a
                          href={toPublicUrl(c.file_url)}
                          download
                          className="text-[11px] text-cyan-400 hover:underline"
                        >
                          Tải về
                        </a>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-500/80 mt-2">Chưa có PDF đã ký — upload sau khi các bên ký.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => triggerSignedPdfUpload(c.id)}
                      disabled={uploadingSignedPdfId === c.id}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {uploadingSignedPdfId === c.id ? '⏳ Đang upload…' : c.file_url ? '📤 Thay PDF đã ký' : '📤 Upload PDF đã ký'}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                        c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        c.status === 'expired' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                      }`}>{c.status}</span>
                      <button onClick={() => setViewingContract(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-80 transition-all"
                        style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' }}>
                        👁️ Xem
                      </button>
                      <button onClick={() => handleEditContract(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-80 transition-all"
                        style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}>
                        ✏️ Sửa
                      </button>
                      {confirmDeleteId === c.id ? (
                        <>
                          <span className="text-[11px] text-red-400 font-bold">Xóa?</span>
                          <button onClick={() => handleDeleteContract(c)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-80 transition-all"
                            style={{ background: 'linear-gradient(135deg, #FF453A, #FF375F)' }}>
                            Xác nhận
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/10 text-neutral-medium hover:text-white transition-all">
                            Huỷ
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(c.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-80 transition-all"
                          style={{ background: 'linear-gradient(135deg, #FF453A, #FF375F)' }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Evaluations Tab */}
      {!loading && activeTab === 'evaluations' && (
        <div className="space-y-4">
          {evaluations.length === 0 ? (
            <p className="text-neutral-medium text-sm text-center py-12">Chưa có đánh giá</p>
          ) : evaluations.map(ev => (
            <div key={ev.id} className="rounded-[16px] border border-primary/10 bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-bold">{ev.period}</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={`text-lg ${s <= ev.score ? 'text-yellow-400' : 'text-neutral-medium/20'}`}>★</span>
                  ))}
                </div>
              </div>
              {ev.evaluator && <p className="text-neutral-medium text-xs">Người đánh giá: {ev.evaluator}</p>}
              {ev.strengths && <p className="text-emerald-400/80 text-xs mt-2">💪 {ev.strengths}</p>}
              {ev.weaknesses && <p className="text-orange-400/80 text-xs mt-1">📌 {ev.weaknesses}</p>}
              {ev.notes && <p className="text-neutral-medium/60 text-xs mt-1">{ev.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Projects Tab */}
      {!loading && activeTab === 'projects' && (
        <div className="space-y-4">
          {projectHistory.length === 0 ? (
            <p className="text-neutral-medium text-sm text-center py-12">Chưa có lịch sử dự án</p>
          ) : projectHistory.map(p => (
            <div key={p.id} className="rounded-[16px] border border-primary/10 bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{p.project_name}</p>
                  {p.role && <p className="text-neutral-medium text-xs mt-1">Vai trò: {p.role}</p>}
                </div>
                <p className="text-neutral-medium/60 text-[11px]">{p.start_date} → {p.end_date || 'Hiện tại'}</p>
              </div>
              {p.performance_note && <p className="text-neutral-medium/60 text-xs mt-2">{p.performance_note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {!loading && activeTab === 'documents' && (
        <DocumentManager employee={employee} />
      )}

      {/* Timeline Tab */}
      {!loading && activeTab === 'timeline' && (
        <div className="space-y-2">
          {loadingTimeline && <p className="text-neutral-medium text-sm">Đang tải...</p>}
          {!loadingTimeline && timeline.length === 0 && <p className="text-neutral-medium text-sm">Chưa có sự kiện nào.</p>}
          {!loadingTimeline && timeline.filter(ev => !isHrOnly || (ev.event_type !== 'salary' && !ev.event_type.startsWith('salary_'))).map((ev, i) => {
            const labels: Record<string, { icon: string; label: string; color: string }> = {
              joined:           { icon: '🎉', label: 'Vào công ty',        color: '#34C759' },
              become_official:  { icon: '⭐', label: 'Lên chính thức',      color: '#FFD60A' },
              official_date:    { icon: '⭐', label: 'Đổi ngày chính thức', color: '#FFD60A' },
              probation_end:    { icon: '⏰', label: 'Đổi ngày hết thử việc', color: '#FF9F0A' },
              type:             { icon: '🔄', label: 'Đổi loại nhân viên', color: '#0A84FF' },
              status:           { icon: '🚦', label: 'Đổi trạng thái',      color: '#FF453A' },
              department:       { icon: '🏢', label: 'Đổi phòng ban',       color: '#5E5CE6' },
              position:         { icon: '👤', label: 'Đổi chức danh',       color: '#5E5CE6' },
              level:            { icon: '🎖️', label: 'Đổi level',           color: '#5E5CE6' },
              salary:           { icon: '💰', label: 'Đổi lương',           color: '#34C759' },
              evaluation:       { icon: '⭐', label: 'Đánh giá',             color: '#FFD60A' },
            };
            const meta = labels[ev.event_type] || (
              ev.event_type.startsWith('salary_')   ? { icon: '💰', label: 'Phụ cấp / Lương', color: '#34C759' } :
              ev.event_type.startsWith('contract_') ? { icon: '📄', label: 'Hợp đồng',         color: '#0A84FF' } :
                                                     { icon: '•',  label: ev.event_type,     color: '#8E8E93' }
            );
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xl" style={{ width: 32, textAlign: 'center' }}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[11px] text-neutral-medium">{ev.event_date}</span>
                  </div>
                  <p className="text-sm text-white mt-0.5 break-words">
                    {ev.old_value && ev.new_value ? <><span className="text-neutral-medium line-through mr-1">{ev.old_value}</span>→ <span>{ev.new_value}</span></> : (ev.new_value || '')}
                    {ev.amount != null && <span className="ml-2 text-[#34C759] font-bold">{Number(ev.amount).toLocaleString('vi-VN')} {ev.currency}</span>}
                  </p>
                  {ev.notes && <p className="text-[11px] text-neutral-medium/70 mt-0.5">{ev.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Tab — Lịch sử công tác */}
      {activeTab === 'timeline' && (
        <div className="space-y-2">
          {loadingTimeline && <p className="text-neutral-medium text-sm">Đang tải lịch sử...</p>}
          {!loadingTimeline && timeline.length === 0 && <p className="text-neutral-medium text-sm">Chưa có lịch sử cho nhân viên này.</p>}
          {!loadingTimeline && timeline.filter(ev => !isHrOnly || (ev.event_type !== 'salary' && !ev.event_type.startsWith('salary_'))).map((ev, i) => {
            const labelMap: Record<string, string> = {
              joined: '🚪 Vào công ty', become_official: '⭐ Lên chính thức',
              official_date: '⭐ Đổi ngày chính thức', probation_end: '🔄 Đổi ngày hết thử việc',
              type: '🔁 Đổi loại nhân viên', status: '📌 Đổi trạng thái',
              department: '🏢 Đổi phòng ban', position: '💼 Đổi chức danh',
              level: '📈 Đổi cấp bậc', salary: '💰 Đổi lương cơ bản',
              evaluation: '⭐ Đánh giá', leave_company: '👋 Nghỉ việc', return: '↩️ Quay lại',
            };
            const label = labelMap[ev.event_type] || (ev.event_type.startsWith('salary_') ? '💰 ' + ev.event_type.replace('salary_', '') : ev.event_type.startsWith('contract_') ? '📄 Hợp đồng' : ev.event_type);
            return (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="text-xs text-neutral-medium font-mono w-24 shrink-0 pt-0.5">{ev.event_date}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{label}</div>
                  {ev.old_value && ev.new_value && <div className="text-xs text-neutral-medium mt-0.5">{ev.old_value || '(trống)'} → <span className="text-white">{ev.new_value}</span></div>}
                  {!ev.old_value && ev.new_value && <div className="text-xs text-neutral-medium mt-0.5">{ev.new_value}</div>}
                  {ev.notes && <div className="text-[11px] text-neutral-medium/70 mt-1 italic">{ev.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contract Generator Modal - New contract */}
      {showContractGen && !isHrOnly && (
        <ContractGenerator
          employee={employee}
          department={departments.find(d => d.id === employee.department_id)}
          onClose={() => setShowContractGen(false)}
          onContractSaved={refreshContracts}
        />
      )}

      {/* Contract Generator Modal - View/Export existing contract */}
      {viewingContract && !isHrOnly && (
        <ContractGenerator
          employee={employee}
          department={departments.find(d => d.id === employee.department_id)}
          initialContract={viewingContract}
          onClose={() => setViewingContract(null)}
          onContractSaved={refreshContracts}
        />
      )}
    </div>
  );
};

export default EmployeeDetail;
