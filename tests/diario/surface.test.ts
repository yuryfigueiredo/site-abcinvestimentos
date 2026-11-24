import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { computeCurationBundleHash } from '../../src/lib/diario/governance';
import { readEditions } from '../../src/lib/diario/store';
import { DATE, draft } from './fixtures';

const ROOT = process.cwd();
const BRIEFING_HEADINGS = ['O que aconteceu', 'Por que importa', 'O que observar'] as const;
const MATERIAL_DATE = DATE;
const QUIET_DATE = '2026-11-24';
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

function styleRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const rule = new RegExp(String.raw`${escapedSelector}\s*\{([^}]*)\}`, 'u').exec(css);
  if (!rule) throw new Error(`CSS rule not found: ${selector}`);
  return rule[1];
}

function declaration(rule: string, property: string): string {
  const value = new RegExp(String.raw`(?:^|;)\s*${property}:\s*([^;]+);`, 'u').exec(rule)?.[1]?.trim();
  if (!value) throw new Error(`CSS declaration not found: ${property}`);
  return value;
}

function themeTokens(theme: 'light' | 'dark'): Record<string, string> {
  const pattern = theme === 'light'
    ? /:root\[data-theme="light"\],\s*html\[data-theme="light"\]\s*\{([^}]*)\}/u
    : /:root\[data-theme="dark"\],\s*html\[data-theme="dark"\]\s*\{([^}]*)\}/u;
  const block = pattern.exec(globalStyles)?.[1];
  if (!block) throw new Error(`Theme tokens not found: ${theme}`);
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/gu)].map(([, name, value]) => [name, value.trim()]),
  );
}

function resolveCssValue(value: string, tokens: Record<string, string>, seen = new Set<string>()): string {
  const variable = /^var\((--[\w-]+)\)$/u.exec(value.trim());
  if (!variable) return value.trim();
  const name = variable[1];
  if (seen.has(name)) throw new Error(`Circular CSS token: ${name}`);
  const token = tokens[name];
  if (!token) throw new Error(`CSS token not found: ${name}`);
  return resolveCssValue(token, tokens, new Set([...seen, name]));
}

interface Rgba {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseColor(value: string): Rgba {
  const hex = /^#([\da-f]{6})$/iu.exec(value);
  if (hex) {
    return {
      red: Number.parseInt(hex[1].slice(0, 2), 16),
      green: Number.parseInt(hex[1].slice(2, 4), 16),
      blue: Number.parseInt(hex[1].slice(4, 6), 16),
      alpha: 1,
    };
  }
  const rgba = /^rgba?\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*(\d*\.?\d+))?\s*\)$/iu.exec(value);
  if (!rgba) throw new Error(`Unsupported CSS color: ${value}`);
  return {
    red: Number(rgba[1]),
    green: Number(rgba[2]),
    blue: Number(rgba[3]),
    alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
  };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  return {
    red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
    green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
    blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
    alpha: 1,
  };
}

function luminance(color: Rgba): number {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const hub = source('src/pages/diario-do-investidor/index.astro');
const archive = source('src/pages/diario-do-investidor/[date].astro');
const body = source('src/components/diario/EditionBody.astro');
const indicatorGrid = source('src/components/diario/IndicatorGrid.astro');
const eventCard = source('src/components/diario/EventCard.astro');
const globalStyles = source('src/styles/global.css');
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

  it.each([
    { label: 'article news source', css: body, selector: '.edition-body--article .edition-body__item-sources a' },
    { label: 'event', css: eventCard, selector: '.event-card a' },
  ])('keeps $label links at WCAG AA contrast in light and dark themes', ({ css, selector }) => {
    const linkColor = declaration(styleRule(css, selector), 'color');
    const cardBackground = declaration(styleRule(globalStyles, '.abc-card'), 'background');

    for (const theme of ['light', 'dark'] as const) {
      const tokens = themeTokens(theme);
      const canvas = parseColor(resolveCssValue(tokens['--bg-canvas'], tokens));
      const card = composite(parseColor(resolveCssValue(cardBackground, tokens)), canvas);
      const foreground = composite(parseColor(resolveCssValue(linkColor, tokens)), card);
      const ratio = contrastRatio(foreground, card);

      expect(ratio, `${theme}: ${linkColor} on ${cardBackground}`).toBeGreaterThanOrEqual(4.5);
    }
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
  cpSync(join(ROOT, 'src/data/diario/curadoria'), join(root, 'src/data/diario/curadoria'), { recursive: true });

  const approvalPath = join(root, 'src/data/diario/curadoria/approval.json');
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as Record<string, unknown>;
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');

  const material = draft(MATERIAL_DATE);
  const quiet = draft(QUIET_DATE);
  if (material.decision.status !== 'material' || material.items.length > 0) {
    throw new Error('The material fixture must be a no-news edition');
  }
  if (quiet.decision.status !== 'morno') throw new Error('The quiet fixture must be a quiet edition');

  const editionsDirectory = join(root, 'src/data/diario/edicoes');
  mkdirSync(editionsDirectory, { recursive: true });
  for (const edition of [material, quiet]) {
    writeFileSync(
      join(editionsDirectory, `${edition.date}.json`),
      `${JSON.stringify(edition, null, 2)}\n`,
      'utf8',
    );
  }

  const hubDirectory = join(root, 'dist/diario-do-investidor');
  const datedDirectory = join(hubDirectory, material.date);
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
  it('uses an isolated one-material/one-quiet edition dataset', () => {
    const fixture = buildFixture();
    const editions = readEditions(fixture.root);

    expect(editions.map((edition) => edition.date)).toEqual([QUIET_DATE, MATERIAL_DATE]);
    expect(editions.map((edition) => edition.decision.status)).toEqual(['morno', 'material']);
  });

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
    expect(result.status, String(result.stderr)).toBe(0);
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
