import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBcbLastValue,
  fetchBcbRecentValues,
  latestRealizedDate,
  parseBcbDate,
} from '../../src/lib/bcb';
import { computeCurationBundleHash } from '../../src/lib/diario/governance';
import { collectInputs } from '../../src/lib/diario/ingest';
import type { AllowlistSource, Approval, BcbObservation, CollectedInputs } from '../../src/lib/diario/types';

const DATE = '2026-11-23';
const NOW = new Date('2026-11-23T19:00:00.000Z');
const VAULT_DIR = join(process.cwd(), 'src/data/diario/curadoria');
const ALPHA_FEED = 'https://feeds.example.test/alpha/rss';
const BETA_FEED = 'https://feeds.example.test/beta/rss';
const ARTICLE = 'https://news.example.test/story';

type FetchMock = ReturnType<typeof vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>>;

let root: string;
let vault: string;

function source(id: string, feed: string, enabled = true): AllowlistSource {
  return {
    id,
    publisher: id === 'alpha' ? 'Editora Alpha' : 'Editora Beta',
    kind: 'media',
    feeds: [{ url: feed, topics: ['juros'] }],
    enabled,
  };
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(vault, name), 'utf8')) as T;
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(join(vault, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setSources(sources: AllowlistSource[]): void {
  const allowlist = readJson<{ version: string; sources: AllowlistSource[] }>('allowlist.json');
  allowlist.sources = sources;
  writeJson('allowlist.json', allowlist);
  const approval = readJson<Approval>('approval.json');
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeJson('approval.json', approval);
}

function xmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function rssItem(options: {
  title?: string;
  link?: string;
  description?: string;
  published?: string;
  extra?: string;
} = {}): string {
  const title = options.title ?? 'Juros e inflação';
  const link = options.link ?? ARTICLE;
  const description = options.description ?? 'Resumo curto da notícia.';
  const published = options.published ?? 'Mon, 23 Nov 2026 18:00:00 +0000';
  return `<item><title>${xmlEscape(title)}</title><link>${xmlEscape(link)}</link><description>${xmlEscape(description)}</description><pubDate>${xmlEscape(published)}</pubDate>${options.extra ?? ''}</item>`;
}

function rss(items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed</title><link>https://feeds.example.test/</link><description>Feed</description>${items.join('')}</channel></rss>`;
}

function atomItem(): string {
  return `<entry><title>Juros e inflação</title><link href="${ARTICLE}" rel="alternate" type="text/html"/><summary>Resumo curto da notícia.</summary><published>2026-11-23T18:00:00Z</published></entry>`;
}

function bcbPayload(code: number, count: number): Response {
  if (code === 1) {
    return new Response(
      JSON.stringify([
        { data: '20/11/2026', valor: '5.40' },
        { data: '23/11/2026', valor: '5.50' },
        { data: '19/11/2026', valor: '5.35' },
        { data: '31/02/2026', valor: '999' },
      ]),
      { status: 200 },
    );
  }
  const values: Record<number, string> = { 432: '13.75', 4389: '13.65', 13522: '4.58' };
  return new Response(JSON.stringify([{ data: '23/11/2026', valor: values[code] }]), { status: 200 });
}

function defaultHandler(input: string | URL | Request): Response {
  const url = new URL(String(input));
  if (url.hostname === 'api.bcb.gov.br') {
    const code = Number(/bcdata\.sgs\.(\d+)/.exec(url.pathname)?.[1]);
    const count = Number(/ultimos\/(\d+)/.exec(url.pathname)?.[1]);
    return bcbPayload(code, count);
  }
  if (url.href === ALPHA_FEED) return new Response(rss([rssItem()]), { status: 200 });
  if (url.href === BETA_FEED) return new Response(rss([rssItem({ title: 'Câmbio e reservas', link: 'https://news.example.test/fx' })]), { status: 200 });
  throw new Error(`Unexpected request: ${url.href}`);
}

function mockFetch(handler: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response> = defaultHandler): FetchMock {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(input, init));
}

async function collect(fetchMock: FetchMock): Promise<CollectedInputs> {
  return collectInputs(DATE, { root, now: NOW, fetch: fetchMock as unknown as typeof fetch });
}

function requestedUrls(fetchMock: FetchMock): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

function cacheInputs(): CollectedInputs {
  return JSON.parse(readFileSync(join(root, '.cache/diario', DATE, 'inputs.json'), 'utf8')) as CollectedInputs;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'diario-ingest-'));
  const dataDir = join(root, 'src/data/diario');
  mkdirSync(dataDir, { recursive: true });
  vault = join(dataDir, 'curadoria');
  cpSync(VAULT_DIR, vault, { recursive: true });
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(root, { recursive: true, force: true });
});

