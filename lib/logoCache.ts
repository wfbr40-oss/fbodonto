'use client';

const logoDataUrlCache = new Map<string, string>();
const logoPromises = new Map<string, Promise<string>>();

export function getLogoEmCache(src = '/logo.png'): string | null {
  return logoDataUrlCache.get(src) ?? null;
}

export function precarregarLogo(src = '/logo.png'): Promise<string> {
  if (typeof window === 'undefined') {
    return Promise.resolve(src);
  }

  const cached = logoDataUrlCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existing = logoPromises.get(src);
  if (existing) {
    return existing;
  }

  if (src.startsWith('data:')) {
    logoDataUrlCache.set(src, src);
    return Promise.resolve(src);
  }

  const promise = (async () => {
    try {
      const response = await fetch(src, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`Falha ao carregar logo: ${response.status}`);
      }
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Resultado inválido ao ler logo'));
          }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Erro ao ler blob da logo'));
        reader.readAsDataURL(blob);
      });

      const img = new window.Image();
      img.decoding = 'sync';
      img.src = dataUrl;
      if (typeof img.decode === 'function') {
        await img.decode().catch(() => undefined);
      } else {
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }

      logoDataUrlCache.set(src, dataUrl);
      return dataUrl;
    } catch {
      return src;
    } finally {
      logoPromises.delete(src);
    }
  })();

  logoPromises.set(src, promise);
  return promise;
}
