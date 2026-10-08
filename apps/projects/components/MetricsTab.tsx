import React, { useMemo, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { PmTask, PmTaskTime, PmStatusLog, norm } from '../services/projectService';

// STYLE_GUIDE: card rounded-[20px] border-primary/10 bg-surface, table row border-b/hover, KPI label 10px.
const card = 'rounded-[20px] border border-primary/10 p-6 bg-surface';
const kpiLabel = 'text-[10px] font-black text-neutral-600 uppercase tracking-wider';
const tr = 'border-b border-white/5 hover:bg-white/5 transition-colors';
const select = 'px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';
const btnPrimary = 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50';
const CATS: { v: string; label: string }[] = [
  { v: 'active', label: 'Đang làm (tính giờ)' }, { v: 'waiting_client', label: 'Chờ khách / tạm dừng' },
  { v: 'not_started', label: 'Chưa bắt đầu' }, { v: 'done', label: 'Kết thúc' },
];
const fmtH = (h: number) => (h >= 100 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';
const DAY = 86400_000;

/** Thứ Hai đầu tuần (giờ VN) dạng YYYY-MM-DD. */
const weekStartVN = (ms: number) => {
  const d = new Date(ms + 7 * 3600_000);
  const dow = (d.getUTCDay() + 6) % 7; // T2 = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
};

interface Props {
  tasks: PmTask[]; times: PmTaskTime[]; logs: PmStatusLog[];
  statusCat: Record<string, string>; isAdmin: boolean;
  deliveredOn: (t: PmTask) => string | null;
  onCatsSaved: () => void; onError: (m: string) => void; onOk: (m: string) => void;
}

const MetricsTab: React.FC<Props> = ({ tasks, times, logs, statusCat, isAdmin, deliveredOn, onCatsSaved, onError, onOk }) => {
  const weeks = useMemo(() => {
    const now = Date.now();
    const keys = Array.from({ length: 8 }, (_, i) => weekStartVN(now - i * 7 * DAY));
    const taskIds = new Set(tasks.map(t => t.id));
    const perTask = new Map<string, { h: number; wait: number; fix: number }>();
    const estOf = new Map(tasks.map(t => [t.id, Number(t.time_estimate_hours || 0)]));
    // Chỉ task có lần giao khách NẰM TRONG nhật ký (từ 17/9) — task giao trước đó mà có log về sau
    // sẽ ra 0h giả (tuần 31/08 từng hiện "0h · 100%").
    times.forEach(x => {
      if (!x.first_client_review_at) return;
      const c = perTask.get(x.task_id) || { h: 0, wait: 0, fix: 0 };
      c.h += x.active_hours; c.wait = Math.max(c.wait, x.waiting_client_hours); c.fix = Math.max(c.fix, x.fix_rounds);
      perTask.set(x.task_id, c);
    });
    return keys.map(k => {
      const delivered = tasks.filter(t => { const d = deliveredOn(t); return d && weekStartVN(new Date(d + 'T12:00:00+07:00').getTime()) === k; });
      const tracked = delivered.map(t => perTask.get(t.id)).filter(Boolean) as { h: number; wait: number; fix: number }[];
      const withEst = delivered.filter(t => perTask.has(t.id) && (estOf.get(t.id) || 0) > 0);
      const estPct = withEst.length ? Math.round(withEst.reduce((n, t) => n + perTask.get(t.id)!.h, 0) / withEst.reduce((n, t) => n + estOf.get(t.id)!, 0) * 100) : null;
      const fixEvents = logs.filter(l => taskIds.has(l.task_id) && norm(l.to_status) === 'fix' && weekStartVN(new Date(l.changed_at).getTime()) === k).length;
      return {
        k, delivered: delivered.length, tracked: tracked.length,
        avgH: tracked.length ? tracked.reduce((n, x) => n + x.h, 0) / tracked.length : null,
        avgWait: tracked.length ? tracked.reduce((n, x) => n + x.wait, 0) / tracked.length : null,
        firstPass: tracked.length ? Math.round(tracked.filter(x => x.fix === 0).length / tracked.length * 100) : null,
        fixEvents, estPct,
      };
    });
  }, [tasks, times, logs, deliveredOn]);

  // ── Phân nhóm trạng thái (admin) ──
  const allStatuses = useMemo(() => {
    const s = new Set(Object.keys(statusCat));
    tasks.forEach(t => { const n = norm(t.clickup_status); if (n) s.add(n); });
    return [...s].sort((a, b) => (statusCat[a] ? 1 : 0) - (statusCat[b] ? 1 : 0) || a.localeCompare(b));
  }, [statusCat, tasks]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const changed = Object.entries(draft).filter(([s, c]) => c && c !== statusCat[s]);
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('wf_status_categories')
        .upsert(changed.map(([status, category]) => ({ status, category, updated_at: new Date().toISOString() })));
      if (error) throw error;
      setDraft({}); onOk(`Đã lưu ${changed.length} trạng thái`); onCatsSaved();
    } catch (e: any) { onError(e.message || 'Có lỗi xảy ra'); }
    finally { setSaving(false); }
  };

  const fmtWeek = (k: string) => { const [y, m, d] = k.split('-'); const end = new Date(Date.UTC(+y, +m - 1, +d + 6)); return `${d}/${m} – ${String(end.getUTCDate()).padStart(2, '0')}/${String(end.getUTCMonth() + 1).padStart(2, '0')}`; };

  return (
    <div className="animate-fadeInUp space-y-6">
      <div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Chỉ số</h2>
        <p className="text-sm text-neutral-medium mt-1">Xu hướng 8 tuần gần nhất — tuần tính từ thứ Hai, giờ VN</p>
      </div>

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className={kpiLabel + ' text-left border-b border-white/5'}>
              <th className="py-2">Tuần</th><th className="text-right">Task giao khách</th><th className="text-right">Giờ TB/task</th>
              <th className="text-right">Chờ khách TB</th><th className="text-right">Duyệt ngay</th><th className="text-right">Lần sửa</th><th className="text-right">So ước lượng</th></tr></thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w.k} className={tr}>
                  <td className="py-3 text-sm font-semibold text-white">{fmtWeek(w.k)}{i === 0 && <span className="text-xs text-neutral-medium font-normal"> · tuần này</span>}</td>
                  <td className="text-right text-white font-semibold">{w.delivered}</td>
                  <td className="text-right text-neutral-300">{w.avgH == null ? '—' : fmtH(w.avgH)}</td>
                  <td className="text-right text-neutral-300">{w.avgWait == null ? '—' : fmtH(w.avgWait)}</td>
                  <td className="text-right text-neutral-300">{w.firstPass == null ? '—' : w.firstPass + '%'}</td>
                  <td className="text-right text-neutral-300">{w.fixEvents}</td>
                  <td className="text-right text-neutral-300">{w.estPct == null ? '—' : w.estPct + '%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-medium mt-3">"Task giao khách" = lần đầu gửi khách duyệt trong tuần. "—" = chưa có dữ liệu (lịch sử bắt đầu từ 17/09/2026). Bấm <strong>?</strong> trên menu để xem giải thích.</p>
      </div>

      {isAdmin && (
        <div className={card}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-base font-black uppercase tracking-wider text-white">Phân nhóm trạng thái ClickUp</div>
              <p className="text-xs text-neutral-medium mt-1">Chỉ admin thấy. Chọn trạng thái ClickUp nào được tính là "đang làm" (tính giờ). Trạng thái mới chưa phân nhóm nằm đầu danh sách.</p>
            </div>
            <button onClick={save} disabled={saving || changed.length === 0} className={btnPrimary} style={{ background: '#FF9500' }}>
              {saving ? 'Đang lưu...' : `Lưu${changed.length ? ` (${changed.length})` : ''}`}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allStatuses.map(s => (
              <div key={s} className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{s}
                  {!statusCat[s] && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ml-2" style={{ background: '#AF52DE20', color: '#AF52DE' }}>Chưa phân nhóm</span>}</span>
                <select className={select} style={{ background: '#1a1a1a' }} value={draft[s] ?? statusCat[s] ?? ''}
                  onChange={e => setDraft({ ...draft, [s]: e.target.value })}>
                  <option value="" disabled>— Chọn nhóm —</option>
                  {CATS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsTab;
