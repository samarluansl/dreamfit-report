import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dreamfit Report',
  description: 'Monthly performance reports for Dreamfit padel clubs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 antialiased">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-500 text-white font-bold text-sm select-none">
              DF
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">
              Dreamfit Report
            </span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
