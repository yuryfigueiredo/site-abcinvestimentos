import { describe, expect, it } from 'vitest';
import { buildDeterministicBriefing } from '../../src/lib/diario/briefing';
import {
  buildBcbSnapshot,
  buildSelection,
  decideEdition,
} from '../../src/lib/diario/curate';
import * as curation from '../../src/lib/diario/curate';
import { curateCollectedInputs } from '../../src/lib/diario/curation';
import type { Edition, EditorialBriefing } from '../../src/lib/diario/types';
import {
  DATE,
  RETRIEVED_AT,
  conversationSourceForDate,
  draft,
  inputs,
  mediaSourceForDate,
  previousEdition,
  sha256,
  source,
  sourceForDate,
  vault,
} from './fixtures';

function calendarEvent(date = DATE) {
  return {
    id: 'copom-2026-11',
    date,
    title: 'Reunião do Copom',
    sourceUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/copom',
  };
}

function withEventPrevious(date = '2026-11-22'): Edition {
  const previous = previousEdition(date);
  previous.decision = { status: 'material', reasonCodes: ['calendar-event'], eventId: 'copom-2026-11', newsClusterIds: [] };
  const event = calendarEvent(date);
  previous.event = event;
  previous.items = [];
  previous.sources = [{
    id: 'fonte-evento-anterior',
    sourceId: 'bcb',
    kind: 'official',
    publisher: 'Banco Central do Brasil',
    title: 'Comunicado anterior do Copom',
    canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/anterior',
    publishedAt: `${date}T10:00:00Z`,
    retrievedAt: `${date}T12:00:00Z`,
  }];
  const approvedVault = vault();
  approvedVault.calendar = [event];
  previous.briefing = buildDeterministicBriefing(previous, approvedVault);
  return previous;
}

function compactNewsBriefing(): EditorialBriefing {
  return {
    whatHappened:
      'A avaliação de juros organiza o contexto monetário. '.repeat(5).trim(),
    whyItMatters:
      'O contexto educacional ajuda o investidor a acompanhar fatos sem recomendação. '.repeat(4).trim(),
    whatToWatch: [
      'Acompanhe os comunicados oficiais e compare os fatos antes de revisar o planejamento. '.repeat(2).trim(),
      'Observe os próximos desdobramentos e mantenha a leitura separada de decisões individuais. '.repeat(2).trim(),
    ],
  };
}

describe('editorialPayload', () => {
  it('includes every editorial block and the official event title and URL', () => {
    const collected = inputs();
    collected.sources = [source()];
    const event = calendarEvent();
    collected.events = [event];
    const approvedVault = vault();
    approvedVault.calendar = [event];
    const news = draft(DATE, collected, approvedVault);
    const lesson = draft();

    const newsPayload = curation.editorialPayload(news);
    const lessonPayload = curation.editorialPayload(lesson);

    expect(newsPayload).toContain(news.title);
    expect(newsPayload).toContain(news.summary);
    expect(newsPayload).toContain(news.items[0].id);
    expect(newsPayload).toContain(news.items[0].topic);
    expect(newsPayload).toContain(news.items[0].headline);
    expect(newsPayload).toContain(news.items[0].summary);
    expect(newsPayload).toContain(news.items[0].whyItMatters);
    for (const sourceId of news.items[0].sourceIds) expect(newsPayload).toContain(sourceId);
    expect(newsPayload).toContain(news.briefing!.whatHappened);
    expect(newsPayload).toContain(news.briefing!.whyItMatters);
    for (const section of news.briefing!.whatToWatch) expect(newsPayload).toContain(section);
    expect(newsPayload).toContain(event.title);
    expect(newsPayload).toContain(event.sourceUrl);
    expect(lessonPayload).toContain(lesson.lesson!.title);
    expect(lessonPayload).toContain(lesson.lesson!.body);
  });
});

