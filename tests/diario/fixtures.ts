import { createHash } from 'node:crypto';
import { buildBcbSnapshot, buildSelection, decideEdition } from '../../src/lib/diario/curate';
import type {
  AllowlistSource,
  BcbObservation,
  CollectedInputs,
  Edition,
  MeasuredKey,
  SourceCandidate,
  SourceRef,
  Thresholds,
  Vault,
} from '../../src/lib/diario/types';

export const DATE = '2026-11-23';
export const RETRIEVED_AT = '2026-11-23T22:00:00Z';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by-nd/4.0/';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function thresholds(): Thresholds {
  return {
    version: '1.0.0',
    timezone: 'America/Sao_Paulo',
    runLocal: '19:00',
    dollarAbsChangePct: 1,
    lessonWeekday: 1,
    maxLessonsPerIsoWeek: 1,
    lessonOnlyWhenQuiet: true,
    newsWindowHours: 24,
    minMediaSources: 2,
    maxItems: 3,
    topics: ['renda-fixa', 'juros', 'inflacao', 'cambio', 'bolsa-fiis', 'regulacao'],
    events: ['copom', 'ipca', 'igp-m', 'payroll', 'fomc'],
  };
}

function allowlistSource(
  id: string,
  kind: 'official' | 'media',
  host: string,
  licenseUrl?: string,
): AllowlistSource {
  return {
    id,
    publisher: id === 'bcb' ? 'Banco Central do Brasil' : id === 'the-conversation-brasil' ? 'The Conversation Brasil' : id,
    kind,
    enabled: true,
    feeds: [{ url: `https://${host}/feed`, topics: thresholds().topics }],
    ...(licenseUrl === undefined ? {} : { licenseUrl }),
  };
}

export function vault(): Vault {
  return {
    charterVersion: '1.0.2',
    allowlistVersion: '1.1.0',
    allowlist: [
      allowlistSource('bcb', 'official', 'www.bcb.gov.br'),
      allowlistSource('alpha', 'media', 'alpha.example.test'),
      allowlistSource('beta', 'media', 'beta.example.test'),
      allowlistSource('the-conversation-brasil', 'media', 'theconversation.com', LICENSE_URL),
    ],
    thresholds: thresholds(),
    calendar: [],
    lessons: [
      {
        id: 'licao-reserva',
        title: 'Reserva antes de buscar rentabilidade',
        body: 'A reserva de emergência protege o plano diante de imprevistos e preserva liquidez.',
        guideSlug: 'como-montar-reserva-de-emergencia',
      },
      {
        id: 'licao-orcamento',
        title: 'Automatize aportes ao receber',
        body: 'Separar uma parte da renda para o futuro torna o plano menos dependente do que sobra.',
        guideSlug: 'regra-50-30-20-orcamento-inteligente',
      },
    ],
    bundleSha256: 'a'.repeat(64),
    approval: {
      bundleSha256: 'a'.repeat(64),
      charterVersion: '1.0.2',
      approvedAt: '2026-11-23T21:00:00Z',
      approvedBy: 'Yury Figueiredo',
      instructionRef: 'docs/superpowers/plans/2026-11-23-diario-do-investidor.md',
    },
  };
}

export function observations(date = DATE): Partial<Record<MeasuredKey, BcbObservation[]>> {
  return {
    selic: [{ value: 13.75, date }],
    cdi: [{ value: 13.65, date: '2026-11-20' }],
    ipca12m: [{ value: 4.63, date: '2026-10-01' }],
    dolar: [
      { value: 5, date },
      { value: 4.99, date: '2026-11-20' },
    ],
  };
}

export function inputs(date = DATE): CollectedInputs {
  return {
    date,
    retrievedAt: date === DATE ? RETRIEVED_AT : `${date}T22:00:00Z`,
    bcb: observations(date),
    sources: [],
    events: [],
    lessons: vault().lessons,
    previousEditions: [],
  };
}

export function source(overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  const base: SourceCandidate = {
    id: 'fonte-bcb',
    sourceId: 'bcb',
    kind: 'official',
    publisher: 'Banco Central do Brasil',
    title: 'Copom mantém avaliação de juros',
    canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/copom',
    publishedAt: `${DATE}T10:00:00Z`,
    retrievedAt: RETRIEVED_AT,
    excerpt: 'O comunicado oficial descreve a avaliação atual da política monetária.',
    excerptSha256: '',
    ...overrides,
  };
  const excerpt = base.excerpt.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  return { ...base, excerpt, excerptSha256: sha256(excerpt) };
}

export function sourceForDate(date: string, overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return source({
    publishedAt: `${date}T10:00:00Z`,
    retrievedAt: `${date}T22:00:00Z`,
    ...overrides,
  });
}

export function mediaSource(id: 'alpha' | 'beta', overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return source({
    id: `fonte-${id}`,
    sourceId: id,
    kind: 'media',
    publisher: id,
    title: 'Copom e juros dominam o noticiário financeiro',
    canonicalUrl: `https://${id}.example.test/noticias/copom`,
    excerpt: 'O noticiário destaca a avaliação do Copom sobre juros e inflação.',
    ...overrides,
  });
}

