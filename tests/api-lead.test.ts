import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/lead';

interface LeadResponsePayload {
  success?: boolean;
  message?: string;
  error?: string;
  fallback?: boolean;
}

async function callHandler(body: Record<string, unknown>, method = 'POST') {
  let statusCode = 0;
  let payload: LeadResponsePayload | null = null;

  const request = { method, body } as unknown as Parameters<typeof handler>[0];
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    end(raw?: string) {
      payload = raw ? (JSON.parse(raw) as LeadResponsePayload) : null;
    },
  } as unknown as Parameters<typeof handler>[1];

  await handler(request, response);
  return { statusCode, payload: payload! };
}

describe('api/lead — espelho de leads no Google Sheets', () => {
  const envKeys = ['GOOGLE_LEADS_WEBAPP_URL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
  const savedEnv = envKeys.map((key) => [key, process.env[key]] as const);

  beforeEach(() => {
    // sem Turso configurado, o handler pula a escrita no banco e o teste isola o Sheets
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.GOOGLE_LEADS_WEBAPP_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('posta nome, contato e pergunta na URL do Web App quando ela existe', async () => {
    process.env.GOOGLE_LEADS_WEBAPP_URL = 'https://script.google.com/macros/s/TEST/exec';
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body ?? '') });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    const { statusCode, payload } = await callHandler({
      name: 'Carlos Silva',
      contact: '(21) 99750-6921',
      question: 'Quanto rende R$ 10.000 no CDB 110% do CDI?',
    });

    expect(statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://script.google.com/macros/s/TEST/exec');
    expect(JSON.parse(calls[0].body)).toEqual({
      name: 'Carlos Silva',
      contact: '(21) 99750-6921',
      question: 'Quanto rende R$ 10.000 no CDB 110% do CDI?',
    });
  });

  it('ainda retorna sucesso quando o Google Sheets falha (lead fica no Turso)', async () => {
    process.env.GOOGLE_LEADS_WEBAPP_URL = 'https://script.google.com/macros/s/TEST/exec';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Apps Script offline');
      })
    );

    const { statusCode, payload } = await callHandler({
      name: 'Ana Souza',
      contact: 'ana@email.com',
    });

    expect(statusCode).toBe(200);
    expect(payload.success).toBe(true);
  });

  it('não chama o Sheets quando a variável de ambiente está ausente', async () => {
    delete process.env.GOOGLE_LEADS_WEBAPP_URL;
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { statusCode } = await callHandler({ name: 'Bob', contact: 'bob@email.com' });

    expect(statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeita lead sem nome ou contato antes de tocar em qualquer destino', async () => {
    process.env.GOOGLE_LEADS_WEBAPP_URL = 'https://script.google.com/macros/s/TEST/exec';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { statusCode, payload } = await callHandler({ name: '', contact: 'x' });

    expect(statusCode).toBe(400);
    expect(payload.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
