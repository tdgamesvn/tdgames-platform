// HR → tab "Khảo sát" (giai đoạn 1: khảo sát thường).
// ponytail: sắp xếp câu hỏi bằng nút ↑↓ thay vì kéo thả — đủ dùng, khỏi thêm thư viện dnd.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  HrForm, HrFormQuestion, HrQuestionKind, HrFormAssignment, HrFormResponse, QUESTION_KIND_LABEL,
  fetchForms, fetchQuestions, saveForm, replaceQuestions, deleteForm, setFormStatus,
  openForm, remindForm, fetchAssignments, fetchResponses,
} from '../../services/hrFormService';
import QuestionField, { scaleRange } from './QuestionField';

interface Props { onToast: (msg: string, type: 'success' | 'error') => void }
type Emp = { id: string; full_name: string; status: string; auth_user_id: string | null; department_id: string | null; entity?: string | null };
type DraftQ = Omit<HrFormQuestion, 'id' | 'form_id' | 'position'> & { key: string };

const card = 'bg-surface border border-white/8 rounded-xl';
const input = 'w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white';
const btnP = 'bg-primary text-black font-black text-xs uppercase px-4 py-2 rounded-lg disabled:opacity-40';
const btnS = 'border border-white/10 text-white font-bold text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40';
const label = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider';
const STATUS: Record<string, [string, string]> = {
  draft: ['Nháp', 'bg-white/10 text-neutral-400'],
  open: ['Đang mở', 'bg-[#34C759]/15 text-[#34C759]'],
  closed: ['Đã đóng', 'bg-[#FF453A]/15 text-[#FF453A]'],
};
const newKey = () => Math.random().toString(36).slice(2);

