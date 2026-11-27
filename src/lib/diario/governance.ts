import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GUIDES } from '../../data/guides';
import {
  parseAllowlist,
  parseApproval,
  parseCalendar,
  parseLessons,
  parseThresholds,
} from './schema';
import { isCalendarDate } from './time';
import type { Thresholds, Vault } from './types';

type VaultFile = (typeof CONTENT_FILES)[number] | 'approval.json';
type CapturedVaultFiles = Record<VaultFile, Buffer>;

const CONTENT_FILES = ['carta.md', 'allowlist.json', 'thresholds.json', 'calendario.json', 'licoes.json', 'changelog.md'] as const;
const MAX_TEXT_BYTES = 1_000_000;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const guideSlugs = new Set(GUIDES.map((guide) => guide.slug));

const PINNED_THRESHOLDS: Pick<
  Thresholds,
  | 'timezone'
  | 'runLocal'
  | 'dollarAbsChangePct'
  | 'lessonWeekday'
  | 'maxLessonsPerIsoWeek'
  | 'lessonOnlyWhenQuiet'
  | 'newsWindowHours'
  | 'weekendNewsWindowHours'
  | 'minMediaSources'
  | 'maxItems'
  | 'topics'
  | 'events'
> = {
  timezone: 'America/Sao_Paulo',
  runLocal: '19:00',
  dollarAbsChangePct: 1.0,
  lessonWeekday: 1,
  maxLessonsPerIsoWeek: 1,
  lessonOnlyWhenQuiet: true,
  newsWindowHours: 30,
  weekendNewsWindowHours: 72,
  minMediaSources: 2,
  maxItems: 3,
  topics: [
    'renda-fixa',
    'juros',
    'inflacao',
    'cambio',
    'bolsa-fiis',
    'regulacao',
    'pagamentos-credito',
    'trabalho-renda',
    'consumo',
  ],
  events: ['copom', 'ipca', 'igp-m', 'payroll', 'fomc'],
};

function vaultPath(root: string, file: VaultFile): string {
  return join(resolve(root), 'src', 'data', 'diario', 'curadoria', file);
}

function readVaultBytes(root: string, file: VaultFile): Buffer {
  const bytes = readFileSync(vaultPath(root, file));
  if (bytes.length > MAX_TEXT_BYTES) throw new Error(`${file} exceeds the maximum vault file size`);
  return bytes;
}

function decodeVaultText(bytes: Buffer, file: VaultFile): string {
  try {
    const text = utf8Decoder.decode(bytes);
    if (text.includes('\u0000')) throw new Error(`${file} contains a null character`);
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes('null character')) throw error;
    throw new Error(`${file} must contain valid UTF-8`);
  }
}

function parseVaultJson(bytes: Buffer, file: VaultFile): unknown {
  try {
    return JSON.parse(decodeVaultText(bytes, file));
  } catch (error) {
    if (error instanceof Error && /valid UTF-8|maximum vault file size|null character/.test(error.message)) throw error;
    throw new Error(`${file} must contain valid JSON`);
  }
}

function unfencedMarkdownLines(markdown: string): string[] {
  const lines: string[] = [];
  let fence: '`' | '~' | null = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker) {
      const markerKind = marker[0] === '`' ? '`' : '~';
      if (fence === null) fence = markerKind;
      else if (fence === markerKind) fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  return lines;
}

function charterVersion(markdown: string): string {
  const matches = unfencedMarkdownLines(markdown)
    .map((line) => /^Versão da carta:\s*(\S+)\s*$/u.exec(line)?.[1])
    .filter((value): value is string => value !== undefined);
  if (matches.length !== 1 || !VERSION.test(matches[0])) {
    throw new Error('carta.md must declare exactly one valid Versão da carta');
  }
  return matches[0];
}

function latestChangelogVersion(markdown: string): string {
  let latest: string | undefined;
  for (const line of unfencedMarkdownLines(markdown)) {
    const match = /^##\s+([A-Za-z0-9][A-Za-z0-9._-]{0,63})(?:\s+—\s+(\d{4}-\d{2}-\d{2}))?\s*$/u.exec(line);
    if (!match) continue;
    if (match[2] && !isCalendarDate(match[2])) throw new Error('changelog.md contains an invalid entry date');
    latest = match[1];
  }
  if (latest === undefined) throw new Error('changelog.md must contain a versioned entry');
  return latest;
}

