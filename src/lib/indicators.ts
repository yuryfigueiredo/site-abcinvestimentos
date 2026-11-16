import { SITE_CONFIG } from '../config/site';
import { formatPct } from './finance';

export type IndicatorOrigin = 'bcb-sgs' | 'config-fallback' | 'formula';

export interface Indicators {
  selic: number;
  cdi: number;
  poupanca: number;
  ipca12m: number;
  dolar: number;
  updatedAt: string;
  origins: {
    selic: IndicatorOrigin;
    cdi: IndicatorOrigin;
    ipca12m: IndicatorOrigin;
    dolar: IndicatorOrigin;
    poupanca: 'formula';
  };
  poupancaRule:
    | { basis: 'tr'; trAnualPct: number; referencia: string }
    | { basis: 'selic-70'; selicUsada: number };
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

  const originOf = (observation: BcbObservation | null): IndicatorOrigin =>
    observation !== null ? 'bcb-sgs' : 'config-fallback';

  const selicVal = selic?.value ?? SITE_CONFIG.defaultIndicators.selic;

  // Regra oficial da poupança: Selic > 8,5% a.a. => 0,5% a.m. (6,17% a.a.) + TR anualizada,
  // abaixo disso => 70% da Selic. A TR não é uma série consultada aqui, é referência datada.
  const { annualPct: trAnualPct, referencia } = SITE_CONFIG.poupancaTrReference;
  const poupancaRule: Indicators['poupancaRule'] =
    selicVal > 8.5
      ? { basis: 'tr', trAnualPct, referencia }
      : { basis: 'selic-70', selicUsada: selicVal };

  const poupancaVal =
    poupancaRule.basis === 'tr'
      ? Number((6.17 + poupancaRule.trAnualPct).toFixed(2))
      : Number((poupancaRule.selicUsada * 0.7).toFixed(2));

  return {
    selic: selicVal,
    cdi: cdi?.value ?? SITE_CONFIG.defaultIndicators.cdi,
    poupanca: poupancaVal,
    ipca12m: ipca12m?.value ?? SITE_CONFIG.defaultIndicators.ipca12m,
    dolar: dolar?.value ?? SITE_CONFIG.defaultIndicators.dolar,
    updatedAt: latestRealizedDate([selic, cdi, ipca12m, dolar]) ?? SITE_CONFIG.defaultIndicators.updatedAt,
    origins: {
      selic: originOf(selic),
      cdi: originOf(cdi),
      ipca12m: originOf(ipca12m),
      dolar: originOf(dolar),
      poupanca: 'formula',
    },
    poupancaRule,
  };
}

/** Única cópia da frase de origem da Poupança: a barra e as páginas leem daqui, nunca à mão. */
export function poupancaReferenceText(ind: Indicators): string {
  return ind.poupancaRule.basis === 'tr'
    ? `Poupança = 0,5% a.m. + TR (TR de referência ${ind.poupancaRule.referencia})`
    : `Poupança = 70% da Selic de ${formatPct(ind.poupancaRule.selicUsada)} a.a.`;
}

let cached: Promise<Indicators> | null = null;

/** Uma única coleta por build, compartilhada entre o endpoint, as páginas e o Ticker. */
export function getIndicators(): Promise<Indicators> {
  if (!cached) cached = load();
  return cached;
}