import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diarioCachePath } from '../../src/lib/diario/cache';
import { simulateDiario } from '../../src/lib/diario/simulate';
import { loadSimulationValidationContext } from '../../src/lib/diario/validate';

const DATE = '2026-11-28';
const NOW = new Date('2026-11-27T22:00:00.000Z');
const AS_OF = '2026-11-28T22:00:00Z';
const NORMATIVOS_FEED = 'https://www.bcb.gov.br/api/feed/app/normativos/normativos?ano=2026';
const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'diario-simulate-'));
  roots.push(root);
  const data = join(root, 'src/data/diario');
  mkdirSync(data, { recursive: true });
  cpSync(join(process.cwd(), 'src/data/diario/curadoria'), join(data, 'curadoria'), { recursive: true });
  return root;
}

function emptyRss(): Response {
  return new Response('<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://example.test/</link><description>Feed</description></channel></rss>', { status: 200 });
}

function mockFetch() {
  return vi.fn(async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(String(input));
    if (url.hostname === 'api.bcb.gov.br') {
      const code = Number(/bcdata\.sgs\.(\d+)/.exec(url.pathname)?.[1]);
      if (code === 1) {
        return new Response(JSON.stringify([
          { data: '27/11/2026', valor: '5.40' },
          { data: '26/11/2026', valor: '5.35' },
        ]), { status: 200 });
      }
      const values: Record<number, string> = { 432: '13.75', 4389: '13.65', 13522: '4.58' };
      return new Response(JSON.stringify([{ data: '27/11/2026', valor: values[code] }]), { status: 200 });
    }
    if (url.href === NORMATIVOS_FEED) {
      return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Norma atualiza conta de pagamento</title><link href="https://www.bcb.gov.br/normativos/conta-pagamento" rel="alternate"/><summary>O Pix e o meio de pagamento recebem nova regra.</summary><published>2026-11-27T18:00:00Z</published></entry></feed>`, { status: 200 });
    }
    return emptyRss();
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('simulateDiario', () => {
  it('writes a validated preview only to the simulation cache and preserves both instants', async () => {
    const root = tempRoot();
    const fetchMock = mockFetch();

    const result = await simulateDiario(DATE, {
      root,
      now: NOW,
      asOf: AS_OF,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const cache = diarioCachePath(root, DATE, 'simulation');
    expect(result.inputs.retrievedAt).toBe(NOW.toISOString());
    expect(result.inputs.referenceAt).toBe('2026-11-28T22:00:00.000Z');
    expect(result.draft.generatedAt).toBe(NOW.toISOString());
    expect(result.draft.decision.status).toBe('material');
    expect(result.selection.selectedSources).toHaveLength(1);
    expect(result.report.limitation).toMatch(/somente o que j[aá] se conhece|coleta real/iu);
    expect(JSON.parse(readFileSync(join(cache, 'inputs.json'), 'utf8'))).toEqual(result.inputs);
    expect(JSON.parse(readFileSync(join(cache, 'selection.json'), 'utf8'))).toEqual(result.selection);
    expect(JSON.parse(readFileSync(join(cache, 'diagnostics.json'), 'utf8'))).toEqual(result.diagnostics);
    expect(JSON.parse(readFileSync(join(cache, 'draft.json'), 'utf8'))).toEqual(result.draft);
    expect(JSON.parse(readFileSync(join(cache, 'briefing.json'), 'utf8'))).toEqual(result.draft.briefing);
    expect(existsSync(join(diarioCachePath(root, DATE, 'edition'), 'inputs.json'))).toBe(false);
    expect(existsSync(join(root, 'src/data/diario/edicoes', `${DATE}.json`))).toBe(false);
    expect(loadSimulationValidationContext(DATE, root).selection).toEqual(result.selection);
  });

  it('rejects a reference instant earlier than the real collection before any request', async () => {
    const root = tempRoot();
    const fetchMock = mockFetch();

    await expect(simulateDiario(DATE, {
      root,
      now: NOW,
      asOf: '2026-11-27T21:00:00Z',
      fetch: fetchMock as unknown as typeof fetch,
    })).rejects.toThrow(/earlier|anterior|retrievedAt/iu);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(diarioCachePath(root, DATE, 'simulation'))).toBe(false);
  });

  it('rejects an editorial date that differs from the BRT day of the reference instant', async () => {
    const root = tempRoot();
    const fetchMock = mockFetch();

    await expect(simulateDiario('2026-11-29', {
      root,
      now: NOW,
      asOf: AS_OF,
      fetch: fetchMock as unknown as typeof fetch,
    })).rejects.toThrow(/America\/Sao_Paulo|date|data/iu);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(diarioCachePath(root, '2026-11-29', 'simulation'))).toBe(false);
  });
});
