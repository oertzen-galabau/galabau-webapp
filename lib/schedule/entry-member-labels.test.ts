import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortedEntryMemberLines, sortedEntryTeamDisplay } from '@/lib/schedule/entry-member-labels';

describe('sortedEntryMemberLines', () => {
  it('sortiert Vorarbeiter zuerst, Rest nach Vorname', () => {
    const lines = sortedEntryMemberLines({
      foreman: { id: 'va', first_name: 'Nils', last_name: 'Heitmann', leader_code: null },
      foreman_user_id: 'va',
      members: [
        { user_id: 'a', first_name: 'Marvin', last_name: 'Fischer', leader_code: null },
        { user_id: 'va', first_name: 'Nils', last_name: 'Heitmann', leader_code: null },
        { user_id: 'b', first_name: 'Colin', last_name: 'G', leader_code: null },
      ],
      external_workers_text: null,
    });
    assert.deepEqual(lines, ['Nils H.', 'Colin G.', 'Marvin F.']);
  });

  it('markiert den Vorarbeiter', () => {
    const team = sortedEntryTeamDisplay({
      foreman: { id: 'va', first_name: 'Nils', last_name: 'Heitmann', leader_code: null },
      foreman_user_id: 'va',
      members: [
        { user_id: 'va', first_name: 'Nils', last_name: 'Heitmann', leader_code: null },
        { user_id: 'b', first_name: 'Colin', last_name: 'G', leader_code: null },
      ],
      external_workers_text: null,
    });
    assert.equal(team.members[0]?.isForeman, true);
    assert.equal(team.members[1]?.isForeman, false);
  });

  it('trennt Subunternehmer von Mitarbeitern', () => {
    const entry = {
      foreman: null,
      members: [{ user_id: 'a', first_name: 'Alili', last_name: 'Alil', leader_code: null }],
      external_workers_text: 'GS Nord GmbH, Beispiel +2',
    };
    const team = sortedEntryTeamDisplay(entry);
    assert.deepEqual(team.members, [{ text: 'Alili A.', isForeman: false }]);
    assert.deepEqual(team.external, ['GS Nord GmbH', 'Beispiel +2']);
    assert.deepEqual(sortedEntryMemberLines(entry), ['Alili A.', 'GS Nord GmbH', 'Beispiel +2']);
  });
});
