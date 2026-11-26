import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { Lote, prefixoDia, proximoCodigo } from './lote';

const MOCK_LOTES_KEY = 'fb_odonto_mock_lotes_v1';
const MOCK_AUTH_KEY = 'fb_odonto_mock_auth_v1';
const MOCK_USERS_KEY = 'fb_odonto_mock_users_v1';
const SUPABASE_AUTH_DOMAIN = 'fbodonto.com.br';
const SHORT_PASSWORD_SUFFIX = '__fbodonto';

export type UsuarioRegistrado = {
  usuario: string;
  nome: string;
  criadoEm: string;
  requerConfirmacao?: boolean;
};

type UsuarioLocal = {
  usuario: string;
  nome: string;
  senha: string;
  criadoEm: string;
};

function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase().replace(/\s+/g, '');
}

function toEmailAuth(usuarioLimpo: string): string {
  return usuarioLimpo.includes('@') ? usuarioLimpo : `${usuarioLimpo}@${SUPABASE_AUTH_DOMAIN}`;
}

function normalizarSenhaSupabase(senha: string): string {
  return senha.length < 6 ? `${senha}${SHORT_PASSWORD_SUFFIX}` : senha;
}

function criarClienteEfemero() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getMockUsers(): UsuarioLocal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (raw) {
      return JSON.parse(raw) as UsuarioLocal[];
    }
  } catch {
    // ignore parse error
  }
  const inicial: UsuarioLocal[] = [
    {
      usuario: 'admin',
      nome: 'Administrador',
      senha: 'admin',
      criadoEm: new Date().toISOString(),
    },
  ];
  try {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(inicial));
  } catch {}
  return inicial;
}

function saveMockUsers(users: UsuarioLocal[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  } catch {}
}

function getMockLotes(): Lote[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(MOCK_LOTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMockLotes(lotes: Lote[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MOCK_LOTES_KEY, JSON.stringify(lotes));
  } catch {}
}

export async function getLote(codigo: string): Promise<Lote | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('codigo', codigo)
        .single();

      if (!error && data) {
        return data as Lote;
      }
    } catch (e) {
      console.warn('Erro ao buscar no Supabase, tentando local:', e);
    }
  }

  const lotesLocal = getMockLotes();
  const foundLocal = lotesLocal.find((l) => l.codigo === codigo);
  return foundLocal || null;
}

export async function criarLote(d: Omit<Lote, 'codigo'>): Promise<Lote> {
  const prefixo = prefixoDia(d.esterilizacao);
  let tentativas = 0;
  const maxTentativas = 3;

  while (tentativas < maxTentativas) {
    let ultimoCodigo: string | null = null;

    const lotesLocais = getMockLotes();
    const lotesDoDiaLocal = lotesLocais.filter((l) => l.codigo.startsWith(prefixo));

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('lotes')
          .select('codigo')
          .ilike('codigo', `${prefixo}%`)
          .order('codigo', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          ultimoCodigo = data[0].codigo;
        } else if (lotesDoDiaLocal.length > 0) {
          const sortedLocal = [...lotesDoDiaLocal].sort((a, b) => b.codigo.localeCompare(a.codigo));
          ultimoCodigo = sortedLocal[0].codigo;
        }
      } catch {
        if (lotesDoDiaLocal.length > 0) {
          const sortedLocal = [...lotesDoDiaLocal].sort((a, b) => b.codigo.localeCompare(a.codigo));
          ultimoCodigo = sortedLocal[0].codigo;
        }
      }
    } else {
      const lotesDoDia = [...lotesDoDiaLocal].sort((a, b) => b.codigo.localeCompare(a.codigo));
      if (lotesDoDia.length > 0) {
        ultimoCodigo = lotesDoDia[0].codigo;
      }
    }

    const proximo = proximoCodigo(prefixo, ultimoCodigo);
    if (!proximo) {
      throw new Error('Limite diário de 99 lotes atingido para esta data.');
    }

    const novoLote: Lote = {
      ...d,
      codigo: proximo,
      criado_em: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('lotes').insert([novoLote]);

      if (!error) {
        if (!lotesLocais.some((l) => l.codigo === proximo)) {
          lotesLocais.unshift(novoLote);
          saveMockLotes(lotesLocais);
        }
        return novoLote;
      }

      if (error.code === '23505') {
        tentativas++;
        continue;
      } else {
        throw new Error(`Erro ao salvar no Supabase (RLS/Auth): ${error.message}.`);
      }
    } else {
      if (lotesLocais.some((l) => l.codigo === proximo)) {
        tentativas++;
        continue;
      }
      lotesLocais.unshift(novoLote);
      saveMockLotes(lotesLocais);
      return novoLote;
    }
  }

  throw new Error('Conflito ao gerar código do lote após várias tentativas. Tente novamente.');
}

