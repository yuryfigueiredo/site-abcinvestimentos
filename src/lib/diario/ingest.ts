import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchBcbLastValue, fetchBcbRecentValues } from '../bcb';
import { cancelResponseBody, readBoundedText } from '../http';
import { verifyGovernance } from './governance';
import { isCalendarDate, parseCalendarDate } from './time';
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
const UNSAFE_CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const FORMAT_CONTROL = /\p{Cf}/u;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F-\u009F]/u;
const INVALID_URL_CHARACTER = /[<>"\\]/u;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const TRACKING_PARAMETERS = /^(?:utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|referrer)$/iu;
const XML_ENTITIES = /<!\s*(?:DOCTYPE|ENTITY)\b/iu;
const XML_CHARACTER_REFERENCE = /&(?:amp|lt|gt|apos|quot|#(?:\d+|x[\da-fA-F]+));/gu;
const XML_REFERENCE_AT_POSITION = /&(?:amp|lt|gt|apos|quot|#(?:\d+|x[\da-fA-F]+));/yu;
const XML_PREDEFINED_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&quot;': '"',
};
const XML_MARKUP = /<(?:\/?[a-z][^>]*|![^>]*|\?[^>]*)>/iu;
const XML_TYPES = new Set(['application/xml', 'text/xml', 'text/plain', 'application/rss+xml', 'application/atom+xml']);
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u;
const RFC822_TIMESTAMP = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(GMT|UTC|[+-]\d{4})$/iu;
const RFC822_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const RFC822_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isValidXmlCodePoint(codePoint: number): boolean {
  return Number.isSafeInteger(codePoint) && (
    codePoint === 9 ||
    codePoint === 10 ||
    codePoint === 13 ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function decodeXmlReference(reference: string): string | null {
  if (!reference.startsWith('&#')) return XML_PREDEFINED_ENTITIES[reference] ?? null;
  const hexadecimal = reference[2] === 'x';
  const codePoint = Number.parseInt(reference.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
  return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : null;
}

function validateXmlReferences(xml: string): boolean {
  for (let index = 0; index < xml.length; index += 1) {
    if (xml.startsWith('<!--', index)) {
      const end = xml.indexOf('-->', index + 4);
      if (end === -1) return false;
      index = end + 2;
      continue;
    }
    if (xml.startsWith('<![CDATA[', index)) {
      const end = xml.indexOf(']]>', index + 9);
      if (end === -1) return false;
      index = end + 2;
      continue;
    }
    if (xml[index] !== '&') continue;
    XML_REFERENCE_AT_POSITION.lastIndex = index;
    const match = XML_REFERENCE_AT_POSITION.exec(xml);
    if (!match || decodeXmlReference(match[0]) === null) return false;
    index += match[0].length - 1;
  }
  return true;
}

function decodeXmlReferences(value: string, maxLength: number): string | null {
  if (value.length > maxLength) return null;
  let valid = true;
  const decoded = value.replace(XML_CHARACTER_REFERENCE, (reference) => {
    const decodedReference = decodeXmlReference(reference);
    if (decodedReference === null) {
      valid = false;
      return '\uFFFD';
    }
    return decodedReference;
  });
  return valid && decoded.length <= maxLength ? decoded : null;
}

function normalizedMetadata(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength || UNSAFE_CONTROL_CHARACTER.test(value)) return null;
  const decoded = decodeXmlReferences(value, maxLength);
  if (decoded === null) return null;
  const normalized = decoded.normalize('NFKC');
  if (UNSAFE_CONTROL_CHARACTER.test(normalized) || FORMAT_CONTROL.test(normalized) || XML_MARKUP.test(normalized)) return null;
  const plainText = normalized.replace(/\s+/gu, ' ').trim();
  return plainText.length > 0 && plainText.length <= maxLength ? plainText : null;
}

function metadataValue(value: unknown, maxLength: number): string | null {
  if (typeof value === 'string') return normalizedMetadata(value, maxLength);
  const record = asRecord(value);
  return record ? normalizedMetadata(record['#text'], maxLength) : null;
}

function titleValue(value: unknown, maxLength: number): string | null {
  if (typeof value === 'string') return normalizedMetadata(value, maxLength);
  const record = asRecord(value);
  if (!record || Object.keys(record).some((key) => key !== '#text' && !key.startsWith('@'))) return null;
  return normalizedMetadata(record['#text'], maxLength);
}

function canonicalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null;
  const decoded = decodeXmlReferences(value, MAX_URL_LENGTH);
  if (decoded === null || CONTROL_CHARACTER.test(decoded) || INVALID_URL_CHARACTER.test(decoded)) return null;
  try {
    const url = new URL(decoded);
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
  if (typeof value !== 'string' || UNSAFE_CONTROL_CHARACTER.test(value)) return '';
  const decoded = decodeXmlReferences(value, MAX_FEED_BYTES);
  if (decoded === null) return '';
  const normalized = decoded.normalize('NFKC');
  if (UNSAFE_CONTROL_CHARACTER.test(normalized) || FORMAT_CONTROL.test(normalized)) return '';
  return normalized
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_EXCERPT_LENGTH)
    .trim();
}

function zonedTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  zone: string,
  weekday?: string,
): string | null {
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!isCalendarDate(date) || hour > 23 || minute > 59 || second > 59) return null;

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millisecond);
  if (weekday && RFC822_WEEKDAYS[local.getUTCDay()] !== weekday.toUpperCase()) return null;

  let offsetMinutes = 0;
  if (zone !== 'Z' && zone.toUpperCase() !== 'GMT' && zone.toUpperCase() !== 'UTC') {
    const compact = zone.replace(':', '');
    const offsetHour = Number(compact.slice(1, 3));
    const offsetMinute = Number(compact.slice(3, 5));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (compact[0] === '-' ? -1 : 1);
  }
  return new Date(local.getTime() - offsetMinutes * 60_000).toISOString();
}

