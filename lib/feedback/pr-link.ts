/** Erste GitHub-PR-URL in internen Notizen (Agent oder Webhook hängt „PR: …“ an). */
const GITHUB_PR_URL =
  /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+/;

export function extractGithubPullRequestUrl(internalNote: string | null | undefined): string | null {
  if (!internalNote?.trim()) return null;
  const match = internalNote.match(GITHUB_PR_URL);
  return match?.[0] ?? null;
}
