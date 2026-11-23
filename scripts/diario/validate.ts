import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentDateBrt } from '../../src/lib/diario/time';
import { loadValidationContext, validateAndPublish, validateEdition } from '../../src/lib/diario/validate';

try {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const positional = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--root');
  const date = positional[0] ?? currentDateBrt();
  const rootIndex = args.indexOf('--root');
  if (
    positional.length > 1 ||
    args.some((arg) => arg.startsWith('--') && arg !== '--root' && arg !== '--publish') ||
    (rootIndex >= 0 && !args[rootIndex + 1])
  ) {
    throw new Error('Usage: diario:validate [YYYY-MM-DD] [--root <path>] [--publish]');
  }
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();

  if (publish) {
    const path = validateAndPublish(date, root);
    console.log(`Edição validada e publicada: ${path}`);
  } else {
    const context = loadValidationContext(date, root);
    const draftPath = join(context.root!, '.cache/diario', date, 'draft.json');
    const bytes = readFileSync(draftPath);
    if (bytes.length > 5_000_000) throw new Error('draft.json exceeds the maximum size');
    const draft = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    const edition = validateEdition(draft, context);
    console.log(`Edição validada: ${edition.date}; ${edition.decision.status}; nenhum arquivo publicado.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na validação do Diário do Investidor.');
  process.exitCode = 1;
}
