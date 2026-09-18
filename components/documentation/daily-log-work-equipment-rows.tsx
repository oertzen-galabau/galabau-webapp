'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type Row = { id: number };

let nextRowId = 1;

function createRow(): Row {
  return { id: nextRowId++ };
}

export function DailyLogWorkEquipmentRows() {
  const [rows, setRows] = useState<Row[]>(() => [createRow()]);

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
    <div className="input-form-work-equipment-rows">
      {rows.map((row, index) => (
        <div key={row.id} className="input-form-work-equipment-row">
          <div className="input-form-work-equipment-grid">
            <label>Arbeit
              <input name="work_description[]" placeholder="Geleistete Arbeit" />
            </label>
            <label className="input-form-field--narrow">Mitarbeiterstunden
              <input type="number" step="0.25" name="worker_hours[]" min={0} inputMode="decimal" />
            </label>
            <label>Gerät
              <input name="equipment_name[]" placeholder="Gerätename" />
            </label>
            <label className="input-form-field--narrow">Gerätestunden
              <input type="number" step="0.25" name="equipment_hours[]" min={0} inputMode="decimal" />
            </label>
          </div>
          <div className="input-form-work-equipment-actions">
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
