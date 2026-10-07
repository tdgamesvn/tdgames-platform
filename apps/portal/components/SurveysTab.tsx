// Portal → "Khảo sát": nhân viên điền form HR giao (mobile-first).
import React, { useEffect, useState } from 'react';
import { AccountUser } from '@/types';
import {
  HrFormAssignment, HrFormQuestion, fetchMyAssignments, fetchQuestions, fetchMyResponse,
  submitForm, isFormAcceptingAnswers, fetchMyTargetNames, fetchMyPeerResults, MyPeerResult,
} from '@/apps/hr/services/hrFormService';
import QuestionField from '@/apps/hr/components/forms/QuestionField';

interface Props { currentUser: AccountUser; onToast: (msg: string, type: 'success' | 'error') => void }
// Theo STYLE_GUIDE: card rounded-[20px] border-primary/10; card bấm được trên mobile có
// gradient + chevron + active:scale (v1.5) để phân biệt với card tĩnh.
const card = 'rounded-[20px] border border-primary/10 bg-surface';
const tapCard = 'w-full rounded-[20px] border border-white/[.14] p-4 text-left flex items-center gap-3 min-h-[64px] active:scale-[.97] active:bg-white/[.04] hover:border-primary/20 transition-all';
const tapStyle = {
  background: 'linear-gradient(160deg, rgba(255,255,255,.09), rgba(255,255,255,.03))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10), 0 2px 8px rgba(0,0,0,.35)',
};
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0" style={{ background: `${color}20`, color }}>{children}</span>
);
const fmtD = (d?: string | null) => d ? d.split('-').reverse().join('/') : '';

const SurveysTab: React.FC<Props> = ({ currentUser, onToast }) => {
  const [list, setList] = useState<HrFormAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<HrFormAssignment | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [results, setResults] = useState<MyPeerResult[]>([]);
  const [viewRes, setViewRes] = useState<MyPeerResult | null>(null);

  const load = () => {
    if (!currentUser.employee_id) { setLoading(false); return; }
    setLoading(true);
    fetchMyAssignments(currentUser.employee_id).then(setList).catch(e => onToast(e.message, 'error')).finally(() => setLoading(false));
    fetchMyTargetNames().then(setTargets).catch(() => {});
    fetchMyPeerResults().then(setResults).catch(() => {});
  };
  useEffect(load, [currentUser.employee_id]);

  if (open) return <Fill a={open} target={targets[open.target_employee_id ?? '']} onToast={onToast} onBack={() => { setOpen(null); load(); }} />;
  if (viewRes) return <PeerResultView r={viewRes} onBack={() => setViewRes(null)} />;

  const todo = list.filter(a => !a.submitted_at && isFormAcceptingAnswers(a.form!));
  const rest = list.filter(a => !todo.includes(a));

  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Khảo sát</h2>
        <p className="text-sm text-neutral-medium mt-1">Các khảo sát HR gửi cho bạn</p>
      </div>
      {loading ? <p className="text-xs text-neutral-medium animate-td-pulse text-center py-10">Đang tải...</p> : (
        <>
          <Section title={`Cần điền (${todo.length})`} items={todo} targets={targets} empty="Không có khảo sát nào cần điền 🎉" onOpen={setOpen} />
          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">Kết quả đánh giá chéo của bạn</p>
              {results.map(r => (
                <button key={r.form_id} onClick={() => setViewRes(r)} className={tapCard} style={tapStyle}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                    <p className="text-xs text-neutral-medium mt-0.5">{r.managers.length > 0 ? 'Trưởng phòng đã đánh giá' : ''}{r.managers.length > 0 && r.published ? ' · ' : ''}{r.published ? `${r.n} đồng nghiệp · ẩn danh` : ''}</p>
                  </div>
                  <Badge color="#5AC8FA">Xem kết quả</Badge>
                  <span className="text-primary/70 text-[15px] font-black">›</span>
                </button>
              ))}
            </div>
          )}
          {rest.length > 0 && <Section title="Đã nộp / đã đóng" items={rest} targets={targets} onOpen={setOpen} />}
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; items: HrFormAssignment[]; targets: Record<string, string>; empty?: string; onOpen: (a: HrFormAssignment) => void }> = ({ title, items, targets, empty, onOpen }) => (
  <div className="space-y-3">
    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">{title}</p>
    {!items.length && empty && (
      <div className={`${card} text-center py-12`}>
        <p className="text-3xl mb-3">📋</p>
        <p className="text-neutral-600 text-sm">{empty}</p>
      </div>
    )}
    {items.map(a => (
      <button key={a.id} onClick={() => onOpen(a)} className={tapCard} style={tapStyle}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{a.target_employee_id ? `🤝 ${targets[a.target_employee_id] ?? 'Đồng nghiệp'}` : a.form!.title}</p>
          {a.target_employee_id && <p className="text-xs text-neutral-medium truncate">{a.form!.title}</p>}
          <p className="text-xs text-neutral-medium mt-0.5">
            {a.submitted_at ? `Đã nộp ${new Date(a.submitted_at).toLocaleDateString('vi-VN')}`
              : a.form!.deadline ? `Hạn ${fmtD(a.form!.deadline)}` : 'Không hạn'}
            {a.form!.is_anonymous && ' · Ẩn danh'}
          </p>
        </div>
        {a.submitted_at ? <Badge color="#34C759">Đã nộp</Badge>
          : isFormAcceptingAnswers(a.form!) ? <Badge color="#FF9500">Cần điền</Badge>
          : <Badge color="#9D9C9D">Đã đóng</Badge>}
        <span className="text-primary/70 text-[15px] font-black">›</span>
      </button>
    ))}
  </div>
);

