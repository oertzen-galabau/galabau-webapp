import { NextResponse } from 'next/server';
import {
  handleGithubPullRequestWebhook,
  verifyGithubWebhookSignature,
} from '@/lib/feedback/github-pr-webhook';

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyGithubWebhookSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  if (event !== 'pull_request') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const result = await handleGithubPullRequestWebhook(
    payload as Parameters<typeof handleGithubPullRequestWebhook>[0],
  );

  return NextResponse.json({ ok: true, ...result });
}
