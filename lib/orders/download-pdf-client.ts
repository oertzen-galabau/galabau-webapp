export function orderPdfUrl(orderIds: string[], disposition: 'attachment' | 'inline' = 'attachment'): string {
  const params = new URLSearchParams();
  for (const id of orderIds) params.append('order_id', id);
  params.set('disposition', disposition);
  return `/api/orders/pdf?${params.toString()}`;
}

export async function downloadOrderPdf(orderIds: string[]): Promise<string | null> {
  const res = await fetch(orderPdfUrl(orderIds));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return (data as { error?: string }).error ?? 'PDF konnte nicht erstellt werden';
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'bestellformular.pdf';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return null;
}
