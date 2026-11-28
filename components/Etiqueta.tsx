'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Lote, buildLink, formatDataBR } from '@/lib/lote';

const qrEtiquetaCache = new Map<string, string>();

const CONECTORES_NOME = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const TITULOS_NOME = new Set(['dr.', 'dra.', 'sr.', 'sra.', 'prof.', 'profa.', 'enf.', 'dr', 'dra']);

type EtiquetaProps = {
  lote: Lote;
  larguraMm?: number;
  alturaMm?: number;
};

function formatarCodigoEtiqueta(codigo: string): string {
  const limpo = codigo.replace(/\s+/g, '');
  if (/^\d{10}$/.test(limpo)) {
    return `${limpo.slice(0, 4)} ${limpo.slice(4, 8)} ${limpo.slice(8)}`;
  }
  return codigo;
}

function larguraRelativaTexto(texto: string): number {
  let total = 0;
  for (const ch of texto) {
    if ('iljtfrI., '.includes(ch)) {
      total += 0.58;
    } else if ('mwMW'.includes(ch)) {
      total += 1.35;
    } else if (ch >= 'A' && ch <= 'Z') {
      total += 1.22;
    } else {
      total += 1.0;
    }
  }
  return total;
}

function abreviarNomeEtiqueta(nome: string, capacidadeRelativa: number): string {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (!limpo) return '';
  if (larguraRelativaTexto(limpo) <= capacidadeRelativa) {
    return limpo;
  }

  const tokens = limpo.split(' ');
  if (tokens.length === 1) {
    return `${tokens[0][0]}.`;
  }

  const primeiroEhTitulo = TITULOS_NOME.has(tokens[0].toLowerCase());
  const indicePrimeiroNome = primeiroEhTitulo && tokens.length > 1 ? 1 : 0;

  // Abbreviate surnames from right to left, dropping preceding connectors (de/da/do...)
  const atual = [...tokens];
  for (let i = atual.length - 1; i > indicePrimeiroNome; i--) {
    const token = atual[i];
    if (!token) continue;

    if (CONECTORES_NOME.has(token.toLowerCase())) {
      atual.splice(i, 1);
    } else {
      atual[i] = `${token[0]}.`;
      // Remove connector immediately before the abbreviated surname if present
      if (i - 1 > indicePrimeiroNome && CONECTORES_NOME.has(atual[i - 1].toLowerCase())) {
        atual.splice(i - 1, 1);
        i--;
      }
    }

    const candidato = atual.join(' ');
    if (larguraRelativaTexto(candidato) <= capacidadeRelativa) {
      return candidato;
    }
  }

  // If still exceeding width, abbreviate first name (preserving title if present)
  if (atual[indicePrimeiroNome] && atual[indicePrimeiroNome].length > 2) {
    atual[indicePrimeiroNome] = `${atual[indicePrimeiroNome][0]}.`;
    const candidato = atual.join(' ');
    if (larguraRelativaTexto(candidato) <= capacidadeRelativa) {
      return candidato;
    }
  }

  // Last resort for very narrow label widths: drop trailing initials until it fits
  while (atual.length > 1 && larguraRelativaTexto(atual.join(' ')) > capacidadeRelativa) {
    atual.pop();
  }

  const finalStr = atual.join(' ');
  if (larguraRelativaTexto(finalStr) <= capacidadeRelativa) {
    return finalStr;
  }
  return `${atual[0][0]}.`;
}

export default function Etiqueta({ lote, larguraMm = 60, alturaMm = 25 }: EtiquetaProps) {
  const link = buildLink(lote.codigo);
  const [qrDataUrl, setQrDataUrl] = useState<string>(() => qrEtiquetaCache.get(link) || '');

  useEffect(() => {
    let ativo = true;
    if (qrEtiquetaCache.has(link)) {
      return;
    }

    QRCode.toDataURL(link, {
      width: 256,
      margin: 0,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        qrEtiquetaCache.set(link, url);
        if (ativo) setQrDataUrl(url);
      })
      .catch((err) => console.error('Erro ao gerar QR Code para etiqueta:', err));

    return () => {
      ativo = false;
    };
  }, [link]);

  const qrSrc = qrEtiquetaCache.get(link) || qrDataUrl;

  const qrSizeMm = Number(
    Math.max(10, Math.min(alturaMm * 0.75, larguraMm * 0.42)).toFixed(2)
  );
  const padY = Number(Math.max(0.8, alturaMm * 0.056).toFixed(2));
  const padX = Number(Math.max(1.2, larguraMm * 0.032).toFixed(2));
  const gapMm = Number(Math.max(1.2, larguraMm * 0.03).toFixed(2));
  const fontSizePt = Number(Math.max(6, Math.min(11, (alturaMm / 25) * 8)).toFixed(2));

  const textWidthMm = Math.max(8, larguraMm - padX * 2 - qrSizeMm - gapMm);
  const fontSizeMm = fontSizePt * 0.352778;
  const capacidadeNome = Math.max(3, (textWidthMm - fontSizeMm * 2.95) / (fontSizeMm * 0.51));

  const nomeItem = lote.item?.trim() || '';
  const nomeResponsavel = abreviarNomeEtiqueta(lote.responsavel || '', capacidadeNome);
  const codigoFormatado = formatarCodigoEtiqueta(lote.codigo);

  return (
    <div
      className="etiqueta-item bg-white text-black border border-dashed border-slate-400 print:border-slate-600 relative overflow-hidden box-border flex items-center font-sans break-inside-avoid"
      style={{
        width: `${larguraMm}mm`,
        height: `${alturaMm}mm`,
        padding: `${padY}mm ${padX}mm`,
        gap: `${gapMm}mm`,
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm` }}
      >
        {qrSrc ? (
          <img src={qrSrc} alt="QR Code" className="w-full h-full object-contain block" />
        ) : (
          <div className="w-full h-full bg-slate-200 animate-pulse" />
        )}
      </div>

      <div
        className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden text-black"
        style={{ fontSize: `${fontSizePt}pt`, lineHeight: 1.2 }}
      >
        {nomeItem && (
          <div
            className="font-bold text-black break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {nomeItem}
          </div>
        )}
        <div className="tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          LOTE: {codigoFormatado}
        </div>
        <div className="tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          PROC: {formatDataBR(lote.esterilizacao)}
        </div>
        <div className="tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
          VAL: {formatDataBR(lote.validade)}
        </div>
        {nomeResponsavel && (
          <div className="whitespace-nowrap overflow-hidden">
            RESP: {nomeResponsavel}
          </div>
        )}
      </div>
    </div>
  );
}
