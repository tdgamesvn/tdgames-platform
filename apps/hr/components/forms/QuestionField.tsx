// Ô trả lời 1 câu hỏi — dùng chung cho Portal (điền thật) và HR (xem trước).
// Mobile-first: nút chọn to (min-h 44px), không dùng select native.
import React from 'react';
import { HrFormQuestion } from '../../services/hrFormService';

interface Props {
  q: HrFormQuestion;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
}

const inputCls = 'w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-white focus:border-primary outline-none';
const chip = (on: boolean) =>
  `min-h-[44px] px-3 py-2 rounded-lg border text-[13px] font-bold text-left transition-colors ${
    on ? 'bg-primary/15 border-primary text-primary' : 'bg-[#1a1a1a] border-white/10 text-neutral-300'}`;

export function scaleRange(q: HrFormQuestion): number[] {
  if (q.kind === 'rating') return [1, 2, 3, 4, 5];
  const min = Number(q.options?.min ?? 1), max = Number(q.options?.max ?? 10);
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
}

const QuestionField: React.FC<Props> = ({ q, value, onChange, disabled }) => {
  const opts: string[] = Array.isArray(q.options) ? q.options : [];
  return (
    <div className="space-y-2">
      <p className="text-[14px] font-bold text-white leading-snug">
        {q.label}{q.required && <span className="text-[#FF453A]"> *</span>}
      </p>

      {q.kind === 'text' && (
        <input className={inputCls} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)} />
      )}
      {q.kind === 'textarea' && (
        <textarea className={inputCls} rows={4} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)} />
      )}
      {q.kind === 'single_choice' && (
        <div className="grid gap-2">
          {opts.map(o => (
            <button type="button" key={o} disabled={disabled} className={chip(value === o)} onClick={() => onChange(o)}>{o}</button>
          ))}
        </div>
      )}
      {q.kind === 'multi_choice' && (
        <div className="grid gap-2">
          {opts.map(o => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const on = arr.includes(o);
            return (
              <button type="button" key={o} disabled={disabled} className={chip(on)}
                onClick={() => onChange(on ? arr.filter(x => x !== o) : [...arr, o])}>
                {on ? '☑' : '☐'} {o}
              </button>
            );
          })}
        </div>
      )}
      {(q.kind === 'rating' || q.kind === 'scale') && (
        <div className="flex flex-wrap gap-1.5">
          {scaleRange(q).map(n => (
            <button type="button" key={n} disabled={disabled}
              className={`min-w-[44px] ${chip(value === n)} text-center`} onClick={() => onChange(n)}>
              {q.kind === 'rating' ? `${n}★` : n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionField;
