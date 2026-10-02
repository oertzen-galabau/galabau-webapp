import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBudgetBreakdown, type BudgetBreakdown } from '@/lib/orders/budget';

export async function loadClothingOrderBudgetBreakdown(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  year: number,
): Promise<BudgetBreakdown> {
  const [{ data: tenant }, { data: userBudget }, { data: usageRows }] = await Promise.all([
    supabase
      .from('tenants')
      .select('default_clothing_order_budget_eur')
      .eq('id', tenantId)
      .single(),
    supabase
      .from('clothing_order_budgets')
      .select('budget_eur')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('year', year)
      .maybeSingle(),
    supabase
      .from('catalog_orders')
      .select('budget_covered_eur')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('budget_year', year),
  ]);

  const budgetEur = userBudget?.budget_eur ?? tenant?.default_clothing_order_budget_eur ?? null;
  const usedEur = (usageRows ?? []).reduce((sum, row) => sum + Number(row.budget_covered_eur ?? 0), 0);

  return buildBudgetBreakdown(year, budgetEur != null ? Number(budgetEur) : null, usedEur);
}
