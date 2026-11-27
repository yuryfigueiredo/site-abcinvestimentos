import { simulateDiario } from '../../src/lib/diario/simulate';
import { currentDateBrt } from '../../src/lib/diario/time';

try {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const asOfIndex = args.indexOf('--as-of');
  const positional = args.filter((arg, index) =>
    !arg.startsWith('--') && args[index - 1] !== '--root' && args[index - 1] !== '--as-of',
  );
  if (
    positional.length > 1 ||
    asOfIndex < 0 ||
    args.indexOf('--as-of', asOfIndex + 1) >= 0 ||
    args.indexOf('--root', rootIndex + 1) >= 0 ||
    args.some((arg) => arg.startsWith('--') && arg !== '--root' && arg !== '--as-of') ||
    (asOfIndex >= 0 && (!args[asOfIndex + 1] || args[asOfIndex + 1].startsWith('--'))) ||
    (rootIndex >= 0 && (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--')))
  ) {
    throw new Error('Usage: diario:simulate [YYYY-MM-DD] --as-of <ISO> [--root <path>]');
  }
  const date = positional[0] ?? currentDateBrt();
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
  const result = await simulateDiario(date, { root, asOf: args[asOfIndex + 1] });
  console.log(`Simulação concluída: ${result.draft.date}; ${result.draft.decision.status}; ${result.report.selectedSources} fontes selecionadas.`);
  console.log(`Cache isolado: ${result.report.cacheDirectory}`);
  console.log(result.report.limitation);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na simulação do Diário do Investidor.');
  process.exitCode = 1;
}
