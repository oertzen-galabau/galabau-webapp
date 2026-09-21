-- Startpasswort nur über Service Role / Admin-Actions lesbar (nicht für alle Mandanten-User)
REVOKE SELECT (default_start_password) ON tenants FROM authenticated;
REVOKE SELECT (default_start_password) ON tenants FROM anon;
