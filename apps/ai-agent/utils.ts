// apps/ai-agent/utils.ts

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
};

export const timeAgoShort = (ts: number): string => {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'vừa xong';
  if (secs < 60) return `${secs}s trước`;
  return `${Math.floor(secs / 60)}m trước`;
};

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const fmtDuration = (ms: number | null): string => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const TYPE_CONFIG = {
  info:            { label: 'Info',       color: '#2196F3', icon: 'ℹ️' },
  warning:         { label: 'Cảnh báo',  color: '#FFA726', icon: '⚠️' },
  action_required: { label: 'Cần xử lý', color: '#F44336', icon: '🔴' },
} as const;

export const STATUS_CONFIG = {
  new:       { label: 'Mới',     color: '#FF9500' },
  reviewed:  { label: 'Đã xem', color: '#4CAF50' },
  dismissed: { label: 'Bỏ qua', color: '#9D9C9D' },
} as const;

export const RUN_STATUS = {
  running:   { label: 'Đang chạy',  color: '#2196F3' },
  completed: { label: 'Hoàn thành', color: '#4CAF50' },
  failed:    { label: 'Lỗi',        color: '#F44336' },
} as const;

export const AGENT_EMPTY_STATE: Record<string, { emoji: string; prompt: string }> = {
  cfo:  { emoji: '💰', prompt: 'Chạy phân tích để nhận insights về tài chính doanh nghiệp' },
  ceo:  { emoji: '👔', prompt: 'Chạy phân tích để nhận insights tổng quan điều hành' },
  cto:  { emoji: '⚙️', prompt: 'Chạy phân tích để nhận insights về hạ tầng kỹ thuật' },
  chro: { emoji: '👥', prompt: 'Chạy phân tích để nhận insights về nhân sự' },
};
