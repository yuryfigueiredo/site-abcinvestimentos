import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../src/data/quanto-rende';

// O selo "dados oficiais do Banco Central" cobria oito campos de origens diferentes:
// Selic/CDI/IPCA/Dólar vinham do SGS, Ibovespa/IFIX nunca foram buscados por ninguém, e a
// Poupança era 6,17 + uma TR chumbada no config desde 25/10. Publicado desse jeito, um
// número de fórmula lê-se como medição. Este portão exige que cada campo declare a origem.
//
// Verificado por mutação em 2026-11-16 — cada linha é a promessa quebrada de volta e o
// assert que pegou (7/7):
//   origins.poupanca = 'bcb-sgs'            → series vivas declaram origem bcb-sgs
//   load() publica ibovespa                 → payload nao publica campo sem fonte
//   title sai da pílula                     → a pilula da poupanca declara a regra que gerou o numero
//   {isPoupanca &&} incondicional           → pagina de poupanca publica a ressalva pela mesma funcao da barra
//   frase à mão no Ticker                   → a pilula da poupanca declara a regra que gerou o numero
//   poupancaTrReference.referencia = ''     → poupanca sempre traz a regra que a gerou
//   ratesLead fixo 'Com as taxas do BCB'    → meta description de pagina de poupanca nao chama a formula de taxa do bcb

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

  // As 8 paginas /quanto-rende/poupanca/* mostram o 7,12 em tabela. Sem a linha abaixo da
  // tabela, o visitante ve um numero de formula na pagina que se apresenta com data do BCB.
  it('pagina de poupanca publica a ressalva pela mesma funcao da barra', () => {
    const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
    expect(src).toContain('poupancaReferenceText');
    expect(src).toMatch(/isPoupanca\s*&&/);
  });

  // O JSON-LD e a primeira string que o Google le. Hoje ele abre "Com as taxas do Banco
  // Central de <data>" tambem na pagina de Poupança, cujo numero nao veio de serie nenhuma.
  it('meta description de pagina de poupanca nao chama a formula de taxa do bcb', () => {
    const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
    const alegacoes = src.split('\n').filter((line) => line.includes('Com as taxas do Banco Central'));
    expect(alegacoes.length).toBeGreaterThan(0);
    for (const line of alegacoes) {
      expect(line, 'alegacao de taxa medida fora do ramo que mede').toContain('isPoupanca');
    }
  });

  // O byline visivel e a frase "Taxas BCB de <data>" do <meta description> carimbam a mesma
  // mentira do JSON-LD: na pagina de Poupança, a cifra exibida nao e taxa do Banco Central.
  it('a frase taxas BCB so aparece em pagina de taxa medida', () => {
    const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
    const alegacoes = src.split('\n').filter((line) => line.includes('Taxas BCB de'));
    expect(alegacoes.length).toBeGreaterThan(0);
    for (const line of alegacoes) {
      expect(line, 'alegacao de taxa medida fora do ramo que mede').toContain('isPoupanca');
    }
  });

  // /sobre e a pagina para onde o byline manda quem desconfia de um numero ("como calculamos").
  // Ela citava "SGS 196" para a Poupanca e mantinha linhas de Ibovespa e IFIX depois que o
  // payload passou a nao publicar esses campos: uma citacao de fonte que a coleta nao faz.
  it('a metodologia cita exatamente as series que a coleta consulta', () => {
    const src = readFileSync('src/pages/sobre.astro', 'utf8');
    const consultadas = [...readFileSync('src/lib/indicators.ts', 'utf8').matchAll(/fetchBcbLastValue\((\d+)\)/g)].map((m) => m[1]);
    const citadas = [...src.matchAll(/SGS\s*(\d+)/g)].map((m) => m[1]);

    expect(citadas.sort()).toEqual(consultadas.sort());
    expect(src).not.toMatch(/Poupan[çc]a[^<\n]{0,80}v[êe]m diretamente/);
    expect(src).toContain('poupancaReferenceText');
  });

  // CalcSeo monta o JSON-LD das sete calculadoras, inclusive a de renda fixa que compara CDB
  // com a Poupanca de formula. "Dados oficiais do Banco Central (serie SGS)" era alegacao de
  // medicao sem dizer o que e medido — e o JSON-LD e a primeira string que o Google le.
  it('o json-ld das calculadoras nomeia o que alega medido', () => {
    const src = readFileSync('src/components/CalcSeo.astro', 'utf8');
    expect(src).not.toMatch(/[Dd]ados oficiais do Banco Central do Brasil \(s[ée]rie SGS\)/);
    const alegacoes = src.split('\n').filter((line) => line.includes('Banco Central'));
    expect(alegacoes.length).toBeGreaterThan(0);
    for (const line of alegacoes) {
      expect(line, 'alegacao de SGS sem nomear as taxas').toMatch(/Selic/);
    }
  });

  // A ressalva abaixo da tabela convive com duas frases acima dela que carimbam a pagina como
  // leitura do BCB: o subtitulo do H1 e o byline "taxas do Banco Central de <data>". Na pagina
  // de Poupanca, as duas alegam medicao justamente do numero que veio de formula.
  it('subtitulo e byline da pagina de poupanca nao prometem taxa medida', () => {
    const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
    for (const parte of ['taxas atualizadas do Banco Central', '<Byline ']) {
      const linhas = src.split('\n').filter((line) => line.includes(parte));
      expect(linhas.length, parte).toBeGreaterThan(0);
      for (const line of linhas) {
        expect(line, parte).toContain('isPoupanca');
        // Trocar as pontas do ternario da pagina de Poupanca o mesmo texto do bug.
        const ramoPoupanca = /\bisPoupanca\s*\?\s*'([^']*)'/.exec(line)?.[1];
        if (ramoPoupanca !== undefined) expect(ramoPoupanca, parte).toMatch(/regra|medid/);
      }
    }
  });

  // O gate das paginas era o nome da variavel: trocar product.type === 'poupanca' por 'cdb'
  // punha a ressalva na pagina do CDB e deixava o 7,12 nu na da Poupanca, e os 13 portoes
  // passavam (reproduzido em 2026-11-16). O assert prende o gate ao produto.
  it('o gate da ressalva esta preso ao produto poupanca, nao ao nome da variavel', () => {
    const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
    expect(src).toMatch(/const isPoupanca = product\.type === 'poupanca'/);
    expect(PRODUCTS.filter((p) => p.type === 'poupanca').map((p) => p.slug)).toEqual(['poupanca']);
  });
});
