import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_CONFIG } from '../src/config/site';
import { absUrl, applicationSchema, breadcrumbSchema, ldJson } from '../src/lib/seo';
import { formatDateBr } from '../src/lib/finance';
import { diarioHubLastmod, diarioSitemapMetadata } from '../src/lib/diario/seo';

const ORIGIN = 'https://www.abcinvestimentos.com.br';

describe('absUrl', () => {
  it('fecha a barra final igual ao sitemap', () => {
    expect(absUrl('/sobre')).toBe(`${ORIGIN}/sobre/`);
    expect(absUrl('/')).toBe(`${ORIGIN}/`);
    expect(absUrl(`${ORIGIN}/calculadoras`)).toBe(`${ORIGIN}/calculadoras/`);
  });

  it('não mexe em arquivo, âncora ou consulta', () => {
    expect(absUrl('/og-image.png')).toBe(`${ORIGIN}/og-image.png`);
    expect(absUrl('/#organization')).toBe(`${ORIGIN}/#organization`);
  });
});

describe('breadcrumbSchema', () => {
  const crumbs = [
    { name: 'Início', path: '/' },
    { name: 'Calculadoras', path: '/calculadoras' },
    { name: 'Reserva de Emergência' },
  ];
  const schema = breadcrumbSchema(crumbs);

  it('numeraga posições a partir de 1', () => {
    expect(schema.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it('cada item publicado é URL absoluta em www', () => {
    for (const item of schema.itemListElement) {
      if (item.item) expect(item.item.startsWith(`${ORIGIN}/`)).toBe(true);
    }
  });

  it('o item atual fica sem item (URL da própria página)', () => {
    expect(schema.itemListElement.at(-1)).not.toHaveProperty('item');
  });

  it('quem embute em @graph não recebe @context', () => {
    expect(schema).not.toHaveProperty('@context');
    expect(JSON.parse(ldJson(schema))['@context']).toBe('https://schema.org');
  });
});

describe('applicationSchema', () => {
  const schema = applicationSchema({
    name: 'Calculadora de Reserva de Emergência',
    description: 'Calcule sua reserva.',
    path: '/calculadoras/reserva-emergencia',
    featureList: ['Liquidez diária'],
  });

  it('declara preço 0 em BRL — a calculadora é gratuita de verdade', () => {
    expect(schema.offers).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'BRL' });
  });

  it('url bate com o canonical da página', () => {
    expect(schema.url).toBe(`${ORIGIN}/calculadoras/reserva-emergencia/`);
  });

  it('sem aggregateRating: não existem avaliações coletadas', () => {
    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('aponta o publisher para a Organization da home', () => {
    expect(schema.publisher['@id']).toBe(`${SITE_CONFIG.url}/#organization`);
  });
});

describe('formatDateBr', () => {
  it('converte ISO em data brasileira sem deslocar o dia', () => {
    expect(formatDateBr('2026-11-13')).toBe('13/11/2026');
  });

  it('devolve o rótulo cru quando a fonte não é ISO', () => {
    // SITE_CONFIG.defaultIndicators.updatedAt é 'Out/2026 (Referência BCB)': um Date()
    // aqui imprimia NaN/NaN/NaN no byline quando a API do BCB falha.
    expect(formatDateBr('Out/2026 (Referência BCB)')).toBe('Out/2026 (Referência BCB)');
  });
});

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Diário no sitemap', () => {
  const context = {
    hubLastmod: '2026-11-23',
    materialDates: new Set(['2026-11-23']),
  };

  it('inclui a data material com lastmod da própria edição', () => {
    expect(diarioSitemapMetadata('/diario-do-investidor/2026-11-23/', context)).toEqual({
      include: true,
      lastmod: '2026-11-23',
    });
  });

  it('exclui uma data morna mesmo que uma URL tenha sobrado no build', () => {
    expect(diarioSitemapMetadata('/diario-do-investidor/2026-11-22/', context)).toEqual({
      include: false,
    });
  });

  it('usa a última data relevante do hub sem marcar a metodologia como diária', () => {
    expect(diarioSitemapMetadata('/diario-do-investidor/', context)).toEqual({
      include: true,
      lastmod: '2026-11-23',
    });
    expect(diarioSitemapMetadata('/diario-do-investidor/metodologia/', context)).toEqual({
      include: true,
    });
  });

  it('escolhe a maior data entre a edição e a observação BCB', () => {
    expect(diarioHubLastmod('2026-11-22', '2026-11-23')).toBe('2026-11-23');
    expect(diarioHubLastmod('2026-11-23', '2026-11-20')).toBe('2026-11-23');
    expect(diarioHubLastmod('2026-11-23', undefined)).toBe('2026-11-23');
  });
});

describe('Descoberta e metadados do Diário', () => {
  it('oferece o hub no menu desktop e mobile com estado ativo', () => {
    const header = source('src/components/Header.astro');
    expect(header.match(/href="\/diario-do-investidor"/gu)).toHaveLength(2);
    expect(header).toContain('isDiarioActive');
    expect(header).toContain('aria-current={isDiarioActive ? \'page\' : undefined}');
  });

  it('oferece o hub no footer e na home', () => {
    expect(source('src/components/Footer.astro')).toContain('href="/diario-do-investidor/"');
    expect(source('src/pages/index.astro')).toContain('href="/diario-do-investidor/"');
  });

  it('mantém canonical e breadcrumb no hub e no arquivo material', () => {
    const hub = source('src/pages/diario-do-investidor/index.astro');
    const archive = source('src/pages/diario-do-investidor/[date].astro');
    expect(hub).toContain('canonical="/diario-do-investidor"');
    expect(hub).toContain('breadcrumbSchema');
    expect(archive).toContain('canonical={`/diario-do-investidor/${edition.date}`}');
    expect(archive).toContain('breadcrumbSchema');
  });

  it('usa byline automática honesta ligada à metodologia', () => {
    const byline = source('src/components/diario/DiarioByline.astro');
    expect(byline).toContain('Diário do Investidor · curadoria automática com fontes verificadas');
    expect(byline).toContain('/diario-do-investidor/metodologia/');
    expect(byline).not.toMatch(/revis(?:ado|ão)\s+(?:por\s+)?(?:humano|pessoa)/iu);
  });

  it('explica materialidade, fontes, cofre e limites educacionais na metodologia', () => {
    const methodology = source('src/pages/diario-do-investidor/metodologia.astro');
    expect(methodology).toContain('material');
    expect(methodology).toContain('morno');
    expect(methodology).toContain('Banco Central');
    expect(methodology).toContain('cofre');
    expect(methodology).toContain('recomendação');
    expect(methodology).toContain('SITE_CONFIG.legalDisclaimer');
  });
});
