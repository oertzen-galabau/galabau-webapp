-- Bauleiter-Kandidaten: explizites Profil-Flag (Baustellen-Auswahl „Bauleiter“)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_site_manager boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_site_manager IS
  'Kann auf Baustellen als Bauleiter gewählt werden (site_manager_user_id).';

CREATE INDEX IF NOT EXISTS profiles_tenant_site_manager_idx
  ON profiles (tenant_id, is_site_manager)
  WHERE is_site_manager = true;

UPDATE profiles p
SET is_site_manager = true
FROM tenant_roles tr
WHERE p.tenant_role_id = tr.id
  AND tr.slug IN ('verwaltung', 'administrator');