const FormsTab: React.FC<Props> = ({ onToast }) => {
  const { workspace } = useWorkspace();
  const [forms, setForms] = useState<HrForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<{ mode: 'list' } | { mode: 'edit'; form: Partial<HrForm> } | { mode: 'detail'; form: HrForm }>({ mode: 'list' });

  const load = () => {
    setLoading(true);
    fetchForms().then(setForms).catch(e => onToast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visible = forms.filter(f => matchesWorkspace(f.entity, workspace));

  if (view.mode === 'edit') return <FormEditor form={view.form} onToast={onToast} onDone={() => { setView({ mode: 'list' }); load(); }} />;
  if (view.mode === 'detail') return <FormDetail form={view.form} onToast={onToast} onBack={() => { setView({ mode: 'list' }); load(); }} />;

  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-white uppercase">📋 Khảo sát</h2>
          <p className="text-neutral-500 text-sm">Tạo khảo sát, gửi cho nhân viên điền trên điện thoại</p>
        </div>
        <button className={btnP} onClick={() => setView({ mode: 'edit', form: { title: '', is_anonymous: false } })}>+ Tạo khảo sát</button>
      </div>
      {loading ? <p className="text-neutral-500 text-sm animate-pulse">Đang tải...</p>
        : visible.length === 0 ? <div className={`${card} p-10 text-center text-neutral-500`}>Chưa có khảo sát nào</div>
        : (
          <div className="grid gap-2">
            {visible.map(f => (
              <button key={f.id} className={`${card} p-4 text-left flex items-center gap-3 hover:border-white/20`}
                onClick={() => setView(f.status === 'draft' ? { mode: 'edit', form: f } : { mode: 'detail', form: f })}>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white truncate">{f.title}</p>
                  <p className="text-xs text-neutral-500">
                    {f.deadline ? `Hạn ${f.deadline.split('-').reverse().join('/')}` : 'Không hạn'}
                    {f.is_anonymous && ' · 🕶 Ẩn danh'}
                  </p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${STATUS[f.status][1]}`}>{STATUS[f.status][0]}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
};

// ─── Trình tạo / sửa form (chỉ khi draft) ───────────────────────────────────
const FormEditor: React.FC<{ form: Partial<HrForm>; onToast: Props['onToast']; onDone: () => void }> = ({ form, onToast, onDone }) => {
  const [f, setF] = useState<Partial<HrForm>>(form);
  const [qs, setQs] = useState<DraftQ[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [openPicker, setOpenPicker] = useState<HrForm | null>(null);

  useEffect(() => {
    if (form.id) fetchQuestions(form.id).then(rows => setQs(rows.map(r => ({ ...r, key: r.id })))).catch(e => onToast(e.message, 'error'));
  }, [form.id]);

  const upd = (i: number, patch: Partial<DraftQ>) => setQs(qs.map((q, j) => j === i ? { ...q, ...patch } : q));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= qs.length) return;
    const n = [...qs]; [n[i], n[j]] = [n[j], n[i]]; setQs(n);
  };
  const add = (kind: HrQuestionKind) => setQs([...qs, {
    key: newKey(), kind, label: '', required: true,
    options: kind.endsWith('choice') ? ['Lựa chọn 1', 'Lựa chọn 2'] : kind === 'scale' ? { min: 1, max: 10 } : [],
  }]);

  const save = async (): Promise<HrForm | null> => {
    if (!f.title?.trim()) { onToast('Nhập tiêu đề', 'error'); return null; }
    if (qs.some(q => !q.label.trim())) { onToast('Có câu hỏi chưa nhập nội dung', 'error'); return null; }
    if (qs.some(q => q.kind.endsWith('choice') && (q.options as string[]).filter(Boolean).length < 2)) {
      onToast('Câu trắc nghiệm cần ít nhất 2 lựa chọn', 'error'); return null;
    }
    setSaving(true);
    try {
      const saved = await saveForm(f);
      await replaceQuestions(saved.id, qs.map(({ key, ...q }) => ({
        ...q, position: 0, options: q.kind.endsWith('choice') ? (q.options as string[]).map(s => s.trim()).filter(Boolean) : q.options,
      })));
      setF(saved);
      return saved;
    } catch (e: any) { onToast(e.message, 'error'); return null; } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="flex items-center gap-2 flex-wrap">
        <button className={btnS} onClick={onDone}>← Danh sách</button>
        <div className="flex-1" />
        <button className={btnS} onClick={() => setPreview(!preview)}>{preview ? '✏️ Sửa' : '👁 Xem trước'}</button>
        {f.id && <button className={btnS} onClick={async () => { if (confirm('Xoá khảo sát nháp này?')) { await deleteForm(f.id!); onDone(); } }}>🗑 Xoá</button>}
        <button className={btnS} disabled={saving} onClick={async () => { if (await save()) onToast('Đã lưu nháp', 'success'); }}>💾 Lưu nháp</button>
        <button className={btnP} disabled={saving || !qs.length} onClick={async () => { const s = await save(); if (s) setOpenPicker(s); }}>🚀 Gửi khảo sát</button>
      </div>

      {preview ? (
        <div className={`${card} p-5 space-y-5 max-w-[480px]`}>
          <div><p className="text-lg font-black text-white">{f.title}</p><p className="text-sm text-neutral-400 whitespace-pre-wrap">{f.description}</p></div>
          {qs.map(q => <QuestionField key={q.key} q={{ ...q, id: q.key, form_id: '', position: 0 }} value={undefined} onChange={() => {}} />)}
        </div>
      ) : (
        <>
          <div className={`${card} p-4 grid gap-3 md:grid-cols-2`}>
            <div className="md:col-span-2"><p className={label}>Tiêu đề</p>
              <input className={input} value={f.title ?? ''} onChange={e => setF({ ...f, title: e.target.value })} placeholder="VD: Khảo sát mức độ hài lòng Q4" /></div>
            <div className="md:col-span-2"><p className={label}>Mô tả</p>
              <textarea className={input} rows={2} value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value })} /></div>
            <div><p className={label}>Hạn nộp</p>
              <input type="date" className={input} style={{ colorScheme: 'dark' }} value={f.deadline ?? ''} onChange={e => setF({ ...f, deadline: e.target.value || null })} /></div>
            <label className="flex items-center gap-2 text-sm text-white mt-4 cursor-pointer">
              <input type="checkbox" checked={!!f.is_anonymous} onChange={e => setF({ ...f, is_anonymous: e.target.checked })} />
              🕶 Ẩn danh <span className="text-neutral-500 text-xs">(HR biết ai đã nộp, không biết ai trả lời gì)</span>
            </label>
          </div>

          {qs.map((q, i) => (
            <div key={q.key} className={`${card} p-4 space-y-2`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-primary">Câu {i + 1} · {QUESTION_KIND_LABEL[q.kind]}</span>
                <div className="flex-1" />
                <label className="text-xs text-neutral-400 flex items-center gap-1"><input type="checkbox" checked={q.required} onChange={e => upd(i, { required: e.target.checked })} />Bắt buộc</label>
                <button className={btnS} onClick={() => move(i, -1)}>↑</button>
                <button className={btnS} onClick={() => move(i, 1)}>↓</button>
                <button className={btnS} onClick={() => setQs(qs.filter((_, j) => j !== i))}>✕</button>
              </div>
              <input className={input} value={q.label} placeholder="Nội dung câu hỏi" onChange={e => upd(i, { label: e.target.value })} />
              {q.kind.endsWith('choice') && (
                <textarea className={input} rows={3} placeholder="Mỗi dòng 1 lựa chọn"
                  value={(q.options as string[]).join('\n')} onChange={e => upd(i, { options: e.target.value.split('\n') })} />
              )}
              {q.kind === 'scale' && (
                <div className="flex gap-2 items-center text-xs text-neutral-400">
                  Từ <input type="number" className={`${input} w-20`} value={q.options?.min ?? 1} onChange={e => upd(i, { options: { ...q.options, min: +e.target.value } })} />
                  đến <input type="number" className={`${input} w-20`} value={q.options?.max ?? 10} onChange={e => upd(i, { options: { ...q.options, max: +e.target.value } })} />
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {(Object.keys(QUESTION_KIND_LABEL) as HrQuestionKind[]).map(k => (
              <button key={k} className={btnS} onClick={() => add(k)}>+ {QUESTION_KIND_LABEL[k]}</button>
            ))}
          </div>
        </>
      )}

      {openPicker && (
        <RecipientPicker form={openPicker} onToast={onToast} onClose={() => setOpenPicker(null)} onSent={onDone} />
      )}
    </div>
  );
};

// ─── Chọn người nhận + mở form ─────────────────────────────────────────────
const RecipientPicker: React.FC<{ form: HrForm; onToast: Props['onToast']; onClose: () => void; onSent: () => void }> = ({ form, onToast, onClose, onSent }) => {
  const { workspace } = useWorkspace();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Chỉ NV có tài khoản đăng nhập (auth_user_id) mới nhận được thông báo + điền form.
    supabase.from('hr_employees').select('id, full_name, status, auth_user_id, department_id, entity')
      .not('auth_user_id', 'is', null).neq('type', 'freelancer').order('full_name')
      .then(({ data }) => setEmps(((data || []) as Emp[]).filter(e => matchesWorkspace(e.entity, workspace))));
    supabase.from('hr_departments').select('id, name').order('name').then(({ data }) => setDepts(data || []));
  }, [workspace]);

  const list = emps.filter(e => showInactive || e.status === 'active');
  const toggle = (ids: string[], on: boolean) => {
    const n = new Set(sel); ids.forEach(id => on ? n.add(id) : n.delete(id)); setSel(n);
  };

  const send = async () => {
    setBusy(true);
    try {
      const n = await openForm(form.id, [...sel]);
      onToast(`Đã gửi khảo sát · ${n} thông báo`, 'success');
      onSent();
    } catch (e: any) { onToast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${card} p-5 w-full max-w-lg max-h-[85vh] flex flex-col gap-3`} onClick={e => e.stopPropagation()}>
        <p className="font-black text-white">Gửi "{form.title}" cho</p>
        <div className="flex gap-2 flex-wrap">
          <button className={btnS} onClick={() => toggle(list.filter(e => e.status === 'active').map(e => e.id), true)}>Toàn công ty</button>
          <select className={`${input} w-auto`} value="" onChange={e => toggle(list.filter(x => x.department_id === e.target.value).map(x => x.id), true)}>
            <option value="">+ Theo phòng ban</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className={btnS} onClick={() => setSel(new Set())}>Bỏ chọn</button>
          <label className="text-xs text-neutral-400 flex items-center gap-1"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Hiện NV đã nghỉ</label>
        </div>
        <div className="overflow-y-auto flex-1 border border-white/8 rounded-lg divide-y divide-white/5">
          {list.map(e => (
            <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/5">
              <input type="checkbox" checked={sel.has(e.id)} onChange={ev => toggle([e.id], ev.target.checked)} />
              {e.full_name}{e.status !== 'active' && <span className="text-neutral-500 text-xs">(đã nghỉ)</span>}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnS} onClick={onClose}>Huỷ</button>
          <button className={btnP} disabled={busy || !sel.size} onClick={send}>Gửi cho {sel.size} người</button>
        </div>
      </div>
    </div>
  );
};

// ─── Tiến độ + kết quả ──────────────────────────────────────────────────────
const FormDetail: React.FC<{ form: HrForm; onToast: Props['onToast']; onBack: () => void }> = ({ form, onToast, onBack }) => {
  const [f, setF] = useState(form);
  const [qs, setQs] = useState<HrFormQuestion[]>([]);
  const [asg, setAsg] = useState<HrFormAssignment[]>([]);
  const [res, setRes] = useState<HrFormResponse[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);

  const load = async () => {
    try {
      const [q, a, r] = await Promise.all([fetchQuestions(f.id), fetchAssignments(f.id), fetchResponses(f.id)]);
      setQs(q); setAsg(a); setRes(r);
      const ids = [...new Set([...a.map(x => x.respondent_employee_id), ...r.map(x => x.respondent_employee_id).filter(Boolean) as string[]])];
      if (ids.length) {
        const { data } = await supabase.from('hr_employees').select('id, full_name').in('id', ids);
        setNames(Object.fromEntries((data || []).map((e: any) => [e.id, e.full_name])));
      }
    } catch (e: any) { onToast(e.message, 'error'); }
  };
  useEffect(() => { load(); }, [f.id]);

  const done = asg.filter(a => a.submitted_at).length;
  const pending = asg.filter(a => !a.submitted_at);

  const changeStatus = async (s: 'open' | 'closed') => {
    try { await setFormStatus(f.id, s); setF({ ...f, status: s }); } catch (e: any) { onToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4 animate-fadeInUp">
      <div className="flex items-center gap-2 flex-wrap">
        <button className={btnS} onClick={onBack}>← Danh sách</button>
        <div className="flex-1" />
        {f.status === 'open' && <>
          <button className={btnS} onClick={() => setPicker(true)}>+ Thêm người nhận</button>
          <button className={btnS} disabled={!pending.length} onClick={async () => {
            try { onToast(`Đã nhắc ${await remindForm(f.id)} người`, 'success'); } catch (e: any) { onToast(e.message, 'error'); }
          }}>⏰ Nhắc người chưa nộp</button>
          <button className={btnS} onClick={() => confirm('Đóng khảo sát? Nhân viên sẽ không nộp được nữa.') && changeStatus('closed')}>🔒 Đóng</button>
        </>}
        {f.status === 'closed' && <button className={btnS} onClick={() => changeStatus('open')}>🔓 Mở lại</button>}
      </div>

      <div className={`${card} p-4 flex items-center gap-6 flex-wrap`}>
        <div className="flex-1 min-w-0"><p className="text-lg font-black text-white">{f.title}</p>
          <p className="text-xs text-neutral-500">{STATUS[f.status][0]}{f.deadline && ` · Hạn ${f.deadline.split('-').reverse().join('/')}`}{f.is_anonymous && ' · 🕶 Ẩn danh'}</p></div>
        <div><p className={label}>Đã nộp</p><p className="text-2xl font-black text-primary">{done}/{asg.length}</p></div>
      </div>

      {pending.length > 0 && (
        <div className={`${card} p-4`}>
          <p className={label}>Chưa nộp ({pending.length})</p>
          <p className="text-sm text-neutral-300 mt-1">{pending.map(a => names[a.respondent_employee_id] ?? '…').join(', ')}</p>
        </div>
      )}

      {qs.map((q, i) => <QuestionResult key={q.id} idx={i} q={q} res={res} names={f.is_anonymous ? null : names} />)}

      {picker && <RecipientPicker form={f} onToast={onToast} onClose={() => setPicker(false)} onSent={() => { setPicker(false); load(); }} />}
    </div>
  );
};

const QuestionResult: React.FC<{ idx: number; q: HrFormQuestion; res: HrFormResponse[]; names: Record<string, string> | null }> = ({ idx, q, res, names }) => {
  const vals = res.map(r => ({ v: r.answers[q.id], who: r.respondent_employee_id })).filter(x => x.v !== undefined && x.v !== null && x.v !== '');
  const counts = useMemo(() => {
    const keys: (string | number)[] = q.kind.endsWith('choice') ? (q.options as string[]) : scaleRange(q);
    const m = new Map<string | number, number>(keys.map(k => [k, 0]));
    vals.forEach(({ v }) => (Array.isArray(v) ? v : [v]).forEach(x => m.set(x, (m.get(x) || 0) + 1)));
    return [...m.entries()];
  }, [q, res]);
  const isText = q.kind === 'text' || q.kind === 'textarea';
  const nums = vals.map(x => Number(x.v)).filter(n => !isNaN(n));
  const avg = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2) : null;
  const max = Math.max(1, ...counts.map(c => c[1]));

  return (
    <div className={`${card} p-4 space-y-2`}>
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-black text-white flex-1">{idx + 1}. {q.label}</p>
        <span className="text-xs text-neutral-500">{vals.length} trả lời{avg && !q.kind.endsWith('choice') && ` · TB ${avg}`}</span>
      </div>
      {isText ? (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {vals.map((x, i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-neutral-200 whitespace-pre-wrap">
              {names && x.who && <span className="text-[10px] font-black text-primary uppercase block">{names[x.who]}</span>}
              {String(x.v)}
            </div>
          ))}
        </div>
      ) : counts.map(([k, n]) => (
        <div key={String(k)} className="flex items-center gap-2 text-xs">
          <span className="w-32 truncate text-neutral-300">{q.kind === 'rating' ? `${k}★` : k}</span>
          <div className="flex-1 h-2.5 bg-white/5 rounded"><div className="h-full bg-primary rounded" style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="w-8 text-right font-black text-white">{n}</span>
        </div>
      ))}
    </div>
  );
};

export default FormsTab;
