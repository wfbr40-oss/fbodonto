import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'FB Odonto - Etiquetas de Esterilização',
  description: 'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
  openGraph: {
    title: 'FB Odonto - Etiquetas de Esterilização',
    description: 'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FB Odonto - Etiquetas de Esterilização',
    description: 'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code e link curto para consultórios odontológicos.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
