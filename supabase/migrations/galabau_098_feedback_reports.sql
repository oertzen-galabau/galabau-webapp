-- Feedback- und Bug-Meldungen (Mandanten-App → Superadmin-Taskliste)

CREATE TABLE IF NOT EXISTS feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bug', 'feedback')),
  title text NOT NULL,
  description text NOT NULL,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_reports_status_created_idx
  ON feedback_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_reports_tenant_idx
  ON feedback_reports (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_report_attachments_report_idx
  ON feedback_report_attachments (report_id);

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_report_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_reports_insert ON feedback_reports;
CREATE POLICY feedback_reports_insert ON feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = current_tenant_id()
  );

DROP POLICY IF EXISTS feedback_reports_select ON feedback_reports;
CREATE POLICY feedback_reports_select ON feedback_reports
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND tenant_id = current_tenant_id())
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS feedback_reports_update ON feedback_reports;
CREATE POLICY feedback_reports_update ON feedback_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS feedback_reports_delete ON feedback_reports;
CREATE POLICY feedback_reports_delete ON feedback_reports
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

DROP POLICY IF EXISTS feedback_attachments_insert ON feedback_report_attachments;
CREATE POLICY feedback_attachments_insert ON feedback_report_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM feedback_reports r
      WHERE r.id = report_id
        AND r.user_id = auth.uid()
        AND r.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS feedback_attachments_select ON feedback_report_attachments;
CREATE POLICY feedback_attachments_select ON feedback_report_attachments
  FOR SELECT
  TO authenticated
  USING (
    (
      tenant_id = current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM feedback_reports r
        WHERE r.id = report_id AND r.user_id = auth.uid()
      )
    )
    OR public.is_superadmin()
  );

DROP POLICY IF EXISTS feedback_attachments_delete ON feedback_report_attachments;
CREATE POLICY feedback_attachments_delete ON feedback_report_attachments
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

-- Storage-Bucket feedback-screenshots (privat, Mandanten-Pfad)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS site_docs_tenant_select ON storage.objects;
CREATE POLICY site_docs_tenant_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY[
      'site-documents'::text,
      'daily-photos'::text,
      'reports'::text,
      'equipment-photos'::text,
      'feedback-screenshots'::text
    ])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_insert ON storage.objects;
CREATE POLICY site_docs_tenant_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY[
      'site-documents'::text,
      'daily-photos'::text,
      'reports'::text,
      'equipment-photos'::text,
      'feedback-screenshots'::text
    ])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_update ON storage.objects;
CREATE POLICY site_docs_tenant_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY[
      'site-documents'::text,
      'daily-photos'::text,
      'reports'::text,
      'equipment-photos'::text,
      'feedback-screenshots'::text
    ])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY[
      'site-documents'::text,
      'daily-photos'::text,
      'reports'::text,
      'equipment-photos'::text,
      'feedback-screenshots'::text
    ])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_delete ON storage.objects;
CREATE POLICY site_docs_tenant_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY[
      'site-documents'::text,
      'daily-photos'::text,
      'reports'::text,
      'equipment-photos'::text,
      'feedback-screenshots'::text
    ])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );
