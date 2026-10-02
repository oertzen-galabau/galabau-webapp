'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addOrderCatalogSizeOption, deleteOrderCatalogSizeOption } from '@/lib/actions/order-catalog';
import type { OrderCatalogSizeKind, OrderCatalogSizeOption } from '@/lib/types/database';

type Props = {
  clothing: OrderCatalogSizeOption[];
  shoes: OrderCatalogSizeOption[];
};

function SizeSection({
  title,
  kind,
  options,
}: {
  title: string;
  kind: OrderCatalogSizeKind;
  options: OrderCatalogSizeOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState('');

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>{title}</h2>
      <p className="muted">
        Diese Größen gelten für alle Kategorien mit Größenart „{kind === 'clothing' ? 'Kleidung' : 'Schuhe'}“.
      </p>

      {options.length > 0 ? (
        <ul className="site-entity-list">
          {options.map((opt) => (
            <li key={opt.id} className="site-entity-row">
              <span>{opt.value}</span>
              <form
                action={(formData) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deleteOrderCatalogSizeOption(formData);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Fehler');
                    }
                  });
                }}
              >
                <input type="hidden" name="id" value={opt.id} />
                <button type="submit" className="text-button" disabled={pending}>
                  Entfernen
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch keine Größen hinterlegt.</p>
      )}

      <form
        className="input-form"
        style={{ marginTop: 16 }}
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            try {
              await addOrderCatalogSizeOption(formData);
              setValue('');
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Fehler');
            }
          });
        }}
      >
        <input type="hidden" name="kind" value={kind} />
        <div className="input-form-core">
          <label>
            Größe hinzufügen
            <input
              name="value"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === 'shoes' ? 'z. B. 42' : 'z. B. XL'}
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            Hinzufügen
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

export function OrderCatalogSizeManager({ clothing, shoes }: Props) {
  return (
    <>
      <SizeSection title="Größen Kleidung" kind="clothing" options={clothing} />
      <SizeSection title="Größen Schuhe" kind="shoes" options={shoes} />
    </>
  );
}
