import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Light Tracker — A little clarity on your power',
  description: 'Understand your home’s grid power, outages and tracker health. A Nigerian home-power dashboard prototype.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
