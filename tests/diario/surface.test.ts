import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const ORIGIN = 'https://www.abcinvestimentos.com.br';
const MATERIAL_DATE = '2026-11-23';
const QUIET_DATE = '2026-11-24';
const LIVE_NOTE = 'O hub usa a coleta viva do BCB. O arquivo datado preserva o snapshot próprio da edição.';
const SNAPSHOT_NOTE = 'Estes valores pertencem à edição e não mudam quando o hub recebe dados novos.';
const temporaryRoots: string[] = [];
const PUBLIC_FILES = [
  'src/pages/diario-do-investidor/index.astro',
  'src/pages/diario-do-investidor/[date].astro',
  'src/pages/diario-do-investidor/metodologia.astro',
  'src/pages/api/diario/edicao.json.ts',
] as const;
const ONLINE = PUBLIC_FILES.every((relativePath) => existsSync(join(ROOT, relativePath)));

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-offline-build-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'dist'), { recursive: true });
  return root;
}

function verify(root: string, args: string[] = []): ReturnType<typeof spawnSync> {
  return spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/diario/verify-build.ts'), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function expectOnlineFailure(root: string, message: string): void {
  const result = verify(root, ['--online']);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(message);
}

function replaceInFixture(root: string, relativePath: string, search: string, replacement: string): void {
  const path = join(root, relativePath);
  const content = readFileSync(path, 'utf8');
  if (!content.includes(search)) throw new Error(`Fixture não contém o trecho esperado: ${search}`);
  writeFileSync(path, content.replace(search, replacement), 'utf8');
}

