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
const LOCAL_MIGRATED_60X25_KEY = 'fb_odonto_local_migrated_60x25';

export const CONFIG_PADRAO: Config = {
  nomeConsultorio: 'FB Odonto',
  larguraMm: 60,
  alturaMm: 25,
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
      const merged: Config = { ...CONFIG_PADRAO, ...parsed };
      if (!localStorage.getItem(LOCAL_MIGRATED_60X25_KEY)) {
        localStorage.setItem(LOCAL_MIGRATED_60X25_KEY, '1');
        if (merged.larguraMm === 50 && merged.alturaMm === 30) {
          const atualizado: Config = {
            ...merged,
            larguraMm: CONFIG_PADRAO.larguraMm,
            alturaMm: CONFIG_PADRAO.alturaMm,
          };
          localStorage.setItem(CONFIG_KEY, JSON.stringify(atualizado));
          return atualizado;
        }
      }
      return merged;
    }
    localStorage.setItem(LOCAL_MIGRATED_60X25_KEY, '1');
  } catch (e) {
    console.error('Erro ao carregar config:', e);
  }
  return CONFIG_PADRAO;
}

export function salvarConfig(c: Config): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    localStorage.setItem(LOCAL_MIGRATED_60X25_KEY, '1');
  } catch (e) {
    console.error('Erro ao salvar config:', e);
  }
}
