-- Zentrale Ansprechpartner (Stammdaten) und Zuordnung zu Baustellen

CREATE TABLE IF NOT EXISTS tenant_contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_title text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_contact_persons_tenant_idx
  ON tenant_contact_persons (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS site_contact_person_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  contact_person_id uuid NOT NULL REFERENCES tenant_contact_persons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, contact_person_id)
);

CREATE INDEX IF NOT EXISTS site_contact_person_links_site_idx
  ON site_contact_person_links (site_id);

CREATE INDEX IF NOT EXISTS site_contact_person_links_person_idx
  ON site_contact_person_links (contact_person_id);

-- Übernahme aus site_contacts (dedupliziert: Name + Telefon + E-Mail pro Mandant)
WITH ranked AS (
  SELECT
    sc.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        sc.tenant_id,
        lower(trim(sc.name)),
        coalesce(lower(trim(sc.phone)), ''),
        coalesce(lower(trim(sc.email)), '')
      ORDER BY sc.id
    ) AS rn
  FROM site_contacts sc
),
unique_rows AS (
  SELECT tenant_id, name, role, phone, email
  FROM ranked
  WHERE rn = 1
)
INSERT INTO tenant_contact_persons (tenant_id, name, role_title, phone, email, is_active)
SELECT
  tenant_id,
  trim(name),
  nullif(trim(role), ''),
  nullif(trim(phone), ''),
  nullif(trim(email), ''),
  true
FROM unique_rows
WHERE trim(name) <> '';

INSERT INTO site_contact_person_links (tenant_id, site_id, contact_person_id)
SELECT
  sc.tenant_id,
  sc.site_id,
  tcp.id
FROM site_contacts sc
JOIN tenant_contact_persons tcp
  ON tcp.tenant_id = sc.tenant_id
  AND lower(trim(tcp.name)) = lower(trim(sc.name))
  AND coalesce(lower(trim(tcp.phone)), '') = coalesce(lower(trim(sc.phone)), '')
  AND coalesce(lower(trim(tcp.email)), '') = coalesce(lower(trim(sc.email)), '')
WHERE trim(sc.name) <> ''
ON CONFLICT (site_id, contact_person_id) DO NOTHING;

-- RLS: Stammdaten Ansprechpartner
ALTER TABLE tenant_contact_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_contact_persons_select ON tenant_contact_persons
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY tenant_contact_persons_insert ON tenant_contact_persons
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_contact_persons_update ON tenant_contact_persons
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_contact_persons_delete ON tenant_contact_persons
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

-- RLS: Baustellen-Zuordnung
ALTER TABLE site_contact_person_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_contact_person_links_select ON site_contact_person_links
  FOR SELECT
  USING (tenant_id = current_tenant_id() AND auth.uid() IS NOT NULL);

CREATE POLICY site_contact_person_links_insert ON site_contact_person_links
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY site_contact_person_links_delete ON site_contact_person_links
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.manage'
          AND trp.granted = true
      )
    )
  );
