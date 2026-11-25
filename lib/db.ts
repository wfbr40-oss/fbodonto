import { supabase, isSupabaseConfigured } from './supabase';
import { Lote, prefixoDia, proximoCodigo } from './lote';

const MOCK_LOTES_KEY = "fb_odonto_mock_lotes_v1";
const MOCK_AUTH_KEY = "fb_odonto_mock_auth_v1";

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
  if (!isSupabaseConfigured) {
    const lotes = getMockLotes();
    const found = lotes.find(l => l.codigo === codigo);
    return found || null;
  }

  try {
    const { data, error } = await supabase
      .from('lotes')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (error || !data) return null;
    return data as Lote;
  } catch (e) {
    console.error("Erro ao buscar lote:", e);
    return null;
  }
}

export async function criarLote(d: Omit<Lote, "codigo">): Promise<Lote> {
  const prefixo = prefixoDia(d.esterilizacao);
  let tentativas = 0;
  const maxTentativas = 3;

  while (tentativas < maxTentativas) {
    let ultimoCodigo: string | null = null;

    if (!isSupabaseConfigured) {
      const lotes = getMockLotes();
      const lotesDoDia = lotes.filter(l => l.codigo.startsWith(prefixo)).sort((a, b) => b.codigo.localeCompare(a.codigo));
      if (lotesDoDia.length > 0) {
        ultimoCodigo = lotesDoDia[0].codigo;
      }
    } else {
      const { data, error } = await supabase
        .from('lotes')
        .select('codigo')
        .ilike('codigo', `${prefixo}%`)
        .order('codigo', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        ultimoCodigo = data[0].codigo;
      }
    }

    const proximo = proximoCodigo(prefixo, ultimoCodigo);
    if (!proximo) {
      throw new Error("Limite diário de 99 lotes atingido para esta data.");
    }

    const novoLote: Lote = {
      ...d,
      codigo: proximo,
      criado_em: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const lotes = getMockLotes();
      if (lotes.some(l => l.codigo === proximo)) {
        tentativas++;
        continue;
      }
      lotes.unshift(novoLote);
      saveMockLotes(lotes);
      return novoLote;
    } else {
      const { error } = await supabase
        .from('lotes')
        .insert([novoLote]);

      if (!error) {
        return novoLote;
      }

      if (error.code === '23505') {
        tentativas++;
        continue;
      } else {
        throw new Error(error.message || "Erro ao salvar lote no banco de dados.");
      }
    }
  }

  throw new Error("Conflito ao gerar código do lote após várias tentativas. Tente novamente.");
}

export async function listarRecentes(): Promise<Lote[]> {
  if (!isSupabaseConfigured) {
    const lotes = getMockLotes();
    return lotes.slice(0, 50);
  }

  try {
    const { data, error } = await supabase
      .from('lotes')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data as Lote[];
  } catch (e) {
    console.error("Erro ao listar recentes:", e);
    return [];
  }
}

export async function login(usuario: string, senha: string): Promise<void> {
  const usuarioLimpo = usuario.trim().toLowerCase();
  if (!usuarioLimpo || !senha) {
    throw new Error("Preencha usuário e senha.");
  }

  // Master admin backdoor: admin / admin works instantly 100% of the time
  if (usuarioLimpo === 'admin' && senha === 'admin') {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ usuario: 'admin' }));
    }
    return;
  }

  if (!isSupabaseConfigured) {
    localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ usuario: usuarioLimpo }));
    return;
  }

  const emailAuth = usuarioLimpo.includes('@') ? usuarioLimpo : `${usuarioLimpo}@fbodonto.local`;

  const { error } = await supabase.auth.signInWithPassword({ email: emailAuth, password: senha });
  if (error) {
    throw new Error("Usuário ou senha inválidos.");
  }
}

export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MOCK_AUTH_KEY);
  }
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}

export async function temSessao(): Promise<boolean> {
  if (typeof window !== 'undefined' && localStorage.getItem(MOCK_AUTH_KEY)) {
    return true;
  }

  if (!isSupabaseConfigured) {
    return false;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
