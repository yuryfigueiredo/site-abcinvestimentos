/**
 * Server handler compartilhado por Cloudflare Pages e Vercel: /api/ia
 * Protege a chave GEMINI_API_KEY no servidor (nunca exposta no navegador),
 * aplica limite de 3 perguntas gratuitas por dia por visitante e garante
 * respostas puramente educativas conforme regras da CVM e legislação fiscal de 2026.
 */

interface Env {
  GEMINI_API_KEY?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

interface IaRequestBody {
  question?: string;
  indicators?: {
    selic?: number;
    cdi?: number;
    ipca12m?: number;
  };
  conversationConsent?: boolean;
}

// Controle em memória por instância edge (complementado por cookie HttpOnly e controle local)
const dailyIpUsage = new Map<string, { date: string; count: number }>();
const MAX_DAILY_FREE_QUESTIONS = 3;

async function saveConversation(
  databaseUrl: string | undefined,
  authToken: string | undefined,
  consent: boolean,
  question: string,
  answer: string,
  mode: string
): Promise<void> {
  if (!databaseUrl || !authToken || !consent) return;

  try {
    const endpoint = databaseUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '') + '/v2/pipeline';
    const response = await fetch(endpoint, {
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

    if (!response.ok) {
      throw new Error(`Turso HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('[ABC IA] Falha ao registrar conversa:', error);
  }
}

function buildEducationalFallbackAnswer(question: string, selic = 14.25, cdi = 14.15, ipca = 4.56) {
  const q = question.toLowerCase();

  if (q.includes('lci') || q.includes('lca') || q.includes('cdb') || q.includes('cdi')) {
    const eq1yr = (92 / (1 - 0.175)).toFixed(1);
    return {
      answer: `**Comparativo Educativo: CDB vs. LCI/LCA (Regras 2026)**\n\nCom o **CDI em ${cdi.toFixed(2)}% a.a.**, a principal diferença está no Imposto de Renda:\n- **LCI e LCA continuam 100% isentas de IR** para pessoa física.\n- **CDBs seguem a tabela regressiva de IR**: 22,5% (até 180 dias), 20% (181 a 360 dias), 17,5% (361 a 720 dias) e 15% (acima de 720 dias).\n- **Exemplo prático:** Para um prazo de 1 a 2 anos (alíquota de 17,5%), uma **LCI pagando 92% do CDI** entrega o mesmo retorno líquido que um **CDB pagando ${eq1yr}% do CDI**.`,
      suggestedTool: {
        label: 'Abrir Comparador CDB vs. LCI/LCA com esses dados',
        url: '/calculadoras/renda-fixa?valor=10000&prazo=12&cdb=105&lci=92',
      },
    };
  }

  if (q.includes('reserva') || q.includes('emergencia') || q.includes('emergência')) {
    return {
      answer: `**Como estruturar sua Reserva de Emergência:**\n\n1. **Qual o valor ideal?** Depende da previsibilidade da sua renda:\n   - **Servidor Público:** 3 meses dos seus custos essenciais.\n   - **Profissional CLT:** 6 meses dos custos essenciais.\n   - **Autônomo / MEI / PJ:** 12 meses dos custos essenciais.\n2. **Onde guardar?** Em ativos com **liquidez diária imediata e segurança alta**, como **Tesouro Selic** (Selic hoje em ${selic.toFixed(2)}% a.a.) ou **CDB de grande banco com liquidez diária a 100% do CDI**.`,
      suggestedTool: {
        label: 'Calcular minha Reserva de Emergência exata',
        url: '/calculadoras/reserva-emergencia?custo=4000&perfil=clt',
      },
    };
  }

  if (q.includes('dividendo') || q.includes('fii') || q.includes('renda') || q.includes('viver')) {
    return {
      answer: `**Planejamento para Viver de Renda (Dividendos & FIIs em 2026):**\n\n- **Regra prática:** Com um Dividend Yield médio de **9% a 10% ao ano** (~0,75% ao mês), cada **R$ 100.000 acumulados** geram cerca de **R$ 750 a R$ 800 por mês** de renda passiva.\n- **Tributação em 2026 (Lei 15.270/2025):** Os rendimentos de **FIIs seguem isentos de IR** para pessoa física, e dividendos de ações só sofrem retenção de 10% na fonte se passarem de **R$ 50.000/mês pagos por uma única empresa**.`,
      suggestedTool: {
        label: 'Simular minha meta na Calculadora de Dividendos',
        url: '/calculadoras/dividendos?renda=3000&dy=9.5',
      },
    };
  }

  return {
    answer: `**Análise Educativa (Cenário Brasil — Selic ${selic.toFixed(2)}% | CDI ${cdi.toFixed(2)}% | IPCA ${ipca.toFixed(2)}%):**\n\nPara tomar uma boa decisão financeira, siga a ordem dos **3 passos do método ABC**:\n1. **Passo A (Segurança):** Monte sua Reserva de Emergência em liquidez diária (Tesouro Selic ou CDB 100% CDI).\n2. **Passo B (Multiplicação):** Aproveite os juros compostos em títulos isentos (LCI/LCA) ou atrelados à inflação (Tesouro IPCA+) para proteger seu poder de compra.\n3. **Passo C (Renda Passiva):** Reinvista os proventos mensalmente para acelerar o efeito bola de neve rumo ao 1º milhão.`,
    suggestedTool: {
      label: 'Simular evolução na Calculadora do 1º Milhão',
      url: '/calculadoras/juros-compostos?inicial=5000&mensal=1000&anos=15',
    },
  };
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  try {
    const ip =
      context.request.headers.get('CF-Connecting-IP') ||
      context.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      context.request.headers.get('x-real-ip') ||
      'local-visitor';
    const today = new Date().toISOString().slice(0, 10);
    const currentUsage = dailyIpUsage.get(ip);

    if (currentUsage && currentUsage.date === today && currentUsage.count >= MAX_DAILY_FREE_QUESTIONS) {
      return new Response(
        JSON.stringify({
          limitReached: true,
          remainingFree: 0,
          answer:
            'Você utilizou suas **3 consultas gratuitas de hoje** no Consultor ABC IA! Continue usando todas as nossas **6 calculadoras livremente** ou conheça a **Planilha Oficial ABC** para organizar seu orçamento e planejar seu 1º milhão no Excel/Google Sheets.',
          suggestedTool: {
            label: 'Conhecer a Planilha Oficial ABC',
            url: '/planilha-abc',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const body = (await context.request.json()) as IaRequestBody;
    const rawQuestion = (body.question || '').trim().slice(0, 500);

    if (!rawQuestion) {
      return new Response(JSON.stringify({ error: 'Digite uma dúvida sobre investimentos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const selic = body.indicators?.selic ?? 14.25;
    const cdi = body.indicators?.cdi ?? 14.15;
    const ipca = body.indicators?.ipca12m ?? 4.56;

    const newCount = currentUsage && currentUsage.date === today ? currentUsage.count + 1 : 1;
    dailyIpUsage.set(ip, { date: today, count: newCount });
    const remainingFree = Math.max(0, MAX_DAILY_FREE_QUESTIONS - newCount);
    const conversationConsent = body.conversationConsent === true;

    const apiKey = context.env?.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = buildEducationalFallbackAnswer(rawQuestion, selic, cdi, ipca);
      await saveConversation(
        context.env?.TURSO_DATABASE_URL,
        context.env?.TURSO_AUTH_TOKEN,
        conversationConsent,
        rawQuestion,
        fallback.answer,
        'educational-engine'
      );
      return new Response(
        JSON.stringify({
          ...fallback,
          remainingFree,
          mode: 'educational-engine',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const systemInstruction = `Você é o Consultor Educativo do portal ABC Investimentos (abcinvestimentos.com.br).
Regras obrigatórias:
1. Seja didático, elegante, objetivo (máximo 3 parágrafos curtos ou tópicos claros) e use exemplos em Reais (R$).
2. Contexto econômico atual do Brasil (2026): Taxa Selic = ${selic}% a.a., CDI = ${cdi}% a.a., IPCA 12m = ${ipca}% a.a.
3. Regras fiscais vigentes em 2026: Tabela regressiva de IR da Renda Fixa (22,5% até 180d, 20% até 360d, 17,5% até 720d, 15% acima de 720d). LCI, LCA, CRI, CRA e FIIs continuam isentos de IR para pessoa física. Dividendos de uma mesma empresa acima de R$ 50 mil/mês têm retenção de 10% (Lei 15.270/2025).
4. COMPLIANCE CVM: Nunca recomende a compra ou venda de ações ou FIIs específicos (ex: não mande comprar PETR4 ou HGLG11). Explique sempre os conceitos matemáticos e classes de ativos de forma educativa.
5. Nunca peça dados pessoais (CPF, conta bancária ou senhas).`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: rawQuestion }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!geminiRes.ok) {
      const fallback = buildEducationalFallbackAnswer(rawQuestion, selic, cdi, ipca);
      await saveConversation(
        context.env?.TURSO_DATABASE_URL,
        context.env?.TURSO_AUTH_TOKEN,
        conversationConsent,
        rawQuestion,
        fallback.answer,
        'educational-engine-fallback'
      );
      return new Response(
        JSON.stringify({
          ...fallback,
          remainingFree,
          mode: 'educational-engine-fallback',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const aiText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      buildEducationalFallbackAnswer(rawQuestion, selic, cdi, ipca).answer;

    const fallbackSuggestion = buildEducationalFallbackAnswer(rawQuestion, selic, cdi, ipca).suggestedTool;
    await saveConversation(
      context.env?.TURSO_DATABASE_URL,
      context.env?.TURSO_AUTH_TOKEN,
      conversationConsent,
      rawQuestion,
      aiText,
      'gemini-live'
    );

    return new Response(
      JSON.stringify({
        answer: aiText,
        suggestedTool: fallbackSuggestion,
        remainingFree,
        mode: 'gemini-live',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Não foi possível processar sua pergunta no momento. Tente novamente em instantes.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
};
