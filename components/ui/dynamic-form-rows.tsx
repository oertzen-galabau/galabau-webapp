'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export type DynamicFormField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: string;
  className?: string;
  defaultValue?: string;
};

type Props = {
  fields: DynamicFormField[];
  gridClassName?: string;
};

let nextRowId = 1;

function createRow() {
  return { id: nextRowId++ };
}

export function DynamicFormRows({
  fields,
  gridClassName = 'input-form-row-list-grid',
}: Props) {
  const [rows, setRows] = useState(() => [createRow()]);

  function addRowAfter(index: number) {
    setRows((current) => {
      const next = [...current];
      next.splice(index + 1, 0, createRow());
      return next;
    });
  }

  function removeRow(id: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  const canRemove = rows.length > 1;

  return (
    <div className="input-form-row-list-rows">
      {rows.map((row, index) => (
        <div key={row.id} className="input-form-row-list-row">
          <div className={gridClassName}>
            {fields.map((field) => (
              <label key={`${row.id}-${field.name}`} className={field.className}>
                {field.label}
                <input
                  type={field.type ?? 'text'}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  inputMode={field.inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
                  defaultValue={field.defaultValue}
                />
              </label>
            ))}
          </div>
          <div className="input-form-row-list-actions">
            <button
              type="button"
              className="input-form-row-action input-form-row-action--add"
              onClick={() => addRowAfter(index)}
              aria-label="Zeile darunter hinzufügen"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="input-form-row-action input-form-row-action--remove"
              onClick={() => removeRow(row.id)}
              disabled={!canRemove}
              aria-label="Zeile entfernen"
              aria-disabled={!canRemove}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
