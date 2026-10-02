-- Kleidung: nur Buchstabengrößen; Schuhe: Nummern ab 37

DELETE FROM order_catalog_size_options
WHERE kind = 'clothing' AND value ~ '^[0-9]+$';

DELETE FROM order_catalog_size_options
WHERE kind = 'shoes' AND (value !~ '^[0-9]+$' OR value = '36');

INSERT INTO order_catalog_size_options (tenant_id, kind, value, sort_order)
SELECT t.id, 'clothing', v.value, v.ord
FROM tenants t
CROSS JOIN (
  VALUES
    ('XS', 10), ('S', 20), ('M', 30), ('L', 40), ('XL', 50), ('XXL', 60),
    ('3XL', 70), ('4XL', 80), ('5XL', 90)
) AS v(value, ord)
ON CONFLICT (tenant_id, kind, value) DO NOTHING;

INSERT INTO order_catalog_size_options (tenant_id, kind, value, sort_order)
SELECT t.id, 'shoes', v.value, v.ord
FROM tenants t
CROSS JOIN (
  VALUES
    ('37', 10), ('38', 20), ('39', 30), ('40', 40), ('41', 50), ('42', 60),
    ('43', 70), ('44', 80), ('45', 90), ('46', 100), ('47', 110), ('48', 120)
) AS v(value, ord)
ON CONFLICT (tenant_id, kind, value) DO NOTHING;
