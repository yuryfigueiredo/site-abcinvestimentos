import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeCurationBundleHash } from '../../src/lib/diario/governance';
import { latestEdition, materialEditions, readEditions } from '../../src/lib/diario/store';
import type { Edition } from '../../src/lib/diario/types';
import { DATE, draft } from './fixtures';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-store-'));
  roots.push(root);
  cpSync(join(process.cwd(), 'src/data/diario/curadoria'), join(root, 'src/data/diario/curadoria'), { recursive: true });
  const approvalPath = join(root, 'src/data/diario/curadoria/approval.json');
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as Record<string, unknown>;
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');
  return root;
}

function writeEdition(root: string, edition: Edition): void {
  const directory = join(root, 'src/data/diario/edicoes');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${edition.date}.json`), `${JSON.stringify(edition, null, 2)}\n`, 'utf8');
}

describe('readEditions', () => {
  it('orders editions by date and includes quiet days', () => {
    const root = tempRoot();
    writeEdition(root, draft('2026-11-21'));
    writeEdition(root, draft(DATE));
    writeEdition(root, draft('2026-11-22'));

    expect(readEditions(root).map((edition) => edition.date)).toEqual([
      '2026-11-23',
      '2026-11-22',
      '2026-11-21',
    ]);
  });

  it('fails with an actionable message when the seed is absent', () => {
    const root = tempRoot();

    expect(() => readEditions(root)).toThrow(/nenhuma edição|seed/iu);
  });

  it('fails with the filename when an edition contains invalid JSON', () => {
    const root = tempRoot();
    const directory = join(root, 'src/data/diario/edicoes');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, '2026-11-23.json'), '{invalid', 'utf8');

    expect(() => readEditions(root)).toThrow(/2026-11-23\.json.*JSON|JSON.*2026-11-23\.json/iu);
  });

  it('rejects an edition whose filename and declared date differ', () => {
    const root = tempRoot();
    const directory = join(root, 'src/data/diario/edicoes');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, '2026-11-23.json'), `${JSON.stringify(draft('2026-11-22'), null, 2)}\n`, 'utf8');

    expect(() => readEditions(root)).toThrow(/2026-11-23\.json.*data|data.*2026-11-23\.json/iu);
  });

  it('verifies governance before reading editions', () => {
    const root = tempRoot();
    writeEdition(root, draft());
    const thresholdsPath = join(root, 'src/data/diario/curadoria/thresholds.json');
    const thresholds = JSON.parse(readFileSync(thresholdsPath, 'utf8')) as Record<string, unknown>;
    thresholds.dollarAbsChangePct = 1.1;
    writeFileSync(thresholdsPath, `${JSON.stringify(thresholds, null, 2)}\n`, 'utf8');

    expect(() => readEditions(root)).toThrow(/bundleSha256|cofre|hash/iu);
  });
});

describe('edition selectors', () => {
  it('latestEdition includes a quiet edition', () => {
    const quiet = draft('2026-11-22');

    expect(latestEdition([quiet])).toBe(quiet);
  });

  it('latestEdition fails clearly when there are no editions', () => {
    expect(() => latestEdition([])).toThrow(/nenhuma edição/iu);
  });

  it('materialEditions excludes quiet editions', () => {
    const material = draft(DATE);
    const quiet = draft('2026-11-22');

    expect(materialEditions([quiet, material])).toEqual([material]);
  });
});

describe('Diário static routes offline', () => {
  it('não publica o arquivo datado', () => {
    expect(existsSync(join(process.cwd(), 'src/pages/diario-do-investidor/[date].astro'))).toBe(false);
  });

  it('não publica o endpoint da última edição', () => {
    expect(existsSync(join(process.cwd(), 'src/pages/api/diario/edicao.json.ts'))).toBe(false);
  });
});
