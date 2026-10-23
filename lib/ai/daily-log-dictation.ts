import {
  isHourlyWageRapport,
  parseDailyLogReportType,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';

export type DictationWorkerDraft = {
  name: string;
  jobTitle: string | null;
  hours: number;
  matchedUserId: string | null;
  matchConfidence: 'high' | 'low' | 'none';
};

export type DictationWorkItemDraft = {
  description: string;
  quantity: number | null;
  unit: string | null;
};

export type DictationResourceDraft = {
  name: string;
  quantity: number | null;
  unit: string | null;
  hours: number | null;
};

export type DictationSubcontractorWorkerDraft = {
  workerName: string;
  hours: number;
};

export type DictationSubcontractorDraft = {
  companyName: string;
  workDescription: string | null;
  matchedPartnerId: string | null;
  matchConfidence: 'high' | 'low' | 'none';
  workers: DictationSubcontractorWorkerDraft[];
};

export type DailyLogDictationDraft = {
  reportType: DailyLogReportType;
  transcript: string;
  detectedLanguage: string | null;
  notes: string | null;
  workers: DictationWorkerDraft[];
  workItems: DictationWorkItemDraft[];
  resources: DictationResourceDraft[];
  subcontractors: DictationSubcontractorDraft[];
};

export class DailyLogDictationError extends Error {
  constructor(
    message: string,
    public readonly code: 'missing_api_key' | 'unsupported_file' | 'api_error' | 'parse_error' | 'too_large',
  ) {
    super(message);
    this.name = 'DailyLogDictationError';
  }
}

type ProfileMatch = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
};

export type SubcontractorPartnerMatch = {
  id: string;
  name: string;
};

export type DictationPromptHints = {
  employeeNames: string[];
  subcontractorNames: string[];
};

const STRUCTURE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    notes: { type: ['string', 'null'] },
    workers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          job_title: { type: ['string', 'null'] },
          hours: { type: 'number' },
        },
        required: ['name', 'job_title', 'hours'],
      },
    },
    work_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
        },
        required: ['description', 'quantity', 'unit'],
      },
    },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          hours: { type: ['number', 'null'] },
        },
        required: ['name', 'quantity', 'unit', 'hours'],
      },
    },
    subcontractors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          company_name: { type: 'string' },
          work_description: { type: ['string', 'null'] },
          workers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                worker_name: { type: 'string' },
                hours: { type: 'number' },
              },
              required: ['worker_name', 'hours'],
            },
          },
        },
        required: ['company_name', 'work_description', 'workers'],
      },
    },
  },
  required: ['notes', 'workers', 'work_items', 'resources', 'subcontractors'],
} as const;

