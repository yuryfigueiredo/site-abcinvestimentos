import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeCurationBundleHash, verifyGovernance } from '../../src/lib/diario/governance';
import { parseSelection } from '../../src/lib/diario/schema';
import { DATE, draft, inputs, source } from './fixtures';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-cli-'));
  roots.push(root);
  cpSync(join(process.cwd(), 'src/data/diario/curadoria'), join(root, 'src/data/diario/curadoria'), { recursive: true });
  const approvalPath = join(root, 'src/data/diario/curadoria/approval.json');
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as Record<string, unknown>;
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');
  return root;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runScript(name: 'curate' | 'validate', root: string, publish = false): string {
  const script = join(process.cwd(), 'node_modules/.bin/tsx');
  const args = [join(process.cwd(), `scripts/diario/${name}.ts`), DATE, '--root', root];
  if (publish) args.push('--publish');
  return execFileSync(script, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('Diário CLIs', () => {
  it('writes deterministic selection without publishing an edition', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.sources = [source()];
    collected.lessons = approvedVault.lessons;
    writeJson(join(root, '.cache/diario', DATE, 'inputs.json'), collected);

    runScript('curate', root);

    const selection = parseSelection(JSON.parse(readFileSync(join(root, '.cache/diario', DATE, 'selection.json'), 'utf8')));
    expect(selection.decision.status).toBe('material');
    expect(selection.selectedSources.map((item) => item.id)).toEqual(['fonte-bcb']);
    expect(existsSync(join(root, 'src/data/diario/edicoes', `${DATE}.json`))).toBe(false);
  });

  it('validates without writing and publishes exactly once only when requested', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.sources = [source()];
    collected.lessons = approvedVault.lessons;
    writeJson(join(root, '.cache/diario', DATE, 'inputs.json'), collected);
    runScript('curate', root);
    writeJson(join(root, '.cache/diario', DATE, 'draft.json'), draft(DATE, collected, approvedVault));
    const editionPath = join(root, 'src/data/diario/edicoes', `${DATE}.json`);

    expect(runScript('validate', root)).toMatch(/validada|válida/iu);
    expect(existsSync(editionPath)).toBe(false);

    expect(runScript('validate', root, true)).toMatch(/publicada/iu);
    const published = readFileSync(editionPath, 'utf8');
    expect(() => runScript('validate', root, true)).toThrow(/exists|overwrite|same day/iu);
    expect(readFileSync(editionPath, 'utf8')).toBe(published);
  }, 15_000);
});