describe('decideEdition', () => {
  it('marks a fresh official article as material', () => {
    const collected = inputs();
    collected.sources = [source()];

    expect(decideEdition(collected, [], vault())).toEqual({
      status: 'material',
      reasonCodes: ['official-news'],
      newsClusterIds: [expect.any(String)],
    });
  });

  it('keeps an ordinary day quiet', () => {
    const collected = inputs('2026-11-24');

    expect(decideEdition(collected, [], vault())).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('marks a verified calendar event as material', () => {
    const collected = inputs();
    const approvedVault = vault();
    collected.events = [calendarEvent()];
    approvedVault.calendar = collected.events;

    expect(decideEdition(collected, [], approvedVault)).toMatchObject({
      status: 'material',
      reasonCodes: ['calendar-event'],
      eventId: 'copom-2026-11',
    });
  });

  it('uses the unrounded dollar change at the threshold', () => {
    const collected = inputs('2026-11-24');
    collected.bcb.dolar = [
      { value: 99.001, date: '2026-11-24' },
      { value: 100, date: '2026-11-23' },
    ];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');

    collected.bcb.dolar[0].value = 99;
    expect(decideEdition(collected, [], vault())).toMatchObject({
      status: 'material',
      reasonCodes: ['dollar-trigger'],
    });
  });

  it('does not trigger materiality from stale dollar data', () => {
    const previous = previousEdition('2026-11-23');
    const collected = inputs('2026-11-24');
    collected.bcb.dolar = [];

    expect(buildBcbSnapshot(collected, [previous]).measured.dolar?.origin).toBe('stale');
    expect(decideEdition(collected, [previous], vault())).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('keeps a weekend without a new observation quiet', () => {
    const collected = inputs('2026-11-22');
    collected.bcb.dolar = [
      { value: 5, date: '2026-11-20' },
      { value: 4, date: '2026-11-19' },
    ];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('uses a Monday lesson only when the day is quiet', () => {
    const collected = inputs();

    expect(decideEdition(collected, [], vault())).toEqual({
      status: 'material',
      reasonCodes: ['monday-lesson'],
      lessonId: 'licao-reserva',
      newsClusterIds: [],
    });

    collected.sources = [source()];
    expect(decideEdition(collected, [], vault())).not.toHaveProperty('lessonId');
  });

  it('allows at most one lesson per ISO week', () => {
    const previous = withEventPrevious('2026-11-23');
    previous.lesson = vault().lessons[0];
    previous.decision.lessonId = previous.lesson.id;
    previous.decision.reasonCodes = ['monday-lesson'];
    const approvedVault = vault();
    approvedVault.thresholds.lessonWeekday = 2;

    expect(decideEdition(inputs('2026-11-24'), [previous], approvedVault)).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('does not repeat a lesson already used in an earlier week', () => {
    const previous = withEventPrevious('2026-11-16');
    previous.lesson = vault().lessons[0];
    previous.decision.lessonId = previous.lesson.id;
    previous.decision.reasonCodes = ['monday-lesson'];

    expect(decideEdition(inputs(), [previous], vault())).toMatchObject({
      status: 'material',
      reasonCodes: ['monday-lesson'],
      lessonId: 'licao-orcamento',
    });
  });

  it('rejects repeated canonical URL', () => {
    const previous = previousEdition('2026-11-23');
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      id: 'fonte-repetida',
      title: 'Nova redação sobre o mesmo comunicado',
      canonicalUrl: `${previous.sources[0].canonicalUrl}?utm_source=diario#topo`,
    })];

    expect(decideEdition(collected, [previous], vault())).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('rejects repeated normalized title', () => {
    const previous = previousEdition('2026-11-23');
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      id: 'fonte-titulo-repetido',
      title: '  COPOM   mantém avaliação de juros!  ',
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/novo',
    })];

    expect(decideEdition(collected, [previous], vault()).status).toBe('morno');
  });

  it('compares a candidate cluster with the complete prior editorial payload, including its briefing', () => {
    const previous = previousEdition('2026-11-23');
    previous.title = 'Juros';
    previous.summary = 'Resumo';
    previous.items[0].headline = 'Notícia';
    previous.items[0].summary = 'Síntese';
    previous.items[0].whyItMatters = 'Contexto';
    previous.briefing = compactNewsBriefing();
    const priorEditorialText = [
      previous.title,
      previous.summary,
      previous.items[0].id,
      previous.items[0].topic,
      previous.items[0].headline,
      previous.items[0].summary,
      previous.items[0].whyItMatters,
      ...previous.items[0].sourceIds,
      previous.briefing.whatHappened,
      previous.briefing.whyItMatters,
      ...previous.briefing.whatToWatch,
    ].join(' ');
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      id: 'fonte-payload-repetido',
      title: priorEditorialText.slice(0, 450),
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/replica',
      excerpt: priorEditorialText.slice(450).trim(),
    })];

    expect(decideEdition(collected, [previous], vault())).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('removes duplicates without discarding a genuinely new cluster', () => {
    const collected = inputs();
    collected.sources = [
      source(),
      source({ id: 'duplicada', canonicalUrl: `${source().canonicalUrl}?utm_medium=feed` }),
      source({
        id: 'fonte-inflacao',
        title: 'Inflação desacelera no trimestre',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/inflacao',
        excerpt: 'O relatório oficial descreve a desaceleração dos preços ao consumidor.',
      }),
    ];
    const decision = decideEdition(collected, [], vault());
    const selection = buildSelection(collected, decision, vault(), []);

    expect(decision.status).toBe('material');
    expect(decision.newsClusterIds).toHaveLength(1);
    expect(selection.selectedSources.map((item) => item.id)).toEqual(['fonte-inflacao']);
  });

  it('keeps selected IDs aligned when a repeated source precedes a new cluster', () => {
    const previous = previousEdition('2026-11-23');
    const collected = inputs('2026-11-24');
    collected.sources = [
      sourceForDate('2026-11-24'),
      sourceForDate('2026-11-24', {
        id: 'fonte-inflacao-nova',
        title: 'Inflação desacelera no trimestre',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/inflacao',
        excerpt: 'O relatório oficial descreve a desaceleração dos preços ao consumidor.',
      }),
    ];
    const approvedVault = vault();
    approvedVault.thresholds.maxItems = 1;
    const decision = decideEdition(collected, [previous], approvedVault);

    expect(decision.newsClusterIds).toEqual(['cluster-2']);
    expect(buildSelection(collected, decision, approvedVault, [previous]).selectedSources.map((item) => item.id)).toEqual([
      'fonte-inflacao-nova',
    ]);
  });

  it('keeps the same event quiet without new substantive source evidence', () => {
    const collected = inputs('2026-11-24');
    const approvedVault = vault();
    collected.events = [calendarEvent('2026-11-24')];
    approvedVault.calendar = collected.events;

    expect(decideEdition(collected, [withEventPrevious('2026-11-23')], approvedVault)).toEqual({
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    });
  });

  it('does not treat an excerpt copied from a prior event source title as new evidence', () => {
    const previous = withEventPrevious('2026-11-23');
    const collected = inputs('2026-11-24');
    const event = calendarEvent('2026-11-24');
    collected.events = [event];
    collected.sources = [sourceForDate('2026-11-24', {
      title: 'Copom divulga nota complementar',
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/complementar',
      excerpt: previous.sources[0].title,
    })];
    const approvedVault = vault();
    approvedVault.calendar = [event];

    expect(decideEdition(collected, [previous], approvedVault)).toEqual({
      status: 'material',
      reasonCodes: ['official-news'],
      newsClusterIds: ['cluster-1'],
    });
  });

  it('does not reopen an event from evidence copied from the prior editorial payload', () => {
    const previous = withEventPrevious('2026-11-23');
    const collected = inputs('2026-11-24');
    const event = calendarEvent('2026-11-24');
    collected.events = [event];
    collected.sources = [sourceForDate('2026-11-24', {
      title: 'Copom divulga nota complementar',
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/complementar',
      excerpt: previous.briefing!.whatToWatch[0],
    })];
    const approvedVault = vault();
    approvedVault.calendar = [event];

    expect(decideEdition(collected, [previous], approvedVault)).toEqual({
      status: 'material',
      reasonCodes: ['official-news'],
      newsClusterIds: ['cluster-1'],
    });
  });

  it('keeps the same event material when a new official source adds evidence', () => {
    const collected = inputs('2026-11-24');
    const approvedVault = vault();
    collected.events = [calendarEvent('2026-11-24')];
    approvedVault.calendar = collected.events;
    collected.sources = [sourceForDate('2026-11-24', {
      title: 'Copom publica nova avaliação sobre liquidez',
      excerpt: 'A nova nota oficial acrescenta critérios de liquidez ao comunicado.',
    })];
    const decision = decideEdition(collected, [withEventPrevious('2026-11-23')], approvedVault);

    expect(decision).toMatchObject({ status: 'material', reasonCodes: ['calendar-event'], eventId: 'copom-2026-11' });
    expect(buildSelection(collected, decision, approvedVault, [withEventPrevious('2026-11-23')]).selectedSources).toHaveLength(1);
  });

  it('fails closed to quiet when history is invalid or ambiguous', () => {
    const first = previousEdition('2026-11-22');
    const duplicate = { ...first, id: 'diario-outro' };

    expect(decideEdition(inputs(), [first, duplicate], vault())).toEqual({
      status: 'morno',
      reasonCodes: ['history-unavailable'],
      newsClusterIds: [],
    });
  });

  it('does not count multiple feeds from one media publisher as corroboration', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha', { canonicalUrl: 'https://alpha.example.test/noticias/copom-1' }),
      mediaSourceForDate('2026-11-24', 'alpha', {
        id: 'fonte-alpha-2',
        canonicalUrl: 'https://alpha.example.test/noticias/copom-2',
        title: 'Copom revisa comunicação de juros',
      }),
    ];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('does not count two allowlist IDs from one publisher as independent media', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha'),
      mediaSourceForDate('2026-11-24', 'beta', { sourceId: 'beta-alias', publisher: 'alpha' }),
    ];
    const approvedVault = vault();
    const beta = approvedVault.allowlist.find((item) => item.id === 'beta')!;
    beta.id = 'beta-alias';
    beta.publisher = 'alpha';

    expect(decideEdition(collected, [], approvedVault).status).toBe('morno');
  });

  it('requires two independent media publishers for corroborated news', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha'),
      mediaSourceForDate('2026-11-24', 'beta'),
    ];

    expect(decideEdition(collected, [], vault())).toMatchObject({
      status: 'material',
      reasonCodes: ['corroborated-media-news'],
    });
  });

  it('excludes crypto and off-topic articles even when the feed is broad', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [
      mediaSourceForDate('2026-11-24', 'alpha', {
        title: 'Bitcoin e criptomoedas sobem com juros',
        excerpt: 'O mercado de criptoativos reage às expectativas de juros.',
      }),
      mediaSourceForDate('2026-11-24', 'beta', {
        title: 'Receita caseira de bolo',
        excerpt: 'Uma preparação simples para o café da tarde.',
      }),
    ];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('excludes articles outside the approved news window', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [source({ publishedAt: '2026-11-23T15:59:59Z' })];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('requires a valid excerpt hash before selecting evidence', () => {
    const collected = inputs('2026-11-24');
    const invalid = sourceForDate('2026-11-24');
    invalid.excerptSha256 = '0'.repeat(64);
    collected.sources = [invalid];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('selects at most the approved number of news clusters', () => {
    const collected = inputs();
    collected.sources = ['juros', 'inflação', 'câmbio', 'regulação'].map((theme, index) => source({
      id: `fonte-${index}`,
      title: `Comunicado oficial sobre ${theme}`,
      canonicalUrl: `https://www.bcb.gov.br/publicacoes/${index}`,
      excerpt: `O Banco Central publica informação verificada sobre ${theme}.`,
    }));

    expect(decideEdition(collected, [], vault()).newsClusterIds).toHaveLength(3);
  });

  it('rejects an allowlisted source ID when the article host is not approved', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      canonicalUrl: 'https://outside.example.test/publicacoes/copom',
    })];

    expect(decideEdition(collected, [], vault()).status).toBe('morno');
  });

  it('does not use a CC BY-ND excerpt as standalone editorial evidence', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [conversationSourceForDate('2026-11-24')];
    const decision = decideEdition(collected, [], vault());

    expect(decision.status).toBe('morno');
    expect(buildSelection(collected, decision, vault(), []).selectedSources).toEqual([]);
  });
});

