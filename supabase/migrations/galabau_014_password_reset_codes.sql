-- Password reset OTP codes (access via service role only)
CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_codes_email_created_at_idx
  ON public.password_reset_codes (email, created_at DESC);

CREATE INDEX password_reset_codes_active_lookup_idx
  ON public.password_reset_codes (email, used_at, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
