'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronRight, Clock3, FileImage, FileText,
  HardHat, Home, LayoutDashboard, Leaf, Menu, MoreHorizontal, Pause,
  Play, Plus, Search, Square, TimerReset, Upload, Users,
  X,
} from 'lucide-react';

type SectionId = 'overview' | 'orders' | 'time' | 'documents' | 'team';
type TimerState = 'idle' | 'running' | 'paused' | 'done';

const brand = { name: 'Musterbetrieb Nord', line: 'Handwerk & Service', icon: HardHat } as const;

const navItems: { id: SectionId; label: string; icon: typeof Home }[] = [
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard },
  { id: 'orders', label: 'Aufträge', icon: BriefcaseBusiness },
  { id: 'time', label: 'Zeiten', icon: Clock3 },
  { id: 'documents', label: 'Dokumente', icon: FileText },
  { id: 'team', label: 'Team', icon: Users },
];

const jobs = [
  { time: '07:30', title: 'Innenhof begrünen', place: 'Alsterufer 18, Hamburg', team: ['LS', 'MN', 'TK'], status: 'Vor Ort', tone: 'active' },
  { time: '10:00', title: 'Terrassenfundament', place: 'Bergstraße 42, Norderstedt', team: ['FR', 'JK'], status: 'Anfahrt', tone: 'travel' },
  { time: '13:30', title: 'Zaunanlage montieren', place: 'Mühlenweg 7, Wedel', team: ['AB', 'SA'], status: 'Geplant', tone: 'planned' },
];

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function Showcase() {
  const [section, setSection] = useState<SectionId>('overview');
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (timerState !== 'running') return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerState]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const BrandIcon = brand.icon;
  const timerLabel = timerState === 'running' ? 'Zeiterfassung läuft' : timerState === 'paused' ? 'Zeiterfassung pausiert' : timerState === 'done' ? 'Zeit gespeichert' : 'Bereit zum Start';

  function openSection(next: SectionId) {
    setSection(next);
    setMobileMenu(false);
  }

  return (
    <main className="product-app">
        <div className="app-frame">
          <aside className="app-sidebar">
            <div className="brand-lockup"><span className="brand-symbol"><BrandIcon size={24} /></span><span><strong>{brand.name}</strong><small>{brand.line}</small></span></div>
            <nav aria-label="Hauptnavigation">
              {navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => openSection(item.id)}><Icon size={19} /><span>{item.label}</span>{section === item.id && <ChevronRight className="nav-arrow" size={16} />}</button>; })}
            </nav>
            <div className="sidebar-project"><span className="project-dot" /><div><small>Aktiver Auftrag</small><strong>Innenhof Alsterufer</strong><span>64 % abgeschlossen</span></div><div className="mini-progress"><i style={{ width: '64%' }} /></div></div>
            <div className="sidebar-user"><span className="avatar">CF</span><span><strong>Claudia Fischer</strong><small>Projektleitung</small></span><MoreHorizontal size={18} /></div>
          </aside>

          <div className="app-main">
            <header className="app-header">
              <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menü öffnen" aria-expanded={mobileMenu}><Menu size={21} /></button>
              <div className="mobile-brand"><BrandIcon size={20} /><strong>{brand.name}</strong></div>
              <div className="search-box"><Search size={18} /><span>Auftrag, Kunde oder Dokument suchen</span><kbd>⌘ K</kbd></div>
              <div className="header-actions"><button aria-label="Benachrichtigungen"><Bell size={19} /><i /></button><span className="header-date"><small>Donnerstag</small><strong>03. September</strong></span><button className="avatar-button">CF</button></div>
            </header>
            {mobileMenu && <div className="mobile-drawer"><div className="mobile-drawer-head"><strong>Navigation</strong><button onClick={() => setMobileMenu(false)} aria-label="Menü schließen"><X size={20} /></button></div>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => openSection(item.id)}><Icon size={20} />{item.label}</button>; })}</div>}

            <div className="app-content">
              {section === 'overview' && <Overview onOpenOrder={() => setSection('orders')} onStart={() => setSection('time')} />}
              {section === 'orders' && <Orders onBack={() => setSection('overview')} onDocument={() => setSection('documents')} />}
              {section === 'time' && <TimeTracking state={timerState} seconds={seconds} label={timerLabel} setState={setTimerState} setSeconds={setSeconds} onToast={setToast} />}
              {section === 'documents' && <Documents onToast={setToast} />}
              {section === 'team' && <Team />}
            </div>
          </div>

          <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
            {navItems.slice(0, 4).map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => openSection(item.id)}><Icon size={20} /><span>{item.label}</span></button>; })}
          </nav>
          {toast && <div className="app-toast" role="status"><CheckCircle2 size={19} /><span>{toast}</span></div>}
        </div>
    </main>
  );
}

