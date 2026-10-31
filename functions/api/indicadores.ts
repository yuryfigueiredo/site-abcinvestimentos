/**
 * Cloudflare Pages Function: /api/indicadores
 * Consulta as séries oficiais abertas do SGS — Banco Central do Brasil com cache de 6h (21.600s)
 * e fallback imediato caso a API do BCB oscile.
 */

const FALLBACK_INDICATORS = {
  selic: 13.75,
  cdi: 13.65,
  ipca12m: 4.58,
  dolar: 5.42,
  updatedAt: 'Referência Oficial BCB',
  source: 'fallback',
};

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

export const onRequestGet = async (): Promise<Response> => {
  try {
    const [selic, cdi, ipca12m, dolar] = await Promise.all([
      fetchBcbLastValue(432), // Taxa Selic Meta (% a.a.)
      fetchBcbLastValue(4389), // Taxa CDI Anualizada (% a.a.)
      fetchBcbLastValue(13522), // IPCA Acumulado 12 meses (%)
      fetchBcbLastValue(1), // Dólar PTAX Venda (R$)
    ]);

    const payload = {
      selic: selic ?? FALLBACK_INDICATORS.selic,
      cdi: cdi ?? FALLBACK_INDICATORS.cdi,
      ipca12m: ipca12m ?? FALLBACK_INDICATORS.ipca12m,
      dolar: dolar ?? FALLBACK_INDICATORS.dolar,
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
  } catch {
    return new Response(JSON.stringify(FALLBACK_INDICATORS), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
};
