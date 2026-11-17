import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// O selo "dados oficiais do Banco Central" cobria oito campos de origens diferentes:
// Selic/CDI/IPCA/Dólar vinham do SGS, Ibovespa/IFIX nunca foram buscados por ninguém, e a
// Poupança era 6,17 + uma TR chumbada no config desde 25/10. Publicado desse jeito, um
// número de fórmula lê-se como medição. Este portão exige que cada campo declare a origem.

const REALIZED = '30/10/2026';

type IndicatorsModule = typeof import('../src/lib/indicators');

/** Coleta com fetch simulado: `values` diz o valor por código de série; ausente = série fora do ar. */
async function collect(values: Record<number, string>): Promise<{
  ind: Awaited<ReturnType<IndicatorsModule['getIndicators']>>;
  calls: number[];
  mod: IndicatorsModule;
}> {
  const calls: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const code = Number(/bcdata\.sgs\.(\d+)/.exec(String(url))?.[1]);
      calls.push(code);
      const valor = values[code];
      if (valor === undefined) return new Response('offline', { status: 503 });
      return new Response(JSON.stringify([{ data: REALIZED, valor }]), { status: 200 });
    })
  );

  // getIndicators memoiza por módulo; sem reset o 2º teste veria a coleta do 1º.
  vi.resetModules();
  const mod = await import('../src/lib/indicators');
  return { ind: await mod.getIndicators(), calls, mod };
}

const ALL_LIVE = { 432: '13.75', 4389: '13.65', 13522: '4.58', 1: '5.42' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('proveniência dos indicadores publicados', () => {
  it('series vivas declaram origem bcb-sgs', async () => {
    const { ind } = await collect(ALL_LIVE);

    expect(ind.origins).toEqual({
      selic: 'bcb-sgs',
      cdi: 'bcb-sgs',
      ipca12m: 'bcb-sgs',
      dolar: 'bcb-sgs',
      poupanca: 'formula',
    });
  });

  it('serie ausente declara origem config-fallback', async () => {
    const { ind } = await collect({});

    expect(ind.origins).toEqual({
      selic: 'config-fallback',
      cdi: 'config-fallback',
      ipca12m: 'config-fallback',
      dolar: 'config-fallback',
      poupanca: 'formula',
    });
  });

  it('poupanca sempre traz a regra que a gerou', async () => {
    const { ind, mod } = await collect(ALL_LIVE);

    expect(ind.poupancaRule.basis).toBe('tr');
    expect(ind.poupanca).toBe(7.12);
    expect(mod.poupancaReferenceText(ind)).toContain('Out/2026');
  });

  it('payload nao publica campo sem fonte', async () => {
    const { ind } = await collect(ALL_LIVE);

    expect(ind).not.toHaveProperty('ibovespa');
    expect(ind).not.toHaveProperty('ifix');
    expect(ind).not.toHaveProperty('source');
  });

  it('selic baixa troca a regra e a frase junto', async () => {
    const { ind, mod } = await collect({ ...ALL_LIVE, 432: '8.4' });

    expect(ind.poupancaRule).toEqual({ basis: 'selic-70', selicUsada: 8.4 });
    expect(mod.poupancaReferenceText(ind)).toContain('70% da Selic');
    expect(mod.poupancaReferenceText(ind)).not.toContain('0,5% a.m.');
  });

  it('coleta continua quatro series do bcb', async () => {
    const { calls } = await collect(ALL_LIVE);

    expect(calls).toEqual([432, 4389, 13522, 1]);
  });
});

describe('superficie publicada', () => {
  // A barra e a unica superficie que mostra o 7,12 ao visitante, e o selo dela diz
  // "Banco Central". Se a pílula nao carregar a regra, o numero volta a ler-se como medicao.
  it('a pilula da poupanca declara a regra que gerou o numero', () => {
    const src = readFileSync('src/components/Ticker.astro', 'utf8');
    expect(src).toContain('poupancaReferenceText');
    const poupancaPill = src.slice(src.indexOf('id="bcb-poupanca"'));
    expect(poupancaPill).toContain('title={poupancaReferenceText(d)}');
  });

  it('nenhum valor de taxa sai hardcoded na barra', () => {
    const src = readFileSync('src/components/Ticker.astro', 'utf8');
    expect(src).not.toMatch(/poupanca \|\| 7\.12/);
  });

  // Um dos cinco itens e formula, entao o rotulo do conjunto nao pode morena-los como medição.
  it('o rotulo do conjunto nao chama os cinco itens de oficiais do banco central', () => {
    const src = readFileSync('src/components/Ticker.astro', 'utf8');
    expect(src).not.toMatch(/oficiais do Banco Central do Brasil/);
  });

  // O script de hidratacao regrava o aria-label com o numero formatado. Se a nota de origem
  // nao entrar nessa concatenacao, o conserto visivel sobrevive so ate o primeiro giro das placas.
  it('o giro das placas mantem a origem no aria-label', () => {
    const src = readFileSync('src/components/Ticker.astro', 'utf8');
    const start = src.indexOf("el.setAttribute('aria-label'");
    expect(src.slice(start, start + 220)).toContain('originNote');
  });
});
