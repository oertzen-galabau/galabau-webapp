import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const body = await request.json();
  const admin = createAdminClient();

  const { error } = await admin.from('tenant_requests').insert({
    company_name: body.company_name,
    contact_name: body.contact_name,
    contact_email: body.contact_email,
    contact_phone: body.contact_phone ?? null,
    message: body.message ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
