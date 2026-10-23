-- Baustellen: Icon, Titelbild, Listen-Reihenfolge
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS icon_key text NOT NULL DEFAULT 'building-2',
  ADD COLUMN IF NOT EXISTS cover_image_path text,
  ADD COLUMN IF NOT EXISTS cover_document_id uuid REFERENCES public.site_documents (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS list_sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY tenant_id ORDER BY name) - 1 AS rn
  FROM public.sites
  WHERE is_active = true
)
UPDATE public.sites AS s
SET list_sort_order = ranked.rn
FROM ranked
WHERE s.id = ranked.id;
