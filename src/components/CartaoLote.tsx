'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Lote, buildLink, formatDataBR, statusValidade } from '@/lib/lote';

type CartaoLoteProps = {
  lote: Lote;
  logo: string | null;
  nomeConsultorio?: string;
};

export default function CartaoLote({ lote, logo, nomeConsultorio = "FB Odonto" }: CartaoLoteProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const status = statusValidade(lote);

  useEffect(() => {
    const link = buildLink(lote.codigo);
    QRCode.toDataURL(link, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) => console.error("Erro ao gerar QR Code do cartão:", err));
  }, [lote.codigo]);

  return (
    <div
      id="cartao-lote-exportavel"
      className="w-[600px] bg-white text-slate-900 border border-slate-300 p-8 font-sans box-border"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* Cabeçalho com logo e nome do consultório */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-6">
        <div className="flex items-center space-x-4">
          {logo ? (
            <img src={logo} alt="Logo" className="h-12 max-w-[160px] object-contain" />
          ) : (
            <div className="text-xl font-bold text-sky-600">🦷 {nomeConsultorio}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Comprovante de Lote</div>
          <div className="text-lg font-mono font-bold text-slate-800">{lote.codigo}</div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Item Esterilizado</div>
            <div className="text-xl font-bold text-slate-900">{lote.item}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Esterilização</div>
              <div className="text-base font-semibold text-slate-800">{formatDataBR(lote.esterilizacao)}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Validade</div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-semibold text-slate-800">{formatDataBR(lote.validade)}</span>
                {status === 'valido' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">VÁLIDO</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded">VENCIDO</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Responsável Técnico</div>
            <div className="text-sm font-medium text-slate-700">{lote.responsavel}</div>
          </div>
        </div>

        {/* QR Code e Link Curto */}
        <div className="flex flex-col items-center justify-center bg-slate-50 p-4 rounded border border-slate-200 text-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 object-contain mb-2" />
          ) : (
            <div className="w-28 h-28 bg-slate-200 animate-pulse mb-2" />
          )}
          <span className="text-[11px] font-mono text-slate-600 break-all">{buildLink(lote.codigo)}</span>
          <span className="text-[10px] text-slate-400 mt-1">Aponte a câmera para ler</span>
        </div>
      </div>

      {/* Rodapé */}
      <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Gerado pelo sistema de esterilização • {nomeConsultorio}
      </div>
    </div>
  );
}
