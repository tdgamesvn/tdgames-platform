import { supabase } from '@/services/supabaseClient';
import { FixedAsset, Advance } from '@/types';

// ══════════════════════════════════════════════════
// Fixed Assets
// ══════════════════════════════════════════════════

export async function fetchFixedAssets(): Promise<FixedAsset[]> {
  const { data, error } = await supabase
    .from('acc_fixed_assets')
    .select('*')
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveFixedAsset(
  asset: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>
): Promise<FixedAsset> {
  const { data, error } = await supabase
    .from('acc_fixed_assets')
    .insert(asset)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFixedAsset(
  id: string,
  updates: Partial<Omit<FixedAsset, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('acc_fixed_assets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFixedAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_fixed_assets')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Depreciation helpers ──────────────────────────

/** Tính khấu hao theo đường thẳng — trả về các chỉ số tại thời điểm hiện tại */
export function calcDepreciation(asset: FixedAsset, atDate: Date = new Date()) {
  const purchaseDate = new Date(asset.purchase_date);
  const depreciableAmount = asset.cost - asset.residual_value;
  const monthlyDep = depreciableAmount / asset.useful_life_months;

  // Số tháng đã sử dụng (tính từ đầu tháng mua)
  const monthsElapsed = Math.max(
    0,
    (atDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
      (atDate.getMonth() - purchaseDate.getMonth())
  );
  const depMonths = Math.min(monthsElapsed, asset.useful_life_months);
  const accumulated = monthlyDep * depMonths;
  const bookValue = Math.max(asset.residual_value, asset.cost - accumulated);
  const remainingMonths = Math.max(0, asset.useful_life_months - depMonths);
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + asset.useful_life_months);

  return {
    monthlyDep,
    yearlyDep: monthlyDep * 12,
    accumulated,
    bookValue,
    depMonths,
    remainingMonths,
    endDate,
    isFullyDepreciated: depMonths >= asset.useful_life_months,
    depreciationRate: (1 / asset.useful_life_months) * 12 * 100, // % /năm
  };
}

/** Tổng hợp khấu hao tháng này cho toàn bộ tài sản đang active */
export function sumMonthlyDepreciation(assets: FixedAsset[]): number {
  return assets
    .filter(a => a.status === 'active')
    .reduce((sum, a) => {
      const { monthlyDep, isFullyDepreciated } = calcDepreciation(a);
      return sum + (isFullyDepreciated ? 0 : monthlyDep);
    }, 0);
}

// ══════════════════════════════════════════════════
// Advances (Tạm ứng / Hoàn ứng)
// ══════════════════════════════════════════════════

export async function fetchAdvances(): Promise<Advance[]> {
  const { data, error } = await supabase
    .from('acc_advances')
    .select('*')
    .order('advance_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveAdvance(
  advance: Omit<Advance, 'id' | 'created_at' | 'updated_at'>
): Promise<Advance> {
  const { data, error } = await supabase
    .from('acc_advances')
    .insert(advance)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function settleAdvance(
  id: string,
  payload: {
    settled_amount: number;
    returned_amount: number;
    settlement_date: string;
    settlement_notes?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('acc_advances')
    .update({
      ...payload,
      status: 'settled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelAdvance(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_advances')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAdvance(id: string): Promise<void> {
  const { error } = await supabase.from('acc_advances').delete().eq('id', id);
  if (error) throw error;
}
