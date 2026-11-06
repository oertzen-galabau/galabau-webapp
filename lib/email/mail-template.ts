/**
 * Transactional HTML mail helpers (escape user-controlled strings, minimal layout).
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type TransactionalMailOptions = {
  platformName: string;
  title: string;
  leadParagraph: string;
  /** Additional HTML body fragments (already escaped or static safe HTML). */
  sections?: string[];
  footnote?: string;
};

export function buildTransactionalMailHtml(options: TransactionalMailOptions): string {
  const brand = escapeHtml(options.platformName);
  const title = escapeHtml(options.title);
  const lead = escapeHtml(options.leadParagraph);
  const footnote = options.footnote ? escapeHtml(options.footnote) : null;

  const sections = (options.sections ?? []).join('\n');

  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px; background:#ffffff; border-radius:12px; border:1px solid #e4e4e7; overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 8px; font-size:13px; font-weight:600; color:#71717a; letter-spacing:0.02em;">${brand}</td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px; font-size:20px; font-weight:700; line-height:1.25; color:#18181b;">${title}</td>
          </tr>
          <tr>
            <td style="padding:12px 24px 16px; font-size:15px; line-height:1.55; color:#3f3f46;">${lead}</td>
          </tr>
          ${sections}
          ${
            footnote
              ? `<tr><td style="padding:16px 24px 24px; font-size:13px; line-height:1.5; color:#71717a; border-top:1px solid #f4f4f5;">${footnote}</td></tr>`
              : '<tr><td style="padding:0 24px 24px;"></td></tr>'
          }
        </table>
        <p style="max-width:560px; margin:16px auto 0; font-size:12px; color:#a1a1aa; text-align:center;">Diese E-Mail wurde automatisch von ${brand} gesendet.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/** Safe HTML for a primary call-to-action button. */
export function mailCtaButtonHtml(href: string, label: string): string {
  const u = escapeHtml(href);
  const l = escapeHtml(label);
  return `
<tr>
  <td style="padding:4px 24px 20px;">
    <a href="${u}" style="display:inline-block; padding:12px 20px; background:#18181b; color:#fafafa !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">${l}</a>
  </td>
</tr>`;
}

/** Highlight box for one-time passwords or codes (escaped content). */
export function mailSecretHighlightHtml(label: string, value: string): string {
  return `
<tr>
  <td style="padding:4px 24px 16px;">
    <p style="margin:0 0 8px; font-size:13px; color:#71717a;">${escapeHtml(label)}</p>
    <div style="font-size:22px; font-weight:700; letter-spacing:0.18em; padding:14px 16px; background:#fafafa; border:1px solid #e4e4e7; border-radius:8px; color:#18181b; font-family:ui-monospace, Menlo, monospace;">${escapeHtml(value)}</div>
  </td>
</tr>`;
}
