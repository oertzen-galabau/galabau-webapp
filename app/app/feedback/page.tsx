import { FeedbackBoard } from '@/components/feedback/feedback-board';
import { listFeedbackBoardForTenant } from '@/lib/actions/feedback';
import { requireTenantMember } from '@/lib/auth/session';

type PageProps = {
  searchParams: Promise<{ sent?: string; thanks?: string }>;
};

export default async function FeedbackBoardPage({ searchParams }: PageProps) {
  await requireTenantMember();
  const params = await searchParams;
  const highlightId =
    typeof params.sent === 'string' && /^[0-9a-f-]{36}$/i.test(params.sent.trim())
      ? params.sent.trim()
      : null;
  const thanks = params.thanks === '1' || params.thanks === 'true';

  const data = await listFeedbackBoardForTenant();

  return (
    <FeedbackBoard initialData={data} highlightId={highlightId} thanks={thanks} />
  );
}
