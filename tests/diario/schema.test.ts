import { describe, expect, it } from 'vitest';
import { parseAllowlist, parseCalendarEvent, parseEdition, parseEditorialBriefing } from '../../src/lib/diario/schema';
import type { AllowlistSource, CalendarEvent, Edition, EditorialBriefing, Lesson } from '../../src/lib/diario/types';
import { DATE, draft, inputs, vault } from './fixtures';

const lesson: Lesson = {
  id: 'licao-juro-real',
  title: 'Entenda juro real e marcação a mercado',
  body: 'O juro real desconta a inflação do rendimento nominal. O preço do título pode oscilar antes do vencimento.',
  guideSlug: 'tesouro-ipca-ganho-real-inflacao',
};

const event: CalendarEvent = {
  id: 'copom-2026-11-23',
  date: '2026-11-23',
  title: 'Reunião do Copom',
  sourceUrl: 'https://www.bcb.gov.br/publicacoes/comunicados',
};

const briefing: EditorialBriefing = {
  whatHappened:
    'O Copom divulgou uma nova avaliação da política monetária e manteve a leitura de cautela diante das condições econômicas. O comunicado oficial atualiza o contexto para a renda fixa e permite acompanhar como o Banco Central interpreta a evolução recente dos juros e da inflação. A leitura da edição se limita ao conteúdo publicado, sem antecipar decisões futuras ou transformar o comunicado em recomendação de investimento.',
  whyItMatters:
    'A avaliação do Banco Central ajuda o investidor a entender o ambiente de juros que influencia títulos de renda fixa. Mudanças nas expectativas podem alterar o preço de mercado de papéis já emitidos, especialmente quando o vencimento está mais distante. Por isso, o comunicado é um ponto de referência para revisar o planejamento com prudência, considerando objetivos, prazo, liquidez e tolerância a oscilações, sem indicar compra ou venda.',
  whatToWatch: [
    'Acompanhe os próximos comunicados do Copom e compare a linguagem com a avaliação divulgada nesta edição.',
    'Observe a evolução das expectativas de juros e inflação e seus efeitos educacionais sobre a renda fixa.',
  ],
};

function materialEdition(): Edition {
  return {
    schemaVersion: 2,
    id: 'diario-2026-11-23',
    date: '2026-11-23',
    generatedAt: '2026-11-23T19:00:00Z',
    title: 'Copom mantém sinal de cautela',
    summary: 'O comunicado oficial trouxe o sinal atualizado para a condução da política monetária.',
    snapshot: {
      status: 'ok',
      measured: {
        selic: { value: 10.5, observedOn: '2026-11-20', origin: 'bcb-sgs' },
        cdi: { value: 10.45, observedOn: '2026-11-20', origin: 'bcb-sgs' },
        ipca12m: { value: 4.58, observedOn: '2026-10-31', origin: 'bcb-sgs' },
        dolar: { value: 5.42, observedOn: '2026-11-20', origin: 'bcb-sgs' },
      },
      staleFields: [],
      dollarChangePct: -1.25,
    },
    decision: {
      status: 'material',
      reasonCodes: ['calendar-event', 'official-news'],
      eventId: event.id,
      newsClusterIds: ['cluster-copom'],
    },
    briefing,
    event,
    items: [
      {
        id: 'noticia-copom',
        topic: 'juros',
        headline: 'Banco Central atualiza sinal da política monetária',
        summary: 'O comunicado do Copom descreve a avaliação atual do Banco Central.',
        whyItMatters: 'A decisão ajuda a contextualizar o ambiente de juros para investimentos de renda fixa.',
        sourceIds: ['fonte-copom'],
      },
    ],
    sources: [
      {
        id: 'fonte-copom',
        sourceId: 'bcb',
        kind: 'official',
        publisher: 'Banco Central do Brasil',
        title: 'Comunicado do Copom',
        canonicalUrl: 'https://www.bcb.gov.br/publicacoes/comunicados',
        publishedAt: '2026-11-20T19:00:00Z',
        retrievedAt: '2026-11-23T19:00:00Z',
      },
    ],
    relatedCalculatorSlug: 'juros-compostos',
    policy: {
      charterVersion: '1.0.0',
      allowlistVersion: '1.0.0',
      thresholdsVersion: '1.0.0',
      sourceIds: ['bcb'],
      allowedHosts: ['www.bcb.gov.br'],
    },
    provenance: {
      generator: 'qoder-diario',
      promptVersion: '1.0.0',
      disclaimerKey: 'educacional-nao-e-recomendacao',
    },
  };
}

