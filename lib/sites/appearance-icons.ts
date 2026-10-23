import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Fence,
  HardHat,
  Home,
  Leaf,
  MapPin,
  Shovel,
  Sun,
  TreePine,
  Truck,
} from 'lucide-react';

export const DEFAULT_SITE_ICON_KEY = 'building-2';

export const SITE_ICON_OPTIONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'building-2', label: 'Baustelle', Icon: Building2 },
  { key: 'hard-hat', label: 'Bau', Icon: HardHat },
  { key: 'tree-pine', label: 'Baum', Icon: TreePine },
  { key: 'leaf', label: 'Garten', Icon: Leaf },
  { key: 'shovel', label: 'Erdbau', Icon: Shovel },
  { key: 'truck', label: 'Logistik', Icon: Truck },
  { key: 'home', label: 'Objekt', Icon: Home },
  { key: 'map-pin', label: 'Standort', Icon: MapPin },
  { key: 'fence', label: 'Zaun', Icon: Fence },
  { key: 'sun', label: 'Außen', Icon: Sun },
];

const ICON_BY_KEY = new Map(SITE_ICON_OPTIONS.map((o) => [o.key, o.Icon]));

export function isSiteIconKey(key: string): boolean {
  return ICON_BY_KEY.has(key);
}

export function siteIconComponent(key: string): LucideIcon {
  return ICON_BY_KEY.get(key) ?? Building2;
}
