import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDeterministicBriefing } from '../../src/lib/diario/briefing';
import { buildBcbSnapshot, buildSelection, decideEdition, publicPolicy } from '../../src/lib/diario/curate';
import { parseEditorialBriefing, parseSelection } from '../../src/lib/diario/schema';
import { currentDateBrt } from '../../src/lib/diario/time';
import type { Edition } from '../../src/lib/diario/types';
import { loadCurationContext } from '../../src/lib/diario/validate';

try {
  const args = process.argv.slice(2);
  const date = args[0] ?? currentDateBrt();
  const rootIndex = args.indexOf('--root');
  if (args.some((arg) => arg.startsWith('--') && arg !== '--root') || (rootIndex >= 0 && !args[rootIndex + 1])) {
    throw new Error('Usage: diario:curate [YYYY-MM-DD] [--root <path>]');
  }
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
  const context = loadCurationContext(date, root);
  const decision = context.historyUnavailable
    ? { status: 'morno' as const, reasonCodes: ['history-unavailable' as const], newsClusterIds: [] }
    : decideEdition(context.collected, context.previousEditions, context.vault);
  const selection = parseSelection(buildSelection(context.collected, decision, context.vault, context.previousEditions));
  const path = join(context.root, '.cache/diario', date, 'selection.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(selection, null, 2)}\n`, 'utf8');
  if (decision.status === 'material' && decision.newsClusterIds.length === 0) {
    const event = decision.eventId === undefined
      ? undefined
      : context.vault.calendar.find((candidate) => candidate.id === decision.eventId);
    const lesson = decision.lessonId === undefined
      ? undefined
      : context.vault.lessons.find((candidate) => candidate.id === decision.lessonId);
    const edition: Edition = {
      schemaVersion: 2,
      id: `diario-${date}`,
      date,
      generatedAt: context.collected.retrievedAt,
      title: 'Edição material do Diário do Investidor',
      summary: 'Briefing determinístico gerado a partir dos fatos aprovados pela curadoria.',
      snapshot: buildBcbSnapshot(context.collected, context.previousEditions),
      decision,
      items: [],
      sources: [],
      ...(event === undefined ? {} : { event }),
      ...(lesson === undefined ? {} : { lesson }),
      relatedCalculatorSlug: 'renda-fixa',
      policy: publicPolicy(context.vault),
      provenance: {
        generator: 'qoder-diario',
        promptVersion: 'diario-curate',
        disclaimerKey: 'educacional-nao-e-recomendacao',
      },
    };
    const briefing = parseEditorialBriefing(buildDeterministicBriefing(edition, context.vault));
    const briefingPath = join(context.root, '.cache/diario', date, 'briefing.json');
    writeFileSync(briefingPath, `${JSON.stringify(briefing, null, 2)}\n`, 'utf8');
  }
  console.log(`Curadoria concluída: ${date}; ${decision.status}; ${selection.selectedSources.length} fontes selecionadas.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na curadoria do Diário do Investidor.');
  process.exitCode = 1;
}
