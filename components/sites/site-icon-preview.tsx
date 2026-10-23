import { siteIconComponent } from '@/lib/sites/appearance-icons';

type Props = {
  iconKey: string;
  size?: number;
  className?: string;
};

export function SiteIconPreview({ iconKey, size = 28, className }: Props) {
  const Icon = siteIconComponent(iconKey);
  return <Icon size={size} className={className} aria-hidden />;
}
