'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import {
  Lote,
  TurnoLote,
  hojeISO,
  addDias,
  formatDataBR,
  prefixoDia,
  proximoCodigo,
  codigoPorTurno,
} from '@/lib/lote';
import {
  CargoUsuario,
  criarLote,
  listarRecentes,
  login,
  logout,
  obterSessaoUsuario,
  configurarAdminInicial,
  cadastrarUsuario,
  atualizarUsuario,
  excluirUsuario,
  listarUsuarios,
  carregarConfigNuvem,
  salvarConfigNuvem,
  UsuarioRegistrado,
} from '@/lib/db';
import { carregarConfig, Config, RegraNumeracao } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase';
import Etiqueta from '@/components/Etiqueta';
import LeitorQrCode from '@/components/LeitorQrCode';
import ModalCartaoLote from '@/components/ModalCartaoLote';
import PWAInstallButton from '@/components/PWAInstallButton';
import { useToast } from '@/components/ToastProvider';
import {
  Menu,
  X,
  Printer,
  LogOut,
  LogIn,
  PlusCircle,
  ScanLine,
  Settings,
  UserPlus,
  User,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Shield,
  ExternalLink,
  Check,
  ArrowLeft,
} from 'lucide-react';

type AbaPrincipal = 'novo' | 'qrcode' | 'config';
type SubAbaLote = 'cadastro' | 'historico';
type SubAbaConfig = 'geral' | 'usuarios';

const ORDEM_ABAS: Record<AbaPrincipal, number> = {
  novo: 0,
  qrcode: 1,
  config: 2,
};

const ABAS_EM_ORDEM: AbaPrincipal[] = ['novo', 'qrcode', 'config'];

const subTabSlideVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 52 : -52,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -52 : 52,
  }),
};

const mainTabSlideVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? 48 : -48,
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? -48 : 48,
  }),
};

const LABEL_CARGO: Record<CargoUsuario, string> = {
  administrador: 'Administrador',
  usuario: 'Usuário',
  cliente: 'Cliente',
};

