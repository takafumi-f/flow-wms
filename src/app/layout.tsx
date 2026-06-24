import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'FLOW WMS',
    template: '%s | FLOW WMS',
  },
  description: 'EC特化型SaaS倉庫管理システム',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
