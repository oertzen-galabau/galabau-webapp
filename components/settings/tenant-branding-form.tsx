'use client';

import Image from 'next/image';
import { useState } from 'react';
import { removeTenantLogo, updateTenantBranding } from '@/lib/actions/employee';
import { FileInputField } from '@/components/ui/file-input-field';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  DEFAULT_SIDEBAR_COLOR,
  DEFAULT_SIDEBAR_TEXT_COLOR,
  DEFAULT_SURFACE_COLOR,
} from '@/lib/tenant/config';
import type { Tenant } from '@/lib/types/database';

type BrandingTenant = Pick<
  Tenant,
  | 'name'
  | 'logo_url'
  | 'brand_color'
  | 'accent_color'
  | 'sidebar_color'
  | 'sidebar_text_color'
  | 'surface_color'
>;

type Props = {
  tenant: BrandingTenant;
};

function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

function ColorField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  const initial = (normalizeHex(defaultValue) ?? defaultValue).toLowerCase();
  const [value, setValue] = useState(initial);
  const [hexDraft, setHexDraft] = useState(initial);

  function applyColor(next: string) {
    setValue(next);
    setHexDraft(next);
  }

  function handleHexChange(next: string) {
    setHexDraft(next);
    const normalized = normalizeHex(next);
    if (normalized) setValue(normalized);
  }

  function commitHexDraft() {
    const normalized = normalizeHex(hexDraft);
    if (normalized) {
      applyColor(normalized);
      return;
    }
    setHexDraft(value);
  }

  return (
    <div className="tenant-branding-color-field-wrap">
      <span className="tenant-branding-color-label">{label}</span>
      <div className="tenant-branding-color-field">
        <input
          type="color"
          value={value}
          onChange={(event) => applyColor(event.target.value)}
          aria-label={`${label} auswählen`}
        />
        <input type="hidden" name={name} value={value} />
        <input
          type="text"
          value={hexDraft}
          onChange={(event) => handleHexChange(event.target.value)}
          onBlur={commitHexDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitHexDraft();
            }
          }}
          className="tenant-branding-color-hex"
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label={`${label} HEX`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export function TenantBrandingForm({ tenant }: Props) {
  return (
    <section className="panel form-panel">
      <h2>Branding</h2>
      <form action={updateTenantBranding} className="input-form tenant-branding-form">
        <div className="input-form-core">
          <label className="input-form-span-full">
            Firmenname
            <input name="name" defaultValue={tenant.name} required />
          </label>

          <div className="input-form-span-full tenant-branding-logo-row">
            {tenant.logo_url ? (
              <Image
                src={tenant.logo_url}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="tenant-branding-logo-image"
              />
            ) : null}
            <div className="tenant-branding-logo-upload">
              <FileInputField
                label="Logo hochladen"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                compact
              />
              <p className="muted tenant-branding-logo-hint">PNG, JPEG, WebP oder SVG, max. 2 MB</p>
            </div>
          </div>
        </div>

        <fieldset className="tenant-branding-color-group">
          <legend>Farben</legend>
          <div className="input-form-core tenant-branding-color-grid">
            <ColorField
              label="Primärfarbe"
              name="brand_color"
              defaultValue={tenant.brand_color || DEFAULT_BRAND_COLOR}
            />
            <ColorField
              label="Akzentfarbe"
              name="accent_color"
              defaultValue={tenant.accent_color || DEFAULT_ACCENT_COLOR}
            />
            <ColorField
              label="Seitenleiste"
              name="sidebar_color"
              defaultValue={tenant.sidebar_color || DEFAULT_SIDEBAR_COLOR}
            />
            <ColorField
              label="Seitenleisten-Text"
              name="sidebar_text_color"
              defaultValue={tenant.sidebar_text_color || DEFAULT_SIDEBAR_TEXT_COLOR}
            />
            <ColorField
              label="Arbeitsfläche"
              name="surface_color"
              defaultValue={tenant.surface_color || DEFAULT_SURFACE_COLOR}
            />
          </div>
        </fieldset>

        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">Speichern</button>
        </div>
      </form>

      {tenant.logo_url ? (
        <form action={removeTenantLogo} className="tenant-branding-remove-logo">
          <button type="submit" className="text-button">Logo entfernen</button>
        </form>
      ) : null}
    </section>
  );
}
