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

  return (
    <div
      className="etiqueta-item bg-white text-black border border-dashed border-slate-400 print:border-none relative overflow-hidden box-border flex items-center p-1 font-sans"
      style={{
        width: `${larguraMm}mm`,
        height: `${alturaMm}mm`,
      }}
    >
      <div 
        className="flex-shrink-0 flex items-center justify-center mr-1" 
        style={{ width: `${Math.max(14, alturaMm - 6)}mm`, height: `${Math.max(14, alturaMm - 6)}mm` }}
      >
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-slate-200 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center h-full py-0.5 space-y-0.5 leading-tight overflow-hidden">
        <div className="text-[7.5pt] font-bold text-slate-900 truncate">
          LOTE: <span className="font-mono">{lote.codigo}</span>
        </div>
        <div className="text-[7pt] text-slate-800 truncate">
          PROC: {formatDataBR(lote.esterilizacao)}
        </div>
        <div className="text-[7pt] font-semibold text-slate-900 truncate">
          VAL: {formatDataBR(lote.validade)}
        </div>
      </div>
    </div>
  );
}