describe('BCB transport', () => {
  it('parseBcbDate accepts real dates and rejects impossible or ambiguous values', () => {
    expect(parseBcbDate('23/11/2026')).toBe('2026-11-23');
    expect(parseBcbDate('2026-11-23')).toBe('2026-11-23');
    expect(parseBcbDate('31/02/2026')).toBeNull();
    expect(parseBcbDate('23/11/26')).toBeNull();
    expect(parseBcbDate('')).toBeNull();
  });

  it('latestRealizedDate ignores future and invalid observations', () => {
    const observations: Array<BcbObservation | null> = [
      { value: 1, date: '2026-11-24' },
      { value: 1, date: '2026-11-20' },
      { value: 1, date: '2026-11-23' },
      { value: 1, date: 'invalid' },
      null,
    ];

    expect(latestRealizedDate(observations, NOW)).toBe('23/11/2026');
    expect(latestRealizedDate([{ value: 1, date: '2026-11-24' }], NOW)).toBeNull();
  });

  it('fetchBcbRecentValues keeps the newest valid dated observations', async () => {
    const fetchMock = mockFetch(() => bcbPayload(1, 2));

    await expect(fetchBcbRecentValues(1, 2, fetchMock as unknown as typeof fetch)).resolves.toEqual([
      { value: 5.5, date: '2026-11-23' },
      { value: 5.4, date: '2026-11-20' },
    ]);
  });

  it('every BCB request uses redirect manual', async () => {
    const fetchMock = mockFetch(() => bcbPayload(432, 1));

    await fetchBcbLastValue(432, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual');
  });

  it.each([
    ['http scheme', 'http://api.bcb.gov.br/steal'],
    ['deceptive host', 'https://api.bcb.gov.br.evil.test/steal'],
    ['credentials', 'https://user:secret@api.bcb.gov.br/steal'],
    ['wrong port', 'https://api.bcb.gov.br:444/steal'],
  ])('BCB never requests a forbidden redirect target: %s', async (_label, location) => {
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url.includes('bcdata.sgs.432')) {
        return new Response(null, { status: 302, headers: { Location: location } });
      }
      throw new Error(`Forbidden target was requested: ${url}`);
    });

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('BCB rejects a malformed Location without requesting the target', async () => {
    const fetchMock = mockFetch((input) => {
      if (String(input).includes('bcdata.sgs.432')) {
        return new Response(null, { status: 302, headers: { Location: '/validated/\tserie?formato=json' } });
      }
      return new Response(JSON.stringify([{ data: '23/11/2026', valor: '13.75' }]), { status: 200 });
    });

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('BCB follows a validated same-host redirect manually', async () => {
    const fetchMock = mockFetch((input) => {
      if (String(input).includes('/dados/')) {
        return new Response(null, { status: 302, headers: { Location: '/validated/serie?formato=json' } });
      }
      return new Response(JSON.stringify([{ data: '23/11/2026', valor: '13.75' }]), { status: 200 });
    });

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toEqual({
      value: 13.75,
      date: '2026-11-23',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) expect(init?.redirect).toBe('manual');
  });
});

describe('allowlisted ingestion', () => {
  it('verifies governance before any network request', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const approval = readJson<Approval>('approval.json');
    approval.bundleSha256 = '0'.repeat(64);
    writeJson('approval.json', approval);
    const fetchMock = mockFetch();

    await expect(collect(fetchMock)).rejects.toThrow(/bundleSha256|hash/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches only enabled feeds and uses redirect manual for every request', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED, false)]);
    const fetchMock = mockFetch();

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha']);
    expect(requestedUrls(fetchMock).some((url) => url === BETA_FEED)).toBe(false);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('api.bcb.gov.br'))).toHaveLength(4);
    for (const [, init] of fetchMock.mock.calls) expect(init?.redirect).toBe('manual');
  });

  it('persists normalized inputs and the exact four SGS series', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch();

    const result = await collect(fetchMock);

    expect(result.date).toBe(DATE);
    expect(result.retrievedAt).toBe(NOW.toISOString());
    expect(result.events).toEqual([]);
    expect(result.lessons).toHaveLength(12);
    expect(result.previousEditions).toEqual([]);
    expect(cacheInputs()).toEqual(result);
    const bcbCalls = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes('api.bcb.gov.br'));
    expect(bcbCalls.map((url) => Number(/bcdata\.sgs\.(\d+)/.exec(url)?.[1]))).toEqual([432, 4389, 13522, 1]);
    expect(bcbCalls[3]).toContain('/ultimos/2?formato=json');
  });

  it('dólar uses exactly the two most recent observations with valid dates', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const result = await collect(mockFetch());

    expect(result.bcb.dolar).toEqual([
      { value: 5.5, date: '2026-11-23' },
      { value: 5.4, date: '2026-11-20' },
    ]);
  });

  it('BCB outage does not invent freshness or suppress healthy feeds', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input).includes('api.bcb.gov.br')) return new Response('offline', { status: 503 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.bcb).toEqual({ selic: [], cdi: [], ipca12m: [], dolar: [] });
    expect(result).not.toHaveProperty('updatedAt');
    expect(result.sources).toHaveLength(1);
  });

  it.each([
    ['http scheme', 'http://feeds.example.test/evil'],
    ['deceptive host', 'https://feeds.example.test.evil.test/rss'],
    ['credentials', 'https://user:secret@feeds.example.test/rss'],
    ['wrong port', 'https://feeds.example.test:444/rss'],
    ['oversized resolved target', `/${'x'.repeat(2030)}`],
  ])('never requests forbidden redirect target: %s', async (_label, location) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) return new Response(null, { status: 302, headers: { Location: location } });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(fetchMock).filter((url) => url.includes('feeds.example.test'))).toEqual([ALPHA_FEED, BETA_FEED]);
  });

  it('malformed and loop redirects skip only that source', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) return new Response(null, { status: 302, headers: { Location: 'http://[' } });
      if (url === `${ALPHA_FEED}/loop`) return new Response(null, { status: 302, headers: { Location: `${ALPHA_FEED}/loop` } });
      return defaultHandler(input);
    });

    const malformed = await collect(fetchMock);
    expect(malformed.sources.map((item) => item.sourceId)).toEqual(['beta']);

    setSources([source('alpha', `${ALPHA_FEED}/loop`), source('beta', BETA_FEED)]);
    const loopMock = mockFetch((input) => {
      const url = String(input);
      if (url === `${ALPHA_FEED}/loop`) return new Response(null, { status: 302, headers: { Location: url } });
      return defaultHandler(input);
    });
    const loop = await collect(loopMock);
    expect(loop.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(loopMock).filter((url) => url.includes('/loop'))).toEqual([`${ALPHA_FEED}/loop`]);
  });

  it('allows three validated redirect hops', async () => {
    const feed = 'https://feeds.example.test/hop/0';
    setSources([source('alpha', feed)]);
    const fetchMock = mockFetch((input) => {
      const url = new URL(String(input));
      const hop = Number(/\/hop\/(\d+)/.exec(url.pathname)?.[1]);
      if (hop < 3) return new Response(null, { status: 302, headers: { Location: `/hop/${hop + 1}` } });
      return new Response(rss([rssItem()]), { status: 200 });
    });

    const result = await collect(fetchMock);

    expect(result.sources).toHaveLength(1);
    expect(requestedUrls(fetchMock).filter((url) => url.includes('/hop/'))).toHaveLength(4);
    for (const [, init] of fetchMock.mock.calls) expect(init?.redirect).toBe('manual');
  });

  it('the fourth hop fails closed for only that source', async () => {
    const feed = 'https://feeds.example.test/hop/0';
    setSources([source('alpha', feed), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url.includes('/hop/')) {
        const hop = Number(/\/hop\/(\d+)/.exec(url)?.[1]);
        return new Response(null, { status: 302, headers: { Location: `/hop/${hop + 1}` } });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(fetchMock).filter((url) => url.includes('/hop/'))).toEqual([
      'https://feeds.example.test/hop/0',
      'https://feeds.example.test/hop/1',
      'https://feeds.example.test/hop/2',
      'https://feeds.example.test/hop/3',
    ]);
  });

  it.each([401, 402, 403])('HTTP %i interrupts only that source', async (status) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response('paywalled', { status });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('a paywalled HTML response skips only that source', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response('<html><body>Assine para ler</body></html>', { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('RSS malformado pula só aquela fonte', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response('<rss><channel><item></rss>', { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('XML válido com nesting excessivo pula só aquela fonte', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const deeplyNested = `<rss><channel>${'<x>'.repeat(1_000)}${'</x>'.repeat(1_000)}</channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(deeplyNested, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('XML não processa entidades e rejeita DOCTYPE/entity declarations', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const hostile = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel>${rssItem({ description: '&xxe;' })}</channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(JSON.stringify(cacheInputs())).not.toContain('root:');
  });

  it('the XML parser leaves entity references unexpanded', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const literalEntityFeed = `<?xml version="1.0"?><rss><channel>${rssItem({ title: 'Juros &amp; inflação' }).replace('Juros &amp;amp; inflação', 'Juros &amp; inflação')}</channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(literalEntityFeed, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.title).toBe('Juros &amp; inflação');
  });

  it('caps response bytes and skips only the oversized source', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem({ description: 'x'.repeat(1_000_001) })]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('times out a stalled source without stopping healthy sources', async () => {
    vi.useFakeTimers();
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input, init) => {
      if (String(input) === ALPHA_FEED) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      }
      return defaultHandler(input);
    });

    const pending = collect(fetchMock);
    await vi.advanceTimersByTimeAsync(5_001);
    const result = await pending;

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it.each([
    ['non-HTTPS article URL', { link: 'http://news.example.test/story' }],
    ['credentialled article URL', { link: 'https://user:secret@news.example.test/story' }],
    ['unsafe title length', { title: 'x'.repeat(501) }],
    ['control character in title', { title: 'Juros\ttema inflação' }],
    ['unsafe URL length', { link: `https://news.example.test/${'x'.repeat(2_100)}` }],
  ])('rejects unsafe metadata: %s', async (_label, options) => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem(options)]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources).toEqual([]);
  });

  it('deduplicates canonical URL and normalized title without collapsing independent publishers', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(
          rss([
            rssItem({ link: 'https://news.example.test/story?b=2&utm_source=feed&a=1#section' }),
            rssItem({ link: 'https://news.example.test/story?b=2&a=1' }),
            rssItem({ title: 'Juros e inflação!!!', link: 'https://news.example.test/other' }),
          ]),
          { status: 200 },
        );
      }
      if (String(input) === BETA_FEED) {
        return new Response(rss([rssItem({ title: 'juros e inflacao', link: 'https://news.example.test/corroboration' })]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha', 'beta']);
    expect(result.sources[0]?.canonicalUrl).toBe('https://news.example.test/story?a=1&b=2');
  });

  it('parses Atom entries and normalizes timestamps and excerpts', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${atomItem()}</feed>`, { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({
      sourceId: 'alpha',
      title: 'Juros e inflação',
      canonicalUrl: ARTICLE,
      publishedAt: '2026-11-23T18:00:00.000Z',
      excerpt: 'Resumo curto da notícia.',
    });
    expect(result.sources[0]?.excerptSha256).toBe(
      createHash('sha256').update('Resumo curto da notícia.', 'utf8').digest('hex'),
    );
  });

  it('cache excludes article body and never fetches the article URL', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const body = `${'texto '.repeat(200)}ARTICLE_BODY_SENTINEL`;
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ARTICLE) throw new Error('Article body must never be fetched');
      if (url === ALPHA_FEED) {
        return new Response(rss([rssItem({ description: body, extra: '<content><![CDATA[CONTENT_ENCODED_SENTINEL]]></content>' })]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);
    const cached = readFileSync(join(root, '.cache/diario', DATE, 'inputs.json'), 'utf8');

    expect(result.sources[0]?.excerpt.length).toBeLessThanOrEqual(600);
    expect(cached).not.toContain('ARTICLE_BODY_SENTINEL');
    expect(cached).not.toContain('CONTENT_ENCODED_SENTINEL');
    expect(cached).not.toContain('content:encoded');
    expect(requestedUrls(fetchMock)).not.toContain(ARTICLE);
  });

  it('rejects an invalid collection date before governance or network access', async () => {
    const fetchMock = mockFetch();

    await expect(collectInputs('2026-02-30', { root, now: NOW, fetch: fetchMock as unknown as typeof fetch })).rejects.toThrow(/date/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('build boundary', () => {
  it('collection CLI does not import site config or enter the indicator build path', () => {
    const cli = readFileSync('scripts/diario/collect.ts', 'utf8');
    const indicators = readFileSync('src/lib/indicators.ts', 'utf8');

    expect(cli).not.toMatch(/config\/site|import\.meta\.env/u);
    expect(cli).toContain('collectInputs');
    expect(indicators).not.toMatch(/diario\/ingest|collectInputs/u);
  });
});
