export type Lote = {
  codigo: string;
  item: string;
  esterilizacao: string; // AAAA-MM-DD
  validade: string;     // AAAA-MM-DD
  responsavel: string;
  criado_em?: string;
};

export function prefixoDia(iso: string): string {
  return iso.replace(/-/g, '');
}

export function proximoCodigo(prefixo: string, ultimo: string | null): string | null {
  if (!ultimo) {
    return prefixo + "01";
  }
  const seqStr = ultimo.slice(8);
  const seq = parseInt(seqStr, 10);
  if (isNaN(seq) || seq >= 99) {
    return null;
  }
  const proximoSeq = (seq + 1).toString().padStart(2, '0');
  return prefixo + proximoSeq;
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.VITE_BASE_URL || 'https://fbodonto.vercel.app';
}

export function buildLink(codigo: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}/${codigo}`;
}

export function formatDataBR(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function addDias(iso: string, dias: number): string {
  const [anoStr, mesStr, diaStr] = iso.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const dia = parseInt(diaStr, 10);

  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return iso;

  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  dataUtc.setUTCDate(dataUtc.getUTCDate() + dias);

  const y = dataUtc.getUTCFullYear();
  const m = String(dataUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dataUtc.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

export function hojeISO(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function statusValidade(l: Lote, hoje = hojeISO()): "valido" | "vencido" {
  return l.validade >= hoje ? "valido" : "vencido";
}
