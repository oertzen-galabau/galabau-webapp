'use client';

import { useState } from 'react';
import { AppSelect } from '@/components/ui/app-select';
import { partnerOptionLabel } from '@/lib/partners/kind';

export type BusinessPartnerFieldOption = {
  id: string;
  name: string;
  contact_person: string | null;
};

type Props = {
  partners: BusinessPartnerFieldOption[];
  partnerFieldName?: string;
  freeTextFieldName: string;
  freeTextLabel?: string;
  freeTextPlaceholder?: string;
  freeTextValue?: string;
  onFreeTextChange?: (value: string) => void;
  selectLabel?: string;
  required?: boolean;
};

export function BusinessPartnerField({
  partners,
  partnerFieldName = 'partner_id',
  freeTextFieldName,
  freeTextLabel = 'Freitext / Sonstige',
  freeTextPlaceholder = 'Firmenname',
  freeTextValue,
  onFreeTextChange,
  selectLabel = 'Aus Stammliste',
  required = false,
}: Props) {
  const [partnerId, setPartnerId] = useState('');
  const controlledFreeText = freeTextValue !== undefined;
  const [internalFreeText, setInternalFreeText] = useState('');
  const freeText = controlledFreeText ? freeTextValue : internalFreeText;

  function setFreeText(next: string) {
    if (onFreeTextChange) onFreeTextChange(next);
    else setInternalFreeText(next);
  }

  const freeTextRequired = required && !partnerId;

  return (
    <>
      <label>
        {selectLabel}
        <AppSelect
          name={partnerFieldName}
          allowEmpty
          placeholder="— Freitext —"
          value={partnerId}
          onValueChange={setPartnerId}
          options={partners.map((partner) => ({
            value: partner.id,
            label: partnerOptionLabel(partner),
          }))}
        />
      </label>
      <label>
        {freeTextLabel}
        <input
          name={freeTextFieldName}
          placeholder={freeTextPlaceholder}
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          required={freeTextRequired}
        />
      </label>
    </>
  );
}
