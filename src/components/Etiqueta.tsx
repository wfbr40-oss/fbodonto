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
      {/* QR Code à esquerda */}
      <div className="flex-shrink-0 flex items-center justify-center mr-1" style={{ width: `${Math.max(15, alturaMm - 6)}mm`, height: `${Math.max(15, alturaMm - 6)}mm` }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-slate-200 animate-pulse" />
        )}
      </div>

      {/* Textos à direita */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 leading-tight">
        <div className="font-bold text-[8pt] truncate text-slate-900" title={lote.item}>
          {lote.item}
        </div>
        <div className="text-[7pt] font-semibold text-slate-800">
          Lote: <span className="font-mono font-bold text-slate-900">{lote.codigo}</span>
        </div>
        <div className="text-[6.5pt] text-slate-700 flex justify-between">
          <span>Est: {formatDataBR(lote.esterilizacao)}</span>
        </div>
        <div className="text-[6.5pt] font-medium text-slate-800 flex justify-between">
          <span>Val: {formatDataBR(lote.validade)}</span>
        </div>
        <div className="text-[6pt] text-slate-600 truncate" title={lote.responsavel}>
          Resp: {lote.responsavel}
        </div>
      </div>
    </div>
  );
}
