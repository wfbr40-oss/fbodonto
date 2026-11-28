import { toPng, toJpeg } from 'html-to-image';
import { Lote, buildLink, formatDataBR } from './lote';

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizarUrlHttp(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // URL inválida
  }
  return '#';
}

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

export async function copiarTextoEImagem(l: Lote, imagem: Blob): Promise<void> {
  const texto = textoDoLote(l);
  const link = sanitizarUrlHttp(buildLink(l.codigo));

  const reader = new FileReader();
  const imgDataUrl = await new Promise<string>((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(imagem);
  });

  const codigoSeguro = escapeHtml(l.codigo);
  const itemSeguro = l.item?.trim() ? escapeHtml(l.item.trim()) : '';
  const esterilizacaoSegura = escapeHtml(formatDataBR(l.esterilizacao));
  const validadeSegura = escapeHtml(formatDataBR(l.validade));
  const responsavelSeguro = escapeHtml(l.responsavel || '');
  const linkSeguro = escapeHtml(link);
  const imgSrcSeguro = imgDataUrl.startsWith('data:image/') ? escapeHtml(imgDataUrl) : '';

  const itemHtml = itemSeguro ? `<p><b>Item:</b> ${itemSeguro}</p>` : '';
  const imgHtml = imgSrcSeguro
    ? `<img src="${imgSrcSeguro}" alt="Cartão do Lote ${codigoSeguro}" style="max-width: 100%; height: auto;" />`
    : '';

  const htmlContent = `<div>
    <p><b>Lote:</b> ${codigoSeguro}</p>
    ${itemHtml}
    <p><b>Esterilização:</b> ${esterilizacaoSegura}</p>
    <p><b>Validade:</b> ${validadeSegura}</p>
    <p><b>Responsável:</b> ${responsavelSeguro}</p>
    <p><b>Link:</b> <a href="${linkSeguro}">${linkSeguro}</a></p>
    <br/>
    ${imgHtml}
  </div>`;

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
    try {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([texto], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'image/png': imagem.type === 'image/png' ? imagem : new Blob([imagem], { type: 'image/png' })
      });
      await navigator.clipboard.write([clipboardItem]);
      return;
    } catch (err) {
      console.warn("ClipboardItem com imagem falhou, tentando fallback de texto:", err);
    }
  }

  await navigator.clipboard.writeText(texto);
  throw new Error("Seu navegador não suporta colar imagem diretamente no clipboard. Apenas o texto foi copiado.");
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
