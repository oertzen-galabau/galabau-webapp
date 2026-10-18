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

export type DailyLogDictationDraft = {
  transcript: string;
  detectedLanguage: string | null;
  weather: string | null;
  notes: string | null;
  workers: DictationWorkerDraft[];
  workItems: DictationWorkItemDraft[];
  resources: DictationResourceDraft[];
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

const STRUCTURE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    weather: { type: ['string', 'null'] },
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
  },
  required: ['weather', 'notes', 'workers', 'work_items', 'resources'],
} as const;

const STRUCTURE_PROMPT = [
  'Du strukturierst ein Baustellen-Tagesrapport-Transkript für BauDiggi (Baustellenmanagement).',
  'Die Eingabe kann in jeder Sprache sein; alle Ausgabefelder müssen auf Deutsch formuliert sein.',
  'Extrahiere Wetter, Bemerkungen, Mitarbeiter mit Stunden, Leistungen mit Menge/Einheit sowie Maschinen/Material.',
  'Einheiten nur aus: Std., m, m², m³, kg, t. Bei fehlenden Werten null setzen.',
  'Erfinde keine Daten, die nicht im Transkript vorkommen.',
].join(' ');

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchWorker(name: string, profiles: ProfileMatch[]) {
  const target = normalizeName(name);
  if (!target) return { userId: null, confidence: 'none' as const };

  let best: { profile: ProfileMatch; score: number } | null = null;

  for (const profile of profiles) {
    const full = normalizeName(`${profile.first_name} ${profile.last_name}`);
    const reversed = normalizeName(`${profile.last_name} ${profile.first_name}`);
    const first = normalizeName(profile.first_name);
    const last = normalizeName(profile.last_name);

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

async function transcribeAudio(apiKey: string, file: File): Promise<{ text: string; language: string | null }> {
  const body = new FormData();
  body.append('file', file);
  body.append('model', 'whisper-1');
  body.append('response_format', 'verbose_json');

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

async function structureTranscript(apiKey: string, transcript: string) {
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
        { role: 'system', content: STRUCTURE_PROMPT },
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
    weather: string | null;
    notes: string | null;
    workers: Array<{ name: string; job_title: string | null; hours: number }>;
    work_items: Array<{ description: string; quantity: number | null; unit: string | null }>;
    resources: Array<{ name: string; quantity: number | null; unit: string | null; hours: number | null }>;
  };
}

export function isDictationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function extractDailyLogFromAudio(
  file: File,
  profiles: ProfileMatch[],
): Promise<DailyLogDictationDraft> {
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

  const { text, language } = await transcribeAudio(apiKey, file);
  const structured = await structureTranscript(apiKey, text);

  const workers = (structured.workers ?? [])
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
    .filter((entry): entry is DictationWorkerDraft => entry !== null);

  return {
    transcript: text,
    detectedLanguage: language,
    weather: structured.weather?.trim() || null,
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
    resources: (structured.resources ?? [])
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
      .filter((entry): entry is DictationResourceDraft => entry !== null),
  };
}
