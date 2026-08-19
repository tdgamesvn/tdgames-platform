import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CrmClient, CrmContact, CrmProject } from '@/types';
import {
  generateClientContract, generateContractNumber, printContract,
  COMPANY_OPTIONS, CompanyKey, ClientContractData, PaymentPhase,
  getScopeTemplates, saveScopeTemplate, deleteScopeTemplate, ScopeTemplate,
  formatScopeWithAI,
} from '../services/clientContractService';
import { supabase } from '@/services/supabaseClient';
import { fetchBankAccounts, BankAccount } from '@/apps/expense/services/bankAccountService';

interface Props {
  /** Hop dong da luu -> mo lai de sua. Bo trong = tao moi. */
  initialData?: ClientContractData | null;
  editingDocId?: string | null;
  client: CrmClient;
  contacts: CrmContact[];
  projects: CrmProject[];
  onClose: () => void;
  onSaved?: () => void;
  currentUserId?: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';
const inputStyle = { background: '#111', colorScheme: 'dark' as const };
const labelCls = 'text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1';

const ClientContractGenerator: React.FC<Props> = ({ initialData, editingDocId, client, contacts, projects, onClose, onSaved, currentUserId }) => {
  // ── Bank accounts ──
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');

  useEffect(() => {
    fetchBankAccounts().then(accs => {
      setBankAccounts(accs);
      // Default: Techcombank TD GAMES (primary account for client contracts)
      const techcom = accs.find(a => a.entity === 'TD GAMES' && a.bank_name?.toLowerCase().includes('techcom'));
      if (techcom) {
        setSelectedBankId(techcom.id);
      } else {
        // Fallback: first TD GAMES account
        const fallback = accs.find(a => a.entity === 'TD GAMES');
        if (fallback) setSelectedBankId(fallback.id);
      }
    }).catch(() => {});
  }, []);

  // ── Contract info ──
  // ponytail: đoán theo quốc gia/MST, vẫn cho sửa tay — khách "Viet Nam" hay có MST VN thì mặc định nội địa
  const isVnClient = /viet\s*nam|việt\s*nam/i.test(`${(client as any).country || ''}`)
    || /^\d{10}(-\d{3})?$/.test((client.tax_code || '').trim());
  const [contractType, setContractType] = useState<'domestic' | 'international'>(
    isVnClient ? 'domestic' : 'international',
  );
  const [contractNumber, setContractNumber] = useState(generateContractNumber());
  const [signingDate, setSigningDate] = useState(todayStr());
  const [companyKey, setCompanyKey] = useState<CompanyKey>('tdgames');

  // ── Party A (client) ──
  const [clientName, setClientName] = useState(client.name || '');
  const [clientAddress, setClientAddress] = useState(client.address || '');
  const [clientTaxCode, setClientTaxCode] = useState(client.tax_code || '');
  const [clientRep, setClientRep] = useState(client.contact_person || contacts[0]?.name || '');
  const [clientRepTitle, setClientRepTitle] = useState(contacts[0]?.position || '');

  // ── Project ──
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');

  // ── Scope ──
  const [scopeContent, setScopeContent] = useState('');
  const [scopeTemplates, setScopeTemplates] = useState<ScopeTemplate[]>(getScopeTemplates());
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [scopeBackup, setScopeBackup] = useState<string | null>(null);

  const handleAiFormat = async () => {
    setAiError('');
    setAiBusy(true);
    try {
      const html = await formatScopeWithAI(scopeContent);
      setScopeBackup(scopeContent);
      setScopeContent(html);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Lỗi không xác định.');
    } finally {
      setAiBusy(false);
    }
  };

  // ── Timeline ──
  const [startDate, setStartDate] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');

  // ── Payment ──
  const [totalValue, setTotalValue] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [phaseCount, setPhaseCount] = useState(2);
  // ponytail: khach noi dia bat buoc VND (TT 32/2013) - ep ngay khi doi loai hop dong
  useEffect(() => { if (contractType === 'domestic') setCurrency('VND'); }, [contractType]);
  const [phases, setPhases] = useState<PaymentPhase[]>([
    { label: 'Phase 1 – Deposit / Tạm ứng', percentage: 50, amount: 0, description: 'Upon contract signing / Khi ký hợp đồng' },
    { label: 'Phase 2 – Final / Thanh toán cuối', percentage: 50, amount: 0, description: 'Prior to source file handover / Trước khi bàn giao file gốc' },
  ]);

  // ── Nap lai hop dong da luu (mo de sua) ──
  // ponytail: chay 1 lan, sau do form tu do nhu binh thuong
  useEffect(() => {
    if (!initialData) return;
    setContractType(initialData.contractType || 'international');
    setContractNumber(initialData.contractNumber || '');
    setSigningDate(initialData.signingDate || todayStr());
    setCompanyKey(initialData.companyKey || 'tdgames');
    setClientName(initialData.clientName || '');
    setClientAddress(initialData.clientAddress || '');
    setClientTaxCode(initialData.clientTaxCode || '');
    setClientRep(initialData.clientRepresentative || '');
    setClientRepTitle(initialData.clientRepresentativeTitle || '');
    setProjectName(initialData.projectName || '');
    setScopeContent(initialData.scopeContent || '');
    setStartDate(initialData.startDate || '');
    setEstimatedDuration(initialData.estimatedDuration || '');
    setEstimatedCompletion(initialData.estimatedCompletion || '');
    setTotalValue(initialData.totalValue || 0);
    setCurrency(initialData.currency || 'USD');
    if (initialData.phases?.length) {
      setPhaseCount(initialData.phases.length);
      setPhases(initialData.phases);
    }
  }, [initialData]);

  // ── UI state ──
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Auto-fill project ──
  useEffect(() => {
    if (!selectedProjectId) return;
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj) {
      setProjectName(proj.name);
      if (proj.budget) setTotalValue(proj.budget);
      if (proj.currency) setCurrency(proj.currency);
      if (proj.start_date) setStartDate(proj.start_date);
      if (proj.end_date) setEstimatedCompletion(proj.end_date);
    }
  }, [selectedProjectId]);

