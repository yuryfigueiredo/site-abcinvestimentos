import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { latestEdition, materialEditions, readEditions } from '../../src/lib/diario/store';

const BRIEFING_HEADINGS = ['O que aconteceu', 'Por que importa', 'O que observar'] as const;
const CANONICAL_ORIGIN = 'https://www.abcinvestimentos.com.br';
const HUB_PATH = '/diario-do-investidor/';
const METHODOLOGY_PATH = '/diario-do-investidor/metodologia/';
const LIVE_NOTE = 'O hub usa a coleta viva do BCB. O arquivo datado preserva o snapshot próprio da edição.';
const SNAPSHOT_NOTE = 'Estes valores pertencem à edição e não mudam quando o hub recebe dados novos.';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function verifyCanonical(html: string, path: string, label: string): void {
  const tags = html.match(/<link\b[^>]*>/giu) ?? [];
  const canonical = tags.find((tag) => /\brel=["']canonical["']/iu.test(tag));
  const href = /\bhref=["']([^"']+)["']/iu.exec(canonical ?? '')?.[1];
  const expected = `${CANONICAL_ORIGIN}${path}`;
  if (href !== expected) throw new Error(`Canonical incorreto em ${label}: esperado ${expected}; encontrado ${href ?? 'nenhum'}.`);
}

function jsonLdEntities(html: string, label: string): JsonObject[] {
  const scripts = [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)];
  if (scripts.length === 0) throw new Error(`JSON-LD ausente no ${label}.`);

  const entities: JsonObject[] = [];
  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script[1]);
    } catch {
      throw new Error(`JSON-LD inválido no ${label}.`);
    }
    if (!isJsonObject(parsed)) throw new Error(`JSON-LD inválido no ${label}.`);
    if (Array.isArray(parsed['@graph'])) {
      for (const entity of parsed['@graph']) {
        if (!isJsonObject(entity)) throw new Error(`JSON-LD inválido no ${label}.`);
        entities.push(entity);
      }
    } else {
      entities.push(parsed);
    }
  }
  return entities;
}

function hasSchemaType(entities: JsonObject[], type: string): boolean {
  return entities.some((entity) => entity['@type'] === type || (Array.isArray(entity['@type']) && entity['@type'].includes(type)));
}

function verifyPageSchema(html: string, path: string, label: string, type: string): void {
  verifyCanonical(html, path, label);
  if (!hasSchemaType(jsonLdEntities(html, label), type)) {
    throw new Error(`${label} está sem JSON-LD ${type}.`);
  }
}

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function verifyOffline(root: string): void {
  const dist = join(root, 'dist');
  const hubPath = join(dist, 'diario-do-investidor');
  const endpointsPath = join(dist, 'api', 'diario');

  if (!existsSync(dist)) throw new Error('Build ausente: dist não existe.');
  if (existsSync(hubPath)) throw new Error('Diário publicado: dist/diario-do-investidor existe.');
  if (existsSync(endpointsPath)) throw new Error('Endpoints do Diário publicados: dist/api/diario existe.');

  for (const file of filesUnder(dist)) {
    const extension = extname(file);
    if (extension !== '.html' && extension !== '.xml') continue;

    const content = readFileSync(file, 'utf8');
    const displayPath = relative(root, file);
    if (extension === '.xml' && (content.includes('/diario-do-investidor') || content.includes('/api/diario/'))) {
      throw new Error(`Diário no sitemap: ${displayPath}`);
    }
    if (
      extension === '.html' &&
      (content.includes('/diario-do-investidor') || content.includes('/api/diario/') || content.includes('Diário do Investidor'))
    ) {
      throw new Error(`Referência ao Diário em HTML: ${displayPath}`);
    }
  }

  console.log('Diário offline verificado: páginas, endpoint, sitemap e links públicos ausentes.');
}

