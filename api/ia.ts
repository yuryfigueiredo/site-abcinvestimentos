interface VercelRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  end(body?: string): void;
}

function json(response: VercelResponse, status: number, data: unknown): void {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

/**
 * Na Vercel (Node Serverless), `request.body` pode chegar como objeto já parseado,
 * como string JSON crua ou como Buffer dependendo do Content-Type/cliente.
 * Este helper normaliza qualquer formato para objeto, evitando 500 por parse quebrado.
 */
function parseRequestBody(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      value = JSON.parse(trimmed);
    } catch {
      return {};
    }
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    try {
      value = JSON.parse(value.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function saveConversation(question: string, answer: string, mode: string): Promise<void> {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!databaseUrl || !authToken) return;

  const endpoint = databaseUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '') + '/v2/pipeline';
  const result = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql: 'INSERT INTO ai_conversations (question, answer, mode) VALUES (?, ?, ?)',
            args: [
              { type: 'text', value: question },
              { type: 'text', value: answer },
              { type: 'text', value: mode },
            ],
          },
        },
        { type: 'close' },
      ],
    }),
  });

  if (!result.ok) {
    throw new Error(`Turso HTTP ${result.status}`);
  }
}

function fallbackAnswer(question: string): string {
  const normalized = question.toLowerCase();
  if (normalized.includes('reserva') || normalized.includes('emergência') || normalized.includes('emergencia')) {
    return '**Reserva de emergência:** organize de 3 a 12 meses dos seus custos essenciais conforme a estabilidade da sua renda. Mantenha esse valor em aplicações seguras e com liquidez diária, como Tesouro Selic ou CDB de liquidez diária. Use a calculadora de reserva para chegar ao valor exato.';
  }
  if (normalized.includes('cdb') || normalized.includes('lci') || normalized.includes('lca') || normalized.includes('cdi')) {
    return '**Renda fixa:** compare sempre o retorno líquido após o Imposto de Renda, a liquidez, o prazo e a cobertura do FGC. Uma LCI/LCA isenta pode superar um CDB de percentual maior, dependendo do prazo e da alíquota aplicável.';
  }
  if (normalized.includes('dividendo') || normalized.includes('fii')) {
    return '**Renda passiva:** defina uma meta mensal, estime uma taxa anual conservadora e divida a renda desejada pela taxa mensal. Diversificação, risco e sustentabilidade dos proventos são mais importantes do que perseguir o maior rendimento recente.';
  }
  return '**Análise educativa:** comece pela reserva de emergência, organize seu orçamento e invista de forma compatível com seus objetivos e tolerância a risco. Use nossas calculadoras para transformar sua meta em números práticos.';
}

interface ProviderResult {
  answer: string;
  model: string;
}

interface ProviderStatus {
  configured: boolean;
  error?: string;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT =
  'Você é o consultor educativo do portal ABC Investimentos (abcinvestimentos.com.br). Responda em português do Brasil, de forma didática e objetiva (máximo 3 parágrafos ou tópicos claros). Se o investidor fizer uma pergunta de continuação, mantenha o contexto do assunto anterior com coerência. Não peça dados pessoais e não recomende compra ou venda de ativos específicos. Explique conceitos, riscos, liquidez, impostos e cálculos.';

async function askGemini(question: string, history: ChatHistoryItem[] = []): Promise<{ result: ProviderResult | null; status: ProviderStatus }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { result: null, status: { configured: false, error: 'missing_key' } };

  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-1.5-pro',
  ];
  let lastError = 'no_valid_response';

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content.trim() }],
        });
      }
    }
  }
  contents.push({ role: 'user', parts: [{ text: question }] });

  for (const model of models) {
    try {
      const result = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 650 },
          }),
        }
      );

      if (!result.ok) {
        console.error(`[ABC IA] Gemini recusou o modelo ${model}: HTTP ${result.status}`);
        lastError = `http_${result.status}`;
        continue;
      }

      const data = (await result.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (answer) return { result: { answer, model }, status: { configured: true } };
    } catch (error) {
      console.error(`[ABC IA] Falha no modelo Gemini ${model}:`, error);
      lastError = 'timeout_or_network_error';
    }
  }

  return { result: null, status: { configured: true, error: lastError } };
}

async function askCloudflare(question: string, history: ChatHistoryItem[] = []): Promise<{ result: ProviderResult | null; status: ProviderStatus }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return { result: null, status: { configured: false, error: 'missing_credentials' } };

  const models = [
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/meta/llama-3.2-3b-instruct',
  ];
  let lastError = 'no_valid_response';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content.trim(),
        });
      }
    }
  }
  messages.push({ role: 'user', content: question });

  for (const model of models) {
    try {
      const result = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ messages }),
      });

      if (!result.ok) {
        console.error(`[ABC IA] Cloudflare recusou o modelo ${model}: HTTP ${result.status}`);
        lastError = `http_${result.status}`;
        continue;
      }

      const data = (await result.json()) as {
        result?: {
          response?: string;
          choices?: Array<{ message?: { content?: string } }>;
        };
      };

      const answer = data.result?.response?.trim() || data.result?.choices?.[0]?.message?.content?.trim();
      if (answer) {
        return { result: { answer, model }, status: { configured: true } };
      }
    } catch (error) {
      console.error(`[ABC IA] Falha no Cloudflare (${model}):`, error);
      lastError = 'timeout_or_network_error';
    }
  }

  return { result: null, status: { configured: true, error: lastError } };
}