  // ── Update phase amounts when total changes ──
  useEffect(() => {
    setPhases(prev => prev.map(p => ({ ...p, amount: Math.round(totalValue * p.percentage / 100) })));
  }, [totalValue]);

  // ── Rebuild phase array when count changes ──
  useEffect(() => {
    const pct = Math.floor(100 / phaseCount);
    const newPhases: PaymentPhase[] = Array.from({ length: phaseCount }, (_, i) => {
      const isLast = i === phaseCount - 1;
      const percentage = isLast ? 100 - pct * (phaseCount - 1) : pct;
      return {
        label: i === 0 ? 'Phase 1 – Deposit / Tạm ứng' : `Phase ${i + 1}${isLast ? ' – Final / Thanh toán cuối' : ''}`,
        percentage,
        amount: Math.round(totalValue * percentage / 100),
        description: i === 0 ? 'Upon contract signing / Khi ký hợp đồng' : (isLast ? 'Prior to source file handover / Trước khi bàn giao file gốc' : ''),
      };
    });
    setPhases(newPhases);
  }, [phaseCount]);

  // ── Selected bank account ──
  const selectedBank = bankAccounts.find(a => a.id === selectedBankId);

  // ── Auto-switch bank when company changes ──
  useEffect(() => {
    const entityMap: Record<CompanyKey, string> = { tdgames: 'TD GAMES', tdconsulting: 'TD CONSULTING' };
    const match = bankAccounts.find(a => a.entity === entityMap[companyKey]);
    if (match) setSelectedBankId(match.id);
  }, [companyKey, bankAccounts]);

  // ── Dung payload dung chung cho preview va luu ──
  const buildData = (): ClientContractData => ({
    contractNumber, signingDate, companyKey,
    clientName, clientAddress, clientTaxCode,
    clientRepresentative: clientRep, clientRepresentativeTitle: clientRepTitle,
    projectName, scopeContent,
    startDate, estimatedDuration, estimatedCompletion,
    contractType, totalValue, currency, phases,
    bankAccountName: selectedBank?.name || undefined,
    bankName: selectedBank?.bank_name || undefined,
    bankAccountNumber: selectedBank?.account_number || undefined,
    bankSwiftCode: selectedBank?.swift_code || undefined,
    bankCitadCode: selectedBank?.citad_code || undefined,
    bankAddress: selectedBank?.bank_address || undefined,
  });

  // ── Generate preview ──
  useEffect(() => {
    const data: ClientContractData = {
      contractNumber, signingDate, companyKey,
      clientName, clientAddress, clientTaxCode,
      clientRepresentative: clientRep, clientRepresentativeTitle: clientRepTitle,
      projectName, scopeContent,
      startDate, estimatedDuration, estimatedCompletion,
      contractType, totalValue, currency, phases,
      bankAccountName: selectedBank?.name || undefined,
      bankName: selectedBank?.bank_name || undefined,
      bankAccountNumber: selectedBank?.account_number || undefined,
      bankSwiftCode: selectedBank?.swift_code || undefined,
      bankCitadCode: selectedBank?.citad_code || undefined,
      bankAddress: selectedBank?.bank_address || undefined,
    };
    setPreviewHtml(generateClientContract(data));
  }, [contractNumber, signingDate, companyKey, clientName, clientAddress, clientTaxCode, clientRep, clientRepTitle, projectName, scopeContent, startDate, estimatedDuration, estimatedCompletion, contractType, totalValue, currency, phases, selectedBankId, bankAccounts]);

