'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lote, hojeISO, addDias, formatDataBR, prefixoDia, proximoCodigo } from '@/lib/lote';
import { criarLote, listarRecentes, login, logout, temSessao } from '@/lib/db';
import { carregarConfig, salvarConfig, Config } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase';
import Etiqueta from '@/components/Etiqueta';
import { Printer, LogOut, LogIn, PlusCircle, History, Settings, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export default function CadastroPage() {
  const [autenticado, setAutenticado] = useState<boolean>(false);
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(true);
  
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');

  const [config, setConfig] = useState<Config>(carregarConfig());
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico' | 'config'>('novo');

  const [item, setItem] = useState('');
  const [esterilizacao, setEsterilizacao] = useState(hojeISO());
  const [diasValidade, setDiasValidade] = useState<number>(config.diasValidade);
  const [responsavel, setResponsavel] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);

  const validade = addDias(esterilizacao, diasValidade);

  const [responsaveisSugeridos, setResponsaveisSugeridos] = useState<string[]>([]);
  const [itensSugeridos, setItensSugeridos] = useState<string[]>([]);

  const [historico, setHistorico] = useState<Lote[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState<boolean>(false);

  const [loteCriado, setLoteCriado] = useState<Lote | null>(null);
  const [erroCadastro, setErroCadastro] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);

  const pref = prefixoDia(esterilizacao);
  const lotesDoDia = historico.filter(l => l.codigo.startsWith(pref));
  const ultimo = lotesDoDia.length > 0 ? lotesDoDia[0].codigo : null;
  const proximoCodPrevisto = proximoCodigo(pref, ultimo) || `${pref}01`;

  const carregarDadosHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    const rec = await listarRecentes();
    setHistorico(rec);
    setCarregandoHistorico(false);

    const respSet = Array.from(new Set(rec.map(l => l.responsavel))).filter(Boolean);
    setResponsaveisSugeridos(respSet);

    const itemSet = Array.from(new Set(rec.map(l => l.item))).filter(Boolean);
    setItensSugeridos(itemSet);
  }, []);

  useEffect(() => {
    temSessao().then((sessao) => {
      setAutenticado(sessao);
      setCarregandoAuth(false);
      if (sessao) {
        carregarDadosHistorico();
      }
    });
  }, [carregarDadosHistorico]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLogin('');
    try {
      await login(usuario, senha);
      setAutenticado(true);
      carregarDadosHistorico();
    } catch (err: any) {
      setErroLogin(err.message || 'Erro ao autenticar');
    }
  };

  const handleLogout = async () => {
    await logout();
    setAutenticado(false);
  };

  const handleSalvarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    salvarConfig(config);
    alert('Configurações salvas com sucesso!');
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
        responsavel: responsavel.trim() || 'Equipe'
      });
      setLoteCriado(novo);
      await carregarDadosHistorico();
      setItem('');
    } catch (err: any) {
      setErroCadastro(err.message || 'Erro ao cadastrar lote.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregandoAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 text-sky-600 mb-4 font-bold text-2xl">
              🦷
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
                placeholder="Ex: admin ou dentista"
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
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
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🦷</span>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">{config.nomeConsultorio}</h1>
              <span className="text-xs text-slate-500">Etiquetas de Esterilização</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center space-x-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-5xl mx-auto px-4 flex space-x-6">
          <button
            onClick={() => { setAbaAtiva('novo'); setLoteCriado(null); }}
            className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-2 transition cursor-pointer ${
              abaAtiva === 'novo' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cadastrar Lote</span>
          </button>
          <button
            onClick={() => { setAbaAtiva('historico'); setLoteCriado(null); }}
            className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-2 transition cursor-pointer ${
              abaAtiva === 'historico' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Lotes</span>
          </button>
          <button
            onClick={() => { setAbaAtiva('config'); setLoteCriado(null); }}
            className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-2 transition cursor-pointer ${
              abaAtiva === 'config' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between no-print">
            <div>
              <b>Aviso:</b> Usando armazenamento local (localStorage). Para sincronizar em nuvem (Supabase), configure as variáveis de ambiente .env.
            </div>
          </div>
        )}

        {abaAtiva === 'novo' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 no-print">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <span>Novo Lote de Esterilização</span>
                <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-mono">
                  Próximo: {proximoCodPrevisto}
                </span>
              </h2>

              <form onSubmit={handleCadastrarLote} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Data de Validade Calculada
                    </label>
                    <input
                      type="date"
                      value={validade}
                      readOnly
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-semibold"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Calculada automaticamente (editável via dias)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Quantidade de Etiquetas *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={quantidade}
                      onChange={(e) => setQuantidade(parseInt(e.target.value, 10) || 1)}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">Instruções de Impressão</h3>
                <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                  <li>Configure a impressora térmica ou comum para 100% de escala (sem &quot;ajustar à página&quot;).</li>
                  <li>As dimensões atuais da etiqueta são de {config.larguraMm}mm &times; {config.alturaMm}mm.</li>
                  <li>O código do lote serve como link curto para leitura via QR Code.</li>
                </ul>
              </div>

              {loteCriado && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900">
                  <div className="flex items-center space-x-2 mb-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Lote {loteCriado.codigo} Cadastrado!</span>
                  </div>
                  <p className="text-xs text-emerald-700 mb-3">
                    As {quantidade} etiquetas abaixo estão prontas para impressão ou você pode acessar o link público.
                  </p>
                  <div className="flex justify-center bg-white/80 rounded-xl p-3 border border-emerald-200 mb-4 overflow-hidden">
                    <Etiqueta
                      lote={loteCriado}
                      larguraMm={config.larguraMm}
                      alturaMm={config.alturaMm}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow text-xs flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir Etiquetas</span>
                    </button>
                    <a
                      href={`/${loteCriado.codigo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs flex items-center space-x-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Cartão</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'historico' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Histórico de Lotes Cadastrados</h2>
            {carregandoHistorico ? (
              <div className="py-12 text-center text-slate-500">Carregando histórico...</div>
            ) : historico.length === 0 ? (
              <div className="py-12 text-center text-slate-500">Nenhum lote cadastrado ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600 font-bold">
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
                        <td className="p-3 font-mono font-bold text-slate-900">{l.codigo}</td>
                        <td className="p-3 font-semibold">{l.item || <span className="text-slate-400 font-normal italic">—</span>}</td>
                        <td className="p-3">{formatDataBR(l.esterilizacao)}</td>
                        <td className="p-3">{formatDataBR(l.validade)}</td>
                        <td className="p-3 text-slate-600">{l.responsavel}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setLoteCriado(l);
                              setQuantidade(1);
                              setAbaAtiva('novo');
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

        {abaAtiva === 'config' && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configurações de Impressão e Consultório</h2>
            <form onSubmit={handleSalvarConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Largura da Etiqueta (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="150"
                    value={config.larguraMm}
                    onChange={(e) => setConfig({ ...config, larguraMm: Number(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Altura da Etiqueta (mm)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="100"
                    value={config.alturaMm}
                    onChange={(e) => setConfig({ ...config, alturaMm: Number(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Dias de Validade Padrão
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={config.diasValidade}
                  onChange={(e) => setConfig({ ...config, diasValidade: Number(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900"
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
  );
}