function assertPinned(field: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`thresholds.${field} differs from the approved policy`);
  }
}

function assertPinnedThresholds(thresholds: Thresholds): void {
  assertPinned('timezone', thresholds.timezone, PINNED_THRESHOLDS.timezone);
  assertPinned('runLocal', thresholds.runLocal, PINNED_THRESHOLDS.runLocal);
  assertPinned('dollarAbsChangePct', thresholds.dollarAbsChangePct, PINNED_THRESHOLDS.dollarAbsChangePct);
  assertPinned('lessonWeekday', thresholds.lessonWeekday, PINNED_THRESHOLDS.lessonWeekday);
  assertPinned('maxLessonsPerIsoWeek', thresholds.maxLessonsPerIsoWeek, PINNED_THRESHOLDS.maxLessonsPerIsoWeek);
  assertPinned('lessonOnlyWhenQuiet', thresholds.lessonOnlyWhenQuiet, PINNED_THRESHOLDS.lessonOnlyWhenQuiet);
  assertPinned('newsWindowHours', thresholds.newsWindowHours, PINNED_THRESHOLDS.newsWindowHours);
  assertPinned('weekendNewsWindowHours', thresholds.weekendNewsWindowHours, PINNED_THRESHOLDS.weekendNewsWindowHours);
  assertPinned('minMediaSources', thresholds.minMediaSources, PINNED_THRESHOLDS.minMediaSources);
  assertPinned('maxItems', thresholds.maxItems, PINNED_THRESHOLDS.maxItems);
  assertPinned('topics', thresholds.topics, PINNED_THRESHOLDS.topics);
  assertPinned('events', thresholds.events, PINNED_THRESHOLDS.events);
}

function updateCurationBundleHash(hash: ReturnType<typeof createHash>, files: CapturedVaultFiles): void {
  for (const file of CONTENT_FILES) {
    hash.update(file, 'utf8');
    hash.update(Buffer.from([0]));
    hash.update(files[file]);
    hash.update(Buffer.from([0]));
  }
}

export function computeCurationBundleHash(root: string = process.cwd()): string {
  const hash = createHash('sha256');
  const files = Object.fromEntries(CONTENT_FILES.map((file) => [file, readFileSync(vaultPath(root, file))])) as CapturedVaultFiles;
  updateCurationBundleHash(hash, files);
  return hash.digest('hex');
}

export function verifyGovernance(root: string = process.cwd()): Vault {
  const files = Object.fromEntries(
    ([...CONTENT_FILES, 'approval.json'] as const).map((file) => [file, readVaultBytes(root, file)]),
  ) as CapturedVaultFiles;
  const declaredCharterVersion = charterVersion(decodeVaultText(files['carta.md'], 'carta.md'));
  const declaredChangelogVersion = latestChangelogVersion(decodeVaultText(files['changelog.md'], 'changelog.md'));

  const { allowlistVersion, allowlist } = parseAllowlist(parseVaultJson(files['allowlist.json'], 'allowlist.json'));
  const thresholds = parseThresholds(parseVaultJson(files['thresholds.json'], 'thresholds.json'));
  const calendar = parseCalendar(parseVaultJson(files['calendario.json'], 'calendario.json'));
  const lessons = parseLessons(parseVaultJson(files['licoes.json'], 'licoes.json'));
  const approval = parseApproval(parseVaultJson(files['approval.json'], 'approval.json'));

  if (declaredCharterVersion !== declaredChangelogVersion || approval.charterVersion !== declaredCharterVersion) {
    throw new Error('approval.charterVersion must match both carta.md and the latest changelog.md entry');
  }

  const hash = createHash('sha256');
  updateCurationBundleHash(hash, files);
  const bundleSha256 = hash.digest('hex');
  if (approval.bundleSha256 !== bundleSha256) {
    throw new Error('approval.bundleSha256 does not match the six-file curation bundle');
  }

  assertPinnedThresholds(thresholds);
  if (lessons.length !== 12) throw new Error('lessons must contain exactly twelve approved lessons');
  for (const lesson of lessons) {
    if (!guideSlugs.has(lesson.guideSlug)) throw new Error(`lesson ${lesson.id} references an unknown guideSlug`);
  }

  return {
    charterVersion: declaredCharterVersion,
    allowlistVersion,
    allowlist,
    thresholds,
    calendar,
    lessons,
    bundleSha256,
    approval,
  };
}
