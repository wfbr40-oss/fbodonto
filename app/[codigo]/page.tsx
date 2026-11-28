'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Lote, buildLink } from '@/lib/lote';
import { getLote, carregarConfigNuvem } from '@/lib/db';
import { gerarImagem, copiarTextoEImagem, copiarTexto, baixarImagem } from '@/lib/exportar';
import CartaoPreviewResponsivo from '@/components/CartaoPreviewResponsivo';
import { useToast } from '@/components/ToastProvider';
import { carregarConfig } from '@/lib/config';
import { Copy, Download, AlertCircle, RefreshCw, Link as LinkIcon } from 'lucide-react';

export default function LeituraLotePage() {
  const params = useParams();
  const codigoRaw = (params?.codigo as string) || '';
  const codigo = codigoRaw.replace(/[^0-9]/g, '');

  const [lote, setLote] = useState<Lote | null>(null);
  const [nomeConsultorio, setNomeConsultorio] = useState<string>(() => carregarConfig().nomeConsultorio);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const [processando, setProcessando] = useState<boolean>(false);
  const { mostrarPopup } = useToast();

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      if (codigo.length !== 10) {
        setLote(null);
        setCarregando(false);
        return;
      }

      const [loteEncontrado, configRes] = await Promise.all([
        getLote(codigo),
        carregarConfigNuvem(),
      ]);

      setLote(loteEncontrado);
      setNomeConsultorio(configRes.config.nomeConsultorio);
    } catch (err) {
      console.error(err);
      setErro('Erro de conexão ao carregar o lote.');
    } finally {
      setCarregando(false);
    }
  }, [codigo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarDados();
  }, [carregarDados]);

  const handleCopiarLink = async () => {
    if (!lote) return;
    try {
      await navigator.clipboard.writeText(buildLink(lote.codigo));
      mostrarPopup({ tipo: 'sucesso', mensagem: 'Link copiado com sucesso!' });
    } catch {
      mostrarPopup({ tipo: 'erro', mensagem: 'Erro ao copiar link.' });
    }
  };

  const handleCopiarTextoEImg = async () => {
    if (!lote) return;
    setProcessando(true);
    try {
      const el = document.getElementById('cartao-lote-exportavel');
      if (!el) throw new Error('Elemento do cartão não encontrado');
      const blob = await gerarImagem(el);
      await copiarTextoEImagem(lote, blob);
      mostrarPopup({ tipo: 'sucesso', mensagem: 'Texto e imagem copiados com sucesso!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao copiar imagem. Copiado apenas texto.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setProcessando(false);
    }
  };

  const handleCopiarApenasTexto = async () => {
    if (!lote) return;
    try {
      await copiarTexto(lote);
      mostrarPopup({ tipo: 'sucesso', mensagem: 'Texto e link copiados!' });
    } catch {
      mostrarPopup({ tipo: 'erro', mensagem: 'Erro ao copiar texto.' });
    }
  };

  const handleBaixarImg = async () => {
    if (!lote) return;
    setProcessando(true);
    try {
      const el = document.getElementById('cartao-lote-exportavel');
      if (!el) throw new Error('Elemento do cartão não encontrado');
      const blob = await gerarImagem(el);
      baixarImagem(lote, blob);
      mostrarPopup({ tipo: 'sucesso', mensagem: 'Imagem baixada com sucesso!' });
    } catch {
      mostrarPopup({ tipo: 'erro', mensagem: 'Erro ao gerar imagem para download.' });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="h-screen bg-[#F6F4F3] text-[#505859] flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
      {carregando ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-6 border border-[#E5DFDE] text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#CDA9A8] border-t-[#505859] mx-auto mb-3" />
          <p className="text-xs text-[#6E7677]">Carregando informações do lote...</p>
        </div>
      ) : erro ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-6 border border-[#E5DFDE] text-center max-w-md w-full space-y-3">
          <AlertCircle className="w-10 h-10 text-[#9E7372] mx-auto" />
          <h2 className="text-base font-bold text-[#3E4546]">Erro de Conexão</h2>
          <p className="text-xs text-[#6E7677]">{erro}</p>
          <button
            onClick={carregarDados}
            className="px-4 py-2 bg-[#505859] hover:bg-[#3E4546] hover:scale-105 focus:scale-105 text-white font-semibold rounded-lg text-xs inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : !lote ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-6 border border-[#E5DFDE] text-center max-w-md w-full space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#CDA9A8]/25 text-[#505859] mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#3E4546]">Lote não encontrado</h2>
          <p className="text-xs text-[#6E7677]">
            O código <span className="font-mono font-bold text-[#3E4546]">{codigo}</span> não foi localizado ou não existe.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[#505859] hover:bg-[#3E4546] hover:scale-105 focus:scale-105 text-white font-semibold rounded-lg text-xs transition"
          >
            Voltar ao Início
          </Link>
        </div>
      ) : (
        <div className="bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-sm max-w-xl w-full p-3 sm:p-5 space-y-3 my-auto max-h-full overflow-y-auto">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#EDE7E6]">
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-[#3E4546]">
                Cartão do Lote{' '}
                <span className="font-mono tabular-nums text-[#9E7372]">{lote.codigo}</span>
              </h1>
              <p className="text-[11px] text-[#7A8283] truncate">
                {nomeConsultorio} · Rastreabilidade Garantida
              </p>
            </div>
          </div>

          <div className="border border-[#E5DFDE] rounded-xl bg-[#F8F5F5] py-1.5 px-2.5 sm:py-2 sm:px-4 flex justify-center">
            <CartaoPreviewResponsivo lote={lote} nomeConsultorio={nomeConsultorio} />
          </div>

          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              onClick={handleCopiarLink}
              className="w-full py-2.5 px-4 bg-[#505859] hover:bg-[#3E4546] hover:scale-105 focus:scale-105 text-white text-xs sm:text-sm font-semibold rounded-xl transition transform flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <LinkIcon className="w-4 h-4 text-[#CDA9A8] shrink-0" />
              <span>Copiar apenas o link</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopiarTextoEImg}
                disabled={processando}
                className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] hover:scale-105 focus:scale-105 disabled:opacity-50 text-[#505859] border border-[#E5DFDE] font-semibold rounded-xl text-xs transition transform flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>{processando ? 'Processando...' : 'Copiar imagem'}</span>
              </button>

              <button
                type="button"
                onClick={handleBaixarImg}
                disabled={processando}
                className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] hover:scale-105 focus:scale-105 disabled:opacity-50 text-[#505859] border border-[#E5DFDE] font-semibold rounded-xl text-xs transition transform flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Baixar imagem</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
