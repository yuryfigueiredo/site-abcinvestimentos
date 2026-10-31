import { afterEach, describe, expect, it } from 'vitest';
import handler from '../api/ia';
import { formatBRL, simulateFixedIncomeComparison } from '../src/lib/finance';

interface MockResponsePayload {
  answer?: string;
  mode?: string;
  remainingFree?: number;
  recommendedCalculators?: { slug: string }[];
  suggestedTool?: { url: string };
  error?: string;
}

async function callHandler(body: Record<string, unknown>, method = 'POST') {
  let statusCode = 0;
  let payload: MockResponsePayload | null = null;

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
      payload = raw ? (JSON.parse(raw) as MockResponsePayload) : null;
    },
  } as unknown as Parameters<typeof handler>[1];

  await handler(request, response);
  return { statusCode, payload: payload! };
}

describe('api/ia — motor determinístico no servidor', () => {
  const providerKeys = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'];
  const savedEnv = providerKeys.map((key) => [key, process.env[key]] as const);

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('responde renda fixa com a mesma matemática auditada do site', async () => {
    const { statusCode, payload } = await callHandler({
      question: 'Quanto rende R$ 10.000 em CDB 110% do CDI por 24 meses?',
      indicators: { selic: 13.75, cdi: 13.65, ipca12m: 4.58 },
    });

    const expected = simulateFixedIncomeComparison({
      amount: 10000,
      months: 24,
      cdiAnnualPct: 13.65,
      selicAnnualPct: 13.75,
      ipcaAnnualPct: 4.58,
      cdbPctCdi: 110,
      lciLcaPctCdi: 92,
    });

    expect(statusCode).toBe(200);
    expect(payload.mode).toBe('abc-expert-engine');
    expect(payload.answer).toContain('DIAGNÓSTICO DIRETO:');
    expect(payload.answer).toContain(`SIMULAÇÃO REAL com ${formatBRL(10000)}:`);
    expect(payload.answer).toContain('ATENÇÃO PRÁTICA:');
    expect(payload.answer).toContain('IR de 15,0%');
    expect(payload.answer).toContain('CDB 110% do CDI');
    expect(payload.answer).toContain(formatBRL(expected.winner.netFinalAmount));
    expect(payload.recommendedCalculators?.[0]?.slug).toBe('renda-fixa');
    expect(payload.suggestedTool?.url).toContain('/calculadoras/renda-fixa?valor=10000&prazo=24&cdb=110&lci=92');
  });

  it('usa os indicadores padrão quando a chamada direta não envia taxas', async () => {
    const { payload } = await callHandler({
      question: 'Quanto rende 10 mil na poupança em 12 meses?',
    });

    expect(payload.mode).toBe('abc-expert-engine');
    expect(payload.answer).toContain('13,65%');
    expect(payload.answer).toContain('Poupança');
  });

  it('mantém perguntas conceituais fora do motor determinístico', async () => {
    for (const key of providerKeys) delete process.env[key];

    const { payload } = await callHandler({ question: 'O que é CDI?' });

    expect(payload.mode).not.toBe('abc-expert-engine');
    expect(payload.answer).toBeTruthy();
  });

  it('recusa métodos diferentes de POST', async () => {
    const { statusCode, payload } = await callHandler({}, 'GET');

    expect(statusCode).toBe(405);
    expect(payload.error).toBeTruthy();
  });
});
