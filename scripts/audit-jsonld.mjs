import fs from 'node:fs';
import path from 'node:path';

// Portão de dados estruturados. Rodar depois de `npm run build`:
//   node scripts/audit-jsonld.mjs
// Sai com código 1 em qualquer violação. Sem ele, um bloco JSON-LD malformado ou um
// canonical fora do sitemap só aparece semanas depois, no relatório do Search Console.

const ORIGIN = 'https://www.abcinvestimentos.com.br';

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})('dist');

const rel = (f) =>
  '/' + path.relative('dist', f).split(path.sep).join('/').replace(/\/index\.html$/, '').replace(/\.html$/, '');

// Blocos podem ser um objeto, uma lista ou um @graph: os três são JSON-LD válido.
function entitiesOf(node) {
  if (Array.isArray(node)) return node.flatMap(entitiesOf);
  if (node && typeof node === 'object') {
    if (Array.isArray(node['@graph'])) return [node, ...node['@graph'].flatMap(entitiesOf)];
    return [node];
  }
  return [];
}

const pages = files.map((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const entities = [];
  const violations = [];
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      entities.push(...entitiesOf(JSON.parse(block[1])));
    } catch {
      violations.push('bloco JSON-LD que não faz o parse');
    }
  }
  return {
    rel: rel(f),
    entities,
    violations,
    canonical: (html.match(/<link rel="canonical" href="([^"]+)"/) || [, null])[1],
    ogType: (html.match(/<meta property="og:type" content="([^"]+)"/) || [, null])[1],
    breadcrumbs: entities.filter((e) => e['@type'] === 'BreadcrumbList'),
    applications: entities.filter((e) => String(e['@type']).includes('WebApplication')),
  };
});

const sitemap = fs.readFileSync('dist/sitemap-0.xml', 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

// O robots.txt é a autoridade sobre o que não deveria estar no sitemap: cobrar sitemap
// de uma página bloqueada seria o portão brigando com a intenção do site.
const robots = fs.readFileSync('dist/robots.txt', 'utf8');
const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
const isBlocked = (relPath) => disallowed.some((d) => relPath.startsWith(d));

// Trilha de navegação só é cobrada onde ela existe na tela.
const needsBreadcrumb = (r) =>
  r === '/sobre' ||
  r === '/calculadoras' ||
  r === '/quanto-rende' ||
  r.startsWith('/calculadoras/') ||
  r.startsWith('/quanto-rende/') ||
  (r.startsWith('/guia/') && r !== '/guia');

for (const page of pages) {
  if (needsBreadcrumb(page.rel) && page.breadcrumbs.length === 0) page.violations.push('sem BreadcrumbList');

  for (const bc of page.breadcrumbs) {
    const items = bc.itemListElement || [];
    items.forEach((item, i) => {
      if (item.position !== i + 1) page.violations.push(`BreadcrumbList position quebrada no item ${i + 1}`);
      if (item.item !== undefined && !item.item.startsWith(ORIGIN + '/')) {
        page.violations.push(`BreadcrumbList item não é URL absoluta em www: ${item.item}`);
      }
    });
    if (items.length > 0 && items[items.length - 1].item) {
      page.violations.push('último item do BreadcrumbList aponta para a própria página');
    }
  }

  if (page.canonical && !sitemapUrls.has(page.canonical) && !isBlocked(page.rel)) {
    page.violations.push(`canonical fora do sitemap: ${page.canonical}`);
  }
  // Onde há Article no JSON-LD, o Open Graph tem de dizer o mesmo; os hubs /guia/nivel-*
  // também ficam sob /guia/ e não são artigos, então a regra segue a marcação e não o caminho.
  const hasArticle = page.entities.some((e) => String(e['@type']).includes('Article'));
  if (hasArticle && page.ogType !== 'article') {
    page.violations.push(`Article no JSON-LD com og:type "${page.ogType}"`);
  }
}

const calculators = pages.filter((p) => /^\/calculadoras\/[^/]+$/.test(p.rel));
for (const page of calculators) {
  if (page.applications.length !== 1) {
    page.violations.push(`esperava 1 WebApplication, achou ${page.applications.length}`);
  }
  for (const app of page.applications) {
    if (app.offers?.price !== '0') page.violations.push(`ofertas com preço ${app.offers?.price} em vez de "0"`);
    if (app.url !== page.canonical) {
      page.violations.push(`url do schema (${app.url}) difere do canonical (${page.canonical})`);
    }
    if (app.aggregateRating) page.violations.push('aggregateRating sem avaliação real coletada');
  }
}

const problems = pages.filter((p) => p.violations.length);
console.log(
  'páginas:', pages.length,
  '| calculadoras com WebApplication:', calculators.filter((p) => p.applications.length === 1).length, '/', calculators.length,
  '| urls no sitemap:', sitemapUrls.size,
);
for (const p of problems.slice(0, 20)) {
  console.log('  VIOLAÇÃO', p.rel, '->', [...new Set(p.violations)].slice(0, 3).join(' ; '));
}
if (problems.length > 20) console.log(`  ... e mais ${problems.length - 20} página(s)`);
console.log(
  problems.length
    ? `\nFALHOU: ${problems.length} página(s) com problema.`
    : '\nOK: JSON-LD, canonical x sitemap e og:type consistentes.',
);
process.exit(problems.length ? 1 : 0);
