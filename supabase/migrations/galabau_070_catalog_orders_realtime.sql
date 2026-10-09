-- Realtime für Bestell-Badge in der Sidebar (neue Bestellungen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'catalog_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_orders;
  END IF;
END $$;
