'use client';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: Props) {
  return (
    <section className="panel form-panel">
      <h1>Seite konnte nicht geladen werden</h1>
      <p className="muted">
        Bitte erneut versuchen. Wenn das Problem bleibt, teile dem Support die Referenz mit.
      </p>
      {error.digest ? (
        <p className="callout callout-warning" role="status">
          Referenz: <strong>{error.digest}</strong>
        </p>
      ) : null}
      <button type="button" className="primary-button" onClick={reset}>
        Erneut versuchen
      </button>
    </section>
  );
}
