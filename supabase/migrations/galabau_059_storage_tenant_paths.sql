-- Storage: Mandanten-Pfadbindung (erster Ordner = tenant_id)

DROP POLICY IF EXISTS site_docs_auth ON storage.objects;

CREATE POLICY site_docs_tenant_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

CREATE POLICY site_docs_tenant_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

CREATE POLICY site_docs_tenant_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

CREATE POLICY site_docs_tenant_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS tenant_logos_auth_upload ON storage.objects;
CREATE POLICY tenant_logos_auth_upload ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-logos'::text
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS tenant_logos_auth_update ON storage.objects;
CREATE POLICY tenant_logos_auth_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-logos'::text
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'tenant-logos'::text
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );
