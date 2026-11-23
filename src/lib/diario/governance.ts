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
import type { Thresholds } from './types';

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
  newsWindowHours: 24,
  minMediaSources: 2,
  maxItems: 3,
  topics: ['renda-fixa', 'juros', 'inflacao', 'cambio', 'bolsa-fiis', 'regulacao'],
  events: ['copom', 'ipca', 'igp-m', 'payroll', 'fomc'],
};

function vaultPath(root: string, file: (typeof CONTENT_FILES)[number] | 'approval.json'): string {
  return join(resolve(root), 'src', 'data', 'diario', 'curadoria', file);
}

function readVaultText(root: string, file: (typeof CONTENT_FILES)[number] | 'approval.json'): string {
  const bytes = readFileSync(vaultPath(root, file));
  if (bytes.length > MAX_TEXT_BYTES) throw new Error(`${file} exceeds the maximum vault file size`);
  try {
    const text = utf8Decoder.decode(bytes);
    if (text.includes('\u0000')) throw new Error(`${file} contains a null character`);
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes('null character')) throw error;
    throw new Error(`${file} must contain valid UTF-8`);
  }
}

function readVaultJson(root: string, file: (typeof CONTENT_FILES)[number] | 'approval.json'): unknown {
  try {
    return JSON.parse(readVaultText(root, file));
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

function charterVersion(root: string): string {
  const matches = unfencedMarkdownLines(readVaultText(root, 'carta.md'))
    .map((line) => /^Versão da carta:\s*(\S+)\s*$/u.exec(line)?.[1])
    .filter((value): value is string => value !== undefined);
  if (matches.length !== 1 || !VERSION.test(matches[0])) {
    throw new Error('carta.md must declare exactly one valid Versão da carta');
  }
  return matches[0];
}

function latestChangelogVersion(root: string): string {
  let latest: string | undefined;
  for (const line of unfencedMarkdownLines(readVaultText(root, 'changelog.md'))) {
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
  assertPinned('minMediaSources', thresholds.minMediaSources, PINNED_THRESHOLDS.minMediaSources);
  assertPinned('maxItems', thresholds.maxItems, PINNED_THRESHOLDS.maxItems);
  assertPinned('topics', thresholds.topics, PINNED_THRESHOLDS.topics);
  assertPinned('events', thresholds.events, PINNED_THRESHOLDS.events);
}

export function computeCurationBundleHash(root: string = process.cwd()): string {
  const hash = createHash('sha256');
  for (const file of CONTENT_FILES) {
    hash.update(file, 'utf8');
    hash.update(Buffer.from([0]));
    hash.update(readFileSync(vaultPath(root, file)));
    hash.update(Buffer.from([0]));
  }
  return hash.digest('hex');
}

export function verifyGovernance(root: string = process.cwd()): void {
  const declaredCharterVersion = charterVersion(root);
  const declaredChangelogVersion = latestChangelogVersion(root);

  parseAllowlist(readVaultJson(root, 'allowlist.json'));
  const thresholds = parseThresholds(readVaultJson(root, 'thresholds.json'));
  parseCalendar(readVaultJson(root, 'calendario.json'));
  const lessons = parseLessons(readVaultJson(root, 'licoes.json'));
  const approval = parseApproval(readVaultJson(root, 'approval.json'));

  if (declaredCharterVersion !== declaredChangelogVersion || approval.charterVersion !== declaredCharterVersion) {
    throw new Error('approval.charterVersion must match both carta.md and the latest changelog.md entry');
  }

  const computedHash = computeCurationBundleHash(root);
  if (approval.bundleSha256 !== computedHash) {
    throw new Error('approval.bundleSha256 does not match the six-file curation bundle');
  }

  assertPinnedThresholds(thresholds);
  if (lessons.length !== 12) throw new Error('lessons must contain exactly twelve approved lessons');
  for (const lesson of lessons) {
    if (!guideSlugs.has(lesson.guideSlug)) throw new Error(`lesson ${lesson.id} references an unknown guideSlug`);
  }
}
