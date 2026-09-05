# Designsystem Werk

Werk ist die verbindliche visuelle Grundlage der Anwendung. Das System verbindet robuste, kontrastreiche Arbeitsoberflächen mit großen, klaren Aktionen für Büro und Baustelle.

## Gestaltungsprinzipien

- Direkt: Wichtige Aktionen sind kräftig, kontrastreich und eindeutig beschriftet.
- Robust: Kleine Radien, sichtbare Konturen und versetzte Schatten erzeugen handwerkliche Prägnanz.
- Funktional: Statusfarben tragen Bedeutung; Orange bleibt der primären Interaktion vorbehalten.
- Responsive: Desktop nutzt Navigation und Informationsdichte, Mobile priorisiert Touch-Ziele und den aktuellen Arbeitsablauf.

## Tokens

Die zentrale Quelle ist `app/globals.css`. Rohfarben sind als `--color-*` benannt; Komponenten verwenden ausschließlich semantische Tokens.

| Rolle | Token | Wert |
| --- | --- | --- |
| Primärsignal | `--brand` | `#ef684a` |
| Hervorhebung | `--accent` | `#f2c94c` |
| Text / Navigation | `--text`, `--sidebar` | `#202b33` |
| Arbeitsfläche | `--surface` | `#eeeae3` |
| Kartenfläche | `--surface-raised` | `#fffdf8` |
| Gedämpfte Fläche | `--surface-muted` | `#e1ddd6` |
| Sekundärtext | `--text-soft` | `#687176` |
| Trennlinien | `--line` | `#d5d0c8` |
| Erfolg | `--success` | `#2f8b65` |
| Warnung | `--warning` | `#c98a19` |
| Fehler | `--danger` | `#c54c3b` |
| Tastaturfokus | `--focus` | `#1672dd` |

## Typografie

- Barlow ist die Display-Schrift für Seitenüberschriften, Kennzahlen und Abschnittstitel.
- Inter ist die UI-Schrift für Navigation, Fließtext, Tabellen und Bedienelemente.
- Große Überschriften sind fett und in Versalien; Hilfstexte bleiben kompakt und ruhig.

## Form und Tiefe

- Kartenradius: `--radius` mit 4 px.
- Kleine Bedienelemente: `--radius-small` mit 3 px.
- Tiefe entsteht über harte, versetzte Schatten statt weicher Schwebeeffekte.
- Primärbuttons besitzen eine dunkle Kontur und einen sichtbaren Versatzschatten.

## Komponentenregeln

- Primäraktionen verwenden Orange, dunkle Schrift und mindestens 42 px Höhe.
- Karten nutzen die helle Papierfläche; Kennzahlenkarten erhalten eine stärkere Kontur.
- Aktive Navigation kombiniert Orange mit einer gelben Innenkante.
- Status-Badges verwenden ausschließlich die semantischen Statusfarben.
- Fokus bleibt mit einem 3 px starken blauen Ring deutlich sichtbar.
- Mobile Touch-Ziele sind mindestens 44 × 44 px groß.

## Responsive Verhalten

- Ab 1080 px wird das Dashboard dichter und die Seitenleiste breiter dargestellt.
- Unter 760 px wechseln Seitenleiste und Desktop-Kopfzeile zu Menü, kompakter Kopfzeile und fester Tab-Navigation.
- Sekundäre Desktop-Inhalte werden mobil zugunsten der Kernaufgabe ausgeblendet.