function normalizedTimestamp(value: unknown): string | null {
  const text = metadataValue(value, 128);
  if (!text) return null;

  const iso = ISO_TIMESTAMP.exec(text);
  if (iso) {
    const millisecond = Number((iso[7] ?? '').slice(0, 3).padEnd(3, '0'));
    return zonedTimestamp(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4]), Number(iso[5]), Number(iso[6]), millisecond, iso[8]);
  }

  const rfc822 = RFC822_TIMESTAMP.exec(text);
  if (!rfc822) return null;
  const month = RFC822_MONTHS.indexOf(rfc822[3].toUpperCase()) + 1;
  if (month === 0) return null;
  return zonedTimestamp(
    Number(rfc822[4]),
    month,
    Number(rfc822[2]),
    Number(rfc822[5]),
    Number(rfc822[6]),
    Number(rfc822[7]),
    0,
    rfc822[8],
    rfc822[1],
  );
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

type FeedFetchOutcome =
  | { kind: 'xml'; xml: string }
  | { kind: 'blocked' }
  | { kind: 'unavailable' };

type ParsedFeed = {
  entryCount: number;
  candidates: SourceCandidate[];
};

async function fetchFeedXml(initialValue: string, fetchImpl: typeof fetch): Promise<FeedFetchOutcome> {
  let url = feedUrl(initialValue);
  if (!url) return { kind: 'unavailable' };
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
      try {
        if (REDIRECT_STATUSES.has(response.status)) {
          if (hops >= MAX_REDIRECTS) return { kind: 'unavailable' };
          const location = response.headers.get('location');
          if (!location || location.length > MAX_URL_LENGTH || CONTROL_OR_SPACE.test(location) || INVALID_URL_CHARACTER.test(location)) {
            return { kind: 'unavailable' };
          }
          let target: URL;
          try {
            target = new URL(location, url);
          } catch {
            return { kind: 'unavailable' };
          }
          if (!isAllowedFeedUrl(target, allowedHost, allowedPort)) return { kind: 'unavailable' };
          target.hash = '';
          if (visited.has(target.href)) return { kind: 'unavailable' };
          visited.add(target.href);
          url = target;
          continue;
        }
        if (response.status === 401 || response.status === 402 || response.status === 403) return { kind: 'blocked' };
        if (!response.ok) return { kind: 'unavailable' };
        const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
        if (contentType && !XML_TYPES.has(contentType) && !contentType.endsWith('+xml')) return { kind: 'unavailable' };
        return { kind: 'xml', xml: await readBoundedText(response, MAX_FEED_BYTES, 'Feed') };
      } finally {
        await cancelResponseBody(response);
      }
    }
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

