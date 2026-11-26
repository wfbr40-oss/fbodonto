'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Lote } from '@/lib/lote';
import { getLote } from '@/lib/db';
import { gerarImagem, copiarTextoEImagem, copiarTexto, baixarImagem } from '@/lib/exportar';
import CartaoLote from '@/components/CartaoLote';
import {
  Camera,
  CameraOff,
  Search,
  Upload,
  AlertCircle,
  Check,
  Copy,
  Download,
  Printer,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

type LeitorQrCodeProps = {
  nomeConsultorio: string;
  onReimprimir: (lote: Lote) => void;
};

function extrairCodigoLote(texto: string): string | null {
  const match = texto.match(/(\d{10})/);
  if (match) return match[1];
  const apenasDigitos = texto.replace(/\D/g, '');
  return apenasDigitos.length === 10 ? apenasDigitos : null;
}

export default function LeitorQrCode({ nomeConsultorio, onReimprimir }: LeitorQrCodeProps) {
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loteEncontrado, setLoteEncontrado] = useState<Lote | null>(null);
  const [ultimoCodigoLido, setUltimoCodigoLido] = useState<string | null>(null);
  const [processandoExport, setProcessandoExport] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pararCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
  }, []);

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  const buscarLotePorTexto = useCallback(
    async (texto: string) => {
      const codigo = extrairCodigoLote(texto);
      if (!codigo) {
        setErro('QR Code ou código inválido. Informe um código de lote com 10 dígitos.');
        return;
      }

      pararCamera();
      setErro(null);
      setCarregando(true);
      setUltimoCodigoLido(codigo);

      try {
        const lote = await getLote(codigo);
        if (!lote) {
          setLoteEncontrado(null);
          setErro(`Lote ${codigo} não encontrado no sistema.`);
        } else {
          setLoteEncontrado(lote);
        }
      } catch {
        setErro('Erro de conexão ao consultar o lote.');
      } finally {
        setCarregando(false);
      }
    },
    [pararCamera]
  );

  const iniciarCamera = async () => {
    setErro(null);
    setLoteEncontrado(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErro('Câmera não disponível neste navegador. Use a leitura por imagem ou digite o código do lote.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAtiva(true);

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      const escanearFrame = () => {
        const vid = videoRef.current;
        const canvas = canvasRef.current;
        if (!vid || !canvas || !streamRef.current) return;

        if (vid.readyState === vid.HAVE_ENOUGH_DATA && vid.videoWidth > 0 && vid.videoHeight > 0) {
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              void buscarLotePorTexto(code.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(escanearFrame);
      };

      rafRef.current = requestAnimationFrame(escanearFrame);
    } catch {
      pararCamera();
      setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador ou envie uma foto do QR Code.');
    }
  };

  const handleLerImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setErro('Não foi possível processar a imagem.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          void buscarLotePorTexto(code.data);
        } else {
          setErro('Nenhum QR Code identificado nesta imagem. Tente aproximar e enquadrar melhor.');
        }
      };
      img.onerror = () => setErro('Arquivo de imagem inválido.');
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBuscaManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoManual.trim()) return;
    void buscarLotePorTexto(codigoManual.trim());
  };

  const dispararFeedback = (msg: string) => {
    setMsgFeedback(msg);
    setTimeout(() => setMsgFeedback(null), 3000);
  };

  const handleCopiarTextoEImg = async () => {
    if (!loteEncontrado) return;
    setProcessandoExport(true);
    try {
      const el = document.getElementById('cartao-lote-exportavel');
      if (!el) throw new Error('Cartão não encontrado');
      const blob = await gerarImagem(el);
      await copiarTextoEImagem(loteEncontrado, blob);
      dispararFeedback('Texto e imagem copiados com sucesso!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao copiar imagem.';
      dispararFeedback(msg);
    } finally {
      setProcessandoExport(false);
    }
  };

  const handleCopiarTexto = async () => {
    if (!loteEncontrado) return;
    try {
      await copiarTexto(loteEncontrado);
      dispararFeedback('Texto e link copiados!');
    } catch {
      dispararFeedback('Erro ao copiar texto.');
    }
  };

  const handleBaixarImg = async () => {
    if (!loteEncontrado) return;
    setProcessandoExport(true);
    try {
      const el = document.getElementById('cartao-lote-exportavel');
      if (!el) throw new Error('Cartão não encontrado');
      const blob = await gerarImagem(el);
      baixarImagem(loteEncontrado, blob);
      dispararFeedback('Imagem baixada com sucesso!');
    } catch {
      dispararFeedback('Erro ao gerar imagem para download.');
    } finally {
      setProcessandoExport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#3E4546]">Leitor de QR Code</h2>
              <p className="text-xs text-[#7A8283] mt-0.5">
                Aponte a câmera para a etiqueta ou envie uma imagem para consultar o lote.
              </p>
            </div>
          </div>

          <div className="relative bg-[#3E4546] rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-[#E5DFDE]">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${cameraAtiva ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraAtiva ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-44 h-44 border-2 border-[#CDA9A8] rounded-xl shadow-[0_0_0_9999px_rgba(62,69,70,0.45)]" />
              </div>
            ) : (
              <div className="text-center px-6 py-8 text-[#D8D1D0] space-y-2">
                <Camera className="w-10 h-10 mx-auto text-[#CDA9A8]" />
                <p className="text-sm font-medium text-white">Câmera desativada</p>
                <p className="text-xs text-[#D8D1D0]">
                  Clique em &ldquo;Ativar Câmera&rdquo; para escanear uma etiqueta de esterilização.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!cameraAtiva ? (
              <button
                type="button"
                onClick={iniciarCamera}
                className="flex-1 min-w-[160px] py-2.5 px-4 bg-[#505859] hover:bg-[#3E4546] text-white text-sm font-semibold rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-4 h-4 text-[#CDA9A8]" />
                <span>Ativar Câmera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={pararCamera}
                className="flex-1 min-w-[160px] py-2.5 px-4 bg-[#8C4A49] hover:bg-[#733B3A] text-white text-sm font-semibold rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <CameraOff className="w-4 h-4" />
                <span>Parar Câmera</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-4 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-sm font-semibold rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-4 h-4 text-[#9E7372]" />
              <span>Enviar Imagem</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLerImagem}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-[#EDE7E6]">
            <form onSubmit={handleBuscaManual} className="space-y-2">
              <label className="block text-xs font-semibold text-[#6E7677]">
                Ou digite o código do lote / cole o link da etiqueta
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  placeholder="Ex: 2026112501"
                  className="flex-1 px-3.5 py-2 bg-white border border-[#DCD4D3] rounded-lg text-sm font-mono text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                />
                <button
                  type="submit"
                  disabled={carregando}
                  className="px-4 py-2 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-4 h-4 text-[#CDA9A8]" />
                  <span>Buscar</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6 flex flex-col justify-between space-y-4">
          {carregando ? (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#CDA9A8] border-t-[#505859] mx-auto" />
              <p className="text-sm text-[#6E7677]">Consultando lote {ultimoCodigoLido}...</p>
            </div>
          ) : erro ? (
            <div className="py-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#9E7372] mx-auto" />
              <p className="text-sm font-semibold text-[#3E4546]">Não foi possível ler o lote</p>
              <p className="text-xs text-[#8C3B3B] bg-[#F9EDED] border border-[#E8C8C8] rounded-lg p-3">{erro}</p>
            </div>
          ) : loteEncontrado ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#3E4546]">
                  Lote Identificado <span className="font-mono tabular-nums text-[#9E7372]">{loteEncontrado.codigo}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setLoteEncontrado(null);
                    setErro(null);
                    setCodigoManual('');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#6E7677] hover:text-[#3E4546] hover:bg-[#F4EFEF] rounded-lg transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nova leitura</span>
                </button>
              </div>

              {msgFeedback && (
                <div className="p-2.5 bg-[#EDF5F0] border border-[#C8DFCF] text-[#2E6045] rounded-lg text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{msgFeedback}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-[#E5DFDE] rounded-xl bg-[#F8F5F5] p-3 flex justify-center">
                <div className="origin-top scale-[0.78] sm:scale-[0.85] -mb-12">
                  <CartaoLote
                    lote={loteEncontrado}
                    logo="/logo.png"
                    nomeConsultorio={nomeConsultorio}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopiarTextoEImg}
                  disabled={processandoExport}
                  className="w-full py-2.5 px-4 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#CDA9A8]" />
                  <span>{processandoExport ? 'Processando...' : 'Copiar texto e imagem para prontuário'}</span>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopiarTexto}
                    className="py-2 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBaixarImg}
                    disabled={processandoExport}
                    className="py-2 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar imagem</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onReimprimir(loteEncontrado)}
                    className="py-2 px-3 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Reimprimir</span>
                  </button>
                </div>

                <a
                  href={`/${loteEncontrado.codigo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 border border-[#E5DFDE] bg-white hover:bg-[#F8F5F5] text-[#505859] text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#9E7372]" />
                  <span>Abrir página pública do cartão</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-2 text-[#7A8283]">
              <Search className="w-10 h-10 mx-auto text-[#CDA9A8]" />
              <p className="text-sm font-semibold text-[#3E4546]">Aguardando leitura de QR Code</p>
              <p className="text-xs text-[#7A8283] max-w-xs mx-auto">
                Os detalhes de esterilização, validade e o cartão exportável aparecerão aqui assim que o código for lido.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
