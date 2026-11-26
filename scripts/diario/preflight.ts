import { verifyDiarioPreflight } from '../../src/lib/diario/preflight';

try {
  verifyDiarioPreflight(process.cwd());
  console.log(`Preflight do Diário aprovado: ${process.cwd()}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida no preflight do Diário do Investidor.');
  process.exitCode = 1;
}
