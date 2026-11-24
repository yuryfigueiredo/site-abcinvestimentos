import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { draft } from './fixtures';

const ROOT = process.cwd();
const BRIEFING_HEADINGS = ['O que aconteceu', 'Por que importa', 'O que observar'] as const;
const temporaryRoots: string[] = [];

function source(relativePath: string): string {
  const path = join(ROOT, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function componentTag(componentSource: string, name: string): string {
  const start = componentSource.indexOf(`<${name}`);
  if (start === -1) return '';
  const end = componentSource.indexOf('>', start);
  return end === -1 ? '' : componentSource.slice(start, end + 1);
}

const hub = source('src/pages/diario-do-investidor/index.astro');
const archive = source('src/pages/diario-do-investidor/[date].astro');
const body = source('src/components/diario/EditionBody.astro');
const indicatorGrid = source('src/components/diario/IndicatorGrid.astro');
const eventCard = source('src/components/diario/EventCard.astro');
const verifyBuild = source('scripts/diario/verify-build.ts');

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Diário article surfaces', () => {
  it('opts the hub and dated archive into explicit body variants', () => {
    expect(componentTag(hub, 'EditionBody')).toContain('variant="hub"');

    const archiveBody = componentTag(archive, 'EditionBody');
    expect(archiveBody).toContain('variant="article"');
    expect(archiveBody).toContain('showSummary={false}');
  });

  it('renders the complete briefing only in the article variant', () => {
    expect(body).toMatch(/variant === 'article' && briefing/u);
    expect(body).toContain('briefing.whatHappened');
    expect(body).toContain('briefing.whyItMatters');
    expect(body).toContain('briefing.whatToWatch');

    for (const heading of BRIEFING_HEADINGS) {
      expect(body).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`, 'u'));
      expect(hub).not.toContain(heading);
    }
  });

  it('renders the factual event card only when the article has an event', () => {
    expect(body).toContain("import EventCard from './EventCard.astro'");
    expect(body).toMatch(/variant === 'article' && edition\.event && \([\s\S]*?<EventCard event=\{edition\.event\} \/>/u);
    expect(hub).not.toContain('EventCard');

    expect(eventCard).toContain('event.date');
    expect(eventCard).toContain('event.title');
    expect(eventCard).toContain('event.sourceUrl');
    expect(eventCard).toContain('datetime={event.date}');
    expect(eventCard).not.toMatch(/<script\b/u);
  });

  it('links each news item to its selected sources and retains the final source list', () => {
    expect(body).toMatch(/edition\.sources\.map\([\s\S]*?source\.id/u);
    expect(body).toMatch(/item\.sourceIds\.map\(/u);
    expect(body).toContain('sourcesById.get(');
    expect(body).toContain('href={itemSource.canonicalUrl}');
    expect(body).toMatch(/variant === 'article' && itemSources\.length > 0/u);
    expect(body).toContain('<SourceList sources={edition.sources} />');
    expect(body.indexOf('<SourceList')).toBeGreaterThan(body.indexOf('<EventCard'));
  });

  it('places the archive summary before the responsive snapshot grid', () => {
    const summary = '<p class="diario-article__summary">{edition.summary}</p>';
    expect(archive).toContain(summary);
    expect(archive.indexOf(summary)).toBeLessThan(archive.indexOf('<div class="diario-article__grid">'));
    expect(archive.indexOf(summary)).toBeLessThan(archive.indexOf('<IndicatorGrid'));
  });

  it('maps the four fixed snapshot keys and uses explicit unavailable rows', () => {
    expect(archive).toContain("['selic', 'cdi', 'ipca12m', 'dolar']");
    expect(archive).toMatch(/measured\[key\] \?\? \{\s*value: null,\s*observedOn: null,\s*origin: 'unavailable',?\s*\}/u);
    expect(archive).toContain('edition.snapshot.measured');
    expect(archive).not.toMatch(/getIndicators/u);
  });

  it('renders all four indicators including unavailable values without inventing freshness', () => {
    expect(indicatorGrid).toContain('export interface IndicatorRow');
    expect(indicatorGrid).toMatch(/value: number \| null;/u);
    expect(indicatorGrid).toMatch(/observedOn: string \| null;/u);
    expect(indicatorGrid).toContain('row.value === null || !Number.isFinite(row.value)');
    expect(indicatorGrid).toContain('Indisponível');
    expect(indicatorGrid).toMatch(/Number\.isFinite\(row\.value\)[\s\S]*?formatValue\(row\.key, row\.value\)/u);
    expect(indicatorGrid).toContain('datetime={row.observedOn}');
  });

  it('passes the archived dollar change and enables the BCB series note only in the archive', () => {
    const archiveGrid = componentTag(archive, 'IndicatorGrid');
    expect(archiveGrid).toContain('dollarChangePct={edition.snapshot.dollarChangePct}');
    expect(archiveGrid).toContain('showBcbSource={true}');
    expect(componentTag(hub, 'IndicatorGrid')).not.toContain('showBcbSource');

    expect(indicatorGrid).toMatch(/dollarChangePct !== null && dollarChangePct !== undefined[\s\S]*?formatPct\(dollarChangePct\)/u);
    expect(indicatorGrid).toContain('em relação à observação anterior');
    expect(indicatorGrid).toContain('showBcbSource &&');

    for (const code of ['432', '4389', '13522', '1']) {
      expect(indicatorGrid).toContain(code);
    }
  });

  it('scopes readable article typography and visible focus without adding JavaScript', () => {
    expect(body).toMatch(/\.edition-body--article\s*\{[^}]*max-inline-size:\s*(?:6[89]|7[0-2])ch;/u);
    expect(body).toMatch(/\.edition-body--article\s*\{[^}]*line-height:\s*1\.[78]\d*;/u);
    expect(body).toContain('text-wrap: pretty');
    expect(body).toContain('text-wrap: balance');
    expect(body).toContain(':global(a):focus-visible');
    expect(archive).toContain('text-wrap: pretty');
    expect(archive).toContain('text-wrap: balance');
    expect(body).not.toMatch(/<script\b/u);
  });

  it('keeps article sources and factual metadata at the site small-body size', () => {
    expect(body).toMatch(/\.edition-body--article :global\(\.source-list__publisher\)\s*\{[^}]*font-size:\s*0\.88rem;/u);
    expect(body).toMatch(/\.edition-body--article :global\(\.source-list li p\)\s*\{[^}]*font-size:\s*0\.88rem;/u);
    expect(archive).toMatch(/\.diario-article__aside :global\(\.indicator-panel__source\)[\s\S]*?font-size:\s*0\.88rem;/u);
  });

  it('requires all briefing headings in the build verifier', () => {
    for (const heading of BRIEFING_HEADINGS) {
      expect(verifyBuild).toContain(`'${heading}'`);
    }
    expect(verifyBuild).toContain('BRIEFING_HEADINGS');
    expect(verifyBuild).toMatch(/for \(const heading of BRIEFING_HEADINGS\)/u);
  });
});

interface BuildFixture {
  root: string;
  datedPath: string;
  quietDate: string;
}

function buildFixture(): BuildFixture {
  const root = mkdtempSync(join(tmpdir(), 'diario-surface-build-'));
  temporaryRoots.push(root);
  cpSync(join(ROOT, 'src/data/diario'), join(root, 'src/data/diario'), { recursive: true });

  const quiet = draft('2026-11-24');
  writeFileSync(
    join(root, 'src/data/diario/edicoes', `${quiet.date}.json`),
    `${JSON.stringify(quiet, null, 2)}\n`,
    'utf8',
  );

  const hubDirectory = join(root, 'dist/diario-do-investidor');
  const datedDirectory = join(hubDirectory, '2026-11-23');
  mkdirSync(datedDirectory, { recursive: true });
  mkdirSync(join(root, 'dist/api/diario'), { recursive: true });
  writeFileSync(
    join(hubDirectory, 'index.html'),
    '<link rel="canonical" href="https://example.test/"><script type="application/ld+json">{"@type":"CollectionPage"}</script>',
    'utf8',
  );
  writeFileSync(join(root, 'dist/api/diario/edicao.json'), `${JSON.stringify(quiet)}\n`, 'utf8');

  return { root, datedPath: join(datedDirectory, 'index.html'), quietDate: quiet.date };
}

function materialHtml(headings: readonly string[]): string {
  return `<link rel="canonical" href="https://example.test/edition/"><script type="application/ld+json">{"@type":"Article"}</script>${headings.map((heading) => `<h2>${heading}</h2>`).join('')}`;
}

function verify(root: string): ReturnType<typeof spawnSync> {
  return spawnSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/diario/verify-build.ts')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

describe('Diário build verification', () => {
  it.each(BRIEFING_HEADINGS)('rejects a material page missing the heading %s', (missingHeading) => {
    const fixture = buildFixture();
    writeFileSync(
      fixture.datedPath,
      materialHtml(BRIEFING_HEADINGS.filter((heading) => heading !== missingHeading)),
      'utf8',
    );

    const result = verify(fixture.root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(missingHeading);
  });

  it('accepts a no-news material page without external sources or a quiet dated URL', () => {
    const fixture = buildFixture();
    writeFileSync(fixture.datedPath, materialHtml(BRIEFING_HEADINGS), 'utf8');

    const result = verify(fixture.root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 arquivo(s) material(is)');
    expect(result.stdout).toContain('1 edição(ões) morna(s) sem URL');
  });

  it('rejects a dated URL for a quiet edition', () => {
    const fixture = buildFixture();
    writeFileSync(fixture.datedPath, materialHtml(BRIEFING_HEADINGS), 'utf8');
    const quietDirectory = join(fixture.root, 'dist/diario-do-investidor', fixture.quietDate);
    mkdirSync(quietDirectory, { recursive: true });
    writeFileSync(join(quietDirectory, 'index.html'), materialHtml(BRIEFING_HEADINGS), 'utf8');

    const result = verify(fixture.root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Edição morna virou URL datada');
  });
});
