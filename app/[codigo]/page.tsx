'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Lote } from '@/lib/lote';
import { getLote } from '@/lib/db';
import { carregarLogo } from '@/lib/logo';
import { gerarImagem, copiarTextoEImagem, copiarTexto, baixarImagem } from '@/lib/exportar';
import CartaoLote from '@/components/CartaoLote';
import { carregarConfig } from '@/lib/config';
import { Copy, Download, Check, AlertCircle, RefreshCw } from 'lucide-react';

export default function LeituraLotePage() {
  const params = useParams();
  const codigoRaw = (params?.codigo as string) || '';
  const codigo = codigoRaw.replace(/[^0-9]/g, '');

  const [lote, setLote] = useState<Lote | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const [msgCopia, setMsgCopia] = useState<string | null>(null);
  const [processando, setProcessando] = useState<boolean>(false);
  const config = carregarConfig();

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      if (codigo.length !== 10) {
        setLote(null);
        setCarregando(false);
        return;
      }

      const [loteEncontrado, logoCarregada] = await Promise.all([
        getLote(codigo),
        carregarLogo()
      ]);

      setLote(loteEncontrado);
      setLogo(logoCarregada);
    } catch (err: any) {
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

  const dispararMsg = (msg: string) => {
    setMsgCopia(msg);
    setTimeout(() => setMsgCopia(null), 3000);
  };

  const handleCopiarTextoEImg = async () => {
    if (!lote) return;
    setProcessando(true);
    try {
      const el = document.getElementById('cartao-lote-exportavel');
      if (!el) throw new Error('Elemento do cartão não encontrado');
      const blob = await gerarImagem(el);
      await copiarTextoEImagem(lote, blob);
      dispararMsg('Texto e imagem copiados com sucesso!');
    } catch (err: any) {
      dispararMsg(err.message || 'Erro ao copiar imagem. Copiado apenas texto.');
    } finally {
      setProcessando(false);
    }
  };

  const handleCopiarApenasTexto = async () => {
    if (!lote) return;
    try {
      await copiarTexto(lote);
      dispararMsg('Texto e link copiados!');
    } catch {
      dispararMsg('Erro ao copiar texto.');
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
      dispararMsg('Imagem baixada com sucesso!');
    } catch {
      dispararMsg('Erro ao gerar imagem para download.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      {carregando ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Carregando informações do lote...</p>
        </div>
      ) : erro ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center max-w-md w-full space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Erro de Conexão</h2>
          <p className="text-sm text-slate-600">{erro}</p>
          <button
            onClick={carregarDados}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm inline-flex items-center space-x-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : !lote ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center max-w-md w-full space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-700 text-2xl font-bold mb-2">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-900">Lote não encontrado</h2>
          <p className="text-sm text-slate-600">
            O código <span className="font-mono font-bold text-slate-800">{codigo}</span> não foi localizado ou não existe. Verifique o número digitado ou escaneie a etiqueta novamente.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-sm transition"
          >
            Voltar ao Início
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-6 max-w-xl w-full">
          {msgCopia && (
            <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg flex items-center space-x-2 animate-bounce">
              <Check className="w-4 h-4" />
              <span>{msgCopia}</span>
            </div>
          )}

          <div className="overflow-x-auto w-full flex justify-center shadow-lg rounded-2xl">
            <CartaoLote lote={lote} logo={logo} nomeConsultorio={config.nomeConsultorio} />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 w-full space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Ações para o Prontuário</h3>
            
            <button
              onClick={handleCopiarTextoEImg}
              disabled={processando}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Copy className="w-5 h-5" />
              <span>{processando ? 'Processando...' : 'Copiar texto e imagem juntos'}</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopiarApenasTexto}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar só texto/link</span>
              </button>

              <button
                onClick={handleBaixarImg}
                disabled={processando}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar imagem</span>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            {config.nomeConsultorio} • Rastreabilidade Garantida
          </div>
        </div>
      )}
    </div>
  );
}
