import Link from 'next/link';

type Props = {
  rejectedCount: number;
};

export function RejectedTimesWidget({ rejectedCount }: Props) {
  if (rejectedCount <= 0) {
    return <p className="muted infoboard-widget-empty">Keine abgelehnten Zeiteinträge.</p>;
  }

  return (
    <div className="callout callout-danger infoboard-alert-widget">
      <strong>
        {rejectedCount === 1
          ? '1 Zeiteintrag wurde abgelehnt'
          : `${rejectedCount} Zeiteinträge wurden abgelehnt`}
      </strong>
      <p>Bitte korrigiere deine Zeiten und reiche sie erneut ein.</p>
      <Link href="/app/zeiten#korrektur" className="text-button">
        Jetzt korrigieren
      </Link>
    </div>
  );
}