function Overview({ onOpenOrder, onStart }: { onOpenOrder: () => void; onStart: () => void }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">Büro · Live-Status</span><h1>Guten Morgen, Claudia.</h1><p>Dein Betrieb ist gut im Plan. Zwei Teams sind bereits auf der Baustelle.</p></div><button className="primary-button" onClick={onStart}><Play size={17} fill="currentColor" />Zeit erfassen</button></div>
    <div className="metric-grid">
      <article className="metric-card metric-feature"><div className="metric-icon"><Clock3 size={20} /></div><span>Heute erfasst</span><strong>46:35 <small>Std.</small></strong><p><i /> 8 von 11 Mitarbeitenden aktiv</p></article>
      <article className="metric-card"><div className="metric-icon"><BriefcaseBusiness size={20} /></div><span>Offene Aufträge</span><strong>12</strong><p><b>3</b> starten diese Woche</p></article>
      <article className="metric-card"><div className="metric-icon"><CheckCircle2 size={20} /></div><span>Erledigt im Monat</span><strong>28</strong><p><b>+12 %</b> gegenüber August</p></article>
      <article className="metric-card"><div className="metric-icon"><FileText size={20} /></div><span>Offene Nachweise</span><strong>4</strong><p>2 benötigen Freigabe</p></article>
    </div>
    <div className="dashboard-columns">
      <section className="panel schedule-panel"><div className="panel-head"><div><span className="eyebrow">Donnerstag, 03.09.</span><h2>Heutige Einsätze</h2></div><button className="text-button">Alle Aufträge <ArrowRight size={16} /></button></div><div className="job-list">{jobs.map((job, index) => <button className="job-row" key={job.title} onClick={index === 0 ? onOpenOrder : undefined}><time>{job.time}</time><span className={`job-marker ${job.tone}`} /><span className="job-copy"><strong>{job.title}</strong><small>{job.place}</small></span><span className="avatar-stack">{job.team.map((person) => <i key={person}>{person}</i>)}</span><span className={`status-badge ${job.tone}`}>{job.status}</span><ChevronRight size={18} /></button>)}</div></section>
      <aside className="panel progress-panel"><div className="panel-head"><div><span className="eyebrow">Laufendes Projekt</span><h2>Innenhof Alsterufer</h2></div><button aria-label="Weitere Optionen"><MoreHorizontal size={20} /></button></div><div className="project-visual"><div className="visual-shape"><Leaf size={40} /></div><span>Außenbereich</span></div><div className="progress-copy"><div><span>Projektfortschritt</span><strong>64 %</strong></div><div className="large-progress"><i /></div><p>Nächster Meilenstein: <strong>Bepflanzung</strong></p></div><button className="secondary-button" onClick={onOpenOrder}>Auftrag öffnen <ArrowRight size={16} /></button></aside>
    </div>
  </>;
}

function Orders({ onBack, onDocument }: { onBack: () => void; onDocument: () => void }) {
  return <>
    <button className="breadcrumb" onClick={onBack}><ArrowLeft size={16} />Zurück zur Übersicht</button>
    <div className="page-heading order-heading"><div><span className="status-badge active">In Ausführung</span><h1>Innenhof Alsterufer</h1><p>Auftrag #A-2026-184 · Alsterufer 18, 20354 Hamburg</p></div><button className="primary-button"><Plus size={17} />Eintrag hinzufügen</button></div>
    <div className="order-layout"><section className="panel order-main"><div className="order-meta"><div><span>Kunde</span><strong>Hausverwaltung Elbblick</strong><small>Sophie Martens · Projektkoordination</small></div><div><span>Zeitraum</span><strong>01. – 11. September</strong><small>8 Arbeitstage geplant</small></div><div><span>Verantwortlich</span><strong>Claudia Fischer</strong><small>Team Nord · 4 Personen</small></div></div><div className="task-head"><div><span className="eyebrow">Arbeitsfortschritt</span><h2>Aufgaben</h2></div><span>4 von 6 erledigt</span></div><div className="task-list">{['Bestand aufnehmen und sichern', 'Untergrund vorbereiten', 'Entwässerungsrinne setzen', 'Natursteinfläche verlegen', 'Staudenflächen bepflanzen', 'Abnahme dokumentieren'].map((task, index) => <div className={index < 4 ? 'done' : ''} key={task}><span>{index < 4 ? <Check size={15} /> : index + 1}</span><p><strong>{task}</strong><small>{index < 4 ? 'Abgeschlossen' : index === 4 ? 'Heute eingeplant' : 'Noch nicht begonnen'}</small></p>{index < 4 && <CheckCircle2 size={19} />}</div>)}</div></section><aside className="order-side"><section className="panel"><span className="eyebrow">Schnellzugriff</span><h2>Baustelle</h2><button onClick={onDocument}><FileImage size={19} /><span><strong>Dokumentation</strong><small>18 Fotos · 4 Notizen</small></span><ChevronRight size={18} /></button><button><Users size={19} /><span><strong>Team & Zeiten</strong><small>Heute 23:40 Std.</small></span><ChevronRight size={18} /></button><button><FileText size={19} /><span><strong>Dokumente</strong><small>7 Dateien</small></span><ChevronRight size={18} /></button></section><section className="panel weather-card"><span className="weather-icon">☀</span><div><span>Hamburg, 14:30</span><strong>19° C</strong><small>Trocken · leichter Wind</small></div></section></aside></div>
  </>;
}

