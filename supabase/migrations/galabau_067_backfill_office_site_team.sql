-- Bestehende Baustellen: Verwaltung/Administrator dem Team zuweisen (Sicht nach 052/065)

INSERT INTO public.site_team_members (tenant_id, site_id, user_id)
SELECT s.tenant_id, s.id, p.id
FROM public.sites s
JOIN public.profiles p ON p.tenant_id = s.tenant_id
WHERE p.role IN ('administrator'::user_role, 'verwaltung'::user_role)
  AND p.is_active = true
ON CONFLICT (site_id, user_id) DO NOTHING;
