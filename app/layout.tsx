import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'FB Odonto - Etiquetas de Esterilização',
  description:
    'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FB Odonto',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'FB Odonto - Etiquetas de Esterilização',
    description:
      'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FB Odonto - Etiquetas de Esterilização',
    description:
      'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body
        suppressHydrationWarning
        className="font-sans bg-[#F6F4F3] text-[#505859] antialiased selection:bg-[#CDA9A8]/35 selection:text-[#3E4546]"
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
