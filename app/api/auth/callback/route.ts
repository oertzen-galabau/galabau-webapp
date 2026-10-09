import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/app';
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
