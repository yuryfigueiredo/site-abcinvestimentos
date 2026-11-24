import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDeterministicBriefing } from '../../src/lib/diario/briefing';
import { verifyGovernance } from '../../src/lib/diario/governance';
import { parseCalendarEvent, parseEdition, parseEditorialBriefing } from '../../src/lib/diario/schema';
import type { CalendarEvent, Edition } from '../../src/lib/diario/types';
import { DATE, draft, inputs, source, vault } from './fixtures';

function dollarEdition(value: number): Edition {
  const collected = inputs();
  collected.bcb.dolar = [
    { value, date: DATE },
    { value: 4.99, date: '2026-11-20' },
  ];
  return draft(DATE, collected);
}

function eventEdition(event: CalendarEvent): Edition {
  const collected = inputs('2026-11-24');
  const approvedVault = vault();
  collected.events = [event];
  approvedVault.calendar = [event];
  collected.lessons = approvedVault.lessons;
  return draft('2026-11-24', collected, approvedVault);
}

describe('buildDeterministicBriefing', () => {
  it.each([
    { value: 5.05, direction: 'alta' },
    { value: 4.94, direction: 'baixa' },
  ])('builds deterministic briefing for a dollar-trigger edition in $direction', ({ value, direction }) => {
    const edition = dollarEdition(value);
    expect(edition.decision).toMatchObject({
      status: 'material',
      reasonCodes: ['dollar-trigger'],
      newsClusterIds: [],
    });
    expect(edition.items).toEqual([]);

    const briefing = buildDeterministicBriefing(edition, vault());

    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
    expect(briefing.whatHappened).toMatch(/d[oó]lar/iu);
    expect(briefing.whatHappened).toMatch(/limiar/iu);
    expect(briefing.whatHappened).toMatch(new RegExp(direction, 'iu'));
    expect(JSON.stringify(briefing)).not.toMatch(/\p{N}/u);
    expect(briefing.whatToWatch.length).toBeGreaterThanOrEqual(2);
    expect(briefing.whatToWatch.length).toBeLessThanOrEqual(4);
  });

  it('uses the approved event in an event briefing', () => {
    const event: CalendarEvent = {
      id: 'ipca-2026-11-24',
      date: '2026-11-24',
      title: 'Divulgação do IPCA',
      sourceUrl: 'https://www.ibge.gov.br/estatisticas/indices/precos/ipca',
    };
    const edition = eventEdition(event);
    const approvedVault = vault();
    approvedVault.calendar = [event];
    expect(edition.decision).toMatchObject({
      status: 'material',
      reasonCodes: ['calendar-event'],
      eventId: event.id,
      newsClusterIds: [],
    });

    const briefing = buildDeterministicBriefing(edition, approvedVault);

    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
    expect(briefing.whatHappened).toContain(event.title);
    expect(briefing.whatHappened).toMatch(/infla[cç][aã]o/iu);
    expect(JSON.stringify(briefing)).not.toMatch(/\p{N}/u);
  });

  it('uses a safe topical reference when an approved event title is not prose-safe', () => {
    const event: CalendarEvent = {
      id: 'ipca-2026-11-24',
      date: '2026-11-24',
      title: 'IPCA 2026 <dados>',
      sourceUrl: 'https://www.ibge.gov.br/estatisticas/indices/precos/ipca',
    };
    expect(parseCalendarEvent(event, 'event')).toEqual(event);
    const approvedVault = vault();
    const edition = eventEdition({ ...event, title: 'Divulgação do IPCA' });
    edition.event = event;
    approvedVault.calendar = [event];
    const parsedEdition = parseEdition(edition);
    expect(parsedEdition.event).toEqual(event);

    const briefing = buildDeterministicBriefing(parsedEdition, approvedVault);

    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
    expect(JSON.stringify(briefing)).not.toMatch(/\p{N}/u);
    expect(JSON.stringify(briefing)).not.toMatch(/<|>|&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/iu);
    expect(briefing.whatHappened).not.toContain(event.title);
    expect(briefing.whatHappened).toMatch(/infla[cç][aã]o/iu);
  });

  it('uses the approved lesson in a monday-lesson briefing', () => {
    const approvedVault = vault();
    const edition = draft();
    const lesson = approvedVault.lessons.find((candidate) => candidate.id === edition.decision.lessonId);
    expect(lesson).toBeDefined();
    expect(new Date(`${edition.date}T00:00:00Z`).getUTCDay()).toBe(approvedVault.thresholds.lessonWeekday);
    expect(edition.decision).toMatchObject({
      status: 'material',
      reasonCodes: ['monday-lesson'],
      newsClusterIds: [],
    });

    const briefing = buildDeterministicBriefing(edition, approvedVault);

    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
    expect(briefing.whatHappened).toContain(lesson!.title);
    expect(briefing.whatHappened).toContain(lesson!.body);
    expect(JSON.stringify(briefing)).not.toMatch(/\p{N}/u);
  });

  it('falls back conservatively to the approved reason codes and edition title', () => {
    const { lesson: _lesson, ...edition } = draft();
    edition.decision = { status: 'material', reasonCodes: ['official-news'], newsClusterIds: [] };
    edition.title = 'Contexto aprovado para o investidor';

    const briefing = buildDeterministicBriefing(edition, vault());

    expect(parseEditorialBriefing(briefing)).toEqual(briefing);
    expect(briefing.whatHappened).toContain(edition.title);
    expect(briefing.whatHappened).toMatch(/not[ií]cia oficial/iu);
    expect(JSON.stringify(briefing)).not.toMatch(/\p{N}/u);
  });

  it('returns identical output for identical approved facts', () => {
    const first = dollarEdition(5.05);
    const second = dollarEdition(5.05);

    expect(buildDeterministicBriefing(first, vault())).toEqual(buildDeterministicBriefing(second, vault()));
  });

  it('rejects quiet editions and news editions', () => {
    const quiet = draft('2026-11-24');
    const collected = inputs();
    collected.sources = [source()];
    const news = draft(DATE, collected);

    expect(() => buildDeterministicBriefing(quiet, vault())).toThrow(/quiet|morno/iu);
    expect(() => buildDeterministicBriefing(news, vault())).toThrow(/news|not[ií]cia/iu);
  });

  it('rejects an event reference absent from the approved calendar', () => {
    const event: CalendarEvent = {
      id: 'copom-2026-11-24',
      date: '2026-11-24',
      title: 'Reunião do Copom',
      sourceUrl: 'https://www.bcb.gov.br/publicacoes/comunicados/copom',
    };
    const edition = eventEdition(event);

    expect(() => buildDeterministicBriefing(edition, vault())).toThrow(/event|calendar|calend[aá]rio/iu);
  });

  it('rejects a lesson reference absent from the approved lessons', () => {
    const edition = draft();
    const approvedVault = vault();
    approvedVault.lessons = [];

    expect(() => buildDeterministicBriefing(edition, approvedVault)).toThrow(/lesson|li[cç][aã]o/iu);
  });

  it('uses the deterministic briefing in no-news fixtures', () => {
    const edition = draft();

    expect(edition.briefing).toEqual(buildDeterministicBriefing(edition, vault()));
  });

  it('migrates the dollar seed to the deterministic briefing without changing its facts', () => {
    const path = join(process.cwd(), 'src/data/diario/edicoes/2026-11-23.json');
    const edition = parseEdition(JSON.parse(readFileSync(path, 'utf8')));
    const approvedVault = verifyGovernance(process.cwd());

    expect(edition.briefing).toEqual(buildDeterministicBriefing(edition, approvedVault));
    expect(edition.snapshot.dollarChangePct).toBeCloseTo(1.390752092920581, 12);
    expect(edition.decision).toEqual({
      status: 'material',
      reasonCodes: ['dollar-trigger'],
      newsClusterIds: [],
    });
  });
});
