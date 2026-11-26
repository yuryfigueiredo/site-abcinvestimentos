import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDeterministicBriefing } from '../../src/lib/diario/briefing';
import { buildBcbSnapshot, buildSelection, decideEdition } from '../../src/lib/diario/curate';
import * as curation from '../../src/lib/diario/curate';
import { computeCurationBundleHash, verifyGovernance } from '../../src/lib/diario/governance';
import { parseEdition, parseSelection } from '../../src/lib/diario/schema';
import type { CollectedInputs, Edition, EditorialBriefing, Selection, Vault } from '../../src/lib/diario/types';
import {
  loadPreviousEditions,
  loadValidationContext,
  validateAndPublish,
  validateEdition,
} from '../../src/lib/diario/validate';
import {
  DATE,
  LICENSE_URL,
  RETRIEVED_AT,
  conversationSourceForDate,
  draft,
  inputs,
  mediaSourceForDate,
  previousEdition,
  source,
  sourceForDate,
  sourceRef,
  vault,
} from './fixtures';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function context() {
  const collected = inputs();
  collected.sources = [source()];
  const approvedVault = vault();
  const decision = decideEdition(collected, [], approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, []);
  const value = draft(DATE, collected, approvedVault);
  return {
    value,
    context: {
      vault: approvedVault,
      selection,
      evidence: collected.sources,
      collected,
      previousEditions: [] as Edition[],
    },
  };
}

function quietContext(date = '2026-11-24') {
  const collected = inputs(date);
  const approvedVault = vault();
  const decision = decideEdition(collected, [], approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, []);
  const value = draft(date, collected, approvedVault);
  return {
    value,
    context: {
      vault: approvedVault,
      selection,
      evidence: [],
      collected,
      previousEditions: [] as Edition[],
    },
  };
}

function noNewsContext(date = '2026-11-24', previous: Edition[] = []) {
  const collected = inputs(date);
  collected.bcb.dolar = [
    { value: 5.05, date },
    { value: 4.99, date: '2026-11-20' },
  ];
  const approvedVault = vault();
  const decision = decideEdition(collected, previous, approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, previous);
  const value = draft(date, collected, approvedVault, previous);
  return {
    value,
    context: {
      vault: approvedVault,
      selection,
      evidence: [],
      collected,
      previousEditions: previous,
    },
  };
}

function eventContext() {
  const collected = inputs('2026-11-24');
  const event = {
    id: 'copom-2026-11-24',
    date: '2026-11-24',
    title: 'Reunião do Copom',
    sourceUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/copom',
  };
  collected.events = [event];
  const approvedVault = vault();
  approvedVault.calendar = [event];
  const decision = decideEdition(collected, [], approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, []);
  const value = draft('2026-11-24', collected, approvedVault);
  value.event = { ...event };
  return { value, event, context: { vault: approvedVault, selection, evidence: [], collected, previousEditions: [] as Edition[] } };
}

function newsContext(previous: Edition[] = []) {
  const collected = inputs('2026-11-24');
  collected.sources = [sourceForDate('2026-11-24', {
    id: 'fonte-noticia-nova',
    title: 'Copom publica nova avaliação sobre liquidez',
    canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/nova-liquidez',
    excerpt: 'A nova nota oficial acrescenta critérios de liquidez ao comunicado e orienta o acompanhamento da política monetária.',
  })];
  const approvedVault = vault();
  const decision = decideEdition(collected, previous, approvedVault);
  const selection = buildSelection(collected, decision, approvedVault, previous);
  const value = draft('2026-11-24', collected, approvedVault, previous);
  return { value, context: { vault: approvedVault, selection, evidence: collected.sources, collected, previousEditions: previous } };
}

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-validate-'));
  roots.push(root);
  cpSync(join(process.cwd(), 'src/data/diario/curadoria'), join(root, 'src/data/diario/curadoria'), { recursive: true });
  const approvalPath = join(root, 'src/data/diario/curadoria/approval.json');
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as Record<string, unknown>;
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');
  return root;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRun(root: string, date: string, collected: CollectedInputs, selection: Selection, value: Edition): void {
  const cache = join(root, '.cache/diario', date);
  writeJson(join(cache, 'inputs.json'), collected);
  writeJson(join(cache, 'selection.json'), selection);
  writeJson(join(cache, 'draft.json'), value);
}

