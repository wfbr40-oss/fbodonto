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
    `Item: ${l.item}`,
    `Esterilização: ${formatDataBR(l.esterilizacao)}`,
    `Validade: ${formatDataBR(l.validade)}`,
    `Responsável: ${l.responsavel}`,
    `Link: ${link}`
  ].join('\n');
}

export async function copiarTextoEImagem(l: Lote, imagem: Blob): Promise<void> {
  const texto = textoDoLote(l);
  const link = buildLink(l.codigo);

  const reader = new FileReader();
  const imgDataUrl = await new Promise<string>((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(imagem);
  });

  const htmlContent = `<div>
    <p><b>Lote:</b> ${l.codigo}</p>
    <p><b>Item:</b> ${l.item}</p>
    <p><b>Esterilização:</b> ${formatDataBR(l.esterilizacao)}</p>
    <p><b>Validade:</b> ${formatDataBR(l.validade)}</p>
    <p><b>Responsável:</b> ${l.responsavel}</p>
    <p><b>Link:</b> <a href="${link}">${link}</a></p>
    <br/>
    <img src="${imgDataUrl}" alt="Cartão do Lote ${l.codigo}" style="max-width: 100%; height: auto;" />
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
