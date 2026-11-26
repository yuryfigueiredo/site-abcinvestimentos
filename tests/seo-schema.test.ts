import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_CONFIG } from '../src/config/site';
import { absUrl, applicationSchema, breadcrumbSchema, ldJson } from '../src/lib/seo';
import { formatDateBr } from '../src/lib/finance';

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

describe('Descoberta pública', () => {
  it('não oferece o Diário no header, no footer ou na home', () => {
    for (const relativePath of ['src/components/Header.astro', 'src/components/Footer.astro', 'src/pages/index.astro']) {
      const content = source(relativePath);
      expect(content).not.toContain('/diario-do-investidor');
      expect(content).not.toContain('Diário do Investidor');
    }
  });

  it('resume o Guia ABC no rodapé e preserva acesso ao acervo', () => {
    const footer = source('src/components/Footer.astro');
    const guideColumn = footer.match(/<div>\s*<h4>Guia ABC<\/h4>[\s\S]*?<\/div>/u)?.[0] ?? '';
    expect(guideColumn).toContain('href="/guia"');
    expect(guideColumn).not.toContain('GUIDES.map');
    expect(guideColumn.match(/href="\/guia\/[^"]+"/gu)).toHaveLength(4);
  });
});
