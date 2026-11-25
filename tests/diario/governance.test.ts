import fs, { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GUIDES } from '../../src/data/guides';
import { computeCurationBundleHash, verifyGovernance } from '../../src/lib/diario/governance';
import type { AllowlistSource, Approval, Lesson } from '../../src/lib/diario/types';

const VAULT_DIR = join(process.cwd(), 'src/data/diario/curadoria');
const BUNDLE_FILES = ['carta.md', 'allowlist.json', 'thresholds.json', 'calendario.json', 'licoes.json', 'changelog.md'];
const APPROVAL_FIELDS = ['bundleSha256', 'charterVersion', 'approvedAt', 'approvedBy', 'instructionRef'] as const;

type ThresholdFile = {
  version: string;
  dollarAbsChangePct: number;
  topics: string[];
};

type AllowlistFile = {
  version: string;
  sources: AllowlistSource[];
};

const VERIFIED_TOPICS = ['renda-fixa', 'juros', 'inflacao', 'cambio', 'bolsa-fiis', 'regulacao'];

let root: string;
let vault: string;

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(vault, name), 'utf8')) as T;
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(join(vault, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function refreshApprovalHash(): void {
  const approval = readJson<Approval>('approval.json');
  approval.bundleSha256 = computeCurationBundleHash(root);
  writeJson('approval.json', approval);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'diario-governance-'));
  const dataDir = join(root, 'src/data/diario');
  mkdirSync(dataDir, { recursive: true });
  vault = join(dataDir, 'curadoria');
  cpSync(VAULT_DIR, vault, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('curation bundle hash', () => {
  it('hashes exactly the six content files in their fixed order', () => {
    const contents = ['carta\n', 'allowlist\n', 'thresholds\n', 'calendar\n', 'lessons\n', 'changelog\n'];
    for (const [index, file] of BUNDLE_FILES.entries()) {
      writeFileSync(join(vault, file), contents[index], 'utf8');
    }

    expect(computeCurationBundleHash(root)).toBe('42dbca50147c483e3a9c30cd2135a0c835f32c9f1b3dcbac202d4d996bb7783d');
  });

  it('excludes approval metadata from the bundle hash', () => {
    const before = computeCurationBundleHash(root);
    const approval = readJson<Approval>('approval.json');
    approval.approvedBy = 'Outro Aprovador';
    writeJson('approval.json', approval);

    expect(computeCurationBundleHash(root)).toBe(before);
  });
});

describe('verifyGovernance', () => {
  it('accepts the approved vault', () => {
    expect(() => verifyGovernance(root)).not.toThrow();
  });

  it('returns one verified vault snapshot instead of making consumers reread files', () => {
    const snapshot = verifyGovernance(root);

    expect(snapshot).toMatchObject({
      charterVersion: '1.0.3',
      allowlistVersion: '1.2.0',
      bundleSha256: readJson<Approval>('approval.json').bundleSha256,
      approval: {
        instructionRef: 'docs/superpowers/plans/2026-11-24-diario-expansao-fontes.md',
      },
      calendar: [],
    });
    expect(snapshot.allowlist).toHaveLength(readJson<AllowlistFile>('allowlist.json').sources.length);
    expect(snapshot.allowlist.filter((item) => item.enabled).map((item) => item.id)).toEqual([
      'bcb',
      'camara',
      'the-conversation-brasil',
    ]);
    expect(snapshot.lessons).toHaveLength(12);
    expect(snapshot.thresholds.timezone).toBe('America/Sao_Paulo');

    const allowlist = readJson<AllowlistFile>('allowlist.json');
    allowlist.sources[0].enabled = false;
    writeJson('allowlist.json', allowlist);
    expect(snapshot.allowlist.find((item) => item.id === 'bcb')?.enabled).toBe(true);
  });

  it('reads each vault file once so parsing and hashing share one snapshot', () => {
    const originalReadFileSync = fs.readFileSync;
    const reads = new Map<string, number>();
    fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
      const file = String(args[0]);
      reads.set(file, (reads.get(file) ?? 0) + 1);
      return originalReadFileSync(...args);
    }) as typeof fs.readFileSync;
    syncBuiltinESMExports();

    try {
      verifyGovernance(root);
    } finally {
      fs.readFileSync = originalReadFileSync;
      syncBuiltinESMExports();
    }

    for (const file of [...BUNDLE_FILES, 'approval.json']) {
      expect(reads.get(join(vault, file)), file).toBe(1);
    }
  });

  it('fails when dollarAbsChangePct changes without a new bundle hash', () => {
    const thresholds = readJson<ThresholdFile>('thresholds.json');
    thresholds.dollarAbsChangePct = 2;
    writeJson('thresholds.json', thresholds);

    expect(() => verifyGovernance(root)).toThrow(/bundleSha256|hash/i);
  });

  it('fails when the approved hash does not match the content', () => {
    const approval = readJson<Approval>('approval.json');
    approval.bundleSha256 = '0'.repeat(64);
    writeJson('approval.json', approval);

    expect(() => verifyGovernance(root)).toThrow(/bundleSha256|hash/i);
  });

  it.each(['charter', 'changelog'])('fails when the %s version diverges from the other record', (record) => {
    const approval = readJson<Approval>('approval.json');
    if (record === 'charter') {
      const charter = readFileSync(join(vault, 'carta.md'), 'utf8').replace(
        'Versão da carta: 1.0.3',
        'Versão da carta: 2.0.0',
      );
      writeFileSync(join(vault, 'carta.md'), charter, 'utf8');
      approval.charterVersion = '2.0.0';
      writeJson('approval.json', approval);
    } else {
      const changelog = readFileSync(join(vault, 'changelog.md'), 'utf8').replace('## 1.0.3', '## 2.0.0');
      writeFileSync(join(vault, 'changelog.md'), changelog, 'utf8');
    }
    refreshApprovalHash();

    expect(() => verifyGovernance(root)).toThrow(/charter|changelog|versão/i);
  });

  it('rejects cripto even when the changed bundle is reapproved', () => {
    const thresholds = readJson<ThresholdFile>('thresholds.json');
    thresholds.topics = [...thresholds.topics, 'cripto'];
    writeJson('thresholds.json', thresholds);
    refreshApprovalHash();

    expect(() => verifyGovernance(root)).toThrow(/topics|topic|cripto/i);
  });

  it('rejects threshold drift even when the changed bundle is reapproved', () => {
    const thresholds = readJson<ThresholdFile>('thresholds.json');
    thresholds.dollarAbsChangePct = 2;
    writeJson('thresholds.json', thresholds);
    refreshApprovalHash();

    expect(() => verifyGovernance(root)).toThrow(/dollarAbsChangePct|thresholds/i);
  });

  it.each(APPROVAL_FIELDS)('missing approval field %s fails', (field) => {
    const approval = readJson<Record<string, unknown>>('approval.json');
    delete approval[field];
    writeJson('approval.json', approval);

    expect(() => verifyGovernance(root)).toThrow(new RegExp(field, 'i'));
  });

  it.each([
    ['bundleSha256', 'A'.repeat(64)],
    ['charterVersion', ' 1.0.0'],
    ['approvedAt', '2026-02-30T19:00:00Z'],
    ['approvedAt', '2026-11-23T19:00:00+00:00'],
    ['approvedBy', '\u0000Yury Figueiredo'],
    ['approvedBy', ''],
    ['approvedBy', 'a'.repeat(121)],
    ['instructionRef', '../plans/2026-11-24-diario-expansao-fontes.md'],
    ['instructionRef', 'docs/superpowers/plans/2026-11-23-diario-do-investidor.md'],
  ])('invalid approval field %s with value %j fails', (field, value) => {
    const approval = readJson<Record<string, unknown>>('approval.json');
    approval[field] = value;
    writeJson('approval.json', approval);

    expect(() => verifyGovernance(root)).toThrow(new RegExp(field, 'i'));
  });

  it('non-plan instructionRef fails', () => {
    const approval = readJson<Approval>('approval.json');
    approval.instructionRef = 'docs/superpowers/plans/outro-plano.md';
    writeJson('approval.json', approval);

    expect(() => verifyGovernance(root)).toThrow(/instructionRef/i);
  });

  it.each([
    'https://example.com/plano.md',
    '/home/yury/plano.md',
    'docs/superpowers/plans/../outro-plano.md',
  ])('rejects the non-relative or traversing instructionRef %s', (instructionRef) => {
    const approval = readJson<Approval>('approval.json');
    approval.instructionRef = instructionRef;
    writeJson('approval.json', approval);

    expect(() => verifyGovernance(root)).toThrow(/instructionRef/i);
  });

  it('rejects malformed JSON in a vault file', () => {
    writeFileSync(join(vault, 'allowlist.json'), '{not-json', 'utf8');
    expect(() => verifyGovernance(root)).toThrow(/allowlist|JSON/i);
  });

  it('rejects an insecure or credentialled allowlist feed URL', () => {
    const allowlist = readJson<AllowlistFile>('allowlist.json');
    allowlist.sources[0].feeds = [{ url: 'https://user:secret@example.com/feed', topics: ['juros'] }];
    writeJson('allowlist.json', allowlist);

    expect(() => verifyGovernance(root)).toThrow(/allowlist|feed|URL|credentials/i);
  });

  it('rejects an impossible calendar date at the JSON boundary', () => {
    writeJson('calendario.json', [
      { id: 'copom-invalido', date: '2026-02-30', title: 'Copom', sourceUrl: 'https://www.bcb.gov.br/' },
    ]);
    expect(() => verifyGovernance(root)).toThrow(/calendar|calendário|date|data/i);
  });

  it('rejects lesson prose with digits at the vault boundary', () => {
    const lessons = readJson<Lesson[]>('licoes.json');
    lessons[0].body = 'Esta lição tem 1 número.';
    writeJson('licoes.json', lessons);
    expect(() => verifyGovernance(root)).toThrow(/lições|licoes|lesson|prosa|dígito/i);
  });
});

