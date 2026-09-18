-- Custom tenant roles and permission matrix

CREATE TABLE IF NOT EXISTS tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
  tenant_role_id uuid NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_role_id, permission_key)
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tenant_role_id uuid REFERENCES tenant_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_tenant_role_id_idx ON profiles(tenant_role_id);
CREATE INDEX IF NOT EXISTS tenant_roles_tenant_id_idx ON tenant_roles(tenant_id);

ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_roles_select ON tenant_roles
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_superadmin());

CREATE POLICY tenant_roles_modify ON tenant_roles
  FOR ALL USING (
    is_superadmin()
    OR (tenant_id = current_tenant_id() AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role]))
  );

CREATE POLICY tenant_role_permissions_select ON tenant_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_roles tr
      WHERE tr.id = tenant_role_permissions.tenant_role_id
        AND (tr.tenant_id = current_tenant_id() OR is_superadmin())
    )
  );

CREATE POLICY tenant_role_permissions_modify ON tenant_role_permissions
  FOR ALL USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM tenant_roles tr
      WHERE tr.id = tenant_role_permissions.tenant_role_id
        AND tr.tenant_id = current_tenant_id()
        AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    )
  );

-- Seed system roles and permissions for existing tenants
DO $$
DECLARE
  t record;
  r record;
  role_id uuid;
  perms text[];
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    IF EXISTS (SELECT 1 FROM tenant_roles WHERE tenant_id = t.id) THEN
      CONTINUE;
    END IF;

    FOR r IN
      SELECT * FROM (VALUES
        ('verwaltung', 'Verwaltung', 0),
        ('administrator', 'Administrator', 1),
        ('vorarbeiter', 'Vorarbeiter', 2),
        ('mitarbeiter', 'Mitarbeiter', 3)
      ) AS v(slug, name, sort_order)
    LOOP
      INSERT INTO tenant_roles (tenant_id, name, slug, is_system, sort_order)
      VALUES (t.id, r.name, r.slug, true, r.sort_order)
      RETURNING id INTO role_id;

      IF r.slug = 'mitarbeiter' THEN
        perms := ARRAY[
          'nav.infoboard','nav.zeiten','nav.urlaub','nav.nachrichten','nav.bestellungen',
          'zeiten.record','urlaub.request','messages.send','orders.create'
        ];
      ELSIF r.slug = 'vorarbeiter' THEN
        perms := ARRAY[
          'nav.infoboard','nav.zeiten','nav.urlaub','nav.nachrichten','nav.bestellungen',
          'nav.baustellen','nav.dokumentation','nav.rapporte',
          'zeiten.record','urlaub.request','messages.send','orders.create',
          'infoboard.assignments','sites.view','sites.manage','documentation.manage',
          'reports.generate','reports.send'
        ];
      ELSE
        perms := ARRAY[
          'nav.infoboard','nav.zeiten','nav.urlaub','nav.nachrichten','nav.bestellungen',
          'nav.baustellen','nav.dokumentation','nav.rapporte','nav.team','nav.einstellungen','nav.rollen',
          'zeiten.record','urlaub.request','urlaub.view_all','urlaub.approve','messages.send','orders.create',
          'infoboard.assignments','infoboard.posts','sites.view','sites.manage','documentation.manage',
          'reports.generate','reports.send','team.view','team.invite','team.assign_role','team.leave_entitlement',
          'settings.branding','settings.holidays','roles.manage'
        ];
      END IF;

      INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
      SELECT role_id, unnest(perms), true;
    END LOOP;

    UPDATE profiles p
    SET tenant_role_id = tr.id
    FROM tenant_roles tr
    WHERE p.tenant_id = t.id
      AND tr.tenant_id = t.id
      AND tr.slug = p.role::text
      AND p.role <> 'superadmin';
  END LOOP;
END $$;
