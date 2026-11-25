import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOOK = 'https://api.vercel.com/v1/integrations/deploy/TEST';
const SITE = 'https://www.abcinvestimentos.com.br';
const SECRET = 'segredo-de-teste-1234';

interface CronPayload {
  rebuilt?: boolean;
  skipped?: string;
  updatedAt?: string;
  error?: string;
}

async function callHandler(authorization?: string) {
  const { default: handler } = await import('../api/cron/indicadores');
  let statusCode = 0;
  let payload: CronPayload | null = null;

  const request = { headers: authorization ? { authorization } : {} } as unknown as Parameters<typeof handler>[0];
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    end(raw?: string) {
      payload = raw ? (JSON.parse(raw) as CronPayload) : null;
    },
  } as unknown as Parameters<typeof handler>[1];

  await handler(request, response);
  return { statusCode, payload: payload! };
}

/** Roteia o fetch por destino: séries do BCB e Deploy Hook. */
function stubFetch(options: { bcbOk: boolean; hookStatus?: number; failedSeries?: string }) {
  const hookCalls: string[] = [];
  const siteCalls: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const target = String(url);
    if (target === HOOK) {
      hookCalls.push(target);
      return new Response('{"job":{"id":"abc"}}', { status: options.hookStatus ?? 200 });
    }
    if (target.startsWith(SITE)) {
      siteCalls.push(target);
      throw new Error(`destino inesperado: ${target}`);
    }
    if (target.includes('api.bcb.gov.br')) {
      if (!options.bcbOk) return new Response('offline', { status: 503 });
      if (options.failedSeries && target.includes(options.failedSeries)) {
        return new Response('offline', { status: 503 });
      }
      // A Meta Selic vem com data futura; o CDI é a observação realizada.
      const body = target.includes('bcdata.sgs.432')
        ? [{ data: '09/12/2026', valor: '13.75' }]
        : [{ data: '12/11/2026', valor: '13.65' }];
      return new Response(JSON.stringify(body), { status: 200 });
    }
    throw new Error(`destino inesperado: ${target}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, hookCalls, siteCalls };
}

describe('api/cron/indicadores — rebuild diário das taxas', () => {
  const envKeys = ['CRON_SECRET', 'VERCEL_DEPLOY_HOOK_URL'];
  const savedEnv = envKeys.map((key) => [key, process.env[key]] as const);

  beforeEach(() => {
    // Congela só o relógio: o setTimeout real mantém AbortSignal.timeout funcionando.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T09:00:00Z'));
    // getIndicators memoiza por módulo; sem reset o 2º teste veria o cache do 1º.
    vi.resetModules();
    process.env.CRON_SECRET = SECRET;
    process.env.VERCEL_DEPLOY_HOOK_URL = HOOK;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('rejeita quem não apresenta o CRON_SECRET, sem tocar na rede', async () => {
    const { fetchMock } = stubFetch({ bcbOk: true });

    const semHeader = await callHandler();
    const headerErrado = await callHandler('Bearer chute');

    expect(semHeader.statusCode).toBe(401);
    expect(headerErrado.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falha como erro de servidor quando CRON_SECRET não está configurado', async () => {
    delete process.env.CRON_SECRET;
    const { fetchMock } = stubFetch({ bcbOk: true });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(500);
    expect(payload.error).toContain('CRON_SECRET');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispara o rebuild quando o BCB responde', async () => {
    const { hookCalls, siteCalls } = stubFetch({ bcbOk: true });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(200);
    expect(payload.rebuilt).toBe(true);
    // Ignora a data futura da Meta Selic e usa a observação realizada do CDI.
    expect(payload.updatedAt).toBe('12/11/2026');
    expect(hookCalls).toEqual([HOOK]);
    expect(siteCalls).toEqual([]);
  });

  it('rebuilda mesmo sem observação nova do BCB, para manter o hub vivo', async () => {
    const { hookCalls } = stubFetch({ bcbOk: true });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(200);
    expect(payload.rebuilt).toBe(true);
    expect(payload.skipped).toBeUndefined();
    expect(hookCalls).toEqual([HOOK]);
  });

  it('não rebuilda com o BCB fora, para não publicar os defaults hardcoded', async () => {
    const { hookCalls } = stubFetch({ bcbOk: false });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(200);
    expect(payload.skipped).toBe('bcb-indisponivel');
    expect(hookCalls).toEqual([]);
  });

  it('rebuilda mesmo quando uma das séries do BCB falha', async () => {
    const { hookCalls } = stubFetch({ bcbOk: true, failedSeries: 'bcdata.sgs.432' });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(200);
    expect(payload.rebuilt).toBe(true);
    expect(payload.updatedAt).toBe('12/11/2026');
    expect(hookCalls).toEqual([HOOK]);
  });

  it('reporta falha quando o Deploy Hook recusa', async () => {
    stubFetch({ bcbOk: true, hookStatus: 403 });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(502);
    expect(payload.error).toContain('403');
  });

  it('avisa quando o Deploy Hook não está configurado', async () => {
    delete process.env.VERCEL_DEPLOY_HOOK_URL;
    const { fetchMock } = stubFetch({ bcbOk: true });

    const { statusCode, payload } = await callHandler(`Bearer ${SECRET}`);

    expect(statusCode).toBe(500);
    expect(payload.error).toContain('VERCEL_DEPLOY_HOOK_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});