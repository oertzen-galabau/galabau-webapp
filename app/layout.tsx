import type { Metadata } from 'next';
import { Barlow, Inter, Geist } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { getPlatformName } from '@/lib/tenant/config';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const barlow = Barlow({ variable: '--font-barlow', subsets: ['latin'], weight: ['500', '600', '700', '800', '900'] });

const platformName = getPlatformName();

export const metadata: Metadata = {
  title: `${platformName} · Baustellenmanagement`,
  description: `${platformName}: Cloud-SaaS für Mitarbeiter- und Baustellenmanagement.`,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={cn(inter.variable, barlow.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
