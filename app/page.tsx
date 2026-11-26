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
  configurarAdminInicial,
  cadastrarUsuario,
  listarUsuarios,
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
  const [adminConfigured, setAdminConfigured] = useState<boolean>(true);
  const [usuarioConectado, setUsuarioConectado] = useState<string>('');
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(true);

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [setupUsuario, setSetupUsuario] = useState('admin');
  const [setupSenha, setSetupSenha] = useState('');
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

  const carregarUsuarios = useCallback(async () => {
    const lista = await listarUsuarios();
    setUsuariosLista(lista);
  }, []);

  useEffect(() => {
    obterSessaoUsuario().then(({ autenticado: ok, usuario: nome, adminConfigured: configured }) => {
      setAutenticado(ok);
      setAdminConfigured(configured);
      setUsuarioConectado(nome || '');
      setCarregandoAuth(false);
      if (ok) {
        carregarDadosHistorico();
        carregarUsuarios();
      }
    });
  }, [carregarDadosHistorico, carregarUsuarios]);

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLogin('');
    try {
      const nome = await configurarAdminInicial(setupUsuario, setupSenha);
      setAdminConfigured(true);
      setAutenticado(true);
      setUsuarioConectado(nome);
      carregarDadosHistorico();
      carregarUsuarios();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar acesso inicial';
      setErroLogin(msg);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLogin('');
    try {
      const nome = await login(usuario, senha);
      setAutenticado(true);
      setUsuarioConectado(nome);
      carregarDadosHistorico();
      carregarUsuarios();
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

      setUsuariosLista(await listarUsuarios());
      setNovoUsuario('');
      setNovoNome('');
      setNovaSenha('1234');

      setMsgUsuarioSucesso(`Usuário "${res.usuario}" cadastrado com sucesso!`);
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
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F3] text-[#505859]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#CDA9A8] border-t-[#505859]" />
      </div>
    );
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-[#F6F4F3] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[#FCFBFB] rounded-2xl border border-[#E5DFDE] shadow-sm p-8">
          <div className="text-center mb-7 pb-6 border-b border-[#EDE7E6]">
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
            <h1 className="text-2xl font-bold text-[#3E4546] tracking-tight">{config.nomeConsultorio}</h1>
            <p className="text-sm text-[#7A8283] mt-1">Controle e Rastreabilidade de Esterilização</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-5 p-3 bg-[#F7F1F1] border border-[#E3D3D2] rounded-lg text-xs text-[#505859]">
              <b>Modo Demonstração (Local):</b> Variáveis do Supabase não configuradas. Os dados serão salvos no navegador.
            </div>
          )}

          {!adminConfigured ? (
            <form onSubmit={handleSetupAdmin} className="space-y-4">
              <div className="p-3 bg-[#F7F1F1] border border-[#E3D3D2] rounded-lg text-xs text-[#505859]">
                <b>Primeiro Acesso:</b> Defina a senha inicial do usuário administrador para ativar o sistema.
              </div>

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

              {erroLogin && (
                <div className="p-3 bg-[#F9EDED] border border-[#E8C8C8] text-[#8C3B3B] text-xs rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erroLogin}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5 text-[#CDA9A8]" />
                <span>Ativar Acesso e Entrar</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#505859] mb-1.5">Usuário</label>
                <input
                  type="text"
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
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/60 focus:border-[#B58988] text-[#3E4546]"
                  placeholder="••••••••"
                />
              </div>

              {erroLogin && (
                <div className="p-3 bg-[#F9EDED] border border-[#E8C8C8] text-[#8C3B3B] text-xs rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erroLogin}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5 text-[#CDA9A8]" />
                <span>Entrar no Sistema</span>
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4F3] text-[#505859] flex flex-col">
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
        {sidebarMobile && (
          <div
            onClick={() => setSidebarMobile(false)}
            className="fixed inset-0 bg-[#3E4546]/35 z-40 lg:hidden no-print"
            aria-hidden="true"
          />
        )}

        <aside
          className={`no-print fixed lg:sticky top-0 lg:top-16 left-0 z-50 lg:z-20 h-screen lg:h-[calc(100vh-4rem)] w-64 bg-[#FCFBFB] border-r border-[#E5DFDE] flex flex-col justify-between transition-transform duration-200 shrink-0 ${
            sidebarMobile ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarDesktop ? 'lg:translate-x-0 lg:flex' : 'lg:-translate-x-full lg:hidden'}`}
        >
          <div>
            <div className="flex items-center justify-between px-4 h-16 border-b border-[#E5DFDE] lg:hidden">
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
                onClick={() => selecionarAba('novo')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap border ${
                  abaAtiva === 'novo'
                    ? 'bg-[#CDA9A8]/22 text-[#3E4546] border-[#CDA9A8]/50'
                    : 'border-transparent text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                <PlusCircle
                  className={`w-4 h-4 shrink-0 ${
                    abaAtiva === 'novo' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span>Cadastrar Lote</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('qrcode')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap border ${
                  abaAtiva === 'qrcode'
                    ? 'bg-[#CDA9A8]/22 text-[#3E4546] border-[#CDA9A8]/50'
                    : 'border-transparent text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                <ScanLine
                  className={`w-4 h-4 shrink-0 ${
                    abaAtiva === 'qrcode' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span>Ler QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => selecionarAba('config')}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition cursor-pointer whitespace-nowrap border ${
                  abaAtiva === 'config'
                    ? 'bg-[#CDA9A8]/22 text-[#3E4546] border-[#CDA9A8]/50'
                    : 'border-transparent text-[#505859] hover:bg-[#F4EFEF] hover:text-[#3E4546]'
                }`}
              >
                <Settings
                  className={`w-4 h-4 shrink-0 ${
                    abaAtiva === 'config' ? 'text-[#9E7372]' : 'text-[#7A8283]'
                  }`}
                />
                <span>Configurações</span>
              </button>
            </nav>
          </div>

          <div className="p-4 border-t border-[#E5DFDE] space-y-3 bg-[#F8F5F5]">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-9 h-9 rounded-full bg-white border border-[#DCD4D3] flex items-center justify-center text-[#9E7372] shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#7A8283] leading-tight">Usuário conectado</p>
                <p className="text-sm font-semibold text-[#3E4546] truncate">
                  {usuarioConectado || 'Usuário'}
                </p>
              </div>
            </div>

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

        <main className="flex-1 min-w-0 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 bg-[#F7F1F1] border border-[#E3D3D2] rounded-xl text-xs text-[#505859] no-print">
              <b>Aviso:</b> Usando armazenamento local (localStorage). Para sincronizar em nuvem (Supabase), configure as variáveis de ambiente .env.
            </div>
          )}

          {abaAtiva === 'novo' && (
            <div className="space-y-6">
              <div className="flex items-center gap-1 p-1 bg-[#EDE7E6]/80 border border-[#E5DFDE] rounded-lg w-fit no-print">
                <button
                  type="button"
                  onClick={() => setSubAbaLote('cadastro')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaLote === 'cadastro'
                      ? 'bg-[#FCFBFB] text-[#3E4546] shadow-xs'
                      : 'text-[#6E7677] hover:text-[#3E4546]'
                  }`}
                >
                  Novo Lote
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaLote('historico')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaLote === 'historico'
                      ? 'bg-[#FCFBFB] text-[#3E4546] shadow-xs'
                      : 'text-[#6E7677] hover:text-[#3E4546]'
                  }`}
                >
                  Histórico de Lotes ({historico.length})
                </button>
              </div>

              {subAbaLote === 'cadastro' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6 no-print">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-5 pb-4 border-b border-[#EDE7E6]">
                      <h2 className="text-lg font-bold text-[#3E4546]">Novo Lote de Esterilização</h2>
                      <span className="text-xs font-mono tabular-nums text-[#7A8283]">
                        Próximo código: <strong className="text-[#9E7372]">{proximoCodPrevisto}</strong>
                      </span>
                    </div>

                    <form onSubmit={handleCadastrarLote} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Nome do Item / Kit Esterilizado (Opcional)
                        </label>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => setItem(e.target.value)}
                          placeholder="Ex: Kit Clínico Cirúrgico 01 (opcional)"
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Data de Esterilização *
                          </label>
                          <input
                            type="date"
                            value={esterilizacao}
                            onChange={(e) => setEsterilizacao(e.target.value)}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
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
                            className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Data de Validade Calculada
                          </label>
                          <input
                            type="date"
                            value={validade}
                            readOnly
                            className="w-full px-4 py-2.5 border border-[#E5DFDE] rounded-lg bg-[#F4EFEF] text-[#3E4546] font-semibold"
                          />
                          <span className="text-[11px] text-[#7A8283] mt-1 block">
                            Calculada automaticamente (editável via dias)
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                            Quantidade de Etiquetas *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={quantidade}
                            onChange={(e) => setQuantidade(parseInt(e.target.value, 10) || 1)}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Responsável Técnico (Opcional)
                        </label>
                        <input
                          type="text"
                          value={responsavel}
                          onChange={(e) => setResponsavel(e.target.value)}
                          placeholder="Nome do profissional (opcional)"
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546]"
                        />
                      </div>

                      {erroCadastro && (
                        <div className="p-3 bg-[#F9EDED] border border-[#E8C8C8] text-[#8C3B3B] text-xs rounded-lg flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{erroCadastro}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={salvando}
                        className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <PlusCircle className="w-5 h-5 text-[#CDA9A8]" />
                        <span>{salvando ? 'Cadastrando...' : 'Cadastrar Lote e Gerar Etiquetas'}</span>
                      </button>
                    </form>
                  </div>

                  <div className="space-y-6 no-print">
                    <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E7372] mb-3">
                        Instruções de Impressão
                      </h3>
                      <ul className="text-xs text-[#6E7677] space-y-2 list-disc list-inside leading-relaxed">
                        <li>Configure a impressora térmica ou comum para 100% de escala (sem &quot;ajustar à página&quot;).</li>
                        <li>
                          Dimensões atuais: {config.larguraMm}mm &times; {config.alturaMm}mm.
                        </li>
                        <li>O código do lote serve como link curto para leitura via QR Code.</li>
                      </ul>
                    </div>

                    {loteCriado && (
                      <div className="bg-[#F8F3F3] border border-[#CDA9A8]/65 rounded-xl p-5 text-[#3E4546] space-y-3">
                        <div className="flex items-center space-x-2 font-bold text-[#3E4546]">
                          <CheckCircle2 className="w-5 h-5 text-[#9E7372] shrink-0" />
                          <span>Lote {loteCriado.codigo} Cadastrado!</span>
                        </div>
                        <p className="text-xs text-[#6E7677]">
                          {quantidade} etiqueta(s) pronta(s) para impressão ou acesso ao cartão público.
                        </p>
                        <div className="flex justify-center bg-white rounded-lg p-3 border border-[#E5DFDE] overflow-hidden">
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
                            className="flex-1 py-2.5 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg text-xs flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap transition"
                          >
                            <Printer className="w-4 h-4 text-[#CDA9A8]" />
                            <span>Imprimir</span>
                          </button>
                          <a
                            href={`/${loteCriado.codigo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2.5 bg-white border border-[#DCD4D3] hover:bg-[#F4EFEF] text-[#505859] font-semibold rounded-lg text-xs flex items-center space-x-1.5 whitespace-nowrap transition"
                          >
                            <ExternalLink className="w-4 h-4 text-[#9E7372]" />
                            <span>Cartão</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6 no-print">
                  <h2 className="text-lg font-bold text-[#3E4546] mb-4">Histórico de Lotes Cadastrados</h2>
                  {carregandoHistorico ? (
                    <div className="py-12 text-center text-[#7A8283] text-sm">Carregando histórico...</div>
                  ) : historico.length === 0 ? (
                    <div className="py-12 text-center text-[#7A8283] text-sm">Nenhum lote cadastrado ainda.</div>
                  ) : (
                    <div className="overflow-x-auto">
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
                                    setSubAbaLote('cadastro');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-2.5 py-1 bg-[#F4ECEC] hover:bg-[#EBDDDD] text-[#505859] border border-[#E3D3D2] text-xs font-semibold rounded transition inline-flex items-center space-x-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#9E7372]" />
                                  <span>Reimprimir</span>
                                </button>
                                <a
                                  href={`/${l.codigo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-white hover:bg-[#F4EFEF] text-[#505859] border border-[#E5DFDE] text-xs font-semibold rounded transition inline-flex items-center space-x-1"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-[#7A8283]" />
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
              <div className="flex items-center gap-1 p-1 bg-[#EDE7E6]/80 border border-[#E5DFDE] rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setSubAbaConfig('geral')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    subAbaConfig === 'geral'
                      ? 'bg-[#FCFBFB] text-[#3E4546] shadow-xs'
                      : 'text-[#6E7677] hover:text-[#3E4546]'
                  }`}
                >
                  Consultório e Etiquetas
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaConfig('usuarios')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    subAbaConfig === 'usuarios'
                      ? 'bg-[#FCFBFB] text-[#3E4546] shadow-xs'
                      : 'text-[#6E7677] hover:text-[#3E4546]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#9E7372]" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>

              {subAbaConfig === 'geral' ? (
                <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6">
                  <h2 className="text-lg font-bold text-[#3E4546] mb-4 pb-3 border-b border-[#EDE7E6]">
                    Configurações de Impressão e Consultório
                  </h2>

                  {msgConfigSalva && (
                    <div className="mb-4 p-3 bg-[#EDF5F0] border border-[#C8DFCF] text-[#2E6045] rounded-lg text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{msgConfigSalva}</span>
                    </div>
                  )}

                  <form onSubmit={handleSalvarConfig} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                        Nome do Consultório
                      </label>
                      <input
                        type="text"
                        value={config.nomeConsultorio}
                        onChange={(e) => setConfig({ ...config, nomeConsultorio: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
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
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                        />
                      </div>
                      <div>
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
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                        Dias de Validade Padrão
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={config.diasValidade}
                        onChange={(e) => setConfig({ ...config, diasValidade: Number(e.target.value) })}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988] text-[#3E4546] tabular-nums"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#505859] hover:bg-[#3E4546] text-white font-semibold rounded-lg transition cursor-pointer"
                    >
                      Salvar Configurações
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6">
                    <h2 className="text-lg font-bold text-[#3E4546] mb-1">Cadastrar Novo Usuário</h2>
                    <p className="text-xs text-[#7A8283] mb-5 pb-4 border-b border-[#EDE7E6]">
                      Crie acessos individuais para dentistas e auxiliares. A senha padrão inicial é{' '}
                      <span className="font-mono font-semibold text-[#9E7372]">1234</span>.
                    </p>

                    <form onSubmit={handleCadastrarUsuario} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Usuário (login) *
                        </label>
                        <input
                          type="text"
                          value={novoUsuario}
                          onChange={(e) => setNovoUsuario(e.target.value)}
                          required
                          placeholder="Ex: fabiana ou auxiliar"
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#505859] mb-1.5">
                          Nome Completo (Opcional)
                        </label>
                        <input
                          type="text"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          placeholder="Ex: Dra. Fabiana Bezerra"
                          className="w-full px-4 py-2.5 bg-white border border-[#DCD4D3] rounded-lg text-[#3E4546] focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
                        />
                      </div>

                      <div>
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
                            className="w-full px-4 py-2.5 pr-10 bg-white border border-[#DCD4D3] rounded-lg text-[#3E4546] font-mono focus:outline-none focus:ring-2 focus:ring-[#CDA9A8]/55 focus:border-[#B58988]"
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

                      {erroUsuario && (
                        <div className="p-3 bg-[#F9EDED] border border-[#E8C8C8] text-[#8C3B3B] text-xs rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{erroUsuario}</span>
                        </div>
                      )}

                      {msgUsuarioSucesso && (
                        <div className="p-3 bg-[#EDF5F0] border border-[#C8DFCF] text-[#2E6045] text-xs rounded-lg flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{msgUsuarioSucesso}</span>
                        </div>
                      )}

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
                    <div className="bg-[#FCFBFB] rounded-xl border border-[#E5DFDE] p-6">
                      <h3 className="text-sm font-bold text-[#3E4546] mb-3">Usuários Cadastrados</h3>
                      <div className="divide-y divide-[#EDE7E6]">
                        {usuariosLista.map((u) => (
                          <div key={u.usuario} className="py-2.5 flex items-center justify-between text-sm">
                            <div>
                              <span className="font-semibold text-[#3E4546]">{u.nome}</span>
                              <span className="text-[#CDA9A8] mx-2">·</span>
                              <span className="font-mono text-xs text-[#6E7677]">{u.usuario}</span>
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
