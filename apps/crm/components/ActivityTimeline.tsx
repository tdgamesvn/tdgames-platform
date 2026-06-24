import React, { useState, useEffect } from 'react';
import { CrmActivity, CrmClient } from '@/types';
import { fetchActivities, createActivity, deleteActivity } from '../services/crmService';

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  call:          { icon: '📞', label: 'Gọi điện',    color: '#34C759' },
  email:         { icon: '📧', label: 'Email',       color: '#0A84FF' },
  meeting:       { icon: '🤝', label: 'Meeting',     color: '#FF9500' },
  note:          { icon: '📝', label: 'Ghi chú',     color: '#AF52DE' },
  status_change: { icon: '🔄', label: 'Đổi trạng thái', color: '#FF3B30' },
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: '#34C759',
  neutral:  '#FF9500',
  negative: '#FF3B30',
};

interface Props {
  clientId: string;
  clientName: string;
  actor: string;
}

const ActivityTimeline: React.FC<Props> = ({ clientId, clientName, actor }) => {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formType, setFormType] = useState<CrmActivity['activity_type']>('call');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOutcome, setFormOutcome] = useState<CrmActivity['outcome']>('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const data = await fetchActivities(clientId);
      setActivities(data);
    } catch { }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadActivities(); }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setIsSaving(true);
    try {
      await createActivity({
        client_id: clientId,
        activity_type: formType,
        title: formTitle.trim(),
        description: formDescription.trim(),
        outcome: formOutcome,
        activity_date: new Date(formDate).toISOString(),
        actor,
      });
      setFormTitle(''); setFormDescription(''); setFormOutcome('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setShowForm(false);
      await loadActivities();
    } catch { }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá hoạt động này?')) return;
    try { await deleteActivity(id); await loadActivities(); } catch { }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">
          Lịch sử tương tác • {clientName}
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          style={{
            background: showForm ? 'rgba(255,59,48,0.1)' : 'rgba(255,149,0,0.1)',
            border: `1px solid ${showForm ? 'rgba(255,59,48,0.3)' : 'rgba(255,149,0,0.3)'}`,
            color: showForm ? '#FF3B30' : '#FF9500',
          }}
        >
          {showForm ? '✕ Huỷ' : '＋ Thêm'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-[20px] bg-surface border border-primary/10 p-5 space-y-4">
          {/* Type Selector */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPE_META).filter(([k]) => k !== 'status_change').map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormType(key as CrmActivity['activity_type'])}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                style={formType === key ? {
                  background: meta.color + '20',
                  borderColor: meta.color + '50',
                  color: meta.color,
                } : undefined}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>

          {/* Title + Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Tiêu đề hoạt động..."
              className="col-span-2 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
              required
            />
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
              style={{ background: '#1a1a1a' }}
            />
          </div>

          {/* Description */}
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Chi tiết (tuỳ chọn)..."
            rows={2}
            className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full resize-none"
            style={{ background: '#1a1a1a' }}
          />

          {/* Outcome + Submit */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {[
                { val: 'positive' as const, label: '👍 Tích cực', color: '#34C759' },
                { val: 'neutral' as const, label: '😐 Bình thường', color: '#FF9500' },
                { val: 'negative' as const, label: '👎 Không tốt', color: '#FF3B30' },
              ].map(o => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setFormOutcome(formOutcome === o.val ? '' : o.val)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                  style={formOutcome === o.val ? {
                    background: o.color + '20',
                    borderColor: o.color + '40',
                    color: o.color,
                  } : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={isSaving || !formTitle.trim()}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
              style={{ background: '#FF9500' }}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="py-8 text-center">
          <p className="text-xs text-neutral-medium animate-pulse">Đang tải...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-neutral-700 text-sm">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
          <p className="text-xs mt-1 text-neutral-700">Thêm ghi chú đầu tiên về khách hàng này</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <div className="space-y-1">
            {activities.map((act, i) => {
              const meta = TYPE_META[act.activity_type] || TYPE_META.note;
              const outcomeColor = act.outcome ? OUTCOME_COLORS[act.outcome] : null;
              return (
                <div key={act.id} className="relative flex gap-4 group py-3 px-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: meta.color + '15', border: `1px solid ${meta.color}30` }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{act.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: meta.color + '15', color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-neutral-medium tabular-nums">
                            {formatDate(act.activity_date)} • {formatTime(act.activity_date)}
                          </span>
                          {act.actor && (
                            <span className="text-[10px] text-white/30">bởi {act.actor}</span>
                          )}
                          {outcomeColor && (
                            <span className="w-2 h-2 rounded-full" style={{ background: outcomeColor }} title={act.outcome} />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(act.id)}
                        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-xs transition-opacity text-red-400"
                        title="Xoá"
                      >✕</button>
                    </div>
                    {act.description && (
                      <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{act.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
