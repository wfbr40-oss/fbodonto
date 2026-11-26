import { supabase, isSupabaseConfigured } from './supabase';
import { Lote, prefixoDia, proximoCodigo } from './lote';

const MOCK_LOTES_KEY = 'fb_odonto_mock_lotes_v1';

// Token mantido exclusivamente em memória para complementar o cookie HttpOnly no preview/iframe
let memoryAuthToken: string | null = null;

export type UsuarioRegistrado = {
  usuario: string;
  nome: string;
  role?: 'admin' | 'operador';
  criadoEm: string;
};

function authHeaders(includeContentType = false): HeadersInit {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryAuthToken) {
    headers['Authorization'] = `Bearer ${memoryAuthToken}`;
  }
  return headers;
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
      } else if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
        throw new Error(
          'O Supabase bloqueou a gravação pela política RLS da tabela lotes. Execute o script atualizado em supabase/schema.sql no SQL Editor do Supabase.'
        );
      } else {
        throw new Error(`Erro ao salvar no Supabase: ${error.message}.`);
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

export async function configurarAdminInicial(usuario: string, senha: string): Promise<string> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: authHeaders(true),
    credentials: 'include',
    body: JSON.stringify({ usuario, senha }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Erro ao configurar acesso inicial.');
  }

  memoryAuthToken = payload.token || null;
  return payload.usuario || usuario;
}

export async function login(usuario: string, senha: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: authHeaders(true),
    credentials: 'include',
    body: JSON.stringify({ usuario, senha }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Usuário ou senha inválidos.');
  }

  memoryAuthToken = payload.token || null;
  return payload.usuario || usuario;
}

export async function cadastrarUsuario(params: {
  usuario: string;
  nome?: string;
  senha?: string;
}): Promise<{ usuario: UsuarioRegistrado; storageMode: 'supabase' | 'local' }> {
  const res = await fetch('/api/auth/usuarios', {
    method: 'POST',
    headers: authHeaders(true),
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Erro ao cadastrar usuário.');
  }

  return {
    usuario: payload.usuario as UsuarioRegistrado,
    storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
  };
}

export async function listarUsuarios(): Promise<{
  usuarios: UsuarioRegistrado[];
  storageMode: 'supabase' | 'local';
}> {
  const res = await fetch('/api/auth/usuarios', {
    method: 'GET',
    headers: authHeaders(false),
    credentials: 'include',
  });

  if (!res.ok) return { usuarios: [], storageMode: 'local' };
  const payload = await res.json();
  return {
    usuarios: (payload.usuarios as UsuarioRegistrado[]) || [],
    storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
  };
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authHeaders(false),
      credentials: 'include',
    });
  } finally {
    memoryAuthToken = null;
  }
}

export async function obterSessaoUsuario(): Promise<{
  autenticado: boolean;
  usuario: string | null;
  adminConfigured: boolean;
  storageMode: 'supabase' | 'local';
}> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      headers: authHeaders(false),
      credentials: 'include',
    });
    if (!res.ok) {
      return { autenticado: false, usuario: null, adminConfigured: true, storageMode: 'local' };
    }
    const payload = await res.json();
    return {
      autenticado: Boolean(payload.autenticado),
      usuario: payload.usuario || null,
      adminConfigured: Boolean(payload.adminConfigured),
      storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
    };
  } catch {
    return { autenticado: false, usuario: null, adminConfigured: true, storageMode: 'local' };
  }
}

export async function temSessao(): Promise<boolean> {
  const { autenticado } = await obterSessaoUsuario();
  return autenticado;
}
