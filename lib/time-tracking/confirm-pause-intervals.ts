import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeBlockType } from '@/lib/types/database';
import { confirmIntervalType as confirmIntervalTypeRow } from '@/lib/time-tracking/intervals';

export type PauseIntervalConfirmation = {
  intervalId: string;
  blockType: TimeBlockType;
};

export async function confirmPauseIntervalsForUser(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  confirmations: PauseIntervalConfirmation[],
): Promise<void> {
  for (const { intervalId, blockType } of confirmations) {
    const { data: interval, error } = await supabase
      .from('time_entry_intervals')
      .select('id, tenant_id, time_entry_id, phase')
      .eq('id', intervalId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !interval) throw new Error(error?.message ?? 'Intervall nicht gefunden.');
    if (interval.phase !== 'pause') throw new Error('Nur Pausen können bestätigt werden.');

    const { data: entry } = await supabase
      .from('time_entries')
      .select('user_id, end_time')
      .eq('id', interval.time_entry_id)
      .single();
    if (!entry || entry.user_id !== userId) throw new Error('Keine Berechtigung.');
    if (entry.end_time) throw new Error('Tag ist bereits abgeschlossen.');

    await confirmIntervalTypeRow(supabase, intervalId, blockType);
  }
}
