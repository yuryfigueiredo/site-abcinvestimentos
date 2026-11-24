import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDeterministicBriefing } from '../../src/lib/diario/briefing';
import { computeCurationBundleHash, verifyGovernance } from '../../src/lib/diario/governance';
import { parseEditorialBriefing, parseSelection } from '../../src/lib/diario/schema';
import { DATE, draft, inputs, source, sourceForDate } from './fixtures';

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

function runScript(name: 'curate' | 'validate', root: string, publish = false, date = DATE): string {
  const script = join(process.cwd(), 'node_modules/.bin/tsx');
  const args = [join(process.cwd(), `scripts/diario/${name}.ts`), date, '--root', root];
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

  it('writes deterministic briefing without publishing a no-news material edition', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.bcb.dolar = [
      { value: 5.05, date: DATE },
      { value: 4.99, date: '2026-11-20' },
    ];
    collected.lessons = approvedVault.lessons;
    writeJson(join(root, '.cache/diario', DATE, 'inputs.json'), collected);

    runScript('curate', root);

    const edition = draft(DATE, collected, approvedVault);
    const briefingPath = join(root, '.cache/diario', DATE, 'briefing.json');
    const bytes = readFileSync(briefingPath, 'utf8');
    const briefing = parseEditorialBriefing(JSON.parse(bytes));
    expect(edition.decision).toMatchObject({
      status: 'material',
      reasonCodes: ['dollar-trigger'],
      newsClusterIds: [],
    });
    expect(briefing).toEqual(buildDeterministicBriefing(edition, approvedVault));
    expect(briefing.whatHappened).toMatch(/d[oó]lar/iu);
    expect(briefing.whatHappened).toMatch(/limiar/iu);
    expect(bytes).toBe(`${JSON.stringify(briefing, null, 2)}\n`);
    expect(existsSync(join(root, 'src/data/diario/edicoes', `${DATE}.json`))).toBe(false);
  });

  it.each(['quiet', 'news'] as const)('removes a stale briefing when the same date is re-curated as %s', (next) => {
    const root = tempRoot();
    const date = '2026-11-24';
    const approvedVault = verifyGovernance(root);
    const inputsPath = join(root, '.cache/diario', date, 'inputs.json');
    const selectionPath = join(root, '.cache/diario', date, 'selection.json');
    const briefingPath = join(root, '.cache/diario', date, 'briefing.json');
    const material = inputs(date);
    material.bcb.dolar = [
      { value: 5.05, date },
      { value: 4.99, date: '2026-11-20' },
    ];
    material.lessons = approvedVault.lessons;
    writeJson(inputsPath, material);

    runScript('curate', root, false, date);

    const initialSelection = parseSelection(JSON.parse(readFileSync(selectionPath, 'utf8')));
    expect(initialSelection.decision).toMatchObject({
      status: 'material',
      reasonCodes: ['dollar-trigger'],
      newsClusterIds: [],
    });
    expect(existsSync(briefingPath)).toBe(true);

    const recurated = inputs(date);
    recurated.lessons = approvedVault.lessons;
    if (next === 'news') recurated.sources = [sourceForDate(date)];
    writeJson(inputsPath, recurated);
    runScript('curate', root, false, date);

    const selection = parseSelection(JSON.parse(readFileSync(selectionPath, 'utf8')));
    if (next === 'quiet') {
      expect(selection.decision).toMatchObject({
        status: 'morno',
        reasonCodes: ['no-substantive-delta'],
        newsClusterIds: [],
      });
    } else {
      expect(selection.decision.status).toBe('material');
      expect(selection.decision.newsClusterIds.length).toBeGreaterThan(0);
    }
    expect(existsSync(briefingPath)).toBe(false);
  });

  it('does not write deterministic briefing for a selected official news cluster', () => {
    const root = tempRoot();
    const approvedVault = verifyGovernance(root);
    const collected = inputs();
    collected.sources = [source()];
    collected.lessons = approvedVault.lessons;
    writeJson(join(root, '.cache/diario', DATE, 'inputs.json'), collected);

    runScript('curate', root);

    const selection = parseSelection(JSON.parse(readFileSync(join(root, '.cache/diario', DATE, 'selection.json'), 'utf8')));
    expect(selection.decision.newsClusterIds.length).toBeGreaterThan(0);
    expect(selection.selectedSources.map((item) => item.id)).toEqual(['fonte-bcb']);
    expect(existsSync(join(root, '.cache/diario', DATE, 'briefing.json'))).toBe(false);
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
