import { deleteSiteDocument, uploadSiteDocument } from '@/lib/actions/admin';
import { FileInputField } from '@/components/ui/file-input-field';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';
import { AppSelect } from '@/components/ui/app-select';

type Document = {
  id: string;
  title: string;
  file_url: string | null;
  category: string | null;
};

type Props = {
  siteId: string;
  plans: Document[];
  lv: Document[];
  other: Document[];
  signedUrls: Map<string, string>;
  canEdit: boolean;
};

function DocumentGroup({
  title,
  documents,
  signedUrls,
  canEdit,
}: {
  title: string;
  documents: Document[];
  signedUrls: Map<string, string>;
  canEdit: boolean;
}) {
  return (
    <div className="site-doc-group">
      <h3>{title}</h3>
      {documents.length > 0 ? (
        <ul className="site-entity-list">
          {documents.map((doc) => {
            const url = doc.file_url ? signedUrls.get(doc.file_url) : null;
            return (
              <li key={doc.id} className="site-entity-row">
                <div className="site-entity-row-body">
                  {url ? (
                    <strong>
                      <a href={url} target="_blank" rel="noreferrer">{doc.title}</a>
                    </strong>
                  ) : (
                    <strong>{doc.title}</strong>
                  )}
                </div>
                {canEdit && (
                  <SiteEntityDeleteButton
                    id={doc.id}
                    entityLabel="Dokument"
                    onDelete={deleteSiteDocument}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">
          {title === 'Leistungsverzeichnis' && 'Kein Leistungsverzeichnis hinterlegt.'}
          {title === 'Pläne' && 'Keine Pläne hinterlegt.'}
          {title === 'Weitere Dokumente' && 'Keine weiteren Dokumente.'}
        </p>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  plan: 'Plan',
  leistungsverzeichnis: 'Leistungsverzeichnis',
  sonstiges: 'Sonstiges',
};

const CATEGORY_OPTIONS = [
  { value: 'plan', label: CATEGORY_LABELS.plan },
  { value: 'leistungsverzeichnis', label: CATEGORY_LABELS.leistungsverzeichnis },
  { value: 'sonstiges', label: CATEGORY_LABELS.sonstiges },
];

export function SiteDocumentsSection({
  siteId,
  plans,
  lv,
  other,
  signedUrls,
  canEdit,
}: Props) {
  return (
    <section className="site-detail-section">
      <h2>Dokumente</h2>
      <DocumentGroup title="Leistungsverzeichnis" documents={lv} signedUrls={signedUrls} canEdit={canEdit} />
      <DocumentGroup title="Pläne" documents={plans} signedUrls={signedUrls} canEdit={canEdit} />
      <DocumentGroup title="Weitere Dokumente" documents={other} signedUrls={signedUrls} canEdit={canEdit} />

      {canEdit && (
        <form action={uploadSiteDocument} className="input-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="site_id" value={siteId} />
          <div className="input-form-core">
            <label>Titel<input name="title" placeholder="z.B. Lageplan Süd" /></label>
            <label>Kategorie
              <AppSelect
                name="category"
                defaultValue="sonstiges"
                allowEmpty={false}
                options={CATEGORY_OPTIONS}
              />
            </label>
            <FileInputField
              label="Datei"
              name="file"
              accept="application/pdf,image/*"
              required
              hint="PDF oder Bild"
            />
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Dokument hochladen</button>
          </div>
        </form>
      )}
    </section>
  );
}