describe('buildSelection', () => {
  it('exposes the approved event or lesson selected for the writer', () => {
    const eventInputs = inputs('2026-11-24');
    const approvedVault = vault();
    const event = calendarEvent('2026-11-24');
    eventInputs.events = [event];
    approvedVault.calendar = [event];
    const eventDecision = decideEdition(eventInputs, [], approvedVault);
    expect(buildSelection(eventInputs, eventDecision, approvedVault, [])).toMatchObject({
      eventId: event.id,
      decision: { eventId: event.id },
    });

    const lessonInputs = inputs();
    const lessonDecision = decideEdition(lessonInputs, [], vault());
    expect(buildSelection(lessonInputs, lessonDecision, vault(), [])).toMatchObject({
      lessonId: 'licao-reserva',
      decision: { lessonId: 'licao-reserva' },
    });
  });

  it('normalizes canonical URL, title, excerpt, timestamps, and attribution', () => {
    const collected = inputs();
    collected.sources = [source({
      canonicalUrl: 'https://WWW.BCB.GOV.BR:443/publicacoes/copom/?b=2&utm_source=feed&a=1#topo',
      title: '  Copom   mantém avaliação de juros  ',
      excerpt: '  O   comunicado\n oficial descreve juros.  ',
      author: 'Ana Silva',
    })];
    const decision = decideEdition(collected, [], vault());
    const selection = buildSelection(collected, decision, vault(), []);

    expect(selection.selectedSources).toHaveLength(1);
    expect(selection.selectedSources[0]).toMatchObject({
      canonicalUrl: 'https://www.bcb.gov.br/publicacoes/copom/?a=1&b=2',
      title: 'Copom mantém avaliação de juros',
      excerpt: 'O comunicado oficial descreve juros.',
      excerptSha256: sha256('O comunicado oficial descreve juros.'),
      publishedAt: `${DATE}T10:00:00.000Z`,
      retrievedAt: `${RETRIEVED_AT.replace('Z', '.000Z')}`,
      author: 'Ana Silva',
      clusterId: expect.any(String),
      topic: 'juros',
    });
  });

  it('contains no evidence for a quiet decision', () => {
    const collected = inputs('2026-11-24');
    const selection = buildSelection(collected, decideEdition(collected, [], vault()), vault(), []);

    expect(selection).toEqual({
      date: '2026-11-24',
      decision: { status: 'morno', reasonCodes: ['no-substantive-delta'], newsClusterIds: [] },
      clusters: [],
      selectedSources: [],
    });
  });
});

