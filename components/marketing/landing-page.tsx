import Link from 'next/link';
import {
  HardHat,
  Shield,
  Users,
  Clock3,
  FileText,
  ArrowRight,
  Building2,
  MessageSquare,
  Smartphone,
  PackageCheck,
  ClipboardList,
  Server,
  Palette,
  Rocket,
  UserPlus,
  Settings,
  Play,
  Leaf,
} from 'lucide-react';
import { getPlatformName } from '@/lib/tenant/config';
import {
  OfficeFieldTabs,
  SyncSplitSection,
  GalabauUseCases,
  SupportHighlights,
} from '@/components/marketing/office-field-tabs';

const features = [
  {
    icon: Clock3,
    title: 'Arbeitszeiterfassung',
    text: 'Start, Ende, Pausen und Fahrzeit — direkt auf der Baustelle, ohne Zettelwirtschaft.',
  },
  {
    icon: FileText,
    title: 'Tagesdokumentation',
    text: 'Fotos, Lieferungen, Gerätestunden und Bemerkungen zentral erfassen und jederzeit nachvollziehen.',
  },
  {
    icon: Building2,
    title: 'Baustellenakte',
    text: 'Ansprechpartner, Termine, Lieferanten und Dokumente pro Baustelle an einem Ort.',
  },
  {
    icon: ClipboardList,
    title: 'PDF-Rapporte',
    text: 'Tagesberichte automatisch zusammenstellen, als PDF exportieren und versenden.',
  },
  {
    icon: Users,
    title: 'Rollen & Rechte',
    text: 'Mitarbeiter, Vorarbeiter und Verwaltung — klar getrennte Zugriffe für jeden Bedarf.',
  },
  {
    icon: MessageSquare,
    title: 'Nachrichten',
    text: 'Interne Kommunikation zwischen Büro und Baustelle ohne WhatsApp-Chaos.',
  },
  {
    icon: PackageCheck,
    title: 'Bestellungen',
    text: 'Materialbedarf erfassen, Freigaben einholen und Lieferungen der Baustelle zuordnen.',
  },
  {
    icon: Settings,
    title: 'Firma anpassen',
    text: 'Logo, Farben und Firmenname in den Einstellungen — Ihr Betrieb, Ihr Look.',
  },
];

const steps = [
  {
    icon: UserPlus,
    number: '01',
    title: 'Registrieren',
    text: '7 Tage kostenlos testen — ohne Zahlungsdaten, in wenigen Minuten startklar.',
  },
  {
    icon: Palette,
    number: '02',
    title: 'Firma einrichten',
    text: 'Name, Logo und Farben in den Einstellungen anpassen.',
  },
  {
    icon: Users,
    number: '03',
    title: 'Team einladen',
    text: 'Mitarbeiter und Vorarbeiter anlegen — jeder mit passenden Rechten.',
  },
  {
    icon: Smartphone,
    number: '04',
    title: 'Loslegen',
    text: 'Zeiten erfassen, Baustellen dokumentieren — direkt auf dem Smartphone.',
  },
];