export function normalizeDictationName(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildWhisperVocabularyHint(hints: DictationPromptHints): string {
  const parts = [
    'GaLaBau, Baustelle, Pflaster, Randsteine, Schotter, Mutterboden, Radlader, Rüttelplatte, Bagger, Minibagger.',
  ];
  const names = [...hints.employeeNames, ...hints.subcontractorNames].filter(Boolean).slice(0, 48);
  if (names.length > 0) {
    parts.push(`Namen: ${names.join(', ')}.`);
  }
  return parts.join(' ').slice(0, 900);
}

export function buildStructureSystemPrompt(reportType: DailyLogReportType, hints: DictationPromptHints): string {
  const base = [
    'Du strukturierst ein Transkript für einen Baustellenbericht (Garten- und Landschaftsbau / GaLaBau).',
    'Die Eingabe kann in jeder Sprache sein; alle Ausgabetexte müssen auf Deutsch formuliert sein.',
    'Fachbegriffe korrekt erkennen: Pflaster, Randsteine, Schotter, Mutterboden, Radlader, Rüttelplatte, Bagger.',
    'Personennamen und Firmennamen nicht übersetzen, nur sauber schreiben.',
    'Erfinde keine Daten, die nicht im Transkript vorkommen. Fehlende Werte: null. Leere Arrays statt Platzhalter.',
    'Wetter und Wetterbeschreibungen ignorieren — Wetter wird automatisch gesetzt.',
    'Einheiten nur aus: Std., m, m², m³, kg, t. Gängige Wörter umrechnen (Quadratmeter→m², Kubikmeter→m³, Tonnen→t, Stunden→Std.).',
    'Stunden als Dezimalzahl (z. B. achteinhalb → 8.5).',
    'Leistungen (work_items): ausgeführte Tätigkeit mit Menge und Einheit.',
    'Fremdfirmen/Subunternehmer niemals als eigene Mitarbeiter (workers) listen.',
    'Stundenangaben nicht in notes duplizieren, wenn sie bereits in workers/resources/subcontractors stehen.',
  ];

  if (hints.employeeNames.length > 0) {
    base.push(`Bekannte Mitarbeiter (Schreibweise): ${hints.employeeNames.join(', ')}.`);
  }
  if (hints.subcontractorNames.length > 0) {
    base.push(`Bekannte Subunternehmer-Firmen: ${hints.subcontractorNames.join(', ')}.`);
  }

  if (isHourlyWageRapport(reportType)) {
    base.push(
      'Berichtsart: Std.-Lohn-Rapport.',
      'workers: nur Personen der eigenen Firma mit Name und Stunden.',
      'resources: Maschinen oder Material mit Name, optional Menge/Einheit oder Betriebsstunden (hours).',
      'subcontractors: Fremdfirmen mit company_name, work_description (Tätigkeit der Firma) und workers (Name + Stunden der Subunternehmer-Mitarbeiter).',
      'notes: übrige Hinweise (Probleme, Besonderheiten, Absprachen).',
    );
  } else {
    base.push(
      'Berichtsart: Tagesbericht.',
      'workers, resources und subcontractors müssen leere Arrays [] bleiben.',
      'Nur work_items und notes füllen.',
      'Erwähnte Stunden, Maschinen oder Subunternehmer sinngemäß in notes zusammenfassen, nicht in anderen Feldern.',
    );
  }

  return base.join(' ');
}

export function dictationPromptHintsFromLists(
  profiles: ProfileMatch[],
  partners: SubcontractorPartnerMatch[],
): DictationPromptHints {
  return {
    employeeNames: profiles.map((p) => `${p.first_name} ${p.last_name}`.trim()).filter(Boolean),
    subcontractorNames: partners.map((p) => p.name.trim()).filter(Boolean),
  };
}

function matchWorker(name: string, profiles: ProfileMatch[]) {
  const target = normalizeDictationName(name);
  if (!target) return { userId: null, confidence: 'none' as const };

  let best: { profile: ProfileMatch; score: number } | null = null;

  for (const profile of profiles) {
    const full = normalizeDictationName(`${profile.first_name} ${profile.last_name}`);
    const reversed = normalizeDictationName(`${profile.last_name} ${profile.first_name}`);
    const first = normalizeDictationName(profile.first_name);
    const last = normalizeDictationName(profile.last_name);

    let score = 0;
    if (target === full || target === reversed) score = 100;
    else if (target.includes(full) || full.includes(target)) score = 85;
    else if (target.includes(last) && target.includes(first)) score = 75;
    else if (target.includes(last) && last.length > 2) score = 55;
    else if (target.includes(first) && first.length > 2) score = 45;

    if (!best || score > best.score) best = { profile, score };
  }

  if (!best || best.score < 45) return { userId: null, confidence: 'none' as const };
  if (best.score >= 75) return { userId: best.profile.id, confidence: 'high' as const };
  return { userId: best.profile.id, confidence: 'low' as const };
}

export function matchSubcontractorPartner(companyName: string, partners: SubcontractorPartnerMatch[]) {
  const target = normalizeDictationName(companyName);
  if (!target) return { partnerId: null, confidence: 'none' as const };

  let best: { partner: SubcontractorPartnerMatch; score: number } | null = null;

  for (const partner of partners) {
    const normalized = normalizeDictationName(partner.name);
    if (!normalized) continue;

    let score = 0;
    if (target === normalized) score = 100;
    else if (target.includes(normalized) || normalized.includes(target)) score = 80;
    else {
      const targetTokens = target.split(' ').filter((t) => t.length > 2);
      const partnerTokens = normalized.split(' ').filter((t) => t.length > 2);
      const overlap = targetTokens.filter((t) => partnerTokens.some((p) => p.includes(t) || t.includes(p))).length;
      if (overlap >= 2) score = 70;
      else if (overlap === 1) score = 50;
    }

    if (!best || score > best.score) best = { partner, score };
  }

  if (!best || best.score < 50) return { partnerId: null, confidence: 'none' as const };
  if (best.score >= 75) return { partnerId: best.partner.id, confidence: 'high' as const };
  return { partnerId: best.partner.id, confidence: 'low' as const };
}

async function transcribeAudio(
  apiKey: string,
  file: File,
  whisperHint: string,
): Promise<{ text: string; language: string | null }> {
  const body = new FormData();
  body.append('file', file);
  body.append('model', 'whisper-1');
  body.append('response_format', 'verbose_json');
  if (whisperHint.trim()) body.append('prompt', whisperHint.trim());

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new DailyLogDictationError(
      `Whisper-Transkription fehlgeschlagen (${response.status})${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      'api_error',
    );
  }

  const payload = (await response.json()) as { text?: string; language?: string };
  if (!payload.text?.trim()) {
    throw new DailyLogDictationError('Keine Sprache erkannt.', 'parse_error');
  }

  return { text: payload.text.trim(), language: payload.language ?? null };
}

async function structureTranscript(
  apiKey: string,
  transcript: string,
  reportType: DailyLogReportType,
  hints: DictationPromptHints,
) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'daily_log_dictation',
          strict: true,
          schema: STRUCTURE_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: buildStructureSystemPrompt(reportType, hints) },
        { role: 'user', content: transcript },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new DailyLogDictationError(
      `Strukturierung fehlgeschlagen (${response.status})${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      'api_error',
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new DailyLogDictationError('Keine strukturierten Daten erhalten.', 'parse_error');

  return JSON.parse(content) as {
    notes: string | null;
    workers: Array<{ name: string; job_title: string | null; hours: number }>;
    work_items: Array<{ description: string; quantity: number | null; unit: string | null }>;
    resources: Array<{ name: string; quantity: number | null; unit: string | null; hours: number | null }>;
    subcontractors: Array<{
      company_name: string;
      work_description: string | null;
      workers: Array<{ worker_name: string; hours: number }>;
    }>;
  };
}

export function isDictationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function extractDailyLogFromAudio(
  file: File,
  profiles: ProfileMatch[],
  subcontractors: SubcontractorPartnerMatch[],
  reportTypeRaw: string | null | undefined,
): Promise<DailyLogDictationDraft> {
  const reportType = parseDailyLogReportType(reportTypeRaw);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new DailyLogDictationError(
      'Diktierfunktion ist nicht konfiguriert (OPENAI_API_KEY fehlt).',
      'missing_api_key',
    );
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new DailyLogDictationError('Audiodatei ist zu groß (max. 25 MB).', 'too_large');
  }

  const allowedPrefixes = ['audio/', 'video/webm', 'application/octet-stream'];
  if (file.type && !allowedPrefixes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
    throw new DailyLogDictationError('Nur Audiodateien werden unterstützt.', 'unsupported_file');
  }

  const hints = dictationPromptHintsFromLists(profiles, subcontractors);
  const whisperHint = buildWhisperVocabularyHint(hints);

  const { text, language } = await transcribeAudio(apiKey, file, whisperHint);
  const structured = await structureTranscript(apiKey, text, reportType, hints);

  const hourly = isHourlyWageRapport(reportType);

  const workers = hourly
    ? (structured.workers ?? [])
        .map((worker) => {
          const name = worker.name?.trim();
          if (!name) return null;
          const match = matchWorker(name, profiles);
          const profile = match.userId ? profiles.find((p) => p.id === match.userId) : null;
          return {
            name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : name,
            jobTitle: worker.job_title?.trim() || profile?.job_title || null,
            hours: Number.isFinite(worker.hours) ? worker.hours : 0,
            matchedUserId: match.userId,
            matchConfidence: match.confidence,
          };
        })
        .filter((entry): entry is DictationWorkerDraft => entry !== null)
    : [];

  const resources = hourly
    ? (structured.resources ?? [])
        .map((item) => {
          const name = item.name?.trim();
          if (!name) return null;
          return {
            name,
            quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null,
            unit: item.unit?.trim() || null,
            hours: typeof item.hours === 'number' && Number.isFinite(item.hours) ? item.hours : null,
          };
        })
        .filter((entry): entry is DictationResourceDraft => entry !== null)
    : [];

  const subcontractorsDraft = hourly
    ? (structured.subcontractors ?? [])
        .map((group) => {
          const companyName = group.company_name?.trim();
          if (!companyName) return null;
          const match = matchSubcontractorPartner(companyName, subcontractors);
          const partner = match.partnerId ? subcontractors.find((p) => p.id === match.partnerId) : null;
          const resolvedName = partner?.name.trim() || companyName;
          const workersList = (group.workers ?? [])
            .map((w) => {
              const workerName = w.worker_name?.trim();
              if (!workerName) return null;
              return {
                workerName,
                hours: Number.isFinite(w.hours) ? w.hours : 0,
              };
            })
            .filter((entry): entry is DictationSubcontractorWorkerDraft => entry !== null);

          return {
            companyName: resolvedName,
            workDescription: group.work_description?.trim() || null,
            matchedPartnerId: match.partnerId,
            matchConfidence: match.confidence,
            workers: workersList.length > 0 ? workersList : [{ workerName: '', hours: 0 }],
          };
        })
        .filter((entry): entry is DictationSubcontractorDraft => entry !== null)
    : [];

  return {
    reportType,
    transcript: text,
    detectedLanguage: language,
    notes: structured.notes?.trim() || null,
    workers,
    workItems: (structured.work_items ?? [])
      .map((item) => {
        const description = item.description?.trim();
        if (!description) return null;
        return {
          description,
          quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null,
          unit: item.unit?.trim() || null,
        };
      })
      .filter((entry): entry is DictationWorkItemDraft => entry !== null),
    resources,
    subcontractors: subcontractorsDraft,
  };
}
