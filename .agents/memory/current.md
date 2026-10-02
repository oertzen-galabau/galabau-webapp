# Aktueller Stand

## Letzte Änderungen
- **Baustellen RLS Live-Fix** (`galabau_051_sites_rls_view_permission`): `sites.view` = alle Mandanten-Baustellen lesen; Superadmin; `has_tenant_permission()`; site_team_members ohne Rekursion. App: `canViewAllSites` nutzt `sites.view`/`sites.assign_team`. von Oertzen Vorarbeiter: `sites.manage` wieder ergänzt.
- **Bestellformular mit Katalog & Budget** (Migration `galabau_048_catalog_orders_budget.sql`, auf Supabase galabau): Warenkorb aus aktivem Katalog, Jahresbudget (Mandanten-Standard + Mitarbeiter-Override), Eigenanteil bei Überschreitung, Preis-Snapshots in `catalog_orders` / `catalog_order_items`. Permissions `orders.manage`, `orders.manage_budget`. Legacy `clothing_orders` nur noch lesend.
- UI: Tab Bestellen (Budgetkarten, Warenkorb, Meine Bestellungen), Tab Alle Bestellungen, Einstellungen Tab Bestellbudget, Team-Tab Bestellungen, Profil-Übersicht. Server Actions in `lib/actions/orders.ts`; Rechenlogik `lib/orders/budget.ts` + Tests.
- **Größen pro Betrieb**: Migration `049` — `order_catalog_size_options` (Kleidung/Schuhe), Kategorie-Feld `size_kind`; Pflege unter Katalog → Größen; Bestell-UI nutzt Mandantenlisten (Artikel optional einschränken).

## Fokus
Manueller End-to-End-Test: Bestellen mit/ohne Budget, Eigenanteil, Zurückziehen, Admin-Status, Budget pflegen. Migration 048 auf Hostinger-Prod falls separate DB.

## Nächste Schritte
- Optional: Lieferanten-PDF (VO-Layout), Benachrichtigungen bei neuen Bestellungen (nicht im Scope).
- Feldtest Katalog + Bestellungen nach Deploy.

## Offene Punkte
- SMTP/Impressum/Datenschutz auf Live unvollständig.
- Shop-Import scheitert bei rein JS-gerenderten Shops — manuelle Pflege.
