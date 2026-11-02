-- site_contact_person_links: Superadmin + has_tenant_permission (wie site_team_members)

DROP POLICY IF EXISTS site_contact_person_links_insert ON site_contact_person_links;
CREATE POLICY site_contact_person_links_insert ON site_contact_person_links
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR has_tenant_permission('sites.manage')
    )
  );

DROP POLICY IF EXISTS site_contact_person_links_delete ON site_contact_person_links;
CREATE POLICY site_contact_person_links_delete ON site_contact_person_links
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR has_tenant_permission('sites.manage')
    )
  );
