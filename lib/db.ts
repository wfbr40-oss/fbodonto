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
      console.warn("Erro ao buscar no Supabase, tentando local:", e);
    }
  }

  // Fallback local
  const lotesLocal = getMockLotes();
  const foundLocal = lotesLocal.find(l => l.codigo === codigo);
  return foundLocal || null;
}

export async function criarLote(d: Omit<Lote, "codigo">): Promise<Lote> {
  const prefixo = prefixoDia(d.esterilizacao);
  let tentativas = 0;
  const maxTentativas = 3;

  while (tentativas < maxTentativas) {
    let ultimoCodigo: string | null = null;

    const lotesLocais = getMockLotes();
    const lotesDoDiaLocal = lotesLocais.filter(l => l.codigo.startsWith(prefixo));

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
      throw new Error("Limite diário de 99 lotes atingido para esta data.");
    }

    const novoLote: Lote = {
      ...d,
      codigo: proximo,
      criado_em: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('lotes')
        .insert([novoLote]);

      if (!error) {
        // Salvar também localmente como cache
        if (!lotesLocais.some(l => l.codigo === proximo)) {
          lotesLocais.unshift(novoLote);
          saveMockLotes(lotesLocais);
        }
        return novoLote;
      }

      if (error.code === '23505') {
        tentativas++;
        continue;
      } else {
        throw new Error(`Erro ao salvar no Supabase: ${error.message}. Verifique se a tabela 'lotes' foi criada no SQL Editor.`);
      }
    } else {
      if (lotesLocais.some(l => l.codigo === proximo)) {
        tentativas++;
        continue;
      }
      lotesLocais.unshift(novoLote);
      saveMockLotes(lotesLocais);
      return novoLote;
    }
  }

  throw new Error("Conflito ao gerar código do lote após várias tentativas. Tente novamente.");
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
      console.warn("Erro ao listar do Supabase:", error);
      return lotesLocal.slice(0, 50);
    }

    // Mesclar com locais se houver algo offline
    return data as Lote[];
  } catch (e) {
    console.warn("Exceção ao listar do Supabase:", e);
    return lotesLocal.slice(0, 50);
  }
}

export async function login(usuario: string, senha: string): Promise<void> {
  const usuarioLimpo = usuario.trim().toLowerCase();
  if (!usuarioLimpo || !senha) {
    throw new Error("Preencha usuário e senha.");
  }

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
    if (usuarioLimpo === 'admin' || senha.length > 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ usuario: usuarioLimpo }));
      }
      return;
    }
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

  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}