function verifyOnline(root: string): void {
  const dist = join(root, 'dist');
  const editions = readEditions(root);
  const latest = latestEdition(editions);
  const material = materialEditions(editions);
  const hubPath = join(dist, 'diario-do-investidor', 'index.html');
  const methodologyPath = join(dist, 'diario-do-investidor', 'metodologia', 'index.html');
  const homePath = join(dist, 'index.html');
  const sitemapPath = join(dist, 'sitemap-0.xml');
  const endpointPath = join(dist, 'api', 'diario', 'edicao.json');

  if (!existsSync(hubPath)) throw new Error('Hub do Diário ausente em dist/diario-do-investidor/index.html');
  if (!existsSync(methodologyPath)) throw new Error('Metodologia do Diário ausente em dist/diario-do-investidor/metodologia/index.html');
  if (!existsSync(homePath)) throw new Error('Home ausente em dist/index.html');
  if (!existsSync(sitemapPath)) throw new Error('Sitemap do Diário ausente em dist/sitemap-0.xml');
  if (!existsSync(endpointPath)) throw new Error('Endpoint do Diário ausente em dist/api/diario/edicao.json');

  const hub = readFileSync(hubPath, 'utf8');
  const methodology = readFileSync(methodologyPath, 'utf8');
  const home = readFileSync(homePath, 'utf8');
  verifyPageSchema(hub, HUB_PATH, 'hub', 'CollectionPage');
  verifyPageSchema(methodology, METHODOLOGY_PATH, 'metodologia', 'WebPage');

  if (!home.includes('href="/diario-do-investidor/"')) throw new Error('Home sem link para o Diário.');
  if (!hub.includes('href="/diario-do-investidor/metodologia/"')) throw new Error('Hub sem link para a metodologia.');
  const header = /<header\b[^>]*>([\s\S]*?)<\/header>/iu.exec(hub)?.[1] ?? '';
  const footer = /<footer\b[^>]*>([\s\S]*?)<\/footer>/iu.exec(hub)?.[1] ?? '';
  if (!header.includes('href="/diario-do-investidor"')) throw new Error('Hub sem link no header para o Diário.');
  if (!footer.includes('href="/diario-do-investidor/"')) throw new Error('Hub sem link no footer para o Diário.');
  if (!hub.includes('Indicadores ao vivo') || !hub.includes(LIVE_NOTE) || hub.includes('Snapshot desta edição')) {
    throw new Error('Hub está sem o painel vivo separado do snapshot da edição.');
  }

  for (const edition of editions) {
    const datedPath = join(dist, 'diario-do-investidor', edition.date, 'index.html');
    if (edition.decision.status === 'material') {
      if (!existsSync(datedPath)) throw new Error(`Arquivo material ausente: ${edition.date}`);
      const html = readFileSync(datedPath, 'utf8');
      const label = `Arquivo material ${edition.date}`;
      verifyPageSchema(html, `/diario-do-investidor/${edition.date}/`, label, 'Article');
      const renderedHeadings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gu)].map((match) => match[1].trim());
      for (const heading of BRIEFING_HEADINGS) {
        if (!renderedHeadings.includes(heading)) {
          throw new Error(`${label} está sem o bloco "${heading}" do briefing.`);
        }
      }
      if (!html.includes('Snapshot desta edição') || !html.includes(SNAPSHOT_NOTE) || html.includes('Indicadores ao vivo')) {
        throw new Error(`${label} está sem o snapshot próprio separado do painel vivo.`);
      }
    } else if (existsSync(datedPath)) {
      throw new Error(`Edição morna virou URL datada: ${edition.date}`);
    }
  }

  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  const locationSet = new Set(locations);
  const requiredUrls = [
    `${CANONICAL_ORIGIN}${HUB_PATH}`,
    `${CANONICAL_ORIGIN}${METHODOLOGY_PATH}`,
    ...material.map((edition) => `${CANONICAL_ORIGIN}/diario-do-investidor/${edition.date}/`),
  ];
  if (!locationSet.has(requiredUrls[0])) throw new Error('Sitemap do Diário não contém o hub.');
  if (!locationSet.has(requiredUrls[1])) throw new Error('Sitemap do Diário não contém a metodologia.');
  for (const edition of material) {
    if (!locationSet.has(`${CANONICAL_ORIGIN}/diario-do-investidor/${edition.date}/`)) {
      throw new Error(`Sitemap do Diário não contém o arquivo material ${edition.date}.`);
    }
  }
  for (const edition of editions.filter((entry) => entry.decision.status !== 'material')) {
    if (locationSet.has(`${CANONICAL_ORIGIN}/diario-do-investidor/${edition.date}/`)) {
      throw new Error(`Edição morna no sitemap: ${edition.date}`);
    }
  }
  const diarioPaths = locations.map((location) => new URL(location).pathname);
  if (diarioPaths.some((path) => path.startsWith('/api/diario/'))) throw new Error('Endpoint do Diário no sitemap.');
  const expectedDiarioUrls = new Set(requiredUrls);
  for (const location of locations.filter((entry) => new URL(entry).pathname.startsWith('/diario-do-investidor/'))) {
    if (!expectedDiarioUrls.has(location)) throw new Error(`URL inesperada no sitemap do Diário: ${location}`);
  }

  const endpoint = JSON.parse(readFileSync(endpointPath, 'utf8')) as unknown;
  if (!isDeepStrictEqual(endpoint, latest)) {
    throw new Error('Endpoint não corresponde à última edição, inclusive uma edição morna');
  }

  console.log(
    `Diário verificado: hub, metodologia, home, sitemap, ${material.length} arquivo(s) material(is), ${editions.length - material.length} edição(ões) morna(s) sem URL e endpoint alinhado.`,
  );
}

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--online')) throw new Error('Uso: npm run diario:verify-build [-- --online]');
  const root = process.cwd();
  if (args.includes('--online')) verifyOnline(root);
  else verifyOffline(root);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na verificação do build do Diário.');
  process.exitCode = 1;
}
