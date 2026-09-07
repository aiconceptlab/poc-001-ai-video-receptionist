import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AI Concept Lab — Video Receptionist',
  description:
    'Meet Nova, an AI video receptionist. Ask a question or leave a project enquiry.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
