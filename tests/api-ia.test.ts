import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { polishModelAnswer } from '../api/ia';
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
    vi.unstubAllGlobals();
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

  it('envia limite de tokens explícito ao Cloudflare e limpa resposta cortada', async () => {
    for (const key of providerKeys) delete process.env[key];
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-test';
    process.env.CLOUDFLARE_API_TOKEN = 'token-test';

    const truncated =
      'A Selic é a taxa básica de juros da economia brasileira e influencia todas as demais taxas de crédito e investimento. Para o investidor, **exposição ao euro';
    let requestBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return new Response(JSON.stringify({ result: { response: truncated } }), { status: 200 });
      })
    );

    const { payload } = await callHandler({ question: 'O que é euro?' });

    expect(requestBody).not.toBeNull();
    expect(requestBody!.max_tokens).toBe(650);
    expect(payload.answer).toContain('A Selic é a taxa básica de juros');
    expect(payload.answer).not.toContain('**');
    expect(payload.answer).not.toContain('exposição ao euro');
    expect(payload.answer?.endsWith('.')).toBe(true);
  });
});

describe('polishModelAnswer', () => {
  it('mantém intacta uma resposta completa com valores em reais', () => {
    const complete =
      'Um CDB de 110% do CDI rende mais que a poupança: em R$ 10.000,00 por 24 meses o líquido supera a caderneta.';

    expect(polishModelAnswer(complete)).toBe(complete);
  });

  it('remove marcação aberta e corta a frase incompleta final', () => {
    const truncated =
      'A Selic é a taxa básica de juros da economia brasileira e influencia todas as demais taxas de crédito e investimento. Para o investidor, **exposição ao euro';

    expect(polishModelAnswer(truncated)).toBe(
      'A Selic é a taxa básica de juros da economia brasileira e influencia todas as demais taxas de crédito e investimento.'
    );
  });

  it('não confunde o ponto de milhar com fim de frase', () => {
    const truncated =
      'O rendimento líquido depende do prazo e da alíquota regressiva de IR aplicada no resgate do título. O saldo seria R$ 10.000';

    expect(polishModelAnswer(truncated)).toBe(
      'O rendimento líquido depende do prazo e da alíquota regressiva de IR aplicada no resgate do título.'
    );
  });

  it('preserva respostas curtas sem pontuação final', () => {
    expect(polishModelAnswer('O euro é a moeda de 20 países')).toBe('O euro é a moeda de 20 países');
  });

  it('sem frase fechada, corta na última palavra inteira e sinaliza o corte', () => {
    const truncated =
      'A renda fixa protege o investidor da volatilidade da bolsa e organiza o fluxo de caixa pessoal ao longo dos anos sem sustos';

    const result = polishModelAnswer(truncated);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('sustos');
    expect(result.endsWith('anos sem…')).toBe(true);
  });

  it('não devolve introdução pendurada terminando em dois-pontos', () => {
    const truncated =
      'O CDB e a LCI têm garantias e impostos diferentes. Antes de escolher, considere prazo, liquidez e liquidez diária:';

    expect(polishModelAnswer(truncated)).toBe(
      'O CDB e a LCI têm garantias e impostos diferentes.'
    );
  });

  it('mantém respostas que já terminam em reticências', () => {
    const ended = 'O CDI acompanha a Selic, mas com pequeno atraso…';
    expect(polishModelAnswer(ended)).toBe(ended);
  });

  it('não confunde numeração de lista com fim de frase', () => {
    const list =
      '1. O CDI acompanha a Selic.\n2. A poupança rende menos que o CDI na maioria dos cenários de juros altos';

    expect(polishModelAnswer(list)).toBe('1. O CDI acompanha a Selic.');
  });
});
