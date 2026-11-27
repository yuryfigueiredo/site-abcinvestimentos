import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diarioCachePath } from './cache';
import { curateCollectedInputs } from './curation';
import { verifyGovernance } from './governance';
import { collectInputs } from './ingest';
import { buildSimulationDraft } from './preview';
import { currentDateBrt, isCalendarDate, parseCalendarDate } from './time';
import { loadPreviousEditions, validateEdition } from './validate';
import type { CollectedInputs, CollectOptions, CurationResult, Edition } from './types';

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export type SimulateOptions = Omit<CollectOptions, 'cacheScope'> & { asOf: string };

export type SimulationResult = {
  inputs: CollectedInputs;
  selection: CurationResult['selection'];
  diagnostics: CurationResult['diagnostics'];
  draft: Edition;
  report: {
    date: string;
    retrievedAt: string;
    referenceAt: string;
    status: Edition['decision']['status'];
    selectedSources: number;
    cacheDirectory: string;
    published: false;
    limitation: string;
  };
};

function referenceInstant(asOf: string, now: Date): string {
  if (typeof asOf !== 'string' || !ISO_TIMESTAMP.test(asOf) || !isCalendarDate(asOf.slice(0, 10))) {
    throw new Error('asOf must be a valid ISO timestamp with timezone');
  }
  const instant = new Date(asOf);
  if (!Number.isFinite(instant.getTime())) throw new Error('asOf must be a valid ISO timestamp with timezone');
  if (instant.getTime() < now.getTime()) {
    throw new Error('asOf must not be earlier than the real retrievedAt instant');
  }
  return instant.toISOString();
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function simulateDiario(date: string, options: SimulateOptions): Promise<SimulationResult> {
  parseCalendarDate(date, 'simulation date');
  const now = options.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('now must be a valid Date instant');
  const referenceAt = referenceInstant(options.asOf, now);
  if (currentDateBrt(new Date(referenceAt)) !== date) {
    throw new Error('Simulation date must match the America/Sao_Paulo date of asOf');
  }

  const root = resolve(options.root ?? process.cwd());
  const inputs = await collectInputs(date, {
    root,
    now,
    fetch: options.fetch,
    referenceAt,
    cacheScope: 'simulation',
  });
  const vault = verifyGovernance(root);
  const history = loadPreviousEditions(date, root);
  const result = curateCollectedInputs(inputs, history.editions, vault, history.unavailable);
  const draft = buildSimulationDraft(inputs, result, vault, history.editions);
  validateEdition(draft, {
    vault,
    selection: result.selection,
    evidence: inputs.sources,
    collected: inputs,
    previousEditions: history.editions,
    historyUnavailable: history.unavailable,
    root,
  });

  const cache = diarioCachePath(root, date, 'simulation');
  mkdirSync(cache, { recursive: true });
  writeJson(join(cache, 'selection.json'), result.selection);
  writeJson(join(cache, 'diagnostics.json'), result.diagnostics);
  writeJson(join(cache, 'draft.json'), draft);
  const briefingPath = join(cache, 'briefing.json');
  if (draft.briefing === undefined) rmSync(briefingPath, { force: true });
  else writeJson(briefingPath, draft.briefing);

  return {
    inputs,
    selection: result.selection,
    diagnostics: result.diagnostics,
    draft,
    report: {
      date,
      retrievedAt: inputs.retrievedAt,
      referenceAt,
      status: draft.decision.status,
      selectedSources: result.selection.selectedSources.length,
      cacheDirectory: cache,
      published: false,
      limitation:
        'A simulação conhece somente o que foi coletado até retrievedAt; referenceAt não incorpora publicações posteriores à coleta real.',
    },
  };
}
