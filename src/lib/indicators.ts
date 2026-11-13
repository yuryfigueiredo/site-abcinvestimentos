import { SITE_CONFIG } from '../config/site';

export interface Indicators {
  selic: number;
  cdi: number;
  poupanca: number;
  ipca12m: number;
  dolar: number;
  ibovespa: number;
  ifix: number;
  updatedAt: string;
  source: 'bcb-sgs-live' | 'fallback';
}

interface BcbObservation {
  value: number;
  date: string;
}

async function fetchBcbLastValue(serieCode: number): Promise<BcbObservation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados/ultimos/1?formato=json`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(data) || !data[0]?.valor) return null;
    const parsed = Number(String(data[0].valor).replace(',', '.'));
    return Number.isFinite(parsed) ? { value: parsed, date: data[0].data } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A Meta Selic (SGS 432) é publicada com datas futuras, já valendo para o próximo
 * período do Copom. Usar essa data como "atualizado em" jogaria o carimbo para a
 * frente, então ficamos com a observação realizada mais recente entre as séries.
 */
function latestRealizedDate(observations: Array<BcbObservation | null>): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const dates = observations
    .map((o) => /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(o?.date ?? ''))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => `${m[3]}-${m[2]}-${m[1]}`)
    .filter((iso) => iso <= today)
    .sort();

  const latest = dates.at(-1);
  if (!latest) return null;
  const [year, month, day] = latest.split('-');
  return `${day}/${month}/${year}`;
}

async function load(): Promise<Indicators> {
  const [selic, cdi, ipca12m, dolar] = await Promise.all([
    fetchBcbLastValue(432),
    fetchBcbLastValue(4389),
    fetchBcbLastValue(13522),
    fetchBcbLastValue(1),
  ]);

  const selicVal = selic?.value ?? SITE_CONFIG.defaultIndicators.selic;
  // Regra oficial da poupança: Selic > 8,5% a.a. => 0,5% a.m. (6,17% a.a.) + TR anualizada.
  const poupancaVal =
    selicVal > 8.5
      ? Number((6.17 + (SITE_CONFIG.defaultIndicators.trAnual || 0.95)).toFixed(2))
      : Number((selicVal * 0.7).toFixed(2));

  return {
    selic: selicVal,
    cdi: cdi?.value ?? SITE_CONFIG.defaultIndicators.cdi,
    poupanca: poupancaVal,
    ipca12m: ipca12m?.value ?? SITE_CONFIG.defaultIndicators.ipca12m,
    dolar: dolar?.value ?? SITE_CONFIG.defaultIndicators.dolar,
    ibovespa: SITE_CONFIG.defaultIndicators.ibovespa,
    ifix: SITE_CONFIG.defaultIndicators.ifix,
    updatedAt: latestRealizedDate([selic, cdi, ipca12m, dolar]) ?? SITE_CONFIG.defaultIndicators.updatedAt,
    source: selic !== null || cdi !== null ? 'bcb-sgs-live' : 'fallback',
  };
}

let cached: Promise<Indicators> | null = null;

/** Uma única coleta por build, compartilhada entre o endpoint, as páginas e o Ticker. */
export function getIndicators(): Promise<Indicators> {
  if (!cached) cached = load();
  return cached;
}