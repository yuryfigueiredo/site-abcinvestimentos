import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_CONFIG } from '../src/config/site';
import { getPoupancaAnnualRatePct } from '../src/lib/finance';

// O byline das calculadoras imprime "taxas do Banco Central de <data>". Essa frase so e
// verdadeira se o numero na tela vier da serie do BCB. Quando renda-fixa pré-preenchia
// o IPCA com SITE_CONFIG.defaultIndicators (4,58) e o feed do build trazia 4,63, a pagina
// carimbava uma data para um valor que ela nao havia lido de lugar nenhum.

const pageDir = 'src/pages/calculadoras';

const feedRateValues = [
  SITE_CONFIG.defaultIndicators.selic,
  SITE_CONFIG.defaultIndicators.cdi,
  SITE_CONFIG.defaultIndicators.ipca12m,
  SITE_CONFIG.defaultIndicators.dolar,
].map(String);

function calculatorSources(): { file: string; source: string }[] {
  return readdirSync(pageDir)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => ({ file: join(pageDir, f), source: readFileSync(join(pageDir, f), 'utf8') }));
}

function hardcodedRateInputs(source: string): string[] {
  return [...source.matchAll(/<input[^>]*\bvalue="([^"]+)"[^>]*>/g)]
    .filter((m) => feedRateValues.includes(m[1]))
    .map((m) => m[0]);
}

describe('fonte das taxas exibidas nas calculadoras', () => {
  it('nenhuma pagina de calculadora le taxas do fallback estatico', () => {
    const offenders = calculatorSources()
      .filter(({ source }) => source.includes('defaultIndicators'))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum campo pre-preenchido com valor de taxa hardcoded', () => {
    const offenders = calculatorSources()
      .flatMap(({ source }) => hardcodedRateInputs(source))
      .map((tag) => tag.slice(0, 80));
    expect(offenders).toEqual([]);
  });

  it('a data do Banco Central so aparece em pagina que exibe taxa do BCB', () => {
    // Sem nenhuma taxa do feed na pagina, o byline e chamado sem updatedAt.
    for (const { file, source } of calculatorSources()) {
      const printsFeedDate = source.includes('updatedAt={indicators.updatedAt}');
      const usesFeedRates = /indicators\.(selic|cdi|ipca12m|poupanca|dolar)/.test(source);
      if (printsFeedDate) expect(usesFeedRates, file).toBe(true);
    }
  });

  // A TR de referencia passou a morar em SITE_CONFIG.poupancaTrReference, de onde a ressalva
  // publicada a le. finance.ts conservava 0.95 em dois lugares: quem atualizasse o config
  // deixaria as calculadoras compondo a poupanca com o numero velho, sem data e sem aviso.
  it('a TR das calculadoras vem do unico lugar declarado', () => {
    const src = readFileSync('src/lib/finance.ts', 'utf8');
    expect(src).not.toMatch(/trAnnualPct\s*=\s*0\.95/);
    expect(src).not.toMatch(/\?\?\s*0\.95/);
    expect(src).toContain('poupancaTrReference');
  });

  it('mudar a TR do config muda a poupanca da calculadora', () => {
    const referencia = SITE_CONFIG.poupancaTrReference as { annualPct: number };
    const original = referencia.annualPct;
    const antes = getPoupancaAnnualRatePct(13.75);
    referencia.annualPct = original + 2.5;
    try {
      expect(getPoupancaAnnualRatePct(13.75)).not.toBe(antes);
    } finally {
      referencia.annualPct = original;
    }
  });
});
