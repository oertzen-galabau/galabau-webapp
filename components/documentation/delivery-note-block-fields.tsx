'use client';

import { Plus, ScanLine, Trash2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { extractDeliveryNoteData } from '@/lib/actions/delivery-notes';
import { FileInputField } from '@/components/ui/file-input-field';
import { BusinessPartnerField, type BusinessPartnerFieldOption } from '@/components/documentation/business-partner-field';

type ItemRow = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
};

type Props = {
  /** z. B. delivery_0 im Tagesbericht; „standalone“ = Feldnamen für saveDeliveryNote */
  namePrefix: string;
  suppliers: BusinessPartnerFieldOption[];
  blockTitle?: string;
};

function fieldNames(prefix: string) {
  if (prefix === 'standalone') {
    return {
      file: 'delivery_file',
      partnerId: 'partner_id',
      supplierName: 'supplier_name',
      deliveryNoteNumber: 'delivery_note_number',
      deliveryDate: 'delivery_date',
      description: 'description',
      extractionStatus: 'extraction_status',
      rawExtraction: 'raw_extraction',
      itemDescription: 'item_description[]',
      itemQuantity: 'item_quantity[]',
      itemUnit: 'item_unit[]',
    };
  }
  return {
    file: `${prefix}_file`,
    partnerId: `${prefix}_partner_id`,
    supplierName: `${prefix}_supplier_name`,
    deliveryNoteNumber: `${prefix}_delivery_note_number`,
    deliveryDate: `${prefix}_delivery_date`,
    description: `${prefix}_description`,
    extractionStatus: `${prefix}_extraction_status`,
    rawExtraction: `${prefix}_raw_extraction`,
    itemDescription: `${prefix}_item_description[]`,
    itemQuantity: `${prefix}_item_quantity[]`,
    itemUnit: `${prefix}_item_unit[]`,
  };
}

let nextRowId = 1;

function createRow(partial?: Partial<Omit<ItemRow, 'id'>>): ItemRow {
  return {
    id: nextRowId++,
    description: partial?.description ?? '',
    quantity: partial?.quantity ?? '',
    unit: partial?.unit ?? '',
  };
}

export function DeliveryNoteBlockFields({ namePrefix, suppliers, blockTitle }: Props) {
  const names = fieldNames(namePrefix);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, startExtractTransition] = useTransition();

  const [supplierName, setSupplierName] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemRow[]>(() => [createRow()]);
  const [extractionStatus, setExtractionStatus] = useState<'manual' | 'success' | 'failed'>('manual');
  const [rawExtraction, setRawExtraction] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  function addRowAfter(index: number) {
    setItems((current) => {
      const next = [...current];
      next.splice(index + 1, 0, createRow());
      return next;
    });
  }

  function removeRow(id: number) {
    setItems((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateRow(id: number, patch: Partial<Omit<ItemRow, 'id'>>) {
    setItems((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function handleExtract() {
    setScanMessage(null);
    setScanError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setScanError('Bitte zuerst ein Foto oder PDF auswählen.');
      return;
    }

    startExtractTransition(async () => {
      const formData = new FormData();
      formData.append('delivery_file', file);

      const result = await extractDeliveryNoteData(formData);
      if (!result.ok) {
        setScanError(result.error);
        setExtractionStatus('failed');
        return;
      }

      const data = result.data;
      setSupplierName(data.supplierName ?? '');
      setDeliveryNoteNumber(data.deliveryNoteNumber ?? '');
      setDeliveryDate(data.deliveryDate ?? '');
      setDescription(data.summaryDescription ?? '');
      setItems(
        data.items.length > 0
          ? data.items.map((item) =>
              createRow({
                description: item.description,
                quantity: item.quantity !== null ? String(item.quantity) : '',
                unit: item.unit ?? '',
              }),
            )
          : [createRow()],
      );
      setExtractionStatus('success');
      setRawExtraction(JSON.stringify(data));
      setScanMessage(
        data.items.length > 0
          ? `${data.items.length} Position(en) erkannt – bitte prüfen und korrigieren.`
          : 'Daten erkannt – bitte prüfen und ggf. Positionen manuell ergänzen.',
      );
    });
  }

  const canRemove = items.length > 1;

  return (
    <div className="delivery-note-block-fields">
      {blockTitle && <h4 className="delivery-note-block-fields__title">{blockTitle}</h4>}
      <div className="input-form-core">
        <div className="input-form-span-full delivery-note-upload-block">
          <FileInputField
            label="Lieferschein (Foto oder PDF)"
            name={names.file}
            accept="image/*,.pdf"
            allowCamera
            inputRef={fileInputRef}
            trailingAction={
              <button
                type="button"
                className="secondary-button secondary-button--compact input-form-file-row-action"
                onClick={handleExtract}
                disabled={isExtracting}
              >
                <ScanLine size={16} aria-hidden />
                {isExtracting ? 'Wird ausgelesen…' : 'Daten auslesen'}
              </button>
            }
          />
          {scanMessage && <p className="muted delivery-note-upload-block__message">{scanMessage}</p>}
          {scanError && <p className="form-error delivery-note-upload-block__message">{scanError}</p>}
        </div>

        <BusinessPartnerField
          partners={suppliers}
          partnerFieldName={names.partnerId}
          freeTextFieldName={names.supplierName}
          freeTextLabel="Lieferant (Freitext)"
          freeTextPlaceholder="Firma"
          selectLabel="Lieferant"
          freeTextValue={supplierName}
          onFreeTextChange={setSupplierName}
        />
        <label>
          Lieferschein-Nr.
          <input
            name={names.deliveryNoteNumber}
            placeholder="z.B. LS-2026-0042"
            value={deliveryNoteNumber}
            onChange={(event) => setDeliveryNoteNumber(event.target.value)}
          />
        </label>
        <label>
          Lieferdatum
          <input
            type="date"
            name={names.deliveryDate}
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
        </label>

        <label className="input-form-span-full">
          Material / Kurzbeschreibung
          <input
            name={names.description}
            placeholder="z.B. Splitt-Lieferung"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      <div className="input-form-section">
        <h3 className="input-form-section-title">Positionen</h3>
        <div className="input-form-work-equipment-rows">
          {items.map((row, index) => (
            <div key={row.id} className="input-form-work-equipment-row">
              <div className="input-form-work-equipment-grid">
                <label>
                  Beschreibung
                  <input
                    name={names.itemDescription}
                    placeholder="Material / Artikel"
                    value={row.description}
                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                  />
                </label>
                <label className="input-form-field--narrow">
                  Menge
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    name={names.itemQuantity}
                    placeholder="0"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                  />
                </label>
                <label className="input-form-field--narrow">
                  Einheit
                  <input
                    name={names.itemUnit}
                    placeholder="t, m³, Stk."
                    value={row.unit}
                    onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  />
                </label>
              </div>
              <div className="input-form-work-equipment-actions">
                <button
                  type="button"
                  className="input-form-row-action input-form-row-action--add"
                  onClick={() => addRowAfter(index)}
                  aria-label="Position darunter hinzufügen"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="input-form-row-action input-form-row-action--remove"
                  onClick={() => removeRow(row.id)}
                  disabled={!canRemove}
                  aria-label="Position entfernen"
                  aria-disabled={!canRemove}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name={names.extractionStatus} value={extractionStatus} />
      <input type="hidden" name={names.rawExtraction} value={rawExtraction} />
    </div>
  );
}
