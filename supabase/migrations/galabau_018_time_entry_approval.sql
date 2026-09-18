-- Zeiten-Freigabe: Status, Ablehnungsgrund, Prüfer

CREATE TYPE time_entry_approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS approval_status time_entry_approval_status,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

UPDATE time_entries
SET approval_status = 'pending',
    submitted_at = COALESCE(updated_at, created_at)
WHERE end_time IS NOT NULL
  AND approval_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_approval
  ON time_entries (tenant_id, approval_status)
  WHERE approval_status IS NOT NULL;

-- Neue Berechtigungen für Vorarbeiter, Verwaltung, Administrator
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES ('zeiten.view_all'), ('zeiten.approve')) AS perm(key)
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
