'use client';

import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full px-3.5 py-2.5 text-sm font-semibold text-[#3E4546] hover:bg-[#F3ECEB] border border-[#DCD4D3] bg-white rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
      >
        <Download className="w-4 h-4 text-[#9E7372] shrink-0" />
        <span>Instalar Aplicativo</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full px-3.5 py-2.5 text-sm font-semibold text-[#3E4546] hover:bg-[#F3ECEB] border border-[#DCD4D3] bg-white rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-[#9E7372] shrink-0" />
          <span>Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#3E4546]/50 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-[#FCFBFB] border border-[#E5DFDE] p-6 shadow-xl text-[#505859]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-base font-bold text-[#3E4546]">Instalar no iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções de instalação"
                  className="p-1 rounded-lg text-[#7A8283] hover:bg-[#F3ECEB] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-[#6E7677] list-decimal list-inside">
                <li>
                  Toque no botão{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-[#3E4546]">
                    Compartilhar <Share className="w-3.5 h-3.5 text-[#9E7372]" />
                  </span>{' '}
                  na barra do Safari.
                </li>
                <li>
                  Role para baixo e toque em{' '}
                  <strong className="text-[#3E4546]">Adicionar à Tela de Início</strong>.
                </li>
                <li>
                  Toque em <strong className="text-[#3E4546]">Adicionar</strong> para abrir sem barra de endereço.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#505859] hover:bg-[#3E4546] py-2.5 text-sm font-semibold text-white transition cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
