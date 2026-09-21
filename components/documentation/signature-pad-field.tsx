'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatSignatureAuditLine,
  requestSignaturePosition,
  resolveSignatureLocationLabel,
} from '@/lib/documentation/signature-location';

export type SignatureMetadata = {
  signedAt: string | null;
  signedLatitude: number | null;
  signedLongitude: number | null;
  signedLocationLabel: string | null;
};

type Props = {
  role: 'contractor' | 'client';
  label: string;
  defaultSignerName?: string;
  existingUrl?: string | null;
  existingMetadata?: SignatureMetadata;
  onChange?: (payload: { dataUrl: string | null; remove: boolean }) => void;
};

type GeoStatus = 'idle' | 'pending' | 'ok' | 'error';

function syncCanvasSize(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return ctx;

  const targetWidth = Math.floor(width * ratio);
  const targetHeight = Math.floor(height * ratio);
  if (canvas.width === targetWidth && canvas.height === targetHeight) {
    return ctx;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1f26';
  return ctx;
}

function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.clientWidth / rect.width;
  const scaleY = canvas.clientHeight / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function SignaturePadField({
  role,
  label,
  defaultSignerName = '',
  existingUrl,
  existingMetadata,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const geoStartedRef = useRef(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [hasStroke, setHasStroke] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(existingMetadata?.signedAt ?? null);
  const [latitude, setLatitude] = useState<number | null>(existingMetadata?.signedLatitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(existingMetadata?.signedLongitude ?? null);
  const [locationLabel, setLocationLabel] = useState<string | null>(existingMetadata?.signedLocationLabel ?? null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(
    existingMetadata?.signedLatitude != null && existingMetadata?.signedLongitude != null ? 'ok' : 'idle',
  );
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    syncCanvasSize(canvas);
    const observer = new ResizeObserver(() => {
      syncCanvasSize(canvas);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function syncMetadataInputs(next: SignatureMetadata) {
    const signedAtInput = document.getElementById(`${role}_signature_signed_at`) as HTMLInputElement | null;
    const latInput = document.getElementById(`${role}_signature_latitude`) as HTMLInputElement | null;
    const lngInput = document.getElementById(`${role}_signature_longitude`) as HTMLInputElement | null;
    const labelInput = document.getElementById(`${role}_signature_location_label`) as HTMLInputElement | null;

    if (signedAtInput) signedAtInput.value = next.signedAt ?? '';
    if (latInput) latInput.value = next.signedLatitude != null ? String(next.signedLatitude) : '';
    if (lngInput) lngInput.value = next.signedLongitude != null ? String(next.signedLongitude) : '';
    if (labelInput) labelInput.value = next.signedLocationLabel ?? '';
  }

  useEffect(() => {
    syncMetadataInputs({ signedAt, signedLatitude: latitude, signedLongitude: longitude, signedLocationLabel: locationLabel });
  }, [signedAt, latitude, longitude, locationLabel, role]);

  async function captureSignatureLocation() {
    if (geoStartedRef.current) return;
    geoStartedRef.current = true;
    setGeoStatus('pending');
    setGeoError(null);

    try {
      const position = await requestSignaturePosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);
      const resolvedLabel = await resolveSignatureLocationLabel(lat, lng);
      setLocationLabel(resolvedLabel);
      setGeoStatus('ok');
    } catch {
      setGeoStatus('error');
      setGeoError(
        'Standort konnte nicht erfasst werden. Bitte Ortungsfreigabe im Browser aktivieren und erneut unterschreiben.',
      );
      geoStartedRef.current = false;
    }
  }

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return getCanvasPoint(event, canvas);
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = syncCanvasSize(canvas);
    if (!ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    void captureSignatureLocation();
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasStroke(true);
    setSignedAt((current) => current ?? new Date().toISOString());
    setRemoved(false);
    onChange?.({ dataUrl: canvas.toDataURL('image/png'), remove: false });
  }

  function syncHiddenInput(canvas: HTMLCanvasElement | null, remove = false) {
    const hidden = document.getElementById(`${role}_signature_data`) as HTMLInputElement | null;
    if (!hidden) return;
    if (remove || !canvas) {
      hidden.value = '';
      onChange?.({ dataUrl: null, remove: true });
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    hidden.value = dataUrl;
    onChange?.({ dataUrl, remove: false });
  }

  function stopDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
    syncHiddenInput(canvasRef.current);
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setHasStroke(false);
    setRemoved(true);
    setSignedAt(null);
    setLatitude(null);
    setLongitude(null);
    setLocationLabel(null);
    setGeoStatus('idle');
    setGeoError(null);
    geoStartedRef.current = false;
    syncHiddenInput(null, true);
    syncMetadataInputs({
      signedAt: null,
      signedLatitude: null,
      signedLongitude: null,
      signedLocationLabel: null,
    });
  }

  const showExisting = existingUrl && !removed && !hasStroke;
  const auditLine =
    signedAt && latitude != null && longitude != null
      ? formatSignatureAuditLine(signedAt, locationLabel, latitude, longitude)
      : null;

  return (
    <div className="report-signature-field">
      <div className="report-signature-field-header">
        <strong>{label}</strong>
        <span className="muted">Optional</span>
      </div>
      <label>
        Name
        <input
          type="text"
          name={`${role}_signer_name`}
          value={signerName}
          onChange={(event) => setSignerName(event.target.value)}
          placeholder="Name des Unterzeichners"
        />
      </label>
      {showExisting && (
        <div className="report-signature-existing">
          <img src={existingUrl} alt={`Unterschrift ${label}`} />
          <input type="hidden" name={`${role}_signature_keep`} value="1" />
          {existingMetadata?.signedAt &&
            existingMetadata.signedLatitude != null &&
            existingMetadata.signedLongitude != null && (
              <p className="report-signature-meta muted">
                {formatSignatureAuditLine(
                  existingMetadata.signedAt,
                  existingMetadata.signedLocationLabel,
                  existingMetadata.signedLatitude,
                  existingMetadata.signedLongitude,
                )}
              </p>
            )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="report-signature-canvas"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={stopDraw}
        onPointerLeave={stopDraw}
      />
      <input type="hidden" name={`${role}_signature_data`} defaultValue="" id={`${role}_signature_data`} />
      <input type="hidden" name={`${role}_signature_signed_at`} defaultValue="" id={`${role}_signature_signed_at`} />
      <input type="hidden" name={`${role}_signature_latitude`} defaultValue="" id={`${role}_signature_latitude`} />
      <input type="hidden" name={`${role}_signature_longitude`} defaultValue="" id={`${role}_signature_longitude`} />
      <input
        type="hidden"
        name={`${role}_signature_location_label`}
        defaultValue=""
        id={`${role}_signature_location_label`}
      />
      {removed && <input type="hidden" name={`${role}_signature_remove`} value="1" />}
      {hasStroke && geoStatus === 'pending' && (
        <p className="report-signature-meta muted">Standort wird erfasst…</p>
      )}
      {hasStroke && auditLine && geoStatus === 'ok' && (
        <p className="report-signature-meta">{auditLine}</p>
      )}
      {geoError && <p className="form-error report-signature-meta">{geoError}</p>}
      <div className="report-signature-actions">
        <button type="button" className="secondary-button secondary-button--compact" onClick={clearPad}>
          Unterschrift löschen
        </button>
      </div>
    </div>
  );
}