const pricingPlans = [
  {
    id: 'solo',
    name: 'Solo',
    price: '79',
    users: '1 Nutzer',
    featured: false,
    features: [
      'Arbeitszeiterfassung & Tagesdoku',
      'Baustellenakte & PDF-Rapporte',
      'Mobile Web-App',
      'DSGVO-konformes EU-Hosting',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '149',
    users: 'Bis zu 5 Nutzer',
    featured: true,
    features: [
      'Alles aus Solo',
      'Teamverwaltung & Urlaub',
      'Rollen: Vorarbeiter & Verwaltung',
      'Nachrichten Büro ↔ Baustelle',
      'Bestellungen & Lieferungen',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '299',
    users: 'Bis zu 10 Nutzer',
    featured: false,
    features: [
      'Alles aus Team',
      'Voller Funktionsumfang',
      'Ideal für wachsende Betriebe',
      'Persönliche Einführung',
    ],
  },
];

const faqItems = [
  {
    question: 'Was kostet Værkflow?',
    answer:
      'Solo kostet 79 € pro Monat (1 Nutzer), Team 149 € pro Monat (bis 5 Nutzer) und Max 299 € pro Monat (bis 10 Nutzer). Alle Preise verstehen sich netto. Værkflow fokussiert sich auf Baustellenmanagement — ohne Rechnungswesen oder Buchhaltung.',
  },
  {
    question: 'Wie funktioniert die 7-Tage-Testphase?',
    answer:
      'Sie registrieren sich kostenlos und erhalten 7 Tage vollen Zugriff auf Ihr gewähltes Paket. Keine Zahlungsdaten erforderlich. Nach Ablauf der Testphase wählen Sie ein Abo oder Ihr Zugang wird pausiert.',
  },
  {
    question: 'Brauche ich Zahlungsdaten für den Test?',
    answer:
      'Nein. Für die 7-tägige Testphase sind keine Zahlungsinformationen nötig. Erst nach der Testphase schließen Sie ein kostenpflichtiges Abo ab.',
  },
  {
    question: 'Was passiert nach der Testphase?',
    answer:
      'Sie wählen eines der drei Pakete (Solo, Team oder Max) und schließen ein Abo ab. Ihre eingerichtete Firma, Baustellen und Daten bleiben erhalten.',
  },
  {
    question: 'Gibt es eine Mindestvertragslaufzeit?',
    answer:
      'Ja, die Mindestlaufzeit beträgt 12 Monate — analog zu etablierten Handwerkersoftware-Anbietern. Details besprechen wir transparent vor Vertragsabschluss.',
  },
  {
    question: 'Welche Funktionen sind im Abo enthalten?',
    answer:
      'Zeiterfassung, Tagesdokumentation, Baustellenakten, PDF-Rapporte, Urlaubsverwaltung, Team, Nachrichten und Bestellungen — je nach Paket und Nutzeranzahl. Kein Rechnungs- oder Buchhaltungsmodul.',
  },
  {
    question: 'Wo werden unsere Daten gehostet?',
    answer:
      'Die Anwendung läuft auf europäischer Infrastruktur (Supabase/Cloudflare). Ihre Daten bleiben mandantentrennt und sind durch rollenbasierte Zugriffsrechte geschützt.',
  },
  {
    question: 'Funktioniert die App auf dem Smartphone?',
    answer:
      'Ja. Die Oberfläche ist für mobile Geräte optimiert: große Touch-Ziele für Zeiterfassung und Tagesdokumentation direkt auf der Baustelle — als Web-App im Browser.',
  },
];

function HeroMockup() {
  return (
    <div className="marketing-visual" aria-hidden="true">
      <div className="marketing-visual-orbit" />
      <div className="marketing-mockup marketing-mockup--dashboard">
        <div className="marketing-mockup-head">
          <div className="marketing-mockup-dots"><i /><i /><i /></div>
          <span className="marketing-mockup-title">Infoboard · Heute</span>
        </div>
        <div className="marketing-mockup-metrics">
          <div className="marketing-mockup-metric featured">
            <strong>46:35</strong>
            <span>Std. erfasst</span>
          </div>
          <div className="marketing-mockup-metric">
            <strong>8</strong>
            <span>Aktiv</span>
          </div>
          <div className="marketing-mockup-metric">
            <strong>3</strong>
            <span>Baustellen</span>
          </div>
        </div>
        <div className="marketing-mockup-bar"><i /></div>
        <div className="marketing-mockup-rows">
          <div className="marketing-mockup-row">
            <em />
            <b>Innenhof Alsterufer</b>
            <small>07:30</small>
          </div>
          <div className="marketing-mockup-row">
            <em />
            <b>Parkanlage West</b>
            <small>08:15</small>
          </div>
          <div className="marketing-mockup-row">
            <em />
            <b>Neubau Grünfläche</b>
            <small>09:00</small>
          </div>
        </div>
      </div>
      <div className="marketing-mockup marketing-mockup--phone">
        <div className="marketing-mockup-head">
          <span className="marketing-mockup-title">Zeiterfassung</span>
          <span className="status-badge active">Live</span>
        </div>
        <div className="marketing-mockup-timer">
          <strong>02:14:08</strong>
          <span>Arbeitszeit heute</span>
        </div>
        <div className="marketing-mockup-action">
          <Play size={12} fill="currentColor" /> Erfassung läuft
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="marketing-section-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function MarketingLanding() {
  const platform = getPlatformName();

  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <div className="marketing-brand">
          <span className="brand-symbol"><HardHat size={22} /></span>
          <strong>{platform}</strong>
        </div>
        <nav>
          <Link href="#produkt">Produkt</Link>
          <Link href="#features">Funktionen</Link>
          <Link href="#pricing">Preise</Link>
          <Link href="#galabau">GaLaBau</Link>
          <Link href="#faq">FAQ</Link>
          <Link href="/register" className="primary-button">Kostenlos testen</Link>
          <Link href="/login">Anmelden</Link>
        </nav>
      </header>

      <section className="marketing-hero-block">
        <div className="marketing-shell">
          <div className="marketing-hero-grid">
            <div className="marketing-hero-copy">
              <span className="eyebrow">Cloud-App für GaLaBau</span>
              <h1>
                <span className="marketing-headline-stack">Baustelle dokumentiert.</span>
                <span className="marketing-headline-stack">Büro informiert.</span>
                <span className="marketing-headline-stack marketing-hero-accent">Feierabend.</span>
              </h1>
              <p>
                {platform} ist die Web-App für Baustellenmanagement: Registrieren, Firma anpassen
                und sofort produktiv arbeiten — Zeiten, Tagesdoku, Baustellenakten und Rapporte
                in einer Cloud-Lösung.
              </p>
              <div className="marketing-cta">
                <Link href="/register" className="primary-button">
                  7 Tage kostenlos testen <ArrowRight size={16} />
                </Link>
                <Link href="/login" className="secondary-button">Anmelden</Link>
              </div>
              <div className="marketing-cta-notes">
                <span>Keine Zahlungsdaten nötig</span>
                <span>7 Tage voller Zugriff</span>
                <span>In Minuten startklar</span>
              </div>
              <div className="marketing-trust">
                <span className="status-badge active">DSGVO-konform gehostet</span>
                <span className="status-badge">Cloud-SaaS</span>
                <span className="status-badge">Mobil optimiert</span>
              </div>
              <div className="marketing-stats">
                <div className="marketing-stat">
                  <strong>7 Tage</strong>
                  <span>Kostenlos testen — ohne Zahlungsdaten</span>
                </div>
                <div className="marketing-stat">
                  <strong>3 Pakete</strong>
                  <span>Solo, Team und Max — ab 79 €/Monat</span>
                </div>
                <div className="marketing-stat">
                  <strong>100 %</strong>
                  <span>Fokus Baustellenmanagement — kein Rechnungswesen</span>
                </div>
              </div>
            </div>
            <HeroMockup />
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-alt">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Vorher / Nachher"
            title="Lästige Büroarbeit war gestern."
            text={`Papier, Excel und WhatsApp-Chaos kosten Zeit und Nerven. Mit ${platform} erfassen Sie alles digital — und haben es jederzeit griffbereit.`}
          />
          <div className="marketing-grid marketing-grid--2">
            <article className="panel marketing-card marketing-card--problem">
              <span className="eyebrow">Das Problem</span>
              <h3>Ohne {platform}</h3>
              <ul className="simple-list">
                <li>Stundenzettel gehen verloren oder kommen verspätet im Büro an</li>
                <li>Excel-Listen und WhatsApp-Chats ersetzen echte Baustellendokumentation</li>
                <li>Kein Überblick, wer wo arbeitet und was auf welcher Baustelle passiert ist</li>
                <li>Rapporte und Lieferscheine müssen mühsam nachgetragen werden</li>
              </ul>
            </article>
            <article className="panel marketing-card marketing-card--solution">
              <span className="eyebrow">Die Lösung</span>
              <h3>Mit {platform}</h3>
              <ul className="simple-list">
                <li>Zeiten, Fotos und Notizen werden direkt vor Ort erfasst</li>
                <li>Ein Zugang für Mitarbeiter, Vorarbeiter und Verwaltung — klar getrennt</li>
                <li>Baustellenakten, Termine und Dokumente zentral pro Projekt</li>
                <li>PDF-Rapporte auf Knopfdruck statt manueller Nacharbeit</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="produkt" className="marketing-section">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Büro & Baustelle"
            title="Nahtloses Zusammenspiel — Desktop und Smartphone."
            text="Das Büro plant und verwaltet, das Team dokumentiert vor Ort. Alles synchron in einer Cloud-App."
          />
          <OfficeFieldTabs />
        </div>
      </section>

      <section className="marketing-section marketing-section-alt">
        <div className="marketing-shell">
          <SyncSplitSection />
        </div>
      </section>

      <section id="features" className="marketing-section">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Funktionen"
            title="Einfachheit trifft Effizienz."
            text="Alles für Baustelle und Team — fokussiert auf das, was GaLaBau-Betriebe wirklich brauchen."
          />
          <div className="marketing-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="panel marketing-card">
                <div className="marketing-card-icon"><Icon size={22} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="galabau" className="marketing-section marketing-section-alt">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Branchenfokus"
            title="Gemacht für GaLaBau."
            text={`${platform} adressiert die Prozesse in Grünflächen- und Außenanlagenbetrieben — kein generisches Baukastensystem.`}
          />
          <GalabauUseCases />
        </div>
      </section>

      <section id="pricing" className="marketing-section">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Preise"
            title="Für jeden Betrieb das passende Paket."
            text="Transparente Monatspreise — 7 Tage kostenlos testen, danach Abo mit 12 Monaten Mindestlaufzeit."
          />
          <p className="marketing-pricing-toggle muted">
            Monatliche Abrechnung · Jährliche Abrechnung auf Anfrage
          </p>
          <div className="marketing-pricing-grid">
            {pricingPlans.map((plan) => (
              <article
                key={plan.id}
                className={`marketing-pricing-card panel${plan.featured ? ' featured' : ''}`}
              >
                {plan.featured && <span className="marketing-pricing-badge">Bestseller</span>}
                <span className="eyebrow">{plan.name}</span>
                <div className="marketing-price-tag">
                  {plan.price} € <small>/ Monat netto</small>
                </div>
                <p className="muted">{plan.users}</p>
                <ul className="marketing-checklist">
                  {plan.features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="marketing-cta">
                  <Link href={`/register?plan=${plan.id}`} className="primary-button">
                    7 Tage kostenlos testen <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="muted marketing-pricing-note">
            Nach der 7-tägigen Testphase wird das gewählte Paket kostenpflichtig.
            Mindestvertragslaufzeit 12 Monate. Keine versteckten Kosten für den Standard-Funktionsumfang.
          </p>
        </div>
      </section>

      <section id="ablauf" className="marketing-section marketing-section-alt">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="So starten Sie"
            title="In vier Schritten produktiv."
            text="Kein IT-Projekt — registrieren, einrichten und loslegen."
          />
          <div className="marketing-grid">
            {steps.map(({ icon: Icon, number, title, text }) => (
              <article key={title} className="panel marketing-card marketing-card--step">
                <span className="marketing-step-num">{number}</span>
                <div className="marketing-card-icon"><Icon size={22} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="marketing-section">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Kundenservice"
            title="Immer an Ihrer Seite — persönlich, nicht anonym."
            text="Hilfe beim Start, bei Einrichtung und im laufenden Betrieb."
          />
          <SupportHighlights />
        </div>
      </section>

      <section id="faq" className="marketing-section marketing-section-alt">
        <div className="marketing-shell">
          <SectionHead
            eyebrow="Häufige Fragen"
            title="Alles Wichtige zu Test, Abo und Funktionen."
            text="Transparente Antworten — bei weiteren Fragen melden wir uns gerne persönlich."
          />
          <div className="marketing-faq">
            {faqItems.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-shell">
          <div className="marketing-cta-banner">
            <span className="eyebrow">Du willst direkt loslegen?</span>
            <h2>7 Tage kostenlos — ohne Zahlungsdaten.</h2>
            <p>
              Registrieren Sie Ihren Betrieb, passen Sie Firma und Branding an und erleben Sie,
              wie {platform} Büro und Baustelle verbindet.
            </p>
            <div className="marketing-trust">
              <span className="status-badge active"><Server size={12} /> EU-Hosting</span>
              <span className="status-badge"><Shield size={12} /> DSGVO-konform</span>
              <span className="status-badge"><Rocket size={12} /> Sofort startklar</span>
            </div>
            <div className="marketing-cta">
              <Link href="/register" className="primary-button">
                Jetzt kostenlos testen <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="secondary-button">Anmelden</Link>
            </div>
            <div className="marketing-cta-notes">
              <span>7 Tage voller Zugriff</span>
              <span>Keine Zahlungsdaten nötig</span>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="marketing-footer-grid">
          <div>
            <div className="marketing-footer-brand">
              <span className="brand-symbol"><Leaf size={18} /></span>
              <strong>{platform}</strong>
            </div>
            <p>
              Cloud-SaaS für Baustellenmanagement im GaLaBau — Zeiten, Doku, Baustellen
              und Rapporte in einer App.
            </p>
          </div>
          <div>
            <strong>Produkt</strong>
            <nav>
              <Link href="#produkt">Büro & Baustelle</Link>
              <Link href="#features">Funktionen</Link>
              <Link href="#pricing">Preise</Link>
              <Link href="#galabau">GaLaBau</Link>
            </nav>
          </div>
          <div>
            <strong>Account</strong>
            <nav>
              <Link href="/register">Kostenlos testen</Link>
              <Link href="/login">Anmelden</Link>
              <Link href="#ablauf">So starten Sie</Link>
              <Link href="#faq">FAQ</Link>
            </nav>
          </div>
          <div>
            <strong>Kontakt</strong>
            <nav>
              <Link href="/register">Registrieren</Link>
              <a href="https://macario.dev" target="_blank" rel="noopener noreferrer">macario.dev</a>
            </nav>
          </div>
        </div>
        <div className="marketing-footer-bottom">
          <span>© {new Date().getFullYear()} {platform}</span>
          <span>Entwickelt von macario.dev</span>
        </div>
      </footer>
    </div>
  );
}