  // ── Write preview to iframe ──
  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) { doc.open(); doc.write(previewHtml); doc.close(); }
  }, [previewHtml]);

  // ── Print ──
  const handlePrint = () => {
    printContract(previewHtml);
  };

  // ── Save to crm_documents ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        client_id: client.id,
        project_id: selectedProjectId || null,
        doc_type: 'contract',
        title: `${contractNumber} — ${projectName || client.name}`,
        file_name: `${contractNumber}.pdf`,
        // ponytail: luu nguyen payload -> mo lai sua duoc. Truoc day chi luu
        // metadata nen hop dong da luu khong xem lai va khong sua lai duoc.
        contract_data: buildData(),
        contract_value: totalValue || null,
        contract_currency: currency,
      };
      if (editingDocId) {
        await supabase.from('crm_documents').update(payload).eq('id', editingDocId);
      } else {
        await supabase.from('crm_documents').insert({
          ...payload,
          file_url: '',
          file_size: 0,
          approval_status: 'pending_approval',
          created_by: currentUserId || null,
        });
      }
      setSaveSuccess(true);
      onSaved?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Save scope template ──
  const handleSaveScopeTemplate = () => {
    if (!templateName.trim() || !scopeContent.trim()) return;
    saveScopeTemplate(templateName.trim(), scopeContent);
    setScopeTemplates(getScopeTemplates());
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  // ── Render ──
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', height: 56, background: '#111', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#FF9500' }}>Tạo hợp đồng khách hàng</span>
        <span style={{ fontSize: 12, color: '#888' }}>{client.name}</span>
        <div style={{ flex: 1 }} />

        {saveSuccess && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✅ Đã lưu</span>}

        <button onClick={handleSave} disabled={saving} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 900, color: '#fff', background: '#10b981', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: 1 }}>
          {saving ? 'Đang lưu...' : '💾 Lưu'}
        </button>
        <button onClick={handlePrint} style={{ padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 900, color: '#fff', background: '#FF9500', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
          🖨️ In / PDF
        </button>
        <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, color: '#888', background: 'transparent', border: '1px solid #333', cursor: 'pointer' }}>✕</button>
      </div>

      {/* ── Body: Sidebar + Preview ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 340, background: '#0F0F0F', borderRight: '1px solid #222', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Contract info */}
          <div>
            <p className={labelCls}>Số hợp đồng</p>
            <input value={contractNumber} onChange={e => setContractNumber(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Ngày ký</p>
            <input type="date" value={signingDate} onChange={e => setSigningDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Pháp nhân (Bên B)</p>
            <select value={companyKey} onChange={e => setCompanyKey(e.target.value as CompanyKey)} className={inputCls} style={inputStyle}>
              {(Object.keys(COMPANY_OPTIONS) as CompanyKey[]).map(k => (
                <option key={k} value={k}>{COMPANY_OPTIONS[k].nameShort}</option>
              ))}
            </select>
          </div>
          <div>
            <p className={labelCls}>Tài khoản ngân hàng</p>
            <select value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— Chọn tài khoản —</option>
              {bankAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.bank_name} {a.account_number ? `(${a.account_number})` : ''}</option>
              ))}
            </select>
            {selectedBank && (
              <p style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{selectedBank.bank_name} • {selectedBank.account_number} • {selectedBank.currency}</p>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />

          {/* Party A */}
          <p style={{ fontSize: 11, fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: 2 }}>Bên A (Khách hàng)</p>
          <div>
            <p className={labelCls}>Tên công ty</p>
            <input value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Địa chỉ</p>
            <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Mã số thuế</p>
            <input value={clientTaxCode} onChange={e => setClientTaxCode(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Người đại diện</p>
            <input value={clientRep} onChange={e => setClientRep(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Chức vụ</p>
            <input value={clientRepTitle} onChange={e => setClientRepTitle(e.target.value)} className={inputCls} style={inputStyle} />
          </div>

          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />

          {/* Project */}
          <p style={{ fontSize: 11, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 2 }}>Dự án</p>
          {projects.length > 0 && (
            <div>
              <p className={labelCls}>Chọn dự án</p>
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">— Nhập thủ công —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className={labelCls}>Tên dự án</p>
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. Hell Forge" />
          </div>

          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />

          {/* Scope */}
          <p style={{ fontSize: 11, fontWeight: 900, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 2 }}>Phạm vi công việc</p>
          {scopeTemplates.length > 0 && (
            <div>
              <p className={labelCls}>Chọn từ template</p>
              <select onChange={e => { const t = scopeTemplates.find(t => t.name === e.target.value); if (t) setScopeContent(t.content); }} className={inputCls} style={inputStyle}>
                <option value="">— Chọn template —</option>
                {scopeTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className={labelCls}>Nội dung scope (HTML)</p>
            <textarea value={scopeContent} onChange={e => setScopeContent(e.target.value)} rows={8} className={inputCls + ' resize-none'} style={inputStyle} placeholder="Paste text thô ở đây rồi bấm AI FORMAT..." />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={handleAiFormat}
              disabled={aiBusy || scopeContent.trim().length < 10}
              style={{ fontSize: 10, color: '#fff', background: aiBusy || scopeContent.trim().length < 10 ? '#4b3a1a' : '#FF9500', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: aiBusy || scopeContent.trim().length < 10 ? 'not-allowed' : 'pointer', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              {aiBusy ? 'Đang format…' : '✨ AI Format'}
            </button>
            {scopeBackup !== null && !aiBusy && (
              <button
                onClick={() => { setScopeContent(scopeBackup); setScopeBackup(null); }}
                style={{ fontSize: 10, color: '#a3a3a3', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                Hoàn tác
              </button>
            )}
          </div>
          {aiError && <p style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{aiError}</p>}
          {!showSaveTemplate ? (
            <button onClick={() => setShowSaveTemplate(true)} style={{ fontSize: 10, color: '#a855f7', background: 'transparent', border: '1px solid rgba(168,85,247,0.3)', padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Lưu làm template
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Tên template..." className={inputCls} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleSaveScopeTemplate} style={{ fontSize: 10, color: '#fff', background: '#a855f7', border: 'none', padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 900 }}>Lưu</button>
            </div>
          )}

          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />

          {/* Timeline */}
          <p style={{ fontSize: 11, fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: 2 }}>Tiến độ</p>
          <div>
            <p className={labelCls}>Ngày bắt đầu</p>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className={labelCls}>Thời gian dự kiến</p>
            <input value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. 4-5 weeks" />
          </div>
          <div>
            <p className={labelCls}>Ngày hoàn thành dự kiến</p>
            <input type="date" value={estimatedCompletion} onChange={e => setEstimatedCompletion(e.target.value)} className={inputCls} style={inputStyle} />
          </div>

          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />

          {/* Payment */}
          <p style={{ fontSize: 11, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: 2 }}>Thanh toán</p>
          <div style={{ marginBottom: 8 }}>
            <p className={labelCls}>Loại hợp đồng</p>
            <select value={contractType} onChange={e => setContractType(e.target.value as 'domestic' | 'international')}
              className={inputCls} style={inputStyle}>
              <option value="international">Khách nước ngoài — ngoại tệ, phí CK quốc tế</option>
              <option value="domestic">Khách Việt Nam — bắt buộc VND</option>
            </select>
            {contractType === 'domestic' && (
              <p style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                Khách trong nước: hợp đồng phải ghi giá bằng VND (Thông tư 32/2013/TT-NHNN).
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p className={labelCls}>Tổng giá trị</p>
              <input type="number" value={totalValue || ''} onChange={e => setTotalValue(Number(e.target.value) || 0)} className={inputCls} style={inputStyle} />
            </div>
            <div style={{ width: 80 }}>
              <p className={labelCls}>Tiền tệ</p>
              <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={contractType === 'domestic'}
                className={inputCls} style={{ ...inputStyle, opacity: contractType === 'domestic' ? 0.6 : 1 }}>
                {contractType === 'domestic'
                  ? <option value="VND">VND</option>
                  : <><option value="USD">USD</option><option value="VND">VND</option></>}
              </select>
            </div>
          </div>
          <div>
            <p className={labelCls}>Số đợt thanh toán</p>
            <select value={phaseCount} onChange={e => setPhaseCount(Number(e.target.value))} className={inputCls} style={inputStyle}>
              <option value={2}>2 đợt</option>
              <option value={3}>3 đợt</option>
              <option value={4}>4 đợt</option>
            </select>
          </div>
          {phases.map((p, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#888', marginBottom: 4 }}>{p.label}</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" value={p.percentage} onChange={e => {
                  const next = [...phases];
                  next[i] = { ...next[i], percentage: Number(e.target.value) || 0, amount: Math.round(totalValue * (Number(e.target.value) || 0) / 100) };
                  setPhases(next);
                }} style={{ ...inputStyle, width: 50, padding: '2px 4px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, textAlign: 'center' as const }} />
                <span style={{ fontSize: 11, color: '#666' }}>% = {p.amount.toLocaleString()} {currency}</span>
              </div>
            </div>
          ))}

          <div style={{ height: 40 }} />
        </div>

        {/* ── Preview ── */}
        <div style={{ flex: 1, background: '#2a2a2a', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <iframe
            ref={iframeRef}
            style={{ width: '210mm', minHeight: '297mm', background: 'white', border: 'none', boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ClientContractGenerator;
