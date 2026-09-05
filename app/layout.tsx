import type { Metadata, Viewport } from 'next';
import { Barlow, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const barlow = Barlow({ variable: '--font-barlow', subsets: ['latin'], weight: ['500', '600', '700', '800', '900'] });

export const metadata: Metadata = {
  title: 'Musterbetrieb Nord · Einsatzplanung',
  description: 'Die digitale Arbeitsoberfläche für Aufträge, Zeiten, Dokumentation und Teams im Handwerk.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101921' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" className={`${inter.variable} ${barlow.variable}`}><body>{children}</body></html>;
}