function alternateLink(item: Record<string, unknown>): string | null {
  if (typeof item.link === 'string') return item.link;
  for (const value of asArray(item.link)) {
    const link = asRecord(value);
    if (!link || typeof link['@href'] !== 'string') continue;
    if (link['@rel'] === undefined || link['@rel'] === 'alternate') return link['@href'];
  }
  return null;
}

function parseFeed(xml: string, source: AllowlistSource, retrievedAt: string): ParsedFeed | null {
  if (!xml || XML_ENTITIES.test(xml) || !validateXmlReferences(xml) || XMLValidator.validate(xml) !== true) return null;
  const parsed = new XMLParser({
    processEntities: false,
    parseTagValue: false,
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    removeNSPrefix: true,
  }).parse(xml) as unknown;
  const root = asRecord(parsed);
  if (!root) return null;

  let entries: unknown[];
  if (root.rss !== undefined) {
    const channelValue = asRecord(root.rss)?.channel;
    const channel = typeof channelValue === 'string' && channelValue.trim() === '' ? {} : asRecord(channelValue);
    if (!channel) return null;
    entries = asArray(channel.item);
  } else if (root.feed !== undefined) {
    const feed = typeof root.feed === 'string' && root.feed.trim() === '' ? {} : asRecord(root.feed);
    if (!feed) return null;
    entries = asArray(feed.entry);
  } else {
    return null;
  }

  const candidates: SourceCandidate[] = [];
  for (const entry of entries.slice(0, 100)) {
    const item = asRecord(entry);
    if (!item) continue;
    const title = titleValue(item.title, MAX_TITLE_LENGTH);
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
  return { entryCount: entries.length, candidates };
}

async function collectSource(
  source: AllowlistSource,
  retrievedAt: string,
  fetchImpl: typeof fetch,
): Promise<{ candidates: SourceCandidate[]; successfulFeeds: number }> {
  const candidates: SourceCandidate[] = [];
  let successfulFeeds = 0;
  for (const feed of source.feeds) {
    try {
      const outcome = await fetchFeedXml(feed.url, fetchImpl);
      if (outcome.kind === 'blocked') break;
      if (outcome.kind === 'unavailable') continue;
      const parsed = parseFeed(outcome.xml, source, retrievedAt);
      if (parsed === null || (parsed.entryCount > 0 && parsed.candidates.length === 0)) continue;
      successfulFeeds += 1;
      candidates.push(...parsed.candidates);
    } catch {
      // Limites do parser XML também encerram somente este feed.
    }
  }
  return { candidates, successfulFeeds };
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

  const vault = verifyGovernance(root);
  const { allowlist, calendar: events, lessons } = vault;

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
  let enabledFeeds = 0;
  let successfulFeeds = 0;
  for (const source of allowlist) {
    if (!source.enabled) continue;
    enabledFeeds += source.feeds.length;
    const publisherTitles = seenTitles.get(source.id) ?? new Set<string>();
    seenTitles.set(source.id, publisherTitles);
    const collected = await collectSource(source, retrievedAt, fetchImpl);
    successfulFeeds += collected.successfulFeeds;
    for (const candidate of collected.candidates) {
      const titleKey = normalizedTitleKey(candidate.title);
      if (seenUrls.has(candidate.canonicalUrl) || publisherTitles.has(titleKey)) continue;
      seenUrls.add(candidate.canonicalUrl);
      publisherTitles.add(titleKey);
      sources.push(candidate);
    }
  }
  if (enabledFeeds > 0 && successfulFeeds === 0) {
    throw new Error(`RSS collection unavailable: every enabled feed failed to fetch or parse (${enabledFeeds} feeds)`);
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