export default function CadastroPage() {
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [adminConfigured, setAdminConfigured] = useState<boolean>(true);
  const [usuarioConectado, setUsuarioConectado] = useState<string>('');
  const [usuarioLoginAtual, setUsuarioLoginAtual] = useState<string>('');
  const [cargoUsuario, setCargoUsuario] = useState<CargoUsuario>('usuario');
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(true);
  const [popupClienteAberto, setPopupClienteAberto] = useState<boolean>(false);
  const [modoClienteVisitante, setModoClienteVisitante] = useState<boolean>(false);

  const [usuario, setUsuario] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('fbodonto_ultimo_usuario') || '';
    } catch {
      return '';
    }
  });
  const [senha, setSenha] = useState('');
  const [setupUsuario, setSetupUsuario] = useState('admin');
  const [setupSenha, setSetupSenha] = useState('');

  const [config, setConfig] = useState<Config>(carregarConfig());
  const [diasValidadeConfigInput, setDiasValidadeConfigInput] = useState<string>(() =>
    String(carregarConfig().diasValidade)
  );
  const [configPronta, setConfigPronta] = useState<boolean>(false);
  const [configStorageMode, setConfigStorageMode] = useState<'supabase' | 'local'>('local');
  const [salvandoConfig, setSalvandoConfig] = useState<boolean>(false);
  const [abaAtiva, setAbaAtiva] = useState<AbaPrincipal>(() => {
    if (typeof window === 'undefined') return 'novo';
    try {
      const salva = localStorage.getItem('fbodonto_aba_ativa');
      if (salva === 'novo' || salva === 'qrcode' || salva === 'config') return salva;
    } catch {}
    return 'novo';
  });
  const [direcaoAba, setDirecaoAba] = useState<1 | -1>(1);
  const [dragMainY, setDragMainY] = useState<number>(0);
  const [subAbaLote, setSubAbaLote] = useState<SubAbaLote>('cadastro');
  const [direcaoSubLote, setDirecaoSubLote] = useState<1 | -1>(1);
  const [dragSubLoteX, setDragSubLoteX] = useState<number>(0);
  const [subAbaConfig, setSubAbaConfig] = useState<SubAbaConfig>('geral');
  const [direcaoSubConfig, setDirecaoSubConfig] = useState<1 | -1>(1);
  const [dragSubConfigX, setDragSubConfigX] = useState<number>(0);

  const [sidebarDesktop, setSidebarDesktop] = useState<boolean>(true);
  const [sidebarMobile, setSidebarMobile] = useState<boolean>(false);

  const [item, setItem] = useState('');
  const [esterilizacao, setEsterilizacao] = useState(hojeISO());
  const [diasValidade, setDiasValidade] = useState<number>(config.diasValidade);
  const [diasValidadeInput, setDiasValidadeInput] = useState<string>(() =>
    String(config.diasValidade)
  );
  const [responsavel, setResponsavel] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [quantidadeInput, setQuantidadeInput] = useState<string>('1');
  const [turnoSelecionado] = useState<TurnoLote>('auto');

  const validade = addDias(esterilizacao, diasValidade);

  const [historico, setHistorico] = useState<Lote[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState<boolean>(false);

  const [loteCriado, setLoteCriado] = useState<Lote | null>(null);
  const [popupImpressaoAberto, setPopupImpressaoAberto] = useState<boolean>(false);
  const [origemImpressao, setOrigemImpressao] = useState<'cadastro' | 'reimpressao'>('cadastro');
  const [loteModal, setLoteModal] = useState<Lote | null>(null);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Cadastro e gerenciamento de usuários (Configurações -> Usuários)
  const [novoUsuario, setNovoUsuario] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoUsuario>('usuario');
  const [novaSenha, setNovaSenha] = useState('1234');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [cadastrandoUsuario, setCadastrandoUsuario] = useState(false);
  const [usuariosLista, setUsuariosLista] = useState<UsuarioRegistrado[]>([]);
  const [userStorageMode, setUserStorageMode] = useState<'supabase' | 'local'>('local');

  const [usuarioEditando, setUsuarioEditando] = useState<string | null>(null);
  const [editLogin, setEditLogin] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editCargo, setEditCargo] = useState<CargoUsuario>('usuario');
  const [editNovaSenha, setEditNovaSenha] = useState('');
  const [mostrarEditSenha, setMostrarEditSenha] = useState(false);
  const [salvandoEdicaoUsuario, setSalvandoEdicaoUsuario] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [excluindoUsuario, setExcluindoUsuario] = useState<string | null>(null);

  const ehAdmin = cargoUsuario === 'administrador';
  const ehCliente = cargoUsuario === 'cliente';

  const { mostrarPopup } = useToast();
  const autenticadoRef = useRef(false);
  const instrucoesMostradasRef = useRef(false);
  const avisoLocalMostradoRef = useRef(false);
  const avisoSetupMostradoRef = useRef(false);
  const avisoTabelaConfigMostradoRef = useRef(false);
  const avisoTabelaUsersMostradoRef = useRef(false);
  const touchSwipeRef = useRef<{
    x: number;
    y: number;
    scrollY: number;
    time: number;
    ignorar: boolean;
    bloqueadoDirecao?: 'h' | 'v';
  } | null>(null);
  const fecharMenuAposTransicaoRef = useRef<boolean>(false);
  const pendingMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pref = prefixoDia(esterilizacao);
  const lotesDoDia = historico.filter((l) => l.codigo.startsWith(pref));
  const ultimo = lotesDoDia.length > 0 ? lotesDoDia[0].codigo : null;
  const turnoCalculado =
    config.regraNumeracao === 'turno_manha_tarde'
      ? codigoPorTurno(pref, turnoSelecionado, config.horaCorteTarde)
      : null;
  const proximoCodPrevisto = turnoCalculado
    ? turnoCalculado.codigo
    : proximoCodigo(pref, ultimo) || `${pref}01`;

  const carregarDadosHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    const rec = await listarRecentes();
    setHistorico(rec);
    setCarregandoHistorico(false);
  }, []);

  const carregarUsuarios = useCallback(async () => {
    const { usuarios, storageMode } = await listarUsuarios();
    setUsuariosLista(usuarios);
    setUserStorageMode(storageMode);
  }, []);

  const sincronizarSessao = useCallback(
    async (silencioso = false) => {
      const estavaAutenticado = autenticadoRef.current;
      const {
        autenticado: ok,
        usuario: nome,
        usuarioLogin,
        role,
        adminConfigured: configured,
        storageMode,
      } = await obterSessaoUsuario();

      autenticadoRef.current = ok;
      setAutenticado(ok);
      setAdminConfigured(configured);
      setUserStorageMode(storageMode);
      setUsuarioConectado(nome || '');
      setUsuarioLoginAtual(usuarioLogin || '');
      const cargoAtual: CargoUsuario = role || 'usuario';
      setCargoUsuario(cargoAtual);

      if (ok && usuarioLogin) {
        setModoClienteVisitante(false);
        setPopupClienteAberto(false);
        try {
          localStorage.setItem('fbodonto_ultimo_usuario', usuarioLogin);
        } catch {}
      } else if (!ok && estavaAutenticado) {
        setLoteModal(null);
        setPopupImpressaoAberto(false);
        setLoteCriado(null);
        setSidebarMobile(false);
        setPopupClienteAberto(false);
        setUsuariosLista([]);
        mostrarPopup({
          tipo: 'aviso',
          duracaoMs: 5000,
          mensagem: 'Seu acesso foi desconectado.',
        });
      }

      if (!silencioso) {
        setCarregandoAuth(false);
      }

      if (ok) {
        if (cargoAtual !== 'cliente') {
          carregarDadosHistorico();
        }
        if (cargoAtual === 'administrador') {
          carregarUsuarios();
        } else {
          setUsuariosLista([]);
          setSubAbaConfig('geral');
        }
      }
    },
    [carregarDadosHistorico, carregarUsuarios, mostrarPopup]
  );

  useEffect(() => {
    autenticadoRef.current = autenticado;
  }, [autenticado]);

  useEffect(() => {
    let ativo = true;
    carregarConfigNuvem().then(({ config: cfg, storageMode }) => {
      if (!ativo) return;
      setConfig(cfg);
      setDiasValidadeConfigInput(String(cfg.diasValidade));
      setDiasValidade(cfg.diasValidade);
      setDiasValidadeInput(String(cfg.diasValidade));
      setConfigStorageMode(storageMode);
      setConfigPronta(true);
    });

    const tempoMinimoSplash = new Promise<void>((resolve) => {
      setTimeout(resolve, 650);
    });

    Promise.all([obterSessaoUsuario(), tempoMinimoSplash])
      .then(([sessao]) => {
        if (!ativo) return;
        const cargoAtual: CargoUsuario = sessao.role || 'usuario';
        autenticadoRef.current = sessao.autenticado;
        setAutenticado(sessao.autenticado);
        setAdminConfigured(sessao.adminConfigured);
        setUserStorageMode(sessao.storageMode);
        setUsuarioConectado(sessao.usuario || '');
        setUsuarioLoginAtual(sessao.usuarioLogin || '');
        setCargoUsuario(cargoAtual);

        if (sessao.autenticado && sessao.usuarioLogin) {
          setPopupClienteAberto(false);
          setModoClienteVisitante(false);
          try {
            localStorage.setItem('fbodonto_ultimo_usuario', sessao.usuarioLogin);
          } catch {}
        } else if (!sessao.autenticado && sessao.adminConfigured) {
          setPopupClienteAberto(true);
        }

        if (sessao.autenticado) {
          if (cargoAtual !== 'cliente') {
            void listarRecentes().then((rec) => {
              if (ativo) setHistorico(rec);
            });
          }
          if (cargoAtual === 'administrador') {
            void listarUsuarios().then(({ usuarios, storageMode }) => {
              if (ativo) {
                setUsuariosLista(usuarios);
                setUserStorageMode(storageMode);
              }
            });
          }
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregandoAuth(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const aoRetornarAoApp = () => {
      if (document.visibilityState === 'visible') {
        void sincronizarSessao(true);
      }
    };
    const aoReexibirPagina = () => {
      void sincronizarSessao(true);
    };
    document.addEventListener('visibilitychange', aoRetornarAoApp);
    window.addEventListener('pageshow', aoReexibirPagina);

    const intervalId = setInterval(() => {
      if (autenticadoRef.current && document.visibilityState === 'visible') {
        void sincronizarSessao(true);
      }
    }, 20000);

    return () => {
      document.removeEventListener('visibilitychange', aoRetornarAoApp);
      window.removeEventListener('pageshow', aoReexibirPagina);
      clearInterval(intervalId);
    };
  }, [sincronizarSessao]);

  useEffect(() => {
    if (!popupClienteAberto) return;
    const aoPressionarEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopupClienteAberto(false);
      }
    };
    window.addEventListener('keydown', aoPressionarEsc);
    return () => window.removeEventListener('keydown', aoPressionarEsc);
  }, [popupClienteAberto]);

  useEffect(() => {
    if (!popupImpressaoAberto) return;
    const aoPressionarEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loteModal) {
        setPopupImpressaoAberto(false);
      }
    };
    window.addEventListener('keydown', aoPressionarEsc);
    return () => window.removeEventListener('keydown', aoPressionarEsc);
  }, [popupImpressaoAberto, loteModal]);

  useEffect(() => {
    if (carregandoAuth) return;

    if (!isSupabaseConfigured && !avisoLocalMostradoRef.current) {
      avisoLocalMostradoRef.current = true;
      mostrarPopup({
        idUnico: 'aviso-modo-local',
        tipo: 'aviso',
        duracaoMs: 5000,
        titulo: 'Armazenamento Local',
        mensagem:
          'Variáveis do Supabase não configuradas. Os dados estão sendo salvos localmente no navegador.',
      });
    }

    if (!autenticado && !adminConfigured && !avisoSetupMostradoRef.current) {
      avisoSetupMostradoRef.current = true;
      mostrarPopup({
        idUnico: 'aviso-primeiro-acesso',
        tipo: 'aviso',
        duracaoMs: 5000,
        titulo: 'Primeiro Acesso',
        mensagem: 'Defina a senha inicial do usuário administrador para ativar o sistema.',
      });
    }
  }, [carregandoAuth, autenticado, adminConfigured, mostrarPopup]);

  useEffect(() => {
    if (!autenticado || ehCliente || !configPronta || instrucoesMostradasRef.current) return;
    try {
      const jaViu = localStorage.getItem('fbodonto_instrucoes_impressao_vistas');
      if (!jaViu) {
        instrucoesMostradasRef.current = true;
        localStorage.setItem('fbodonto_instrucoes_impressao_vistas', '1');
        mostrarPopup({
          idUnico: 'instrucoes-impressao',
          tipo: 'instrucoes',
          duracaoMs: 15000,
          titulo: 'Instruções de Impressão',
          mensagem: [
            'Configure a impressora térmica ou comum para 100% de escala (sem "ajustar à página").',
            `Dimensões atuais: ${config.larguraMm}mm × ${config.alturaMm}mm.`,
            'O código do lote serve como link curto para leitura via QR Code.',
          ],
        });
      }
    } catch {
      // ignora erro de localStorage
    }
  }, [autenticado, ehCliente, configPronta, config.larguraMm, config.alturaMm, mostrarPopup]);

  useEffect(() => {
    if (!autenticado || ehCliente || abaAtiva !== 'config' || !isSupabaseConfigured) return;

    if (
      subAbaConfig === 'geral' &&
      configPronta &&
      configStorageMode === 'local' &&
      !avisoTabelaConfigMostradoRef.current
    ) {
      avisoTabelaConfigMostradoRef.current = true;
      mostrarPopup({
        idUnico: 'aviso-tabela-config',
        tipo: 'aviso',
        duracaoMs: 5000,
        titulo: 'Atenção',
        mensagem:
          'A tabela configuracoes ainda não foi criada no Supabase. Execute supabase/schema.sql no SQL Editor para salvar na nuvem.',
      });
    }

    if (
      ehAdmin &&
      subAbaConfig === 'usuarios' &&
      userStorageMode === 'local' &&
      !avisoTabelaUsersMostradoRef.current
    ) {
      avisoTabelaUsersMostradoRef.current = true;
      mostrarPopup({
        idUnico: 'aviso-tabela-usuarios',
        tipo: 'aviso',
        duracaoMs: 5000,
        titulo: 'Atenção',
        mensagem:
          'A tabela usuarios ainda não foi criada no Supabase. Execute supabase/schema.sql no SQL Editor para salvar na nuvem.',
      });
    }
  }, [
    autenticado,
    ehCliente,
    ehAdmin,
    abaAtiva,
    subAbaConfig,
    configPronta,
    configStorageMode,
    userStorageMode,
    mostrarPopup,
  ]);

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await configurarAdminInicial(setupUsuario, setupSenha);
      try {
        localStorage.setItem('fbodonto_ultimo_usuario', res.usuarioLogin);
      } catch {}
      autenticadoRef.current = true;
      setAdminConfigured(true);
      setAutenticado(true);
      setUsuarioConectado(res.usuario);
      setUsuarioLoginAtual(res.usuarioLogin);
      setCargoUsuario(res.role);
      setPopupClienteAberto(false);
      setModoClienteVisitante(false);
      setSetupSenha('');
      carregarDadosHistorico();
      carregarUsuarios();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar acesso inicial';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await login(usuario, senha);
      try {
        localStorage.setItem('fbodonto_ultimo_usuario', res.usuarioLogin);
      } catch {}
      autenticadoRef.current = true;
      setAutenticado(true);
      setUsuarioConectado(res.usuario);
      setUsuarioLoginAtual(res.usuarioLogin);
      setCargoUsuario(res.role);
      setPopupClienteAberto(false);
      setModoClienteVisitante(false);
      setSenha('');
      if (res.role !== 'cliente') {
        carregarDadosHistorico();
      }
      if (res.role === 'administrador') {
        carregarUsuarios();
      } else {
        setUsuariosLista([]);
        setSubAbaConfig('geral');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    }
  };

  useEffect(() => {
    return () => {
      if (pendingMenuTimerRef.current) {
        clearTimeout(pendingMenuTimerRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    if (pendingMenuTimerRef.current) {
      clearTimeout(pendingMenuTimerRef.current);
      pendingMenuTimerRef.current = null;
    }
    fecharMenuAposTransicaoRef.current = false;
    await logout();
    autenticadoRef.current = false;
    setAutenticado(false);
    setUsuarioConectado('');
    setUsuarioLoginAtual('');
    setCargoUsuario('usuario');
    setUsuariosLista([]);
    setSenha('');
    setSidebarMobile(false);
    setPopupClienteAberto(false);
    setPopupImpressaoAberto(false);
    setModoClienteVisitante(false);
  };

  const handleToggleMenu = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarMobile((prev) => !prev);
    } else {
      setSidebarDesktop((prev) => !prev);
    }
  };

  const finalizarTransicaoAba = useCallback(() => {
    if (!fecharMenuAposTransicaoRef.current) return;
    fecharMenuAposTransicaoRef.current = false;
    if (pendingMenuTimerRef.current) {
      clearTimeout(pendingMenuTimerRef.current);
      pendingMenuTimerRef.current = null;
    }
    setSidebarMobile(false);
  }, []);

  const selecionarAba = (
    aba: AbaPrincipal,
    opcoes?: { fecharDepoisDaTransicao?: boolean }
  ) => {
    if (pendingMenuTimerRef.current) {
      clearTimeout(pendingMenuTimerRef.current);
      pendingMenuTimerRef.current = null;
    }

    const mudouAba = aba !== abaAtiva;
    if (mudouAba) {
      setDirecaoAba(ORDEM_ABAS[aba] >= ORDEM_ABAS[abaAtiva] ? 1 : -1);
    }
    setAbaAtiva(aba);
    try {
      localStorage.setItem('fbodonto_aba_ativa', aba);
    } catch {}
    if (aba !== 'novo') {
      setPopupImpressaoAberto(false);
    }
    setDragMainY(0);
    setDragSubLoteX(0);
    setDragSubConfigX(0);

    if (opcoes?.fecharDepoisDaTransicao && sidebarMobile && mudouAba) {
      fecharMenuAposTransicaoRef.current = true;
      pendingMenuTimerRef.current = setTimeout(() => {
        finalizarTransicaoAba();
      }, 340);
    } else {
      fecharMenuAposTransicaoRef.current = false;
      setSidebarMobile(false);
    }
  };

  const mudarSubAbaLote = (novaSub: SubAbaLote) => {
    if (novaSub !== subAbaLote) {
      setDirecaoSubLote(novaSub === 'historico' ? 1 : -1);
    }
    setDragSubLoteX(0);
    setSubAbaLote(novaSub);
  };

  const mudarSubAbaConfig = (novaSub: SubAbaConfig) => {
    if (novaSub === 'usuarios' && !ehAdmin) return;
    if (novaSub !== subAbaConfig) {
      setDirecaoSubConfig(novaSub === 'usuarios' ? 1 : -1);
    }
    setDragSubConfigX(0);
    setSubAbaConfig(novaSub);
  };

  const podeRolarVerticalmente = (
    alvo: HTMLElement | null,
    deltaY: number,
    limite: HTMLElement
  ): boolean => {
    let atual: HTMLElement | null = alvo;
    while (atual && atual !== limite) {
      if (atual.scrollHeight > atual.clientHeight + 4) {
        const overflowY = window.getComputedStyle(atual).overflowY;
        if (atual.tagName === 'TEXTAREA' || overflowY === 'auto' || overflowY === 'scroll') {
          if (deltaY < 0 && atual.scrollTop + atual.clientHeight < atual.scrollHeight - 2) {
            return true;
          }
          if (deltaY > 0 && atual.scrollTop > 2) {
            return true;
          }
        }
      }
      atual = atual.parentElement;
    }
    return false;
  };

  const desfocarCampoAtivo = () => {
    const ativo = document.activeElement as HTMLElement | null;
    if (ativo && typeof ativo.blur === 'function') {
      ativo.blur();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || loteModal || popupImpressaoAberto) {
      touchSwipeRef.current = null;
      return;
    }

    const alvo = e.target as HTMLElement | null;
    let ignorar = false;

    if (alvo) {
      if (alvo.closest('[role="dialog"], [aria-modal="true"], [data-no-swipe]')) {
        ignorar = true;
      } else {
        let atual: HTMLElement | null = alvo;
        while (atual && atual !== e.currentTarget) {
          if (
            atual.tagName !== 'INPUT' &&
            atual.scrollWidth > atual.clientWidth + 4
          ) {
            const overflowX = window.getComputedStyle(atual).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') {
              ignorar = true;
              break;
            }
          }
          atual = atual.parentElement;
        }
      }
    }

    const toque = e.touches[0];
    touchSwipeRef.current = {
      x: toque.clientX,
      y: toque.clientY,
      scrollY: window.scrollY,
      time: Date.now(),
      ignorar,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const inicio = touchSwipeRef.current;
    if (!inicio || inicio.ignorar || ehCliente || loteModal || sidebarMobile || e.touches.length !== 1) {
      return;
    }

    const toque = e.touches[0];
    const deltaX = toque.clientX - inicio.x;
    const deltaY = toque.clientY - inicio.y;

    if (!inicio.bloqueadoDirecao && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      inicio.bloqueadoDirecao = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? 'h' : 'v';
    }

    if (inicio.bloqueadoDirecao === 'h') {
      if (dragMainY !== 0) setDragMainY(0);

      if (abaAtiva === 'novo') {
        if (subAbaLote === 'cadastro') {
          if (deltaX < 0) {
            setDragSubLoteX(Math.max(-96, deltaX * 0.45));
          } else {
            setDragSubLoteX(Math.min(36, deltaX * 0.18));
          }
        } else if (subAbaLote === 'historico' && deltaX > 0) {
          setDragSubLoteX(Math.min(96, deltaX * 0.45));
        }
      } else if (abaAtiva === 'config') {
        if (subAbaConfig === 'geral') {
          if (deltaX < 0 && ehAdmin) {
            setDragSubConfigX(Math.max(-96, deltaX * 0.45));
          } else if (deltaX > 0) {
            setDragSubConfigX(Math.min(36, deltaX * 0.18));
          }
        } else if (subAbaConfig === 'usuarios' && deltaX > 0) {
          setDragSubConfigX(Math.min(96, deltaX * 0.45));
        }
      }
      return;
    }

    if (inicio.bloqueadoDirecao === 'v') {
      if (dragSubLoteX !== 0) setDragSubLoteX(0);
      if (dragSubConfigX !== 0) setDragSubConfigX(0);

      if (Math.abs(window.scrollY - inicio.scrollY) >= 2) {
        if (dragMainY !== 0) setDragMainY(0);
        return;
      }

      if (podeRolarVerticalmente(e.target as HTMLElement | null, deltaY, e.currentTarget)) {
        if (dragMainY !== 0) setDragMainY(0);
        return;
      }

      const indiceAtual = ORDEM_ABAS[abaAtiva];
      const noTopo = window.scrollY <= 8;
      const noFim =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 16;

      if (deltaY < 0 && noFim && indiceAtual < ABAS_EM_ORDEM.length - 1) {
        setDragMainY(Math.max(-72, deltaY * 0.35));
      } else if (deltaY > 0 && noTopo && indiceAtual > 0) {
        setDragMainY(Math.min(72, deltaY * 0.35));
      } else if (dragMainY !== 0) {
        setDragMainY(0);
      }
    }
  };

  const abrirMenuPorDeslize = () => {
    if (ehCliente) return;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarMobile(true);
    } else {
      setSidebarDesktop(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const inicio = touchSwipeRef.current;
    touchSwipeRef.current = null;
    setDragMainY(0);
    setDragSubLoteX(0);
    setDragSubConfigX(0);

    if (!inicio || inicio.ignorar || ehCliente || loteModal || popupImpressaoAberto || e.changedTouches.length !== 1) {
      return;
    }

    const toque = e.changedTouches[0];
    const deltaX = toque.clientX - inicio.x;
    const deltaY = toque.clientY - inicio.y;
    const duracao = Date.now() - inicio.time;

    if (duracao > 650) {
      return;
    }

    const ehSwipeHorizontal =
      Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (ehSwipeHorizontal) {
      if (sidebarMobile) {
        if (deltaX < 0) {
          setSidebarMobile(false);
        }
        return;
      }

      if (abaAtiva === 'novo') {
        if (subAbaLote === 'cadastro') {
          if (deltaX < 0) {
            desfocarCampoAtivo();
            mudarSubAbaLote('historico');
          } else if (deltaX > 0) {
            desfocarCampoAtivo();
            abrirMenuPorDeslize();
          }
        } else if (subAbaLote === 'historico' && deltaX > 0) {
          mudarSubAbaLote('cadastro');
        }
        return;
      }

      if (abaAtiva === 'qrcode') {
        if (deltaX > 0) {
          desfocarCampoAtivo();
          abrirMenuPorDeslize();
        }
        return;
      }

      if (abaAtiva === 'config') {
        if (subAbaConfig === 'geral') {
          if (deltaX < 0 && ehAdmin) {
            desfocarCampoAtivo();
            mudarSubAbaConfig('usuarios');
          } else if (deltaX > 0) {
            desfocarCampoAtivo();
            abrirMenuPorDeslize();
          }
        } else if (subAbaConfig === 'usuarios' && deltaX > 0) {
          desfocarCampoAtivo();
          mudarSubAbaConfig('geral');
        }
      }
      return;
    }

    const ehSwipeVertical =
      !sidebarMobile &&
      Math.abs(deltaY) >= 60 &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.35 &&
      Math.abs(window.scrollY - inicio.scrollY) < 6;

    if (!ehSwipeVertical) {
      return;
    }

    if (podeRolarVerticalmente(e.target as HTMLElement | null, deltaY, e.currentTarget)) {
      return;
    }

    const indiceAtual = ORDEM_ABAS[abaAtiva];
    const noTopo = window.scrollY <= 8;
    const noFim =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 16;

    if (deltaY < 0 && noFim && indiceAtual < ABAS_EM_ORDEM.length - 1) {
      desfocarCampoAtivo();
      selecionarAba(ABAS_EM_ORDEM[indiceAtual + 1]);
    } else if (deltaY > 0 && noTopo && indiceAtual > 0) {
      desfocarCampoAtivo();
      selecionarAba(ABAS_EM_ORDEM[indiceAtual - 1]);
    }
  };

  const handleTouchCancel = () => {
    touchSwipeRef.current = null;
    setDragMainY(0);
    setDragSubLoteX(0);
    setDragSubConfigX(0);
  };

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);
    try {
      let configParaSalvar: Config;
      if (ehAdmin) {
        const parsedDias = parseInt(diasValidadeConfigInput, 10);
        const diasSanitizado = isNaN(parsedDias) || parsedDias < 1 ? 1 : Math.min(365, parsedDias);
        configParaSalvar = { ...config, diasValidade: diasSanitizado };
      } else {
        const { config: baseAtual } = await carregarConfigNuvem();
        configParaSalvar = {
          ...baseAtual,
          larguraMm: config.larguraMm,
          alturaMm: config.alturaMm,
        };
      }
      const { config: salva, storageMode } = await salvarConfigNuvem(configParaSalvar);
      setConfig(salva);
      setDiasValidadeConfigInput(String(salva.diasValidade));
      setDiasValidade(salva.diasValidade);
      setDiasValidadeInput(String(salva.diasValidade));
      setConfigStorageMode(storageMode);
      mostrarPopup({
        tipo: storageMode === 'supabase' ? 'sucesso' : 'aviso',
        duracaoMs: 5000,
        mensagem:
          storageMode === 'supabase'
            ? 'Configurações salvas no Supabase com sucesso.'
            : 'Configurações salvas localmente. Execute supabase/schema.sql para sincronizar na nuvem.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setSalvandoConfig(false);
    }
  };

  const handleCadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadastrandoUsuario(true);

    try {
      const res = await cadastrarUsuario({
        usuario: novoUsuario,
        nome: novoNome,
        senha: novaSenha,
        role: novoCargo,
      });

      const { usuarios, storageMode } = await listarUsuarios();
      setUsuariosLista(usuarios);
      setUserStorageMode(storageMode);
      setNovoUsuario('');
      setNovoNome('');
      setNovoCargo('usuario');
      setNovaSenha('1234');

      mostrarPopup({
        tipo: 'sucesso',
        duracaoMs: 5000,
        mensagem: `Usuário "${res.usuario.usuario}" (${LABEL_CARGO[res.usuario.role]}) cadastrado com sucesso!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar usuário.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setCadastrandoUsuario(false);
    }
  };

  const iniciarEdicaoUsuario = (u: UsuarioRegistrado) => {
    setConfirmandoExclusao(null);
    setUsuarioEditando(u.usuario);
    setEditLogin(u.usuario);
    setEditNome(u.nome);
    setEditCargo(u.role);
    setEditNovaSenha('');
    setMostrarEditSenha(false);
  };

  const cancelarEdicaoUsuario = () => {
    setUsuarioEditando(null);
    setEditLogin('');
    setEditNome('');
    setEditCargo('usuario');
    setEditNovaSenha('');
    setMostrarEditSenha(false);
  };

  const handleSalvarEdicaoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;
    setSalvandoEdicaoUsuario(true);

    try {
      const res = await atualizarUsuario({
        usuarioAtual: usuarioEditando,
        novoUsuario: editLogin,
        nome: editNome,
        role: editCargo,
        novaSenha: editNovaSenha.trim() || undefined,
      });

      const editouPropriaConta = usuarioEditando === usuarioLoginAtual;
      cancelarEdicaoUsuario();
      await carregarUsuarios();

      if (editouPropriaConta && res.credentialsChanged) {
        mostrarPopup({
          tipo: 'aviso',
          duracaoMs: 5000,
          mensagem: 'Suas credenciais foram alteradas. Faça login novamente com os novos dados.',
        });
        await sincronizarSessao(true);
        return;
      }

      if (editouPropriaConta) {
        setUsuarioConectado(res.usuario.nome);
        setUsuarioLoginAtual(res.usuario.usuario);
      }

      mostrarPopup({
        tipo: 'sucesso',
        duracaoMs: 5000,
        mensagem: res.credentialsChanged
          ? `Acesso de "${res.usuario.usuario}" atualizado. Sessões anteriores foram desconectadas.`
          : `Dados de "${res.usuario.usuario}" atualizados com sucesso.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar usuário.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setSalvandoEdicaoUsuario(false);
    }
  };

  const handleExcluirUsuario = async (usuarioAlvo: string) => {
    setExcluindoUsuario(usuarioAlvo);
    try {
      await excluirUsuario(usuarioAlvo);
      if (usuarioEditando === usuarioAlvo) {
        cancelarEdicaoUsuario();
      }
      setConfirmandoExclusao(null);
      await carregarUsuarios();
      mostrarPopup({
        tipo: 'sucesso',
        duracaoMs: 5000,
        mensagem: `Login "${usuarioAlvo}" excluído e desconectado do sistema.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir login.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setExcluindoUsuario(null);
    }
  };

  const handleCadastrarLote = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedDias = parseInt(diasValidadeInput, 10);
    const diasValido = isNaN(parsedDias) || parsedDias < 1 ? 1 : Math.min(365, parsedDias);
    setDiasValidadeInput(String(diasValido));
    setDiasValidade(diasValido);
    const validadeCalculada = addDias(esterilizacao, diasValido);

    const parsedQtd = parseInt(quantidadeInput, 10);
    const qtdValida = isNaN(parsedQtd) || parsedQtd < 1 ? 1 : Math.min(60, parsedQtd);
    setQuantidadeInput(String(qtdValida));
    setQuantidade(qtdValida);

    if (validadeCalculada < esterilizacao) {
      mostrarPopup({
        tipo: 'erro',
        mensagem: 'A data de validade não pode ser anterior à data de esterilização.',
      });
      return;
    }

    setSalvando(true);
    try {
      const novo = await criarLote(
        {
          item: item.trim(),
          esterilizacao,
          validade: validadeCalculada,
          responsavel: responsavel.trim() || usuarioConectado || 'Equipe',
        },
        {
          regraNumeracao: config.regraNumeracao,
          turno: turnoSelecionado,
          horaCorteTarde: config.horaCorteTarde,
        }
      );
      setLoteCriado(novo);
      setOrigemImpressao('cadastro');
      setPopupImpressaoAberto(true);
      await carregarDadosHistorico();
      setItem('');
      mostrarPopup({
        tipo: 'sucesso',
        duracaoMs: 5000,
        mensagem: `Lote ${novo.codigo} cadastrado com sucesso!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar lote.';
      mostrarPopup({ tipo: 'erro', mensagem: msg });
    } finally {
      setSalvando(false);
    }
  };

  const tituloAbaAtual =
    abaAtiva === 'novo'
      ? 'Cadastrar Lote'
      : abaAtiva === 'qrcode'
      ? 'Ler QR Code'
      : 'Configurações';

  return (
    <AnimatePresence mode="wait">
      {carregandoAuth ? (
        <motion.div
          key="splash-abertura"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[100dvh] flex items-center justify-center bg-[#F6F4F3] p-6 overflow-hidden"
        >
          <div className="flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Logo FB Odonto"
              width={224}
              height={224}
              priority
              referrerPolicy="no-referrer"
              className="w-[200px] h-[200px] sm:w-[224px] sm:h-[224px] object-contain select-none"
            />
          </div>
        </motion.div>
      ) : !autenticado ? (
        modoClienteVisitante ? (
          <motion.div
            key="tela-cliente-visitante"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[100dvh] bg-[#F6F4F3] text-[#505859] flex flex-col overflow-x-clip"
          >
            <header className="bg-[#FCFBFB] border-b border-[#E5DFDE] sticky top-0 z-30 no-print">
              <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-10 h-10 shrink-0">
                    <Image
                      src="/logo.png"
                      alt="Logo FB Odonto"
                      width={40}
                      height={40}
                      priority
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 object-contain"
                    />
                  </span>
                  <h1 className="font-bold text-[#3E4546] leading-tight truncate whitespace-nowrap">
                    {config.nomeConsultorio}
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => setModoClienteVisitante(false)}
                  className="px-3 py-1.5 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#9E7372]" />
                  <span>Entrar no Sistema</span>
                </button>
              </div>
            </header>

            <main className="flex-1 min-w-0 max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
              <LeitorQrCode
                nomeConsultorio={config.nomeConsultorio}
                permitirReimpressao={false}
              />
            </main>
          </motion.div>
        ) : (
          <motion.main
            key="tela-login"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.985 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[100dvh] bg-[#F6F4F3] flex items-center justify-center p-4 sm:p-6 relative"
          >
            <div className="max-w-md w-full bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-sm p-8">
              <div className="text-center mb-7 pb-6 border-b border-[#EDE7E6]">
                <div className="flex justify-center mb-4">
                  <Image
                    src="/logo.png"
                    alt="Logo FB Odonto"
                    width={130}
                    height={130}
                    priority
                    referrerPolicy="no-referrer"
                    className="w-[130px] h-[130px] object-contain"
                  />
                </div>
                <h1 className="text-2xl font-bold text-[#3E4546] tracking-tight">{config.nomeConsultorio}</h1>
                <p className="text-sm text-[#7A8283] mt-1">Controle e Rastreabilidade de Esterilização</p>
              </div>

              {!adminConfigured ? (
                <form onSubmit={handleSetupAdmin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                      Usuário Administrador
                    </label>
                    <input
                      type="text"
                      value={setupUsuario}
                      onChange={(e) => setSetupUsuario(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/60 focus:border-[#B58988] text-[#3E4546]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                      Senha Inicial
                    </label>
                    <input
                      type="password"
                      value={setupSenha}
                      onChange={(e) => setSetupSenha(e.target.value)}
                      required
                      minLength={4}
                      className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/60 focus:border-[#B58988] text-[#3E4546]"
                      placeholder="Mínimo 4 caracteres (ex: admin)"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <LogIn className="w-5 h-5 text-[#CDA9A8]" />
                    <span>Ativar Acesso e Entrar</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">Usuário</label>
                      <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/60 focus:border-[#B58988] text-[#3E4546]"
                        placeholder="Ex: admin"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">Senha</label>
                      <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/60 focus:border-[#B58988] text-[#3E4546]"
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <LogIn className="w-5 h-5 text-[#CDA9A8]" />
                      <span>Entrar no Sistema</span>
                    </button>
                  </form>

                  <div className="pt-2 border-t border-[#EDE7E6]">
                    <button
                      type="button"
                      onClick={() => setPopupClienteAberto(true)}
                      className="w-full py-2.5 px-4 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ScanLine className="w-4 h-4 text-[#9E7372]" />
                      <span>Sou cliente</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {popupClienteAberto && adminConfigured && (
                <motion.div
                  key="popup-sou-cliente"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="titulo-sou-cliente"
                  onClick={() => setPopupClienteAberto(false)}
                  className="fixed inset-0 z-50 bg-[#3E4546]/55 backdrop-blur-[2px] flex items-center justify-center p-4"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-xl max-w-sm w-full p-6 text-center space-y-5 relative"
                  >
                    <button
                      type="button"
                      onClick={() => setPopupClienteAberto(false)}
                      aria-label="Fechar popup e ir para o login"
                      className="absolute top-3.5 right-3.5 p-1.5 text-[#7A8283] hover:text-[#3E4546] hover:bg-[#F4EFEF] rounded-lg transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="space-y-2 pt-1">
                      <div className="flex justify-center">
                        <Image
                          src="/logo.png"
                          alt="Logo FB Odonto"
                          width={72}
                          height={72}
                          referrerPolicy="no-referrer"
                          className="w-[72px] h-[72px] object-contain"
                        />
                      </div>
                      <h2
                        id="titulo-sou-cliente"
                        className="text-xl font-bold text-[#3E4546] tracking-tight"
                      >
                        Sou cliente
                      </h2>
                      <p className="text-xs text-[#7A8283]">
                        Consulte sua etiqueta de esterilização ou conheça nosso consultório.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPopupClienteAberto(false);
                          setModoClienteVisitante(true);
                        }}
                        className="w-full py-3 px-4 bg-[#505859] hover:bg-[#3E4546] text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ScanLine className="w-4 h-4 text-[#CDA9A8]" />
                        <span>Ler Qr Code</span>
                      </button>

                      <a
                        href="https://linktr.ee/drafabianabezerra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4 text-[#9E7372]" />
                        <span>Conhecer consultório</span>
                      </a>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.main>
        )
      ) : ehCliente ? (
        <motion.div
          key="tela-cliente-autenticado"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-[#F6F4F3] text-[#505859] flex flex-col overflow-x-clip"
        >
          <header className="bg-[#FCFBFB] border-b border-[#E5DFDE] sticky top-0 z-30 no-print">
            <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-10 h-10 shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Logo FB Odonto"
                    width={40}
                    height={40}
                    priority
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-contain"
                  />
                </span>
                <h1 className="font-bold text-[#3E4546] leading-tight truncate whitespace-nowrap">
                  {config.nomeConsultorio}
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline text-xs font-medium text-[#9E7372] whitespace-nowrap">
                  Leitor de QR Code
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold text-[#505859] hover:text-[#8C3B3B] hover:bg-[#F9EDED] border border-[#E5DFDE] bg-white rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0 max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
            <LeitorQrCode
              nomeConsultorio={config.nomeConsultorio}
              permitirReimpressao={false}
            />
          </main>
        </motion.div>
      ) : (
        <motion.div
          key="tela-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-[#F6F4F3] text-[#505859] flex flex-col overflow-x-clip"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
      <header className="bg-[#FCFBFB] border-b border-[#E5DFDE] sticky top-0 z-30 no-print">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleToggleMenu}
              aria-label="Abrir ou fechar menu lateral"
              className="p-2 -ml-1 rounded-lg text-[#505859] hover:bg-[#F3ECEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CDA9A8] transition cursor-pointer shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            <span className="inline-flex items-center justify-center w-10 h-10 shrink-0">
              <Image
                src="/logo.png"
                alt="Logo FB Odonto"
                width={40}
                height={40}
                priority
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain"
              />
            </span>

            <h1 className="font-bold text-[#3E4546] leading-tight truncate whitespace-nowrap">
              {config.nomeConsultorio}
            </h1>
          </div>

          <div className="text-xs sm:text-sm font-medium text-[#9E7372] whitespace-nowrap shrink-0">
            {tituloAbaAtual}
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        <AnimatePresence>
          {sidebarMobile && (
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={() => setSidebarMobile(false)}
              className="fixed inset-0 bg-[#3E4546]/35 z-40 lg:hidden no-print"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <aside
          className={`no-print fixed lg:sticky top-0 bottom-0 lg:top-16 lg:bottom-auto left-0 z-50 lg:z-20 h-[100dvh] lg:h-[calc(100dvh-4rem)] max-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0 w-64 bg-[#FCFBFB] border-r border-[#E5DFDE] flex flex-col justify-between overflow-y-auto transition-transform duration-200 ease-out shrink-0 ${
            sidebarMobile ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarDesktop ? 'lg:translate-x-0 lg:flex' : 'lg:-translate-x-full lg:hidden'}`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-16 border-b border-[#E5DFDE] lg:hidden shrink-0">
              <span className="font-bold text-[#3E4546] text-sm">Menu</span>
              <button
                type="button"
                onClick={() => setSidebarMobile(false)}
                aria-label="Fechar menu"
                className="p-2 rounded-lg text-[#505859] hover:bg-[#F3ECEB] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-4 space-y-1.5" aria-label="Navegação principal">
              <button
                type="button"
                onClick={() => selecionarAba('novo', { fecharDepoisDaTransicao: true })}
                className={`relative w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'novo'
                    ? 'text-[#3E4546]'
                    : 'text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                {abaAtiva === 'novo' && (
                  <motion.span
                    layoutId="sidebar-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-[#CDA9A8]/22 border border-[#CDA9A8]/50 rounded-lg"
                  />
                )}
                <PlusCircle
                  className={`relative z-10 w-4 h-4 shrink-0 transition-colors ${
                    abaAtiva === 'novo' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span className="relative z-10">Cadastrar Lote</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('qrcode', { fecharDepoisDaTransicao: true })}
                className={`relative w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'qrcode'
                    ? 'text-[#3E4546]'
                    : 'text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                {abaAtiva === 'qrcode' && (
                  <motion.span
                    layoutId="sidebar-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-[#CDA9A8]/22 border border-[#CDA9A8]/50 rounded-lg"
                  />
                )}
                <ScanLine
                  className={`relative z-10 w-4 h-4 shrink-0 transition-colors ${
                    abaAtiva === 'qrcode' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span className="relative z-10">Ler QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('config', { fecharDepoisDaTransicao: true })}
                className={`relative w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'config'
                    ? 'text-[#3E4546]'
                    : 'text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                {abaAtiva === 'config' && (
                  <motion.span
                    layoutId="sidebar-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-[#CDA9A8]/22 border border-[#CDA9A8]/50 rounded-lg"
                  />
                )}
                <Settings
                  className={`relative z-10 w-4 h-4 shrink-0 transition-colors ${
                    abaAtiva === 'config' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span className="relative z-10">Configurações</span>
              </button>
            </nav>
          </div>

          <div className="shrink-0 p-4 border-t border-[#E5DFDE] space-y-2.5 bg-[#F8F5F5]">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-9 h-9 rounded-full bg-white border border-[#DCD4D3] flex items-center justify-center text-[#9E7372] shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#7A8283] leading-tight">
                  {LABEL_CARGO[cargoUsuario]}
                </p>
                <p className="text-sm font-semibold text-[#3E4546] truncate">
                  {usuarioConectado || 'Usuário'}
                </p>
              </div>
            </div>

            <PWAInstallButton />

            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3.5 py-2.5 text-sm font-semibold text-[#505859] hover:text-[#8C3B3B] hover:bg-[#F9EDED] hover:border-[#E8C8C8] border border-[#E5DFDE] bg-white rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
          <div className="relative overflow-clip print:overflow-visible">
            <div
              style={{
                transform: dragMainY ? `translateY(${dragMainY}px)` : undefined,
                transition: dragMainY
                  ? 'none'
                  : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={direcaoAba}>
                {abaAtiva === 'novo' && (
                  <motion.div
                    key="aba-novo"
                    custom={direcaoAba}
                    variants={mainTabSlideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    onAnimationComplete={(definition) => {
                      if (definition === 'center') finalizarTransicaoAba();
                    }}
                    className="w-full space-y-6 touch-pan-y"
                  >
                <div className="flex items-center gap-1 p-1 bg-[#EDE7E6]/80 border border-[#E5DFDE] rounded-lg w-fit no-print">
                  <button
                    type="button"
                    onClick={() => mudarSubAbaLote('cadastro')}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      subAbaLote === 'cadastro'
                        ? 'text-[#3E4546]'
                        : 'text-[#6E7677] hover:text-[#3E4546]'
                    }`}
                  >
                    {subAbaLote === 'cadastro' && (
                      <motion.span
                        layoutId="subtab-lote-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#FCFBFB] rounded-md shadow-xs"
                      />
                    )}
                    <span className="relative z-10">Novo Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => mudarSubAbaLote('historico')}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      subAbaLote === 'historico'
                        ? 'text-[#3E4546]'
                        : 'text-[#6E7677] hover:text-[#3E4546]'
                    }`}
                  >
                    {subAbaLote === 'historico' && (
                      <motion.span
                        layoutId="subtab-lote-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#FCFBFB] rounded-md shadow-xs"
                      />
                    )}
                    <span className="relative z-10">Histórico de Lotes ({historico.length})</span>
                  </button>
                </div>

                <div className="relative overflow-x-clip">
                  <div
                    style={{
                      transform: dragSubLoteX ? `translateX(${dragSubLoteX}px)` : undefined,
                      transition: dragSubLoteX
                        ? 'none'
                        : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <AnimatePresence mode="popLayout" initial={false} custom={direcaoSubLote}>
                      <motion.div
                        key={subAbaLote}
                        custom={direcaoSubLote}
                        variants={subTabSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full"
                      >
                      {subAbaLote === 'cadastro' ? (
                <div className="max-w-3xl mx-auto">
                  <div className="min-w-0 bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-4 sm:p-6 no-print">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[#EDE7E6]">
                      <h2 className="text-base sm:text-lg font-bold text-[#3E4546]">Novo Lote de Esterilização</h2>
                      <span className="text-xs font-mono tabular-nums text-[#7A8283] flex flex-wrap items-center gap-x-1">
                        <span>Próximo código:</span>
                        <strong className="text-[#9E7372]">{proximoCodPrevisto}</strong>
                        {turnoCalculado ? (
                          <span className="font-sans text-[#6E7677]">
                            · {turnoCalculado.turnoEfetivo === 'manha' ? 'Manhã (01)' : 'Tarde (02)'}
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <form onSubmit={handleCadastrarLote} className="space-y-3.5 sm:space-y-4">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Nome do Item / Kit Esterilizado (Opcional)
                        </label>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => setItem(e.target.value)}
                          placeholder="Ex: Kit Clínico Cirúrgico 01 (opcional)"
                          className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Data de Esterilização *
                          </label>
                          <input
                            type="date"
                            value={esterilizacao}
                            onChange={(e) => setEsterilizacao(e.target.value)}
                            required
                            className="w-full min-w-0 max-w-full px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546]"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Validade (Dias) *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={diasValidadeInput}
                            onChange={(e) => {
                              const apenasDigitos = e.target.value.replace(/\D/g, '');
                              setDiasValidadeInput(apenasDigitos);
                              const parsed = parseInt(apenasDigitos, 10);
                              if (!isNaN(parsed) && parsed >= 1) {
                                setDiasValidade(Math.min(365, parsed));
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseInt(diasValidadeInput, 10);
                              const valido = isNaN(parsed) || parsed < 1 ? 1 : Math.min(365, parsed);
                              setDiasValidadeInput(String(valido));
                              setDiasValidade(valido);
                            }}
                            required
                            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546] tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Data de Validade Calculada
                          </label>
                          <input
                            type="date"
                            value={validade}
                            readOnly
                            className="w-full min-w-0 max-w-full px-3 sm:px-4 py-2.5 border border-[#E5DFDE] rounded-lg bg-[#F4EFEF] text-base sm:text-sm text-[#3E4546] font-semibold"
                          />
                          <span className="text-[11px] text-[#7A8283] mt-1 block">
                            Calculada automaticamente (editável via dias)
                          </span>
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Quantidade de Etiquetas *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={quantidadeInput}
                            onChange={(e) => {
                              const apenasDigitos = e.target.value.replace(/\D/g, '');
                              setQuantidadeInput(apenasDigitos);
                              const parsed = parseInt(apenasDigitos, 10);
                              if (!isNaN(parsed) && parsed >= 1) {
                                setQuantidade(Math.min(60, parsed));
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseInt(quantidadeInput, 10);
                              const valido = isNaN(parsed) || parsed < 1 ? 1 : Math.min(60, parsed);
                              setQuantidadeInput(String(valido));
                              setQuantidade(valido);
                            }}
                            required
                            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546] tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Responsável Técnico *
                        </label>
                        <input
                          type="text"
                          value={responsavel}
                          onChange={(e) => setResponsavel(e.target.value)}
                          placeholder="Nome do profissional (obrigatório)"
                          required
                          className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={salvando}
                        className="w-full py-3 px-4 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        <PlusCircle className="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] text-[#CDA9A8] shrink-0" />
                        <span>{salvando ? 'Cadastrando...' : 'Cadastrar Lote e Gerar Etiquetas'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-4 sm:p-6 no-print">
                  <h2 className="text-base sm:text-lg font-bold text-[#3E4546] mb-3 sm:mb-4">
                    Histórico de Lotes Cadastrados
                  </h2>
                  {carregandoHistorico ? (
                    <div className="py-12 text-center text-[#7A8283] text-sm">Carregando histórico...</div>
                  ) : historico.length === 0 ? (
                    <div className="py-12 text-center text-[#7A8283] text-sm">Nenhum lote cadastrado ainda.</div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {historico.map((l) => (
                          <div
                            key={l.codigo}
                            className="rounded-xl border border-[#E5DFDE] bg-white p-3.5 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-mono tabular-nums font-bold text-sm text-[#3E4546]">
                                  {l.codigo}
                                </span>
                                <p className="text-xs font-medium text-[#505859] truncate mt-0.5">
                                  {l.item || <span className="text-[#9BA2A3] font-normal italic">Sem descrição</span>}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-[#6E7677] bg-[#F8F5F5] rounded-lg p-2.5">
                              <div>
                                <span className="block text-[10px] uppercase tracking-wide text-[#8D9596]">
                                  Esterilização
                                </span>
                                <span className="font-semibold text-[#3E4546] tabular-nums">
                                  {formatDataBR(l.esterilizacao)}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] uppercase tracking-wide text-[#8D9596]">
                                  Validade
                                </span>
                                <span className="font-semibold text-[#9E7372] tabular-nums">
                                  {formatDataBR(l.validade)}
                                </span>
                              </div>
                              <div className="col-span-2 truncate">
                                <span className="text-[10px] uppercase tracking-wide text-[#8D9596] mr-1.5">
                                  Responsável:
                                </span>
                                <span className="font-medium text-[#505859]">{l.responsavel}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setLoteCriado(l);
                                  setQuantidade(1);
                                  setQuantidadeInput('1');
                                  setOrigemImpressao('reimpressao');
                                  setPopupImpressaoAberto(true);
                                }}
                                className="py-2 px-3 bg-[#F4ECEC] hover:bg-[#EBDDDD] text-[#505859] border border-[#E3D3D2] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-[#9E7372]" />
                                <span>Reimprimir</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setLoteModal(l)}
                                className="py-2 px-3 bg-white hover:bg-[#F4EFEF] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#7A8283]" />
                                <span>Cartão</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm text-[#505859]">
                          <thead className="bg-[#F6F2F2] border-b border-[#E5DFDE] text-xs uppercase text-[#6E7677] font-bold">
                            <tr>
                              <th className="p-3">Código / Lote</th>
                              <th className="p-3">Item</th>
                              <th className="p-3">Esterilização</th>
                              <th className="p-3">Validade</th>
                              <th className="p-3">Responsável</th>
                              <th className="p-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EDE7E6]">
                            {historico.map((l) => (
                              <tr key={l.codigo} className="hover:bg-[#F9F6F6] transition-colors">
                                <td className="p-3 font-mono tabular-nums font-bold text-[#3E4546]">
                                  {l.codigo}
                                </td>
                                <td className="p-3 font-medium">
                                  {l.item || <span className="text-[#9BA2A3] font-normal italic">—</span>}
                                </td>
                                <td className="p-3 tabular-nums">{formatDataBR(l.esterilizacao)}</td>
                                <td className="p-3 tabular-nums">{formatDataBR(l.validade)}</td>
                                <td className="p-3 text-[#6E7677]">{l.responsavel}</td>
                                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLoteCriado(l);
                                      setQuantidade(1);
                                      setQuantidadeInput('1');
                                      setOrigemImpressao('reimpressao');
                                      setPopupImpressaoAberto(true);
                                    }}
                                    className="px-2.5 py-1 bg-[#F4ECEC] hover:bg-[#EBDDDD] text-[#505859] border border-[#E3D3D2] text-xs font-semibold rounded transition inline-flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-[#9E7372]" />
                                    <span>Reimprimir</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLoteModal(l)}
                                    className="px-2.5 py-1 bg-white hover:bg-[#F4EFEF] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded transition inline-flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#7A8283]" />
                                    <span>Cartão</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
                    </motion.div>
                  </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {abaAtiva === 'qrcode' && (
              <motion.div
                key="aba-qrcode"
                custom={direcaoAba}
                variants={mainTabSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={(definition) => {
                  if (definition === 'center') finalizarTransicaoAba();
                }}
                className="w-full no-print touch-pan-y"
              >
                <LeitorQrCode
                  nomeConsultorio={config.nomeConsultorio}
                  onReimprimir={(lote) => {
                    setLoteCriado(lote);
                    setQuantidade(1);
                    setQuantidadeInput('1');
                    setOrigemImpressao('reimpressao');
                    setPopupImpressaoAberto(true);
                  }}
                />
              </motion.div>
            )}

            {abaAtiva === 'config' && (
              <motion.div
                key="aba-config"
                custom={direcaoAba}
                variants={mainTabSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onAnimationComplete={(definition) => {
                  if (definition === 'center') finalizarTransicaoAba();
                }}
                className="w-full no-print touch-pan-y"
              >
                <div className="max-w-2xl mx-auto space-y-6">
                {ehAdmin && (
                <div className="flex items-center gap-1 p-1 bg-[#EDE7E6]/80 border border-[#E5DFDE] rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => mudarSubAbaConfig('geral')}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      subAbaConfig === 'geral'
                        ? 'text-[#3E4546]'
                        : 'text-[#6E7677] hover:text-[#3E4546]'
                    }`}
                  >
                    {subAbaConfig === 'geral' && (
                      <motion.span
                        layoutId="subtab-config-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#FCFBFB] rounded-md shadow-xs"
                      />
                    )}
                    <span className="relative z-10">Consultório e Etiquetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => mudarSubAbaConfig('usuarios')}
                    className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      subAbaConfig === 'usuarios'
                        ? 'text-[#3E4546]'
                        : 'text-[#6E7677] hover:text-[#3E4546]'
                    }`}
                  >
                    {subAbaConfig === 'usuarios' && (
                      <motion.span
                        layoutId="subtab-config-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#FCFBFB] rounded-md shadow-xs"
                      />
                    )}
                    <UserPlus className="relative z-10 w-3.5 h-3.5 text-[#9E7372]" />
                    <span className="relative z-10">Usuários</span>
                  </button>
                </div>
                )}

                <div className="relative overflow-x-clip">
                  <div
                    style={{
                      transform: dragSubConfigX ? `translateX(${dragSubConfigX}px)` : undefined,
                      transition: dragSubConfigX
                        ? 'none'
                        : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <AnimatePresence mode="popLayout" initial={false} custom={direcaoSubConfig}>
                      <motion.div
                        key={!ehAdmin ? 'geral' : subAbaConfig}
                        custom={direcaoSubConfig}
                        variants={subTabSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full"
                      >
                      {!ehAdmin || subAbaConfig === 'geral' ? (
                <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-4 sm:p-6">
                  <div className="mb-4 pb-3 border-b border-[#EDE7E6]">
                    <h2 className="text-base sm:text-lg font-bold text-[#3E4546]">
                      {ehAdmin ? 'Configurações de Impressão e Consultório' : 'Configuração de Etiquetas'}
                    </h2>
                    {!ehAdmin && (
                      <p className="text-xs text-[#7A8283] mt-0.5">
                        Ajuste as dimensões das etiquetas para impressão. Outras configurações são exclusivas do administrador.
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSalvarConfig} className="space-y-3.5 sm:space-y-4">
                    {ehAdmin && (
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                        Nome do Consultório
                      </label>
                      <input
                        type="text"
                        value={config.nomeConsultorio}
                        onChange={(e) => setConfig({ ...config, nomeConsultorio: e.target.value })}
                        required
                        className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546]"
                      />
                    </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Largura da Etiqueta (mm)
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="150"
                          value={config.larguraMm}
                          onChange={(e) => setConfig({ ...config, larguraMm: Number(e.target.value) })}
                          required
                          className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546] tabular-nums"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Altura da Etiqueta (mm)
                        </label>
                        <input
                          type="number"
                          min="15"
                          max="100"
                          value={config.alturaMm}
                          onChange={(e) => setConfig({ ...config, alturaMm: Number(e.target.value) })}
                          required
                          className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-base sm:text-sm text-[#3E4546] tabular-nums"
                        />
                      </div>
                    </div>

                    {ehAdmin && (
                    <>
                    <div>
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                        Dias de Validade Padrão
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={diasValidadeConfigInput}
                        onChange={(e) => {
                          const apenasDigitos = e.target.value.replace(/\D/g, '');
                          setDiasValidadeConfigInput(apenasDigitos);
                          const parsed = parseInt(apenasDigitos, 10);
                          if (!isNaN(parsed) && parsed >= 1) {
                            setConfig((prev) => ({
                              ...prev,
                              diasValidade: Math.min(365, parsed),
                            }));
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseInt(diasValidadeConfigInput, 10);
                          const valido = isNaN(parsed) || parsed < 1 ? 1 : Math.min(365, parsed);
                          setDiasValidadeConfigInput(String(valido));
                          setConfig((prev) => ({ ...prev, diasValidade: valido }));
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                      />
                    </div>

                    <div className="pt-2 border-t border-[#EDE7E6] space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Regra de Numeração do Lote
                        </label>
                        <select
                          value={config.regraNumeracao}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              regraNumeracao: e.target.value as RegraNumeracao,
                            })
                          }
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546]"
                        >
                          <option value="turno_manha_tarde">
                            Por turno (Manhã = 01 / Tarde = 02)
                          </option>
                          <option value="sequencial">
                            Sequencial diário (01, 02, 03...)
                          </option>
                        </select>
                        <span className="text-[11px] text-[#7A8283] mt-1 block">
                          {config.regraNumeracao === 'turno_manha_tarde'
                            ? 'Gera apenas final 01 no turno da manhã e final 02 no turno da tarde.'
                            : 'Incrementa sequencialmente a cada novo lote cadastrado no mesmo dia.'}
                        </span>
                      </div>

                      {config.regraNumeracao === 'turno_manha_tarde' && (
                        <div>
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Horário de troca para Tarde (02)
                          </label>
                          <select
                            value={config.horaCorteTarde}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                horaCorteTarde: Number(e.target.value),
                              })
                            }
                            className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                          >
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, '0')}:00
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-[#7A8283] mt-1 block">
                            Antes das {String(config.horaCorteTarde).padStart(2, '0')}:00 usa final 01; a partir das{' '}
                            {String(config.horaCorteTarde).padStart(2, '0')}:00 usa final 02.
                          </span>
                        </div>
                      )}
                    </div>
                    </>
                    )}

                    <button
                      type="submit"
                      disabled={salvandoConfig}
                      className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white font-semibold rounded-lg transition cursor-pointer"
                    >
                      {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-4 sm:p-6">
                    <h2 className="text-base sm:text-lg font-bold text-[#3E4546] mb-1">Cadastrar Novo Usuário</h2>
                    <p className="text-xs text-[#7A8283] mb-4 pb-4 border-b border-[#EDE7E6]">
                      Crie acessos individuais definindo login, senha inicial (padrão{' '}
                      <span className="font-mono font-semibold text-[#9E7372]">1234</span>) e cargo de permissão.
                    </p>

                    <form onSubmit={handleCadastrarUsuario} className="space-y-3.5 sm:space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Usuário (login) *
                          </label>
                          <input
                            type="text"
                            value={novoUsuario}
                            onChange={(e) => setNovoUsuario(e.target.value)}
                            required
                            placeholder="Ex: fabiana ou auxiliar"
                            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg text-base sm:text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Cargo *
                          </label>
                          <select
                            value={novoCargo}
                            onChange={(e) => setNovoCargo(e.target.value as CargoUsuario)}
                            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg text-base sm:text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                          >
                            <option value="usuario">Usuário</option>
                            <option value="administrador">Administrador</option>
                            <option value="cliente">Cliente</option>
                          </select>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Nome Completo (Opcional)
                        </label>
                        <input
                          type="text"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          placeholder="Ex: Dra. Fabiana Bezerra"
                          className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg text-base sm:text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Senha Inicial (padrão: 1234) *
                        </label>
                        <div className="relative">
                          <input
                            type={mostrarNovaSenha ? 'text' : 'password'}
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            required
                            minLength={4}
                            className="w-full min-w-0 px-3 sm:px-4 py-2.5 pr-10 bg-white border border-[#DCD4D3] rounded-lg text-base sm:text-sm text-[#3E4546] font-mono focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarNovaSenha((prev) => !prev)}
                            aria-label="Mostrar ou ocultar senha"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7A8283] hover:text-[#3E4546] cursor-pointer"
                          >
                            {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#7A8283] bg-[#F8F5F5] border border-[#EDE7E6] rounded-lg p-3 space-y-1">
                        <p><strong className="text-[#505859]">Administrador:</strong> acesso total ao sistema e usuários.</p>
                        <p><strong className="text-[#505859]">Usuário:</strong> lotes, QR Code e apenas dimensão de etiquetas nas configurações.</p>
                        <p><strong className="text-[#505859]">Cliente:</strong> apenas leitor de QR Code e visualização pública dos lotes.</p>
                      </div>

                      <button
                        type="submit"
                        disabled={cadastrandoUsuario}
                        className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-[#CDA9A8]" />
                        <span>{cadastrandoUsuario ? 'Cadastrando...' : 'Cadastrar Usuário'}</span>
                      </button>
                    </form>
                  </div>

                  {usuariosLista.length > 0 && (
                    <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-4 sm:p-6">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-bold text-[#3E4546]">Gerenciar Logins e Cargos</h3>
                        <span className="text-xs text-[#7A8283] tabular-nums">
                          {usuariosLista.length} {usuariosLista.length === 1 ? 'conta' : 'contas'}
                        </span>
                      </div>

                      <div className="divide-y divide-[#EDE7E6]">
                        {usuariosLista.map((u) => {
                          const emEdicao = usuarioEditando === u.usuario;
                          const emConfirmacao = confirmandoExclusao === u.usuario;
                          const ehProprio = u.usuario === usuarioLoginAtual;

                          return (
                            <div key={u.usuario} className="py-3 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-sm">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-semibold text-[#3E4546] break-words">
                                      {u.nome}
                                    </span>
                                    <span className="text-[#CDA9A8]">·</span>
                                    <span className="font-mono text-xs text-[#6E7677]">{u.usuario}</span>
                                    {ehProprio && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F4EFEF] text-[#9E7372] border border-[#E5DFDE]">
                                        Você
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#7A8283]">
                                    <Shield className="w-3 h-3 text-[#9E7372] shrink-0" />
                                    <span>{LABEL_CARGO[u.role]}</span>
                                    {u.protegido && (
                                      <span>· Configurado por variável de ambiente</span>
                                    )}
                                  </div>
                                </div>

                                {!u.protegido && !emEdicao && (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicaoUsuario(u)}
                                      className="px-2.5 py-1.5 bg-[#F4EFEF] hover:bg-[#EAE1E0] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#9E7372]" />
                                      <span>Editar</span>
                                    </button>

                                    {!ehProprio && (
                                      emConfirmacao ? (
                                        <div className="inline-flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={excluindoUsuario === u.usuario}
                                            onClick={() => handleExcluirUsuario(u.usuario)}
                                            className="px-2.5 py-1.5 bg-[#8C4A49] hover:bg-[#733B3A] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>{excluindoUsuario === u.usuario ? 'Excluindo...' : 'Confirmar'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmandoExclusao(null)}
                                            className="px-2 py-1.5 bg-white hover:bg-[#F4EFEF] text-[#6E7677] border border-[#E5DFDE] text-xs font-semibold rounded-lg transition cursor-pointer"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            cancelarEdicaoUsuario();
                                            setConfirmandoExclusao(u.usuario);
                                          }}
                                          className="px-2.5 py-1.5 bg-white hover:bg-[#F9EDED] text-[#8C4A49] border border-[#E8C8C8] text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Excluir</span>
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>

                              {emEdicao && (
                                <form
                                  onSubmit={handleSalvarEdicaoUsuario}
                                  className="bg-[#F8F5F5] border border-[#E5DFDE] rounded-xl p-3.5 space-y-3"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="min-w-0">
                                      <label className="block text-[11px] font-semibold text-[#505859] mb-1">
                                        Login *
                                      </label>
                                      <input
                                        type="text"
                                        value={editLogin}
                                        onChange={(e) => setEditLogin(e.target.value)}
                                        required
                                        minLength={2}
                                        className="w-full min-w-0 px-3 py-2 bg-white border border-[#DCD4D3] rounded-lg text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                                      />
                                    </div>

                                    <div className="min-w-0">
                                      <label className="block text-[11px] font-semibold text-[#505859] mb-1">
                                        Cargo *
                                      </label>
                                      <select
                                        value={editCargo}
                                        onChange={(e) => setEditCargo(e.target.value as CargoUsuario)}
                                        disabled={ehProprio}
                                        className="w-full min-w-0 px-3 py-2 bg-white disabled:bg-[#F4EFEF] border border-[#DCD4D3] rounded-lg text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                                      >
                                        <option value="usuario">Usuário</option>
                                        <option value="administrador">Administrador</option>
                                        <option value="cliente">Cliente</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="min-w-0">
                                      <label className="block text-[11px] font-semibold text-[#505859] mb-1">
                                        Nome Completo
                                      </label>
                                      <input
                                        type="text"
                                        value={editNome}
                                        onChange={(e) => setEditNome(e.target.value)}
                                        className="w-full min-w-0 px-3 py-2 bg-white border border-[#DCD4D3] rounded-lg text-sm text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                                      />
                                    </div>

                                    <div className="min-w-0">
                                      <label className="block text-[11px] font-semibold text-[#505859] mb-1">
                                        Nova Senha (opcional)
                                      </label>
                                      <div className="relative">
                                        <input
                                          type={mostrarEditSenha ? 'text' : 'password'}
                                          value={editNovaSenha}
                                          onChange={(e) => setEditNovaSenha(e.target.value)}
                                          minLength={4}
                                          placeholder="Manter senha atual"
                                          className="w-full min-w-0 px-3 py-2 pr-9 bg-white border border-[#DCD4D3] rounded-lg text-sm font-mono text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setMostrarEditSenha((prev) => !prev)}
                                          aria-label="Mostrar ou ocultar nova senha"
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7A8283] hover:text-[#3E4546] cursor-pointer"
                                        >
                                          {mostrarEditSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={cancelarEdicaoUsuario}
                                      className="px-3 py-1.5 bg-white hover:bg-[#F4EFEF] text-[#505859] border border-[#DCD4D3] text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={salvandoEdicaoUsuario}
                                      className="px-3.5 py-1.5 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                      {salvandoEdicaoUsuario ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
                    </motion.div>
                  </AnimatePresence>
                  </div>
                </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
            </div>
          </div>

          {loteCriado && (
            <div className="hidden print:block">
              <div className={`flex flex-wrap gap-2 ${config.modo === 'a4' ? 'grid grid-cols-3' : ''}`}>
                {Array.from({ length: quantidade }).map((_, i) => (
                  <Etiqueta
                    key={i}
                    lote={loteCriado}
                    larguraMm={config.larguraMm}
                    alturaMm={config.alturaMm}
                  />
                ))}
              </div>
            </div>
          )}

          {popupImpressaoAberto && loteCriado && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-popup-impressao"
              className="fixed inset-0 z-50 bg-[#3E4546]/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print"
              onClick={() => setPopupImpressaoAberto(false)}
            >
              <div
                className="bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EDE7E6]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#F4ECEC] border border-[#CDA9A8]/60 flex items-center justify-center shrink-0">
                      {origemImpressao === 'cadastro' ? (
                        <CheckCircle2 className="w-5 h-5 text-[#9E7372]" />
                      ) : (
                        <Printer className="w-4 h-4 text-[#9E7372]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3
                        id="titulo-popup-impressao"
                        className="text-sm sm:text-base font-bold text-[#3E4546] truncate"
                      >
                        {origemImpressao === 'cadastro'
                          ? `Lote ${loteCriado.codigo} Cadastrado!`
                          : `Reimprimir Lote ${loteCriado.codigo}`}
                      </h3>
                      <p className="text-xs text-[#6E7677]">
                        {quantidade} etiqueta(s) pronta(s) para impressão ou acesso ao cartão público.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPopupImpressaoAberto(false)}
                    aria-label="Fechar janela de impressão"
                    className="p-1.5 text-[#6E7677] hover:text-[#3E4546] hover:bg-[#F4EFEF] rounded-lg transition cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex justify-center bg-white rounded-xl p-3 border border-[#E5DFDE] overflow-x-auto max-w-full">
                  <Etiqueta
                    lote={loteCriado}
                    larguraMm={config.larguraMm}
                    alturaMm={config.alturaMm}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 bg-[#F8F5F5] border border-[#E5DFDE] rounded-xl px-3.5 py-2.5">
                  <div>
                    <label
                      htmlFor="popup-qtd-etiquetas"
                      className="block text-xs font-semibold text-[#505859]"
                    >
                      Quantidade de etiquetas
                    </label>
                    <span className="text-[11px] text-[#7A8283] tabular-nums">
                      Medidas: {config.larguraMm} × {config.alturaMm} mm
                    </span>
                  </div>
                  <input
                    id="popup-qtd-etiquetas"
                    type="text"
                    inputMode="numeric"
                    value={quantidadeInput}
                    onChange={(e) => {
                      const apenasDigitos = e.target.value.replace(/\D/g, '');
                      setQuantidadeInput(apenasDigitos);
                      const parsed = parseInt(apenasDigitos, 10);
                      if (!isNaN(parsed) && parsed >= 1) {
                        setQuantidade(Math.min(60, parsed));
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(quantidadeInput, 10);
                      const valido = isNaN(parsed) || parsed < 1 ? 1 : Math.min(60, parsed);
                      setQuantidadeInput(String(valido));
                      setQuantidade(valido);
                    }}
                    className="w-20 px-2.5 py-1.5 text-center bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-sm font-semibold text-[#3E4546] tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 px-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition"
                  >
                    <Printer className="w-4 h-4 text-[#CDA9A8] shrink-0" />
                    <span>Imprimir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoteModal(loteCriado)}
                    className="py-2.5 px-3 bg-white border border-[#DCD4D3] hover:bg-[#F4EFEF] text-[#505859] font-semibold rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#9E7372] shrink-0" />
                    <span>Cartão</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {loteModal && (
            <ModalCartaoLote
              lote={loteModal}
              nomeConsultorio={config.nomeConsultorio}
              onClose={() => setLoteModal(null)}
            />
          )}
        </main>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
