export type Topic = 'renda-fixa' | 'juros' | 'inflacao' | 'cambio' | 'bolsa-fiis' | 'regulacao';

export type MeasuredKey = 'selic' | 'cdi' | 'ipca12m' | 'dolar';

export type ReasonCode =
  | 'calendar-event'
  | 'dollar-trigger'
  | 'official-news'
  | 'corroborated-media-news'
  | 'monday-lesson'
  | 'no-substantive-delta'
  | 'history-unavailable';

export type CalendarEventKind = 'copom' | 'ipca' | 'igp-m' | 'payroll' | 'fomc';

export interface AllowlistFeed {
  url: string;
  topics: Topic[];
}

export interface AllowlistSource {
  id: string;
  publisher: string;
  kind: 'official' | 'media';
  feeds: AllowlistFeed[];
  enabled: boolean;
  termsUrl?: string;
  licenseUrl?: string;
}

export interface Thresholds {
  version: string;
  timezone: 'America/Sao_Paulo';
  runLocal: '19:00';
  dollarAbsChangePct: number;
  lessonWeekday: number;
  maxLessonsPerIsoWeek: number;
  lessonOnlyWhenQuiet: boolean;
  newsWindowHours: number;
  minMediaSources: number;
  maxItems: number;
  topics: Topic[];
  events: CalendarEventKind[];
}

export interface SourceRef {
  id: string;
  sourceId: string;
  kind: 'official' | 'media';
  publisher: string;
  title: string;
  canonicalUrl: string;
  publishedAt: string | null;
  retrievedAt: string;
  author?: string;
  licenseUrl?: string;
}

export interface SourceCandidate extends SourceRef {
  excerpt: string;
  excerptSha256: string;
}

export interface SelectedSourceEvidence extends SourceCandidate {
  clusterId: string;
  topic: Topic;
}

export interface Selection {
  date: string;
  decision: CurationDecision;
  clusters: { id: string; topic: Topic; sourceIds: string[] }[];
  selectedSources: SelectedSourceEvidence[];
  eventId?: string;
  lessonId?: string;
}

export interface NewsItem {
  id: string;
  topic: Topic;
  headline: string;
  summary: string;
  whyItMatters: string;
  sourceIds: string[];
}

export interface Lesson {
  id: string;
  title: string;
  body: string;
  guideSlug: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  sourceUrl: string;
}

export interface BcbObservation {
  value: number;
  date: string;
}

export interface MeasuredValue {
  value: number;
  observedOn: string;
  origin: 'bcb-sgs' | 'stale' | 'unavailable';
}

export interface BcbSnapshot {
  status: 'ok' | 'stale' | 'unavailable';
  measured: Partial<Record<MeasuredKey, MeasuredValue>>;
  staleFields: MeasuredKey[];
  dollarChangePct: number | null;
}

export interface CurationDecision {
  status: 'material' | 'morno';
  reasonCodes: ReasonCode[];
  eventId?: string;
  lessonId?: string;
  newsClusterIds: string[];
}

export interface Edition {
  schemaVersion: 1;
  id: string;
  date: string;
  generatedAt: string;
  title: string;
  summary: string;
  snapshot: BcbSnapshot;
  decision: CurationDecision;
  items: NewsItem[];
  lesson?: Lesson;
  sources: SourceRef[];
  relatedCalculatorSlug: string;
  policy: {
    charterVersion: string;
    allowlistVersion: string;
    thresholdsVersion: string;
    sourceIds: string[];
    allowedHosts: string[];
  };
  provenance: {
    generator: 'qoder-diario';
    promptVersion: string;
    disclaimerKey: 'educacional-nao-e-recomendacao';
  };
}

export interface Approval {
  bundleSha256: string;
  charterVersion: string;
  approvedAt: string;
  approvedBy: string;
  instructionRef: string;
}

export interface Vault {
  charterVersion: string;
  allowlistVersion: string;
  allowlist: AllowlistSource[];
  thresholds: Thresholds;
  calendar: CalendarEvent[];
  lessons: Lesson[];
  bundleSha256: string;
  approval: Approval;
}

export interface CollectedInputs {
  date: string;
  retrievedAt: string;
  bcb: Partial<Record<MeasuredKey, BcbObservation[]>>;
  sources: SourceCandidate[];
  events: CalendarEvent[];
  lessons: Lesson[];
  previousEditions: Edition[];
}

export interface ValidationContext {
  vault: Vault;
  selection: Selection;
  evidence: SourceCandidate[];
  collected: CollectedInputs;
  previousEditions: Edition[];
  root?: string;
}

export interface CollectOptions {
  root?: string;
  now?: Date;
  fetch?: typeof fetch;
}