describe('buildBcbSnapshot', () => {
  it('uses realized BCB observations and the exact dollar change', () => {
    const snapshot = buildBcbSnapshot(inputs(), []);

    expect(snapshot.status).toBe('ok');
    expect(snapshot.staleFields).toEqual([]);
    expect(snapshot.measured.selic).toEqual({ value: 13.75, observedOn: DATE, origin: 'bcb-sgs' });
    expect(snapshot.dollarChangePct).toBeCloseTo((5 - 4.99) / 4.99 * 100, 10);
  });

  it('does not calculate dollar change from conflicting observations on the prior date', () => {
    const collected = inputs();
    collected.bcb.dolar = [
      { value: 5, date: DATE },
      { value: 4.99, date: '2026-11-20' },
      { value: 99, date: '2026-11-20' },
    ];

    expect(buildBcbSnapshot(collected, []).dollarChangePct).toBeNull();
  });

  it('does not pair a stale published dollar value with a revised observation change', () => {
    const previous = previousEdition('2026-11-20');
    previous.snapshot.measured.dolar = { value: 5, observedOn: '2026-11-20', origin: 'bcb-sgs' };
    const collected = inputs('2026-11-21');
    collected.bcb.dolar = [
      { value: 5.5, date: '2026-11-20' },
      { value: 5, date: '2026-11-19' },
    ];

    const snapshot = buildBcbSnapshot(collected, [previous]);

    expect(snapshot.measured.dolar).toEqual({ value: 5, observedOn: '2026-11-20', origin: 'stale' });
    expect(snapshot.dollarChangePct).toBeNull();
  });

  it('does not calculate a dollar change when the published value remains stale', () => {
    const previous = previousEdition('2026-11-22');
    previous.snapshot.measured.dolar = { value: 5, observedOn: '2026-11-22', origin: 'bcb-sgs' };
    const collected = inputs('2026-11-23');
    collected.bcb.dolar = [
      { value: 5, date: '2026-11-22' },
      { value: 4, date: '2026-11-21' },
    ];

    const snapshot = buildBcbSnapshot(collected, [previous]);

    expect(snapshot.measured.dolar).toEqual({ value: 5, observedOn: '2026-11-22', origin: 'stale' });
    expect(snapshot.dollarChangePct).toBeNull();
  });

  it('ignores future observations instead of presenting them as realized', () => {
    const collected = inputs('2026-11-24');
    collected.bcb.selic = [{ value: 99, date: '2026-11-25' }];
    collected.bcb.dolar = [
      { value: 6, date: '2026-11-25' },
      { value: 5, date: '2026-11-24' },
    ];

    const snapshot = buildBcbSnapshot(collected, []);

    expect(snapshot.measured).not.toHaveProperty('selic');
    expect(snapshot.measured.dolar).toEqual({ value: 5, observedOn: '2026-11-24', origin: 'bcb-sgs' });
    expect(snapshot.dollarChangePct).toBeNull();
  });

  it('copies only the nearest previous value and date when marking a field stale', () => {
    const previous = previousEdition('2026-11-23');
    const collected = inputs('2026-11-24');
    collected.bcb.dolar = [];

    const snapshot = buildBcbSnapshot(collected, [previous]);

    expect(snapshot.measured.dolar).toEqual({
      value: previous.snapshot.measured.dolar?.value,
      observedOn: previous.snapshot.measured.dolar?.observedOn,
      origin: 'stale',
    });
    expect(snapshot.staleFields).toContain('dolar');
    expect(snapshot.status).toBe('stale');
    expect(snapshot.dollarChangePct).toBeNull();
  });

  it('omits unavailable fields rather than inventing zero values', () => {
    const collected = inputs();
    collected.bcb = {};

    expect(buildBcbSnapshot(collected, [])).toEqual({
      status: 'unavailable',
      measured: {},
      staleFields: [],
      dollarChangePct: null,
    });
  });

  it('marks an unchanged observation stale when a previous edition already has it', () => {
    const previous = previousEdition('2026-11-22');
    const collected = inputs();
    collected.bcb.selic = [{ value: previous.snapshot.measured.selic?.value ?? 0, date: '2026-11-22' }];

    expect(buildBcbSnapshot(collected, [previous]).measured.selic?.origin).toBe('stale');
  });
});