function TimeTracking({ state, seconds, label, setState, setSeconds, onToast }: { state: TimerState; seconds: number; label: string; setState: (state: TimerState) => void; setSeconds: (value: number) => void; onToast: (message: string) => void }) {
  const activeSeconds = 2 * 3600 + 17 * 60 + 42 + seconds;
  return <div className="mobile-workflow"><div className="mobile-top"><div><span className="eyebrow">Donnerstag, 03.09.</span><h1>Dein Arbeitstag</h1></div><button aria-label="Mehr"><MoreHorizontal size={21} /></button></div><section className="mobile-job-card"><span className="status-badge active">Aktueller Auftrag</span><h2>Innenhof Alsterufer</h2><p>Alsterufer 18, Hamburg</p><div className="job-details"><span><CalendarDays size={17} />07:30 – 16:30</span><span><Users size={17} />Team Nord</span></div><button className="route-button">Auftrag ansehen <ChevronRight size={18} /></button></section><section className={`timer-card timer-${state}`}><div className="timer-status"><i />{label}</div><strong className="timer-value">{formatTime(activeSeconds)}</strong><span>Arbeitszeit heute</span><div className="timer-actions">{(state === 'idle' || state === 'done') && <button className="timer-primary" onClick={() => { setSeconds(0); setState('running'); }}><Play size={23} fill="currentColor" />Starten</button>}{state === 'running' && <><button className="timer-secondary" onClick={() => setState('paused')}><Pause size={22} fill="currentColor" />Pause</button><button className="timer-stop" onClick={() => { setState('done'); onToast('Arbeitszeit wurde gespeichert'); }}><Square size={20} fill="currentColor" />Beenden</button></>}{state === 'paused' && <><button className="timer-primary" onClick={() => setState('running')}><Play size={22} fill="currentColor" />Fortsetzen</button><button className="timer-stop" onClick={() => { setState('done'); onToast('Arbeitszeit wurde gespeichert'); }}><Square size={20} fill="currentColor" />Beenden</button></>}</div></section><section className="quick-capture"><div className="panel-head"><div><span className="eyebrow">Direkt erfassen</span><h2>Baustelle dokumentieren</h2></div></div><div><button onClick={() => onToast('Foto als Entwurf hinzugefügt')}><FileImage size={23} /><strong>Foto</strong><span>Aufnahme hinzufügen</span></button><button onClick={() => onToast('Neue Notiz geöffnet')}><FileText size={23} /><strong>Notiz</strong><span>Fortschritt festhalten</span></button></div></section><button className="reset-demo" onClick={() => { setState('idle'); setSeconds(0); }}><TimerReset size={16} />Demo zurücksetzen</button></div>;
}

function Documents({ onToast }: { onToast: (message: string) => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">Projektunterlagen</span><h1>Dokumentation</h1><p>Alle Nachweise, Fotos und Notizen zentral am Auftrag.</p></div><button className="primary-button" onClick={() => onToast('Upload als Demo vorbereitet')}><Upload size={17} />Datei hochladen</button></div><div className="document-grid">{['Vorher-Aufnahme Nordseite', 'Entwässerungsrinne Detail', 'Natursteinfläche Zwischenstand', 'Pflanzplan Innenhof'].map((name, index) => <article className="document-card" key={name}><div className={`document-preview preview-${index + 1}`}><FileImage size={28} /></div><div><span>{index === 3 ? 'PDF' : 'JPG'} · {index === 3 ? '2,4 MB' : '1,8 MB'}</span><strong>{name}</strong><small>Heute, {9 + index}:2{index} Uhr</small></div><button aria-label={`Optionen für ${name}`}><MoreHorizontal size={18} /></button></article>)}</div></>;
}

function Team() {
  const people = [['Claudia Fischer', 'Projektleitung', 'CF', 'Im Büro'], ['Milan Neumann', 'Vorarbeiter', 'MN', 'Alsterufer'], ['Tobias Krüger', 'Facharbeiter', 'TK', 'Alsterufer'], ['Fatih Rahman', 'Vorarbeiter', 'FR', 'Auf Anfahrt'], ['Jana Koch', 'Auszubildende', 'JK', 'Auf Anfahrt']];
  return <><div className="page-heading"><div><span className="eyebrow">11 Mitarbeitende</span><h1>Team & Einsatz</h1><p>Live sehen, wer heute wo arbeitet.</p></div><button className="primary-button"><Plus size={17} />Mitarbeiter anlegen</button></div><section className="panel team-list">{people.map(([name, role, initials, location], index) => <div className="team-row" key={name}><span className="person-avatar">{initials}</span><span><strong>{name}</strong><small>{role}</small></span><span className="team-location"><i className={index === 0 ? 'office' : index < 3 ? 'active' : 'travel'} />{location}</span><span className="team-hours">{index === 0 ? '03:18' : index < 3 ? '05:42' : '02:56'} Std.</span><button aria-label={`Optionen für ${name}`}><MoreHorizontal size={19} /></button></div>)}</section></>;
}
