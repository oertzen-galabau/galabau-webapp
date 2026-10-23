import { SiteIconPreview } from '@/components/sites/site-icon-preview';
import type { SiteCoverDisplay } from '@/lib/sites/resolve-site-cover';

type Props = {
  cover: SiteCoverDisplay;
  className?: string;
};

export function SiteListPreview({ cover, className = 'document-preview' }: Props) {
  return (
    <div className={className}>
      {cover.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" className="site-list-preview-img" />
      ) : (
        <SiteIconPreview iconKey={cover.iconKey} className="site-icon-preview" />
      )}
    </div>
  );
}
