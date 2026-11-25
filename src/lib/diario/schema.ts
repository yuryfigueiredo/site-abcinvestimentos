import { createHash } from 'node:crypto';
import { currentDateBrt, isCalendarDate, parseCalendarDate } from './time';
import type {
  AllowlistFeed,
  AllowlistSource,
  Approval,
  BcbObservation,
  BcbSnapshot,
  CalendarEvent,
  CollectedInputs,
  CurationDecision,
  Edition,
  EditorialBriefing,
  Lesson,
  MeasuredKey,
  MeasuredValue,
  NewsItem,
  ReasonCode,
  SelectedSourceEvidence,
  Selection,
  SourceCandidate,
  SourceRef,
  Thresholds,
  Topic,
  Vault,
} from './types';

const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;
const DECIMAL_NUMBER = /\p{N}/u;
const HTML_MARKUP = /<|>|&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/iu;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const TOPICS: readonly Topic[] = ['renda-fixa', 'juros', 'inflacao', 'cambio', 'bolsa-fiis', 'regulacao'];
const MEASURED_KEYS: readonly MeasuredKey[] = ['selic', 'cdi', 'ipca12m', 'dolar'];
const REASON_CODES: readonly ReasonCode[] = [
  'calendar-event',
  'dollar-trigger',
  'official-news',
  'corroborated-media-news',
  'monday-lesson',
  'no-substantive-delta',
  'history-unavailable',
];
const EVENT_KINDS: readonly Thresholds['events'][number][] = ['copom', 'ipca', 'igp-m', 'payroll', 'fomc'];

export const APPROVED_INSTRUCTION_REF = 'docs/superpowers/plans/2026-11-24-diario-expansao-fontes.md';

type Fields = Map<string, unknown>;

function objectFields(value: unknown, path: string): Fields {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} must be a plain object`);
  }
  return new Map(Object.entries(value));
}

function required(fields: Fields, key: string, path: string): unknown {
  if (!fields.has(key)) throw new Error(`${path}.${key} is required`);
  return fields.get(key);
}

function checkKeys(fields: Fields, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  for (const key of fields.keys()) {
    if (!allowedKeys.has(key)) throw new Error(`${path} has unknown field ${key}`);
  }
}

function arrayValue(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  if (value.length > max) throw new Error(`${path} exceeds the maximum length of ${max}`);
  return Array.from(value, (entry: unknown) => entry);
}

function text(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${path} must be a string`);
  if (CONTROL_CHARACTER.test(value)) throw new Error(`${path} contains control characters`);
  if (value !== value.trim()) throw new Error(`${path} must not have leading or trailing whitespace`);
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new Error(`${path} length must be between ${min} and ${max}`);
  }
  return value;
}

function prose(value: unknown, path: string, max: number, min = 1): string {
  const result = text(value, path, min, max);
  if (DECIMAL_NUMBER.test(result)) throw new Error(`${path} editorial prose must not contain digits`);
  if (HTML_MARKUP.test(result)) throw new Error(`${path} editorial prose must not contain HTML`);
  return result;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path, 1, 128);
  if (!IDENTIFIER.test(result)) throw new Error(`${path} has an invalid identifier format`);
  return result;
}

function version(value: unknown, path: string): string {
  const result = text(value, path, 1, 64);
  if (!VERSION.test(result)) throw new Error(`${path} has an invalid version format`);
  return result;
}

function semver(value: unknown, path: string): string {
  const result = text(value, path, 1, 64);
  if (!SEMVER.test(result)) throw new Error(`${path} must be a valid semantic version (semver)`);
  return result;
}

function slug(value: unknown, path: string): string {
  const result = text(value, path, 1, 128);
  if (!SLUG.test(result)) throw new Error(`${path} has an invalid slug format`);
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string') throw new Error(`${path} must be a string enum`);
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new Error(`${path} has an invalid enum value`);
  return match;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  const result = finiteNumber(value, path);
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new Error(`${path} must be an integer between ${min} and ${max}`);
  }
  return result;
}

function uniqueStrings(value: unknown, path: string, max: number, min = 0): string[] {
  const entries = arrayValue(value, path, max);
  if (entries.length < min) throw new Error(`${path} requires at least ${min} entries`);
  const result = entries.map((entry, index) => text(entry, `${path}[${index}]`, 1, 128));
  if (new Set(result).size !== result.length) throw new Error(`${path} must not contain duplicates`);
  return result;
}

