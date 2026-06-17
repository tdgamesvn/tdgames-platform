import React, { useState, useEffect } from 'react';
import { AiAgent, updateAgent } from '../services/aiAgentService';

interface ConfigPanelProps {
  agent: AiAgent;
  onSaved: (updated: AiAgent) => void;
  onError: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ agent, onSaved, onError }) => {
  const [form, setForm] = useState({
    name: agent.name, avatar_emoji: agent.avatar_emoji, role_title: agent.role_title,
    model: agent.model, temperature: agent.temperature, personality: agent.personality,
    is_active: agent.is_active,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: agent.name, avatar_emoji: agent.avatar_emoji, role_title: agent.role_title,
      model: agent.model, temperature: agent.temperature, personality: agent.personality,
      is_active: agent.is_active,
    });
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateAgent(agent.id, form);
    setSaving(false);
    if (ok) onSaved({ ...agent, ...form }); else onError();
  };

  const fc = "w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-primary/50 transition-colors";
  const fs = { background: '#1a1a1a' };
  const lc = "text-[10px] font-black uppercase tracking-wider text-neutral-600 mb-1.5 block";

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base font-black text-white uppercase tracking-wider">⚙️ Cấu hình Agent</span>
      </div>
      <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className={lc}>Trạng thái</p>
            <p className="text-xs text-neutral-600">Agent có được chạy theo lịch không</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`relative w-12 h-6 rounded-full transition-all duration-200 ${form.is_active ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${form.is_active ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="h-px bg-white/5" />
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className={lc}>Emoji</label>
            <input type="text" value={form.avatar_emoji} onChange={e => setForm(f => ({ ...f, avatar_emoji: e.target.value }))} className={fc} style={fs} maxLength={4} />
          </div>
          <div>
            <label className={lc}>Tên Agent</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={fc} style={fs} />
          </div>
        </div>
        <div>
          <label className={lc}>Chức danh</label>
          <input type="text" value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} className={fc} style={fs} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label className={lc}>Model</label>
            <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={fc} style={fs} placeholder="cx/gpt-5.5" />
          </div>
          <div>
            <label className={lc}>Temperature</label>
            <input type="number" min={0} max={1} step={0.05} value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0 }))} className={fc} style={fs} />
          </div>
        </div>
        <div>
          <label className={lc}>Personality / System Prompt thêm</label>
          <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={5} className={`${fc} resize-none`} style={fs} />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
        style={{ background: '#FF9500' }}>
        {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
      </button>
    </div>
  );
};

export default ConfigPanel;
