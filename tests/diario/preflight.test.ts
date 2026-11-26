import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyDiarioPreflight } from '../../src/lib/diario/preflight';

const roots: string[] = [];
const remote = 'git@github.com-abcinvestimentos:yuryfigueiredo/site-abcinvestimentos.git';
const requiredFiles = [
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
];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function createRepository(commit = true): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-preflight-'));
  roots.push(root);
  execFileSync('git', ['init', '-b', 'main', root], { stdio: 'ignore' });
  git(root, ['remote', 'add', 'origin', remote]);
  for (const file of requiredFiles) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `conteudo de ${file}\n`, 'utf8');
  }
  if (commit) commitFixture(root);
  return root;
}

function commitFixture(root: string): void {
  git(root, ['config', 'user.name', 'Diário Test']);
  git(root, ['config', 'user.email', 'diario@example.invalid']);
  git(root, ['add', ...requiredFiles]);
  git(root, ['commit', '-m', 'fixture']);
}

describe('Preflight da automação do Diário', () => {
  it('accepts the canonical repository without writing cache or lock', () => {
    const root = createRepository();

    expect(() => verifyDiarioPreflight(root, root)).not.toThrow();
    expect(existsSync(join(root, '.cache'))).toBe(false);
  });

  it('rejects an empty required file', () => {
    const root = createRepository();
    writeFileSync(join(root, requiredFiles[0]), '', 'utf8');

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Arquivo obrigatório vazio/u);
  });

  it('rejects a whitespace-only required file', () => {
    const root = createRepository();
    writeFileSync(join(root, requiredFiles[0]), ' \n\t', 'utf8');

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Arquivo obrigatório vazio/u);
  });

  it('rejects an untracked required file', () => {
    const root = createRepository();
    git(root, ['rm', '--cached', '--', requiredFiles[0]]);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Arquivo obrigatório não rastreado/u);
  });

  it('rejects a repository without a valid commit', () => {
    const root = createRepository(false);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/sem commit válido/u);
  });

  it('rejects tracked modifications before any cache or lock is written', () => {
    const root = createRepository();
    writeFileSync(join(root, requiredFiles[0]), 'alteração local\n', 'utf8');

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Árvore de trabalho suja/u);
    expect(existsSync(join(root, '.cache'))).toBe(false);
    expect(existsSync(join(root, '.diario-automation.lock'))).toBe(false);
  });

  it('rejects staged changes', () => {
    const root = createRepository();
    writeFileSync(join(root, requiredFiles[0]), 'alteração preparada\n', 'utf8');
    git(root, ['add', requiredFiles[0]]);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Árvore de trabalho suja/u);
  });

  it('rejects unrelated untracked files', () => {
    const root = createRepository();
    writeFileSync(join(root, 'arquivo-local.txt'), 'não versionado\n', 'utf8');

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Árvore de trabalho suja/u);
  });

  it('rejects a different physical root before reading Git metadata', () => {
    const root = createRepository();
    const wrongRoot = join(root, 'outra-pasta');
    mkdirSync(wrongRoot);

    expect(() => verifyDiarioPreflight(wrongRoot, root)).toThrow(/Pasta de trabalho incorreta/u);
  });

  it('rejects a linked worktree even when its path and remote look valid', () => {
    const source = createRepository();
    git(source, ['branch', 'source']);
    git(source, ['checkout', 'source']);
    const worktree = mkdtempSync(join(tmpdir(), 'diario-preflight-worktree-'));
    roots.push(worktree);
    rmSync(worktree, { recursive: true, force: true });
    git(source, ['worktree', 'add', worktree, 'main']);

    expect(() => verifyDiarioPreflight(worktree, worktree)).toThrow(/Worktree não permitido/u);
  });

  it('rejects a non-main branch', () => {
    const root = createRepository();
    git(root, ['checkout', '-b', 'feature/outra']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Branch incorreta.*main.*feature\/outra/u);
  });

  it('rejects detached HEAD', () => {
    const root = createRepository();
    git(root, ['checkout', '--detach', 'HEAD']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/Branch incorreta.*HEAD detached/u);
  });

  it('rejects a different fetch remote', () => {
    const root = createRepository();
    git(root, ['remote', 'set-url', 'origin', 'git@github.com:outro/repositorio.git']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/remote origin incorreto para pull/iu);
  });

  it('rejects a different push remote', () => {
    const root = createRepository();
    git(root, ['remote', 'set-url', '--push', 'origin', 'git@github.com:outro/repositorio.git']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/remote origin incorreto para push/iu);
  });

  it('rejects an additional fetch URL', () => {
    const root = createRepository();
    git(root, ['config', 'remote.origin.pushurl', remote]);
    git(root, ['remote', 'set-url', '--add', 'origin', 'git@github.com:outro/repositorio.git']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/remote origin incorreto para pull/iu);
  });

  it('rejects an additional push URL', () => {
    const root = createRepository();
    git(root, ['config', '--add', 'remote.origin.pushurl', remote]);
    git(root, ['config', '--add', 'remote.origin.pushurl', 'git@github.com:outro/repositorio.git']);

    expect(() => verifyDiarioPreflight(root, root)).toThrow(/remote origin incorreto para push/iu);
  });

  it.each(requiredFiles)('rejects a missing required file: %s', (file) => {
    const root = createRepository();
    unlinkSync(join(root, file));

    expect(() => verifyDiarioPreflight(root, root)).toThrow(file);
  });
});
