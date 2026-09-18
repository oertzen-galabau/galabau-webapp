-- Enforce at most one superadmin profile platform-wide.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_superadmin_idx
  ON profiles (role)
  WHERE role = 'superadmin';
