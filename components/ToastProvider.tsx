'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, Printer, X } from 'lucide-react';

export type ToastTipo = 'aviso' | 'sucesso' | 'erro' | 'instrucoes';

export type ToastOptions = {
  titulo?: string;
  mensagem: string | string[];
  tipo?: ToastTipo;
  duracaoMs?: number;
  idUnico?: string;
};

type ToastItem = {
  id: string;
  titulo?: string;
  mensagem: string | string[];
  tipo: ToastTipo;
  duracaoMs: number;
};

type ToastContextValue = {
  mostrarPopup: (opts: ToastOptions) => void;
  removerPopup: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser utilizado dentro de ToastProvider');
  }
  return ctx;
}

function duracaoPadraoPorTipo(tipo: ToastTipo): number {
  switch (tipo) {
    case 'erro':
      return 10000;
    case 'instrucoes':
      return 15000;
    case 'sucesso':
    case 'aviso':
    default:
      return 5000;
  }
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removerPopup = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mostrarPopup = useCallback(
    (opts: ToastOptions) => {
      const tipo: ToastTipo = opts.tipo || 'aviso';
      const duracaoMs = opts.duracaoMs ?? duracaoPadraoPorTipo(tipo);
      const id = opts.idUnico || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const existingTimer = timersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        timersRef.current.delete(id);
      }

      setToasts((prev) => {
        const semDuplicado = prev.filter((t) => t.id !== id);
        return [
          ...semDuplicado,
          {
            id,
            titulo: opts.titulo,
            mensagem: opts.mensagem,
            tipo,
            duracaoMs,
          },
        ];
      });

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duracaoMs);

      timersRef.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ mostrarPopup, removerPopup }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[400px] z-[60] flex flex-col gap-2.5 pointer-events-none no-print"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const estilos =
              t.tipo === 'erro'
                ? 'bg-[#FDF5F5] border-[#E4B8B8] text-[#7D2E2E]'
                : t.tipo === 'sucesso'
                ? 'bg-[#F2F9F4] border-[#BDDCC7] text-[#28563D]'
                : t.tipo === 'instrucoes'
                ? 'bg-[#FCFBFB] border-[#CDA9A8] text-[#3E4546]'
                : 'bg-[#FCFBFB] border-[#DCD4D3] text-[#505859]';

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                onClick={() => removerPopup(t.id)}
                role="alert"
                title="Clique para fechar"
                className={`pointer-events-auto cursor-pointer rounded-xl border shadow-lg p-4 transition-colors ${estilos}`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {t.tipo === 'erro' ? (
                      <AlertCircle className="w-5 h-5 text-[#B44444]" />
                    ) : t.tipo === 'sucesso' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#2E6045]" />
                    ) : t.tipo === 'instrucoes' ? (
                      <Printer className="w-5 h-5 text-[#9E7372]" />
                    ) : (
                      <Info className="w-5 h-5 text-[#9E7372]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-xs leading-relaxed">
                    {t.titulo && (
                      <div className="font-bold uppercase tracking-wider text-[11px] mb-1">
                        {t.titulo}
                      </div>
                    )}

                    {Array.isArray(t.mensagem) ? (
                      <ul className="space-y-1 list-disc list-inside opacity-90">
                        {t.mensagem.map((linha, idx) => (
                          <li key={idx}>{linha}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-medium">{t.mensagem}</p>
                    )}

                    {t.tipo === 'erro' && (
                      <span className="block mt-1.5 text-[10px] opacity-70">
                        Clique neste aviso para fechar
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label="Fechar notificação"
                    onClick={(e) => {
                      e.stopPropagation();
                      removerPopup(t.id);
                    }}
                    className="shrink-0 p-1 -m-1 rounded-md opacity-60 hover:opacity-100 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
