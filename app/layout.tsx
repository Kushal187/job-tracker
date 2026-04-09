import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Applyr — Private Job Search Workspace',
  description:
    'Track applications, autotailor resumes with AI, capture jobs with a Chrome extension, and sync to Google Sheets. Your private job search dashboard.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