const Fill: React.FC<{ a: HrFormAssignment; target?: string; onToast: Props['onToast']; onBack: () => void }> = ({ a, target, onToast, onBack }) => {
  const f = a.form!;
  const [qs, setQs] = useState<HrFormQuestion[]>([]);
  const [ans, setAns] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const readOnly = !!a.submitted_at || !isFormAcceptingAnswers(f);

  useEffect(() => {
    fetchQuestions(f.id).then(setQs).catch(e => onToast(e.message, 'error'));
    // Bài ẩn danh không gắn với người nộp ⇒ không xem lại được (đúng thiết kế).
    if (a.submitted_at && !f.is_anonymous) fetchMyResponse(a.id).then(r => r && setAns(r.answers)).catch(() => {});
  }, [a.id]);

  const submit = async () => {
    const miss = qs.find(q => q.required && (ans[q.id] === undefined || ans[q.id] === '' || (Array.isArray(ans[q.id]) && !ans[q.id].length)));
    if (miss) { onToast(`Chưa trả lời: ${miss.label}`, 'error'); return; }
    if (!confirm('Nộp khảo sát? Nộp rồi không sửa được.')) return;
    setBusy(true);
    try { await submitForm(a.id, ans); onToast('Đã nộp khảo sát. Cảm ơn bạn!', 'success'); onBack(); }
    catch (e: any) { onToast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="animate-fadeInUp space-y-4">
      <button onClick={onBack} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 active:scale-[.97] transition-all min-h-[44px]">← Khảo sát</button>
      <div className="rounded-[20px] border p-5 space-y-1" style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
        <p className="text-base font-black uppercase tracking-wider text-white">{f.title}</p>
        {a.target_employee_id && <p className="text-sm font-semibold text-primary">Đánh giá: {target ?? 'đồng nghiệp'}</p>}
        {f.description && <p className="text-sm text-neutral-medium whitespace-pre-wrap">{f.description}</p>}
        <p className="text-xs text-neutral-medium pt-1">
          {f.deadline && `Hạn ${fmtD(f.deadline)} · `}
          {a.target_employee_id ? 'Người được đánh giá KHÔNG biết bạn chấm. ' : ''}
          {f.is_anonymous ? 'Ẩn danh — HR không biết câu trả lời này của ai' : 'HR thấy câu trả lời kèm tên bạn'}
        </p>
      </div>
      {a.submitted_at && f.is_anonymous ? (
        <div className={`${card} text-center py-12`}>
          <p className="text-3xl mb-3">✅</p>
          <p className="text-neutral-600 text-sm">Bạn đã nộp. Bài ẩn danh nên không xem lại được.</p>
        </div>
      ) : (
        <>
          {qs.map(q => (
            <div key={q.id} className={`${card} p-5`}>
              <QuestionField q={q} value={ans[q.id]} disabled={readOnly} onChange={v => setAns({ ...ans, [q.id]: v })} />
            </div>
          ))}
          {!readOnly && (
            <button disabled={busy || !qs.length} onClick={submit}
              className="w-full px-6 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider text-white shadow-btn-glow hover:shadow-btn-glow-hover active:scale-[.97] transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}>
              {busy ? 'Đang nộp...' : 'Nộp khảo sát'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Kết quả đánh giá chéo: bài trưởng phòng luôn hiện (có tên); bài đồng nghiệp chỉ hiện khi admin duyệt —
// không có tên người chấm, nhận xét không theo thứ tự người chấm.
const PeerResultView: React.FC<{ r: MyPeerResult; onBack: () => void }> = ({ r, onBack }) => (
  <div className="animate-fadeInUp space-y-4">
    <button onClick={onBack} className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 active:scale-[.97] transition-all min-h-[44px]">← Khảo sát</button>
    <div className="rounded-[20px] border p-5 space-y-1" style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
      <p className="text-base font-black uppercase tracking-wider text-white">{r.title}</p>
      <p className="text-xs text-neutral-medium">
        {r.managers.length > 0 && `Trưởng phòng: ${r.managers.map(m => m.name).join(', ')} · `}
        {r.published ? `${r.n} đồng nghiệp đã đánh giá bạn · không hiển thị tên người chấm` : 'Đánh giá của đồng nghiệp chưa được duyệt công bố'}
      </p>
    </div>
    {r.questions.map((q, i) => {
      const isText = q.kind === 'text' || q.kind === 'textarea';
      const isChoice = q.kind.endsWith('choice');
      const nums = q.values.map(Number).filter(n => !isNaN(n));
      const counts = new Map<string, number>();
      if (isChoice) q.values.forEach(v => (Array.isArray(v) ? v : [v]).forEach((x: string) => counts.set(x, (counts.get(x) || 0) + 1)));
      return (
        <div key={q.id} className={`${card} p-5 space-y-2`}>
          <p className="text-sm font-semibold text-white"><span className="text-primary font-black">{i + 1}.</span> {q.label}</p>
          {r.managers.map((m, j) => {
            const v = m.answers?.[q.id];
            return (
              <div key={j} className="rounded-xl border px-3 py-2" style={{ background: 'rgba(255,149,0,0.05)', borderColor: 'rgba(255,149,0,0.15)' }}>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary block mb-0.5">Trưởng phòng · {m.name}</span>
                <span className="text-sm text-white whitespace-pre-wrap">{v === undefined || v === null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : q.kind === 'rating' ? `${v}★` : String(v)}</span>
              </div>
            );
          })}
          {r.published && <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider pt-1">Đồng nghiệp</p>}
          {!r.published ? null : isText ? q.values.map((v, j) => (
            <p key={j} className="rounded-xl border border-white/5 px-3 py-2 text-sm text-neutral-light whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>{String(v)}</p>
          )) : isChoice ? [...counts.entries()].map(([k, n]) => (
            <p key={k} className="text-xs text-neutral-medium flex justify-between"><span>{k}</span><span className="font-black text-white">{n}</span></p>
          )) : (
            <p className="text-2xl font-black text-white">{nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : '—'}
              <span className="text-sm text-neutral-600"> / {q.kind === 'rating' ? 5 : q.options?.max ?? 10}</span></p>
          )}
        </div>
      );
    })}
  </div>
);

export default SurveysTab;
