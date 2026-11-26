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

  const qrSizeMm = Math.max(15, Math.min(alturaMm - 4, Math.floor(larguraMm * 0.4)));

  return (
    <div
      className="etiqueta-item bg-white text-black border border-dashed border-slate-400 print:border-slate-600 relative overflow-hidden box-border flex items-center font-sans break-inside-avoid"
      style={{
        width: `${larguraMm}mm`,
        height: `${alturaMm}mm`,
        padding: '1.5mm',
        gap: '1.5mm',
      }}
    >
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

      <div className="flex-1 min-w-0 flex flex-col justify-center h-full overflow-hidden leading-[1.2] gap-[0.8mm]">
        <div className="text-[6.5pt] font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          LOTE: <span className="font-mono">{lote.codigo}</span>
        </div>
        <div className="text-[6.5pt] text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">
          PROC: {formatDataBR(lote.esterilizacao)}
        </div>
        <div className="text-[6.5pt] font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          VAL: {formatDataBR(lote.validade)}
        </div>
      </div>
    </div>
  );
}
