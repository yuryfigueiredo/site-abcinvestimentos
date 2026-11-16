import { SITE_CONFIG } from '../config/site';

export const SCHEMA_CONTEXT = 'https://schema.org';

export interface Crumb {
  name: string;
  /** Caminho relativo dentro do site. Ausente = item atual, que o Google aceita sem `item`. */
  path?: string;
}

// O sitemap publica tudo com barra final (86/86 URLs). Um canonical ou um `item` de
// breadcrumb sem barra aponta para outra URL e o Google passa a escolher entre as duas,
// então a normalização mora aqui e vale para todo objeto URL que sai do site.
// Arquivo (og-image.png) e fragmento (#organization) não são rotas: ficam como estão.
export function absUrl(path: string): string {
  const url = new URL(path, SITE_CONFIG.url);
  const lastSegment = url.pathname.split('/').at(-1) ?? '';
  const isRoute = !url.hash && !url.search && !lastSegment.includes('.');
  if (isRoute && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

// Entidades saem sem @context: quem publica sozinho usa ldJson(), quem embute em @graph
// (os artigos do guia) não pode repetir o contexto dentro do nó.
export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: absUrl(crumb.path) } : {}),
    })),
  };
}

export interface ApplicationSeed {
  name: string;
  description: string;
  path: string;
  featureList: string[];
}

// Sem aggregateRating: não há avaliações reais coletadas, e nota inventada é o tipo de
// marcação que derruba a confiança da página inteira no validator do Google.
export function applicationSchema(seed: ApplicationSeed) {
  return {
    '@type': ['WebApplication', 'FinanceApplication'],
    name: seed.name,
    description: seed.description,
    url: absUrl(seed.path),
    applicationCategory: 'FinanceApplication',
    applicationSubCategory: 'Financial calculator',
    operatingSystem: 'Any',
    inLanguage: 'pt-BR',
    browserRequirements: 'Requires JavaScript',
    featureList: seed.featureList,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
    publisher: { '@id': `${SITE_CONFIG.url}/#organization` },
  };
}

export function ldJson(entity: Record<string, unknown>): string {
  return JSON.stringify({ '@context': SCHEMA_CONTEXT, ...entity });
}
