export type RegraNumeracao = 'turno_manha_tarde' | 'sequencial';

export type Config = {
  nomeConsultorio: string;
  larguraMm: number;
  alturaMm: number;
  modo: 'avulsa' | 'a4';
  diasValidade: number;
  regraNumeracao: RegraNumeracao;
  horaCorteTarde: number;
};

const CONFIG_KEY = 'fb_odonto_config_v1';

export const CONFIG_PADRAO: Config = {
  nomeConsultorio: 'FB Odonto',
  larguraMm: 50,
  alturaMm: 30,
  modo: 'avulsa',
  diasValidade: 30,
  regraNumeracao: 'turno_manha_tarde',
  horaCorteTarde: 12,
};

export function carregarConfig(): Config {
  if (typeof window === 'undefined') return CONFIG_PADRAO;
  try {
    const salvo = localStorage.getItem(CONFIG_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      return { ...CONFIG_PADRAO, ...parsed };
    }
  } catch (e) {
    console.error('Erro ao carregar config:', e);
  }
  return CONFIG_PADRAO;
}

export function salvarConfig(c: Config): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch (e) {
    console.error('Erro ao salvar config:', e);
  }
}
