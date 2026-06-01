import React from 'react';
import { InvoiceData, ServiceItem, BankingInfo, ClientRecord, StudioRecord, StudioInfo } from '@/types';
import { Button } from '@/components/Button';
import { Input, TextArea, Select } from '@/components/FormElements';
import { BankAccount } from '@/apps/expense/services/bankAccountService';
import { InvoicePreview } from './InvoicePreview';

interface InvoiceEditorProps {
  invoice: InvoiceData;
  activeTab: 'edit' | 'preview';
  // Data
  studios: StudioRecord[];
  banks: (BankingInfo & { id: string; isDefault: boolean })[];
  clients: ClientRecord[];
  crmProjects: { id: string; name: string; client_id: string }[];
  // State
  isLoading: boolean;
  isExporting: string | null;
  showBankManager: boolean;
  showStudioManager: boolean;
  editingBankId: string | null;
  editingBankData: BankingInfo | null;
  editingStudioId: string | null;
  editingStudioData: StudioInfo | null;
  newStudio: StudioInfo;
  newBank: BankingInfo;
  clientSuggestions: ClientRecord[];
  showSuggestions: boolean;
  eInvoiceProgress: string | null;
  // Callbacks
  updateInvoice: (path: string, value: any) => void;
  updateItem: (id: string, field: keyof ServiceItem, value: any) => void;
  formatCurrencySimple: (val: number, curr: string) => string;
  onExport: (format: 'pdf' | 'png' | 'excel' | 'word') => void;
  onSaveToCloud: () => void;
  onCreateEInvoice: () => void;
  onBankSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSaveClient: () => void;
  onSelectClient: (id: string) => void;
  setShowSuggestions: (v: boolean) => void;
  setClientSuggestions: (v: ClientRecord[]) => void;
  // Bank handlers
  setShowBankManager: (v: boolean) => void;
  setNewBank: (v: BankingInfo) => void;
  onAddBank: () => void;
  onDeleteBank: (id: string) => void;
  onSetDefaultBank: (id: string) => void;
  onEditBank: (bank: BankingInfo & { id: string; isDefault: boolean }) => void;
  onCancelEditBank: () => void;
  onUpdateBank: () => void;
  setEditingBankData: (v: BankingInfo | null) => void;
  // Studio handlers
  setShowStudioManager: (v: boolean) => void;
  setNewStudio: (v: StudioInfo) => void;
  onAddStudio: () => void;
  onDeleteStudio: (id: string) => void;
  onSetDefaultStudio: (id: string) => void;
  onEditStudio: (s: StudioRecord) => void;
  onUpdateStudio: () => void;
  setEditingStudioId: (v: string | null) => void;
  setEditingStudioData: (v: StudioInfo | null) => void;
  bankAccounts: BankAccount[];
}

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({
  invoice, activeTab,
  studios, banks, clients, crmProjects,
  isLoading, isExporting, showBankManager, showStudioManager,
  editingBankId, editingBankData, editingStudioId, editingStudioData,
  newStudio, newBank, clientSuggestions, showSuggestions, eInvoiceProgress,
  updateInvoice, updateItem, formatCurrencySimple,
  onExport, onSaveToCloud, onCreateEInvoice, onBankSelect, onSaveClient, onSelectClient,
  setShowSuggestions, setClientSuggestions,
  setShowBankManager, setNewBank, onAddBank, onDeleteBank, onSetDefaultBank, onEditBank, onCancelEditBank, onUpdateBank, setEditingBankData,
  setShowStudioManager, setNewStudio, onAddStudio, onDeleteStudio, onSetDefaultStudio, onEditStudio, onUpdateStudio, setEditingStudioId, setEditingStudioData,
  bankAccounts,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
    {/* ── LEFT SIDEBAR ── */}
    <div className="lg:col-span-4 space-y-8 h-fit lg:sticky lg:top-32 actions-sidebar no-print">
      {/* Actions */}
      <section className={`p-8 rounded-[24px] border shadow-xl ${invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-100'}`}>
        <h2 className="text-xl font-black uppercase tracking-tighter text-primary mb-6">Actions</h2>
        <div className="space-y-4">
          <Button onClick={() => onExport('pdf')} disabled={isExporting !== null} variant="primary" className="w-full text-sm py-4 shadow-btn-glow">
            {isExporting === 'pdf' ? 'Preparing...' : 'EXPORT PDF'}
          </Button>
          <Button onClick={onSaveToCloud} disabled={isLoading} variant="ghost" className="w-full !py-4 border border-primary/20 hover:bg-primary/5">
            {isLoading ? 'Syncing...' : 'Save Invoice'}
          </Button>
          <button
            onClick={onCreateEInvoice}
            disabled={!!eInvoiceProgress}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest border-2 border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {eInvoiceProgress ? 'Processing...' : 'Create eInvoice'}
          </button>
          {invoice.einvoice_status === 'draft' && invoice.einvoice_pdf_url && (
            <a href={invoice.einvoice_pdf_url} target="_blank" rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2">
              View Draft PDF
            </a>
          )}
        </div>
      </section>

      {/* Config */}
      <section className={`p-8 rounded-[24px] border ${invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-tighter text-primary">Config</h2>
          <button onClick={() => setShowBankManager(!showBankManager)} className={`p-2 rounded-lg transition-all ${showBankManager ? 'bg-primary text-black' : 'text-primary hover:bg-primary/10'}`}>
            <svg className={`w-5 h-5 transform transition-transform ${showBankManager ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          {studios.length > 0 && (
            <Select label="Studio Profile" onChange={e => { const s = studios.find(x => x.id === e.target.value); if (s) { const { id, isDefault, ...info } = s; updateInvoice('studioInfo', info); } }}>
              <option value="">-- Select Studio --</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>)}
            </Select>
          )}
          <Select label="Banking Profile" onChange={onBankSelect}>
            <option value="">-- Select Account --</option>
            {banks.map(b => (<option key={b.id} value={b.id}>{b.alias || b.accountName}</option>))}
          </Select>
          <Select label="Invoice Theme" value={invoice.theme} onChange={(e) => updateInvoice('theme', e.target.value)}>
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </Select>
          <Select label="Status" value={invoice.status} onChange={(e) => updateInvoice('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Currency" value={invoice.currency} onChange={(e) => updateInvoice('currency', e.target.value)}>
              <option value="USD">USD</option>
              <option value="VND">VND</option>
            </Select>
            <Input label="Invoice #" value={invoice.invoiceNumber} onChange={(e) => updateInvoice('invoiceNumber', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Issue Date" type="date" value={invoice.issueDate} onChange={(e) => updateInvoice('issueDate', e.target.value)} />
            <Input label="Due Date" type="date" value={invoice.dueDate} onChange={(e) => updateInvoice('dueDate', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="PO Number (tuỳ chọn)" value={invoice.poNumber || ''} onChange={(e) => updateInvoice('poNumber', e.target.value)} placeholder="e.g. 10575-O3" />
            <Input label="Service Location (tuỳ chọn)" value={invoice.serviceLocation || ''} onChange={(e) => updateInvoice('serviceLocation', e.target.value)} placeholder="e.g. Services were performed at Hanoi, Vietnam." />
          </div>
          {crmProjects.length > 0 && (
            <Select
              label="🔗 Dự án CRM (tuỳ chọn)"
              value={invoice.crm_project_id || ''}
              onChange={(e) => updateInvoice('crm_project_id', e.target.value || null)}
            >
              <option value="">-- Không liên kết --</option>
              {crmProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}

          {/* ── Pháp nhân & TK nhận tiền ── */}
          <Select
            label="🏢 Pháp nhân phát hành"
            value={invoice.billing_entity || 'TD GAMES'}
            onChange={(e) => updateInvoice('billing_entity', e.target.value)}
          >
            <option value="TD GAMES">TD GAMES</option>
            <option value="TD CONSULTING">TD CONSULTING</option>
            <option value="Cá nhân">Cá nhân (không xuất HĐ)</option>
          </Select>
          {bankAccounts.length > 0 && (
            <Select
              label="🏦 TK ngân hàng nhận tiền"
              value={invoice.receiving_account_id || ''}
              onChange={(e) => updateInvoice('receiving_account_id', e.target.value || null)}
            >
              <option value="">— Chưa chọn —</option>
              {bankAccounts
                .filter(a => {
                  const entity = invoice.billing_entity || 'TD GAMES';
                  if (entity === 'Cá nhân') return a.account_type === 'personal';
                  return a.entity === entity;
                })
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))
              }
            </Select>
          )}
        </div>
      </section>

      {/* Bank Manager Panel */}
      {showBankManager && (
        <section className={`p-8 rounded-[24px] border animate-fadeInUp ${invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-100 shadow-lg'}`}>
          <h2 className="text-xl font-black uppercase tracking-tighter text-primary mb-6">Manage Banks</h2>
          <div className="space-y-4 mb-8 bg-black/40 p-5 rounded-[20px] border border-white/5">
            <Input label="Alias (e.g. MB Personal)" value={newBank.alias} onChange={(e) => setNewBank({ ...newBank, alias: e.target.value })} placeholder="Alias..." />
            <Input label="Beneficiary Name" value={newBank.accountName} onChange={(e) => setNewBank({ ...newBank, accountName: e.target.value })} />
            <Input label="Account Number" value={newBank.accountNumber} onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })} />
            <Input label="Bank Name" value={newBank.bankName} onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })} />
            <Input label="Branch" value={newBank.branchName} onChange={(e) => setNewBank({ ...newBank, branchName: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="SWIFT" value={newBank.swiftCode} onChange={(e) => setNewBank({ ...newBank, swiftCode: e.target.value })} />
              <Input label="CITAD" value={newBank.citadCode} onChange={(e) => setNewBank({ ...newBank, citadCode: e.target.value })} />
            </div>
            <Button onClick={onAddBank} variant="primary" size="sm" className="w-full" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Save Profile'}
            </Button>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {banks.length === 0 && <p className="text-center py-8 opacity-30 text-[10px] font-black uppercase tracking-widest">Empty Storage</p>}
            {banks.map(b => (
              <div key={b.id} className={`rounded-xl border transition-all relative overflow-hidden ${editingBankId === b.id ? (invoice.theme === 'dark' ? 'bg-primary/5 border-primary/50' : 'bg-orange-50 border-primary/40') : invoice.theme === 'dark' ? 'bg-black/20 border-white/5 hover:border-primary/30' : 'bg-gray-50 border-gray-200 hover:border-primary/40'}`}>
                {editingBankId === b.id && editingBankData ? (
                  <div className="p-4 space-y-3">
                    <p className="text-[9px] font-black uppercase text-primary/60 mb-2 tracking-widest">Editing</p>
                    <input placeholder="Alias" value={editingBankData.alias || ''} onChange={e => setEditingBankData({ ...editingBankData, alias: e.target.value })}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    <input placeholder="Beneficiary Name" value={editingBankData.accountName} onChange={e => setEditingBankData({ ...editingBankData, accountName: e.target.value })}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    <input placeholder="Account Number" value={editingBankData.accountNumber} onChange={e => setEditingBankData({ ...editingBankData, accountNumber: e.target.value })}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    <input placeholder="Bank Name" value={editingBankData.bankName} onChange={e => setEditingBankData({ ...editingBankData, bankName: e.target.value })}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    <input placeholder="Branch" value={editingBankData.branchName} onChange={e => setEditingBankData({ ...editingBankData, branchName: e.target.value })}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="SWIFT" value={editingBankData.swiftCode} onChange={e => setEditingBankData({ ...editingBankData, swiftCode: e.target.value })}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                      <input placeholder="CITAD" value={editingBankData.citadCode} onChange={e => setEditingBankData({ ...editingBankData, citadCode: e.target.value })}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={onUpdateBank} disabled={isLoading}
                        className="flex-1 py-2 rounded-lg bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-primary/80 transition-colors">
                        {isLoading ? '...' : 'Save'}
                      </button>
                      <button onClick={onCancelEditBank}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-black'}`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center p-4 gap-3">
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[7px] font-black uppercase text-primary/60">CLOUD</p>
                        {b.isDefault && (<span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary text-black leading-none">DEFAULT</span>)}
                      </div>
                      <p className="text-xs font-black text-primary truncate uppercase">{b.alias || b.accountName}</p>
                      <p className="text-[10px] font-bold opacity-80">{b.accountName}</p>
                      <p className="text-[10px] opacity-40 tabular-nums">{b.accountNumber} • {b.bankName}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => onSetDefaultBank(b.id)} title={b.isDefault ? 'Default' : 'Set as default'}
                        className={`p-2 rounded-lg transition-all ${b.isDefault ? 'text-primary bg-primary/10' : invoice.theme === 'dark' ? 'text-white/30 hover:text-primary hover:bg-primary/10' : 'text-gray-300 hover:text-primary hover:bg-primary/10'}`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={b.isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button onClick={() => onEditBank(b)} title="Edit"
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => onDeleteBank(b.id)} title="Delete"
                        className="p-2 text-status-error hover:bg-status-error/10 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Studio Manager Panel */}
      <section className={`p-8 rounded-[24px] border ${invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-tighter text-primary">Studios</h2>
          <button onClick={() => setShowStudioManager(!showStudioManager)}
            className={`p-2 rounded-lg transition-all ${showStudioManager ? 'bg-primary text-black' : 'text-primary hover:bg-primary/10'}`}>
            <svg className={`w-5 h-5 transform transition-transform ${showStudioManager ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        {showStudioManager && (
          <div>
            <div className="space-y-3 mb-6 bg-black/30 p-4 rounded-[16px] border border-white/5">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Add New Studio</p>
              <input placeholder="Company Name *" value={newStudio.name} onChange={e => setNewStudio({ ...newStudio, name: e.target.value })}
                className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
              <input placeholder="Email" value={newStudio.email} onChange={e => setNewStudio({ ...newStudio, email: e.target.value })}
                className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
              <input placeholder="Tax Code" value={newStudio.taxCode} onChange={e => setNewStudio({ ...newStudio, taxCode: e.target.value })}
                className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
              <textarea placeholder="Address" value={newStudio.address} onChange={e => setNewStudio({ ...newStudio, address: e.target.value })} rows={2}
                className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors resize-none ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
              <Button onClick={onAddStudio} variant="primary" size="sm" className="w-full" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Studio'}
              </Button>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {studios.length === 0 && <p className="text-center py-6 opacity-30 text-[10px] font-black uppercase tracking-widest">No studios yet</p>}
              {studios.map(s => (
                <div key={s.id} className={`rounded-xl border transition-all relative overflow-hidden ${editingStudioId === s.id ? (invoice.theme === 'dark' ? 'bg-primary/5 border-primary/50' : 'bg-orange-50 border-primary/40') : invoice.theme === 'dark' ? 'bg-black/20 border-white/5 hover:border-primary/30' : 'bg-gray-50 border-gray-200 hover:border-primary/40'}`}>
                  {editingStudioId === s.id && editingStudioData ? (
                    <div className="p-4 space-y-2">
                      <p className="text-[9px] font-black uppercase text-primary/60 mb-2 tracking-widest">Editing</p>
                      <input placeholder="Company Name" value={editingStudioData.name} onChange={e => setEditingStudioData({ ...editingStudioData, name: e.target.value })}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                      <input placeholder="Email" value={editingStudioData.email} onChange={e => setEditingStudioData({ ...editingStudioData, email: e.target.value })}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                      <input placeholder="Tax Code" value={editingStudioData.taxCode} onChange={e => setEditingStudioData({ ...editingStudioData, taxCode: e.target.value })}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                      <textarea placeholder="Address" value={editingStudioData.address} onChange={e => setEditingStudioData({ ...editingStudioData, address: e.target.value })} rows={2}
                        className={`w-full text-xs font-bold px-3 py-2 rounded-lg border outline-none bg-transparent focus:border-primary transition-colors resize-none ${invoice.theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-300 text-black'}`} />
                      <div className="flex gap-2">
                        <button onClick={onUpdateStudio} disabled={isLoading} className="flex-1 py-2 rounded-lg bg-primary text-black text-[10px] font-black uppercase">{isLoading ? '...' : 'Save'}</button>
                        <button onClick={() => { setEditingStudioId(null); setEditingStudioData(null); }} className="flex-1 py-2 rounded-lg border border-white/10 text-[10px] font-black uppercase opacity-60 hover:opacity-100">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black truncate">{s.name}</p>
                          {s.isDefault && <span className="text-[9px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-widest">Default</span>}
                        </div>
                        <p className={`text-[11px] truncate ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>{s.email} {s.taxCode ? `· Tax: ${s.taxCode}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={() => onSetDefaultStudio(s.id)} title="Set default" className={`p-1.5 rounded-lg transition-colors ${s.isDefault ? 'text-yellow-400' : 'text-neutral-medium hover:text-yellow-400'}`}>
                          {s.isDefault ? '⭐' : '☆'}
                        </button>
                        <button onClick={() => onEditStudio(s)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => onDeleteStudio(s.id)} className="p-1.5 text-status-error hover:bg-status-error/10 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>

    {/* ── RIGHT CONTENT ── */}
    <div className="lg:col-span-8">
      {activeTab === 'edit' ? (
        <div className="space-y-12 animate-fadeInUp">
          {/* Client Details */}
          <div className={`p-8 md:p-12 rounded-[24px] border ${invoice.theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-100 shadow-md'}`}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center">
                <span className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center mr-4 text-sm">01</span>
                Client Details
              </h2>
              <button onClick={onSaveClient}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase text-primary border border-primary/30 hover:bg-primary/10 transition-all">
                Save Client
              </button>
            </div>

            {/* Client Type Toggle */}
            <div className="mb-6">
              <div className={`inline-flex p-1 rounded-xl border ${invoice.theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                <button type="button" onClick={() => updateInvoice('clientInfo.clientType', 'individual')}
                  className={`px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${(invoice.clientInfo.clientType || 'company') === 'individual' ? 'bg-primary text-black shadow-btn-glow' : invoice.theme === 'dark' ? 'text-neutral-medium hover:text-white' : 'text-gray-500 hover:text-black'}`}>
                  Individual
                </button>
                <button type="button" onClick={() => updateInvoice('clientInfo.clientType', 'company')}
                  className={`px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${(invoice.clientInfo.clientType || 'company') === 'company' ? 'bg-primary text-black shadow-btn-glow' : invoice.theme === 'dark' ? 'text-neutral-medium hover:text-white' : 'text-gray-500 hover:text-black'}`}>
                  Company
                </button>
              </div>
            </div>

            {/* Saved client selector */}
            {clients.length > 0 && (
              <div className="mb-6">
                <Select label="Saved Clients" onChange={e => onSelectClient(e.target.value)}>
                  <option value="">-- Quick select client --</option>
                  {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </Select>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Name with autocomplete */}
              <div className="md:col-span-2 relative">
                <Input
                  label={(invoice.clientInfo.clientType || 'company') === 'individual' ? 'Full Name' : 'Company Name'}
                  value={invoice.clientInfo.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateInvoice('clientInfo.name', val);
                    if (val.trim().length >= 1) {
                      const filtered = clients.filter(c => c.name.toLowerCase().includes(val.toLowerCase()));
                      setClientSuggestions(filtered);
                      setShowSuggestions(filtered.length > 0);
                    } else {
                      setShowSuggestions(false);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => {
                    if (invoice.clientInfo.name.trim().length >= 1) {
                      const filtered = clients.filter(c => c.name.toLowerCase().includes(invoice.clientInfo.name.toLowerCase()));
                      setClientSuggestions(filtered);
                      setShowSuggestions(filtered.length > 0);
                    }
                  }}
                  required
                />
                {showSuggestions && clientSuggestions.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border shadow-2xl overflow-hidden ${invoice.theme === 'dark' ? 'bg-[#1A1A1A] border-primary/20' : 'bg-white border-gray-200'}`}>
                    {clientSuggestions.map(c => (
                      <button key={c.id} type="button"
                        onMouseDown={() => { const { id, ...info } = c; updateInvoice('clientInfo', info); setShowSuggestions(false); }}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${invoice.theme === 'dark' ? 'hover:bg-primary/10' : 'hover:bg-orange-50'}`}>
                        <span className="text-primary text-sm">{c.clientType === 'individual' ? '👤' : '🏢'}</span>
                        <div>
                          <p className="text-sm font-black">{c.name}</p>
                          {(c.email || c.taxCode) && (
                            <p className={`text-[11px] ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                              {c.email}{c.taxCode ? ` · Tax: ${c.taxCode}` : ''}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input label={(invoice.clientInfo.clientType || 'company') === 'individual' ? 'Phone Number' : 'Contact Person'}
                value={invoice.clientInfo.contactPerson}
                onChange={(e) => updateInvoice('clientInfo.contactPerson', e.target.value)}
                placeholder={(invoice.clientInfo.clientType || 'company') === 'individual' ? 'e.g. 0912 345 678' : ''} />
              <Input label="Contact Email" type="email" value={invoice.clientInfo.email} onChange={(e) => updateInvoice('clientInfo.email', e.target.value)} placeholder="example@company.com" />
              {(invoice.clientInfo.clientType || 'company') === 'company' && (
                <Input label="Tax ID" value={invoice.clientInfo.taxCode || ''} onChange={(e) => updateInvoice('clientInfo.taxCode', e.target.value)} placeholder="e.g. 0123456789" />
              )}
              <div className="md:col-span-2">
                <TextArea label="Billing Address" value={invoice.clientInfo.address} onChange={(e) => updateInvoice('clientInfo.address', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Service Items */}
          <div className={`rounded-[24px] border overflow-hidden ${invoice.theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-100 shadow-md'}`}>
            <div className={`flex justify-between items-center px-8 py-6 border-b ${invoice.theme === 'dark' ? 'border-primary/10' : 'border-gray-100'}`}>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center">
                <span className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center mr-4 text-sm">02</span>
                Service Items
              </h2>
              <button onClick={() => updateInvoice('items', [...invoice.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }])}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase text-primary border border-primary/30 hover:bg-primary/10 transition-all">
                <span className="text-lg leading-none">+</span> Add Item
              </button>
            </div>
            <div className={`grid gap-0 px-8 py-3 text-[10px] font-black uppercase tracking-widest ${invoice.theme === 'dark' ? 'text-neutral-medium bg-black/20' : 'text-gray-400 bg-gray-50'}`}
              style={{ gridTemplateColumns: '1fr 80px 110px 130px 36px' }}>
              <span>Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>
            <div className="divide-y divide-primary/5">
              {invoice.items.map((item, idx) => (
                <div key={item.id}
                  className={`grid items-start gap-4 px-8 py-5 group transition-all ${invoice.theme === 'dark' ? 'hover:bg-white/2' : 'hover:bg-gray-50/50'}`}
                  style={{ gridTemplateColumns: '1fr 80px 110px 130px 36px' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-[11px] font-black text-primary/50 w-5 text-center shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                    <textarea value={item.description} onChange={(e) => { updateItem(item.id, 'description', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      placeholder="Service description..."
                      rows={1}
                      className={`w-full bg-transparent text-sm font-bold outline-none border-b border-transparent focus:border-primary/40 transition-colors pb-0.5 resize-none overflow-hidden ${invoice.theme === 'dark' ? 'text-white placeholder-white/20' : 'text-black placeholder-black/20'}`} />
                  </div>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                    className={`w-full bg-transparent text-sm font-bold text-center outline-none border-b border-transparent focus:border-primary/40 transition-colors pb-0.5 ${invoice.theme === 'dark' ? 'text-white' : 'text-black'}`} />
                  <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                    className={`w-full bg-transparent text-sm font-bold text-right outline-none border-b border-transparent focus:border-primary/40 transition-colors pb-0.5 ${invoice.theme === 'dark' ? 'text-white' : 'text-black'}`} />
                  <div className="text-right text-sm font-black text-primary tabular-nums">
                    {formatCurrencySimple(item.quantity * item.unitPrice, invoice.currency)}
                  </div>
                  <button onClick={() => invoice.items.length > 1 && updateInvoice('items', invoice.items.filter(i => i.id !== item.id))}
                    className={`opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg ${invoice.items.length > 1 ? 'text-red-400 hover:bg-red-500/10 cursor-pointer' : 'text-white/10 cursor-not-allowed'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className={`flex justify-end items-center gap-4 px-8 py-4 border-t ${invoice.theme === 'dark' ? 'border-primary/10 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
              <span className={`text-[11px] font-black uppercase tracking-widest ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Subtotal</span>
              <span className="text-base font-black tabular-nums text-primary min-w-[130px] text-right">
                {formatCurrencySimple(invoice.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0), invoice.currency)}
              </span>
            </div>
          </div>

          {/* Discount & Tax */}
          <div className={`rounded-[24px] border overflow-hidden ${invoice.theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-100 shadow-md'}`}>
            <div className={`flex items-center px-8 py-6 border-b ${invoice.theme === 'dark' ? 'border-primary/10' : 'border-gray-100'}`}>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-primary flex items-center">
                <span className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center mr-4 text-sm">03</span>
                Discount & Tax
              </h2>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-2 gap-6">
                {/* Discount */}
                <div className={`rounded-2xl border p-5 space-y-4 ${invoice.theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[11px] font-black uppercase tracking-widest ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Discount</label>
                    <div className={`flex rounded-lg overflow-hidden border text-[10px] font-black ${invoice.theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                      <button onClick={() => updateInvoice('discountType', 'percentage')}
                        className={`px-3 py-1.5 transition-all ${invoice.discountType === 'percentage' ? 'bg-primary text-black' : invoice.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-black'}`}>%</button>
                      <button onClick={() => updateInvoice('discountType', 'amount')}
                        className={`px-3 py-1.5 transition-all ${invoice.discountType === 'amount' ? 'bg-primary text-black' : invoice.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-black'}`}>{invoice.currency}</button>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="number" value={invoice.discountValue} min="0" onChange={(e) => updateInvoice('discountValue', Number(e.target.value))}
                      className={`w-full text-2xl font-black bg-transparent outline-none border-b-2 pb-2 transition-colors ${invoice.discountValue > 0 ? 'border-primary text-primary' : invoice.theme === 'dark' ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-300'}`} placeholder="0" />
                    <span className={`absolute right-0 bottom-3 text-[11px] font-black ${invoice.discountValue > 0 ? 'text-primary' : 'opacity-30'}`}>
                      {invoice.discountType === 'percentage' ? '%' : invoice.currency}
                    </span>
                  </div>
                  {invoice.discountValue > 0 && (() => {
                    const sub = invoice.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
                    const disc = invoice.discountType === 'percentage' ? sub * (invoice.discountValue / 100) : invoice.discountValue;
                    return <p className="text-[11px] font-bold text-[#4CAF50]">− {formatCurrencySimple(disc, invoice.currency)}</p>;
                  })()}
                </div>

                {/* Tax */}
                <div className={`rounded-2xl border p-5 space-y-4 ${invoice.theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
                  <label className={`text-[11px] font-black uppercase tracking-widest block ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Tax Rate</label>
                  <div className="relative">
                    <input type="number" value={invoice.taxRate} min="0" max="100" onChange={(e) => updateInvoice('taxRate', Number(e.target.value))}
                      className={`w-full text-2xl font-black bg-transparent outline-none border-b-2 pb-2 transition-colors ${invoice.taxRate > 0 ? 'border-primary text-primary' : invoice.theme === 'dark' ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-300'}`} placeholder="0" />
                    <span className={`absolute right-0 bottom-3 text-[11px] font-black ${invoice.taxRate > 0 ? 'text-primary' : 'opacity-30'}`}>%</span>
                  </div>
                  {invoice.taxRate > 0 && (() => {
                    const sub = invoice.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
                    const disc = invoice.discountType === 'percentage' ? sub * (invoice.discountValue / 100) : invoice.discountValue;
                    const tax = Math.max(0, sub - disc) * (invoice.taxRate / 100);
                    return <p className="text-[11px] font-bold">{formatCurrencySimple(tax, invoice.currency)}</p>;
                  })()}
                </div>
              </div>

              {/* Payment Method */}
              <div className="col-span-2 mt-2">
                <div className={`rounded-2xl border p-5 ${invoice.theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
                  <label className={`text-[11px] font-black uppercase tracking-widest block mb-3 ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Payment Method</label>
                  <div className="flex gap-2">
                    {(['CK', 'TM', 'TM/CK', 'KHAC'] as const).map(method => (
                      <button key={method} onClick={() => updateInvoice('payment_method', method)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${invoice.payment_method === method
                          ? 'bg-primary text-black shadow-btn-glow'
                          : invoice.theme === 'dark' ? 'border border-white/10 text-white/40 hover:text-white hover:border-white/30' : 'border border-gray-200 text-gray-400 hover:text-black hover:border-gray-400'
                          }`}>
                        {method === 'CK' ? 'Bank Transfer' : method === 'TM' ? 'Cash' : method === 'TM/CK' ? 'Cash/Bank' : 'Other'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary bar */}
              {(invoice.discountValue > 0 || invoice.taxRate > 0) && (() => {
                const sub = invoice.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
                const disc = invoice.discountType === 'percentage' ? sub * (invoice.discountValue / 100) : invoice.discountValue;
                const afterDisc = Math.max(0, sub - disc);
                const tax = afterDisc * (invoice.taxRate / 100);
                const total = afterDisc + tax;
                return (
                  <div className={`mt-6 rounded-2xl border px-6 py-5 ${invoice.theme === 'dark' ? 'border-primary/20 bg-primary/5' : 'border-primary/20 bg-orange-50'}`}>
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <div className="text-center">
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Subtotal</p>
                        <p className="text-sm font-black tabular-nums">{formatCurrencySimple(sub, invoice.currency)}</p>
                      </div>
                      {invoice.discountValue > 0 && (
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-[#4CAF50]/70">Discount</p>
                          <p className="text-sm font-black tabular-nums text-[#4CAF50]">− {formatCurrencySimple(disc, invoice.currency)}</p>
                        </div>
                      )}
                      {invoice.taxRate > 0 && (
                        <div className="text-center">
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Tax ({invoice.taxRate}%)</p>
                          <p className="text-sm font-black tabular-nums">{formatCurrencySimple(tax, invoice.currency)}</p>
                        </div>
                      )}
                      <div className={`col-span-${invoice.discountValue > 0 && invoice.taxRate > 0 ? 1 : invoice.discountValue > 0 || invoice.taxRate > 0 ? 2 : 3} text-right`}>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-primary">Grand Total</p>
                        <p className="text-xl font-black tabular-nums text-primary">{formatCurrencySimple(total, invoice.currency)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Studio Info */}
          <div className={`p-8 md:p-12 rounded-[24px] border ${invoice.theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-100 shadow-md'}`}>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-primary mb-8 flex items-center">
              <span className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center mr-4 text-sm">04</span>
              Studio Info
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Input className="md:col-span-2" label="Studio Name" value={invoice.studioInfo.name} onChange={(e) => updateInvoice('studioInfo.name', e.target.value)} />
              <Input label="Email" type="email" value={invoice.studioInfo.email} onChange={(e) => updateInvoice('studioInfo.email', e.target.value)} />
              <Input label="Tax Code (MST)" value={invoice.studioInfo.taxCode} onChange={(e) => updateInvoice('studioInfo.taxCode', e.target.value)} />
              <div className="md:col-span-2">
                <TextArea label="Studio Address" value={invoice.studioInfo.address} onChange={(e) => updateInvoice('studioInfo.address', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex justify-center animate-fadeInUp">
          <InvoicePreview data={invoice} />
        </div>
      )}
    </div>
  </div>
);