export async function listarRecentes(): Promise<Lote[]> {
  const lotesLocal = getMockLotes();
  if (!isSupabaseConfigured) {
    return lotesLocal.slice(0, 50);
  }

  try {
    const { data, error } = await supabase
      .from('lotes')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error || !data) {
      return lotesLocal.slice(0, 50);
    }

    return data as Lote[];
  } catch {
    return lotesLocal.slice(0, 50);
  }
}

export async function login(usuario: string, senha: string): Promise<string> {
  const usuarioLimpo = normalizarUsuario(usuario);
  if (!usuarioLimpo || !senha) {
    throw new Error('Preencha usuário e senha.');
  }

  if (!isSupabaseConfigured) {
    const users = getMockUsers();
    const encontrado = users.find((u) => u.usuario === usuarioLimpo && u.senha === senha);
    if (!encontrado) {
      throw new Error('Usuário ou senha inválidos.');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        MOCK_AUTH_KEY,
        JSON.stringify({ usuario: encontrado.usuario, nome: encontrado.nome })
      );
    }
    return encontrado.nome || encontrado.usuario;
  }

  const emailAuth = toEmailAuth(usuarioLimpo);
  const senhaNormalizada = normalizarSenhaSupabase(senha);

  let { data, error } = await supabase.auth.signInWithPassword({
    email: emailAuth,
    password: senhaNormalizada,
  });

  // Fallback para senhas >= 6 criadas diretamente no painel do Supabase
  if (error && senhaNormalizada !== senha) {
    const retryDirect = await supabase.auth.signInWithPassword({
      email: emailAuth,
      password: senha,
    });
    if (!retryDirect.error) {
      data = retryDirect.data;
      error = null;
    }
  }

  // Bootstrap automático apenas para o usuário padrão admin / admin caso ainda não exista no Supabase
  if (error && usuarioLimpo === 'admin' && senha === 'admin' && !error.message.toLowerCase().includes('confirmed')) {
    const signUpRes = await supabase.auth.signUp({
      email: emailAuth,
      password: senhaNormalizada,
      options: {
        data: { username: 'admin', nome: 'Administrador', role: 'admin' },
      },
    });
    if (!signUpRes.error && signUpRes.data.user && signUpRes.data.session) {
      data = { user: signUpRes.data.user, session: signUpRes.data.session };
      error = null;
    } else if (!signUpRes.error && signUpRes.data.user && !signUpRes.data.session) {
      throw new Error(
        'Usuário admin criado no Supabase, mas o login aguarda confirmação de e-mail. Desative "Confirm email" em Authentication > Providers > Email no painel do Supabase ou execute o SQL de confirmação.'
      );
    }
  }

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error(
        'O usuário existe no Supabase, mas o e-mail ainda não foi confirmado. Desative "Confirm email" em Authentication > Providers > Email no painel do Supabase.'
      );
    }
    throw new Error('Usuário ou senha inválidos no Supabase.');
  }

  const nomeExibicao =
    (data.user?.user_metadata?.nome as string) ||
    (data.user?.user_metadata?.username as string) ||
    usuarioLimpo;

  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ usuario: usuarioLimpo, nome: nomeExibicao }));
  }

  return nomeExibicao;
}

