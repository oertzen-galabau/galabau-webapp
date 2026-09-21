import { z } from 'zod';
import { INFOBOARD_GRID_COLS, INFOBOARD_MAX_W, INFOBOARD_MIN_W, WIDGET_REGISTRY } from '@/lib/infoboard/widgets';
import { INFOBOARD_WIDGET_IDS } from '@/lib/infoboard/types';

const layoutItemSchema = z.object({
  id: z.enum(INFOBOARD_WIDGET_IDS),
  x: z.number().int().min(0).max(INFOBOARD_GRID_COLS - 1),
  y: z.number().int().min(0),
  w: z.number().int().min(INFOBOARD_MIN_W).max(INFOBOARD_MAX_W),
  h: z.number().int().min(1).max(20),
  visible: z.boolean(),
});

/** Lese-Schema: erlaubt alte 12-Spalten-Werte vor Migration auf 4 Spalten. */
const storedLayoutItemSchema = z.object({
  id: z.enum(INFOBOARD_WIDGET_IDS),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(20),
  visible: z.boolean(),
});

export const dashboardLayoutSchema = z.object({
  version: z.literal(1),
  items: z.array(layoutItemSchema).max(INFOBOARD_WIDGET_IDS.length),
});

export const storedDashboardLayoutSchema = z.object({
  version: z.literal(1),
  items: z.array(storedLayoutItemSchema).max(INFOBOARD_WIDGET_IDS.length),
});

export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;

export function clampLayoutItem(item: z.infer<typeof layoutItemSchema>) {
  const def = WIDGET_REGISTRY[item.id];
  const w = Math.min(Math.max(item.w, INFOBOARD_MIN_W), INFOBOARD_MAX_W);
  const h = Math.min(Math.max(item.h, def.minH), def.maxH ?? 20);
  const x = Math.min(Math.max(item.x, 0), INFOBOARD_GRID_COLS - w);
  return { ...item, x, y: Math.max(item.y, 0), w, h };
}

export function clampStoredLayoutItem(item: z.infer<typeof storedLayoutItemSchema>) {
  const def = WIDGET_REGISTRY[item.id];
  const h = Math.min(Math.max(item.h, def.minH), def.maxH ?? 20);
  return { ...item, y: Math.max(item.y, 0), h };
}