function materialSelection(collected: CollectedInputs, approvedVault: Vault): Selection {
  return buildSelection(collected, {
    status: 'material',
    reasonCodes: ['corroborated-media-news'],
    newsClusterIds: ['cluster-media'],
  }, approvedVault, []);
}

function materialBriefing(): EditorialBriefing {
  return {
    whatHappened:
      'A curadoria identificou um fato novo que justifica uma leitura própria para a data. O conteúdo aprovado reúne o contexto necessário para entender o que mudou e por que o assunto merece atenção. A síntese permanece educacional, não antecipa desdobramentos e não apresenta recomendação de investimento.',
    whyItMatters:
      'O contexto ajuda o investidor a relacionar o fato com seus objetivos, prazo e tolerância a oscilações. A leitura educacional permite acompanhar mudanças com mais critério, sem transformar informação pública em promessa de resultado ou em indicação de compra e venda de ativos.',
    whatToWatch: [
      'Acompanhe os próximos comunicados oficiais e verifique se novas informações alteram o contexto apresentado nesta edição.',
      'Observe os desdobramentos relacionados ao tema e compare as fontes aprovadas antes de revisar o planejamento.',
    ],
  };
}

function priorNewsBriefing(): EditorialBriefing {
  return {
    whatHappened:
      'A edição anterior registrou um comunicado oficial sobre juros e manteve a análise restrita aos fatos então disponíveis. O resumo explicou o contexto sem antecipar resultados e separou a leitura educacional de qualquer recomendação de investimento.',
    whyItMatters:
      'A leitura anterior relacionou a comunicação oficial ao planejamento financeiro, considerando objetivos, prazo, liquidez e tolerância a oscilações. O conteúdo permaneceu educacional e não apresentou promessa de resultado ou indicação de compra e venda.',
    whatToWatch: [
      'Acompanhe os comunicados oficiais e compare o contexto novo com a leitura anterior antes de revisar o planejamento.',
      'Observe os próximos desdobramentos e mantenha a análise separada de decisões individuais de investimento.',
    ],
  };
}

describe('parseSelection', () => {
  it('accepts normalized selected evidence with attribution', () => {
    const { context: value } = context();
    value.selection.selectedSources[0].author = 'Ana Silva';

    expect(parseSelection(value.selection)).toEqual(value.selection);
  });

  it('rejects unknown fields and a stale excerpt hash', () => {
    const { context: value } = context();
    expect(() => parseSelection({ ...value.selection, extra: true })).toThrow(/unknown field/i);

    value.selection.selectedSources[0].excerpt = 'Evidência alterada após o cálculo do hash.';
    expect(() => parseSelection(value.selection)).toThrow(/excerptSha256|hash/i);
  });
});

