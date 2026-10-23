import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  patchContactListFromMessageInsert,
  patchContactListFromMessageRead,
  type ContactWithSummary,
} from '@/lib/messages/conversations';

const me = 'user-me';
const alice = 'user-alice';
const bob = 'user-bob';

function contact(id: string, lastName: string, overrides: Partial<ContactWithSummary> = {}): ContactWithSummary {
  return {
    id,
    first_name: id,
    last_name: lastName,
    email: `${id}@test.de`,
    job_title: null,
    roleName: null,
    ...overrides,
  };
}

describe('patchContactListFromMessageInsert', () => {
  it('aktualisiert Vorschau bei eingehender Nachricht und sortiert nach oben', () => {
    const list: ContactWithSummary[] = [
      contact(alice, 'Alpha', {
        lastMessage: 'Alt',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
        lastMessageSenderId: alice,
        unreadCount: 0,
      }),
      contact(bob, 'Beta'),
    ];

    const next = patchContactListFromMessageInsert(
      list,
      {
        sender_id: bob,
        recipient_id: me,
        body: 'Hallo',
        created_at: '2026-01-02T12:00:00.000Z',
        read_at: null,
      },
      me,
    );

    const bobRow = next.find((c) => c.id === bob);
    assert.equal(bobRow?.lastMessage, 'Hallo');
    assert.equal(bobRow?.unreadCount, 1);
    assert.equal(bobRow?.latestUnreadMessage, 'Hallo');
    assert.equal(next[0]?.id, bob);
  });

  it('aktualisiert Vorschau bei eigener gesendeter Nachricht ohne Unread', () => {
    const list: ContactWithSummary[] = [contact(alice, 'Alpha'), contact(bob, 'Beta')];

    const next = patchContactListFromMessageInsert(
      list,
      {
        sender_id: me,
        recipient_id: alice,
        body: 'Ping',
        created_at: '2026-01-02T12:00:00.000Z',
        read_at: null,
      },
      me,
    );

    const aliceRow = next.find((c) => c.id === alice);
    assert.equal(aliceRow?.lastMessage, 'Ping');
    assert.equal(aliceRow?.unreadCount, 0);
    assert.equal(next[0]?.id, alice);
  });
});

describe('patchContactListFromMessageRead', () => {
  it('reduziert Unread und entfernt Unread-Vorschau bei 0', () => {
    const list: ContactWithSummary[] = [
      contact(alice, 'Alpha', {
        lastMessage: 'Neu',
        lastMessageAt: '2026-01-02T12:00:00.000Z',
        lastMessageSenderId: alice,
        unreadCount: 2,
        latestUnreadMessage: 'Neu',
        latestUnreadAt: '2026-01-02T12:00:00.000Z',
      }),
    ];

    const once = patchContactListFromMessageRead(
      list,
      { sender_id: alice, recipient_id: me, read_at: '2026-01-02T12:01:00.000Z' },
      me,
    );
    assert.equal(once[0]?.unreadCount, 1);
    assert.equal(once[0]?.latestUnreadMessage, 'Neu');

    const twice = patchContactListFromMessageRead(
      once,
      { sender_id: alice, recipient_id: me, read_at: '2026-01-02T12:02:00.000Z' },
      me,
    );
    assert.equal(twice[0]?.unreadCount, 0);
    assert.equal(twice[0]?.latestUnreadMessage, undefined);
  });
});
