import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: 'Simple job application tracker with Google Sheets backup'
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