function onlineBuildFixture(): string {
  const root = buildFixture();
  cpSync(join(ROOT, 'src/data/diario/curadoria'), join(root, 'src/data/diario/curadoria'), { recursive: true });
  const editionsDirectory = join(root, 'src/data/diario/edicoes');
  mkdirSync(editionsDirectory, { recursive: true });
  cpSync(join(ROOT, `src/data/diario/edicoes/${MATERIAL_DATE}.json`), join(editionsDirectory, `${MATERIAL_DATE}.json`));
  const material = JSON.parse(source(`src/data/diario/edicoes/${MATERIAL_DATE}.json`)) as Record<string, unknown>;
  const quiet: Record<string, unknown> = {
    ...material,
    id: `diario-${QUIET_DATE}`,
    date: QUIET_DATE,
    generatedAt: `${QUIET_DATE}T22:00:00.000Z`,
    title: 'Edição morna preserva a leitura do dia',
    summary: 'A edição morna permanece no hub e no endpoint sem criar uma página datada.',
    decision: { status: 'morno', reasonCodes: ['no-substantive-delta'], newsClusterIds: [] },
    items: [],
    sources: [],
  };
  delete quiet.briefing;
  delete quiet.event;
  delete quiet.lesson;
  writeFileSync(join(editionsDirectory, `${QUIET_DATE}.json`), JSON.stringify(quiet), 'utf8');

  const datedDirectory = join(root, `dist/diario-do-investidor/${MATERIAL_DATE}`);
  const methodologyDirectory = join(root, 'dist/diario-do-investidor/metodologia');
  const endpointDirectory = join(root, 'dist/api/diario');
  mkdirSync(datedDirectory, { recursive: true });
  mkdirSync(methodologyDirectory, { recursive: true });
  mkdirSync(endpointDirectory, { recursive: true });
  writeFileSync(
    join(root, 'dist/diario-do-investidor/index.html'),
    `<html><head><link rel="canonical" href="${ORIGIN}/diario-do-investidor/"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage"}]}</script></head><body><header><a href="/diario-do-investidor">Diário do Investidor</a></header><h2>Indicadores ao vivo</h2><p>${LIVE_NOTE}</p><a href="/diario-do-investidor/metodologia/">Metodologia</a><footer><a href="/diario-do-investidor/">Diário do Investidor</a></footer></body></html>`,
    'utf8',
  );
  writeFileSync(
    join(methodologyDirectory, 'index.html'),
    `<html><head><link rel="canonical" href="${ORIGIN}/diario-do-investidor/metodologia/"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"}]}</script></head><body><h1>O que merece virar notícia no Diário</h1></body></html>`,
    'utf8',
  );
  writeFileSync(
    join(datedDirectory, 'index.html'),
    `<html><head><link rel="canonical" href="${ORIGIN}/diario-do-investidor/${MATERIAL_DATE}/"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"}]}</script></head><body><h2>O que aconteceu</h2><h2>Por que importa</h2><h2>O que observar</h2><h2>Snapshot desta edição</h2><p>${SNAPSHOT_NOTE}</p></body></html>`,
    'utf8',
  );
  writeFileSync(
    join(root, 'dist/index.html'),
    '<html><body><a href="/diario-do-investidor/">Ler o Diário do Investidor</a></body></html>',
    'utf8',
  );
  writeFileSync(
    join(root, 'dist/sitemap-0.xml'),
    `<urlset><url><loc>${ORIGIN}/diario-do-investidor/</loc></url><url><loc>${ORIGIN}/diario-do-investidor/metodologia/</loc></url><url><loc>${ORIGIN}/diario-do-investidor/${MATERIAL_DATE}/</loc></url></urlset>`,
    'utf8',
  );
  writeFileSync(join(endpointDirectory, 'edicao.json'), JSON.stringify(quiet), 'utf8');
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Superfície pública do Diário', () => {
  it.each(PUBLIC_FILES)('mantém %s coerente com o modo do checkout', (relativePath) => {
    expect(existsSync(join(ROOT, relativePath))).toBe(ONLINE);
  });

  it('mantém os links do header, do footer e da home coerentes com o modo do checkout', () => {
    for (const relativePath of ['src/components/Header.astro', 'src/components/Footer.astro', 'src/pages/index.astro']) {
      const content = source(relativePath);
      expect(content.includes('/diario-do-investidor')).toBe(ONLINE);
    }
  });

  it('mantém o carregamento do Diário no sitemap coerente com o modo do checkout', () => {
    const config = source('astro.config.mjs');
    expect(config.includes('src/lib/diario')).toBe(ONLINE);
    expect(config.includes('diarioSitemap')).toBe(ONLINE);
  });

  it('declara Cache-Control no-store para o endpoint no hosting estático', () => {
    const config = JSON.parse(source('vercel.json')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const endpointRule = config.headers.find((rule) => rule.source === '/api/diario/edicao.json');

    expect(endpointRule).toBeDefined();
    expect(endpointRule?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
  });
});

describe('Verificação de build com o Diário offline', () => {
  it('aceita um build sem superfície pública do Diário', () => {
    const result = verify(buildFixture());
    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain('Diário offline verificado');
  });

  it('rejeita um hub do Diário publicado', () => {
    const root = buildFixture();
    const hub = join(root, 'dist/diario-do-investidor');
    mkdirSync(hub, { recursive: true });
    writeFileSync(join(hub, 'index.html'), '<h1>Diário do Investidor</h1>', 'utf8');

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/diario-do-investidor');
  });

  it('rejeita um endpoint do Diário publicado', () => {
    const root = buildFixture();
    const endpoint = join(root, 'dist/api/diario');
    mkdirSync(endpoint, { recursive: true });
    writeFileSync(join(endpoint, 'edicao.json'), '{}', 'utf8');

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/api/diario');
  });

  it('rejeita qualquer outro endpoint na namespace do Diário', () => {
    const root = buildFixture();
    const endpoint = join(root, 'dist/api/diario');
    mkdirSync(endpoint, { recursive: true });
    writeFileSync(join(endpoint, 'edicoes.json'), '{}', 'utf8');

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/api/diario');
  });

  it('rejeita a namespace de endpoints do Diário mesmo vazia', () => {
    const root = buildFixture();
    mkdirSync(join(root, 'dist/api/diario'), { recursive: true });

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/api/diario');
  });

  it('rejeita referência a um endpoint do Diário no sitemap', () => {
    const root = buildFixture();
    writeFileSync(
      join(root, 'dist/sitemap-0.xml'),
      '<urlset><url><loc>https://example.test/api/diario/edicoes.json</loc></url></urlset>',
      'utf8',
    );

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sitemap');
  });

  it('rejeita referência a um endpoint do Diário no HTML público', () => {
    const root = buildFixture();
    writeFileSync(join(root, 'dist/index.html'), '<script src="/api/diario/edicoes.json"></script>', 'utf8');

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('HTML');
  });

  it('rejeita uma URL do Diário no sitemap', () => {
    const root = buildFixture();
    writeFileSync(
      join(root, 'dist/sitemap-0.xml'),
      '<urlset><url><loc>https://example.test/diario-do-investidor/</loc></url></urlset>',
      'utf8',
    );

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sitemap');
  });

  it('rejeita links ou menções ao Diário no HTML público', () => {
    const root = buildFixture();
    writeFileSync(join(root, 'dist/index.html'), '<a href="/diario-do-investidor/">Diário do Investidor</a>', 'utf8');

    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('HTML');
  });
});

describe('Verificação de build com o Diário online', () => {
  it('aceita hub, metodologia, home, arquivo material, edição morna, sitemap e endpoint alinhados', () => {
    const result = verify(onlineBuildFixture(), ['--online']);

    expect(result.status, String(result.stderr)).toBe(0);
    expect(result.stdout).toContain('Diário verificado');
  });

  it('rejeita a ausência do hub', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, 'dist/diario-do-investidor/index.html'));

    expectOnlineFailure(root, 'Hub do Diário ausente');
  });

  it('rejeita a ausência da home', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, 'dist/index.html'));

    expectOnlineFailure(root, 'Home ausente');
  });

  it('rejeita a ausência da metodologia', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, 'dist/diario-do-investidor/metodologia/index.html'));

    expectOnlineFailure(root, 'Metodologia do Diário ausente');
  });

  it('rejeita a ausência do sitemap', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, 'dist/sitemap-0.xml'));

    expectOnlineFailure(root, 'Sitemap do Diário ausente');
  });

  it('rejeita a ausência do endpoint', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, 'dist/api/diario/edicao.json'));

    expectOnlineFailure(root, 'Endpoint do Diário ausente');
  });

  it('rejeita sitemap sem o hub', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/sitemap-0.xml', `${ORIGIN}/diario-do-investidor/`, `${ORIGIN}/`);

    expectOnlineFailure(root, 'Sitemap do Diário não contém o hub');
  });

  it('rejeita sitemap sem a metodologia', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/sitemap-0.xml', `${ORIGIN}/diario-do-investidor/metodologia/`, `${ORIGIN}/sobre/`);

    expectOnlineFailure(root, 'Sitemap do Diário não contém a metodologia');
  });

  it('rejeita sitemap sem o arquivo material', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/sitemap-0.xml', `<loc>${ORIGIN}/diario-do-investidor/${MATERIAL_DATE}/</loc>`, `<loc>${ORIGIN}/sobre/</loc>`);

    expectOnlineFailure(root, `Sitemap do Diário não contém o arquivo material ${MATERIAL_DATE}`);
  });

  it('rejeita URL de edição morna no sitemap', () => {
    const root = onlineBuildFixture();
    replaceInFixture(
      root,
      'dist/sitemap-0.xml',
      '</urlset>',
      `<url><loc>${ORIGIN}/diario-do-investidor/${QUIET_DATE}/</loc></url></urlset>`,
    );

    expectOnlineFailure(root, `Edição morna no sitemap: ${QUIET_DATE}`);
  });

  it('rejeita endpoint do Diário no sitemap', () => {
    const root = onlineBuildFixture();
    replaceInFixture(
      root,
      'dist/sitemap-0.xml',
      '</urlset>',
      `<url><loc>${ORIGIN}/api/diario/edicao.json</loc></url></urlset>`,
    );

    expectOnlineFailure(root, 'Endpoint do Diário no sitemap');
  });

  it('rejeita home sem link para o Diário', () => {
    const root = onlineBuildFixture();
    writeFileSync(join(root, 'dist/index.html'), '<html><body>Home</body></html>', 'utf8');

    expectOnlineFailure(root, 'Home sem link para o Diário');
  });

  it('rejeita hub sem link para a metodologia', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/index.html', 'href="/diario-do-investidor/metodologia/"', 'href="/sobre/"');

    expectOnlineFailure(root, 'Hub sem link para a metodologia');
  });

  it('rejeita hub sem o link do header para o Diário', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/index.html', '<header><a href="/diario-do-investidor">Diário do Investidor</a></header>', '<header></header>');

    expectOnlineFailure(root, 'Hub sem link no header para o Diário');
  });

  it('rejeita hub sem o link do footer para o Diário', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/index.html', '<footer><a href="/diario-do-investidor/">Diário do Investidor</a></footer>', '<footer></footer>');

    expectOnlineFailure(root, 'Hub sem link no footer para o Diário');
  });

  it('rejeita canonical diferente da URL exata do hub', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/index.html', `${ORIGIN}/diario-do-investidor/`, 'https://example.test/diario-do-investidor/');

    expectOnlineFailure(root, 'Canonical incorreto em hub');
  });

  it('rejeita canonical diferente da URL exata da metodologia', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/metodologia/index.html', `${ORIGIN}/diario-do-investidor/metodologia/`, `${ORIGIN}/diario-do-investidor/metodologia`);

    expectOnlineFailure(root, 'Canonical incorreto em metodologia');
  });

  it('rejeita canonical diferente da URL exata do arquivo material', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, `dist/diario-do-investidor/${MATERIAL_DATE}/index.html`, `${ORIGIN}/diario-do-investidor/${MATERIAL_DATE}/`, 'https://example.test/diario-do-investidor/2026-11-23/');

    expectOnlineFailure(root, `Canonical incorreto em Arquivo material ${MATERIAL_DATE}`);
  });

  it('rejeita JSON-LD inválido mesmo contendo o tipo esperado', () => {
    const root = onlineBuildFixture();
    replaceInFixture(
      root,
      'dist/diario-do-investidor/index.html',
      '{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage"}]}',
      '{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage",}]}',
    );

    expectOnlineFailure(root, 'JSON-LD inválido no hub');
  });

  it('rejeita metodologia sem o JSON-LD WebPage esperado', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/metodologia/index.html', '{"@type":"WebPage"}', '{"@type":"Article"}');

    expectOnlineFailure(root, 'metodologia está sem JSON-LD WebPage');
  });

  it('rejeita URL do Diário com origem diferente no sitemap', () => {
    const root = onlineBuildFixture();
    replaceInFixture(
      root,
      'dist/sitemap-0.xml',
      '</urlset>',
      `<url><loc>https://example.test/diario-do-investidor/${MATERIAL_DATE}/</loc></url></urlset>`,
    );

    expectOnlineFailure(root, `URL inesperada no sitemap do Diário: https://example.test/diario-do-investidor/${MATERIAL_DATE}/`);
  });

  it('rejeita hub sem o painel vivo separado do snapshot', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, 'dist/diario-do-investidor/index.html', 'Indicadores ao vivo', 'Snapshot desta edição');

    expectOnlineFailure(root, 'Hub está sem o painel vivo');
  });

  it('rejeita ausência do arquivo material', () => {
    const root = onlineBuildFixture();
    rmSync(join(root, `dist/diario-do-investidor/${MATERIAL_DATE}/index.html`));

    expectOnlineFailure(root, `Arquivo material ausente: ${MATERIAL_DATE}`);
  });

  it('rejeita página datada para edição morna', () => {
    const root = onlineBuildFixture();
    const directory = join(root, `dist/diario-do-investidor/${QUIET_DATE}`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'index.html'), '<html><body>Edição morna</body></html>', 'utf8');

    expectOnlineFailure(root, `Edição morna virou URL datada: ${QUIET_DATE}`);
  });

  it('rejeita arquivo material sem o snapshot próprio da edição', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, `dist/diario-do-investidor/${MATERIAL_DATE}/index.html`, 'Snapshot desta edição', 'Indicadores ao vivo');

    expectOnlineFailure(root, `Arquivo material ${MATERIAL_DATE} está sem o snapshot próprio`);
  });

  it('rejeita arquivo material sem um bloco do briefing', () => {
    const root = onlineBuildFixture();
    replaceInFixture(root, `dist/diario-do-investidor/${MATERIAL_DATE}/index.html`, '<h2>Por que importa</h2>', '<h2>Contexto</h2>');

    expectOnlineFailure(root, `Arquivo material ${MATERIAL_DATE} está sem o bloco "Por que importa"`);
  });

  it('rejeita endpoint divergente no modo online', () => {
    const root = onlineBuildFixture();
    writeFileSync(join(root, 'dist/api/diario/edicao.json'), '{}', 'utf8');

    const result = verify(root, ['--online']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Endpoint não corresponde');
  });

  it('mantém o padrão offline quando --online não é informado', () => {
    const result = verify(onlineBuildFixture());

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/diario-do-investidor');
  });
});
