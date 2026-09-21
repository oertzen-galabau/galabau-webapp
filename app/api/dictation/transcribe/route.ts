import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { DailyLogDictationError, extractDailyLogFromAudio } from '@/lib/ai/daily-log-dictation';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  if (!canAccess(ctx, 'documentation.dictate')) {
    return NextResponse.json({ error: 'Keine Berechtigung für Diktat' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('audio');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Keine Audiodatei übermittelt' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, job_title')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_active', true);

  try {
    const draft = await extractDailyLogFromAudio(file, profiles ?? []);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DailyLogDictationError) {
      const status =
        error.code === 'missing_api_key' ? 503
        : error.code === 'too_large' || error.code === 'unsupported_file' ? 400
        : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
