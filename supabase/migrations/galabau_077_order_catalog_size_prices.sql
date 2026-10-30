-- Preise pro Größe im Bestellkatalog (Map Größe -> EUR)

ALTER TABLE order_catalog_items
  ADD COLUMN IF NOT EXISTS size_prices jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN order_catalog_items.size_prices IS
  'JSON object: size label -> unit price EUR. Empty values fall back to column price.';
