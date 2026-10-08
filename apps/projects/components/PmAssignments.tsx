import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

// Admin gán dự án cho từng PM (migration 20261008190000). PM chưa được gán ⇒ xem tất cả dự án.
// STYLE_GUIDE: card rounded-[20px] border-primary/10 bg-surface; chip chọn = badge màu cam khi bật.
interface PmUser { user_id: string; email: string; full_name: string }

const PmAssignments: React.FC<{ projectNames: string[]; onError: (m: string) => void; onOk: (m: string) => void }> = ({ projectNames, onError, onOk }) => {
  const [pms, setPms] = useState<PmUser[]>([]);
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // onError là arrow mới mỗi render ⇒ không đưa vào deps (tránh load lặp vô hạn).
  const errRef = useRef(onError); errRef.current = onError;

  const load = useCallback(async () => {
    const [u, a] = await Promise.all([
      supabase.rpc('pm_list_pm_users'),
      supabase.from('pm_project_assignments').select('project, user_id'),
    ]);
    if (u.error) return errRef.current(u.error.message);
    setPms((u.data || []) as PmUser[]);
    const m: Record<string, Set<string>> = {};
    (a.data || []).forEach((r: any) => { (m[r.user_id] ||= new Set()).add(r.project); });
    setAssigned(m);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (uid: string, project: string) => {
    const has = assigned[uid]?.has(project);
    setBusy(uid + project);
    const { error } = has
      ? await supabase.from('pm_project_assignments').delete().eq('user_id', uid).eq('project', project)
      : await supabase.from('pm_project_assignments').insert({ user_id: uid, project });
    setBusy(null);
    if (error) return onError(error.message);
    setAssigned(prev => {
      const s = new Set(prev[uid] || []); if (has) s.delete(project); else s.add(project);
      return { ...prev, [uid]: s };
    });
    onOk(has ? `Đã bỏ ${project}` : `Đã gán ${project}`);
  };

  return (
    <div className="rounded-[20px] border border-primary/10 p-6 bg-surface">
      <div className="text-base font-black uppercase tracking-wider text-white">PM phụ trách dự án</div>
      <p className="text-xs text-neutral-medium mt-1 mb-4">Chỉ admin thấy. PM chưa được gán dự án nào sẽ xem tất cả; đã gán thì chỉ thấy dự án được gán (chặn ở database). PM cần đăng nhập lại để thấy thay đổi.</p>
      {pms.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4 text-center">Chưa có tài khoản PM — bật role phụ "Quản lý dự án" trong hồ sơ nhân viên</p>
      ) : (
        <div className="space-y-5">
          {pms.map(p => {
            const mine = assigned[p.user_id] || new Set<string>();
            return (
              <div key={p.user_id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-white">{p.full_name}</span>
                  <span className="text-xs text-neutral-medium">{p.email}</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ml-auto"
                    style={mine.size ? { background: '#FF950020', color: '#FF9500' } : { background: '#9D9C9D20', color: '#9D9C9D' }}>
                    {mine.size ? `${mine.size} dự án` : 'Xem tất cả'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {projectNames.map(n => {
                    const on = mine.has(n);
                    return (
                      <button key={n} disabled={busy === p.user_id + n} onClick={() => toggle(p.user_id, n)}
                        className={'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 '
                          + (on ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' : 'text-neutral-400 border-white/10 hover:text-white hover:border-white/20')}>
                        {on ? '✓ ' : ''}{n}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PmAssignments;
