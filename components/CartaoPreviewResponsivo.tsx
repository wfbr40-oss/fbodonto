'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lote } from '@/lib/lote';
import CartaoLote from '@/components/CartaoLote';

type CartaoPreviewResponsivoProps = {
  lote: Lote;
  nomeConsultorio: string;
  exportId?: string;
};

export default function CartaoPreviewResponsivo({
  lote,
  nomeConsultorio,
  exportId,
}: CartaoPreviewResponsivoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);
  const [alturaCard, setAlturaCard] = useState(340);

  useEffect(() => {
    const atualizar = () => {
      if (!containerRef.current) return;
      const larguraDisponivel = containerRef.current.clientWidth;
      if (larguraDisponivel > 0) {
        setEscala(Math.min(1, larguraDisponivel / 600));
      }
      if (cardRef.current) {
        setAlturaCard(cardRef.current.offsetHeight);
      }
    };

    const rafId = requestAnimationFrame(atualizar);
    const ro = new ResizeObserver(atualizar);
    if (containerRef.current) ro.observe(containerRef.current);
    if (cardRef.current) ro.observe(cardRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [lote.codigo, lote.item]);

  return (
    <div ref={containerRef} className="w-full flex justify-center overflow-hidden">
      <div
        style={{
          width: `${Math.round(600 * escala)}px`,
          height: `${Math.round(alturaCard * escala)}px`,
        }}
        className="relative shrink-0"
      >
        <div
          ref={cardRef}
          style={{
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
          }}
          className="w-[600px]"
        >
          <CartaoLote
            lote={lote}
            logo="/logo.png"
            nomeConsultorio={nomeConsultorio}
            exportId={exportId}
          />
        </div>
      </div>
    </div>
  );
}
