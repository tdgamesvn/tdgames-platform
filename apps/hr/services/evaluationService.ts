import { supabase } from '@/services/supabaseClient';
import {
  EvalGroup, EvalPeriodType, EvalRating, EvalStatus,
  HrEvaluationCycle, HrEvaluationSubmission,
} from '@/types';

// ══════════════════════════════════════════════════════════════
// ── Fixed Criteria Config ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface CriterionConfig {
  label: string;
  hint: string; // short description shown under slider
}

export interface GroupConfig {
  name: string;
  weight: number;
  criteria: CriterionConfig[];
}

/** Returns the scoring groups config for a given period type.
 *  semi_annual gets an extra 5th group (20% mục tiêu kỳ trước)
 *  but only if hasPreviousCycle = true. Otherwise it uses probation layout.
 */
export function getGroupsConfig(periodType: EvalPeriodType, hasPreviousCycle = false): GroupConfig[] {
  const base: GroupConfig[] = [
    {
      name: 'Chất lượng & Kết quả công việc',
      weight: 35,
      criteria: [
        { label: 'Chất lượng output', hint: 'Sản phẩm/kết quả đạt tiêu chuẩn, ít lỗi' },
        { label: 'Đúng deadline', hint: 'Hoàn thành đúng thời hạn đã cam kết' },
        { label: 'Số lượng task hoàn thành', hint: 'Khối lượng công việc so với kỳ vọng' },
      ],
    },
    {
      name: 'Thái độ & Tinh thần',
      weight: 30,
      criteria: [
        { label: 'Tinh thần trách nhiệm', hint: 'Chủ động nhận và hoàn thành trách nhiệm' },
        { label: 'Chủ động & sáng kiến', hint: 'Đề xuất cải tiến, không chờ được giao' },
      ],
    },
    {
      name: 'Kỹ năng làm việc',
      weight: 20,
      criteria: [
        { label: 'Giao tiếp', hint: 'Truyền đạt rõ ràng, lắng nghe tốt' },
        { label: 'Giải quyết vấn đề', hint: 'Phân tích và xử lý vấn đề hiệu quả' },
      ],
    },
    {
      name: 'Phù hợp văn hóa',
      weight: 15,
      criteria: [
        { label: 'Teamwork', hint: 'Hỗ trợ đồng nghiệp, làm việc nhóm hiệu quả' },
        { label: 'Tuân thủ nội quy', hint: 'Chấp hành quy định, đúng giờ, tác phong' },
      ],
    },
  ];

  if (periodType === 'semi_annual' && hasPreviousCycle) {
    // Rebalance weights: 28 + 24 + 16 + 12 + 20 = 100
    const rebalanced = base.map((g, i) => ({
      ...g,
      weight: [28, 24, 16, 12][i],
    }));
    rebalanced.push({
      name: 'Hoàn thành mục tiêu kỳ trước',
      weight: 20,
      criteria: [
        { label: 'Tỷ lệ đạt mục tiêu', hint: 'Phần trăm mục tiêu đã hoàn thành' },
        { label: 'Chất lượng đạt mục tiêu', hint: 'Mức độ đạt chất lượng của mục tiêu' },
      ],
    });
    return rebalanced;
  }

  return base;
}

// ══════════════════════════════════════════════════════════════
// ── Pure Score Helpers ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/** total = sum(group_avg * weight/100) */
export function calcTotalScore(groups: EvalGroup[]): number {
  const total = groups.reduce((acc, g) => acc + g.group_avg * (g.weight / 100), 0);
  return Math.round(total * 100) / 100;
}

export function calcRating(score: number): EvalRating {
  if (score >= 4.0) return 'excellent';       // Vượt kỳ vọng
  if (score >= 3.0) return 'good';            // Đạt yêu cầu
  if (score >= 2.0) return 'meets';           // Cần cải thiện
  return 'needs_improvement';                 // Không đạt
}

export function calcGap(self: HrEvaluationSubmission, leader: HrEvaluationSubmission): number {
  return Math.round(Math.abs(leader.total_score - self.total_score) * 100) / 100;
}

export function calcGroupAvg(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/** Auto-generate period_label from type + current month/year */
export function autoLabel(periodType: EvalPeriodType): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  if (periodType === 'probation') return `Thử việc T${m}/${y}`;
  return `Review 6T - T${m}/${y}`;
}

export const RATING_LABELS: Record<EvalRating, string> = {
  excellent:         'Vượt kỳ vọng',   // ≥ 4.0
  good:              'Đạt yêu cầu',    // 3.0–3.9
  meets:             'Cần cải thiện',  // 2.0–2.9
  needs_improvement: 'Không đạt',      // < 2.0
};

/** Short label for badges in small spaces */
export const RATING_SHORT: Record<EvalRating, string> = {
  excellent:         'Vượt KV',
  good:              'Đạt YC',
  meets:             'Cần CT',
  needs_improvement: 'Không đạt',
};

/** Action suggestion per rating */
export const RATING_ACTION: Record<EvalRating, string> = {
  excellent:         'Chính thức hoá sớm · Xem xét thưởng / tăng lương',
  good:              'Chính thức hoá bình thường',
  meets:             'Gia hạn thử việc hoặc lập kế hoạch cải thiện (PIP)',
  needs_improvement: 'Xem xét chấm dứt hợp đồng',
};