async function askGroq(question: string, history: ChatHistoryItem[] = []): Promise<{ result: ProviderResult | null; status: ProviderStatus }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { result: null, status: { configured: false, error: 'missing_key' } };

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  let lastError = 'no_valid_response';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content.trim(),
        });
      }
    }
  }
  messages.push({ role: 'user', content: question });

  for (const model of models) {
    try {
      const result = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 650,
        }),
      });

      if (!result.ok) {
        console.error(`[ABC IA] Groq recusou o modelo ${model}: HTTP ${result.status}`);
        lastError = `http_${result.status}`;
        continue;
      }

      const data = (await result.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (answer) {
        return { result: { answer, model }, status: { configured: true } };
      }
    } catch (error) {
      console.error(`[ABC IA] Falha no Groq (${model}):`, error);
      lastError = 'timeout_or_network_error';
    }
  }

  return { result: null, status: { configured: true, error: lastError } };
}

async function askOpenRouter(question: string, history: ChatHistoryItem[] = []): Promise<{ result: ProviderResult | null; status: ProviderStatus }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { result: null, status: { configured: false, error: 'missing_key' } };

  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  const models = Array.from(
    new Set([
      configuredModel,
      'openrouter/free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
    ])
  );
  let lastError = 'no_valid_response';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content.trim(),
        });
      }
    }
  }
  messages.push({ role: 'user', content: question });

  for (const model of models) {
    try {
      const result = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://www.abcinvestimentos.com.br',
          'X-Title': 'ABC Investimentos',
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 650,
        }),
      });

      if (!result.ok) {
        console.error(`[ABC IA] OpenRouter recusou o modelo ${model}: HTTP ${result.status}`);
        lastError = `http_${result.status}`;
        continue;
      }

      const data = (await result.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { code?: number | string; message?: string };
      };
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer || /^user safety:\s*safe$/i.test(answer)) {
        lastError = 'empty_or_safety_response';
        continue;
      }

      return {
        result: { answer, model },
        status: { configured: true },
      };
    } catch (error) {
      console.error(`[ABC IA] Falha no OpenRouter (${model}):`, error);
      lastError = 'timeout_or_network_error';
    }
  }

  return { result: null, status: { configured: true, error: lastError } };
}

/**
 * Dispara todos os provedores de IA em PARALELO e devolve a PRIMEIRA resposta válida.
 * Diferente da cascata sequencial antiga (que podia somar 5s+5s+5s+5s e estourar o
 * limite de 10s da Vercel no plano Hobby, resultando em 500/504 para o visitante),
 * aqui o tempo total é limitado pelo provedor mais rápido.
 */
async function firstValidProvider(
  tasks: Array<() => Promise<{ result: ProviderResult | null }>>
): Promise<{ result: ProviderResult | null; index: number }> {
  return new Promise((resolve) => {
    let pending = tasks.length;
    if (pending === 0) {
      resolve({ result: null, index: -1 });
      return;
    }
    tasks.forEach((task, index) => {
      task()
        .then((outcome) => {
          if (outcome.result) {
            resolve({ result: outcome.result, index });
            return;
          }
          pending -= 1;
          if (pending === 0) resolve({ result: null, index: -1 });
        })
        .catch(() => {
          pending -= 1;
          if (pending === 0) resolve({ result: null, index: -1 });
        });
    });
  });
}

// Timeout total da IA: 8s garante resposta 200 (com fallback educativo) antes do limite da Vercel
const IA_TOTAL_TIMEOUT_MS = 8000;

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    json(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = parseRequestBody(request.body) as {
      question?: string;
      conversationConsent?: boolean;
      history?: ChatHistoryItem[];
    };
    const question = (body.question || '').trim().slice(0, 500);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    if (!question) {
      json(response, 400, { error: 'Digite uma dúvida sobre investimentos.' });
      return;
    }

    // Cascata PARALELA de provedores (a ordem define a prioridade; vence a 1ª resposta válida).
    // 1. Cloudflare Workers AI (Titular)  2. Groq  3. Gemini  4. OpenRouter
    const providerModes = ['cloudflare-live', 'groq-live', 'gemini-live', 'openrouter-live'];
    const providerTasks: Array<() => Promise<{ result: ProviderResult | null }>> = [];
    if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
      providerTasks.push(() => askCloudflare(question, history));
    }
    if (process.env.GROQ_API_KEY) providerTasks.push(() => askGroq(question, history));
    if (process.env.GEMINI_API_KEY) providerTasks.push(() => askGemini(question, history));
    if (process.env.OPENROUTER_API_KEY) providerTasks.push(() => askOpenRouter(question, history));

    // Timeout total: mesmo que todos os provedores falhem, respondemos em até 8s com o motor educativo
    const winner = await Promise.race([
      firstValidProvider(providerTasks),
      new Promise<{ result: ProviderResult | null; index: number }>((resolve) =>
        setTimeout(() => resolve({ result: null, index: -1 }), IA_TOTAL_TIMEOUT_MS)
      ),
    ]);

    const generated = winner.result;
    const answer = generated?.answer || fallbackAnswer(question);
    const mode = generated ? providerModes[winner.index] || 'educational-engine' : 'educational-engine';

    if (body.conversationConsent === true) {
      try {
        await saveConversation(question, answer, mode);
      } catch (error) {
        console.error('[ABC IA] Falha ao registrar conversa:', error);
      }
    }

    json(response, 200, {
      answer,
      mode,
      modelUsed: generated?.model,
      remainingFree: 3,
      suggestedTool: {
        label: 'Explorar as calculadoras ABC',
        url: '/calculadoras/juros-compostos',
      },
    });
  } catch (error) {
    console.error('[ABC IA] Falha ao processar pergunta:', error);
    json(response, 500, {
      error: 'Não foi possível processar sua pergunta no momento.',
      debug: String(error),
      stack: error instanceof Error ? (error.stack || '').slice(0, 600) : undefined,
    });
  }
}
