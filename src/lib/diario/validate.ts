import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildDeterministicBriefing } from './briefing';
import {
  buildBcbSnapshot,
  buildSelection,
  decideEdition,
  editorialPayload,
  historyIsValid,
  isCcByNd,
  normalizedText,
  publicPolicy,
  recentMaterialEditions,
  sourceMatchesAllowlist,
  sourceReference,
  textSimilarity,
} from './curate';
import { verifyGovernance } from './governance';
import {
  parseCalendarEvent,
  parseCollectedInputs,
  parseEdition,
  parseEditorialBriefing,
  parseSelection,
  parseSourceCandidate,
} from './schema';
import { isCalendarDate, parseCalendarDate } from './time';
import type { CollectedInputs, Edition, SelectedSourceEvidence, Selection, ValidationContext, Vault } from './types';

const MAX_JSON_BYTES = 5_000_000;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const EDITION_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/u;

type HistoryResult = { editions: Edition[]; unavailable: boolean };
export type CurationContext = {
  vault: Vault;
  collected: CollectedInputs;
  previousEditions: Edition[];
  historyUnavailable: boolean;
  root: string;
};

function readJson(path: string, label: string): unknown {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`${label} is missing: ${path}`);
    }
    throw error;
  }
  if (bytes.length > MAX_JSON_BYTES) throw new Error(`${label} exceeds the maximum size`);
  try {
    return JSON.parse(utf8Decoder.decode(bytes)) as unknown;
  } catch {
    throw new Error(`${label} must contain valid UTF-8 JSON: ${path}`);
  }
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function unavailableHistory(): HistoryResult {
  return { editions: [], unavailable: true };
}

export function loadPreviousEditions(date: string, root = process.cwd()): HistoryResult {
  parseCalendarDate(date, 'date');
  const directory = join(resolve(root), 'src/data/diario/edicoes');
  let files: string[];
  try {
    files = readdirSync(directory).sort();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { editions: [], unavailable: false };
    }
    throw error;
  }
  if (files.length === 0) return { editions: [], unavailable: false };

  const editions: Edition[] = [];
  const dates = new Set<string>();
  for (const file of files) {
    const match = EDITION_FILE.exec(file);
    if (!match || !isCalendarDate(match[1]) || match[1] >= date) return unavailableHistory();
    if (dates.has(match[1])) return unavailableHistory();
    try {
      const edition = parseEdition(readJson(join(directory, file), `edition ${file}`));
      if (edition.date !== match[1]) return unavailableHistory();
      editions.push(edition);
      dates.add(edition.date);
    } catch {
      return unavailableHistory();
    }
  }
  if (!historyIsValid(editions, date)) return unavailableHistory();

  let cursor = editions.map((edition) => edition.date).sort()[0];
  while (cursor < date) {
    if (!dates.has(cursor)) return unavailableHistory();
    cursor = nextDate(cursor);
  }
  return { editions, unavailable: false };
}

export function loadCurationContext(date: string, root = process.cwd()): CurationContext {
  parseCalendarDate(date, 'date');
  const resolvedRoot = resolve(root);
  const vault = verifyGovernance(resolvedRoot);
  const cache = join(resolvedRoot, '.cache/diario', date);
  const collected = parseCollectedInputs(readJson(join(cache, 'inputs.json'), 'inputs.json'));
  if (collected.date !== date) throw new Error(`Cached inputs must use the requested date ${date}`);
  const history = loadPreviousEditions(date, resolvedRoot);
  collected.previousEditions = history.editions;
  return {
    vault,
    collected,
    previousEditions: history.editions,
    historyUnavailable: history.unavailable,
    root: resolvedRoot,
  };
}

