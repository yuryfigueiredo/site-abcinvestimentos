import { buildDeterministicBriefing } from './briefing';
import {
  analyzeCandidates,
  buildBcbSnapshot,
  buildSelectionFromClusters,
  decideEditionFromClusters,
  diagnosticFor,
  historyIsValid,
  publicPolicy,
  recentMaterialEditions,
} from './curate';
import { parseSelection } from './schema';
import type { CollectedInputs, CurationResult, Edition, Vault } from './types';

function deterministicBriefing(
  inputs: CollectedInputs,
  previous: Edition[],
  vault: Vault,
  result: Omit<CurationResult, 'briefing' | 'diagnostics'>,
) {
  const event = result.decision.eventId === undefined
    ? undefined
    : vault.calendar.find((candidate) => candidate.id === result.decision.eventId);
  const lesson = result.decision.lessonId === undefined
    ? undefined
    : vault.lessons.find((candidate) => candidate.id === result.decision.lessonId);
  const edition: Edition = {
    schemaVersion: 2,
    id: `diario-${inputs.date}`,
    date: inputs.date,
    generatedAt: inputs.retrievedAt,
    title: 'Edição material do Diário do Investidor',
    summary: 'Briefing determinístico gerado a partir dos fatos aprovados pela curadoria.',
    snapshot: buildBcbSnapshot(inputs, previous),
    decision: result.decision,
    items: [],
    sources: [],
    ...(event === undefined ? {} : { event }),
    ...(lesson === undefined ? {} : { lesson }),
    relatedCalculatorSlug: 'renda-fixa',
    policy: publicPolicy(vault),
    provenance: {
      generator: 'qoder-diario',
      promptVersion: 'diario-curate',
      disclaimerKey: 'educacional-nao-e-recomendacao',
    },
  };
  return buildDeterministicBriefing(edition, vault);
}

export function curateCollectedInputs(
  inputs: CollectedInputs,
  previous: Edition[],
  vault: Vault,
  historyUnavailable = false,
): CurationResult {
  if (historyUnavailable || !historyIsValid(previous, inputs.date)) {
    const decision = { status: 'morno' as const, reasonCodes: ['history-unavailable' as const], newsClusterIds: [] };
    return {
      decision,
      selection: parseSelection({ date: inputs.date, decision, clusters: [], selectedSources: [] }),
      diagnostics: inputs.sources.map((source) => diagnosticFor(source, 'history-unavailable')),
    };
  }

  const materialHistory = recentMaterialEditions(previous);
  const analysis = analyzeCandidates(inputs, materialHistory, vault);
  const decision = decideEditionFromClusters(inputs, previous, vault, analysis.clusters);
  const selection = parseSelection(buildSelectionFromClusters(inputs, decision, analysis.clusters));
  const result = { decision, selection, diagnostics: analysis.diagnostics };
  if (decision.status === 'material' && decision.newsClusterIds.length === 0) {
    return { ...result, briefing: deterministicBriefing(inputs, previous, vault, result) };
  }
  return result;
}