describe('safe vault seed', () => {
  it('enables exactly the verified BCB, Câmara and The Conversation feeds with their terms and license', () => {
    const allowlist = readJson<AllowlistFile>('allowlist.json');
    expect(allowlist.version).toBe('1.2.0');
    expect(allowlist.sources.map((item) => item.id)).toEqual([
      'bcb',
      'camara',
      'ibge',
      'cvm',
      'tesouro-nacional',
      'governo-federal',
      'valor-investe',
      'infomoney',
      'the-conversation-brasil',
    ]);
    expect(allowlist.sources.filter((item) => item.enabled).map((item) => item.id)).toEqual([
      'bcb',
      'camara',
      'the-conversation-brasil',
    ]);
    expect(allowlist.sources.find((item) => item.id === 'bcb')).toEqual({
      id: 'bcb',
      publisher: 'Banco Central do Brasil',
      kind: 'official',
      termsUrl: 'https://www.bcb.gov.br/acessoinformacao/politicaprivacidade',
      enabled: true,
      feeds: [
        {
          url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias?ano=2024',
          topics: VERIFIED_TOPICS,
        },
        {
          url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa?ano=2021',
          topics: VERIFIED_TOPICS,
        },
        {
          url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/comunicadoscopom',
          topics: ['renda-fixa', 'juros'],
        },
        {
          url: 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notastecnicas',
          topics: VERIFIED_TOPICS,
        },
      ],
    });
    expect(allowlist.sources.find((item) => item.id === 'camara')).toEqual({
      id: 'camara',
      publisher: 'Câmara dos Deputados',
      kind: 'official',
      termsUrl: 'https://www2.camara.leg.br/termo-de-uso-e-politica-de-privacidade',
      enabled: true,
      feeds: [{
        url: 'https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA',
        topics: VERIFIED_TOPICS,
      }],
    });
    expect(allowlist.sources.find((item) => item.id === 'the-conversation-brasil')).toEqual({
      id: 'the-conversation-brasil',
      publisher: 'The Conversation Brasil',
      kind: 'media',
      termsUrl: 'https://theconversation.com/br/republishing-guidelines',
      licenseUrl: 'https://creativecommons.org/licenses/by-nd/4.0/',
      enabled: true,
      feeds: [{
        url: 'https://theconversation.com/br/home-page.atom',
        topics: VERIFIED_TOPICS,
      }],
    });
    for (const id of ['ibge', 'cvm', 'tesouro-nacional', 'governo-federal', 'valor-investe', 'infomoney']) {
      expect(allowlist.sources.find((item) => item.id === id)).toMatchObject({ enabled: false, feeds: [] });
    }
  });

  it('records the owner and committed plan on the activation approval', () => {
    expect(readJson<Approval>('approval.json')).toMatchObject({
      charterVersion: '1.0.3',
      approvedBy: 'Yury Figueiredo',
      instructionRef: 'docs/superpowers/plans/2026-11-24-diario-expansao-fontes.md',
    });
    expect(readJson<Approval>('approval.json').approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
  });

  it('keeps the calendar empty because no macro date was officially verified', () => {
    expect(readJson<unknown>('calendario.json')).toEqual([]);
  });

  it('seeds exactly twelve digit-free lessons linked to existing guides', () => {
    const lessons = readJson<Lesson[]>('licoes.json');
    const guideSlugs = new Set(GUIDES.map((guide) => guide.slug));

    expect(lessons).toHaveLength(12);
    expect(new Set(lessons.map((item) => item.id)).size).toBe(12);
    for (const item of lessons) {
      expect(guideSlugs.has(item.guideSlug)).toBe(true);
      expect(item.title).not.toMatch(/[0-9\p{N}]/u);
      expect(item.body).not.toMatch(/[0-9\p{N}]/u);
      expect(item.title).not.toMatch(/<|>/);
      expect(item.body).not.toMatch(/<|>/);
    }
  });

  it('keeps the savings anniversary and CDB IOF rules in separate sentences', () => {
    const lessons = readJson<Lesson[]>('licoes.json');
    const redemptionLesson = lessons.find((item) => item.id === 'licao-regras-resgate');
    expect(redemptionLesson).toBeDefined();
    if (redemptionLesson === undefined) return;

    const sentences = redemptionLesson.body
      .split(/[.!?]+(?:\s+|$)/u)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
    expect(sentences.some((sentence) => /poupança/iu.test(sentence) && /IOF/iu.test(sentence))).toBe(false);
    expect(redemptionLesson.body).toMatch(/poupança.*aniversário/isu);
    expect(redemptionLesson.body).toMatch(/CDB.*trinta dias.*IOF/isu);
    expect(redemptionLesson.body).not.toMatch(/\p{N}/u);
  });
});
