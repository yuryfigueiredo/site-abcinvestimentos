import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function atomFeed(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">${entries.join('')}</feed>`;
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

function trackedResponse(
  chunks: Array<string | Uint8Array>,
  init: ResponseInit = {},
  close = true,
): { response: Response; cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      if (close) controller.close();
    },
    cancel,
  });
  return { response: new Response(body, init), cancel };
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

  it('reads BCB JSON from streamed chunks', async () => {
    const payload = JSON.stringify([{ data: '23/11/2026', valor: '13.75' }]);
    const bytes = new TextEncoder().encode(payload);
    const split = Math.floor(bytes.length / 2);
    const { response } = trackedResponse([bytes.slice(0, split), bytes.slice(split)]);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toEqual({
      value: 13.75,
      date: '2026-11-23',
    });
  });

  it('cancels an unread BCB body when the declared size exceeds the cap', async () => {
    const { response, cancel } = trackedResponse(['{}'], { headers: { 'content-length': '1000001' } }, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('enforces the BCB byte cap while streaming and cancels the remainder', async () => {
    const { response, cancel } = trackedResponse(['x'.repeat(600_000), 'x'.repeat(600_000)], {}, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid UTF-8 and cancels the unread BCB remainder', async () => {
    const { response, cancel } = trackedResponse([new Uint8Array([0xff]), '{"data":"23/11/2026","valor":"13.75"}'], {}, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-JSON BCB response and cancels its unread body', async () => {
    const { response, cancel } = trackedResponse(['[{"data":"23/11/2026","valor":"13.75"}]'], {
      headers: { 'content-type': 'text/html' },
    }, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([401, 402, 403])('cancels an unread BCB body on HTTP %i', async (status) => {
    const { response, cancel } = trackedResponse(['offline'], { status }, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['malformed Location', 'http://['],
    ['forbidden redirect target', 'https://api.bcb.gov.br.evil.test/serie'],
    ['redirect loop', '/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'],
  ])('cancels an unread BCB redirect body on %s', async (_label, location) => {
    const { response, cancel } = trackedResponse(['redirect'], { status: 302, headers: { location } }, false);
    const fetchMock = mockFetch(() => response);

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels every unread BCB redirect body at the hop limit', async () => {
    const responses: Array<ReturnType<typeof trackedResponse>> = [];
    const fetchMock = mockFetch(() => {
      const tracked = trackedResponse(['redirect'], {
        status: 302,
        headers: { location: `/dados/serie/hop-${responses.length + 1}?formato=json` },
      }, false);
      responses.push(tracked);
      return tracked.response;
    });

    await expect(fetchBcbLastValue(432, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
    expect(responses).toHaveLength(4);
    for (const { cancel } of responses) expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('aborts a stalled BCB request on timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchMock = mockFetch((_input, init) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));

    const pending = fetchBcbLastValue(432, fetchMock as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(3_501);
    await expect(pending).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  it('aborts and cleans up a BCB body that stalls after headers', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchMock = mockFetch((_input, init) => {
      signal = init?.signal ?? undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
        },
        pull() {
          return new Promise<void>(() => {});
        },
      });
      return new Response(body, { status: 200 });
    });

    const pending = fetchBcbLastValue(432, fetchMock as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(3_501);
    await expect(pending).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
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

  it.each(['fetch', 'parse'])('throws collection-unavailable when every enabled feed fails to %s and persists nothing', async (failure) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED || url === BETA_FEED) {
        return failure === 'fetch' ? new Response('offline', { status: 503 }) : new Response('<rss><channel>', { status: 200 });
      }
      return defaultHandler(input);
    });

    await expect(collect(fetchMock)).rejects.toThrow(/collection unavailable.*every enabled feed/i);
    expect(existsSync(join(root, '.cache/diario', DATE, 'inputs.json'))).toBe(false);
  });

  it('keeps per-feed failures isolated when another enabled feed succeeds', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response('<rss><channel>', { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(cacheInputs()).toEqual(result);
  });

  it.each([
    ['RSS', rss([])],
    ['Atom', atomFeed([])],
  ])('treats one successfully parsed empty %s feed as quiet evidence despite another feed failure', async (_format, xml) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(xml, { status: 200 });
      if (String(input) === BETA_FEED) return new Response('offline', { status: 503 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources).toEqual([]);
    expect(cacheInputs()).toEqual(result);
  });

  it.each([
    ['RSS', rss(['<item><title>Notícia sem link</title><description>Sem URL.</description></item>'])],
    ['Atom', atomFeed(['<entry><title>Notícia sem link</title><summary>Sem URL.</summary></entry>'])],
  ])('does not treat a nonempty %s feed with zero usable candidates as quiet evidence', async (_format, xml) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(xml, { status: 200 });
      if (String(input) === BETA_FEED) return new Response('offline', { status: 503 });
      return defaultHandler(input);
    });

    await expect(collect(fetchMock)).rejects.toThrow(/collection unavailable.*every enabled feed/i);
    expect(existsSync(join(root, '.cache/diario', DATE, 'inputs.json'))).toBe(false);
  });

  it('throws before persisting when every enabled feed is nonempty but has zero usable candidates', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED || url === BETA_FEED) {
        return new Response(rss(['<item><title>Notícia sem link</title></item>']), { status: 200 });
      }
      return defaultHandler(input);
    });

    await expect(collect(fetchMock)).rejects.toThrow(/collection unavailable.*every enabled feed/i);
    expect(existsSync(join(root, '.cache/diario', DATE, 'inputs.json'))).toBe(false);
  });

  it('keeps partial usable success when another enabled feed has zero usable candidates', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) {
        return new Response(rss([
          '<item><title>Notícia sem link</title></item>',
          rssItem(),
        ]), { status: 200 });
      }
      if (url === BETA_FEED) return new Response(rss(['<item><title>Outra notícia sem link</title></item>']), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha']);
    expect(cacheInputs()).toEqual(result);
  });

  it('keeps zero enabled feeds as an explicit configuration state without throwing', async () => {
    setSources([source('alpha', ALPHA_FEED, false), source('beta', BETA_FEED, false)]);
    const fetchMock = mockFetch();

    const result = await collect(fetchMock);

    expect(result.sources).toEqual([]);
    expect(requestedUrls(fetchMock).some((url) => url.includes('feeds.example.test'))).toBe(false);
    expect(cacheInputs()).toEqual(result);
  });

  it.each([
    ['http scheme', 'http://feeds.example.test/evil'],
    ['deceptive host', 'https://feeds.example.test.evil.test/rss'],
    ['credentials', 'https://user:secret@feeds.example.test/rss'],
    ['wrong port', 'https://feeds.example.test:444/rss'],
    ['oversized resolved target', `/${'x'.repeat(2030)}`],
  ])('never requests forbidden redirect target: %s', async (_label, location) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['redirect'], { status: 302, headers: { Location: location } }, false);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) return tracked.response;
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(fetchMock).filter((url) => url.includes('feeds.example.test'))).toEqual([ALPHA_FEED, BETA_FEED]);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
  });

  it('malformed and loop redirects skip only that source and cancel unread bodies', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const malformedResponse = trackedResponse(['redirect'], { status: 302, headers: { Location: 'http://[' } }, false);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) return malformedResponse.response;
      if (url === `${ALPHA_FEED}/loop`) return new Response(null, { status: 302, headers: { Location: `${ALPHA_FEED}/loop` } });
      return defaultHandler(input);
    });

    const malformed = await collect(fetchMock);
    expect(malformed.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(malformedResponse.cancel).toHaveBeenCalledTimes(1);

    setSources([source('alpha', `${ALPHA_FEED}/loop`), source('beta', BETA_FEED)]);
    const loopResponse = trackedResponse(['redirect'], { status: 302, headers: { Location: `${ALPHA_FEED}/loop` } }, false);
    const loopMock = mockFetch((input) => {
      const url = String(input);
      if (url === `${ALPHA_FEED}/loop`) return loopResponse.response;
      return defaultHandler(input);
    });
    const loop = await collect(loopMock);
    expect(loop.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(loopMock).filter((url) => url.includes('/loop'))).toEqual([`${ALPHA_FEED}/loop`]);
    expect(loopResponse.cancel).toHaveBeenCalledTimes(1);
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

  it('the fourth hop fails closed for only that source and cancels every redirect body', async () => {
    const feed = 'https://feeds.example.test/hop/0';
    setSources([source('alpha', feed), source('beta', BETA_FEED)]);
    const redirects: Array<ReturnType<typeof trackedResponse>> = [];
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url.includes('/hop/')) {
        const hop = Number(/\/hop\/(\d+)/.exec(url)?.[1]);
        const tracked = trackedResponse(['redirect'], { status: 302, headers: { Location: `/hop/${hop + 1}` } }, false);
        redirects.push(tracked);
        return tracked.response;
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
    for (const { cancel } of redirects) expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([401, 402, 403])('HTTP %i interrupts only that source and cancels its unread body', async (status) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['paywalled'], { status }, false);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return tracked.response;
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
  });

  it.each([401, 402, 403])('HTTP %i skips the publisher’s remaining feed without stopping other publishers', async (status) => {
    const secondAlphaFeed = 'https://feeds.example.test/alpha/second/rss';
    const alpha = source('alpha', ALPHA_FEED);
    alpha.feeds.push({ url: secondAlphaFeed, topics: ['juros'] });
    setSources([alpha, source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['paywalled'], { status }, false);
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url === ALPHA_FEED) return tracked.response;
      if (url === secondAlphaFeed) {
        return new Response(rss([rssItem({ title: 'Segundo feed da Alpha', link: 'https://news.example.test/alpha-second' })]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(requestedUrls(fetchMock).filter((url) => url.includes('feeds.example.test'))).toEqual([ALPHA_FEED, BETA_FEED]);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
  });

  it('a paywalled HTML response skips only that source and cancels its unread body', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['<html><body>Assine para ler</body></html>'], {
      headers: { 'content-type': 'text/html' },
    }, false);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return tracked.response;
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
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

  it.each([
    ['DOCTYPE', '<!DOCTYPE rss>'],
    ['ENTITY', '<!DOCTYPE rss [<!ENTITY x "safe">]>'],
  ])('rejects %s declarations even when no entity is referenced', async (_label, declaration) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const hostile = rss([rssItem()]).replace('?>', `?>${declaration}`);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('rejects a DOCTYPE hidden after a comment opener inside a quoted attribute', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const hostile = `<rss x="<!--"><!DOCTYPE rss [<!ENTITY x "safe">]><!-- --><channel>${rssItem()}</channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(cacheInputs()).toEqual(result);
  });

  it.each([
    ['literal less-than in a double-quoted attribute', `<rss note="a<b"><channel>${rssItem()}</channel></rss>`],
    ['literal less-than in a single-quoted attribute', `<rss note='a<b'><channel>${rssItem()}</channel></rss>`],
    ['unclosed tag', `<rss><channel>${rssItem()}`],
    ['unclosed attribute quote', `<rss note="unterminated><channel>${rssItem()}</channel></rss>`],
  ])('rejects %s without suppressing a healthy sibling', async (_label, hostile) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('rejects an undefined entity reference inside an attribute', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const hostile = `<rss note="&foo;"><channel>${rssItem()}</channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it.each([
    ['title', '<title>Juros &foo; e inflação</title>', ARTICLE],
    ['link', '<title>Juros e inflação</title>', `${ARTICLE}?a=1&foo;=2`],
  ])('rejects undefined XML entity references in %s', async (_field, metadata, link) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(`<rss><channel><title>Feed</title><link>https://feeds.example.test/</link><description>Feed</description><item>${metadata}<link>${link}</link></item></channel></rss>`, { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(JSON.stringify(cacheInputs())).not.toContain('&foo;');
  });

  it.each([
    ['&#0;', 'zero'],
    ['&#1;', 'XML-forbidden control'],
    ['&#xD800;', 'high surrogate'],
    ['&#xDFFF;', 'low surrogate'],
    ['&#xFFFE;', 'BMP noncharacter'],
    ['&#xFFFF;', 'BMP noncharacter boundary'],
    ['&#x110000;', 'above Unicode range'],
    ['&#999999999999999999999;', 'unsafe integer'],
  ])('rejects invalid numeric XML reference %s (%s) outside candidate metadata', async (reference) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(`<rss><channel><title>Feed ${reference}</title><link>https://feeds.example.test/</link><description>Feed</description>${rssItem()}</channel></rss>`, { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it.each([
    ['&#9;', 'tab'],
    ['&#10;', 'line feed'],
    ['&#13;', 'carriage return'],
    ['&#x20;', 'first printable character'],
    ['&#xD7FF;', 'last before surrogate range'],
    ['&#xE000;', 'first after surrogate range'],
    ['&#xFFFD;', 'last BMP XML character'],
    ['&#x10000;', 'first supplementary character'],
    ['&#x10FFFF;', 'last Unicode code point'],
  ])('accepts valid numeric XML reference %s (%s)', async (reference) => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(`<rss><channel><title>Feed ${reference}</title><link>https://feeds.example.test/</link><description>Feed</description>${rssItem()}</channel></rss>`, { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha']);
  });

  it('keeps undefined references literal in CDATA and ignores references in comments', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const literal = 'Literal &foo; &bar;';
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(`<?xml version="1.0"?><rss><channel><!-- &foo; &#0; &#xD800; &#x110000; COMMENT_SENTINEL --><title>Feed</title><link>https://feeds.example.test/</link><description>Feed</description><item><title>Juros &amp; inflação</title><link>${ARTICLE}</link><description><![CDATA[${literal}]]></description><content><![CDATA[&#0; &#xD800; &#x110000; CDATA_SENTINEL]]></content></item></channel></rss>`, { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);
    const cached = readFileSync(join(root, '.cache/diario', DATE, 'inputs.json'), 'utf8');

    expect(result.sources[0]).toMatchObject({ title: 'Juros & inflação', excerpt: literal });
    expect(cached).not.toContain('COMMENT_SENTINEL');
    expect(cached).not.toContain('CDATA_SENTINEL');
  });

  it('preserves literal entity-like text in CDATA titles and excerpts', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const title = 'Juros &amp; inflação &#38; câmbio &#0;';
    const excerpt = 'Resumo &amp; &#38; &#0; sem decodificação.';
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          `<item><title xml:lang="pt-BR"><![CDATA[${title}]]></title><link>${ARTICLE}</link><description><![CDATA[${excerpt}]]></description></item>`,
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({ title, excerpt });
    expect(cacheInputs().sources[0]).toMatchObject({ title, excerpt });
  });

  it('preserves adjacent CDATA sections as literal title and excerpt text', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          '<item><title><![CDATA[Juros &amp;]]><![CDATA[ inflação &#0;]]></title><link>https://news.example.test/adjacent-cdata</link><description><![CDATA[Resumo &#38;]]><![CDATA[ &#0; literal]]></description></item>',
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({
      title: 'Juros &amp; inflação &#0;',
      excerpt: 'Resumo &#38; &#0; literal',
    });
  });

  it('preserves interleaved CDATA and text in source order with one-pass decoding', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          '<item><title>Juros <![CDATA[&amp;amp;]]> inflação</title><link>https://news.example.test/interleaved-cdata</link><description>Resumo <![CDATA[&amp;amp;]]> e <![CDATA[&#38;]]> inflação</description></item>',
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({
      title: 'Juros &amp;amp; inflação',
      excerpt: 'Resumo &amp;amp; e &#38; inflação',
    });
    expect(cacheInputs().sources[0]).toMatchObject({
      title: 'Juros &amp;amp; inflação',
      excerpt: 'Resumo &amp;amp; e &#38; inflação',
    });
  });

  it('escapes literal ampersands and less-than signs from CDATA before parsing', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          '<item><title>Comparação</title><link>https://news.example.test/literal-cdata</link><description><![CDATA[Resumo 1 < 2 &amp; &]]></description></item>',
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.excerpt).toBe('Resumo 1 < 2 &amp; &');
  });

  it('accepts processing instructions containing literal ampersands', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const xml = rss([rssItem()]).replace(
      '?>',
      '?><?xml-stylesheet type="text/xsl" href="style.xsl?a=1&b=2"?>',
    );
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(xml, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha']);
  });

  it.each([
    ['an ampersand in the PI target', '<?foo&bar?>', 'start'],
    ['a literal ampersand in the XML declaration', '<?xml version="1.0" &?>', 'start'],
    ['an XML declaration without a version', '<?xml encoding="UTF-8"?>', 'start'],
    ['an unsupported XML version', '<?xml version="1.1"?>', 'start'],
    ['a differently-cased reserved XML target', '<?XML version="1.0"?>', 'start'],
    ['an invalid standalone declaration', '<?xml version="1.0" standalone="maybe"?>', 'start'],
    ['an XML declaration after the document start', '<?xml version="1.0"?>', 'nested'],
  ])('rejects %s without suppressing a healthy sibling', async (_label, instruction, position) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const feed = rss([rssItem()]).replace('<?xml version="1.0" encoding="UTF-8"?>', '');
    const hostile = position === 'nested'
      ? feed.replace('<channel>', `<channel>${instruction}`)
      : `${instruction}${feed}`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(hostile, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it.each([
    ['minimal', '', '<?xml version="1.0"?>'],
    ['complete with XML whitespace', '', "<?xml version = '1.0' encoding = 'UTF-8' standalone = 'no'?>"],
    ['after a UTF-8 BOM', '\uFEFF', '<?xml version="1.0"?>'],
  ])('accepts the %s XML declaration at the document start', async (_label, prefix, declaration) => {
    setSources([source('alpha', ALPHA_FEED)]);
    const feed = rss([rssItem()]).replace('<?xml version="1.0" encoding="UTF-8"?>', declaration);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(`${prefix}${feed}`, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['alpha']);
  });

  it('ignores declaration-like text in comments, CDATA and processing instructions', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const title = 'Juros <!DOCTYPE e <!ENTITY';
    const xml = rss([
      `<item><title><![CDATA[${title}]]></title><link>${ARTICLE}</link></item>`,
    ]).replace(
      '?>',
      '?><?xml-stylesheet href="style.xsl?decl=<!DOCTYPE&entity=<!ENTITY"?><!-- <!DOCTYPE rss> <!ENTITY xxe SYSTEM "file:///etc/passwd"> -->',
    );
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(xml, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({ sourceId: 'alpha', title });
  });

  it('decodes predefined and numeric XML references once in safe metadata', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const entityFeed = `<?xml version="1.0"?><rss><channel><item><title>  Juros &#38; infla&#231;&#227;o &amp; c&#xE2;mbio  </title><link>${ARTICLE}?a=1&amp;b=2</link><description>Resumo &amp; contexto.</description><pubDate>Mon, 23 Nov 2026 18:00:00 +0000</pubDate></item><item><title>Juros &amp;lt; inflação &amp;amp; câmbio</title><link>https://news.example.test/single-pass</link></item></channel></rss>`;
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(entityFeed, { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]).toMatchObject({
      title: 'Juros & inflação & câmbio',
      canonicalUrl: `${ARTICLE}?a=1&b=2`,
      excerpt: 'Resumo & contexto.',
    });
    expect(result.sources[1]?.title).toBe('Juros &lt; inflação &amp; câmbio');
  });

  it('normalizes safe XML whitespace in stored plain-text titles', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([rssItem({ title: 'Juros\t e\ninflação' })]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.title).toBe('Juros e inflação');
  });

  it('deduplicates titles after single-pass XML reference decoding', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(
          rss([
            '<item><title>Juros &amp; inflação</title><link>https://news.example.test/one</link></item>',
            '<item><title>Juros &#38; inflação</title><link>https://news.example.test/two</link></item>',
          ]),
          { status: 200 },
        );
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.canonicalUrl)).toEqual(['https://news.example.test/one']);
  });

  it('rejects nested RSS title elements instead of concatenating or dropping child text', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          `<item><title>Juros <b>e</b> inflação</title><link>${ARTICLE}</link></item>`,
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('rejects Atom XHTML titles instead of extracting or sanitizing nested text', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(atomFeed([
          `<entry><title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Juros <b>e</b> inflação</div></title><link href="${ARTICLE}" rel="alternate"/></entry>`,
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('accepts a title record containing only attributes and text', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(rss([
          `<item><title xml:lang="pt-BR">Juros e inflação</title><link>${ARTICLE}</link></item>`,
        ]), { status: 200 });
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.title).toBe('Juros e inflação');
  });

  it.each([
    ['CDATA markup', '<![CDATA[<b>Juros</b> e inflação]]>'],
    ['predefined markup', '&lt;b&gt;Juros&lt;/b&gt; e inflação'],
    ['numeric markup', '&#60;script&#62;Juros&#60;/script&#62;'],
  ])('rejects title markup instead of persisting it: %s', async (_label, titleXml) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(
          `<?xml version="1.0"?><rss><channel><item><title>${titleXml}</title><link>${ARTICLE}</link></item></channel></rss>`,
          { status: 200 },
        );
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it.each(['Juros\u200B e inflação', 'Juros\u202E e inflação'])('rejects unsafe Unicode format controls in titles: %j', async (title) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem({ title })]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
  });

  it('revalidates decoded article URLs before canonicalization', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) {
        return new Response(
          rss([
            '<item><title>Consulta decodificada</title><link>https://news.example.test/story&#x3F;a=1&amp;b=2</link></item>',
            '<item><title>Controle decodificado</title><link>https://news.example.test/story&#x09;?a=1</link></item>',
            '<item><title>Credencial decodificada</title><link>https://user&#58;secret@news.example.test/story</link></item>',
          ]),
          { status: 200 },
        );
      }
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.canonicalUrl)).toEqual(['https://news.example.test/story?a=1&b=2']);
  });

  it('reads RSS from streamed chunks across a UTF-8 character boundary', async () => {
    setSources([source('alpha', ALPHA_FEED)]);
    const bytes = new TextEncoder().encode(rss([rssItem()]));
    const accent = bytes.indexOf(0xc3) + 1;
    const split = accent > 0 ? accent : Math.floor(bytes.length / 2);
    const { response } = trackedResponse([bytes.slice(0, split), bytes.slice(split)]);
    const fetchMock = mockFetch((input) => String(input) === ALPHA_FEED ? response : defaultHandler(input));

    const result = await collect(fetchMock);

    expect(result.sources[0]?.title).toBe('Juros e inflação');
  });

  it('cancels an unread RSS body when the declared size exceeds the cap', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['<rss/>'], { headers: { 'content-length': '1000001' } }, false);
    const fetchMock = mockFetch((input) => String(input) === ALPHA_FEED ? tracked.response : defaultHandler(input));

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
  });

  it('caps response bytes and skips only the oversized source', async () => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const tracked = trackedResponse(['x'.repeat(600_000), 'x'.repeat(600_000)], {}, false);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return tracked.response;
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
    expect(tracked.cancel).toHaveBeenCalledTimes(1);
  });

  it('times out a stalled source without stopping healthy sources', async () => {
    vi.useFakeTimers();
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    let signal: AbortSignal | undefined;
    const fetchMock = mockFetch((input, init) => {
      if (String(input) === ALPHA_FEED) {
        signal = init?.signal ?? undefined;
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
    expect(signal?.aborted).toBe(true);
  });

  it.each([
    ['non-HTTPS article URL', { link: 'http://news.example.test/story' }],
    ['credentialled article URL', { link: 'https://user:secret@news.example.test/story' }],
    ['unsafe title length', { title: 'x'.repeat(501) }],
    ['control character in title', { title: 'Juros\u009F e inflação' }],
    ['unsafe URL length', { link: `https://news.example.test/${'x'.repeat(2_100)}` }],
  ])('rejects unsafe metadata: %s', async (_label, options) => {
    setSources([source('alpha', ALPHA_FEED), source('beta', BETA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem(options)]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources.map((item) => item.sourceId)).toEqual(['beta']);
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

  it.each([
    ['2026-11-23T18:00:00Z', '2026-11-23T18:00:00.000Z'],
    ['2026-11-23T18:00:00.123456789-03:00', '2026-11-23T21:00:00.123Z'],
    ['Mon, 23 Nov 2026 18:00:00 GMT', '2026-11-23T18:00:00.000Z'],
    ['Mon, 23 Nov 2026 18:00:00 UTC', '2026-11-23T18:00:00.000Z'],
    ['Mon, 23 Nov 2026 18:00:00 -0330', '2026-11-23T21:30:00.000Z'],
    ['23 Nov 2026 18:00:00 +0000', '2026-11-23T18:00:00.000Z'],
  ])('normalizes supported timestamp with an explicit zone: %s', async (published, expected) => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem({ published })]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.publishedAt).toBe(expected);
  });

  it.each([
    ['impossible ISO date', '2026-02-30T18:00:00Z'],
    ['impossible RFC 822 date', 'Mon, 31 Feb 2026 18:00:00 +0000'],
    ['timezone-less ISO timestamp', '2026-11-23T18:00:00'],
    ['timezone-less RFC 822 timestamp', 'Mon, 23 Nov 2026 18:00:00'],
    ['unsupported named zone', 'Mon, 23 Nov 2026 18:00:00 EST'],
    ['impossible ISO time', '2026-11-23T24:00:00Z'],
    ['impossible ISO offset', '2026-11-23T18:00:00+25:00'],
    ['impossible RFC 822 offset', 'Mon, 23 Nov 2026 18:00:00 +2460'],
    ['mismatched RFC 822 weekday', 'Tue, 23 Nov 2026 18:00:00 +0000'],
  ])('rejects %s instead of relying on Date.parse', async (_label, published) => {
    setSources([source('alpha', ALPHA_FEED)]);
    const fetchMock = mockFetch((input) => {
      if (String(input) === ALPHA_FEED) return new Response(rss([rssItem({ published })]), { status: 200 });
      return defaultHandler(input);
    });

    const result = await collect(fetchMock);

    expect(result.sources[0]?.publishedAt).toBeNull();
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
