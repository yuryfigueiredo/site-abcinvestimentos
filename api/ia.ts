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

async function askGemini(question: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: 'Você é o consultor educativo do portal ABC Investimentos. Responda em português do Brasil, de forma didática e objetiva. Não peça dados pessoais e não recomende compra ou venda de ativos específicos. Explique conceitos, riscos, liquidez, impostos e cálculos.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    }
  );

  if (!result.ok) return null;
  const data = (await result.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    json(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = (request.body || {}) as { question?: string; conversationConsent?: boolean };
    const question = (body.question || '').trim().slice(0, 500);
    if (!question) {
      json(response, 400, { error: 'Digite uma dúvida sobre investimentos.' });
      return;
    }

    const answer = (await askGemini(question)) || fallbackAnswer(question);
    const mode = process.env.GEMINI_API_KEY ? 'gemini-live' : 'educational-engine';

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
      diagnostic: error instanceof Error ? error.message : String(error),
    });
  }
}
