import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSelection, decideEdition } from '../../src/lib/diario/curate';
import { parseSelection } from '../../src/lib/diario/schema';
import { currentDateBrt } from '../../src/lib/diario/time';
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
  console.log(`Curadoria concluída: ${date}; ${decision.status}; ${selection.selectedSources.length} fontes selecionadas.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na curadoria do Diário do Investidor.');
  process.exitCode = 1;
}
