import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';

type Props = {
  count: number;
};

export function MessagesUnreadWidget({ count }: Props) {
  return (
    <article className="metric-card infoboard-metric-widget">
      <div className="metric-icon"><MessageCircle size={20} /></div>
      <span>Ungelesene Nachrichten</span>
      <strong>{count}</strong>
      <p>
        <Link href="/app/nachrichten" className="text-button infoboard-inline-link">
          Nachrichten öffnen <ArrowRight size={14} />
        </Link>
      </p>
    </article>
  );
}
