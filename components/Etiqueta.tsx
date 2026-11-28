'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Lote, buildLink, formatDataBR } from '@/lib/lote';

type EtiquetaProps = {
  lote: Lote;
  larguraMm?: number;
  alturaMm?: number;
};

export default function Etiqueta({ lote, larguraMm = 50, alturaMm = 30 }: EtiquetaProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const link = buildLink(lote.codigo);
    QRCode.toDataURL(link, { width: 200, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) => console.error("Erro ao gerar QR Code para etiqueta:", err));
  }, [lote.codigo]);

  const qrSizeMm = Math.max(14, Math.min(alturaMm - 3, Math.floor(larguraMm * 0.36)));
  const nomeItem = lote.item?.trim() || '';
  const nomeResponsavel = lote.responsavel?.trim() || '';

  return (
    <div
      className="etiqueta-item bg-white text-black border border-dashed border-slate-400 print:border-slate-600 relative overflow-hidden box-border flex items-center font-sans break-inside-avoid"
      style={{
        width: `${larguraMm}mm`,
        height: `${alturaMm}mm`,
        padding: '1.2mm',
        gap: '1.2mm',
      }}
    >
      <div
        className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden leading-[1.15] gap-[0.4mm] tracking-tight"
        style={{ fontSize: 'calc(6.5pt + 3px)' }}
      >
        <div className="font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          LOTE: <span className="font-mono">{lote.codigo}</span>
        </div>
        {nomeItem && (
          <div className="font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
            ITEM: {nomeItem}
          </div>
        )}
        <div className="text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
          PROC: {formatDataBR(lote.esterilizacao)}
        </div>
        <div className="font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          VAL: {formatDataBR(lote.validade)}
        </div>
        {nomeResponsavel && (
          <div className="text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
            RESP: {nomeResponsavel}
          </div>
        )}
      </div>

      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm` }}
      >
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain block" />
        ) : (
          <div className="w-full h-full bg-slate-200 animate-pulse" />
        )}
      </div>
    </div>
  );
}
