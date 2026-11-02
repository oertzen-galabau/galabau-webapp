import type { TimeBlockType, TimeEntryInterval } from '@/lib/types/database';

export type PauseEndConfirmPrompt = {
  intervalId: string;
  suggestedBlockType: TimeBlockType;
  pauseStartedAt: string;
  pauseEndedAt: string;
};

export function latestPauseConfirmPrompt(
  intervals: TimeEntryInterval[],
): PauseEndConfirmPrompt | null {
  const row = [...intervals]
    .reverse()
    .find(
      (item) =>
        item.phase === 'pause' &&
        item.ended_at &&
        !item.confirmed_block_type &&
        item.suggested_block_type,
    );
  if (!row?.suggested_block_type || !row.ended_at) return null;
  return {
    intervalId: row.id,
    suggestedBlockType: row.suggested_block_type,
    pauseStartedAt: row.started_at,
    pauseEndedAt: row.ended_at,
  };
}