export function loadValidationContext(date: string, root = process.cwd()): ValidationContext {
  const curation = loadCurationContext(date, root);
  const selection = parseSelection(readJson(
    join(curation.root, '.cache/diario', date, 'selection.json'),
    'selection.json',
  ));
  if (selection.date !== date) throw new Error(`Cached selection must use the requested date ${date}`);
  return {
    vault: curation.vault,
    selection,
    evidence: curation.collected.sources,
    collected: curation.collected,
    previousEditions: curation.previousEditions,
    historyUnavailable: curation.historyUnavailable,
    root: curation.root,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(left, right);
}

function validateVault(context: ValidationContext): Vault {
  const vault = context.vault;
  if (vault.approval.bundleSha256 !== vault.bundleSha256 || vault.approval.charterVersion !== vault.charterVersion) {
    throw new Error('Vault governance approval does not match the curation bundle');
  }
  if (context.root) {
    const verified = verifyGovernance(context.root);
    if (!sameJson(verified, vault)) throw new Error('Vault governance changed after the validation context was loaded');
  }
  return vault;
}

function validateSources(edition: Edition, selection: Selection, vault: Vault): void {
  const selectedById = new Map(selection.selectedSources.map((source) => [source.id, source]));
  for (const [index, reference] of edition.sources.entries()) {
    const selected = selectedById.get(reference.id);
    if (!selected) throw new Error(`edition.sources[${index}] is outside selection.json`);
    if (!sourceMatchesAllowlist(selected, vault)) {
      throw new Error(`edition.sources[${index}] is not an enabled allowlisted source`);
    }
    const expected = sourceReference(selected);
    const comparableReference = {
      ...reference,
      ...(reference.publishedAt === null ? {} : { publishedAt: new Date(reference.publishedAt).toISOString() }),
      retrievedAt: new Date(reference.retrievedAt).toISOString(),
    };
    const comparableExpected = {
      ...expected,
      ...(expected.publishedAt === null ? {} : { publishedAt: new Date(expected.publishedAt).toISOString() }),
      retrievedAt: new Date(expected.retrievedAt).toISOString(),
    };
    if (!sameJson(comparableReference, comparableExpected)) {
      const changedField = [...new Set([...Object.keys(comparableExpected), ...Object.keys(comparableReference)])].find((key) =>
        !sameJson(comparableReference[key as keyof typeof comparableReference], comparableExpected[key as keyof typeof comparableExpected]),
      );
      throw new Error(`edition.sources[${index}].${changedField ?? 'metadata'} does not match allowlisted selection metadata`);
    }
  }

  for (const [itemIndex, item] of edition.items.entries()) {
    const sources = item.sourceIds.map((id) => selectedById.get(id));
    if (sources.some((source) => source === undefined)) {
      throw new Error(`edition.items[${itemIndex}] references a source outside selection.json`);
    }
    const selectedSources = sources as SelectedSourceEvidence[];
    if (selectedSources.length === 1 && isCcByNd(selectedSources[0].licenseUrl)) {
      throw new Error(`edition.items[${itemIndex}] uses a CC BY-ND excerpt as its only editorial base`);
    }
    const official = selectedSources.some((source) => source.kind === 'official');
    const independentPublishers = new Set(selectedSources.map((source) => normalizedText(source.publisher))).size;
    if (!official && independentPublishers < vault.thresholds.minMediaSources) {
      throw new Error(`edition.items[${itemIndex}] requires independent media publishers`);
    }
    if (selectedSources.some((source) => source.topic !== item.topic)) {
      throw new Error(`edition.items[${itemIndex}].topic does not match its selected evidence`);
    }
    if (new Set(selectedSources.map((source) => source.clusterId)).size !== 1) {
      throw new Error(`edition.items[${itemIndex}] must use sources from one selected cluster`);
    }
  }
}

function briefingSections(edition: Edition): string[] {
  if (edition.briefing === undefined) return [];
  const briefing = parseEditorialBriefing(edition.briefing);
  return [briefing.whatHappened, briefing.whyItMatters, ...briefing.whatToWatch];
}

function factualDifferential(edition: Edition) {
  return {
    reasonCodes: edition.decision.reasonCodes,
    eventId: edition.decision.eventId ?? null,
    lessonId: edition.decision.lessonId ?? null,
    measured: edition.snapshot.measured,
    dollarChangePct: edition.snapshot.dollarChangePct,
  };
}

function validateEvent(edition: Edition, vault: Vault): void {
  const eventId = edition.decision.eventId;
  if (eventId === undefined) {
    if (edition.event !== undefined) throw new Error('edition.event is forbidden when edition.decision.eventId is absent');
    return;
  }
  if (edition.event === undefined) throw new Error('edition.event is required when edition.decision.eventId exists');

  const event = parseCalendarEvent(edition.event, 'edition.event');
  if (event.date !== edition.date) throw new Error('edition.event.date must match edition.date');
  const approvedIndex = vault.calendar.findIndex((candidate) => candidate.id === eventId);
  if (approvedIndex < 0) throw new Error(`edition.event "${eventId}" is absent from the approved calendar`);
  const approved = parseCalendarEvent(vault.calendar[approvedIndex], `vault.calendar[${approvedIndex}]`);
  if (!sameJson(event, approved)) throw new Error(`edition.event "${eventId}" does not match the approved calendar`);
}

function validateDeterministicBriefing(edition: Edition, vault: Vault): void {
  if (edition.decision.status !== 'material' || edition.items.length > 0) return;
  const expected = buildDeterministicBriefing(edition, vault);
  if (edition.briefing === undefined || !sameJson(edition.briefing, expected)) {
    throw new Error('edition.briefing must match the deterministic briefing for a no-news material edition');
  }
}

function validateSubstantiveDelta(edition: Edition, previous: Edition[]): void {
  const payload = editorialPayload(edition);
  const recent = recentMaterialEditions(previous);
  for (const earlier of recent) {
    if (edition.items.length === 0 && earlier.items.length === 0) {
      if (sameJson(factualDifferential(edition), factualDifferential(earlier))) {
        throw new Error(`Edition factual differential is identical to ${earlier.id}`);
      }
      continue;
    }
    if (textSimilarity(payload, editorialPayload(earlier)) >= 0.80) {
      throw new Error(`Edition payload is materially similar to ${earlier.id}`);
    }
  }

  if (edition.items.length > 0) {
    const sections = briefingSections(edition).map(normalizedText);
    for (const earlier of recent) {
      const earlierSections = briefingSections(earlier).map(normalizedText);
      if (sections.some((section) => earlierSections.includes(section))) {
        throw new Error(`Edition briefing section duplicates ${earlier.id}`);
      }
    }
  }
}

export function validateEdition(value: unknown, context: ValidationContext): Edition {
  const edition = parseEdition(value);
  const collected = parseCollectedInputs(context.collected);
  const selection = parseSelection(context.selection);
  const evidence = context.evidence.map((source, index) => parseSourceCandidate(source, `evidence[${index}]`));
  const previous = context.previousEditions.map((entry) => parseEdition(entry));
  const vault = validateVault(context);

  if (collected.date !== edition.date || selection.date !== edition.date) {
    throw new Error('Edition, collected inputs and selection dates must match');
  }
  if (edition.id !== `diario-${edition.date}`) throw new Error('edition.id must match its date');
  if (Date.parse(edition.generatedAt) !== Date.parse(collected.retrievedAt)) {
    throw new Error('edition.generatedAt must match the collection timestamp');
  }
  if (!sameJson(collected.lessons, vault.lessons)) throw new Error('Collected lessons differ from the approved vault');
  if (!sameJson(evidence, collected.sources)) throw new Error('Validation evidence differs from collected sources');
  if (context.historyUnavailable && previous.length > 0) throw new Error('Unavailable history must not be treated as complete');
  if (!sameJson(edition.policy, publicPolicy(vault))) {
    throw new Error('edition.policy does not match the approved allowlist, charter and thresholds vault');
  }

  if (edition.decision.status === 'morno' && (edition.items.length > 0 || edition.sources.length > 0 || edition.lesson)) {
    throw new Error('A quiet edition must not contain news items, sources or a lesson');
  }
  if (edition.decision.newsClusterIds.length > 0 && (edition.items.length === 0 || edition.sources.length === 0)) {
    throw new Error('A news edition must retain the selected evidence in its items and sources');
  }
  validateSources(edition, selection, vault);

  if (edition.decision.lessonId) {
    const lesson = vault.lessons.find((candidate) => candidate.id === edition.decision.lessonId);
    if (!lesson) throw new Error('edition.decision.lessonId references an unapproved lesson');
    if (!edition.lesson || !sameJson(edition.lesson, lesson)) throw new Error('edition.lesson must match the approved lesson');
  } else if (edition.lesson) {
    throw new Error('edition.lesson is not authorized by the deterministic decision');
  }

  const expectedDecision = context.historyUnavailable
    ? { status: 'morno' as const, reasonCodes: ['history-unavailable' as const], newsClusterIds: [] }
    : decideEdition(collected, previous, vault);
  if (!sameJson(edition.decision, expectedDecision)) throw new Error('edition.decision does not match the deterministic curation decision');

  validateEvent(edition, vault);
  validateDeterministicBriefing(edition, vault);

  const expectedSelection = buildSelection(collected, expectedDecision, vault, previous);
  if (!sameJson(selection, expectedSelection)) throw new Error('selection.json does not match the deterministic selection');

  validateSubstantiveDelta(edition, previous);
  const expectedSnapshot = buildBcbSnapshot(collected, previous);
  if (!sameJson(edition.snapshot, expectedSnapshot)) throw new Error('edition.snapshot does not match collected BCB evidence');
  return edition;
}

export function validateAndPublish(date: string, root = process.cwd()): string {
  parseCalendarDate(date, 'date');
  const resolvedRoot = resolve(root);
  verifyGovernance(resolvedRoot);
  const path = join(resolvedRoot, 'src/data/diario/edicoes', `${date}.json`);
  if (existsSync(path)) throw new Error(`Edition already exists; refusing to overwrite ${date}`);

  const context = loadValidationContext(date, resolvedRoot);
  const draft = readJson(join(resolvedRoot, '.cache/diario', date, 'draft.json'), 'draft.json');
  const edition = validateEdition(draft, context);
  mkdirSync(join(path, '..'), { recursive: true });
  try {
    writeFileSync(path, `${JSON.stringify(edition, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`Edition already exists; refusing to overwrite ${date}`);
    }
    throw error;
  }
  return path;
}