export const STATUS_LABELS: Record<EvalStatus, string> = {
  pending_self: 'Chờ NV tự đánh giá',
  pending_leader: 'Chờ Leader đánh giá',
  pending_1on1: 'Cần 1-on-1',
  completed: 'Hoàn thành',
};

// ══════════════════════════════════════════════════════════════
// ── Fetch ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEvaluationCycles(filter?: EvalStatus): Promise<HrEvaluationCycle[]> {
  let q = supabase
    .from('hr_evaluation_cycles')
    .select('*, employee:hr_employees(id,full_name,employee_code,position,avatar_url)')
    .order('created_at', { ascending: false });

  if (filter) q = q.eq('status', filter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as HrEvaluationCycle[];
}

export async function fetchCycleById(id: string): Promise<HrEvaluationCycle> {
  const { data, error } = await supabase
    .from('hr_evaluation_cycles')
    .select('*, employee:hr_employees(id,full_name,employee_code,position,avatar_url)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as HrEvaluationCycle;
}

export async function fetchSubmissions(cycleId: string): Promise<HrEvaluationSubmission[]> {
  const { data, error } = await supabase
    .from('hr_evaluation_submissions')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('submitted_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as HrEvaluationSubmission[];
}

/** Fetch cycles for a specific employee (used in Portal) */
export async function fetchMyCycles(employeeId: string): Promise<HrEvaluationCycle[]> {
  const { data, error } = await supabase
    .from('hr_evaluation_cycles')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HrEvaluationCycle[];
}

// ══════════════════════════════════════════════════════════════
// ── Mutations ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function createCycle(data: {
  employee_id: string;
  period_type: EvalPeriodType;
  period_label: string;
  leader_user_id: string;
  created_by: string;
  deadline: string;         // ISO date string "YYYY-MM-DD"
}): Promise<HrEvaluationCycle> {
  const { data: row, error } = await supabase
    .from('hr_evaluation_cycles')
    .insert({
      employee_id:    data.employee_id,
      period_type:    data.period_type,
      period_label:   data.period_label,
      leader_user_id: data.leader_user_id,
      created_by:     data.created_by,
      status:         'pending_self',
      deadline:       data.deadline,
    })
    .select('*, employee:hr_employees(id,full_name,employee_code,position,avatar_url)')
    .single();
  if (error) throw new Error(error.message);
  return row as HrEvaluationCycle;
}

/** Submit a self or leader evaluation.
 *  Automatically advances cycle.status and detects gap.
 */
export async function submitEvaluation(data: {
  cycle_id: string;
  evaluator_role: 'self' | 'leader';
  evaluator_user_id: string;
  groups: EvalGroup[];
  comments: string;
  recommended_action: string;
}): Promise<void> {
  const total_score = calcTotalScore(data.groups);
  const rating = calcRating(total_score);

  // 1. Insert submission
  const { error: subError } = await supabase
    .from('hr_evaluation_submissions')
    .upsert({
      cycle_id: data.cycle_id,
      evaluator_role: data.evaluator_role,
      evaluator_user_id: data.evaluator_user_id,
      groups: data.groups,
      total_score,
      rating,
      comments: data.comments,
      recommended_action: data.recommended_action,
    }, { onConflict: 'cycle_id,evaluator_role' });

  if (subError) throw new Error(subError.message);

  // 2. Advance cycle status
  if (data.evaluator_role === 'self') {
    const { error } = await supabase
      .from('hr_evaluation_cycles')
      .update({ status: 'pending_leader', self_submitted_at: new Date().toISOString() })
      .eq('id', data.cycle_id);
    if (error) throw new Error(error.message);
  } else {
    // leader submitted — check gap
    const subs = await fetchSubmissions(data.cycle_id);
    const selfSub = subs.find(s => s.evaluator_role === 'self');
    const leaderScore = total_score;

    let cycleUpdate: Record<string, unknown> = {
      leader_submitted_at: new Date().toISOString(),
    };

    if (selfSub) {
      const gap = Math.abs(leaderScore - selfSub.total_score);
      if (gap > 1.0) {
        cycleUpdate = { ...cycleUpdate, requires_1on1: true, status: 'pending_1on1' };
      } else {
        cycleUpdate = { ...cycleUpdate, status: 'completed', completed_at: new Date().toISOString() };
      }
    } else {
      // No self submission (admin-is-leader edge case) → complete directly
      cycleUpdate = { ...cycleUpdate, status: 'completed', completed_at: new Date().toISOString() };
    }

    const { error } = await supabase
      .from('hr_evaluation_cycles')
      .update(cycleUpdate)
      .eq('id', data.cycle_id);
    if (error) throw new Error(error.message);
  }
}

/** HR marks 1-on-1 session done → cycle becomes completed */
export async function markComplete1on1(cycleId: string): Promise<void> {
  const { error } = await supabase
    .from('hr_evaluation_cycles')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', cycleId);
  if (error) throw new Error(error.message);
}

export async function deleteCycle(cycleId: string): Promise<void> {
  const { error } = await supabase
    .from('hr_evaluation_cycles')
    .delete()
    .eq('id', cycleId);
  if (error) throw new Error(error.message);
}
