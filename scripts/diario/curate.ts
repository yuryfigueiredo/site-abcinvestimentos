import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { curateCollectedInputs } from '../../src/lib/diario/curation';
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
  const result = curateCollectedInputs(
    context.collected,
    context.previousEditions,
    context.vault,
    context.historyUnavailable,
  );
  const { decision, selection, diagnostics, briefing } = result;
  const path = join(context.root, '.cache/diario', date, 'selection.json');
  const diagnosticsPath = join(context.root, '.cache/diario', date, 'diagnostics.json');
  const briefingPath = join(context.root, '.cache/diario', date, 'briefing.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(selection, null, 2)}\n`, 'utf8');
  writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
  if (briefing) writeFileSync(briefingPath, `${JSON.stringify(briefing, null, 2)}\n`, 'utf8');
  else rmSync(briefingPath, { force: true });
  console.log(`Curadoria concluída: ${date}; ${decision.status}; ${selection.selectedSources.length} fontes selecionadas.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na curadoria do Diário do Investidor.');
  process.exitCode = 1;
}
