import { truncatePreview } from '@/lib/messages/format';

export type UnreadInboxSummary = {
  contactId: string;
  firstName: string;
  lastName: string;
  preview: string;
  unreadCount: number;
  latestAt: string;
};

type UnreadRow = {
  sender_id: string;
  body: string;
  created_at: string;
};

export function buildUnreadInboxSummaries(
  messages: UnreadRow[],
  profiles: Array<{ id: string; first_name: string; last_name: string }>,
  maxItems = 8,
): UnreadInboxSummary[] {
  const bySender = new Map<string, { count: number; latestBody: string; latestAt: string }>();

  for (const msg of messages) {
    const cur = bySender.get(msg.sender_id);
    if (!cur) {
      bySender.set(msg.sender_id, {
        count: 1,
        latestBody: msg.body,
        latestAt: msg.created_at,
      });
      continue;
    }
    cur.count += 1;
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return [...bySender.entries()]
    .map(([contactId, agg]) => {
      const profile = profileMap.get(contactId);
      return {
        contactId,
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        preview: truncatePreview(agg.latestBody),
        unreadCount: agg.count,
        latestAt: agg.latestAt,
      };
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
    .slice(0, maxItems);
}
