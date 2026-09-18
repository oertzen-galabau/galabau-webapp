'use client';

import { useState } from 'react';
import { Monitor, Smartphone, LayoutDashboard, Clock3, FileText, Users, Camera, MapPin } from 'lucide-react';

type TabId = 'office' | 'field';

const tabs: { id: TabId; label: string; icon: typeof Monitor }[] = [
  { id: 'office', label: 'Im Büro', icon: Monitor },
  { id: 'field', label: 'Auf der Baustelle', icon: Smartphone },
];

const panelContent: Record<
  TabId,
  { title: string; text: string; bullets: string[]; placeholderLabel: string }
> = {
  office: {
    title: 'Überblick, Planung und Verwaltung — am Schreibtisch.',
    text: 'Verwaltung und Vorarbeiter sehen in Echtzeit, wer wo arbeitet, welche Baustellen aktiv sind und welche Rapporte offen sind.',
    bullets: [
      'Infoboard mit Kennzahlen und Einsätzen des Tages',
      'Baustellenakten, Termine und Dokumente zentral verwalten',
      'Urlaubsanträge freigeben und Teamübersicht pflegen',
      'PDF-Rapporte erzeugen und versenden',
    ],
    placeholderLabel: 'Desktop · Infoboard & Baustellen',
  },
  field: {
    title: 'Erfassen, dokumentieren, weiter — direkt vor Ort.',
    text: 'Mitarbeiter und Vorarbeiter nutzen die mobile Oberfläche mit großen Touch-Zielen — ohne Excel und ohne Zettel.',
    bullets: [
      'Zeiterfassung mit Start, Pause und Fahrzeit',
      'Tagesdoku mit Fotos, Lieferungen und Gerätestunden',
      'Nachrichten zwischen Büro und Baustelle',
      'Materialbedarf und Bestellungen melden',
    ],
    placeholderLabel: 'Mobile · Zeiten & Tagesdoku',
  },
};

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <div className="marketing-screenshot-placeholder" aria-hidden="true">
      <div className="marketing-screenshot-placeholder__chrome">
        <span /><span /><span />
      </div>
      <div className="marketing-screenshot-placeholder__body">
        <div className="marketing-screenshot-placeholder__icon">
          {label.includes('Mobile') ? <Smartphone size={32} /> : <LayoutDashboard size={32} />}
        </div>
        <span className="marketing-screenshot-placeholder__label">{label}</span>
        <span className="marketing-screenshot-placeholder__hint">Screenshot folgt</span>
      </div>
    </div>
  );
}

export function OfficeFieldTabs() {
  const [active, setActive] = useState<TabId>('office');
  const panel = panelContent[active];

  return (
    <div className="marketing-tabs-panel">
      <div className="marketing-tabs" role="tablist" aria-label="Büro und Baustelle">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={active === id ? 'active' : undefined}
            onClick={() => setActive(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="marketing-tabs-content" role="tabpanel">
        <div className="marketing-split">
          <div className="marketing-split-copy">
            <h3>{panel.title}</h3>
            <p>{panel.text}</p>
            <ul className="marketing-checklist">
              {panel.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <ScreenshotPlaceholder label={panel.placeholderLabel} />
        </div>
      </div>
    </div>
  );
}

export function SyncSplitSection() {
  return (
    <div className="marketing-split marketing-split--reverse">
      <ScreenshotPlaceholder label="Sync · Büro ↔ Baustelle" />
      <div className="marketing-split-copy">
        <span className="eyebrow">Echtzeit-Sync</span>
        <h3>Büro und Baustelle — immer auf dem gleichen Stand.</h3>
        <p>
          Was vor Ort erfasst wird, landet sofort in der Verwaltung. Termine, Zeiten und
          Dokumentation laufen in einer gemeinsamen Oberfläche — mandantentrennt und
          rollenbasiert geschützt.
        </p>
        <ul className="marketing-checklist">
          <li>Zeiten und Tagesberichte ohne manuelles Nachpflegen</li>
          <li>Klare Rollen: Mitarbeiter, Vorarbeiter, Verwaltung</li>
          <li>DSGVO-konform auf europäischer Infrastruktur gehostet</li>
        </ul>
      </div>
    </div>
  );
}

export function GalabauUseCases() {
  const cases = [
    {
      icon: MapPin,
      title: 'Baustellen & Projekte',
      text: 'Außenanlagen, Neuanlagen und Baustellen — mit Subunternehmern, Lieferungen und Tagesrapporten an einem Ort.',
    },
    {
      icon: FileText,
      title: 'Pflege & Gestaltung',
      text: 'Projektakten, Termine und Fotodokumentation für Pflege-, Pflanz- und Gestaltungsarbeiten.',
    },
    {
      icon: Users,
      title: 'Team vor Ort',
      text: 'Vorarbeiter koordinieren Einsätze, Mitarbeiter erfassen Zeiten — das Büro behält den Überblick.',
    },
    {
      icon: Camera,
      title: 'Dokumentation',
      text: 'Fotos, Notizen und Gerätestunden pro Baustelle — nachvollziehbar für Kunden und interne Abrechnung.',
    },
  ];

  return (
    <div className="marketing-grid">
      {cases.map(({ icon: Icon, title, text }) => (
        <article key={title} className="panel marketing-card">
          <div className="marketing-card-icon"><Icon size={22} /></div>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

export function SupportHighlights() {
  const items = [
    { icon: Users, title: 'Hilfe beim Start', text: 'Unterstützung bei Einrichtung, Rollen und erstem Team — direkt und persönlich.' },
    { icon: Clock3, title: 'In Minuten startklar', text: 'Registrieren, Firma anpassen und sofort mit Zeiten und Doku loslegen.' },
    { icon: FileText, title: 'Firma einrichten', text: 'Logo, Farben und Firmenname in den Einstellungen — ohne technischen Aufwand.' },
  ];

  return (
    <div className="marketing-grid marketing-grid--3">
      {items.map(({ icon: Icon, title, text }) => (
        <article key={title} className="panel marketing-card marketing-card--solution">
          <div className="marketing-card-icon"><Icon size={22} /></div>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}
