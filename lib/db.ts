import { supabase, isSupabaseConfigured } from './supabase';
import { Lote, TurnoLote, codigoPorTurno, prefixoDia, proximoCodigo } from './lote';
import { Config, CONFIG_PADRAO, RegraNumeracao, carregarConfig, salvarConfig } from './config';

const MOCK_LOTES_KEY = 'fb_odonto_mock_lotes_v1';

// Token mantido exclusivamente em memória para complementar o cookie HttpOnly no preview/iframe
let memoryAuthToken: string | null = null;

export type CargoUsuario = 'administrador' | 'usuario' | 'cliente';

export function normalizarCargoCliente(role?: string | null): CargoUsuario {
  const limpo = (role || '').trim().toLowerCase();
  if (limpo === 'admin' || limpo === 'administrador') return 'administrador';
  if (limpo === 'cliente') return 'cliente';
  return 'usuario';
}

export type UsuarioRegistrado = {
  usuario: string;
  nome: string;
  role: CargoUsuario;
  criadoEm: string;
  protegido?: boolean;
};

type ConfigRow = {
  id: string;
  nome_consultorio: string;
  largura_mm: number;
  altura_mm: number;
  modo: string;
  dias_validade: number;
  regra_numeracao: string;
  hora_corte_tarde: number;
};

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

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

function mapConfigRow(row: ConfigRow): Config {
  return {
    nomeConsultorio: row.nome_consultorio || CONFIG_PADRAO.nomeConsultorio,
    larguraMm: Number(row.largura_mm) || CONFIG_PADRAO.larguraMm,
    alturaMm: Number(row.altura_mm) || CONFIG_PADRAO.alturaMm,
    modo: row.modo === 'a4' ? 'a4' : 'avulsa',
    diasValidade: Number(row.dias_validade) || CONFIG_PADRAO.diasValidade,
    regraNumeracao: row.regra_numeracao === 'sequencial' ? 'sequencial' : 'turno_manha_tarde',
    horaCorteTarde:
      typeof row.hora_corte_tarde === 'number' && row.hora_corte_tarde >= 0 && row.hora_corte_tarde <= 23
        ? row.hora_corte_tarde
        : CONFIG_PADRAO.horaCorteTarde,
  };
}

export async function carregarConfigNuvem(): Promise<{
  config: Config;
  storageMode: 'supabase' | 'local';
}> {
  const local = carregarConfig();
  if (!isSupabaseConfigured) {
    return { config: local, storageMode: 'local' };
  }

  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error) {
      if (data) {
        let mapped = mapConfigRow(data as ConfigRow);
        if (typeof window !== 'undefined') {
          const cloudMigratedKey = 'fb_odonto_cloud_migrated_60x25';
          try {
            if (!localStorage.getItem(cloudMigratedKey)) {
              localStorage.setItem(cloudMigratedKey, '1');
              if (mapped.larguraMm === 50 && mapped.alturaMm === 30) {
                mapped = {
                  ...mapped,
                  larguraMm: CONFIG_PADRAO.larguraMm,
                  alturaMm: CONFIG_PADRAO.alturaMm,
                };
                void supabase
                  .from('configuracoes')
                  .update({
                    largura_mm: CONFIG_PADRAO.larguraMm,
                    altura_mm: CONFIG_PADRAO.alturaMm,
                    atualizado_em: new Date().toISOString(),
                  })
                  .eq('id', 'default');
              }
            }
          } catch {}
        }
        salvarConfig(mapped);
        return { config: mapped, storageMode: 'supabase' };
      }
      return { config: local, storageMode: 'supabase' };
    }

    if (!isMissingTableError(error)) {
      console.warn('Erro ao carregar configurações do Supabase:', error.message);
    }
  } catch (e) {
    console.warn('Falha ao conectar no Supabase para configuracoes:', e);
  }

  return { config: local, storageMode: 'local' };
}