describe('curateCollectedInputs', () => {
  it.each([
    ['Pix amplia conta de pagamento', 'O meio de pagamento Pix tem nova regra.', 'pagamentos-credito'],
    ['Black Friday e intenção de compra', 'O varejo acompanha consumo e poder de compra.', 'consumo'],
    ['CAGED e desemprego', 'O emprego e a ocupação mudam no mercado de trabalho.', 'trabalho-renda'],
    ['IGP-M e preços', 'O índice de preços IGP-M atualiza a inflação.', 'inflacao'],
    ['Spread bancário', 'O spread é a taxa cobrada nas operações de crédito.', 'pagamentos-credito'],
    ['Crédito e financiamento', 'O financiamento e o endividamento mudam as condições.', 'pagamentos-credito'],
  ] as const)('classifies %s as %s', (title, excerpt, topic) => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', { title, excerpt })];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.selection.clusters[0]?.topic).toBe(topic);
    expect(result.diagnostics[0]).toMatchObject({ topic, reason: 'selected' });
  });

  it('maps payroll events to trabalho-renda', () => {
    expect(curation.EVENT_TOPICS.payroll).toBe('trabalho-renda');
  });

  it.each([
    ['2026-11-27', '2026-11-26T21:00:00Z'],
    ['2026-11-28', '2026-11-26T21:00:00Z'],
    ['2026-11-29', '2026-11-26T22:00:00Z'],
  ])('uses the adaptive weekend window for %s', (date, publishedAt) => {
    const collected = inputs(date);
    collected.sources = [sourceForDate(date, { publishedAt })];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.decision.status).toBe('material');
    expect(result.diagnostics[0]?.reason).toBe('selected');
  });

  it.each([
    ['2026-11-24', '2026-11-23T15:59:59Z'],
    ['2026-11-28', '2026-11-25T21:00:01Z'],
  ])('rejects a candidate outside the adaptive window for %s', (date, publishedAt) => {
    const collected = inputs(date);
    collected.sources = [sourceForDate(date, { publishedAt })];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.decision.status).toBe('morno');
    expect(result.diagnostics[0]?.reason).toBe('outside-window');
  });

  it('uses referenceAt for age but retrievedAt for the publication cutoff', () => {
    const collected = inputs('2026-11-28');
    collected.retrievedAt = '2026-11-27T22:00:00Z';
    collected.referenceAt = '2026-11-28T22:00:00Z';
    collected.sources = [
      source({ id: 'conhecida', publishedAt: '2026-11-26T18:00:00Z', retrievedAt: collected.retrievedAt }),
      source({ id: 'agendada', publishedAt: '2026-11-27T23:00:00Z', retrievedAt: collected.retrievedAt }),
    ];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.selection.selectedSources.map((item) => item.id)).toEqual(['conhecida']);
    expect(result.diagnostics.map((item) => [item.id, item.reason])).toEqual([
      ['conhecida', 'selected'],
      ['agendada', 'future-publication'],
    ]);
  });

  it('rejects publication after the editorial reference instant', () => {
    const collected = inputs('2026-11-28');
    collected.retrievedAt = '2026-11-27T22:00:00Z';
    collected.referenceAt = '2026-11-28T22:00:00Z';
    collected.sources = [source({ publishedAt: '2026-11-28T23:00:00Z', retrievedAt: collected.retrievedAt })];

    expect(curateCollectedInputs(collected, [], vault()).diagnostics[0]?.reason).toBe('future-publication');
  });

  it('records exactly one terminal reason per source without evidence text', () => {
    const collected = inputs('2026-11-24');
    const invalid = sourceForDate('2026-11-24', { id: 'invalida' });
    invalid.excerptSha256 = '0'.repeat(64);
    const duplicate = sourceForDate('2026-11-24', { id: 'duplicada' });
    const notAllowed = sourceForDate('2026-11-24', { id: 'nao-autorizada', sourceId: 'fonte-desconhecida' });
    const crypto = sourceForDate('2026-11-24', {
      id: 'cripto',
      title: 'Bitcoin e criptomoedas sobem',
      excerpt: 'O mercado de criptoativos reage às expectativas.',
    });
    const offTopic = sourceForDate('2026-11-24', {
      id: 'fora-de-tema',
      title: 'Receita caseira de bolo',
      excerpt: 'Uma preparação simples para o café da tarde.',
    });
    const outside = sourceForDate('2026-11-24', { id: 'antiga', publishedAt: '2026-11-22T22:00:00Z' });
    const singleMedia = mediaSourceForDate('2026-11-24', 'alpha', { id: 'midia-sola' });
    collected.sources = [
      sourceForDate('2026-11-24', {
        id: 'selecionada',
        title: 'Copom publica nova avaliação',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/avaliacao',
      }),
      invalid,
      duplicate,
      sourceForDate('2026-11-24', { id: 'duplicada-outra' }),
      notAllowed,
      conversationSourceForDate('2026-11-24', { id: 'cc-by-nd' }),
      crypto,
      offTopic,
      outside,
      singleMedia,
    ];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.diagnostics.map((item) => [item.id, item.reason])).toEqual([
      ['selecionada', 'selected'],
      ['invalida', 'invalid-candidate'],
      ['duplicada', 'duplicate-candidate'],
      ['duplicada-outra', 'duplicate-candidate'],
      ['nao-autorizada', 'source-not-allowed'],
      ['cc-by-nd', 'cc-by-nd'],
      ['cripto', 'crypto-excluded'],
      ['fora-de-tema', 'topic-not-allowed'],
      ['antiga', 'outside-window'],
      ['midia-sola', 'media-needs-two-sources'],
    ]);
    expect(result.diagnostics).toHaveLength(collected.sources.length);
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/excerpt|excerptSha256|<|>/iu);
  });

  it('strips HTML tags and entities from diagnostic titles', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      title: '&lt;strong&gt;Pix&lt;/strong&gt;',
      excerpt: 'O meio de pagamento Pix recebe uma nova regra.',
    })];

    const result = curateCollectedInputs(collected, [], vault());

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ reason: 'selected', title: 'Pix' });
    expect(JSON.stringify(result.diagnostics)).not.toMatch(/&lt;|&gt;|<|>/iu);
  });

  it('marks history duplicates and eligible clusters beyond the item limit', () => {
    const previous = previousEdition('2026-11-22');
    const collected = inputs('2026-11-24');
    collected.sources = [
      sourceForDate('2026-11-24', { id: 'repetida', canonicalUrl: previous.sources[0].canonicalUrl }),
      sourceForDate('2026-11-24', {
        id: 'juros',
        title: 'Copom avalia juros',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/juros',
        excerpt: 'A política monetária atualiza os juros.',
      }),
      sourceForDate('2026-11-24', {
        id: 'inflacao',
        title: 'IPCA atualiza preços',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/indices/precos/ipca',
        excerpt: 'A inflação e o índice de preços mudam.',
      }),
    ];
    const approvedVault = vault();
    approvedVault.thresholds.maxItems = 1;

    const result = curateCollectedInputs(collected, [previous], approvedVault);

    expect(result.diagnostics.find((item) => item.id === 'repetida')?.reason).toBe('duplicate-history');
    expect(result.selection.clusters).toHaveLength(1);
    expect(result.diagnostics.filter((item) => item.reason === 'item-limit')).toHaveLength(1);
    expect(result.diagnostics.filter((item) => item.reason === 'selected')).toHaveLength(1);
  });

  it('fails closed with history-unavailable diagnostics when the historical chain is invalid', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24')];
    const brokenHistory = [{ ...previousEdition('2026-11-23'), date: '2026-11-24' }];

    const result = curateCollectedInputs(collected, brokenHistory, vault());

    expect(result.decision).toEqual({ status: 'morno', reasonCodes: ['history-unavailable'], newsClusterIds: [] });
    expect(result.selection.selectedSources).toEqual([]);
    expect(result.diagnostics[0]?.reason).toBe('history-unavailable');
  });
});
