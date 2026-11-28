'use client';

import React, { useState } from 'react';
import { Lote, buildLink } from '@/lib/lote';
import { gerarImagem, copiarTextoEImagem, copiarTexto, baixarImagem } from '@/lib/exportar';
import CartaoPreviewResponsivo from '@/components/CartaoPreviewResponsivo';
import { useToast } from '@/components/ToastProvider';
import { X, Copy, Download, Link as LinkIcon } from 'lucide-react';

type ModalCartaoLoteProps = {
  lote: Lote;
  nomeConsultorio: string;
  onClose: () => void;
};

const MODAL_CARD_ID = 'cartao-lote-modal-exportavel';

export default function ModalCartaoLote({
  lote,
  nomeConsultorio,
  onClose,
}: ModalCartaoLoteProps) {
  const [processando, setProcessando] = useState(false);
  const { mostrarPopup } = useToast();

  const handleCopiarTextoEImg = async () => {
    setProcessando(true);
    try {
      const el = document.getElementById(MODAL_CARD_ID);
      if (!el) throw new Error('Cartão não encontrado');
      const blob = await gerarImagem(el);
      await copiarTextoEImagem(lote, blob);
      mostrarPopup({
        tipo: 'sucesso',
        mensagem: 'Texto e imagem copiados com sucesso!',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao copiar imagem.';
      mostrarPopup({
        tipo: 'erro',
        mensagem: msg,
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleCopiarTexto = async () => {
    try {
      await copiarTexto(lote);
      mostrarPopup({
        tipo: 'sucesso',
        mensagem: 'Texto e link copiados!',
      });
    } catch {
      mostrarPopup({
        tipo: 'erro',
        mensagem: 'Erro ao copiar texto.',
      });
    }
  };

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(buildLink(lote.codigo));
      mostrarPopup({
        tipo: 'sucesso',
        mensagem: 'Link público copiado!',
      });
    } catch {
      mostrarPopup({
        tipo: 'erro',
        mensagem: 'Erro ao copiar link.',
      });
    }
  };

  const handleBaixarImg = async () => {
    setProcessando(true);
    try {
      const el = document.getElementById(MODAL_CARD_ID);
      if (!el) throw new Error('Cartão não encontrado');
      const blob = await gerarImagem(el);
      baixarImagem(lote, blob);
      mostrarPopup({
        tipo: 'sucesso',
        mensagem: 'Imagem baixada com sucesso!',
      });
    } catch {
      mostrarPopup({
        tipo: 'erro',
        mensagem: 'Erro ao gerar imagem para download.',
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[#3E4546]/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        className="bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-xl max-w-2xl w-full p-4 sm:p-6 space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE7E6]">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#3E4546]">
              Cartão do Lote{' '}
              <span className="font-mono tabular-nums text-[#9E7372]">{lote.codigo}</span>
            </h3>
            <p className="text-xs text-[#7A8283]">Visualização rápida no aplicativo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar cartão"
            className="p-2 text-[#6E7677] hover:text-[#3E4546] hover:bg-[#F4EFEF] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border border-[#E5DFDE] rounded-xl bg-[#F8F5F5] p-2.5 sm:p-4">
          <CartaoPreviewResponsivo
            lote={lote}
            nomeConsultorio={nomeConsultorio}
            exportId={MODAL_CARD_ID}
          />
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleCopiarTextoEImg}
            disabled={processando}
            className="w-full py-2.5 px-4 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Copy className="w-4 h-4 text-[#CDA9A8]" />
            <span>{processando ? 'Processando...' : 'Copiar texto e imagem juntos'}</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleCopiarTexto}
              className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar texto</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarLink}
              className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Copiar link</span>
            </button>

            <button
              type="button"
              onClick={handleBaixarImg}
              disabled={processando}
              className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar imagem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
