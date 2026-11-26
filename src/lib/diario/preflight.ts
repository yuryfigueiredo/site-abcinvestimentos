import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REQUIRED_FILES = [
  'src/data/diario/curadoria/allowlist.json',
  'src/data/diario/curadoria/approval.json',
  'src/data/diario/curadoria/calendario.json',
  'src/data/diario/curadoria/carta.md',
  'src/data/diario/curadoria/changelog.md',
  'src/data/diario/curadoria/licoes.json',
  'src/data/diario/curadoria/thresholds.json',
  'src/pages/diario-do-investidor/index.astro',
  'src/pages/diario-do-investidor/[date].astro',
  'src/pages/diario-do-investidor/metodologia.astro',
  'src/pages/api/diario/edicao.json.ts',
] as const;

export const DIARIO_AUTOMATION_CONTRACT = {
  root: '/home/yury/Documentos/Projeto/abcinvestimentos',
  branch: 'main',
  remote: 'git@github.com-abcinvestimentos:yuryfigueiredo/site-abcinvestimentos.git',
  requiredFiles: REQUIRED_FILES,
} as const;

function physicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    throw new Error(`Caminho inexistente ou inacessível: ${path}`);
  }
}

function git(root: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error(`Não foi possível ler o repositório Git em ${root}: git ${args.join(' ')}`);
  }
}

export function verifyDiarioPreflight(actualRoot: string, expectedRoot: string = DIARIO_AUTOMATION_CONTRACT.root): void {
  const expected = physicalPath(expectedRoot);
  const actual = physicalPath(actualRoot);
  if (actual !== expected) {
    throw new Error(`Pasta de trabalho incorreta: esperado ${expected}; encontrado ${actual}.`);
  }

  const gitRoot = physicalPath(git(actual, ['rev-parse', '--show-toplevel']));
  if (gitRoot !== actual) {
    throw new Error(`Raiz Git incorreta: esperado ${expected}; encontrado ${gitRoot}.`);
  }

  const commonDir = physicalPath(resolve(actual, git(actual, ['rev-parse', '--git-common-dir'])));
  if (commonDir !== physicalPath(join(actual, '.git'))) {
    throw new Error(`Worktree não permitido: execute no checkout canônico ${expected}.`);
  }

  const branch = git(actual, ['branch', '--show-current']);
  if (branch !== DIARIO_AUTOMATION_CONTRACT.branch) {
    throw new Error(
      `Branch incorreta: esperado ${DIARIO_AUTOMATION_CONTRACT.branch}; encontrado ${branch || 'HEAD detached'}.`,
    );
  }

  const fetchRemotes = git(actual, ['remote', 'get-url', '--all', 'origin']).split('\n');
  if (fetchRemotes.length !== 1 || fetchRemotes[0] !== DIARIO_AUTOMATION_CONTRACT.remote) {
    throw new Error(
      `Remote origin incorreto para pull: esperado ${DIARIO_AUTOMATION_CONTRACT.remote}; encontrado ${fetchRemotes.join(', ') || 'nenhum'}.`,
    );
  }

  const pushRemotes = git(actual, ['remote', 'get-url', '--all', '--push', 'origin']).split('\n');
  if (pushRemotes.length !== 1 || pushRemotes[0] !== DIARIO_AUTOMATION_CONTRACT.remote) {
    throw new Error(
      `Remote origin incorreto para push: esperado ${DIARIO_AUTOMATION_CONTRACT.remote}; encontrado ${pushRemotes.join(', ') || 'nenhum'}.`,
    );
  }

  try {
    git(actual, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    throw new Error('Repositório sem commit válido: a automação exige um HEAD versionado.');
  }

  for (const file of DIARIO_AUTOMATION_CONTRACT.requiredFiles) {
    const path = join(actual, file);
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`Arquivo obrigatório ausente ou inválido: ${file}`);
    }
    if (readFileSync(path, 'utf8').trim().length === 0) {
      throw new Error(`Arquivo obrigatório vazio: ${file}`);
    }
    try {
      git(actual, ['ls-files', '--error-unmatch', '--', file]);
    } catch {
      throw new Error(`Arquivo obrigatório não rastreado: ${file}`);
    }
  }

  const dirty = git(actual, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (dirty) {
    throw new Error(`Árvore de trabalho suja: conclua ou preserve as alterações locais antes da automação.\n${dirty}`);
  }
}
