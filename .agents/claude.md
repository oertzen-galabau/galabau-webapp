# Projekt: Værkflow – Baustellenmanagement (SaaS)

## Sprache
Antworte auf Deutsch.

## Was das ist
Mandantenfähige Multi-Tenant SaaS-Web-App für Baustellenmanagement (GaLaBau-Betriebe): Zeiterfassung, Tagesdokumentation, Urlaub, Baustellenakte, Rapporte. Öffentliche Marketing-Landingpage unter `/`, Produkt-App unter `/app`, Design-System-Showcase unter `/showcase`, Plattform-Owner-Bereich unter `/superadmin`.

## Wichtige Befehle
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Konventionen
- Next.js App Router (`vinext`/Cloudflare Workers Runtime), React 19, Tailwind v4, Supabase (Projekt `galabau`).
- UI-Text und Kommentare Deutsch, Code (Variablen/Funktionen) Englisch.
- Zentrales Designsystem "Værkflow" in `app/globals.css` (semantische Tokens: `--brand`, `--surface`, `--text` etc., siehe `DESIGN_SYSTEM.md`). Keine Ad-hoc-Farben, immer Tokens/Klassen verwenden.
- Server Actions in `lib/actions/*.ts` (admin/employee/superadmin), keine direkten DB-Zugriffe aus Komponenten.
- Mandantenauflösung über Subdomain (`lib/tenant/resolve.ts`, `middleware.ts`).

## Memory
Lies zu Beginn jeder Session `.agents/memory/project.md` und `.agents/memory/current.md`.
Bei `update memory`: aktualisiere `current.md`, `project.md` nur bei Architektur-Änderungen.
