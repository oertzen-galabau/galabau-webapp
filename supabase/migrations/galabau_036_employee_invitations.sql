-- Employee invitations (manual onboarding without SMTP) and forced password change flag

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.must_change_password IS
  'True until the user completes first login and sets their own password.';

CREATE TABLE IF NOT EXISTS public.employee_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_invitations_token_hash_idx
  ON public.employee_invitations (token_hash)
  WHERE revoked_at IS NULL AND used_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_invitations_user_active_idx
  ON public.employee_invitations (user_id, created_at DESC)
  WHERE revoked_at IS NULL AND used_at IS NULL;

ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;

-- Access via service role only (same pattern as password_reset_codes)

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'team.manage_invites', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
