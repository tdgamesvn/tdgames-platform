import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AiConversation, sendChatMessage } from '../services/aiAgentService';

// #2196F3 = status-info token value (matches text-status-info in style guide)
const STATUS_INFO_COLOR = '#2196F3';

const CHANNEL_CONFIG = {
  app:      { label: 'APP',      color: '#FF9500' },
  telegram: { label: 'TELEGRAM', color: STATUS_INFO_COLOR },
} as const;

const chatDateKey = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

interface ChatPanelProps {
  conversations: AiConversation[];
  setConversations: React.Dispatch<React.SetStateAction<AiConversation[]>>;
  agentId: string;
  agentEmoji: string;
  agentName: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ conversations, setConversations, agentId, agentEmoji, agentName }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);

  useEffect(() => { scrollToBottom(); }, [conversations, sending, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setSending(true);
    const userMsg: AiConversation = {
      id: `temp-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'user',
      content: trimmed, tokens_used: 0, created_at: new Date().toISOString(),
    };
    setConversations(prev => [...prev, userMsg]);
    const res = await sendChatMessage(agentId, trimmed);
    if (res.ok && res.reply) {
      setConversations(prev => [...prev, {
        id: `temp-reply-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'assistant',
        content: res.reply!, tokens_used: 0, created_at: new Date().toISOString(),
      }]);
    } else if (!res.ok) {
      setConversations(prev => [...prev, {
        id: `temp-err-${Date.now()}`, agent_id: agentId, channel: 'app', role: 'assistant',
        content: `[Lỗi] ${res.error?.slice(0, 200) || 'Không nhận được phản hồi từ agent'}`,
        tokens_used: 0, created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  let lastDateKey = '';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-3">{agentEmoji}</p>
            <p className="text-neutral-600 text-sm">Chưa có cuộc trò chuyện nào với {agentName}</p>
            <p className="text-xs mt-1 text-neutral-700">Gửi tin nhắn để bắt đầu chat</p>
          </div>
        ) : (
          conversations.map(msg => {
            const dateKey = chatDateKey(msg.created_at);
            const showDateSep = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            const isUser = msg.role === 'user';
            const chConf = CHANNEL_CONFIG[msg.channel as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.app;
            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">{dateKey}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
                      style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
                      {agentEmoji}
                    </div>
                  )}
                  <div className={`${isUser ? 'items-end' : 'items-start'}`} style={{ maxWidth: '75%' }}>
                    <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${chConf.color}20`, color: chConf.color }}>{chConf.label}</span>
                      <span className="text-[10px] text-neutral-700">{chatTime(msg.created_at)}</span>
                    </div>
                    <div className={`rounded-2xl border p-3 ${isUser ? 'border-primary/20' : 'border-white/8'}`}
                      style={{ background: isUser ? 'rgba(255,149,0,0.05)' : 'rgba(255,255,255,0.02)' }}>
                      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        {sending && (
          <div className="flex justify-start gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1"
              style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
              {agentEmoji}
            </div>
            <div className="rounded-2xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-1.5">
                {[0, 200, 400].map(delay => (
                  <span key={delay} className="w-2 h-2 rounded-full bg-primary/60 animate-td-pulse" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nhắn tin cho ${agentName}...`}
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors disabled:opacity-50"
            style={{ background: '#1a1a1a' }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
            style={{ background: '#FF9500' }}
          >
            {sending ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