function parseIsoTimestamp(value: unknown, path: string, utcOnly = false): string {
  if (typeof value !== 'string' || CONTROL_CHARACTER.test(value)) {
    throw new Error(`${path} must be an ISO timestamp`);
  }
  const match = (utcOnly ? UTC_TIMESTAMP : ISO_TIMESTAMP).exec(value);
  if (!match) throw new Error(`${path} must use ${utcOnly ? 'YYYY-MM-DDTHH:mm:ssZ' : 'ISO timestamp'} format`);
  if (!isCalendarDate(match[1])) throw new Error(`${path} contains an invalid calendar date`);
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) {
    throw new Error(`${path} contains an invalid time`);
  }
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${path} is not a parseable timestamp`);
  if (utcOnly && new Date(value).toISOString().replace('.000Z', 'Z') !== value) {
    throw new Error(`${path} is not a valid UTC timestamp`);
  }
  return value;
}

function parseHttpsUrl(value: unknown, path: string): string {
  const result = text(value, path, 1, 2048);
  if (/[<>"\\]/u.test(result)) throw new Error(`${path} contains invalid URL characters`);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new Error(`${path} must be a valid URL`);
  }
  if (url.protocol !== 'https:') throw new Error(`${path} must use HTTPS`);
  if (url.username || url.password) throw new Error(`${path} must not contain credentials`);
  if (url.hash) throw new Error(`${path} must not contain a fragment`);
  if (!HOSTNAME.test(url.hostname)) throw new Error(`${path} must use an exact DNS hostname`);
  return result;
}

function parseHostname(value: unknown, path: string): string {
  const result = text(value, path, 1, 253);
  if (result !== result.toLowerCase() || !HOSTNAME.test(result)) {
    throw new Error(`${path} must be a lowercase exact hostname`);
  }
  return result;
}

function parseHostnameList(value: unknown, path: string): string[] {
  const entries = arrayValue(value, path, 100);
  const result = entries.map((entry, index) => parseHostname(entry, `${path}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${path} must not contain duplicate hostnames`);
  return result;
}

function rejectDuplicateIds(entries: readonly { id: string }[], path: string, kind: 'NewsItem' | 'SourceRef'): void {
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (ids.has(entry.id)) {
      throw new Error(`${path}[${index}].id duplicates ${kind}.id "${entry.id}"; IDs must be unique`);
    }
    ids.add(entry.id);
  }
}

function parseTopics(value: unknown, path: string, min = 0): Topic[] {
  const entries = arrayValue(value, path, TOPICS.length);
  if (entries.length < min) throw new Error(`${path} requires at least ${min} topics`);
  const result = entries.map((entry, index) => oneOf(entry, TOPICS, `${path}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${path} must not contain duplicates`);
  return result;
}

function parseSourceRef(value: unknown, path: string): SourceRef {
  const fields = objectFields(value, path);
  checkKeys(fields, ['id', 'sourceId', 'kind', 'publisher', 'title', 'canonicalUrl', 'publishedAt', 'retrievedAt', 'author', 'licenseUrl'], path);
  const publishedAt = required(fields, 'publishedAt', path);
  const author = fields.has('author') ? text(fields.get('author'), `${path}.author`, 1, 500) : undefined;
  const licenseUrl = fields.has('licenseUrl')
    ? parseHttpsUrl(fields.get('licenseUrl'), `${path}.licenseUrl`)
    : undefined;
  return {
    id: identifier(required(fields, 'id', path), `${path}.id`),
    sourceId: identifier(required(fields, 'sourceId', path), `${path}.sourceId`),
    kind: oneOf(required(fields, 'kind', path), ['official', 'media'] as const, `${path}.kind`),
    publisher: text(required(fields, 'publisher', path), `${path}.publisher`, 1, 120),
    title: text(required(fields, 'title', path), `${path}.title`, 1, 500),
    canonicalUrl: parseHttpsUrl(required(fields, 'canonicalUrl', path), `${path}.canonicalUrl`),
    publishedAt: publishedAt === null ? null : parseIsoTimestamp(publishedAt, `${path}.publishedAt`),
    retrievedAt: parseIsoTimestamp(required(fields, 'retrievedAt', path), `${path}.retrievedAt`),
    ...(author === undefined ? {} : { author }),
    ...(licenseUrl === undefined ? {} : { licenseUrl }),
  };
}

function normalizedEvidenceExcerpt(value: unknown, path: string): string {
  const result = text(value, path, 1, 600).normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (result.length === 0) throw new Error(`${path} must not be empty after normalization`);
  return result;
}

export function parseSourceCandidate(value: unknown, path = 'source'): SourceCandidate {
  const fields = objectFields(value, path);
  checkKeys(fields, [
    'id', 'sourceId', 'kind', 'publisher', 'title', 'canonicalUrl', 'publishedAt', 'retrievedAt',
    'author', 'licenseUrl', 'excerpt', 'excerptSha256',
  ], path);
  const reference = Object.fromEntries([...fields].filter(([key]) => key !== 'excerpt' && key !== 'excerptSha256'));
  const excerpt = normalizedEvidenceExcerpt(required(fields, 'excerpt', path), `${path}.excerpt`);
  const excerptSha256 = required(fields, 'excerptSha256', path);
  if (typeof excerptSha256 !== 'string' || !SHA256.test(excerptSha256)) {
    throw new Error(`${path}.excerptSha256 must be 64 lowercase hexadecimal characters`);
  }
  const actualHash = createHash('sha256').update(excerpt, 'utf8').digest('hex');
  if (excerptSha256 !== actualHash) throw new Error(`${path}.excerptSha256 does not match the normalized excerpt`);
  return { ...parseSourceRef(reference, path), excerpt, excerptSha256 };
}

function parseLesson(value: unknown, path: string): Lesson {
  const fields = objectFields(value, path);
  checkKeys(fields, ['id', 'title', 'body', 'guideSlug'], path);
  return {
    id: identifier(required(fields, 'id', path), `${path}.id`),
    title: prose(required(fields, 'title', path), `${path}.title`, 240),
    body: prose(required(fields, 'body', path), `${path}.body`, 8000),
    guideSlug: slug(required(fields, 'guideSlug', path), `${path}.guideSlug`),
  };
}

function parseNewsItem(value: unknown, path: string): NewsItem {
  const fields = objectFields(value, path);
  checkKeys(fields, ['id', 'topic', 'headline', 'summary', 'whyItMatters', 'sourceIds'], path);
  return {
    id: identifier(required(fields, 'id', path), `${path}.id`),
    topic: oneOf(required(fields, 'topic', path), TOPICS, `${path}.topic`),
    headline: prose(required(fields, 'headline', path), `${path}.headline`, 240),
    summary: prose(required(fields, 'summary', path), `${path}.summary`, 4000),
    whyItMatters: prose(required(fields, 'whyItMatters', path), `${path}.whyItMatters`, 2000),
    sourceIds: uniqueStrings(required(fields, 'sourceIds', path), `${path}.sourceIds`, 100, 1).map((entry, index) =>
      identifier(entry, `${path}.sourceIds[${index}]`),
    ),
  };
}

export function parseCalendarEvent(value: unknown, path: string): CalendarEvent {
  const fields = objectFields(value, path);
  checkKeys(fields, ['id', 'date', 'title', 'sourceUrl'], path);
  return {
    id: identifier(required(fields, 'id', path), `${path}.id`),
    date: parseCalendarDate(required(fields, 'date', path), `${path}.date`),
    title: text(required(fields, 'title', path), `${path}.title`, 1, 240),
    sourceUrl: parseHttpsUrl(required(fields, 'sourceUrl', path), `${path}.sourceUrl`),
  };
}

function normalizedWatchItem(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function parseEditorialBriefing(value: unknown): EditorialBriefing {
  const path = 'edition.briefing';
  const fields = objectFields(value, path);
  checkKeys(fields, ['whatHappened', 'whyItMatters', 'whatToWatch'], path);
  const whatHappened = prose(required(fields, 'whatHappened', path), `${path}.whatHappened`, 1600, 240);
  const whyItMatters = prose(required(fields, 'whyItMatters', path), `${path}.whyItMatters`, 1200, 200);
  const watchEntries = arrayValue(required(fields, 'whatToWatch', path), `${path}.whatToWatch`, 4);
  if (watchEntries.length < 2) throw new Error(`${path}.whatToWatch requires at least 2 entries`);
  const whatToWatch = watchEntries.map((entry, index) =>
    prose(entry, `${path}.whatToWatch[${index}]`, 320, 60),
  );
  const normalizedWatchItems = whatToWatch.map(normalizedWatchItem);
  if (new Set(normalizedWatchItems).size !== normalizedWatchItems.length) {
    throw new Error(`${path}.whatToWatch must not contain duplicate normalized items`);
  }
  return { whatHappened, whyItMatters, whatToWatch };
}

function parseMeasuredValue(value: unknown, path: string): MeasuredValue {
  const fields = objectFields(value, path);
  checkKeys(fields, ['value', 'observedOn', 'origin'], path);
  return {
    value: finiteNumber(required(fields, 'value', path), `${path}.value`),
    observedOn: parseCalendarDate(required(fields, 'observedOn', path), `${path}.observedOn`),
    origin: oneOf(required(fields, 'origin', path), ['bcb-sgs', 'stale', 'unavailable'] as const, `${path}.origin`),
  };
}

function parseBcbSnapshot(value: unknown, path: string): BcbSnapshot {
  const fields = objectFields(value, path);
  checkKeys(fields, ['status', 'measured', 'staleFields', 'dollarChangePct'], path);
  const measuredFields = objectFields(required(fields, 'measured', path), `${path}.measured`);
  for (const key of measuredFields.keys()) {
    if (!MEASURED_KEYS.some((measuredKey) => measuredKey === key)) {
      throw new Error(`${path}.measured has unsupported key ${key}`);
    }
  }

  const measured: Partial<Record<MeasuredKey, MeasuredValue>> = {};
  for (const key of MEASURED_KEYS) {
    if (measuredFields.has(key)) measured[key] = parseMeasuredValue(measuredFields.get(key), `${path}.measured.${key}`);
  }

  const staleFields = uniqueStrings(required(fields, 'staleFields', path), `${path}.staleFields`, MEASURED_KEYS.length).map(
    (entry, index) => oneOf(entry, MEASURED_KEYS, `${path}.staleFields[${index}]`),
  );
  const dollarChangePct = required(fields, 'dollarChangePct', path);

  return {
    status: oneOf(required(fields, 'status', path), ['ok', 'stale', 'unavailable'] as const, `${path}.status`),
    measured,
    staleFields,
    dollarChangePct: dollarChangePct === null ? null : finiteNumber(dollarChangePct, `${path}.dollarChangePct`),
  };
}

function parseCurationDecision(value: unknown, path: string): CurationDecision {
  const fields = objectFields(value, path);
  checkKeys(fields, ['status', 'reasonCodes', 'eventId', 'lessonId', 'newsClusterIds'], path);
  const reasonCodes = arrayValue(required(fields, 'reasonCodes', path), `${path}.reasonCodes`, REASON_CODES.length).map(
    (entry, index) => oneOf(entry, REASON_CODES, `${path}.reasonCodes[${index}]`),
  );
  if (new Set(reasonCodes).size !== reasonCodes.length) throw new Error(`${path}.reasonCodes must not contain duplicates`);
  const newsClusterIds = uniqueStrings(required(fields, 'newsClusterIds', path), `${path}.newsClusterIds`, 100).map(
    (entry, index) => identifier(entry, `${path}.newsClusterIds[${index}]`),
  );
  const eventId = fields.has('eventId')
    ? identifier(fields.get('eventId'), `${path}.eventId`)
    : undefined;
  const lessonId = fields.has('lessonId')
    ? identifier(fields.get('lessonId'), `${path}.lessonId`)
    : undefined;

  return {
    status: oneOf(required(fields, 'status', path), ['material', 'morno'] as const, `${path}.status`),
    reasonCodes,
    newsClusterIds,
    ...(eventId === undefined ? {} : { eventId }),
    ...(lessonId === undefined ? {} : { lessonId }),
  };
}

export function parseSelection(value: unknown): Selection {
  const fields = objectFields(value, 'selection');
  checkKeys(fields, ['date', 'decision', 'clusters', 'selectedSources', 'eventId', 'lessonId'], 'selection');
  const date = parseCalendarDate(required(fields, 'date', 'selection'), 'selection.date');
  const decision = parseCurationDecision(required(fields, 'decision', 'selection'), 'selection.decision');
  const eventId = fields.has('eventId')
    ? identifier(fields.get('eventId'), 'selection.eventId')
    : undefined;
  const lessonId = fields.has('lessonId')
    ? identifier(fields.get('lessonId'), 'selection.lessonId')
    : undefined;
  if ((eventId !== undefined && eventId !== decision.eventId) || (lessonId !== undefined && lessonId !== decision.lessonId)) {
    throw new Error('selection.eventId and selection.lessonId must match selection.decision');
  }

  const clusters = arrayValue(required(fields, 'clusters', 'selection'), 'selection.clusters', 3).map((entry, index) => {
    const path = `selection.clusters[${index}]`;
    const clusterFields = objectFields(entry, path);
    checkKeys(clusterFields, ['id', 'topic', 'sourceIds'], path);
    return {
      id: identifier(required(clusterFields, 'id', path), `${path}.id`),
      topic: oneOf(required(clusterFields, 'topic', path), TOPICS, `${path}.topic`),
      sourceIds: uniqueStrings(required(clusterFields, 'sourceIds', path), `${path}.sourceIds`, 100, 1).map(
        (sourceId, sourceIndex) => identifier(sourceId, `${path}.sourceIds[${sourceIndex}]`),
      ),
    };
  });
  const clusterIds = new Set<string>();
  for (const [index, cluster] of clusters.entries()) {
    if (clusterIds.has(cluster.id)) throw new Error(`selection.clusters[${index}].id duplicates a cluster`);
    clusterIds.add(cluster.id);
  }
  if (JSON.stringify(clusters.map((cluster) => cluster.id)) !== JSON.stringify(decision.newsClusterIds)) {
    throw new Error('selection.clusters must exactly match selection.decision.newsClusterIds');
  }

  const selectedSources = arrayValue(required(fields, 'selectedSources', 'selection'), 'selection.selectedSources', 300).map(
    (entry, index) => {
      const path = `selection.selectedSources[${index}]`;
      const selectedFields = objectFields(entry, path);
      checkKeys(selectedFields, [
        'id', 'sourceId', 'kind', 'publisher', 'title', 'canonicalUrl', 'publishedAt', 'retrievedAt',
        'author', 'licenseUrl', 'excerpt', 'excerptSha256', 'clusterId', 'topic',
      ], path);
      const reference = Object.fromEntries(
        [...selectedFields].filter(([key]) => key !== 'excerpt' && key !== 'excerptSha256' && key !== 'clusterId' && key !== 'topic'),
      );
      return {
        ...parseSourceCandidate({ ...reference, excerpt: selectedFields.get('excerpt'), excerptSha256: selectedFields.get('excerptSha256') }, path),
        clusterId: identifier(required(selectedFields, 'clusterId', path), `${path}.clusterId`),
        topic: oneOf(required(selectedFields, 'topic', path), TOPICS, `${path}.topic`),
      } satisfies SelectedSourceEvidence;
    },
  );
  const sourceIds = new Set<string>();
  for (const [index, selected] of selectedSources.entries()) {
    if (sourceIds.has(selected.id)) throw new Error(`selection.selectedSources[${index}].id duplicates a selected source`);
    sourceIds.add(selected.id);
    const cluster = clusters.find((candidate) => candidate.id === selected.clusterId);
    if (!cluster) throw new Error(`selection.selectedSources[${index}].clusterId references an unknown cluster`);
    if (!cluster.sourceIds.includes(selected.id)) throw new Error(`selection.selectedSources[${index}].id is missing from its cluster`);
    if (cluster.topic !== selected.topic) throw new Error(`selection.selectedSources[${index}].topic differs from its cluster`);
  }
  for (const [clusterIndex, cluster] of clusters.entries()) {
    for (const sourceId of cluster.sourceIds) {
      if (!sourceIds.has(sourceId)) throw new Error(`selection.clusters[${clusterIndex}] references unselected source ${sourceId}`);
    }
  }

  return {
    date,
    decision,
    clusters,
    selectedSources,
    ...(eventId === undefined ? {} : { eventId }),
    ...(lessonId === undefined ? {} : { lessonId }),
  };
}

function parsePolicy(value: unknown, path: string) {
  const fields = objectFields(value, path);
  checkKeys(fields, ['charterVersion', 'allowlistVersion', 'thresholdsVersion', 'sourceIds', 'allowedHosts'], path);
  return {
    charterVersion: version(required(fields, 'charterVersion', path), `${path}.charterVersion`),
    allowlistVersion: semver(required(fields, 'allowlistVersion', path), `${path}.allowlistVersion`),
    thresholdsVersion: version(required(fields, 'thresholdsVersion', path), `${path}.thresholdsVersion`),
    sourceIds: uniqueStrings(required(fields, 'sourceIds', path), `${path}.sourceIds`, 100).map((entry, index) =>
      identifier(entry, `${path}.sourceIds[${index}]`),
    ),
    allowedHosts: parseHostnameList(required(fields, 'allowedHosts', path), `${path}.allowedHosts`),
  };
}

function parseProvenance(value: unknown, path: string): Edition['provenance'] {
  const fields = objectFields(value, path);
  checkKeys(fields, ['generator', 'promptVersion', 'disclaimerKey'], path);
  const generator = required(fields, 'generator', path);
  const disclaimerKey = required(fields, 'disclaimerKey', path);
  if (generator !== 'qoder-diario') throw new Error(`${path}.generator must be qoder-diario`);
  if (disclaimerKey !== 'educacional-nao-e-recomendacao') {
    throw new Error(`${path}.disclaimerKey must be educacional-nao-e-recomendacao`);
  }
  return {
    generator: 'qoder-diario',
    promptVersion: version(required(fields, 'promptVersion', path), `${path}.promptVersion`),
    disclaimerKey: 'educacional-nao-e-recomendacao',
  };
}

export function parseEdition(value: unknown): Edition {
  const fields = objectFields(value, 'edition');
  checkKeys(
    fields,
    [
      'schemaVersion',
      'id',
      'date',
      'generatedAt',
      'title',
      'summary',
      'snapshot',
      'decision',
      'items',
      'lesson',
      'briefing',
      'event',
      'sources',
      'relatedCalculatorSlug',
      'policy',
      'provenance',
    ],
    'edition',
  );
  if (required(fields, 'schemaVersion', 'edition') !== 2) throw new Error('edition.schemaVersion must be 2');

  const items = arrayValue(required(fields, 'items', 'edition'), 'edition.items', 3).map((entry, index) =>
    parseNewsItem(entry, `edition.items[${index}]`),
  );
  const sources = arrayValue(required(fields, 'sources', 'edition'), 'edition.sources', 100).map((entry, index) =>
    parseSourceRef(entry, `edition.sources[${index}]`),
  );
  const lesson = fields.has('lesson') ? parseLesson(fields.get('lesson'), 'edition.lesson') : undefined;
  const decision = parseCurationDecision(required(fields, 'decision', 'edition'), 'edition.decision');
  const briefing = fields.has('briefing') ? parseEditorialBriefing(fields.get('briefing')) : undefined;
  const event = fields.has('event') ? parseCalendarEvent(fields.get('event'), 'edition.event') : undefined;

  if (decision.status === 'material' && briefing === undefined) {
    throw new Error('edition.briefing is required for material editions');
  }
  if (decision.status === 'morno' && briefing !== undefined) {
    throw new Error('edition.briefing is forbidden in quiet editions');
  }
  if (decision.status === 'morno' && event !== undefined) {
    throw new Error('edition.event is forbidden in quiet editions');
  }
  if (decision.eventId === undefined && event !== undefined) {
    throw new Error('edition.event is forbidden when edition.decision.eventId is absent');
  }
  if (decision.eventId !== undefined && event === undefined) {
    throw new Error('edition.event is required when edition.decision.eventId exists');
  }
  if (event !== undefined && event.id !== decision.eventId) {
    throw new Error('edition.event.id must match edition.decision.eventId');
  }

  rejectDuplicateIds(items, 'edition.items', 'NewsItem');
  rejectDuplicateIds(sources, 'edition.sources', 'SourceRef');
  const sourceRefIds = new Set(sources.map((source) => source.id));
  for (const [itemIndex, item] of items.entries()) {
    for (const [sourceIndex, sourceId] of item.sourceIds.entries()) {
      if (!sourceRefIds.has(sourceId)) {
        throw new Error(
          `edition.items[${itemIndex}].sourceIds[${sourceIndex}] references unknown SourceRef.id "${sourceId}"`,
        );
      }
    }
  }

  return {
    schemaVersion: 2,
    id: identifier(required(fields, 'id', 'edition'), 'edition.id'),
    date: parseCalendarDate(required(fields, 'date', 'edition'), 'edition.date'),
    generatedAt: parseIsoTimestamp(required(fields, 'generatedAt', 'edition'), 'edition.generatedAt'),
    title: prose(required(fields, 'title', 'edition'), 'edition.title', 240),
    summary: prose(required(fields, 'summary', 'edition'), 'edition.summary', 4000),
    snapshot: parseBcbSnapshot(required(fields, 'snapshot', 'edition'), 'edition.snapshot'),
    decision,
    items,
    sources,
    ...(lesson === undefined ? {} : { lesson }),
    ...(briefing === undefined ? {} : { briefing }),
    ...(event === undefined ? {} : { event }),
    relatedCalculatorSlug: slug(required(fields, 'relatedCalculatorSlug', 'edition'), 'edition.relatedCalculatorSlug'),
    policy: parsePolicy(required(fields, 'policy', 'edition'), 'edition.policy'),
    provenance: parseProvenance(required(fields, 'provenance', 'edition'), 'edition.provenance'),
  };
}

export function parseCollectedInputs(value: unknown): CollectedInputs {
  const fields = objectFields(value, 'inputs');
  checkKeys(fields, ['date', 'retrievedAt', 'bcb', 'sources', 'events', 'lessons', 'previousEditions'], 'inputs');
  const date = parseCalendarDate(required(fields, 'date', 'inputs'), 'inputs.date');
  const retrievedAt = parseIsoTimestamp(required(fields, 'retrievedAt', 'inputs'), 'inputs.retrievedAt');
  if (date !== currentDateBrt(new Date(retrievedAt))) {
    throw new Error('inputs.date must match the America/Sao_Paulo date of inputs.retrievedAt');
  }
  const bcbFields = objectFields(required(fields, 'bcb', 'inputs'), 'inputs.bcb');
  const bcb: Partial<Record<MeasuredKey, BcbObservation[]>> = {};
  for (const key of MEASURED_KEYS) {
    if (!bcbFields.has(key)) continue;
    const observations = arrayValue(bcbFields.get(key), `inputs.bcb.${key}`, 1000);
    bcb[key] = observations.map((entry, index) => {
      const path = `inputs.bcb.${key}[${index}]`;
      const observationFields = objectFields(entry, path);
      checkKeys(observationFields, ['value', 'date'], path);
      return {
        value: finiteNumber(required(observationFields, 'value', path), `${path}.value`),
        date: parseCalendarDate(required(observationFields, 'date', path), `${path}.date`),
      };
    });
  }
  for (const key of bcbFields.keys()) {
    if (!MEASURED_KEYS.includes(key as MeasuredKey)) throw new Error(`inputs.bcb has unsupported key ${key}`);
  }

  const sources = arrayValue(required(fields, 'sources', 'inputs'), 'inputs.sources', 1000).map((entry, index) =>
    parseSourceCandidate(entry, `inputs.sources[${index}]`),
  );
  const events = arrayValue(required(fields, 'events', 'inputs'), 'inputs.events', 100).map((entry, index) =>
    parseCalendarEvent(entry, `inputs.events[${index}]`),
  );
  const lessons = parseLessons(required(fields, 'lessons', 'inputs'));
  const previousEditions = arrayValue(required(fields, 'previousEditions', 'inputs'), 'inputs.previousEditions', 1000).map(
    (entry) => parseEdition(entry),
  );
  return { date, retrievedAt, bcb, sources, events, lessons, previousEditions };
}

function parseAllowlistFeed(value: unknown, path: string): AllowlistFeed {
  const fields = objectFields(value, path);
  checkKeys(fields, ['url', 'topics'], path);
  return {
    url: parseHttpsUrl(required(fields, 'url', path), `${path}.url`),
    topics: parseTopics(required(fields, 'topics', path), `${path}.topics`, 1),
  };
}

export function parseAllowlist(value: unknown): Pick<Vault, 'allowlistVersion' | 'allowlist'> {
  const fields = objectFields(value, 'allowlist');
  checkKeys(fields, ['version', 'sources'], 'allowlist');
  const allowlistVersion = semver(required(fields, 'version', 'allowlist'), 'allowlist.version');
  const entries = arrayValue(required(fields, 'sources', 'allowlist'), 'allowlist.sources', 100);
  const ids = new Set<string>();
  const urls = new Set<string>();
  const allowlist = entries.map((entry, index) => {
    const path = `allowlist.sources[${index}]`;
    const fields = objectFields(entry, path);
    checkKeys(fields, ['id', 'publisher', 'kind', 'feeds', 'enabled', 'termsUrl', 'licenseUrl'], path);
    const id = identifier(required(fields, 'id', path), `${path}.id`);
    if (ids.has(id)) throw new Error(`${path}.id duplicates an allowlist source`);
    ids.add(id);

    const feeds = arrayValue(required(fields, 'feeds', path), `${path}.feeds`, 20).map((feed, feedIndex) => {
      const parsed = parseAllowlistFeed(feed, `${path}.feeds[${feedIndex}]`);
      if (urls.has(parsed.url)) throw new Error(`${path}.feeds[${feedIndex}].url duplicates an allowlisted feed`);
      urls.add(parsed.url);
      return parsed;
    });
    const termsUrl = fields.has('termsUrl')
      ? parseHttpsUrl(fields.get('termsUrl'), `${path}.termsUrl`)
      : undefined;
    const licenseUrl = fields.has('licenseUrl')
      ? parseHttpsUrl(fields.get('licenseUrl'), `${path}.licenseUrl`)
      : undefined;

    return {
      id,
      publisher: text(required(fields, 'publisher', path), `${path}.publisher`, 1, 120),
      kind: oneOf(required(fields, 'kind', path), ['official', 'media'] as const, `${path}.kind`),
      feeds,
      enabled: booleanValue(required(fields, 'enabled', path), `${path}.enabled`),
      ...(termsUrl === undefined ? {} : { termsUrl }),
      ...(licenseUrl === undefined ? {} : { licenseUrl }),
    };
  });
  return { allowlistVersion, allowlist };
}

export function parseThresholds(value: unknown): Thresholds {
  const fields = objectFields(value, 'thresholds');
  checkKeys(
    fields,
    [
      'version',
      'timezone',
      'runLocal',
      'dollarAbsChangePct',
      'lessonWeekday',
      'maxLessonsPerIsoWeek',
      'lessonOnlyWhenQuiet',
      'newsWindowHours',
      'minMediaSources',
      'maxItems',
      'topics',
      'events',
    ],
    'thresholds',
  );
  const timezone = required(fields, 'timezone', 'thresholds');
  const runLocal = required(fields, 'runLocal', 'thresholds');
  if (timezone !== 'America/Sao_Paulo') throw new Error('thresholds.timezone must be America/Sao_Paulo');
  if (runLocal !== '19:00') throw new Error('thresholds.runLocal must be 19:00');
  const dollarAbsChangePct = finiteNumber(required(fields, 'dollarAbsChangePct', 'thresholds'), 'thresholds.dollarAbsChangePct');
  if (dollarAbsChangePct <= 0) throw new Error('thresholds.dollarAbsChangePct must be positive');
  const events = arrayValue(required(fields, 'events', 'thresholds'), 'thresholds.events', EVENT_KINDS.length).map(
    (entry, index) => oneOf(entry, EVENT_KINDS, `thresholds.events[${index}]`),
  );
  if (new Set(events).size !== events.length) throw new Error('thresholds.events must not contain duplicates');

  return {
    version: version(required(fields, 'version', 'thresholds'), 'thresholds.version'),
    timezone: 'America/Sao_Paulo',
    runLocal: '19:00',
    dollarAbsChangePct,
    lessonWeekday: integer(required(fields, 'lessonWeekday', 'thresholds'), 'thresholds.lessonWeekday', 0, 6),
    maxLessonsPerIsoWeek: integer(
      required(fields, 'maxLessonsPerIsoWeek', 'thresholds'),
      'thresholds.maxLessonsPerIsoWeek',
      1,
      53,
    ),
    lessonOnlyWhenQuiet: booleanValue(
      required(fields, 'lessonOnlyWhenQuiet', 'thresholds'),
      'thresholds.lessonOnlyWhenQuiet',
    ),
    newsWindowHours: integer(required(fields, 'newsWindowHours', 'thresholds'), 'thresholds.newsWindowHours', 1, 168),
    minMediaSources: integer(required(fields, 'minMediaSources', 'thresholds'), 'thresholds.minMediaSources', 1, 10),
    maxItems: integer(required(fields, 'maxItems', 'thresholds'), 'thresholds.maxItems', 1, 10),
    topics: parseTopics(required(fields, 'topics', 'thresholds'), 'thresholds.topics', 1),
    events,
  };
}

export function parseCalendar(value: unknown): CalendarEvent[] {
  const entries = arrayValue(value, 'calendar', 100);
  const ids = new Set<string>();
  return entries.map((entry, index) => {
    const path = `calendar[${index}]`;
    const event = parseCalendarEvent(entry, path);
    if (ids.has(event.id)) throw new Error(`${path}.id duplicates a calendar event`);
    ids.add(event.id);
    return event;
  });
}

export function parseLessons(value: unknown): Lesson[] {
  const entries = arrayValue(value, 'lessons', 100);
  const ids = new Set<string>();
  const guideSlugs = new Set<string>();
  return entries.map((entry, index) => {
    const path = `lessons[${index}]`;
    const lesson = parseLesson(entry, path);
    if (ids.has(lesson.id)) throw new Error(`${path}.id duplicates a lesson`);
    if (guideSlugs.has(lesson.guideSlug)) throw new Error(`${path}.guideSlug duplicates a lesson guide`);
    ids.add(lesson.id);
    guideSlugs.add(lesson.guideSlug);
    return lesson;
  });
}

export function parseApproval(value: unknown): Approval {
  const fields = objectFields(value, 'approval');
  checkKeys(fields, ['bundleSha256', 'charterVersion', 'approvedAt', 'approvedBy', 'instructionRef'], 'approval');
  const bundleSha256 = required(fields, 'bundleSha256', 'approval');
  if (typeof bundleSha256 !== 'string' || !SHA256.test(bundleSha256)) {
    throw new Error('approval.bundleSha256 must be 64 lowercase hexadecimal characters');
  }
  const approvedBy = required(fields, 'approvedBy', 'approval');
  if (typeof approvedBy !== 'string' || CONTROL_CHARACTER.test(approvedBy)) {
    throw new Error('approval.approvedBy must not contain control characters');
  }
  const normalizedApprovedBy = approvedBy.trim();
  if (normalizedApprovedBy.length < 1 || normalizedApprovedBy.length > 120) {
    throw new Error('approval.approvedBy must contain between 1 and 120 characters after trim');
  }
  const instructionRef = required(fields, 'instructionRef', 'approval');
  if (instructionRef !== APPROVED_INSTRUCTION_REF) {
    throw new Error('approval.instructionRef must be the exact committed plan path');
  }

  return {
    bundleSha256,
    charterVersion: version(required(fields, 'charterVersion', 'approval'), 'approval.charterVersion'),
    approvedAt: parseIsoTimestamp(required(fields, 'approvedAt', 'approval'), 'approval.approvedAt', true),
    approvedBy: normalizedApprovedBy,
    instructionRef: APPROVED_INSTRUCTION_REF,
  };
}
