'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Lote, buildLink, formatDataBR, statusValidade } from '@/lib/lote';

type CartaoLoteProps = {
  lote: Lote;
  logo: string | null;
  nomeConsultorio?: string;
};

export default function CartaoLote({ lote, logo, nomeConsultorio = 'FB Odonto' }: CartaoLoteProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const status = statusValidade(lote);

  useEffect(() => {
    const link = buildLink(lote.codigo);
    QRCode.toDataURL(link, {
      width: 160,
      margin: 1,
      color: { dark: '#3E4546', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Erro ao gerar QR Code do cartão:', err));
  }, [lote.codigo]);

  return (
    <div
      id="cartao-lote-exportavel"
      className="w-[600px] bg-white text-[#505859] border border-[#E5DFDE] p-8 font-sans box-border"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="flex items-center justify-between border-b border-[#EDE7E6] pb-6 mb-6">
        <div className="flex items-center space-x-4">
          {logo ? (
            <img src={logo} alt="Logo" className="h-14 max-w-[160px] object-contain" />
          ) : (
            <div className="text-xl font-bold text-[#505859]">{nomeConsultorio}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-[#9E7372] font-semibold">
            Comprovante de Lote
          </div>
          <div className="text-lg font-mono tabular-nums font-bold text-[#3E4546]">{lote.codigo}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 space-y-4">
          {lote.item?.trim() ? (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#7A8283] font-semibold mb-1">
                Item Esterilizado
              </div>
              <div className="text-xl font-bold text-[#3E4546]">{lote.item}</div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F8F5F5] p-3.5 rounded-lg border border-[#E8E1E0]">
              <div className="text-[11px] uppercase tracking-wider text-[#7A8283] font-semibold mb-1">
                Esterilização
              </div>
              <div className="text-base font-semibold text-[#3E4546] tabular-nums">
                {formatDataBR(lote.esterilizacao)}
              </div>
            </div>

            <div className="bg-[#F8F5F5] p-3.5 rounded-lg border border-[#E8E1E0]">
              <div className="text-[11px] uppercase tracking-wider text-[#7A8283] font-semibold mb-1">
                Validade
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-semibold text-[#3E4546] tabular-nums">
                  {formatDataBR(lote.validade)}
                </span>
                {status === 'valido' ? (
                  <span className="text-[10px] font-bold tracking-wide text-[#2E6045]">
                    · VÁLIDO
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-wide text-[#8C3B3B]">
                    · VENCIDO
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#7A8283] font-semibold mb-1">
              Responsável Técnico
            </div>
            <div className="text-sm font-medium text-[#505859]">{lote.responsavel}</div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-[#F8F5F5] p-4 rounded-lg border border-[#E8E1E0] text-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 object-contain mb-2" />
          ) : (
            <div className="w-28 h-28 bg-[#EDE7E6] animate-pulse mb-2" />
          )}
          <span className="text-[11px] font-mono text-[#505859] break-all">{buildLink(lote.codigo)}</span>
          <span className="text-[10px] text-[#7A8283] mt-1">Aponte a câmera para ler</span>
        </div>
      </div>

      <div className="border-t border-[#EDE7E6] pt-4 text-center text-xs text-[#7A8283]">
        Gerado pelo sistema de esterilização · {nomeConsultorio}
      </div>
    </div>
  );
}