export function mediaSourceForDate(
  date: string,
  id: 'alpha' | 'beta',
  overrides: Partial<SourceCandidate> = {},
): SourceCandidate {
  return mediaSource(id, {
    publishedAt: `${date}T10:00:00Z`,
    retrievedAt: `${date}T22:00:00Z`,
    ...overrides,
  });
}

export function conversationSource(overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return mediaSource('alpha', {
    id: 'fonte-conversation',
    sourceId: 'the-conversation-brasil',
    publisher: 'The Conversation Brasil',
    canonicalUrl: 'https://theconversation.com/br/copom-juros',
    author: 'Ana Silva',
    licenseUrl: LICENSE_URL,
    ...overrides,
  });
}

export function conversationSourceForDate(date: string, overrides: Partial<SourceCandidate> = {}): SourceCandidate {
  return conversationSource({
    publishedAt: `${date}T10:00:00Z`,
    retrievedAt: `${date}T22:00:00Z`,
    ...overrides,
  });
}

export function sourceRef(candidate: SourceCandidate): SourceRef {
  const { excerpt: _excerpt, excerptSha256: _hash, clusterId: _clusterId, topic: _topic, ...ref } = candidate as SourceCandidate & {
    clusterId?: string;
    topic?: string;
  };
  return ref;
}

export function publicPolicy(value: Vault): Edition['policy'] {
  const enabled = value.allowlist.filter((item) => item.enabled);
  return {
    charterVersion: value.charterVersion,
    allowlistVersion: value.allowlistVersion,
    thresholdsVersion: value.thresholds.version,
    sourceIds: enabled.map((item) => item.id).sort(),
    allowedHosts: [...new Set(enabled.flatMap((item) => item.feeds.map((feed) => new URL(feed.url).hostname)))].sort(),
  };
}

export function draft(date = DATE, collected = inputs(date), approvedVault = vault(), previous: Edition[] = []): Edition {
  const decision = decideEdition(collected, previous, approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, previous);
  const selected = selection.selectedSources[0];
  const lesson = decision.lessonId === undefined
    ? undefined
    : approvedVault.lessons.find((candidate) => candidate.id === decision.lessonId);
  const event = decision.eventId === undefined
    ? undefined
    : approvedVault.calendar.find((candidate) => candidate.id === decision.eventId);
  return {
    schemaVersion: 2,
    id: `diario-${date}`,
    date,
    generatedAt: collected.retrievedAt,
    title: decision.status === 'material' ? 'Copom atualiza a leitura da política monetária' : 'Mercado sem alteração relevante',
    summary: decision.status === 'material'
      ? 'A avaliação oficial foi contextualizada para investidores de renda fixa.'
      : 'Não houve alteração relevante que justificasse uma página datada.',
    snapshot: buildBcbSnapshot(collected, previous),
    decision,
    items: selected === undefined ? [] : [{
      id: 'noticia-copom',
      topic: selected.topic,
      headline: 'Copom divulga avaliação atual dos juros',
      summary: 'O comunicado oficial apresenta a leitura corrente do Banco Central.',
      whyItMatters: 'A avaliação ajuda a contextualizar o ambiente de juros sem indicar recomendação.',
      sourceIds: [selected.id],
    }],
    sources: selection.selectedSources.map(sourceRef),
    ...(lesson === undefined ? {} : { lesson }),
    ...(decision.status === 'material' ? {
      briefing: {
        whatHappened:
          'A curadoria identificou um fato novo que justifica uma leitura própria para a data. O conteúdo aprovado reúne o contexto necessário para entender o que mudou e por que o assunto merece atenção. A síntese permanece educacional, não antecipa desdobramentos e não apresenta recomendação de investimento.',
        whyItMatters:
          'O contexto ajuda o investidor a relacionar o fato com seus objetivos, prazo e tolerância a oscilações. A leitura educacional permite acompanhar mudanças com mais critério, sem transformar informação pública em promessa de resultado ou em indicação de compra e venda de ativos.',
        whatToWatch: [
          'Acompanhe os próximos comunicados oficiais e verifique se novas informações alteram o contexto apresentado nesta edição.',
          'Observe os desdobramentos relacionados ao tema e compare as fontes aprovadas antes de revisar o planejamento.',
        ],
      },
    } : {}),
    ...(event === undefined ? {} : { event }),
    relatedCalculatorSlug: 'juros-compostos',
    policy: publicPolicy(approvedVault),
    provenance: {
      generator: 'qoder-diario',
      promptVersion: '1.0.0',
      disclaimerKey: 'educacional-nao-e-recomendacao',
    },
  };
}

export function previousEdition(date: string, candidate = source()): Edition {
  const collected = inputs(date);
  collected.bcb = observations(date);
  collected.sources = [{
    ...candidate,
    publishedAt: `${date}T10:00:00Z`,
    retrievedAt: `${date}T12:00:00Z`,
  }];
  const value = draft(date, collected);
  value.sources = [sourceRef(collected.sources[0])];
  value.items[0].sourceIds = [collected.sources[0].id];
  return value;
}
