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
    <div className="min-h-screen bg-[#F6F4F3] text-[#505859] flex flex-col items-center justify-center p-3 sm:p-6">
      {carregando ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-8 border border-[#E5DFDE] text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#CDA9A8] border-t-[#505859] mx-auto mb-4" />
          <p className="text-sm text-[#6E7677]">Carregando informações do lote...</p>
        </div>
      ) : erro ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-6 sm:p-8 border border-[#E5DFDE] text-center max-w-md w-full space-y-4">
          <AlertCircle className="w-11 h-11 text-[#9E7372] mx-auto" />
          <h2 className="text-lg font-bold text-[#3E4546]">Erro de Conexão</h2>
          <p className="text-sm text-[#6E7677]">{erro}</p>
          <button
            onClick={carregarDados}
            className="px-4 py-2.5 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg text-sm inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : !lote ? (
        <div className="bg-[#FCFBFB] rounded-2xl p-6 sm:p-8 border border-[#E5DFDE] text-center max-w-md w-full space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#CDA9A8]/25 text-[#505859] mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#3E4546]">Lote não encontrado</h2>
          <p className="text-sm text-[#6E7677]">
            O código <span className="font-mono font-bold text-[#3E4546]">{codigo}</span> não foi localizado ou não existe. Verifique o número digitado ou escaneie a etiqueta novamente.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg text-sm transition"
          >
            Voltar ao Início
          </Link>
        </div>
      ) : (
        <div className="bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-sm max-w-2xl w-full p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EDE7E6]">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#3E4546]">
                Cartão do Lote{' '}
                <span className="font-mono tabular-nums text-[#9E7372]">{lote.codigo}</span>
              </h1>
              <p className="text-xs text-[#7A8283] truncate">
                {nomeConsultorio} · Rastreabilidade Garantida
              </p>
            </div>
          </div>

          <div className="border border-[#E5DFDE] rounded-xl bg-[#F8F5F5] py-1.5 px-2.5 sm:py-2 sm:px-4">
            <CartaoPreviewResponsivo lote={lote} nomeConsultorio={nomeConsultorio} />
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopiarLink}
              className="w-full py-3 px-4 bg-[#505859] hover:bg-[#3E4546] text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LinkIcon className="w-4 h-4 text-[#CDA9A8] shrink-0" />
              <span>Copiar apenas o link</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopiarTextoEImg}
                disabled={processando}
                className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] disabled:opacity-50 text-[#505859] border border-[#E5DFDE] font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>{processando ? 'Processando...' : 'Copiar texto e imagem'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopiarApenasTexto}
                className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>Copiar texto</span>
              </button>

              <button
                type="button"
                onClick={handleBaixarImg}
                disabled={processando}
                className="py-2.5 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] disabled:opacity-50 text-[#505859] border border-[#E5DFDE] font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
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
