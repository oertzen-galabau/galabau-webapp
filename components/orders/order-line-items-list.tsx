import type { CatalogOrderItem } from '@/lib/types/database';
import { formatOrderEuro } from '@/lib/orders/labels';

type Props = {
  items: CatalogOrderItem[];
  showLineTotals?: boolean;
};

export function OrderLineItemsList({ items, showLineTotals = false }: Props) {
  const lines = [...items].sort((a, b) => a.sort_order - b.sort_order);
  if (lines.length === 0) return <p className="muted">Keine Positionen.</p>;
  return (
    <ul className="simple-list order-line-items-list">
      {lines.map((line) => (
        <li key={line.id}>
          {line.category_name}: {line.clothing_style}
          {line.article_number ? ` (${line.article_number})` : ''}
          {' · '}
          Gr. {line.size}, {line.quantity}×
          {showLineTotals && line.unit_price_eur != null
            ? ` · ${formatOrderEuro(line.line_total_eur)}`
            : ''}
          {line.name_print ? ` · Namensdruck: ${line.name_print}` : ''}
        </li>
      ))}
    </ul>
  );
}
