// Portal → "Khảo sát": nhân viên điền form HR giao (mobile-first).
import React, { useEffect, useState } from 'react';
import { AccountUser } from '@/types';
import {
  HrFormAssignment, HrFormQuestion, fetchMyAssignments, fetchQuestions, fetchMyResponse,
  submitForm, isFormAcceptingAnswers,
} from '@/apps/hr/services/hrFormService';
import QuestionField from '@/apps/hr/components/forms/QuestionField';

interface Props { currentUser: AccountUser; onToast: (msg: string, type: 'success' | 'error') => void }
const card = 'bg-surface border border-white/8 rounded-xl';
const fmtD = (d?: string | null) => d ? d.split('-').reverse().join('/') : '';

const SurveysTab: React.FC<Props> = ({ currentUser, onToast }) => {
  const [list, setList] = useState<HrFormAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<HrFormAssignment | null>(null);

  const load = () => {
    if (!currentUser.employee_id) { setLoading(false); return; }
    setLoading(true);
    fetchMyAssignments(currentUser.employee_id).then(setList).catch(e => onToast(e.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(load, [currentUser.employee_id]);

  if (open) return <Fill a={open} onToast={onToast} onBack={() => { setOpen(null); load(); }} />;

  const todo = list.filter(a => !a.submitted_at && isFormAcceptingAnswers(a.form!));
  const rest = list.filter(a => !todo.includes(a));

  return (
    <div className="animate-fadeInUp space-y-5">
      <div>
        <h2 className="text-[2rem] font-black text-[#06B6D4] uppercase tracking-tight">📋 Khảo sát</h2>
        <p className="text-neutral-500 text-sm">Các khảo sát HR gửi cho bạn</p>
      </div>
      {loading ? <p className="text-neutral-500 text-sm animate-pulse text-center py-10">Đang tải...</p> : (
        <>
          <Section title={`Cần điền (${todo.length})`} items={todo} empty="Không có khảo sát nào cần điền 🎉" onOpen={setOpen} />
          {rest.length > 0 && <Section title="Đã nộp / đã đóng" items={rest} onOpen={setOpen} />}
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; items: HrFormAssignment[]; empty?: string; onOpen: (a: HrFormAssignment) => void }> = ({ title, items, empty, onOpen }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">{title}</p>
    {!items.length && empty && <div className={`${card} p-8 text-center text-neutral-500 text-sm`}>{empty}</div>}
    {items.map(a => (
      <button key={a.id} onClick={() => onOpen(a)} className={`${card} w-full p-4 text-left flex items-center gap-3 active:bg-white/5 min-h-[64px]`}>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white truncate">{a.form!.title}</p>
          <p className="text-xs text-neutral-500">
            {a.submitted_at ? `Đã nộp ${new Date(a.submitted_at).toLocaleDateString('vi-VN')}`
              : a.form!.deadline ? `Hạn ${fmtD(a.form!.deadline)}` : 'Không hạn'}
            {a.form!.is_anonymous && ' · 🕶 Ẩn danh'}
          </p>
        </div>
        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${a.submitted_at ? 'bg-[#34C759]/15 text-[#34C759]'
          : isFormAcceptingAnswers(a.form!) ? 'bg-primary/15 text-primary' : 'bg-white/10 text-neutral-400'}`}>
          {a.submitted_at ? 'Đã nộp' : isFormAcceptingAnswers(a.form!) ? 'Điền ›' : 'Đã đóng'}
        </span>
      </button>
    ))}
  </div>
);

const Fill: React.FC<{ a: HrFormAssignment; onToast: Props['onToast']; onBack: () => void }> = ({ a, onToast, onBack }) => {
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
    <div className="animate-fadeInUp space-y-4 max-w-[640px] mx-auto">
      <button onClick={onBack} className="text-sm font-bold text-neutral-400 min-h-[44px]">← Khảo sát</button>
      <div className={`${card} p-4`}>
        <p className="text-lg font-black text-white">{f.title}</p>
        {f.description && <p className="text-sm text-neutral-400 whitespace-pre-wrap mt-1">{f.description}</p>}
        <p className="text-xs text-neutral-500 mt-2">
          {f.deadline && `Hạn ${fmtD(f.deadline)} · `}
          {f.is_anonymous ? '🕶 Ẩn danh — HR không biết câu trả lời này của ai' : 'Câu trả lời ghi kèm tên bạn'}
        </p>
      </div>
      {a.submitted_at && f.is_anonymous ? (
        <div className={`${card} p-8 text-center text-neutral-400 text-sm`}>✅ Bạn đã nộp. Bài ẩn danh nên không xem lại được.</div>
      ) : (
        <>
          {qs.map(q => (
            <div key={q.id} className={`${card} p-4`}>
              <QuestionField q={q} value={ans[q.id]} disabled={readOnly} onChange={v => setAns({ ...ans, [q.id]: v })} />
            </div>
          ))}
          {!readOnly && (
            <button disabled={busy || !qs.length} onClick={submit}
              className="w-full bg-primary text-black font-black uppercase rounded-xl py-3.5 text-sm disabled:opacity-40">
              {busy ? 'Đang nộp...' : '📨 Nộp khảo sát'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default SurveysTab;
