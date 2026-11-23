import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchBcbLastValue, fetchBcbRecentValues } from '../bcb';
import { verifyGovernance } from './governance';
import { parseAllowlist, parseCalendar, parseLessons } from './schema';
import { parseCalendarDate } from './time';
import type {
  AllowlistSource,
  BcbObservation,
  CollectedInputs,
  CollectOptions,
  MeasuredKey,
  SourceCandidate,
} from './types';

const MAX_REDIRECTS = 3;
const MAX_FEED_BYTES = 1_000_000;
const FEED_TIMEOUT_MS = 5000;
const MAX_TITLE_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_EXCERPT_LENGTH = 600;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F-\u009F]/u;
const INVALID_URL_CHARACTER = /[<>"\\]/u;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const TRACKING_PARAMETERS = /^(?:utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|referrer)$/iu;
const XML_ENTITIES = /<!\s*(?:DOCTYPE|ENTITY)\b/iu;
const XML_TYPES = new Set(['application/xml', 'text/xml', 'text/plain', 'application/rss+xml', 'application/atom+xml']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizedMetadata(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength || CONTROL_CHARACTER.test(value)) return null;
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function metadataValue(value: unknown, maxLength: number): string | null {
  if (typeof value === 'string') return normalizedMetadata(value, maxLength);
  const record = asRecord(value);
  return record ? normalizedMetadata(record['#text'], maxLength) : null;
}

function canonicalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null;
  if (CONTROL_CHARACTER.test(value) || INVALID_URL_CHARACTER.test(value)) return null;
  // RSS serializa separadores de query como &amp;; o parser XML continua sem
  // expandir entidades, então somente essa forma segura é normalizada na URL.
  const decodedSeparator = value.replaceAll('&amp;', '&');
  try {
    const url = new URL(decodedSeparator);
    if (url.protocol !== 'https:' || url.username || url.password || !HOSTNAME.test(url.hostname)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMETERS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const result = url.toString();
    return result.length <= MAX_URL_LENGTH ? result : null;
  } catch {
    return null;
  }
}

function normalizedTitleKey(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('pt-BR')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizedExcerpt(value: unknown): string {
  if (typeof value !== 'string' || CONTROL_CHARACTER.test(value)) return '';
  return value
    .normalize('NFKC')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_EXCERPT_LENGTH)
    .trim();
}

function normalizedTimestamp(value: unknown): string | null {
  const text = metadataValue(value, 128);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function feedUrl(value: string): URL | null {
  if (value.length > MAX_URL_LENGTH || CONTROL_OR_SPACE.test(value) || INVALID_URL_CHARACTER.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && HOSTNAME.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function isAllowedFeedUrl(value: URL, allowedHost: string, allowedPort: string): boolean {
  return (
    value.href.length <= MAX_URL_LENGTH &&
    value.protocol === 'https:' &&
    value.hostname === allowedHost &&
    (value.port || '443') === allowedPort &&
    !value.username &&
    !value.password
  );
}

async function readBoundedFeed(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
    throw new Error('Feed exceeds the maximum response size');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error('Feed exceeds the maximum response size');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }
  return chunks.join('');
}

async function fetchFeedXml(initialValue: string, fetchImpl: typeof fetch): Promise<string | null> {
  let url = feedUrl(initialValue);
  if (!url) return null;
  const allowedHost = url.hostname;
  const allowedPort = url.port || '443';
  url.hash = '';
  const visited = new Set([url.href]);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    for (let hops = 0; ; hops += 1) {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
        redirect: 'manual',
      });
      if (REDIRECT_STATUSES.has(response.status)) {
        if (hops >= MAX_REDIRECTS) return null;
        const location = response.headers.get('location');
        if (!location || location.length > MAX_URL_LENGTH || CONTROL_OR_SPACE.test(location) || INVALID_URL_CHARACTER.test(location)) {
          return null;
        }
        let target: URL;
        try {
          target = new URL(location, url);
        } catch {
          return null;
        }
        if (!isAllowedFeedUrl(target, allowedHost, allowedPort)) return null;
        target.hash = '';
        if (visited.has(target.href)) return null;
        visited.add(target.href);
        url = target;
        continue;
      }
      if (!response.ok || response.status === 401 || response.status === 402 || response.status === 403) return null;
      const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
      if (contentType && !XML_TYPES.has(contentType) && !contentType.endsWith('+xml')) return null;
      return await readBoundedFeed(response);
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function alternateLink(item: Record<string, unknown>): string | null {
  if (typeof item.link === 'string') return item.link;
  for (const value of asArray(item.link)) {
    const link = asRecord(value);
    if (!link || typeof link.href !== 'string') continue;
    if (link.rel === undefined || link.rel === 'alternate') return link.href;
  }
  return null;
}

function parseFeed(xml: string, source: AllowlistSource, retrievedAt: string): SourceCandidate[] {
  if (!xml || XML_ENTITIES.test(xml) || XMLValidator.validate(xml) !== true) return [];
  const parsed = new XMLParser({
    processEntities: false,
    parseTagValue: false,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  }).parse(xml) as unknown;
  const root = asRecord(parsed);
  if (!root) return [];

  let entries: unknown[];
  if (root.rss !== undefined) {
    const channel = asRecord(asRecord(root.rss)?.channel);
    entries = channel ? asArray(channel.item) : [];
  } else if (root.feed !== undefined) {
    entries = asArray(asRecord(root.feed)?.entry);
  } else {
    return [];
  }

  const candidates: SourceCandidate[] = [];
  for (const entry of entries.slice(0, 100)) {
    const item = asRecord(entry);
    if (!item) continue;
    const title = metadataValue(item.title, MAX_TITLE_LENGTH);
    const url = canonicalUrl(alternateLink(item));
    if (!title || !url) continue;
    const excerpt = normalizedExcerpt(item.description ?? item.summary);
    const id = `src-${createHash('sha256').update(`${source.id}\0${url}`, 'utf8').digest('hex').slice(0, 24)}`;
    candidates.push({
      id,
      sourceId: source.id,
      kind: source.kind,
      publisher: source.publisher,
      title,
      canonicalUrl: url,
      publishedAt: normalizedTimestamp(item.pubDate ?? item.published ?? item.updated),
      retrievedAt,
      excerpt,
      excerptSha256: createHash('sha256').update(excerpt, 'utf8').digest('hex'),
    });
  }
  return candidates;
}

async function collectSource(
  source: AllowlistSource,
  retrievedAt: string,
  fetchImpl: typeof fetch,
): Promise<SourceCandidate[]> {
  const candidates: SourceCandidate[] = [];
  for (const feed of source.feeds) {
    try {
      const xml = await fetchFeedXml(feed.url, fetchImpl);
      if (xml !== null) candidates.push(...parseFeed(xml, source, retrievedAt));
    } catch {
      // Limites do parser XML também encerram somente este feed.
    }
  }
  return candidates;
}

function readVaultJson(root: string, name: string): unknown {
  return JSON.parse(readFileSync(join(root, 'src', 'data', 'diario', 'curadoria', name), 'utf8')) as unknown;
}

function persistInputs(root: string, inputs: CollectedInputs): void {
  const directory = join(root, '.cache', 'diario', inputs.date);
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, 'inputs.json');
  const temporary = join(directory, `.inputs.${process.pid}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(inputs, null, 2)}\n`, 'utf8');
  renameSync(temporary, destination);
}

export async function collectInputs(date: string, options: CollectOptions = {}): Promise<CollectedInputs> {
  parseCalendarDate(date, 'collection date');
  const now = options.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('now must be a valid Date instant');
  const root = resolve(options.root ?? process.cwd());
  const fetchImpl = options.fetch ?? fetch;
  const retrievedAt = now.toISOString();

  verifyGovernance(root);
  const { allowlist } = parseAllowlist(readVaultJson(root, 'allowlist.json'));
  const events = parseCalendar(readVaultJson(root, 'calendario.json'));
  const lessons = parseLessons(readVaultJson(root, 'licoes.json'));

  const [selic, cdi, ipca12m, dolar] = await Promise.all([
    fetchBcbLastValue(432, fetchImpl),
    fetchBcbLastValue(4389, fetchImpl),
    fetchBcbLastValue(13522, fetchImpl),
    fetchBcbRecentValues(1, 2, fetchImpl),
  ]);
  const bcb: Partial<Record<MeasuredKey, BcbObservation[]>> = {
    selic: selic ? [selic] : [],
    cdi: cdi ? [cdi] : [],
    ipca12m: ipca12m ? [ipca12m] : [],
    dolar,
  };

  const sources: SourceCandidate[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Map<string, Set<string>>();
  for (const source of allowlist) {
    if (!source.enabled) continue;
    const publisherTitles = seenTitles.get(source.id) ?? new Set<string>();
    seenTitles.set(source.id, publisherTitles);
    for (const candidate of await collectSource(source, retrievedAt, fetchImpl)) {
      const titleKey = normalizedTitleKey(candidate.title);
      if (seenUrls.has(candidate.canonicalUrl) || publisherTitles.has(titleKey)) continue;
      seenUrls.add(candidate.canonicalUrl);
      publisherTitles.add(titleKey);
      sources.push(candidate);
    }
  }

  const inputs: CollectedInputs = {
    date,
    retrievedAt,
    bcb,
    sources,
    events,
    lessons,
    previousEditions: [],
  };
  persistInputs(root, inputs);
  return inputs;
}
