import { createHash } from 'node:crypto';
import { parseEdition as parseEditionForHistory, parseSourceCandidate } from './schema';
import { isCalendarDate, isoWeekKey } from './time';
import type {
  AllowlistSource,
  BcbObservation,
  BcbSnapshot,
  CollectedInputs,
  CurationDecision,
  Edition,
  MeasuredKey,
  ReasonCode,
  SelectedSourceEvidence,
  Selection,
  SourceCandidate,
  SourceRef,
  Topic,
  Vault,
} from './types';

const MEASURED_KEYS: readonly MeasuredKey[] = ['selic', 'cdi', 'ipca12m', 'dolar'];
const TRACKING_PARAMETER = /^(?:utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|referrer)$/iu;
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;
const CRYPTO_TERM = /\b(?:cripto(?:moedas?|ativos?)?|bitcoin|btc|ether|eth|stablecoins?|nfts?|web3)\b/iu;
const SIMILARITY_THRESHOLD = 0.80;
const RECENT_MATERIAL_LIMIT = 10;

const TOPIC_TERMS: Record<Topic, RegExp> = {
  juros: /\b(?:juros?|selic|copom|politica monetaria|taxa de juros|spread)\b/iu,
  inflacao: /\b(?:inflacao|ipca|incc|precos?|indice de precos|deflacao)\b/iu,
  cambio: /\b(?:cambio|dolar|moeda|cotacao)\b/iu,
  'bolsa-fiis': /\b(?:bolsa|ibovespa|fiis?|fundos? imobiliarios?|acoes?|dividendos?|b3)\b/iu,
  'renda-fixa': /\b(?:renda fixa|tesouro|cdb|lci|lca|debentures?|titulo publico|credito privado)\b/iu,
  regulacao: /\b(?:regulacao|regulador|fiscalizacao|compliance|cvm|fgc|bacen)\b/iu,
};

const EVENT_TOPICS: Record<string, Topic> = {
  copom: 'juros',
  ipca: 'inflacao',
  'igp-m': 'inflacao',
  payroll: 'renda-fixa',
  fomc: 'juros',
};

