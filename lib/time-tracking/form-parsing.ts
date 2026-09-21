import type { TimeBlockType } from '@/lib/types/database';
import type { TimelineBlockInput } from '@/lib/time-tracking/timeline';

export function parseTimelineBlocksFromForm(formData: FormData): TimelineBlockInput[] {
  const blockTypes = formData.getAll('block_type[]');
  const starts = formData.getAll('block_start[]');
  const ends = formData.getAll('block_end[]');
  const siteIds = formData.getAll('block_site_id[]');

  const blocks: TimelineBlockInput[] = [];
  for (let index = 0; index < blockTypes.length; index++) {
    const blockType = String(blockTypes[index] ?? 'site_work') as TimeBlockType;
    const startTime = String(starts[index] ?? '').trim();
    const endTime = String(ends[index] ?? '').trim();
    if (!startTime || !endTime) continue;

    blocks.push({
      block_type: blockType,
      start_time: startTime,
      end_time: endTime,
      site_id: blockType === 'site_work' ? String(siteIds[index] ?? '').trim() || null : null,
    });
  }

  return blocks;
}

export function parseLegacySegmentsFromForm(formData: FormData): TimelineBlockInput[] {
  const siteIds = formData.getAll('segment_site_id[]');
  const travelMinutes = formData.getAll('segment_travel_minutes[]');
  const segments: TimelineBlockInput[] = [];

  for (let index = 0; index < siteIds.length; index++) {
    const siteId = String(siteIds[index] ?? '').trim();
    if (!siteId) continue;
    segments.push({
      block_type: 'site_work',
      start_time: '',
      end_time: '',
      site_id: siteId,
      travel_minutes: Number(travelMinutes[index] ?? 0),
    });
  }

  return segments;
}

export function parseSegmentsFromForm(formData: FormData): TimelineBlockInput[] {
  const timelineBlocks = parseTimelineBlocksFromForm(formData);
  if (timelineBlocks.length > 0) return timelineBlocks;
  return parseLegacySegmentsFromForm(formData);
}
