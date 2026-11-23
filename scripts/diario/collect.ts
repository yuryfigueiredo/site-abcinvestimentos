import { collectInputs } from '../../src/lib/diario/ingest';
import { currentDateBrt } from '../../src/lib/diario/time';

try {
  const date = process.argv[2] ?? currentDateBrt();
  const inputs = await collectInputs(date, { root: process.cwd() });
  console.log(`Coleta concluída: ${inputs.date}; ${inputs.sources.length} fontes RSS; cache em .cache/diario/${inputs.date}/inputs.json`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na coleta do Diário do Investidor.');
  process.exitCode = 1;
}
