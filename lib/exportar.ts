import { toPng, toJpeg } from 'html-to-image';
import { Lote, buildLink, formatDataBR } from './lote';

export async function gerarImagem(el: HTMLElement): Promise<Blob> {
  let dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
  let res = await fetch(dataUrl);
  let blob = await res.blob();

  if (blob.size > 1024 * 1024) {
    dataUrl = await toJpeg(el, { pixelRatio: 2, quality: 0.92, cacheBust: true });
    res = await fetch(dataUrl);
    blob = await res.blob();
  }

  return blob;
}

export function textoDoLote(l: Lote): string {
  const link = buildLink(l.codigo);
  return [
    `Lote: ${l.codigo}`,
    ...(l.item?.trim() ? [`Item: ${l.item}`] : []),
    `Esterilização: ${formatDataBR(l.esterilizacao)}`,
    `Validade: ${formatDataBR(l.validade)}`,
    `Responsável: ${l.responsavel}`,
    `Link: ${link}`
  ].join('\n');
}

async function garantirPngBlob(imagem: Blob): Promise<Blob> {
  if (imagem.type === 'image/png') {
    return imagem;
  }

  const url = URL.createObjectURL(imagem);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar imagem para conversão.'));
      el.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto gráfico indisponível.');
    }
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!pngBlob) {
      throw new Error('Não foi possível converter a imagem para PNG.');
    }
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copiarImagem(imagem: Blob): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    throw new Error('Seu navegador não suporta copiar a imagem diretamente. Use o botão Baixar imagem.');
  }

  try {
    const pngBlob = await garantirPngBlob(imagem);
    const clipboardItem = new ClipboardItem({
      'image/png': pngBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch (err) {
    console.warn('Falha ao copiar imagem para o clipboard:', err);
    throw new Error('Seu navegador não suporta copiar a imagem diretamente. Use o botão Baixar imagem.');
  }
}

export async function copiarTexto(l: Lote): Promise<void> {
  const texto = textoDoLote(l);
  await navigator.clipboard.writeText(texto);
}

export function baixarImagem(l: Lote, imagem: Blob): void {
  const isJpeg = imagem.type === 'image/jpeg';
  const ext = isJpeg ? 'jpg' : 'png';
  const filename = `lote-${l.codigo}.${ext}`;
  const url = URL.createObjectURL(imagem);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