type NormalizedCandidate = SourceCandidate & { topic: Topic };
type NewsCluster = { id: string; topic: Topic; sources: NormalizedCandidate[] };

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedMetadata(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function normalizedText(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('pt-BR')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function shingles(value: string): Set<string> {
  const tokens = normalizedText(value).split(' ').filter(Boolean);
  if (tokens.length < 3) return new Set(tokens.length === 0 ? [] : [tokens.join(' ')]);
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - 3; index += 1) {
    result.add(tokens.slice(index, index + 3).join(' '));
  }
  return result;
}

export function textSimilarity(left: string, right: string): number {
  const leftShingles = shingles(left);
  const rightShingles = shingles(right);
  if (leftShingles.size === 0 || rightShingles.size === 0) return 0;
  let intersection = 0;
  for (const value of leftShingles) if (rightShingles.has(value)) intersection += 1;
  return intersection / (leftShingles.size + rightShingles.size - intersection);
}

export function canonicalizeUrl(value: string): string | null {
  if (value.length > 2048 || CONTROL_CHARACTER.test(value) || /[<>"\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const result = url.toString();
    return result.length <= 2048 ? result : null;
  } catch {
    return null;
  }
}

function normalizedTimestamp(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function isCcByNd(licenseUrl: string | undefined): boolean {
  if (!licenseUrl) return false;
  try {
    const url = new URL(licenseUrl);
    return url.protocol === 'https:' && url.hostname === 'creativecommons.org' && /\/by-nd\//iu.test(url.pathname);
  } catch {
    return false;
  }
}

export function sourceMatchesAllowlist(candidate: SourceCandidate, vault: Vault): boolean {
  const allowed = vault.allowlist.find((source) => source.id === candidate.sourceId);
  if (!allowed?.enabled || allowed.kind !== candidate.kind || allowed.publisher !== candidate.publisher) return false;
  if ((allowed.licenseUrl ?? null) !== (candidate.licenseUrl ?? null)) return false;
  try {
    const hostname = new URL(candidate.canonicalUrl).hostname;
    return allowed.feeds.some((feed) => new URL(feed.url).hostname === hostname);
  } catch {
    return false;
  }
}

function classifyTopic(title: string, excerpt: string): Topic | null {
  const text = normalizedText(`${title} ${excerpt}`);
  if (CRYPTO_TERM.test(text)) return null;
  const scores = (Object.entries(TOPIC_TERMS) as Array<[Topic, RegExp]>).map(([topic, pattern]) => ({
    topic,
    score: text.match(pattern)?.length ?? 0,
  }));
  scores.sort((left, right) => right.score - left.score);
  return scores[0]?.score ? scores[0].topic : null;
}

function normalizeCandidate(candidate: SourceCandidate, collected: CollectedInputs, vault: Vault): NormalizedCandidate | null {
  if (
    typeof candidate.title !== 'string' || typeof candidate.excerpt !== 'string' ||
    typeof candidate.publisher !== 'string' || typeof candidate.canonicalUrl !== 'string' ||
    typeof candidate.retrievedAt !== 'string' || CONTROL_CHARACTER.test(candidate.title) ||
    CONTROL_CHARACTER.test(candidate.excerpt)
  ) return null;

  const title = normalizedMetadata(candidate.title);
  const excerpt = normalizedMetadata(candidate.excerpt);
  const canonicalUrl = canonicalizeUrl(candidate.canonicalUrl);
  const retrievedAt = normalizedTimestamp(candidate.retrievedAt);
  const publishedAt = candidate.publishedAt === null ? null : normalizedTimestamp(candidate.publishedAt);
  const collectionTime = Date.parse(collected.retrievedAt);
  if (!title || !excerpt || !canonicalUrl || !retrievedAt || !Number.isFinite(collectionTime)) return null;
  if (candidate.publishedAt !== null && !publishedAt) return null;
  if (Date.parse(retrievedAt) > collectionTime || (publishedAt && Date.parse(publishedAt) > collectionTime)) return null;

  const normalized: SourceCandidate = {
    ...candidate,
    title,
    excerpt,
    canonicalUrl,
    publishedAt,
    retrievedAt,
    ...(candidate.author === undefined ? {} : { author: normalizedMetadata(candidate.author) }),
  };
  let parsed: SourceCandidate;
  try {
    parsed = parseSourceCandidate(normalized);
  } catch {
    return null;
  }
  if (parsed.excerptSha256 !== sha256(excerpt)) return null;
  if (!sourceMatchesAllowlist(parsed, vault) || isCcByNd(parsed.licenseUrl)) return null;
  const topic = classifyTopic(parsed.title, parsed.excerpt);
  if (!topic || !vault.thresholds.topics.includes(topic)) return null;
  if (!publishedAt) return null;
  const age = collectionTime - Date.parse(publishedAt);
  if (age < 0 || age > vault.thresholds.newsWindowHours * 3_600_000) return null;
  return { ...parsed, topic };
}

export function historyIsValid(previous: Edition[], date: string): boolean {
  if (!Array.isArray(previous) || !isCalendarDate(date)) return false;
  const dates = new Set<string>();
  const ids = new Set<string>();
  for (const edition of previous) {
    try {
      const valid = parseEditionForHistory(edition);
      if (valid.date >= date || dates.has(valid.date) || ids.has(valid.id)) return false;
      for (const measured of Object.values(valid.snapshot.measured)) {
        if (measured.observedOn > valid.date) return false;
      }
      dates.add(valid.date);
      ids.add(valid.id);
    } catch {
      return false;
    }
  }
  return true;
}

export function recentMaterialEditions(previous: Edition[]): Edition[] {
  return previous
    .filter((edition) => edition.decision.status === 'material')
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, RECENT_MATERIAL_LIMIT);
}

function latestObservation(observations: BcbObservation[] | undefined, date: string): BcbObservation | null {
  if (!observations) return null;
  const realized = observations
    .filter((observation) => isCalendarDate(observation.date) && observation.date <= date && Number.isFinite(observation.value))
    .sort((left, right) => right.date.localeCompare(left.date));
  if (realized.length === 0) return null;
  const latestDate = realized[0].date;
  const sameDate = realized.filter((observation) => observation.date === latestDate);
  if (sameDate.some((observation) => observation.value !== sameDate[0].value)) return null;
  return sameDate[0];
}

function previousMeasured(previous: Edition[], key: MeasuredKey, date: string) {
  const editions = [...previous].sort((left, right) => right.date.localeCompare(left.date));
  for (const edition of editions) {
    const measured = edition.snapshot.measured[key];
    if (measured && measured.observedOn < date) return measured;
  }
  return undefined;
}

export function buildBcbSnapshot(collected: CollectedInputs, previous: Edition[]): BcbSnapshot {
  const measured: BcbSnapshot['measured'] = {};
  const staleFields: MeasuredKey[] = [];
  for (const key of MEASURED_KEYS) {
    const current = latestObservation(collected.bcb[key], collected.date);
    const earlier = previousMeasured(previous, key, collected.date);
    if (current && (!earlier || current.date > earlier.observedOn)) {
      measured[key] = { value: current.value, observedOn: current.date, origin: 'bcb-sgs' };
    } else if (earlier) {
      measured[key] = { value: earlier.value, observedOn: earlier.observedOn, origin: 'stale' };
      staleFields.push(key);
    }
  }

  const latestDollar = latestObservation(collected.bcb.dolar, collected.date);
  const earlierDollarDates = latestDollar === null
    ? []
    : [...new Set((collected.bcb.dolar ?? [])
      .filter((observation) => isCalendarDate(observation.date) && observation.date < latestDollar.date && Number.isFinite(observation.value))
      .map((observation) => observation.date))].sort((left, right) => right.localeCompare(left));
  const priorDollarDate = earlierDollarDates[0];
  const priorDollarCandidates = (collected.bcb.dolar ?? [])
    .filter((observation) => observation.date === priorDollarDate && Number.isFinite(observation.value));
  const priorDollar = priorDollarCandidates.length > 0 && priorDollarCandidates.every(
    (observation) => observation.value === priorDollarCandidates[0].value,
  ) ? priorDollarCandidates[0] : null;
  let dollarChangePct: number | null = null;
  if (
    latestDollar && priorDollar && priorDollar.value !== 0 &&
    measured.dolar?.origin === 'bcb-sgs' &&
    measured.dolar.observedOn === latestDollar.date &&
    measured.dolar.value === latestDollar.value
  ) {
    dollarChangePct = (latestDollar.value - priorDollar.value) / priorDollar.value * 100;
  }

  const status = Object.keys(measured).length === 0
    ? 'unavailable'
    : staleFields.length > 0
      ? 'stale'
      : MEASURED_KEYS.some((key) => !measured[key])
        ? 'unavailable'
        : 'ok';
  return { status, measured, staleFields, dollarChangePct };
}

function duplicateCandidateIds(candidates: NormalizedCandidate[]): Set<string> {
  const duplicates = new Set<string>();
  for (let right = 0; right < candidates.length; right += 1) {
    for (let left = 0; left < right; left += 1) {
      if (candidates[left].sourceId !== candidates[right].sourceId) continue;
      if (
        candidates[left].canonicalUrl === candidates[right].canonicalUrl ||
        normalizedText(candidates[left].title) === normalizedText(candidates[right].title)
      ) {
        duplicates.add(candidates[left].id);
        duplicates.add(candidates[right].id);
      }
    }
  }
  return duplicates;
}

function clusterText(cluster: NewsCluster): string {
  return cluster.sources.map((source) => `${source.title} ${source.excerpt}`).join(' ');
}

function clustersRelated(left: NormalizedCandidate, right: NewsCluster): boolean {
  if (left.topic !== right.topic) return false;
  return right.sources.some((source) =>
    normalizedText(left.title) === normalizedText(source.title) ||
    textSimilarity(left.title, source.title) >= 0.50 ||
    textSimilarity(left.excerpt, source.excerpt) >= 0.60,
  );
}

function buildClusters(candidates: NormalizedCandidate[]): NewsCluster[] {
  const duplicates = duplicateCandidateIds(candidates);
  const clusters: NewsCluster[] = [];
  for (const candidate of candidates) {
    if (duplicates.has(candidate.id)) continue;
    if (candidate.kind === 'official') {
      clusters.push({ id: '', topic: candidate.topic, sources: [candidate] });
      continue;
    }
    const related = clusters.find((cluster) => cluster.sources[0].kind === 'media' && clustersRelated(candidate, cluster));
    if (related) related.sources.push(candidate);
    else clusters.push({ id: '', topic: candidate.topic, sources: [candidate] });
  }
  return clusters.map((cluster, index) => ({ ...cluster, id: `cluster-${index + 1}` }));
}

function clusterIsSufficient(cluster: NewsCluster, vault: Vault): boolean {
  if (cluster.sources.some((source) => source.kind === 'official')) return true;
  return new Set(cluster.sources.map((source) => normalizedText(source.publisher))).size >= vault.thresholds.minMediaSources;
}

function sourceRepeated(source: SourceCandidate, previous: Edition[]): boolean {
  return previous.some((edition) => edition.sources.some((earlier) =>
    canonicalizeUrl(earlier.canonicalUrl) === source.canonicalUrl ||
    normalizedText(earlier.title) === normalizedText(source.title),
  ));
}

function clusterIsDuplicate(cluster: NewsCluster, previous: Edition[]): boolean {
  if (cluster.sources.every((source) => sourceRepeated(source, previous))) return true;
  const aggregate = clusterText(cluster);
  return previous.some((edition) => edition.items.some((item) =>
    textSimilarity(aggregate, `${item.headline} ${item.summary} ${item.whyItMatters}`) >= SIMILARITY_THRESHOLD,
  ));
}

function selectClusters(inputs: CollectedInputs, previous: Edition[], vault: Vault): NewsCluster[] {
  const candidates = inputs.sources
    .map((source) => normalizeCandidate(source, inputs, vault))
    .filter((source): source is NormalizedCandidate => source !== null);
  return buildClusters(candidates)
    .filter((cluster) => clusterIsSufficient(cluster, vault) && !clusterIsDuplicate(cluster, previous))
    .slice(0, vault.thresholds.maxItems);
}

function eventKind(eventId: string, vault: Vault): string | undefined {
  return vault.thresholds.events.find((kind) => eventId.startsWith(`${kind}-`));
}

function approvedEvent(inputs: CollectedInputs, vault: Vault) {
  return inputs.events
    .filter((event) => event.date === inputs.date)
    .filter((event) => vault.calendar.some((approved) =>
      approved.id === event.id && approved.date === event.date && approved.title === event.title && approved.sourceUrl === event.sourceUrl,
    ))
    .filter((event) => eventKind(event.id, vault) !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

function eventHasNewEvidence(
  event: NonNullable<ReturnType<typeof approvedEvent>>,
  clusters: NewsCluster[],
  previous: Edition[],
  vault: Vault,
): boolean {
  const topic = EVENT_TOPICS[eventKind(event.id, vault)!];
  const priorEventEditions = previous.filter((edition) => edition.decision.eventId === event.id);
  const priorSources = priorEventEditions.flatMap((edition) => edition.sources);
  const priorEditorial = priorEventEditions.flatMap((edition) => edition.items.flatMap((item) => [
    item.headline, item.summary, item.whyItMatters,
  ]));
  return clusters.some((cluster) => cluster.topic === topic && cluster.sources.some((source) => {
    if (sourceRepeated(source, priorEventEditions)) return false;
    if (priorSources.some((earlier) =>
      textSimilarity(source.title, earlier.title) >= SIMILARITY_THRESHOLD ||
      textSimilarity(source.excerpt, earlier.title) >= SIMILARITY_THRESHOLD,
    )) return false;
    if (priorEditorial.some((text) => textSimilarity(source.excerpt, text) >= SIMILARITY_THRESHOLD)) return false;
    return true;
  }));
}

function lessonForQuietDay(inputs: CollectedInputs, previous: Edition[], vault: Vault): string | undefined {
  if (!vault.thresholds.lessonOnlyWhenQuiet) return undefined;
  const weekday = new Date(`${inputs.date}T00:00:00Z`).getUTCDay();
  if (weekday !== vault.thresholds.lessonWeekday) return undefined;
  const week = isoWeekKey(inputs.date);
  const lessonsThisWeek = previous.filter((edition) =>
    isoWeekKey(edition.date) === week && (edition.decision.lessonId ?? edition.lesson?.id),
  );
  if (lessonsThisWeek.length >= vault.thresholds.maxLessonsPerIsoWeek) return undefined;
  const usedIds = new Set(previous.map((edition) => edition.decision.lessonId ?? edition.lesson?.id).filter(Boolean));
  const priorLessons = previous.flatMap((edition) => edition.lesson ? [edition.lesson] : []);
  const lesson = vault.lessons.find((candidate) =>
    !usedIds.has(candidate.id) &&
    !priorLessons.some((earlier) =>
      textSimilarity(candidate.title, earlier.title) >= SIMILARITY_THRESHOLD ||
      textSimilarity(candidate.body, earlier.body) >= SIMILARITY_THRESHOLD,
    ),
  );
  return lesson?.id;
}

export function decideEdition(inputs: CollectedInputs, previous: Edition[], vault: Vault): CurationDecision {
  if (!historyIsValid(previous, inputs.date)) {
    return { status: 'morno', reasonCodes: ['history-unavailable'], newsClusterIds: [] };
  }

  const materialHistory = recentMaterialEditions(previous);
  const clusters = selectClusters(inputs, materialHistory, vault);
  const reasonCodes: ReasonCode[] = [];
  let eventId: string | undefined;
  const event = approvedEvent(inputs, vault);
  if (event) {
    const seen = previous.some((edition) => edition.decision.eventId === event.id);
    if (!seen || eventHasNewEvidence(event, clusters, previous, vault)) {
      reasonCodes.push('calendar-event');
      eventId = event.id;
    }
  }

  const snapshot = buildBcbSnapshot(inputs, previous);
  const latestDollar = latestObservation(inputs.bcb.dolar, inputs.date);
  if (
    snapshot.dollarChangePct !== null &&
    Math.abs(snapshot.dollarChangePct) >= vault.thresholds.dollarAbsChangePct &&
    latestDollar?.date === inputs.date &&
    snapshot.measured.dolar?.origin === 'bcb-sgs'
  ) {
    reasonCodes.push('dollar-trigger');
  }

  if (!eventId) {
    if (clusters.some((cluster) => cluster.sources.some((source) => source.kind === 'official'))) {
      reasonCodes.push('official-news');
    }
    if (clusters.some((cluster) => cluster.sources.every((source) => source.kind === 'media'))) {
      reasonCodes.push('corroborated-media-news');
    }
  }

  if (reasonCodes.length > 0) {
    return {
      status: 'material',
      reasonCodes,
      ...(eventId === undefined ? {} : { eventId }),
      newsClusterIds: clusters.map((cluster) => cluster.id),
    };
  }

  const lessonId = lessonForQuietDay(inputs, previous, vault);
  if (lessonId) {
    return { status: 'material', reasonCodes: ['monday-lesson'], lessonId, newsClusterIds: [] };
  }
  return { status: 'morno', reasonCodes: ['no-substantive-delta'], newsClusterIds: [] };
}

export function buildSelection(
  inputs: CollectedInputs,
  decision: CurationDecision,
  vault: Vault,
  previous: Edition[],
): Selection {
  if (decision.status === 'morno' || decision.reasonCodes.includes('history-unavailable')) {
    return { date: inputs.date, decision, clusters: [], selectedSources: [] };
  }
  const clusters = selectClusters(inputs, recentMaterialEditions(previous), vault)
    .filter((cluster) => decision.newsClusterIds.includes(cluster.id));
  return {
    date: inputs.date,
    decision,
    clusters: clusters.map((cluster) => ({
      id: cluster.id,
      topic: cluster.topic,
      sourceIds: cluster.sources.map((source) => source.id),
    })),
    selectedSources: clusters.flatMap((cluster) => cluster.sources.map((source) => ({
      ...source,
      clusterId: cluster.id,
      topic: cluster.topic,
    } satisfies SelectedSourceEvidence))),
    ...(decision.eventId === undefined ? {} : { eventId: decision.eventId }),
    ...(decision.lessonId === undefined ? {} : { lessonId: decision.lessonId }),
  };
}

export function publicPolicy(vault: Vault): Edition['policy'] {
  const enabled = vault.allowlist.filter((source) => source.enabled);
  return {
    charterVersion: vault.charterVersion,
    allowlistVersion: vault.allowlistVersion,
    thresholdsVersion: vault.thresholds.version,
    sourceIds: enabled.map((source) => source.id).sort(),
    allowedHosts: [...new Set(enabled.flatMap((source) => source.feeds.map((feed) => new URL(feed.url).hostname)))].sort(),
  };
}

export function sourceReference(source: SourceCandidate): SourceRef {
  const { excerpt: _excerpt, excerptSha256: _hash, clusterId: _clusterId, topic: _topic, ...reference } =
    source as SourceCandidate & { clusterId?: string; topic?: Topic };
  return reference;
}
