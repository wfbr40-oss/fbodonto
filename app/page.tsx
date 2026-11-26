'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Lote, hojeISO, addDias, formatDataBR, prefixoDia, proximoCodigo } from '@/lib/lote';
import {
  criarLote,
  listarRecentes,
  login,
  logout,
  obterSessaoUsuario,
  cadastrarUsuario,
  listarUsuariosLocais,
  UsuarioRegistrado,
} from '@/lib/db';
import { carregarConfig, salvarConfig, Config } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase';
import Etiqueta from '@/components/Etiqueta';
import LeitorQrCode from '@/components/LeitorQrCode';
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
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';

type AbaPrincipal = 'novo' | 'qrcode' | 'config';
type SubAbaLote = 'cadastro' | 'historico';
type SubAbaConfig = 'geral' | 'usuarios';

export default function CadastroPage() {
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [usuarioConectado, setUsuarioConectado] = useState<string>('');
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(true);

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  const [config, setConfig] = useState<Config>(carregarConfig());
  const [abaAtiva, setAbaAtiva] = useState<AbaPrincipal>('novo');
  const [subAbaLote, setSubAbaLote] = useState<SubAbaLote>('cadastro');
  const [subAbaConfig, setSubAbaConfig] = useState<SubAbaConfig>('geral');

  const [sidebarDesktop, setSidebarDesktop] = useState<boolean>(true);
  const [sidebarMobile, setSidebarMobile] = useState<boolean>(false);

  const [item, setItem] = useState('');
  const [esterilizacao, setEsterilizacao] = useState(hojeISO());
  const [diasValidade, setDiasValidade] = useState<number>(config.diasValidade);
  const [responsavel, setResponsavel] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);

  const validade = addDias(esterilizacao, diasValidade);

  const [historico, setHistorico] = useState<Lote[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState<boolean>(false);

  const [loteCriado, setLoteCriado] = useState<Lote | null>(null);
  const [erroCadastro, setErroCadastro] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);

  const [msgConfigSalva, setMsgConfigSalva] = useState<string>('');

  // Cadastro de usuário (Configurações -> Cadastrar Usuário)
  const [novoUsuario, setNovoUsuario] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('1234');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [cadastrandoUsuario, setCadastrandoUsuario] = useState(false);
  const [msgUsuarioSucesso, setMsgUsuarioSucesso] = useState('');
  const [erroUsuario, setErroUsuario] = useState('');
  const [usuariosLista, setUsuariosLista] = useState<UsuarioRegistrado[]>([]);

  const pref = prefixoDia(esterilizacao);
  const lotesDoDia = historico.filter((l) => l.codigo.startsWith(pref));
  const ultimo = lotesDoDia.length > 0 ? lotesDoDia[0].codigo : null;
  const proximoCodPrevisto = proximoCodigo(pref, ultimo) || `${pref}01`;

  const carregarDadosHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    const rec = await listarRecentes();
    setHistorico(rec);
    setCarregandoHistorico(false);
  }, []);

  useEffect(() => {
    obterSessaoUsuario().then(({ autenticado: ok, usuario: nome }) => {
      setAutenticado(ok);
      setUsuarioConectado(nome || '');
      setCarregandoAuth(false);
      if (ok) {
        carregarDadosHistorico();
        setUsuariosLista(listarUsuariosLocais());
      }
    });
  }, [carregarDadosHistorico]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLogin('');
    try {
      const nome = await login(usuario, senha);
      setAutenticado(true);
      setUsuarioConectado(nome);
      setUsuariosLista(listarUsuariosLocais());
      carregarDadosHistorico();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar';
      setErroLogin(msg);
    }
  };

  const handleLogout = async () => {
    await logout();
    setAutenticado(false);
    setUsuarioConectado('');
    setSidebarMobile(false);
  };

  const handleToggleMenu = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarMobile((prev) => !prev);
    } else {
      setSidebarDesktop((prev) => !prev);
    }
  };

  const selecionarAba = (aba: AbaPrincipal) => {
    setAbaAtiva(aba);
    if (aba !== 'novo') {
      setLoteCriado(null);
    }
    setSidebarMobile(false);
  };

  const handleSalvarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    salvarConfig(config);
    setMsgConfigSalva('Configurações salvas com sucesso.');
    setTimeout(() => setMsgConfigSalva(''), 3500);
  };

  const handleCadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroUsuario('');
    setMsgUsuarioSucesso('');
    setCadastrandoUsuario(true);

    try {
      const res = await cadastrarUsuario({
        usuario: novoUsuario,
        nome: novoNome,
        senha: novaSenha,
      });

      setUsuariosLista(listarUsuariosLocais());
      setNovoUsuario('');
      setNovoNome('');
      setNovaSenha('1234');

      if (res.requerConfirmacao) {
        setMsgUsuarioSucesso(
          `Usuário "${res.usuario}" cadastrado no Supabase com a senha informada. Caso o login solicite confirmação de e-mail, desative "Confirm email" em Authentication > Providers > Email no painel do Supabase.`
        );
      } else {
        setMsgUsuarioSucesso(`Usuário "${res.usuario}" cadastrado com sucesso!`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar usuário.';
      setErroUsuario(msg);
    } finally {
      setCadastrandoUsuario(false);
    }
  };

  const handleCadastrarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroCadastro('');

    if (validade < esterilizacao) {
      setErroCadastro('A data de validade não pode ser anterior à data de esterilização.');
      return;
    }

    setSalvando(true);
    try {
      const novo = await criarLote({
        item: item.trim(),
        esterilizacao,
        validade,
        responsavel: responsavel.trim() || usuarioConectado || 'Equipe',
      });
      setLoteCriado(novo);
      await carregarDadosHistorico();
      setItem('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar lote.';
      setErroCadastro(msg);
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

  if (carregandoAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.png"
                alt="Logo FB Odonto"
                width={130}
                height={130}
                referrerPolicy="no-referrer"
                className="w-[130px] h-[130px] object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{config.nomeConsultorio}</h1>
            <p className="text-sm text-slate-500 mt-1">Controle e Rastreabilidade de Esterilização</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <b>Modo Demonstração (Local):</b> Variáveis do Supabase não configuradas. Os dados serão salvos no navegador (localStorage).
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Usuário</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                placeholder="Ex: admin"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                placeholder="••••••••"
              />
            </div>

            {erroLogin && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroLogin}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>Entrar no Sistema</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleToggleMenu}
              aria-label="Abrir ou fechar menu lateral"
              className="p-2 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition cursor-pointer shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            <span className="inline-flex items-center justify-center w-10 h-10 shrink-0">
              <Image
                src="/logo.png"
                alt="Logo FB Odonto"
                width={40}
                height={40}
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain"
              />
            </span>

            <h1 className="font-bold text-slate-900 leading-tight truncate whitespace-nowrap">
              {config.nomeConsultorio}
            </h1>
          </div>

          <div className="text-xs sm:text-sm font-medium text-slate-500 whitespace-nowrap shrink-0">
            {tituloAbaAtual}
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {sidebarMobile && (
          <div
            onClick={() => setSidebarMobile(false)}
            className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden no-print"
            aria-hidden="true"
          />
        )}

        <aside
          className={`no-print fixed lg:sticky top-0 lg:top-16 left-0 z-50 lg:z-20 h-screen lg:h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 shrink-0 ${
            sidebarMobile ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarDesktop ? 'lg:translate-x-0 lg:flex' : 'lg:-translate-x-full lg:hidden'}`}
        >
          <div>
            <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 lg:hidden">
              <span className="font-bold text-slate-900 text-sm">Menu</span>
              <button
                type="button"
                onClick={() => setSidebarMobile(false)}
                aria-label="Fechar menu"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-4 space-y-1.5" aria-label="Navegação principal">
              <button
                type="button"
                onClick={() => selecionarAba('novo')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'novo'
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Cadastrar Lote</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('qrcode')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'qrcode'
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <ScanLine className="w-4 h-4 shrink-0" />
                <span>Ler QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('config')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap ${
                  abaAtiva === 'config'
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Configurações</span>
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 leading-tight">Usuário conectado</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{usuarioConectado || 'Usuário'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 bg-white rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 no-print">
              <b>Aviso:</b> Usando armazenamento local (localStorage). Para sincronizar em nuvem (Supabase), configure as variáveis de ambiente .env.
            </div>
          )}

          {abaAtiva === 'novo' && (
            <div className="space-y-6">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit no-print">
                <button
                  type="button"
                  onClick={() => setSubAbaLote('cadastro')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaLote === 'cadastro'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Novo Lote
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaLote('historico')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaLote === 'historico'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Histórico de Lotes ({historico.length})
                </button>
              </div>

              {subAbaLote === 'cadastro' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 no-print">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                      <h2 className="text-lg font-bold text-slate-900">Novo Lote de Esterilização</h2>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        Próximo código: <strong className="text-sky-700">{proximoCodPrevisto}</strong>
                      </span>
                    </div>

                    <form onSubmit={handleCadastrarLote} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Nome do Item / Kit Esterilizado (Opcional)
                        </label>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => setItem(e.target.value)}
                          placeholder="Ex: Kit Clínico Cirúrgico 01 (opcional)"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Data de Esterilização *
                          </label>
                          <input
                            type="date"
                            value={esterilizacao}
                            onChange={(e) => setEsterilizacao(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Validade (Dias) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={diasValidade}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 30;
                              setDiasValidade(val);
                            }}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Data de Validade Calculada
                          </label>
                          <input
                            type="date"
                            value={validade}
                            readOnly
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-semibold"
                          />
                          <span className="text-[11px] text-slate-500 mt-1 block">
                            Calculada automaticamente (editável via dias)
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Quantidade de Etiquetas *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={quantidade}
                            onChange={(e) => setQuantidade(parseInt(e.target.value, 10) || 1)}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900 tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Responsável Técnico (Opcional)
                        </label>
                        <input
                          type="text"
                          value={responsavel}
                          onChange={(e) => setResponsavel(e.target.value)}
                          placeholder="Nome do profissional (opcional)"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                        />
                      </div>

                      {erroCadastro && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{erroCadastro}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={salvando}
                        className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <PlusCircle className="w-5 h-5" />
                        <span>{salvando ? 'Cadastrando...' : 'Cadastrar Lote e Gerar Etiquetas'}</span>
                      </button>
                    </form>
                  </div>

                  <div className="space-y-6 no-print">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        Instruções de Impressão
                      </h3>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                        <li>Configure a impressora térmica ou comum para 100% de escala (sem &quot;ajustar à página&quot;).</li>
                        <li>
                          Dimensões atuais: {config.larguraMm}mm &times; {config.alturaMm}mm.
                        </li>
                        <li>O código do lote serve como link curto para leitura via QR Code.</li>
                      </ul>
                    </div>

                    {loteCriado && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-emerald-900 space-y-3">
                        <div className="flex items-center space-x-2 font-bold text-emerald-800">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>Lote {loteCriado.codigo} Cadastrado!</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          {quantidade} etiqueta(s) pronta(s) para impressão ou acesso ao cartão público.
                        </p>
                        <div className="flex justify-center bg-white rounded-lg p-3 border border-emerald-200 overflow-hidden">
                          <Etiqueta
                            lote={loteCriado}
                            larguraMm={config.larguraMm}
                            alturaMm={config.alturaMm}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow text-xs flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir</span>
                          </button>
                          <a
                            href={`/${loteCriado.codigo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs flex items-center space-x-1 whitespace-nowrap"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Cartão</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 no-print">
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Histórico de Lotes Cadastrados</h2>
                  {carregandoHistorico ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Carregando histórico...</div>
                  ) : historico.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Nenhum lote cadastrado ainda.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-700">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600 font-bold">
                          <tr>
                            <th className="p-3">Código / Lote</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">Esterilização</th>
                            <th className="p-3">Validade</th>
                            <th className="p-3">Responsável</th>
                            <th className="p-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {historico.map((l) => (
                            <tr key={l.codigo} className="hover:bg-slate-50">
                              <td className="p-3 font-mono tabular-nums font-bold text-slate-900">{l.codigo}</td>
                              <td className="p-3 font-medium">
                                {l.item || <span className="text-slate-400 font-normal italic">—</span>}
                              </td>
                              <td className="p-3 tabular-nums">{formatDataBR(l.esterilizacao)}</td>
                              <td className="p-3 tabular-nums">{formatDataBR(l.validade)}</td>
                              <td className="p-3 text-slate-600">{l.responsavel}</td>
                              <td className="p-3 text-right space-x-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLoteCriado(l);
                                    setQuantidade(1);
                                    setSubAbaLote('cadastro');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded transition inline-flex items-center space-x-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Reimprimir</span>
                                </button>
                                <a
                                  href={`/${l.codigo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition inline-flex items-center space-x-1"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Cartão</span>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'qrcode' && (
            <div className="no-print">
              <LeitorQrCode
                nomeConsultorio={config.nomeConsultorio}
                onReimprimir={(lote) => {
                  setLoteCriado(lote);
                  setQuantidade(1);
                  setAbaAtiva('novo');
                  setSubAbaLote('cadastro');
                }}
              />
            </div>
          )}

          {abaAtiva === 'config' && (
            <div className="max-w-2xl mx-auto space-y-6 no-print">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setSubAbaConfig('geral')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaConfig === 'geral'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Consultório e Etiquetas
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaConfig('usuarios')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    subAbaConfig === 'usuarios'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>

              {subAbaConfig === 'geral' ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-4">
                    Configurações de Impressão e Consultório
                  </h2>

                  {msgConfigSalva && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{msgConfigSalva}</span>
                    </div>
                  )}

                  <form onSubmit={handleSalvarConfig} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nome do Consultório
                      </label>
                      <input
                        type="text"
                        value={config.nomeConsultorio}
                        onChange={(e) => setConfig({ ...config, nomeConsultorio: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Largura da Etiqueta (mm)
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="150"
                          value={config.larguraMm}
                          onChange={(e) => setConfig({ ...config, larguraMm: Number(e.target.value) })}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Altura da Etiqueta (mm)
                        </label>
                        <input
                          type="number"
                          min="15"
                          max="100"
                          value={config.alturaMm}
                          onChange={(e) => setConfig({ ...config, alturaMm: Number(e.target.value) })}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Dias de Validade Padrão
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={config.diasValidade}
                        onChange={(e) => setConfig({ ...config, diasValidade: Number(e.target.value) })}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 tabular-nums"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow transition cursor-pointer"
                    >
                      Salvar Configurações
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Cadastrar Novo Usuário</h2>
                    <p className="text-xs text-slate-500 mb-5">
                      Crie acessos individuais para dentistas e auxiliares. A senha padrão inicial é{' '}
                      <span className="font-mono font-semibold text-slate-700">1234</span>.
                    </p>

                    <form onSubmit={handleCadastrarUsuario} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Usuário (login) *
                        </label>
                        <input
                          type="text"
                          value={novoUsuario}
                          onChange={(e) => setNovoUsuario(e.target.value)}
                          required
                          placeholder="Ex: fabiana ou auxiliar"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Nome Completo (Opcional)
                        </label>
                        <input
                          type="text"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          placeholder="Ex: Dra. Fabiana Bezerra"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Senha Inicial (padrão: 1234) *
                        </label>
                        <div className="relative">
                          <input
                            type={mostrarNovaSenha ? 'text' : 'password'}
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            required
                            minLength={4}
                            className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarNovaSenha((prev) => !prev)}
                            aria-label="Mostrar ou ocultar senha"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {erroUsuario && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{erroUsuario}</span>
                        </div>
                      )}

                      {msgUsuarioSucesso && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{msgUsuarioSucesso}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={cadastrandoUsuario}
                        className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{cadastrandoUsuario ? 'Cadastrando...' : 'Cadastrar Usuário'}</span>
                      </button>
                    </form>
                  </div>

                  {usuariosLista.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-sm font-bold text-slate-900 mb-3">Usuários Cadastrados</h3>
                      <div className="divide-y divide-slate-200">
                        {usuariosLista.map((u) => (
                          <div key={u.usuario} className="py-2.5 flex items-center justify-between text-sm">
                            <div>
                              <span className="font-semibold text-slate-900">{u.nome}</span>
                              <span className="text-slate-400 mx-2">/</span>
                              <span className="font-mono text-xs text-slate-600">{u.usuario}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
        </main>
      </div>
    </div>
  );
}
