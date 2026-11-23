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
const MAX_AUTHOR_LENGTH = 500;
const DC_CREATOR_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const FEED_ACCEPT = 'application/rss+xml, application/atom+xml, application/xml, text/xml';
const FEED_USER_AGENT = 'ABCInvestimentosDiario/1.0 (+https://www.abcinvestimentos.com.br/diario-do-investidor/)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;
const UNSAFE_CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const FORMAT_CONTROL = /\p{Cf}/u;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F-\u009F]/u;
const INVALID_URL_CHARACTER = /[<>"\\]/u;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const TRACKING_PARAMETERS = /^(?:utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|referrer)$/iu;
const XML_NAME = /^[\p{L}\p{Nl}_:][\p{L}\p{N}\p{M}_.:\-\u00B7\u0300-\u036F\u200C\u200D\u203F-\u2040]*$/u;
const XML_DECLARATION = /^[\t\n\r ]+version[\t\n\r ]*=[\t\n\r ]*(?:"1\.0"|'1\.0')(?:[\t\n\r ]+encoding[\t\n\r ]*=[\t\n\r ]*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?(?:[\t\n\r ]+standalone[\t\n\r ]*=[\t\n\r ]*(?:"(?:yes|no)"|'(?:yes|no)'))?[\t\n\r ]*$/u;
const XML_CHARACTER_REFERENCE = /&(?:amp|lt|gt|apos|quot|#(?:\d+|x[\da-fA-F]+));/gu;
const XML_REFERENCE_AT_POSITION = /&(?:amp|lt|gt|apos|quot|#(?:\d+|x[\da-fA-F]+));/yu;
const XML_PREDEFINED_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&quot;': '"',
};
const HTML_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  deg: '°', plusmn: '±', times: '×', divide: '÷',
  aacute: 'á', Aacute: 'Á', acirc: 'â', Acirc: 'Â', atilde: 'ã', Atilde: 'Ã',
  ccedil: 'ç', Ccedil: 'Ç', eacute: 'é', Eacute: 'É', ecirc: 'ê', Ecirc: 'Ê',
  iacute: 'í', Iacute: 'Í', icirc: 'î', Icirc: 'Î', oacute: 'ó', Oacute: 'Ó',
  ocirc: 'ô', Ocirc: 'Ô', otilde: 'õ', Otilde: 'Õ', uacute: 'ú', Uacute: 'Ú',
  ucirc: 'û', Ucirc: 'Û',
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

function xmlReferenceEnd(xml: string, start: number): number | null {
  XML_REFERENCE_AT_POSITION.lastIndex = start;
  const match = XML_REFERENCE_AT_POSITION.exec(xml);
  if (!match || decodeXmlReference(match[0]) === null) return null;
  return start + match[0].length;
}

function xmlTagEnd(xml: string, start: number): number | null {
  let quote: '"' | "'" | null = null;
  let index = start + 1;
  while (index < xml.length) {
    const character = xml[index];
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else if (character === '<') {
        return null;
      } else if (character === '&') {
        const end = xmlReferenceEnd(xml, index);
        if (end === null) return null;
        index = end;
        continue;
      }
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '<') {
      return null;
    } else if (character === '>') {
      return index + 1;
    } else if (character === '&') {
      const end = xmlReferenceEnd(xml, index);
      if (end === null) return null;
      index = end;
      continue;
    }
    index += 1;
  }
  return null;
}

function isXmlWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

function validProcessingInstruction(xml: string, start: number, data: string): boolean {
  let targetEnd = 0;
  while (targetEnd < data.length && !isXmlWhitespace(data[targetEnd])) targetEnd += 1;
  if (targetEnd === 0) return false;
  const target = data.slice(0, targetEnd);
  if (!XML_NAME.test(target)) return false;
  if (target.toLowerCase() !== 'xml') return true;
  const documentStart = start === 0 || (start === 1 && xml.startsWith('\uFEFF'));
  return target === 'xml' && documentStart && XML_DECLARATION.test(data.slice(targetEnd));
}

function prepareXml(xml: string): string | null {
  let prepared = '';
  let copiedUntil = 0;
  let index = 0;
  while (index < xml.length) {
    if (xml.startsWith('<!--', index)) {
      const end = xml.indexOf('-->', index + 4);
      if (end === -1) return null;
      prepared += xml.slice(copiedUntil, end + 3);
      index = end + 3;
      copiedUntil = index;
      continue;
    }
    if (xml.startsWith('<![CDATA[', index)) {
      const end = xml.indexOf(']]>', index + 9);
      if (end === -1) return null;
      prepared += xml.slice(copiedUntil, index);
      prepared += xml.slice(index + 9, end).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
      index = end + 3;
      copiedUntil = index;
      continue;
    }
    if (xml.startsWith('<?', index)) {
      const end = xml.indexOf('?>', index + 2);
      if (end === -1 || !validProcessingInstruction(xml, index, xml.slice(index + 2, end))) return null;
      prepared += xml.slice(copiedUntil, end + 2);
      index = end + 2;
      copiedUntil = index;
      continue;
    }
    if (xml[index] === '<') {
      if (xml.startsWith('<!', index)) return null;
      const end = xmlTagEnd(xml, index);
      if (end === null) return null;
      prepared += xml.slice(copiedUntil, end);
      index = end;
      copiedUntil = index;
      continue;
    }
    if (xml[index] === '&') {
      const end = xmlReferenceEnd(xml, index);
      if (end === null) return null;
      index = end;
      continue;
    }
    index += 1;
  }
  return prepared + xml.slice(copiedUntil);
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

function decodeHtmlReferences(value: string, maxLength: number): string | null {
  if (value.length > maxLength) return null;
  let valid = true;
  const decoded = value.replace(/&(?:([A-Za-z][A-Za-z0-9]+)|#(?:\d+|x[\da-fA-F]+));/gu, (reference, name?: string) => {
    const decodedReference = name === undefined
      ? decodeXmlReference(reference)
      : Object.hasOwn(HTML_NAMED_ENTITIES, name) ? HTML_NAMED_ENTITIES[name] : null;
    if (decodedReference === null) {
      valid = false;
      return '\uFFFD';
    }
    return decodedReference;
  });
  return valid && decoded.length <= maxLength ? decoded : null;
}

type ParsedXmlText = { text: string };

function parsedXmlText(value: unknown): ParsedXmlText | null {
  if (typeof value === 'string') return { text: value };
  const record = asRecord(value);
  if (!record || Object.keys(record).some((key) => key !== '#text' && !key.startsWith('@'))) return null;
  return typeof record['#text'] === 'string' ? { text: record['#text'] } : null;
}

function normalizedMetadata(value: unknown, maxLength: number): string | null {
  const parsed = parsedXmlText(value);
  if (!parsed || parsed.text.length > MAX_FEED_BYTES || UNSAFE_CONTROL_CHARACTER.test(parsed.text)) return null;
  const decoded = decodeXmlReferences(parsed.text, MAX_FEED_BYTES);
  if (decoded === null || decoded.length > maxLength) return null;
  const normalized = decoded.normalize('NFKC');
  if (UNSAFE_CONTROL_CHARACTER.test(normalized) || FORMAT_CONTROL.test(normalized) || XML_MARKUP.test(normalized)) return null;
  const plainText = normalized.replace(/\s+/gu, ' ').trim();
  return plainText.length > 0 && plainText.length <= maxLength ? plainText : null;
}

function canonicalUrl(value: unknown): string | null {
  const parsed = parsedXmlText(value);
  if (!parsed || parsed.text.length > MAX_FEED_BYTES) return null;
  const decoded = decodeXmlReferences(parsed.text, MAX_FEED_BYTES);
  if (decoded === null || decoded.length > MAX_URL_LENGTH || CONTROL_CHARACTER.test(decoded) || INVALID_URL_CHARACTER.test(decoded)) return null;
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

function joinedAuthorNames(names: Array<string | null>): string | null {
  if (names.length === 0 || names.some((name) => name === null)) return null;
  const author = names.join('; ');
  return author.length <= MAX_AUTHOR_LENGTH ? author : null;
}

function hasCanonicalDcNamespace(scopes: Array<Record<string, unknown>>): boolean {
  let declared = false;
  for (const scope of scopes) {
    const declaration = scope['@xmlns:dc'];
    if (declaration === undefined) continue;
    if (declaration !== DC_CREATOR_NAMESPACE) return false;
    declared = true;
  }
  return declared;
}

function normalizedAuthor(
  item: Record<string, unknown>,
  atom: boolean,
  namespaceScopes: Array<Record<string, unknown>>,
): string | null {
  if (atom) {
    return joinedAuthorNames(asArray(item.author).map((value) => {
      const author = asRecord(value);
      return normalizedMetadata(author?.name, MAX_AUTHOR_LENGTH);
    }));
  }
  return joinedAuthorNames(asArray(item['dc:creator']).map((value) => {
    const creator = asRecord(value);
    if (!hasCanonicalDcNamespace(creator ? [...namespaceScopes, creator] : namespaceScopes)) return null;
    return normalizedMetadata(value, MAX_AUTHOR_LENGTH);
  }));
}

function normalizedExcerpt(value: unknown, html = false): string {
  const parsed = parsedXmlText(value);
  if (!parsed || UNSAFE_CONTROL_CHARACTER.test(parsed.text)) return '';
  const xmlDecoded = decodeXmlReferences(parsed.text, MAX_FEED_BYTES);
  if (xmlDecoded === null) return '';
  // Atom HTML serializa o markup em duas camadas; a segunda decodificação é restrita ao fallback.
  const decoded = html ? decodeHtmlReferences(xmlDecoded, MAX_FEED_BYTES) : xmlDecoded;
  if (decoded === null) return '';
  // O BCB usa U+200B como espaçamento invisível no HTML do feed.
  const normalized = (html ? decoded.replaceAll('\u200B', '') : decoded).normalize('NFKC');
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
  const text = normalizedMetadata(value, 128);
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
        headers: { Accept: FEED_ACCEPT, 'User-Agent': FEED_USER_AGENT },
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

function alternateLink(item: Record<string, unknown>): unknown {
  if (typeof item.link === 'string') return item.link;
  for (const value of asArray(item.link)) {
    const link = asRecord(value);
    if (!link || (link['@rel'] !== undefined && link['@rel'] !== 'alternate')) continue;
    if (typeof link['@href'] === 'string') return link['@href'];
    if (typeof link['#text'] === 'string') return link['#text'];
  }
  return null;
}

function normalizedAtomContentExcerpt(value: unknown): string {
  const content = asRecord(value);
  if (!content) return normalizedExcerpt(value);
  const type = content['@type'];
  if (type === undefined || type === 'text') return normalizedExcerpt(value);
  if (type === 'html') return normalizedExcerpt(value, true);
  return '';
}

function parseFeed(xml: string, source: AllowlistSource, retrievedAt: string): ParsedFeed | null {
  if (!xml) return null;
  const preparedXml = prepareXml(xml);
  if (preparedXml === null || XMLValidator.validate(preparedXml) !== true) return null;
  const parsed = new XMLParser({
    processEntities: false,
    parseTagValue: false,
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    removeNSPrefix: false,
  }).parse(preparedXml) as unknown;
  const root = asRecord(parsed);
  if (!root) return null;

  let entries: unknown[];
  let rssNamespaceScopes: Array<Record<string, unknown>> = [];
  if (root.rss !== undefined) {
    const rss = asRecord(root.rss);
    const channelValue = rss?.channel;
    const channel = typeof channelValue === 'string' && channelValue.trim() === '' ? {} : asRecord(channelValue);
    if (!rss || !channel) return null;
    entries = asArray(channel.item);
    rssNamespaceScopes = [rss, channel];
  } else if (root.feed !== undefined) {
    const feed = typeof root.feed === 'string' && root.feed.trim() === '' ? {} : asRecord(root.feed);
    if (!feed) return null;
    entries = asArray(feed.entry);
  } else {
    return null;
  }

  const candidates: SourceCandidate[] = [];
  const atom = root.feed !== undefined;
  for (const entry of entries.slice(0, 100)) {
    const item = asRecord(entry);
    if (!item) continue;
    const title = normalizedMetadata(item.title, MAX_TITLE_LENGTH);
    const url = canonicalUrl(alternateLink(item));
    if (!title || !url) continue;
    const primaryExcerpt = normalizedExcerpt(item.description ?? item.summary);
    const excerpt = atom && !primaryExcerpt ? normalizedAtomContentExcerpt(item.content) : primaryExcerpt;
    const author = normalizedAuthor(item, atom, atom ? [] : [...rssNamespaceScopes, item]);
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
      ...(author === null ? {} : { author }),
      ...(source.licenseUrl === undefined ? {} : { licenseUrl: source.licenseUrl }),
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