describe('validateEdition', () => {
  it('accepts a grounded material edition', () => {
    const { value, context: validation } = context();

    expect(validateEdition(value, validation)).toEqual(value);
  });

  it('rejects a news edition that drops all selected evidence', () => {
    const { value, context: validation } = context();
    value.items = [];
    value.sources = [];

    expect(() => validateEdition(value, validation)).toThrow(/news|evidence|items|sources/i);
  });

  it('rejects a collection date that differs from the BRT retrieval date', () => {
    const { value, context: validation } = quietContext();
    validation.collected.retrievedAt = '2026-11-23T22:00:00Z';
    value.generatedAt = validation.collected.retrievedAt;

    expect(() => validateEdition(value, validation)).toThrow(/date|retrievedAt/i);
  });

  it('accepts a quiet edition without inventing a dated news item', () => {
    const { value, context: validation } = quietContext();

    expect(validateEdition(value, validation)).toEqual(value);
  });

  it('rejects a deterministic briefing that differs from the approved facts', () => {
    const { value, context: validation } = noNewsContext();
    value.briefing = materialBriefing();

    expect(() => validateEdition(value, validation)).toThrow(/briefing|deterministic/i);
  });

  it('rejects a news briefing copied from a recent material edition', () => {
    const previous = previousEdition('2026-11-23');
    previous.briefing = priorNewsBriefing();
    const { value, context: validation } = newsContext([previous]);
    value.title = 'Nova avaliação de liquidez altera o acompanhamento';
    value.summary = 'A nota complementar apresenta critérios adicionais para a leitura educacional do mercado.';
    value.items[0].headline = 'Copom detalha critérios de liquidez';
    value.items[0].summary = 'A comunicação oficial acrescenta elementos de acompanhamento ao contexto dos juros.';
    value.items[0].whyItMatters = 'O investidor pode relacionar os novos critérios ao planejamento sem tratá-los como recomendação.';
    value.briefing!.whatHappened = previous.briefing!.whatHappened;

    expect(() => validateEdition(value, validation)).toThrow(/briefing|section|duplicate|delta/i);
  });

  it('rejects an event that does not match the approved calendar', () => {
    const { value, context: validation } = eventContext();
    value.event!.title = 'Reunião alterada do Copom';

    expect(() => validateEdition(value, validation)).toThrow(/event|calendar/i);
  });

  it('rejects an event date that differs from the edition date', () => {
    const { value, context: validation } = eventContext();
    value.event!.date = '2026-11-23';

    expect(() => validateEdition(value, validation)).toThrow(/event.*date|date.*event/i);
  });

  it('allows recurring deterministic explanations when the factual differential changes', () => {
    const previousCollected = inputs('2026-11-23');
    previousCollected.bcb.dolar = [
      { value: 5.05, date: '2026-11-23' },
      { value: 4.99, date: '2026-11-20' },
    ];
    const previous = draft('2026-11-23', previousCollected, vault());
    const { value, context: validation } = noNewsContext('2026-11-24', [previous]);

    expect(value.briefing).toEqual(previous.briefing);
    expect(validateEdition(value, validation)).toEqual(value);
  });

  it('rejects repeated no-news material editions with the same factual differential', () => {
    const { value: previous, context: previousContext } = noNewsContext('2026-11-23');
    const measured: Edition['snapshot']['measured'] = {
      selic: { value: 13.75, observedOn: '2026-11-20', origin: 'stale' },
      cdi: { value: 13.65, observedOn: '2026-11-20', origin: 'stale' },
      ipca12m: { value: 4.63, observedOn: '2026-10-01', origin: 'stale' },
      dolar: { value: 5, observedOn: '2026-11-20', origin: 'stale' },
    };
    const staleFields: Edition['snapshot']['staleFields'] = ['selic', 'cdi', 'ipca12m', 'dolar'];
    previous.snapshot = { status: 'stale', measured, staleFields, dollarChangePct: null };
    previous.decision = { status: 'material', reasonCodes: ['dollar-trigger'], newsClusterIds: [] };
    previous.briefing = buildDeterministicBriefing(previous, previousContext.vault);

    const collected = inputs('2026-11-24');
    collected.bcb = {};
    const decision = previous.decision;
    const selection = buildSelection(collected, decision, previousContext.vault, [previous]);
    const snapshot = buildBcbSnapshot(collected, [previous]);
    const base = {
      ...previous,
      id: 'diario-2026-11-24',
      date: '2026-11-24',
      generatedAt: collected.retrievedAt,
      title: 'O investidor acompanha o câmbio com prudência',
      summary: 'A leitura educacional destaca liquidez e planejamento sem antecipar movimentos futuros.',
      snapshot,
      decision,
    };
    const value: Edition = { ...base, briefing: buildDeterministicBriefing(base, previousContext.vault) };
    const validation = {
      vault: previousContext.vault,
      selection,
      evidence: [],
      collected,
      previousEditions: [previous],
    };
    expect(value.snapshot).toEqual(previous.snapshot);

    const decisionSpy = vi.spyOn(curation, 'decideEdition').mockReturnValue(decision);
    try {
      expect(() => validateEdition(value, validation)).toThrow(/factual|differential|duplicate|delta/i);
    } finally {
      decisionSpy.mockRestore();
    }
  });

  it('rejects a snapshot that does not match the collected BCB evidence', () => {
    const { value, context: validation } = context();
    value.snapshot.measured.selic!.value += 1;

    expect(() => validateEdition(value, validation)).toThrow(/snapshot/i);
  });

  it('rejects a future observation presented as realized', () => {
    const { value, context: validation } = quietContext();
    validation.collected.bcb.selic = [{ value: 99, date: '2026-11-25' }];
    value.snapshot.measured.selic = { value: 99, observedOn: '2026-11-25', origin: 'bcb-sgs' };

    expect(() => validateEdition(value, validation)).toThrow(/snapshot/i);
  });

  it('accepts stale data only when it copies the previous observation and remains labeled', () => {
    const previous = previousEdition('2026-11-23');
    const { value, context: validation } = quietContext();
    validation.previousEditions = [previous];
    validation.collected.bcb.dolar = [];
    value.snapshot = draft('2026-11-24', validation.collected, validation.vault, [previous]).snapshot;

    expect(validateEdition(value, validation).snapshot.measured.dolar?.origin).toBe('stale');

    value.snapshot.measured.dolar!.origin = 'bcb-sgs';
    expect(() => validateEdition(value, validation)).toThrow(/snapshot/i);
  });

  it('rejects an item with no source', () => {
    const { value, context: validation } = context();
    value.items[0].sourceIds = [];

    expect(() => validateEdition(value, validation)).toThrow(/sourceIds|source/i);
  });

  it('rejects an item that uses a source outside the selection', () => {
    const { value, context: validation } = context();
    value.items[0].sourceIds = ['fonte-nao-selecionada'];
    value.sources.push(sourceRef(source({ id: 'fonte-nao-selecionada' })));

    expect(() => validateEdition(value, validation)).toThrow(/selection/i);
  });

  it('rejects one media publisher even when it has multiple selected articles', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha', { canonicalUrl: 'https://alpha.example.test/noticias/1' }),
      mediaSourceForDate('2026-11-24', 'alpha', { id: 'fonte-alpha-2', canonicalUrl: 'https://alpha.example.test/noticias/2' }),
    ];
    const approvedVault = vault();
    const selection = materialSelection(collected, approvedVault);
    selection.clusters = [{ id: 'cluster-media', topic: 'juros', sourceIds: collected.sources.map((item) => item.id) }];
    selection.selectedSources = collected.sources.map((item) => ({ ...item, clusterId: 'cluster-media', topic: 'juros' as const }));
    const value = draft('2026-11-24', collected, approvedVault);
    value.decision = selection.decision;
    value.briefing = materialBriefing();
    value.items = [{
      id: 'noticia-media',
      topic: 'juros',
      headline: 'Veículo único publica duas matérias sobre juros',
      summary: 'As duas matérias pertencem ao mesmo veículo e não corroboram entre si.',
      whyItMatters: 'A independência editorial é necessária para tratar o fato como confirmado.',
      sourceIds: collected.sources.map((item) => item.id),
    }];
    value.sources = collected.sources.map(sourceRef);

    expect(() => validateEdition(value, {
      vault: approvedVault,
      selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toThrow(/independent|publishers|media/i);
  });

  it('rejects two allowlist IDs that belong to the same media publisher', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha'),
      mediaSourceForDate('2026-11-24', 'beta', { sourceId: 'beta-alias', publisher: 'alpha' }),
    ];
    const approvedVault = vault();
    const beta = approvedVault.allowlist.find((item) => item.id === 'beta')!;
    beta.id = 'beta-alias';
    beta.publisher = 'alpha';
    const selection = materialSelection(collected, approvedVault);
    selection.clusters = [{ id: 'cluster-media', topic: 'juros', sourceIds: collected.sources.map((item) => item.id) }];
    selection.selectedSources = collected.sources.map((item) => ({ ...item, clusterId: 'cluster-media', topic: 'juros' as const }));
    const value = draft('2026-11-24', collected, approvedVault);
    value.decision = selection.decision;
    value.briefing = materialBriefing();
    value.items = [{
      id: 'noticia-media',
      topic: 'juros',
      headline: 'Duas contas do mesmo veículo não corroboram a notícia',
      summary: 'A independência editorial depende do publisher, não do identificador do feed.',
      whyItMatters: 'O portão precisa contar veículos independentes antes de publicar a matéria.',
      sourceIds: collected.sources.map((item) => item.id),
    }];
    value.sources = collected.sources.map(sourceRef);

    expect(() => validateEdition(value, {
      vault: approvedVault,
      selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toThrow(/independent|publishers|media/i);
  });

  it('accepts corroborated media from two independent publishers', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha'),
      mediaSourceForDate('2026-11-24', 'beta'),
    ];
    const approvedVault = vault();
    const decision = decideEdition(collected, [], approvedVault);
    const selection = buildSelection(collected, decision, approvedVault, []);
    const value = draft('2026-11-24', collected, approvedVault);
    value.items[0].sourceIds = collected.sources.map((item) => item.id);
    value.sources = collected.sources.map(sourceRef);

    expect(validateEdition(value, {
      vault: approvedVault,
      selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toEqual(value);
  });

  it('rejects a rewritten NewsItem based only on a CC BY-ND source', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [conversationSourceForDate('2026-11-24')];
    const approvedVault = vault();
    const selection = materialSelection(collected, approvedVault);
    selection.clusters = [{ id: 'cluster-media', topic: 'juros', sourceIds: [collected.sources[0].id] }];
    selection.selectedSources = [{ ...collected.sources[0], clusterId: 'cluster-media', topic: 'juros' }];
    const value = draft('2026-11-24', collected, approvedVault);
    value.decision = selection.decision;
    value.briefing = materialBriefing();
    value.items = [{
      id: 'noticia-nd',
      topic: 'juros',
      headline: 'Análise de juros vira notícia autoral',
      summary: 'O texto reescreve o excerpt de uma obra protegida por licença sem derivados.',
      whyItMatters: 'A licença exige citação literal e atribuição completa, não paráfrase.',
      sourceIds: [collected.sources[0].id],
    }];
    value.sources = collected.sources.map(sourceRef);

    expect(() => validateEdition(value, {
      vault: approvedVault,
      selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toThrow(/CC BY-ND|only base|deriv/i);
  });

  it('rejects digits and HTML in editorial prose', () => {
    const { value, context: validation } = context();
    value.items[0].summary = 'O Copom manteve a taxa em 13,75%.';
    expect(() => validateEdition(value, validation)).toThrow(/digits/i);

    value.items[0].summary = 'O Copom manteve a taxa <forte>inalterada</forte>.';
    expect(() => validateEdition(value, validation)).toThrow(/HTML/i);
  });

  it('rejects a material or quiet status that was not recomputed from evidence', () => {
    const { value, context: validation } = quietContext();
    value.decision.status = 'material';
    value.briefing = buildDeterministicBriefing(value, validation.vault);

    expect(() => validateEdition(value, validation)).toThrow(/decision|status/i);
  });

  it('rejects policy versions or source sets that diverge from the approved vault', () => {
    const { value, context: validation } = context();
    value.policy.charterVersion = '9.9.9';

    expect(() => validateEdition(value, validation)).toThrow(/policy|charter/i);
  });

  it('rejects a disabled or unknown allowlist source', () => {
    const { value, context: validation } = context();
    validation.vault.allowlist.find((item) => item.id === 'bcb')!.enabled = false;

    expect(() => validateEdition(value, validation)).toThrow(/allowlist|disabled|unknown/i);
  });

  it('rejects source metadata that does not match the allowlist', () => {
    const { value, context: validation } = context();
    value.sources[0].publisher = 'Outro publisher';

    expect(() => validateEdition(value, validation)).toThrow(/publisher|allowlist/i);
  });

  it('rejects an invented license URL', () => {
    const { value, context: validation } = context();
    value.sources[0].licenseUrl = LICENSE_URL;

    expect(() => validateEdition(value, validation)).toThrow(/licenseUrl|license/i);
  });

  it('preserves verified author and non-derivative license metadata', () => {
    const { value, context: validation } = context();
    const licenseUrl = 'https://www.bcb.gov.br/acessoinformacao/licenca';
    validation.vault.allowlist.find((item) => item.id === 'bcb')!.licenseUrl = licenseUrl;
    validation.collected.sources[0].author = 'Ana Silva';
    validation.collected.sources[0].licenseUrl = licenseUrl;
    validation.evidence = validation.collected.sources;
    validation.selection = buildSelection(validation.collected, validation.selection.decision, validation.vault, []);
    value.sources = validation.selection.selectedSources.map(sourceRef);

    expect(validateEdition(value, validation).sources[0]).toMatchObject({ author: 'Ana Silva', licenseUrl });
  });

  it('rejects selection evidence that changed after hashing', () => {
    const { value, context: validation } = context();
    validation.selection.selectedSources[0].excerpt = 'Trecho alterado sem atualizar o hash.';

    expect(() => validateEdition(value, validation)).toThrow(/excerptSha256|hash/i);
  });

  it('rejects evidence that differs from the collected source', () => {
    const { value, context: validation } = context();
    validation.evidence = [{ ...validation.evidence[0], title: 'Título diferente da coleta' }];

    expect(() => validateEdition(value, validation)).toThrow(/evidence|collected/i);
  });

  it('rejects a materially similar editorial payload', () => {
    const previous = previousEdition('2026-11-22', source({
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/anterior',
      title: 'Copom publica avaliação anterior',
      excerpt: 'O comunicado anterior trazia a avaliação então vigente do Banco Central.',
    }));
    previous.title = 'Leitura monetária permanece em cautela';
    previous.summary = 'O Banco Central mantém uma avaliação cautelosa para a condução da política monetária.';
    previous.items[0].headline = 'Política monetária exige leitura cautelosa';
    previous.items[0].summary = 'A decisão do Copom continua alinhada à avaliação cautelosa do Banco Central.';
    previous.items[0].whyItMatters = 'Investidores de renda fixa devem acompanhar a comunicação oficial sem tratá-la como recomendação.';

    const { value, context: validation } = context();
    validation.previousEditions = [previous];
    value.title = previous.title;
    value.summary = previous.summary;
    value.items[0].headline = previous.items[0].headline;
    value.items[0].summary = previous.items[0].summary;
    value.items[0].whyItMatters = previous.items[0].whyItMatters;

    expect(() => validateEdition(value, validation)).toThrow(/similar|duplicate|delta/i);
  });

  it('rejects a repeated source even if the draft still claims materiality', () => {
    const previous = previousEdition('2026-11-22');
    const { value, context: validation } = context();
    validation.previousEditions = [previous];

    expect(() => validateEdition(value, validation)).toThrow(/decision|duplicate|delta/i);
  });

  it('rejects an unapproved or repeated lesson', () => {
    const previous = withLesson('2026-11-16', 'licao-reserva');
    const { value, context: validation } = quietContext();
    validation.previousEditions = [previous];
    validation.selection = buildSelection(
      validation.collected,
      decideEdition(validation.collected, [previous], validation.vault),
      validation.vault,
      [previous],
    );
    value.decision = validation.selection.decision;
    value.lesson = validation.vault.lessons[0];
    value.snapshot = draft('2026-11-24', validation.collected, validation.vault, [previous]).snapshot;

    expect(() => validateEdition(value, validation)).toThrow(/lesson/i);
  });

  it('rejects news items on a quiet edition', () => {
    const { value, context: validation } = quietContext();
    value.items = [{
      id: 'noticia-inventada',
      topic: 'juros',
      headline: 'Notícia sem lastro',
      summary: 'Uma notícia foi inserida em um dia sem evidência suficiente.',
      whyItMatters: 'O portão precisa impedir publicação sem lastro.',
      sourceIds: ['fonte-bcb'],
    }];
    value.sources = [sourceRef(source())];

    expect(() => validateEdition(value, validation)).toThrow(/quiet|morno|items/i);
  });

  it('rejects a missing educational disclaimer marker', () => {
    const { value, context: validation } = context();
    value.provenance.disclaimerKey = 'recomendacao' as Edition['provenance']['disclaimerKey'];

    expect(() => validateEdition(value, validation)).toThrow(/disclaimer/i);
  });
});

function withLesson(date: string, lessonId: string): Edition {
  const value = previousEdition(date);
  const approvedVault = vault();
  value.decision = { status: 'material', reasonCodes: ['monday-lesson'], lessonId, newsClusterIds: [] };
  value.lesson = approvedVault.lessons.find((lesson) => lesson.id === lessonId);
  value.items = [];
  value.sources = [];
  value.briefing = buildDeterministicBriefing(value, approvedVault);
  return value;
}

describe('validateAndPublish', () => {
  it('publishes a validated edition with exclusive creation', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.sources = [source()];
    collected.lessons = approvedVault.lessons;
    const decision = decideEdition(collected, [], approvedVault);
    const selection = buildSelection(collected, decision, approvedVault, []);
    const value = draft(DATE, collected, approvedVault);
    writeRun(root, DATE, collected, selection, value);

    const path = validateAndPublish(DATE, root);

    expect(path).toBe(join(root, 'src/data/diario/edicoes', `${DATE}.json`));
    expect(parseEdition(JSON.parse(readFileSync(path, 'utf8')))).toEqual(value);
  });

  it('never overwrites an edition from the same day', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.lessons = approvedVault.lessons;
    const decision = decideEdition(collected, [], approvedVault);
    const selection = buildSelection(collected, decision, approvedVault, []);
    const value = draft(DATE, collected, approvedVault);
    writeRun(root, DATE, collected, selection, value);
    validateAndPublish(DATE, root);

    expect(() => validateAndPublish(DATE, root)).toThrow(/exists|overwrite|same day/i);
  });

  it('fails before publication when the vault hash diverges', () => {
    const root = tempRoot();
    const allowlistPath = join(root, 'src/data/diario/curadoria/allowlist.json');
    const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')) as { sources: Array<{ enabled: boolean }> };
    allowlist.sources[0].enabled = false;
    writeFileSync(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`, 'utf8');

    expect(() => validateAndPublish(DATE, root)).toThrow(/bundleSha256|hash|governance/i);
  });

  it('marks history unavailable when two nights are missing after the most recent edition', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const older = draft('2026-11-21', inputs('2026-11-21'), approvedVault);
    const newest = draft('2026-11-23', inputs('2026-11-23'), approvedVault, [older]);
    writeJson(join(root, 'src/data/diario/edicoes/2026-11-21.json'), older);
    writeJson(join(root, 'src/data/diario/edicoes/2026-11-23.json'), newest);

    const collected = inputs('2026-11-26');
    collected.lessons = approvedVault.lessons;
    const selection: Selection = {
      date: '2026-11-26',
      decision: { status: 'morno', reasonCodes: ['history-unavailable'], newsClusterIds: [] },
      clusters: [],
      selectedSources: [],
    };
    const value = draft('2026-11-26', collected, approvedVault);
    value.decision = selection.decision;
    writeRun(root, '2026-11-26', collected, selection, value);

    const loaded = loadValidationContext('2026-11-26', root);

    expect(loaded.historyUnavailable).toBe(true);
    expect(loaded.previousEditions).toEqual([]);
    expect(validateEdition(value, loaded)).toEqual(value);
  });

  it('forgives the single night the automation itself missed', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    writeJson(join(root, 'src/data/diario/edicoes/2026-11-23.json'), draft('2026-11-23', inputs('2026-11-23'), approvedVault));

    const loaded = loadPreviousEditions('2026-11-25', root);

    expect(loaded.unavailable).toBe(false);
    expect(loaded.editions.map((edition) => edition.date)).toEqual(['2026-11-23']);
  });

  it('ignores a gap older than the most recent edition when proving the chain', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const oldest = draft('2026-11-20', inputs('2026-11-20'), approvedVault);
    const newest = draft('2026-11-23', inputs('2026-11-23'), approvedVault);
    writeJson(join(root, 'src/data/diario/edicoes/2026-11-20.json'), oldest);
    writeJson(join(root, 'src/data/diario/edicoes/2026-11-23.json'), newest);

    const loaded = loadPreviousEditions('2026-11-24', root);

    expect(loaded.unavailable).toBe(false);
    expect(loaded.editions.map((edition) => edition.date)).toEqual(['2026-11-20', '2026-11-23']);
  });

  it('fails with an actionable error for malformed cached JSON', () => {
    const root = tempRoot();
    mkdirSync(join(root, '.cache/diario', DATE), { recursive: true });
    writeFileSync(join(root, '.cache/diario', DATE, 'inputs.json'), '{invalid', 'utf8');

    expect(() => loadValidationContext(DATE, root)).toThrow(/inputs.json|JSON/i);
  });
});
