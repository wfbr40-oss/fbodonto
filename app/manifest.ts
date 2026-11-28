import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FB Odonto - Etiquetas de Esterilização',
    short_name: 'FB Odonto',
    description:
      'Sistema de cadastro de lotes esterilizados e emissão de etiquetas com QR Code para consultórios odontológicos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F4F3',
    theme_color: '#505859',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
