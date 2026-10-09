type Props = {
  reportId: string;
};

function reportFileUrl(reportId: string, disposition: 'inline' | 'attachment') {
  const params = new URLSearchParams({ reportId, disposition });
  return `/api/reports/file?${params.toString()}`;
}

export function ReportPdfActions({ reportId }: Props) {
  return (
    <>
      <a
        href={reportFileUrl(reportId, 'inline')}
        target="_blank"
        rel="noreferrer"
        className="table-action-link"
      >
        Öffnen
      </a>
      <a href={reportFileUrl(reportId, 'attachment')} className="table-action-link">
        Download
      </a>
    </>
  );
}
