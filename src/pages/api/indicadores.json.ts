import type { APIRoute } from 'astro';
import { SITE_CONFIG } from '../../config/site';

async function fetchBcbLastValue(serieCode: number): Promise<number | null> {
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
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const GET: APIRoute = async () => {
  const [selic, cdi, ipca12m, dolar] = await Promise.all([
    fetchBcbLastValue(432),
    fetchBcbLastValue(4389),
    fetchBcbLastValue(13522),
    fetchBcbLastValue(1),
  ]);

  const selicVal = selic ?? SITE_CONFIG.defaultIndicators.selic;
  // Regra Oficial da Poupança: se Selic > 8,5% ao ano => 0,5% a.m. (6,17% a.a.) + TR anualizada
  const poupancaVal =
    selicVal > 8.5
      ? Number((6.17 + (SITE_CONFIG.defaultIndicators.trAnual || 0.95)).toFixed(2))
      : Number((selicVal * 0.7).toFixed(2));

  const payload = {
    selic: selicVal,
    cdi: cdi ?? SITE_CONFIG.defaultIndicators.cdi,
    poupanca: poupancaVal,
    ipca12m: ipca12m ?? SITE_CONFIG.defaultIndicators.ipca12m,
    dolar: dolar ?? SITE_CONFIG.defaultIndicators.dolar,
    ibovespa: SITE_CONFIG.defaultIndicators.ibovespa,
    ifix: SITE_CONFIG.defaultIndicators.ifix,
    updatedAt: new Date().toLocaleDateString('pt-BR'),
    source: selic !== null || cdi !== null ? 'bcb-sgs-live' : 'fallback',
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400',
    },
  });
};
