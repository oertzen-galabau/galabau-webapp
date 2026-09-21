-- Partial index for fast unread message counts per recipient
CREATE INDEX IF NOT EXISTS messages_unread_recipient_idx
  ON messages (recipient_id)
  WHERE read_at IS NULL;
