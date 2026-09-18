-- 1:1-Chat: messages von Ticket-Modell auf Direktnachrichten umstellen

-- Alte Ticket-Spalten entfernen
ALTER TABLE messages
  DROP COLUMN IF EXISTS subject,
  DROP COLUMN IF EXISTS recipient_role,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS site_id;

-- Enum nur für altes Ticket-Status-Feld
DROP TYPE IF EXISTS message_status;

-- Neue Chat-Spalten
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- NOT NULL erst setzen, wenn Spalte existiert (leere Tabelle)
ALTER TABLE messages
  ALTER COLUMN recipient_id SET NOT NULL;

-- Index für Konversationsabfragen
CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON messages (tenant_id, sender_id, recipient_id, created_at);

-- RLS neu aufsetzen (nur Sender/Empfänger sehen eigene Nachrichten)
DROP POLICY IF EXISTS tenant_isolation_messages ON messages;

CREATE POLICY messages_select ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

CREATE POLICY messages_insert ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = recipient_id
        AND p.tenant_id = current_tenant_id()
    )
  );

CREATE POLICY messages_update ON messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Realtime für Live-Chat
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
