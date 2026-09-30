# Feierabend-Dialog — UX-Spec (Workshop-Vorbereitung)

## Ziel
Mitarbeitende sollen den Arbeitstag nach Start/Stop mit minimalen Schritten abschließen können — besonders auf dem Smartphone.

## Ist-Zustand
- Start/Stop und Pausen im Header funktionieren gut.
- Vor dem Speichern: Dialog mit Timeline (Baustellenblöcke), Fahrer-Checkbox, optional Schlechtwetter, Pflicht-Gründe bei fehlenden Pausen.
- Mobile-Probleme (Stand Implementierung): langer Scroll, Actions am unteren Rand, Uhrzeit musste serverseitig Europe/Berlin nutzen.

## Offene Designfragen ( gemeinsam klären )
1. Soll die Timeline standardmäßig **eine** Baustelle (Tageseinteilung) vorausfüllen und nur bei Wechsel erweitert werden?
2. Reicht eine **Vorschau-Karte** („7:00–16:00 · 8 Std. · Baustelle X“) statt der vollen Tabelle vor dem Speichern?
3. Wo liegt der Primary-Button: fixiert unten im Sheet oder im Header des Dialogs?
4. Welche Felder sind **Pflicht** vs. „Später unter Zeiten nachbearbeiten“?

## Empfohlene Ziel-UX (Vorschlag)
- Schritt 1: Kurzbestätigung (Datum, Start–Ende, Summe).
- Schritt 2: Optional „Baustelle anpassen“ (aufklappbar).
- Schritt 3: Feierabend speichern → klare Erfolgsmeldung.

## Technische Anker
- `components/time-tracking/header-time-clock.tsx`
- `components/time-tracking/time-entry-timeline-fields.tsx`
- `lib/actions/employee.ts` (`clockOutWork`)

## Nächster Schritt
30–45 Min. Review mit Betrieb; danach Umsetzung in separatem PR.
