import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const temporaryRoots: string[] = [];
const PUBLIC_FILES = [
  'src/pages/diario-do-investidor/index.astro',
  'src/pages/diario-do-investidor/[date].astro',
  'src/pages/diario-do-investidor/metodologia.astro',
  'src/pages/api/diario/edicao.json.ts',
] as const;

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-offline-build-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'dist'), { recursive: true });
  return root;
}

function verify(root: string): ReturnType<typeof spawnSync> {
  return spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/diario/verify-build.ts')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Diário fora do ar', () => {
  it.each(PUBLIC_FILES)('não publica %s', (relativePath) => {
    expect(existsSync(join(ROOT, relativePath))).toBe(false);
  });

  it('remove o Diário do header, do footer e da home', () => {
    for (const relativePath of ['src/components/Header.astro', 'src/components/Footer.astro', 'src/pages/index.astro']) {
      const content = source(relativePath);
      expect(content).not.toContain('/diario-do-investidor');
      expect(content).not.toContain('Diário do Investidor');
    }
  });

  it('não carrega o Diário nem seus metadados no build do sitemap', () => {
    const config = source('astro.config.mjs');
    expect(config).not.toContain('src/lib/diario');
    expect(config).not.toContain('diarioSitemap');
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