export async function salvarConfigNuvem(c: Config): Promise<{
  config: Config;
  storageMode: 'supabase' | 'local';
}> {
  salvarConfig(c);
  if (!isSupabaseConfigured) {
    return { config: c, storageMode: 'local' };
  }

  try {
    const payload = {
      id: 'default',
      nome_consultorio: c.nomeConsultorio.trim() || CONFIG_PADRAO.nomeConsultorio,
      largura_mm: Math.min(150, Math.max(20, Number(c.larguraMm) || 60)),
      altura_mm: Math.min(100, Math.max(15, Number(c.alturaMm) || 25)),
      modo: c.modo === 'a4' ? 'a4' : 'avulsa',
      dias_validade: Math.min(365, Math.max(1, Number(c.diasValidade) || 30)),
      regra_numeracao: (c.regraNumeracao === 'sequencial' ? 'sequencial' : 'turno_manha_tarde') as RegraNumeracao,
      hora_corte_tarde: Math.min(23, Math.max(0, Number(c.horaCorteTarde ?? 12))),
      atualizado_em: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert([payload], { onConflict: 'id' })
      .select('*')
      .single();

    if (!error && data) {
      const mapped = mapConfigRow(data as ConfigRow);
      salvarConfig(mapped);
      return { config: mapped, storageMode: 'supabase' };
    }

    if (!isMissingTableError(error)) {
      throw new Error(error?.message || 'Erro ao salvar configurações no Supabase.');
    }
  } catch (err) {
    if (err instanceof Error && !err.message.toLowerCase().includes('does not exist')) {
      throw err;
    }
  }

  return { config: c, storageMode: 'local' };
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

export type CriarLoteOpcoes = {
  regraNumeracao?: RegraNumeracao;
  turno?: TurnoLote;
  horaCorteTarde?: number;
};

export async function criarLote(
  d: Omit<Lote, 'codigo'>,
  opcoes: CriarLoteOpcoes = {}
): Promise<Lote> {
  const prefixo = prefixoDia(d.esterilizacao);
  const regra = opcoes.regraNumeracao || 'turno_manha_tarde';
  const horaCorte = opcoes.horaCorteTarde ?? 12;

  if (regra === 'turno_manha_tarde') {
    const { codigo } = codigoPorTurno(prefixo, opcoes.turno || 'auto', horaCorte);
    const novoLote: Lote = {
      ...d,
      codigo,
      criado_em: new Date().toISOString(),
    };

    const lotesLocais = getMockLotes().filter((l) => l.codigo !== codigo);
    lotesLocais.unshift(novoLote);

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('lotes')
        .upsert([novoLote], { onConflict: 'codigo' });

      if (!error) {
        saveMockLotes(lotesLocais);
        return novoLote;
      }

      if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
        throw new Error(
          'O Supabase bloqueou a gravação pela política RLS da tabela lotes. Execute o script atualizado em supabase/schema.sql no SQL Editor do Supabase.'
        );
      }
      throw new Error(`Erro ao salvar no Supabase: ${error.message}.`);
    } else {
      saveMockLotes(lotesLocais);
      return novoLote;
    }
  }

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

export async function configurarAdminInicial(
  usuario: string,
  senha: string
): Promise<{ usuario: string; usuarioLogin: string; role: CargoUsuario }> {
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
  return {
    usuario: payload.usuario || usuario,
    usuarioLogin: payload.usuarioLogin || usuario,
    role: normalizarCargoCliente(payload.role || 'administrador'),
  };
}

export async function login(
  usuario: string,
  senha: string
): Promise<{ usuario: string; usuarioLogin: string; role: CargoUsuario }> {
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
  return {
    usuario: payload.usuario || usuario,
    usuarioLogin: payload.usuarioLogin || usuario,
    role: normalizarCargoCliente(payload.role),
  };
}

export async function cadastrarUsuario(params: {
  usuario: string;
  nome?: string;
  senha?: string;
  role?: CargoUsuario;
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
    usuario: {
      ...(payload.usuario as UsuarioRegistrado),
      role: normalizarCargoCliente(payload.usuario?.role),
    },
    storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
  };
}

export async function atualizarUsuario(params: {
  usuarioAtual: string;
  novoUsuario?: string;
  nome?: string;
  role?: CargoUsuario;
  novaSenha?: string;
}): Promise<{
  usuario: UsuarioRegistrado;
  storageMode: 'supabase' | 'local';
  credentialsChanged: boolean;
}> {
  const res = await fetch('/api/auth/usuarios', {
    method: 'PATCH',
    headers: authHeaders(true),
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Erro ao atualizar usuário.');
  }

  return {
    usuario: {
      ...(payload.usuario as UsuarioRegistrado),
      role: normalizarCargoCliente(payload.usuario?.role),
    },
    storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
    credentialsChanged: Boolean(payload.credentialsChanged),
  };
}

export async function excluirUsuario(
  usuario: string
): Promise<{ storageMode: 'supabase' | 'local' }> {
  const res = await fetch('/api/auth/usuarios', {
    method: 'DELETE',
    headers: authHeaders(true),
    credentials: 'include',
    body: JSON.stringify({ usuario }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Erro ao excluir usuário.');
  }

  return {
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
  const lista = ((payload.usuarios as UsuarioRegistrado[]) || []).map((u) => ({
    ...u,
    role: normalizarCargoCliente(u.role),
  }));
  return {
    usuarios: lista,
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
  usuarioLogin: string | null;
  role: CargoUsuario | null;
  adminConfigured: boolean;
  storageMode: 'supabase' | 'local';
}> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      cache: 'no-store',
      headers: authHeaders(false),
      credentials: 'include',
    });
    if (!res.ok) {
      return {
        autenticado: false,
        usuario: null,
        usuarioLogin: null,
        role: null,
        adminConfigured: true,
        storageMode: 'local',
      };
    }
    const payload = await res.json();
    const autenticado = Boolean(payload.autenticado);
    if (autenticado && typeof payload.token === 'string' && payload.token) {
      memoryAuthToken = payload.token;
    } else if (!autenticado) {
      memoryAuthToken = null;
    }
    return {
      autenticado,
      usuario: payload.usuario || null,
      usuarioLogin: payload.usuarioLogin || null,
      role: autenticado ? normalizarCargoCliente(payload.role) : null,
      adminConfigured: Boolean(payload.adminConfigured),
      storageMode: payload.storageMode === 'supabase' ? 'supabase' : 'local',
    };
  } catch {
    return {
      autenticado: false,
      usuario: null,
      usuarioLogin: null,
      role: null,
      adminConfigured: true,
      storageMode: 'local',
    };
  }
}

export async function temSessao(): Promise<boolean> {
  const { autenticado } = await obterSessaoUsuario();
  return autenticado;
}