export async function cadastrarUsuario(params: {
  usuario: string;
  nome?: string;
  senha?: string;
}): Promise<UsuarioRegistrado> {
  const usuarioLimpo = normalizarUsuario(params.usuario);
  const nomeLimpo = params.nome?.trim() || usuarioLimpo;
  const senhaFinal = (params.senha ?? '1234').trim() || '1234';

  if (!usuarioLimpo || usuarioLimpo.length < 2) {
    throw new Error('Informe um nome de usuário válido (mínimo 2 caracteres).');
  }

  if (senhaFinal.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  if (!isSupabaseConfigured) {
    const users = getMockUsers();
    if (users.some((u) => u.usuario === usuarioLimpo)) {
      throw new Error('Este usuário já está cadastrado.');
    }
    const novo: UsuarioLocal = {
      usuario: usuarioLimpo,
      nome: nomeLimpo,
      senha: senhaFinal,
      criadoEm: new Date().toISOString(),
    };
    users.push(novo);
    saveMockUsers(users);
    return {
      usuario: novo.usuario,
      nome: novo.nome,
      criadoEm: novo.criadoEm,
      requerConfirmacao: false,
    };
  }

  const emailAuth = toEmailAuth(usuarioLimpo);
  const senhaSupabase = normalizarSenhaSupabase(senhaFinal);
  const clientEfemero = criarClienteEfemero();

  const { data, error } = await clientEfemero.auth.signUp({
    email: emailAuth,
    password: senhaSupabase,
    options: {
      data: {
        username: usuarioLimpo,
        nome: nomeLimpo,
        role: 'operador',
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      throw new Error('Este usuário já está cadastrado no Supabase.');
    }
    throw new Error(`Erro ao cadastrar usuário no Supabase: ${error.message}`);
  }

  const registrado: UsuarioRegistrado = {
    usuario: usuarioLimpo,
    nome: nomeLimpo,
    criadoEm: new Date().toISOString(),
    requerConfirmacao: Boolean(data.user && !data.session),
  };

  // Mantém registro local auxiliar para exibição na tela de configurações
  const users = getMockUsers();
  if (!users.some((u) => u.usuario === usuarioLimpo)) {
    users.push({
      usuario: usuarioLimpo,
      nome: nomeLimpo,
      senha: '',
      criadoEm: registrado.criadoEm,
    });
    saveMockUsers(users);
  }

  return registrado;
}

export function listarUsuariosLocais(): UsuarioRegistrado[] {
  return getMockUsers().map((u) => ({
    usuario: u.usuario,
    nome: u.nome,
    criadoEm: u.criadoEm,
  }));
}

export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MOCK_AUTH_KEY);
  }
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}

export async function obterSessaoUsuario(): Promise<{ autenticado: boolean; usuario: string | null }> {
  if (!isSupabaseConfigured) {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(MOCK_AUTH_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { usuario?: string; nome?: string };
          return {
            autenticado: true,
            usuario: parsed.nome || parsed.usuario || 'admin',
          };
        }
      } catch {}
    }
    return { autenticado: false, usuario: null };
  }

  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(MOCK_AUTH_KEY);
      }
      return { autenticado: false, usuario: null };
    }
    const meta = session.user?.user_metadata as { nome?: string; username?: string } | undefined;
    const nome = meta?.nome || meta?.username || session.user?.email?.split('@')[0] || 'Usuário';
    return { autenticado: true, usuario: nome };
  } catch {
    return { autenticado: false, usuario: null };
  }
}

export async function temSessao(): Promise<boolean> {
  const { autenticado } = await obterSessaoUsuario();
  return autenticado;
}
