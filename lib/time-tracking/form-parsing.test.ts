import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDriverTrip } from './driver-trip';
import { parseTimelineBlocksFromForm } from './form-parsing';

describe('parseTimelineBlocksFromForm', () => {
  it('reads driver_trip from form via parseDriverTrip', () => {
    assert.equal(parseDriverTrip('round_trip'), 'round_trip');
    assert.equal(parseDriverTrip('none'), 'none');
  });

  it('parses timeline blocks from form arrays', () => {
    const formData = new FormData();
    formData.append('block_type[]', 'site_work');
    formData.append('block_start[]', '07:00');
    formData.append('block_end[]', '16:00');
    formData.append('block_site_id[]', 'site-1');

    const blocks = parseTimelineBlocksFromForm(formData);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].start_time, '07:00');
    assert.equal(blocks[0].site_id, 'site-1');
  });
});