function quietEdition(): Edition {
  const { briefing: _briefing, event: _event, ...value } = materialEdition();
  return {
    ...value,
    title: 'Mercado sem alteração relevante',
    summary: 'Não houve alteração relevante que justificasse uma página datada.',
    decision: {
      status: 'morno',
      reasonCodes: ['no-substantive-delta'],
      newsClusterIds: [],
    },
    items: [],
    sources: [],
  };
}

describe('parseEditorialBriefing', () => {
  it('accepts a complete briefing', () => {
    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
  });
});

describe('parseCalendarEvent', () => {
  it('accepts a calendar event with an official source', () => {
    expect(parseCalendarEvent(event, 'edition.event')).toEqual(event);
  });
});

describe('parseEdition', () => {
  it('accepts a schema 2 material edition with a complete briefing', () => {
    const value = materialEdition();
    expect(parseEdition(value)).toEqual(value);
  });

  it('rejects a schema 1 edition', () => {
    const { briefing: _briefing, event: _event, decision, ...edition } = materialEdition();
    const { eventId: _eventId, ...decisionWithoutEvent } = decision;

    expect(() => parseEdition({ ...edition, schemaVersion: 1, decision: decisionWithoutEvent })).toThrow(
      /schemaVersion must be 2/,
    );
  });

  it('requires a briefing for material editions', () => {
    const { briefing: _briefing, ...value } = materialEdition();

    expect(() => parseEdition(value)).toThrow(/briefing.*required|required.*briefing/i);
  });

  it('rejects a briefing in a quiet edition', () => {
    expect(() => parseEdition({ ...quietEdition(), briefing })).toThrow(/briefing.*quiet|briefing.*morno|quiet.*briefing/i);
  });

  it('rejects an event in a quiet edition', () => {
    expect(() => parseEdition({ ...quietEdition(), event })).toThrow(/event.*quiet|event.*morno|quiet.*event/i);
  });

  it('accepts a material edition without an event when eventId is absent', () => {
    const { event: _event, decision, ...edition } = materialEdition();
    const { eventId: _eventId, ...decisionWithoutEvent } = decision;
    const value = { ...edition, decision: decisionWithoutEvent };

    expect(parseEdition(value)).toEqual(value);
  });

  it('requires an event when decision.eventId exists', () => {
    const { event: _event, ...value } = materialEdition();

    expect(() => parseEdition(value)).toThrow(/event.*required|required.*event/i);
  });

  it('rejects an event when decision.eventId is absent', () => {
    const { event: _event, decision, ...edition } = materialEdition();
    const { eventId: _eventId, ...decisionWithoutEvent } = decision;

    expect(() => parseEdition({ ...edition, decision: decisionWithoutEvent, event })).toThrow(
      /event.*eventId|eventId.*event/i,
    );
  });

  it('rejects an event whose id differs from decision.eventId', () => {
    const value = { ...materialEdition(), event: { ...event, id: 'copom-outro' } };

    expect(() => parseEdition(value)).toThrow(/event\.id.*decision\.eventId|decision\.eventId.*event\.id/i);
  });

  it('rejects a briefing outside the documented length limits', () => {
    const invalidBriefings: EditorialBriefing[] = [
      { ...briefing, whatHappened: 'a'.repeat(239) },
      { ...briefing, whatHappened: 'a'.repeat(1601) },
      { ...briefing, whyItMatters: 'b'.repeat(199) },
      { ...briefing, whyItMatters: 'b'.repeat(1201) },
      { ...briefing, whatToWatch: ['c'.repeat(59), briefing.whatToWatch[1]] },
      { ...briefing, whatToWatch: [briefing.whatToWatch[0], 'd'.repeat(321)] },
    ];

    for (const invalid of invalidBriefings) {
      expect(() => parseEdition({ ...materialEdition(), briefing: invalid })).toThrow(/length|between|entre/i);
    }
  });

  it('accepts briefing prose at the documented length boundaries', () => {
    const value = {
      ...materialEdition(),
      briefing: {
        whatHappened: 'a'.repeat(240),
        whyItMatters: 'b'.repeat(200),
        whatToWatch: ['c'.repeat(60), 'd'.repeat(320), 'e'.repeat(60), 'f'.repeat(320)],
      },
    };

    expect(parseEdition(value)).toEqual(value);
  });

  it('rejects fewer than two or more than four watch items', () => {
    const invalidBriefings: EditorialBriefing[] = [
      { ...briefing, whatToWatch: [briefing.whatToWatch[0]] },
      { ...briefing, whatToWatch: [...briefing.whatToWatch, ...briefing.whatToWatch, ...briefing.whatToWatch] },
    ];

    for (const invalid of invalidBriefings) {
      expect(() => parseEdition({ ...materialEdition(), briefing: invalid })).toThrow(/whatToWatch|watch|two|four/i);
    }
  });

  it('rejects duplicate normalized watch items', () => {
    const first = briefing.whatToWatch[0];
    const duplicates = [
      first,
      first.toLocaleLowerCase('pt-BR'),
      'ACOMPANHE   OS PROXIMOS COMUNICADOS DO COPOM E COMPARE A LINGUAGEM COM A AVALIACAO DIVULGADA NESTA EDICAO.',
      'ＡＣＯＭＰＡＮＨＥ   ＯＳ ＰＲÓＸＩＭＯＳ ＣＯＭＵＮＩＣＡＤＯＳ ＤＯ ＣＯＰＯＭ Ｅ ＣＯＭＰＡＲＥ Ａ ＬＩＮＧＵＡＧＥＭ ＣＯＭ Ａ ＡＶＡＬＩＡÇÃＯ ＤＩＶＵＬＧＡＤＡ ＮＥＳＴＡ ＥＤＩÇÃＯ.',
    ];

    for (const duplicate of duplicates) {
      const value = { ...materialEdition(), briefing: { ...briefing, whatToWatch: [first, duplicate] } };
      expect(() => parseEdition(value)).toThrow(/whatToWatch.*duplicate|duplicate.*whatToWatch/i);
    }
  });

  it('rejects digits and HTML in every briefing prose field', () => {
    const mutations: EditorialBriefing[] = [
      { ...briefing, whatHappened: `${briefing.whatHappened} 1` },
      { ...briefing, whyItMatters: `${briefing.whyItMatters} 1` },
      { ...briefing, whatToWatch: [`${briefing.whatToWatch[0]} 1`, briefing.whatToWatch[1]] },
      { ...briefing, whatToWatch: [briefing.whatToWatch[0], `${briefing.whatToWatch[1]} 1`] },
      { ...briefing, whatHappened: `${briefing.whatHappened} <strong>destaque</strong>` },
      { ...briefing, whyItMatters: `${briefing.whyItMatters} <strong>destaque</strong>` },
      { ...briefing, whatToWatch: [`${briefing.whatToWatch[0]} <strong>destaque</strong>`, briefing.whatToWatch[1]] },
      { ...briefing, whatToWatch: [briefing.whatToWatch[0], `${briefing.whatToWatch[1]} <strong>destaque</strong>`] },
    ];

    for (const mutation of mutations) {
      expect(() => parseEdition({ ...materialEdition(), briefing: mutation })).toThrow(/digit|dígito|HTML/i);
    }
  });

  it('rejects control characters in every briefing prose field', () => {
    const mutations: EditorialBriefing[] = [
      { ...briefing, whatHappened: `${briefing.whatHappened}\u0000` },
      { ...briefing, whyItMatters: `${briefing.whyItMatters}\u0000` },
      { ...briefing, whatToWatch: [`${briefing.whatToWatch[0]}\u0000`, briefing.whatToWatch[1]] },
      { ...briefing, whatToWatch: [briefing.whatToWatch[0], `${briefing.whatToWatch[1]}\u0000`] },
    ];

    for (const mutation of mutations) {
      expect(() => parseEdition({ ...materialEdition(), briefing: mutation })).toThrow(/control|controle/i);
    }
  });

  it('rejects unknown briefing fields', () => {
    const value = {
      ...materialEdition(),
      briefing: { ...briefing, recommendation: 'Não incluído no contrato.' },
    };

    expect(() => parseEdition(value)).toThrow(/recommendation|unknown field/i);
  });

  it('accepts an approved lesson with a valid guide slug', () => {
    const value = { ...materialEdition(), lesson };
    expect(parseEdition(value)).toEqual(value);
  });

  it('preserves optional author and licenseUrl source attribution', () => {
    const value = materialEdition();
    value.sources[0].author = 'Ana Souza';
    value.sources[0].licenseUrl = 'https://creativecommons.org/licenses/by-nd/4.0/';

    expect(parseEdition(value)).toEqual(value);
  });

  it.each([
    ['author', 42, /author.*string/i],
    ['author', ' ', /author.*whitespace|length/i],
    ['author', 'Ana\u0000Souza', /author.*control/i],
    ['author', 'a'.repeat(501), /author.*length/i],
    ['licenseUrl', 42, /licenseUrl.*string/i],
    ['licenseUrl', 'http://creativecommons.org/licenses/by-nd/4.0/', /licenseUrl.*HTTPS/i],
    ['licenseUrl', 'https://user:secret@creativecommons.org/licenses/by-nd/4.0/', /licenseUrl.*credentials/i],
    ['licenseUrl', 'https://creativecommons.org/licenses/by-nd/4.0/#terms', /licenseUrl.*fragment/i],
  ])('rejects invalid optional source attribution field %s', (field, invalid, expected) => {
    const value = {
      ...materialEdition(),
      sources: [{ ...materialEdition().sources[0], [field]: invalid }],
    };

    expect(() => parseEdition(value)).toThrow(expected);
  });

  it('keeps SourceRef strict when optional attribution fields are supported', () => {
    const value = {
      ...materialEdition(),
      sources: [{ ...materialEdition().sources[0], attributionNote: 'Campo não declarado.' }],
    };

    expect(() => parseEdition(value)).toThrow(/attributionNote|unknown field/i);
  });

  it('rejects duplicate NewsItem.id with the conflicting path and identifier', () => {
    const value = materialEdition();
    value.items.push({ ...value.items[0] });

    expect(() => parseEdition(value)).toThrow(/edition\.items\[1\]\.id.*duplicate.*noticia-copom/i);
  });

  it('rejects duplicate SourceRef.id with the conflicting path and identifier', () => {
    const value = materialEdition();
    value.sources.push({ ...value.sources[0] });

    expect(() => parseEdition(value)).toThrow(/edition\.sources\[1\]\.id.*duplicate.*fonte-copom/i);
  });

  it('rejects a NewsItem.sourceIds reference to an unknown SourceRef.id', () => {
    const value = materialEdition();
    value.items[0].sourceIds = ['fonte-inexistente'];

    expect(() => parseEdition(value)).toThrow(
      /edition\.items\[0\]\.sourceIds\[0\].*SourceRef\.id.*fonte-inexistente/i,
    );
  });

  it('rejects a non-semver edition allowlistVersion', () => {
    const value = materialEdition();
    value.policy.allowlistVersion = 'latest';

    expect(() => parseEdition(value)).toThrow(/allowlistVersion.*semver/i);
  });

  it('accepts a valid hostname at the DNS maximum length', () => {
    const label = 'a'.repeat(63);
    const hostname = `${label}.${label}.${label}.${'a'.repeat(61)}`;
    const value = materialEdition();
    value.policy.allowedHosts = [hostname];

    expect(hostname).toHaveLength(253);
    expect(parseEdition(value).policy.allowedHosts).toEqual([hostname]);
  });

  it('rejects a hostname above the DNS maximum length', () => {
    const label = 'a'.repeat(63);
    const hostname = `${label}.${label}.${label}.${'a'.repeat(62)}`;
    const value = materialEdition();
    value.policy.allowedHosts = [hostname];

    expect(hostname).toHaveLength(254);
    expect(() => parseEdition(value)).toThrow(/253|hostname/i);
  });

  const proseMutations: { field: string; value: unknown }[] = [
    { field: 'title with a digit', value: { ...materialEdition(), title: 'Selic caiu 1%' } },
    { field: 'summary with a digit', value: { ...materialEdition(), summary: 'A meta ficou em 10,5%.' } },
    {
      field: 'headline with a digit',
      value: {
        ...materialEdition(),
        items: [{ ...materialEdition().items[0], headline: 'Inflação chega a 4,58%' }],
      },
    },
    {
      field: 'item summary with a digit',
      value: {
        ...materialEdition(),
        items: [{ ...materialEdition().items[0], summary: 'O dólar variou 1,25%.' }],
      },
    },
    {
      field: 'whyItMatters with a digit',
      value: {
        ...materialEdition(),
        items: [{ ...materialEdition().items[0], whyItMatters: 'A taxa agora é 10,5%.' }],
      },
    },
    { field: 'lesson title with a digit', value: { ...materialEdition(), lesson: { ...lesson, title: 'Regra dos 72' } } },
    { field: 'lesson body with a digit', value: { ...materialEdition(), lesson: { ...lesson, body: 'Espere 2 anos.' } } },
    { field: 'title with HTML', value: { ...materialEdition(), title: '<strong>Copom</strong> mantém sinal' } },
    {
      field: 'item summary with HTML',
      value: {
        ...materialEdition(),
        items: [{ ...materialEdition().items[0], summary: 'Leia <a href="https://example.com">aqui</a>.' }],
      },
    },
    { field: 'lesson body with HTML', value: { ...materialEdition(), lesson: { ...lesson, body: '<p>Juro real</p>' } } },
  ];

  it.each(proseMutations)('rejects $field', ({ value }) => {
    expect(() => parseEdition(value)).toThrow(/prosa|dígito|digit|HTML/i);
  });

  it('rejects an invalid decision status', () => {
    const value = {
      ...materialEdition(),
      decision: { ...materialEdition().decision, status: 'rascunho' },
    };
    expect(() => parseEdition(value)).toThrow(/decision\.status|status/i);
  });

  it('rejects an invalid snapshot status', () => {
    const value = {
      ...materialEdition(),
      snapshot: { ...materialEdition().snapshot, status: 'parcial' },
    };
    expect(() => parseEdition(value)).toThrow(/snapshot\.status|status/i);
  });

  it('rejects a missing required field', () => {
    const value: Partial<Edition> = materialEdition();
    delete value.title;
    expect(() => parseEdition(value)).toThrow(/title/i);
  });

  it('rejects an editorial indicator outside the BCB snapshot schema', () => {
    const value = {
      ...materialEdition(),
      snapshot: {
        ...materialEdition().snapshot,
        measured: {
          ...materialEdition().snapshot.measured,
          poupanca: { value: 7.12, observedOn: '2026-11-20', origin: 'bcb-sgs' },
        },
      },
    };
    expect(() => parseEdition(value)).toThrow(/measured|poupanca|snapshot/i);
  });

  it('rejects an undeclared numeric editorial payload', () => {
    expect(() => parseEdition({ ...materialEdition(), editorialNumbers: { dolar: 5.42 } })).toThrow(
      /editorialNumbers|unknown field|extra/i,
    );
  });

  it('rejects cripto because it is outside the editorial scope', () => {
    const value = {
      ...materialEdition(),
      items: [{ ...materialEdition().items[0], topic: 'cripto' }],
    };
    expect(() => parseEdition(value)).toThrow(/topic|cripto/i);
  });

  it.each([
    ['2026-02-30', /date|data/i],
    ['2026-11-23T25:00:00Z', /generatedAt|timestamp|data/i],
  ])('rejects the impossible date or timestamp %s', (invalid, expected) => {
    const value = invalid.includes('T')
      ? { ...materialEdition(), generatedAt: invalid }
      : { ...materialEdition(), date: invalid };
    expect(() => parseEdition(value)).toThrow(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects a non-finite measured value %s', (value) => {
    const edition = materialEdition();
    const invalid = {
      ...edition,
      snapshot: {
        ...edition.snapshot,
        measured: {
          ...edition.snapshot.measured,
          dolar: { value, observedOn: '2026-11-20', origin: 'bcb-sgs' },
        },
      },
    };
    expect(() => parseEdition(invalid)).toThrow(/value|finite|finita/i);
  });

  it('rejects an insecure canonical source URL', () => {
    const value = {
      ...materialEdition(),
      sources: [{ ...materialEdition().sources[0], canonicalUrl: 'http://www.bcb.gov.br/publicacoes/comunicados' }],
    };
    expect(() => parseEdition(value)).toThrow(/canonicalUrl|https|URL/i);
  });

  it('rejects credentials embedded in a canonical source URL', () => {
    const value = {
      ...materialEdition(),
      sources: [{ ...materialEdition().sources[0], canonicalUrl: 'https://user:secret@www.bcb.gov.br/noticia' }],
    };
    expect(() => parseEdition(value)).toThrow(/canonicalUrl|credentials|URL/i);
  });

  it('rejects control characters in editorial prose', () => {
    expect(() => parseEdition({ ...materialEdition(), summary: 'Comunicado\u0000 oficial.' })).toThrow(
      /controle|control|prosa/i,
    );
  });

  it('rejects overlong editorial prose', () => {
    expect(() => parseEdition({ ...materialEdition(), summary: 'a'.repeat(4001) })).toThrow(/summary|long|length/i);
  });

  it('rejects private source evidence in a published edition', () => {
    const value = {
      ...materialEdition(),
      sources: [{ ...materialEdition().sources[0], excerpt: 'Corpo copiado da matéria.' }],
    };
    expect(() => parseEdition(value)).toThrow(/excerpt|unknown field|extra/i);
  });
});

describe('schema 2 fixtures', () => {
  it('includes the approved calendar event in a material draft when decision.eventId exists', () => {
    const approvedVault = vault();
    const collected = inputs(DATE);
    approvedVault.calendar = [event];
    collected.events = [event];

    const value = draft(DATE, collected, approvedVault);

    expect(value.decision.eventId).toBe(event.id);
    expect(value.event).toEqual(event);
    expect(parseEdition(value)).toEqual(value);
  });

  it('omits briefing and event from quiet schema 2 drafts', () => {
    const value = draft('2026-11-22');

    expect(value.schemaVersion).toBe(2);
    expect(value.decision.status).toBe('morno');
    expect(value).not.toHaveProperty('briefing');
    expect(value).not.toHaveProperty('event');
    expect(parseEdition(value)).toEqual(value);
  });
});

describe('parseAllowlist', () => {
  const source: AllowlistSource = {
    id: 'bcb',
    publisher: 'Banco Central do Brasil',
    kind: 'official',
    feeds: [],
    enabled: false,
  };

  it('exposes the semver as allowlistVersion and keeps allowlist as the source array', () => {
    expect(parseAllowlist({ version: '1.2.3', sources: [source] })).toEqual({
      allowlistVersion: '1.2.3',
      allowlist: [source],
    });
  });

  it('requires an allowlist version', () => {
    expect(() => parseAllowlist({ sources: [source] })).toThrow(/allowlist\.version.*required/i);
  });

  it('preserves an optional verified licenseUrl on an allowlist source', () => {
    const licensed = {
      ...source,
      licenseUrl: 'https://creativecommons.org/licenses/by-nd/4.0/',
    };

    expect(parseAllowlist({ version: '1.2.3', sources: [licensed] })).toEqual({
      allowlistVersion: '1.2.3',
      allowlist: [licensed],
    });
  });

  it.each([
    [42, /licenseUrl.*string/i],
    ['http://creativecommons.org/licenses/by-nd/4.0/', /licenseUrl.*HTTPS/i],
    ['https://user:secret@creativecommons.org/licenses/by-nd/4.0/', /licenseUrl.*credentials/i],
    ['https://creativecommons.org/licenses/by-nd/4.0/#terms', /licenseUrl.*fragment/i],
  ])('rejects an invalid allowlist licenseUrl %j', (licenseUrl, expected) => {
    expect(() => parseAllowlist({
      version: '1.2.3',
      sources: [{ ...source, licenseUrl }],
    })).toThrow(expected);
  });

  it.each(['1.2', 'latest', '01.2.3', '1.2.3-01'])('rejects the invalid semver %s', (version) => {
    expect(() => parseAllowlist({ version, sources: [source] })).toThrow(/allowlist\.version.*semver/i);
  });
});
