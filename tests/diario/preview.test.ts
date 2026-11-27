import { describe, expect, it } from 'vitest';
import { curateCollectedInputs } from '../../src/lib/diario/curation';
import { buildSimulationDraft } from '../../src/lib/diario/preview';
import { validateEdition } from '../../src/lib/diario/validate';
import { inputs, sourceForDate, vault } from './fixtures';

describe('buildSimulationDraft', () => {
  it('builds a neutral structural preview from selected metadata and topic context', () => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      title: 'Pix ganha nova regra',
      excerpt: 'O meio de pagamento Pix e a conta de pagamento ganham nova regra.',
    })];
    const approvedVault = vault();
    const result = curateCollectedInputs(collected, [], approvedVault);

    const draft = buildSimulationDraft(collected, result, approvedVault, []);

    expect(draft.generatedAt).toBe(collected.retrievedAt);
    expect(draft.title).toMatch(/pr[eé]via estrutural/iu);
    expect(draft.summary).toMatch(/n[aã]o [ée] reda[cç][aã]o final|n[aã]o constitui reda[cç][aã]o final/iu);
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].headline).toContain('Pix');
    expect(draft.items[0].sourceIds).toEqual([collected.sources[0].id]);
    expect(JSON.stringify({
      title: draft.title,
      summary: draft.summary,
      items: draft.items,
      briefing: draft.briefing,
    })).not.toMatch(/\p{N}|<|>/u);
    expect(draft.sources).toHaveLength(1);
    expect(draft.sources[0]).not.toHaveProperty('excerpt');
    expect(draft.sources[0]).not.toHaveProperty('excerptSha256');
    expect(draft.sources[0]).not.toHaveProperty('feedUrl');
    expect(draft.provenance.promptVersion).toBe('diario-simulate');
    expect(validateEdition(draft, {
      vault: approvedVault,
      selection: result.selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toEqual(draft);
  });

  it.each([
    'Fórum Pix projeta avanços para 2027',
    'BC - Resolução CMN N° 5.351 de 26/11/2026',
  ])('uses a neutral headline instead of deleting numbers from %s', (title) => {
    const collected = inputs('2026-11-24');
    collected.sources = [sourceForDate('2026-11-24', {
      title,
      excerpt: 'O meio de pagamento Pix e a regra de crédito são atualizados.',
    })];
    const approvedVault = vault();
    const result = curateCollectedInputs(collected, [], approvedVault);

    const draft = buildSimulationDraft(collected, result, approvedVault, []);

    expect(draft.items[0]?.headline).toBe('Prévia de fato sobre pagamentos, crédito e endividamento');
    expect(draft.items[0]?.headline).not.toMatch(/\p{N}|<|>/u);
  });

  it('uses the deterministic briefing for a material preview without news', () => {
    const collected = inputs('2026-11-24');
    collected.bcb.dolar = [
      { value: 5.05, date: '2026-11-24' },
      { value: 4.99, date: '2026-11-20' },
    ];
    const approvedVault = vault();
    const result = curateCollectedInputs(collected, [], approvedVault);

    const draft = buildSimulationDraft(collected, result, approvedVault, []);

    expect(result.decision.reasonCodes).toEqual(['dollar-trigger']);
    expect(draft.items).toEqual([]);
    expect(draft.briefing).toEqual(result.briefing);
    expect(validateEdition(draft, {
      vault: approvedVault,
      selection: result.selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toEqual(draft);
  });

  it('keeps a quiet preview free of news, sources and briefing', () => {
    const collected = inputs('2026-11-24');
    const approvedVault = vault();
    const result = curateCollectedInputs(collected, [], approvedVault);

    const draft = buildSimulationDraft(collected, result, approvedVault, []);

    expect(draft.decision.status).toBe('morno');
    expect(draft.items).toEqual([]);
    expect(draft.sources).toEqual([]);
    expect(draft).not.toHaveProperty('briefing');
    expect(validateEdition(draft, {
      vault: approvedVault,
      selection: result.selection,
      evidence: collected.sources,
      collected,
      previousEditions: [],
    })).toEqual(draft);
  });
});
