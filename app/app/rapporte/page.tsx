import { redirect } from 'next/navigation';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RapporteLegacyRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) {
        if (v) qs.append(key, v);
      }
    }
  }
  const query = qs.toString();
  redirect(query ? `/app/dokumente?${query}` : '/app/dokumente');
}
