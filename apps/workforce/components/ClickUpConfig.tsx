import React, { useState, useEffect } from 'react';
import * as clickup from '../services/clickupService';
import { ClickUpConfig as ConfigType } from '../services/clickupService';

interface ClickUpConfigProps {
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-primary/40 transition-all text-sm";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2 block";
const btnPrimary = "py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-primary text-white shadow-btn-glow hover:shadow-btn-glow-hover transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed";
const btnSecondary = "py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest border border-primary/10 text-neutral-medium hover:text-white hover:border-primary/30 transition-all";

type Step = 'token' | 'team' | 'done';

const ClickUpConfigComponent: React.FC<ClickUpConfigProps> = ({ onToast }) => {
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<Step>('token');
  const [saving, setSaving] = useState(false);

  // Form state
  const [token, setToken] = useState('');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [loadingStep, setLoadingStep] = useState(false);

  // Auto-sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncTimes, setAutoSyncTimes] = useState<string[]>(['07:00', '19:00']);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // CRM mapping state
  const [crmMap, setCrmMap] = useState<clickup.CrmMapEntry[]>([]);
  const [cuNames, setCuNames] = useState<{ spaces: string[]; folders: string[] }>({ spaces: [], folders: [] });
  const [crmOpts, setCrmOpts] = useState<{ clients: { id: string; name: string }[]; projects: { id: string; name: string }[] }>({ clients: [], projects: [] });
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    if (step !== 'done') return;
    setMapLoading(true);
    Promise.all([clickup.loadCrmMap(), clickup.fetchClickUpNames(), clickup.fetchCrmOptions()])
      .then(([map, names, opts]) => { setCrmMap(map); setCuNames(names); setCrmOpts(opts); })
      .catch((e: any) => onToast(`Lỗi tải mapping CRM: ${e.message}`, 'error'))
      .finally(() => setMapLoading(false));
  }, [step]);

  const mapVal = (type: 'space' | 'folder', name: string) => {
    const m = crmMap.find(x => x.clickup_type === type && x.clickup_name === name);
    return (type === 'space' ? m?.client_id : m?.project_id) || '';
  };

  const handleMapChange = async (type: 'space' | 'folder', name: string, value: string) => {
    const entry: clickup.CrmMapEntry = {
      clickup_type: type,
      clickup_name: name,
      client_id: type === 'space' ? (value || null) : null,
      project_id: type === 'folder' ? (value || null) : null,
    };
    try {
      await clickup.saveCrmMapEntry(entry);
      setCrmMap(prev => [...prev.filter(m => !(m.clickup_type === type && m.clickup_name === name)), entry]);
      onToast('Đã lưu mapping', 'success');
    } catch (e: any) {
      onToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  // Load existing config
  useEffect(() => {
    (async () => {
      try {
        const c = await clickup.loadConfig();
        if (c) {
          setConfig(c);
          setToken(c.api_token);
          setSelectedTeamId(c.team_id);
          setSelectedTeamName(c.team_name);
          setAutoSyncEnabled(c.auto_sync_enabled ?? true);
          setAutoSyncTimes(c.auto_sync_times ?? ['07:00', '19:00']);
          setStep('done');
        }
      } catch (e: any) {
        onToast(e.message, 'error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Step 1: Validate token → get teams ──
  const handleTokenSubmit = async () => {
    if (!token.trim()) return;
    setLoadingStep(true);
    try {
      const data = await clickup.fetchTeams(token.trim());
      setTeams(data.teams || []);
      if (data.teams.length === 1) {
        setSelectedTeamId(data.teams[0].id);
        setSelectedTeamName(data.teams[0].name);
      }
      setStep('team');
      onToast('Kết nối ClickUp thành công!', 'success');
    } catch (e: any) {
      onToast(`Lỗi: ${e.message}`, 'error');
    } finally {
      setLoadingStep(false);
    }
  };

  // ── Step 2: Select team → save immediately ──
  const handleSaveTeam = async () => {
    if (!selectedTeamId) return;
    setSaving(true);
    try {
      const saved = await clickup.saveConfig({
        api_token: token,
        team_id: selectedTeamId,
        team_name: selectedTeamName,
        spaces: config?.spaces || [], // Keep old spaces data for reference
        last_synced: config?.last_synced || null,
      });
      setConfig(saved);
      setStep('done');
      onToast('Đã lưu cấu hình ClickUp! Khi Sync, hệ thống sẽ tự động lấy tất cả Spaces & Lists.', 'success');
    } catch (e: any) {
      onToast(`Lỗi: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">ClickUp Config</h2>
        <p className="text-neutral-medium text-sm mt-1">Kết nối ClickUp để đồng bộ task cho nhân sự</p>
      </div>

      {/* Connected Status */}
      {step === 'done' && config && (
        <div className="rounded-[20px] border border-emerald-500/20 bg-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">Đã kết nối</span>
            </div>
            <button onClick={() => setStep('token')} className={btnSecondary}>
              ⚙️ Cấu hình lại
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-primary/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Team</p>
              <p className="text-white font-bold">{config.team_name}</p>
            </div>
            <div className="p-4 rounded-xl border border-primary/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Chế độ Sync</p>
              <p className="text-white font-bold">🔄 Toàn bộ Workspace</p>
              <p className="text-neutral-medium/60 text-[10px] mt-0.5">Tự động lấy tất cả Spaces & Lists khi Sync</p>
            </div>
          </div>
          {config.last_synced && (
            <p className="text-neutral-medium text-xs">
              🔄 Sync lần cuối: {new Date(config.last_synced).toLocaleString('vi-VN')}
            </p>
          )}

          {/* Info Box */}
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-400 text-lg">💡</span>
              <div>
                <p className="text-blue-400 font-bold text-sm">Không cần chọn từng Space/List</p>
                <p className="text-neutral-medium text-xs mt-1">
                  Khi bạn nhấn <strong className="text-white">Sync ClickUp</strong> ở tab Task, hệ thống sẽ tự động quét toàn bộ Spaces và Lists trong workspace.
                  Nếu bạn thêm Space hoặc List mới trên ClickUp, chỉ cần Sync lại là xong — không cần cấu hình lại.
                </p>
              </div>
            </div>
          </div>

          {/* Realtime Sync Toggle */}
          <div className="border-t border-primary/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">⚡ Realtime Sync</p>
                <p className="text-neutral-medium/60 text-[11px]">Tự động cập nhật task khi có thay đổi trên ClickUp</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    if ((config as any).webhook_id) {
                      // Disable: delete webhook
                      await clickup.deleteWebhook(config.api_token, (config as any).webhook_id);
                      await clickup.saveWebhookId(null);
                      setConfig({ ...config, webhook_id: null } as any);
                      onToast('Đã tắt Realtime Sync', 'success');
                    } else {
                      // Enable: register webhook
                      const wh = await clickup.registerWebhook(config.api_token, config.team_id);
                      await clickup.saveWebhookId(wh.id);
                      setConfig({ ...config, webhook_id: wh.id } as any);
                      onToast('Đã bật Realtime Sync!', 'success');
                    }
                  } catch (e: any) {
                    onToast(`Lỗi: ${e.message}`, 'error');
                  }
                }}
                className={`relative w-14 h-7 rounded-full transition-all ${
                  (config as any).webhook_id ? 'bg-emerald-500' : 'bg-neutral-dark/50'
                }`}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                  (config as any).webhook_id ? 'left-7' : 'left-0.5'
                }`} />
              </button>
            </div>
            {(config as any).webhook_id && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Đang lắng nghe thay đổi từ ClickUp
              </div>
            )}
          </div>

          {/* Auto Sync Schedule */}
          <div className="border-t border-primary/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">🕐 Auto Sync Schedule</p>
                <p className="text-neutral-medium/60 text-[11px]">Tự động đồng bộ toàn bộ task theo lịch đã đặt (giờ Việt Nam)</p>
              </div>
              <button
                onClick={async () => {
                  const newEnabled = !autoSyncEnabled;
                  setSavingSchedule(true);
                  try {
                    await clickup.updateAutoSyncSchedule(autoSyncTimes, newEnabled);
                    setAutoSyncEnabled(newEnabled);
                    onToast(newEnabled ? 'Đã bật Auto Sync!' : 'Đã tắt Auto Sync', 'success');
                  } catch (e: any) {
                    onToast(`Lỗi: ${e.message}`, 'error');
                  } finally {
                    setSavingSchedule(false);
                  }
                }}
                disabled={savingSchedule}
                className={`relative w-14 h-7 rounded-full transition-all ${autoSyncEnabled ? 'bg-emerald-500' : 'bg-neutral-dark/50'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${autoSyncEnabled ? 'left-7' : 'left-0.5'}`} />
              </button>
            </div>

            {autoSyncEnabled && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {autoSyncTimes.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="time"
                        value={time}
                        onChange={e => {
                          setAutoSyncTimes(prev => prev.map((t, i) => i === idx ? e.target.value : t));
                        }}
                        className="bg-transparent border border-primary/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/40 transition-all"
                      />
                      {autoSyncTimes.length > 1 && (
                        <button
                          onClick={() => setAutoSyncTimes(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400/60 hover:text-red-400 text-lg font-bold transition-colors px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {autoSyncTimes.length < 4 && (
                    <button
                      onClick={() => setAutoSyncTimes(prev => [...prev, '12:00'])}
                      className="text-primary/60 hover:text-primary text-xs font-bold border border-primary/20 hover:border-primary/40 rounded-lg px-3 py-2 transition-all"
                    >
                      + Thêm giờ
                    </button>
                  )}
                </div>
                <button
                  onClick={async () => {
                    setSavingSchedule(true);
                    try {
                      await clickup.updateAutoSyncSchedule(autoSyncTimes, true);
                      onToast(`Đã cập nhật lịch: ${autoSyncTimes.join(', ')}`, 'success');
                    } catch (e: any) {
                      onToast(`Lỗi: ${e.message}`, 'error');
                    } finally {
                      setSavingSchedule(false);
                    }
                  }}
                  disabled={savingSchedule}
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-colors disabled:opacity-30"
                >
                  {savingSchedule ? '⏳ Đang lưu...' : '💾 Lưu lịch sync'}
                </button>
              </div>
            )}
          </div>

          {/* CRM Mapping */}
          <div className="border-t border-primary/10 pt-4 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">🔗 Mapping CRM</p>
              <p className="text-neutral-medium/60 text-[11px]">Gắn Space → Khách hàng, Folder → Dự án (CRM là nguồn chuẩn). Nghiệm thu mới sẽ tự liên kết theo mapping này.</p>
            </div>
            {mapLoading ? (
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { type: 'space' as const, title: 'Space → Khách hàng', names: cuNames.spaces, options: crmOpts.clients },
                  { type: 'folder' as const, title: 'Folder → Dự án', names: cuNames.folders, options: crmOpts.projects },
                ]).map(group => (
                  <div key={group.type} className="p-4 rounded-xl border border-primary/10 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">{group.title}</p>
                    {group.names.length === 0 && (
                      <p className="text-neutral-medium/50 text-xs">Chưa có dữ liệu — hãy Sync task trước.</p>
                    )}
                    {group.names.map(name => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-white text-xs font-medium flex-1 truncate" title={name}>{name}</span>
                        {!mapVal(group.type, name) && (
                          <span className="text-[10px] font-black uppercase text-amber-400">Chưa map</span>
                        )}
                        <select
                          value={mapVal(group.type, name)}
                          onChange={e => handleMapChange(group.type, name, e.target.value)}
                          className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary/40 transition-all max-w-[180px]"
                        >
                          <option value="">— Chọn —</option>
                          {group.options.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: API Token */}
      {(step === 'token' || step === 'team') && (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">1</div>
            <h3 className="text-white font-bold">API Token</h3>
          </div>
          <div>
            <label className={labelCls}>ClickUp Personal API Token</label>
            <input
              type="password"
              className={inputCls}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="pk_xxxxxxxxxxxx"
            />
            <p className="text-neutral-medium/50 text-[11px] mt-2">Lấy tại: ClickUp → Avatar góc dưới trái → Settings → Apps → API Token</p>
          </div>
          {step === 'token' && (
            <button onClick={handleTokenSubmit} disabled={loadingStep || !token.trim()} className={btnPrimary}>
              {loadingStep ? '⏳ Đang kết nối...' : '🔗 Kết nối'}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Select Team → Save immediately */}
      {step === 'team' && teams.length > 0 && (
        <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">2</div>
            <h3 className="text-white font-bold">Chọn Workspace</h3>
          </div>
          <div className="space-y-2">
            {teams.map(t => (
              <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedTeamId === t.id ? 'border-primary/40 bg-primary/5' : 'border-primary/10 hover:border-primary/20'
              }`}>
                <input type="radio" name="team" checked={selectedTeamId === t.id} onChange={() => { setSelectedTeamId(t.id); setSelectedTeamName(t.name); }} className="accent-primary" />
                <span className="text-white font-medium">{t.name}</span>
                <span className="text-neutral-medium text-xs">ID: {t.id}</span>
              </label>
            ))}
          </div>
          
          {/* Info */}
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
            <p className="text-amber-400/80 text-xs">
              💡 Chỉ cần chọn Team. Hệ thống sẽ tự động lấy <strong>tất cả Spaces & Lists</strong> khi bạn Sync task.
              Khi bạn thêm Space/List mới trên ClickUp, không cần cấu hình lại — chỉ cần Sync lại.
            </p>
          </div>

          <button onClick={handleSaveTeam} disabled={saving || !selectedTeamId} className={btnPrimary}>
            {saving ? '⏳ Đang lưu...' : '💾 Lưu & Hoàn tất'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClickUpConfigComponent;
