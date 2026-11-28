'use client';

import React, { useLayoutEffect, useRef } from 'react';
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const atualizar = () => {
      const container = containerRef.current;
      const frame = frameRef.current;
      const card = cardRef.current;
      if (!container || !frame || !card) return;

      const larguraDisponivel = container.clientWidth;
      const escala = larguraDisponivel > 0 ? Math.min(1, larguraDisponivel / 600) : 1;
      const alturaCard = card.offsetHeight;

      frame.style.width = `${Math.round(600 * escala)}px`;
      frame.style.height = `${Math.round(alturaCard * escala)}px`;
      card.style.transform = `scale(${escala})`;
      container.style.opacity = '1';
    };

    atualizar();
    const ro = new ResizeObserver(atualizar);
    if (containerRef.current) ro.observe(containerRef.current);
    if (cardRef.current) ro.observe(cardRef.current);

    return () => {
      ro.disconnect();
    };
  }, [lote.codigo, lote.item]);

  return (
    <div
      ref={containerRef}
      style={{ opacity: 0 }}
      className="w-full flex justify-center overflow-hidden"
    >
      <div
        ref={frameRef}
        style={{
          width: '600px',
          height: '340px',
        }}
        className="relative shrink-0"
      >
        <div
          ref={cardRef}
          style={{
            transform: 'scale(1)',
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
