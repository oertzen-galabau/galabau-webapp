import type { ActionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';

/** PDF herunterladen/versenden: Verwaltung (`orders.share`) oder eigene Bestellung (`orders.create`). */
export function canAccessOrderFormPdf(
  ctx: ActionContext,
  options: { orderUserIds: string[] },
): boolean {
  if (canAccess(ctx, 'orders.share')) return true;
  if (!canAccess(ctx, 'orders.create')) return false;
  return options.orderUserIds.every((id) => id === ctx.userId);
}
