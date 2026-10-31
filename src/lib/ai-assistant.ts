import { SITE_CONFIG } from '../config/site';
import {
  formatBRL,
  formatPct,
  simulateFixedIncomeComparison,
  simulateCompoundInterest,
  simulateEmergencyFund,
  simulateDividendsAndPassiveIncome,
} from './finance';

export interface RecommendedCalculator {
  title: string;
  slug: string;
  params?: string;
}

export interface AssistantResponse {
  answer: string;
  source: 'gemini-flash' | 'gemini-1.5-flash' | 'gemini-3.5-flash' | 'cloudflare-ai' | 'groq-llama' | 'openrouter-free' | 'abc-expert-engine';
  modelUsed?: string;
  remainingFree?: number;
  recommendedCalculators: RecommendedCalculator[];
}

export interface EconomicIndicators {
  selic: number;
  cdi: number;
  ipca12m: number;
  dolar: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConsultantQueryOptions {
  conversationConsent?: boolean;
  history?: ChatMessage[];
}

export function getSystemPrompt(indicators: EconomicIndicators): string {
  const { selic, cdi, ipca12m, dolar } = indicators;
  return `VOCÊ É: O Consultor Sênior de Inteligência Financeira e Patrimonial do portal ABC Investimentos (abcinvestimentos.com.br).
SEU OBJETIVO: Responder à dúvida financeira do usuário com extrema precisão técnica, clareza didática e foco na realidade do investidor brasileiro em 2026, eliminando o "economês" sem perder o rigor analítico.

DADOS ECONÔMICOS OFICIAIS ATUALIZADOS HOJE (BANCO CENTRAL DO BRASIL - SGS):
- Taxa Selic Over: ${formatPct(selic)} a.a.
- Taxa CDI: ${formatPct(cdi)} a.a.
- Inflação IPCA Acumulada (12 meses): ${formatPct(ipca12m)}
- Câmbio Dólar Comercial: R$ ${dolar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

REGRAS LEGISLATIVAS E FISCAIS DE 2026 NO BRASIL:
1. Renda Fixa Tradicional (CDB, Tesouro Direto, LC): Tabela regressiva de IR sobre o lucro (22,5% até 180 dias; 20% até 360 dias; 17,5% até 720 dias; 15% acima de 720 dias).
2. Isenção de IR Pessoa Física: LCI, LCA, CRI, CRA e Debêntures Incentivadas (lembrando das novas carências de 9 a 12 meses da Resolução CMN 5.118).
3. Rendimento da Poupança (Lei 12.703/2012): Com Selic > 8,5% a.a., rende 0,5% ao mês + TR (~6,17% a.a. + TR). Perde substancialmente para qualquer CDB 100% ou Tesouro Selic.
4. Fundos Imobiliários (FIIs): Rendimentos mensais permanecem isentos de IR para pessoa física.
5. Regra Orçamentária 50/30/20: 50% Gastos Essenciais, 30% Estilo de Vida, 20% Aportes Financeiros.
6. Ganho Real vs. Nominal: SEMPRE desconte o IPCA para mostrar quanto o poder de compra realmente aumentou.

DIRETRIZES MANDATÓRIAS DE TOM E RESPOSTA:
- NUNCA use introduções robóticas como "Olá! Como assistente de IA...", "Com certeza!", "Essa é uma excelente pergunta!". Comece direto no diagnóstico.
- ESTRUTURE A RESPOSTA EM 3 BLOCOS CURTOS E DIRETOS:
  1. DIAGNÓSTICO DIRETO: O veredito prático em 2 ou 3 frases claras com os números em negrito.
  2. SIMULAÇÃO OU CÁLCULO REAL: Apresente os números matemáticos reais com base nas taxas de hoje.
  3. ATENÇÃO PRÁTICA: O ponto crítico que a maioria esquece (liquidez diária, carência, FGC de R$ 250 mil por CPF/instituição ou Imposto de Renda).
- Responda em português do Brasil com formatação Markdown limpa (negritos e listas com tópicos).`;
}

/**
 * Conector de Nuvem: conecta ao Gemini Flash via Google AI Studio com fallback inteligente de modelos
 */
async function callGeminiApi(
  question: string,
  indicators: EconomicIndicators,
  apiKey: string
): Promise<AssistantResponse | null> {
  // Escala de caida: prioriza modelos 1.5, seguido de 3.5-flash-lite, 3.5-flash e flash-latest
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
  const systemPrompt = getSystemPrompt(indicators);

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nPERGUNTA DO INVESTIDOR:\n${question}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 850,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidate || typeof candidate !== 'string') continue;

      const sourceTag: 'gemini-1.5-flash' | 'gemini-3.5-flash' | 'gemini-flash' = model.includes('1.5')
        ? 'gemini-1.5-flash'
        : model.includes('3.5')
          ? 'gemini-3.5-flash'
          : 'gemini-flash';

      return {
        answer: candidate.trim(),
        source: sourceTag,
        modelUsed: model,
        recommendedCalculators: detectRecommendedCalculators(question),
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extrai valores monetários aproximados de strings (ex.: "10 mil", "R$ 10.000", "50000", "50k")
 * Ignora percentuais ("105% do CDI" não é dinheiro, é taxa).
 */
function extractAmountFromQuery(query: string, defaultAmount = 10000): number {
  const clean = query.toLowerCase();

  const kMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (kMatch) return Number.parseFloat(kMatch[1].replace(',', '.')) * 1000;

  const milMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(milhao|milhão|milhoes|milhões|mil)/);
  if (milMatch) {
    const val = Number.parseFloat(milMatch[1].replace(',', '.'));
    return milMatch[2].startsWith('milh') ? val * 1000000 : val * 1000;
  }

  const currencyMatch = clean.match(/(?:r\$\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2}))/);
  if (currencyMatch) {
    return Number(currencyMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  const reaisMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(reais|reales)/);
  if (reaisMatch) {
    return Number(reaisMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  // Números grandes sem cifrão (ex.: "10000", "10.000", "1.500,00"),
  // pulando sequências seguidas de % (taxas, ex.: "110%").
  const plainCandidates = [...clean.matchAll(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}(?:,\d{2})?)/g)];
  for (const candidate of plainCandidates) {
    const match = candidate[0];
    const index = candidate.index ?? 0;
    const nextChar = clean.slice(index + match.length).trimStart()[0];
    if (nextChar === '%') continue;
    const value = Number(match.replace(/\./g, '').replace(',', '.'));
    if (value >= 50) return value;
  }

  return defaultAmount;
}

/**
 * Extrai o percentual do CDI citado na pergunta (ex.: "CDB 110% do CDI" → 110).
 * Valida a faixa 50–200% para não confundir com taxas anuais (ex.: "12,5% a.a.").
 */
function extractCdbPctCdiFromQuery(query: string): number | null {
  const clean = query.toLowerCase();
  const nearCdb = clean.match(/cdb[^%]{0,30}?(\d{2,3}(?:[.,]\d+)?)\s*%/);
  const generic = nearCdb ?? clean.match(/(\d{2,3}(?:[.,]\d+)?)\s*%/);
  if (!generic) return null;
  const value = Number(generic[1].replace(',', '.'));
  return value >= 50 && value <= 200 ? value : null;
}

function extractLciPctCdiFromQuery(query: string): number | null {
  const clean = query.toLowerCase();
  const nearLci = clean.match(/l[ci][ca][^%]{0,30}?(\d{2,3}(?:[.,]\d+)?)\s*%/);
  if (!nearLci) return null;
  const value = Number(nearLci[1].replace(',', '.'));
  return value >= 50 && value <= 150 ? value : null;
}

function extractMonthsFromQuery(query: string, defaultMonths = 12): number {
  const clean = query.toLowerCase();
  const years = clean.match(/(\d+(?:[.,]\d+)?)\s*(anos?|years?)/);
  if (years) {
    return Math.min(360, Math.max(1, Math.round(Number(years[1].replace(',', '.')) * 12)));
  }
  const months = clean.match(/(\d+)\s*(meses?|months?)/);
  if (months) {
    return Math.min(360, Math.max(1, Number(months[1])));
  }
  return defaultMonths;
}

/**
 * Detecta perguntas de simulação numérica que o motor local responde com
 * matemática determinística — sem consultar o LLM (evita taxas inventadas
 * por modelos pequenos em perguntas com números).
 */
export function isDeterministicScenario(question: string): boolean {
  const q = question.trim().toLowerCase();
  if (!q) return false;
  // Perguntas puramente conceituais ("o que é CDI?") seguem para o LLM.
  if (/^(o que [ée]\b|o que significa|qual o significado|o que s[ãa]o\b|defini[cç][ãa]o|me explique o que [ée]\b|explique o que [ée]\b)/.test(q)) {
    return false;
  }

  return (
    /cdb|lci|lca|% do cdi|% cdi|renda fixa/.test(q) ||
    /poupan[aç]ca|tesouro selic|prefixado|p[óo]s[- ]fixado/.test(q) ||
    /dividendo|fii|fundo imobili[áa]rio|viver de renda|renda passiva/.test(q) ||
    /reserva|emerg[êe]ncia/.test(q) ||
    /milh[ãa]o|juros compostos|aportar/.test(q) ||
    /alugar|aluguel|financiar|financiamento|im[óo]vel|comprar casa|comprar apartamento/.test(q) ||
    /quanto rende|rendimento de|renderia/.test(q)
  );
}

/**
 * Detecta as calculadoras mais relevantes no portal com base na pergunta
 */
export function detectRecommendedCalculators(question: string): RecommendedCalculator[] {
  const q = question.toLowerCase();

  if (q.includes('cdb') || q.includes('lci') || q.includes('lca') || q.includes('renda fixa') || q.includes('poupança') || q.includes('selic')) {
    return [
      {
        title: 'Simulador Renda Fixa (CDB vs LCI vs Poupança)',
        slug: 'renda-fixa',
        params: '?valor=10000&prazo=12',
      },
      {
        title: 'Calculadora de Juros Compostos',
        slug: 'juros-compostos',
      },
    ];
  }

  if (q.includes('dividendo') || q.includes('fii') || q.includes('renda passiva') || q.includes('viver de renda') || q.includes('mensal')) {
    return [
      {
        title: 'Calculadora de Dividendos & Viver de Renda',
        slug: 'dividendos',
        params: '?rendaDesejada=3000',
      },
      {
        title: 'Preço-Teto de Ações e FIIs (Bazin & Graham)',
        slug: 'preco-teto-acoes-fiis',
      },
    ];
  }

  if (q.includes('reserva') || q.includes('emergencia') || q.includes('emergência') || q.includes('segurança')) {
    return [
      {
        title: 'Calculadora de Reserva de Emergência',
        slug: 'reserva-emergencia',
        params: '?custo=4000',
      },
      {
        title: 'Simulador Renda Fixa (Liquidez Diária)',
        slug: 'renda-fixa',
      },
    ];
  }

  if (q.includes('alug') || q.includes('financ') || q.includes('imovel') || q.includes('imóvel') || q.includes('amortiz')) {
    return [
      {
        title: 'Simulador Alugar vs. Financiar Imóvel',
        slug: 'alugar-vs-financiar',
        params: '?imovel=450000',
      },
      {
        title: 'Calculadora de Juros Compostos',
        slug: 'juros-compostos',
      },
    ];
  }

  if (q.includes('milh') || q.includes('milhao') || q.includes('milhão') || q.includes('juros compostos') || q.includes('prazo') || q.includes('anos')) {
    return [
      {
        title: 'Calculadora Juros Compostos & Rumo ao 1º Milhão',
        slug: 'juros-compostos',
        params: '?inicial=5000&mensal=1000',
      },
      {
        title: 'Simulador Renda Fixa',
        slug: 'renda-fixa',
      },
    ];
  }

  return [
    {
      title: 'Simulador Renda Fixa (CDB vs LCI)',
      slug: 'renda-fixa',
    },
    {
      title: 'Calculadora de Juros Compostos',
      slug: 'juros-compostos',
    },
  ];
}

/**
 * Motor Especialista Heurístico Local (Offline / Resiliência 100%)
 * Executa as diretrizes do pré-prompt Tier-1 diretamente com matemática auditada.
 */
export function generateLocalExpertResponse(
  question: string,
  indicators: EconomicIndicators
): AssistantResponse {
  const q = question.toLowerCase();
  const { selic, cdi, ipca12m } = indicators;
  const amount = extractAmountFromQuery(question, 10000);

  const isRendaFixaQuestion =
    /cdb|lci|lca|renda fixa|poupança|tesouro selic|prefixado|p[óo]s[- ]fixado|% do cdi|% cdi/.test(q);
  const isYieldQuestion =
    /quanto rende|rendimento de|renderia/.test(q) && !/dividendo|fii|fundo imobili|a[cç][ãa]o|reserva|emerg[êe]ncia/.test(q);

  // Cenário 1: Renda Fixa (CDB/LCI/LCA/Poupança/Tesouro Selic/"quanto rende")
  if (isRendaFixaQuestion || isYieldQuestion) {
    const cdbPctCdi = extractCdbPctCdiFromQuery(question) ?? 105;
    const lciPctCdi = extractLciPctCdiFromQuery(question) ?? 92;
    const months = extractMonthsFromQuery(question, 12);
    const rf = simulateFixedIncomeComparison({
      amount,
      months,
      cdiAnnualPct: cdi,
      selicAnnualPct: selic,
      ipcaAnnualPct: ipca12m,
      cdbPctCdi,
      lciLcaPctCdi: lciPctCdi,
    });

    const cdbOpt = rf.options.find((o) => o.id === 'cdb')!;
    const lciOpt = rf.options.find((o) => o.id === 'lci_lca')!;
    const poupancaOpt = rf.options.find((o) => o.id === 'poupanca')!;
    const tesouroOpt = rf.options.find((o) => o.id === 'tesouro_selic')!;

    const answer = `DIAGNÓSTICO DIRETO:
Com o CDI atual em **${formatPct(cdi)} a.a.** e prazo de **${months} ${months === 1 ? 'mês' : 'meses'}** (alíquota de IR de ${formatPct(rf.irBracketPct, 1)}), a opção com maior retorno líquido é **${rf.winner.name}**, entregando **${formatBRL(rf.winner.netFinalAmount)}** no resgate.

SIMULAÇÃO REAL com ${formatBRL(amount)}:
- **CDB ${cdbPctCdi}% do CDI:** rende bruto ${formatPct(cdbOpt.grossAnnualRatePct)} a.a.; após IR de ${formatBRL(cdbOpt.irAmount)} sobra líquido **${formatPct(cdbOpt.netAnnualRatePct)} a.a.** → **${formatBRL(cdbOpt.netFinalAmount)}** (+${formatBRL(cdbOpt.netProfit)} de lucro).
- **LCI/LCA ${lciPctCdi}% do CDI (isenta de IR):** rende líquido **${formatPct(lciOpt.netAnnualRatePct)} a.a.** → **${formatBRL(lciOpt.netFinalAmount)}** (+${formatBRL(lciOpt.netProfit)} de lucro).
- **Poupança:** apenas ${formatPct(poupancaOpt.netAnnualRatePct)} a.a. → ${formatBRL(poupancaOpt.netFinalAmount)} (${formatBRL(rf.differenceWinnerVsPoupanca)} a menos que a melhor opção).
- **Tesouro Selic:** após IR e taxa B3 → ${formatBRL(tesouroOpt.netFinalAmount)}.
- **Equivalência:** uma LCI de ${lciPctCdi}% equivale a um CDB de ${formatPct(rf.equivalentCdbPctForLci, 1)} do CDI neste prazo.

ATENÇÃO PRÁTICA:
LCI/LCA exige carência de 9 a 12 meses (Resolução CMN 5.118); se houver chance de resgate antes, prefira **Tesouro Selic** ou **CDB com liquidez diária**. CDBs têm garantia do FGC até **R$ 250 mil por CPF/instituição**; o Tesouro é garantido pelo próprio governo.`;

    return {
      answer,
      source: 'abc-expert-engine',
      recommendedCalculators: [
        {
          title: 'Simulador Renda Fixa (CDB vs LCI)',
          slug: 'renda-fixa',
          params: `?valor=${amount}&prazo=${months}&cdb=${cdbPctCdi}&lci=${lciPctCdi}`,
        },
      ],
    };
  }

  // Cenário 2: Renda Passiva / Dividendos / Viver de Renda
  if (q.includes('dividendo') || q.includes('viver de renda') || q.includes('3.000') || q.includes('renda passiva') || q.includes('fii')) {
    const monthlyTarget = extractAmountFromQuery(question, 3000);
    const div = simulateDividendsAndPassiveIncome({
      desiredMonthlyIncome: monthlyTarget,
      dividendYieldAnnualPct: 9.0,
      currentPatrimony: 0,
      monthlyContribution: 1500,
      reinvestDividends: true,
    });

    const answer = `**Diagnóstico Direto:**
Para receber uma renda passiva limpa de **${formatBRL(monthlyTarget)} por mês**, você precisa construir um patrimônio acumulado em Fundos Imobiliários (FIIs) ou Ações pagadoras de dividendos de aproximadamente **${formatBRL(div.requiredPatrimony)}** (considerando um Dividend Yield médio realista de **9,0% a.a. isento**).

**Estratégia Matemática de Construção:**
- **Renda Anual Gerada:** ${formatBRL(monthlyTarget * 12)} ao ano pingando na sua conta corrente.
- **Rendimento Médio Mensal em FIIs:** Cerca de **0,72% a 0,78% ao mês isento de IR**.
- **Aportando R$ 1.500/mês:** Reinvestindo todos os dividendos em ativos de qualidade, você atinge esse patrimônio em aproximadamente **${div.yearsToGoal ?? 18} anos**.
- **Poder de Compra Real:** Descontando a inflação (IPCA ${formatPct(ipca12m)}), seu patrimônio real ajustado preserva seu poder de compra para sempre.

**Ponto de Atenção Prático:**
Não busque fundos apenas pelo maior rendimento recente (*Dividend Yield artificial*). Dívidas altas e vacância financeira em imóveis podem cortar proventos do dia para a noite. Diversifique entre FIIs de Tijolo (shoppings, galpões logísticos), FIIs de Papel High Grade e empresas com modelo à prova de crises (Bancos, Energia, Saneamento e Seguros).`;

    return {
      answer,
      source: 'abc-expert-engine',
      recommendedCalculators: [
        {
          title: 'Calculadora de Dividendos & Viver de Renda',
          slug: 'dividendos',
          params: `?rendaDesejada=${monthlyTarget}&yield=9`,
        },
        {
          title: 'Preço-Teto de Ações e FIIs (Bazin)',
          slug: 'preco-teto-acoes-fiis',
        },
      ],
    };
  }

  // Cenário 3: Reserva de Emergência
  if (q.includes('reserva') || q.includes('emergencia') || q.includes('emergência')) {
    const cost = extractAmountFromQuery(question, 4000);
    const resClt = simulateEmergencyFund({ monthlyEssentialCost: cost, currentReserve: 0, monthlySavingsCapacity: 1000, profile: 'clt', cdiAnnualPct: cdi });
    const resAut = simulateEmergencyFund({ monthlyEssentialCost: cost, currentReserve: 0, monthlySavingsCapacity: 1000, profile: 'autonomo', cdiAnnualPct: cdi });

    const answer = `**Diagnóstico Direto:**
A Reserva de Emergência **não foi feita para dar lucro, mas sim para dar paz**. Seu valor exato depende do seu regime profissional e custo de vida essencial (moradia, alimentação, saúde, contas básicas):
- **Se você for CLT:** A recomendação oficial é de **6 meses** do seu custo essencial = **${formatBRL(resClt.recommendedTarget)}**.
- **Se você for Autônomo, PJ ou Profissional Liberal:** A recomendação é de **12 meses** = **${formatBRL(resAut.recommendedTarget)}**, por causa da volatilidade na receita mensal.

**Onde Deixar esse Dinheiro Guardado em 2026:**
1. **Tesouro Selic (Tesouro Direto):** O investimento mais seguro do Brasil, com rentabilidade atrelada à Selic (${formatPct(selic)} a.a.) e liquidez D+1.
2. **CDB de Liquidez Diária (100% a 102% do CDI):** De bancos sólidos, resgatável a qualquer momento com garantia do FGC até R$ 250 mil.
3. **Jamais coloque na Poupança:** A poupança rende ~6,17% a.a. + TR e só credita juros na data de aniversário mensal. Se resgatar no 29º dia, você perde 100% do rendimento do mês.

**Ponto de Atenção Prático:**
A reserva deve ficar **100% separada** da conta corrente do dia a dia para evitar gastos por impulso, e nunca em ativos com carência ou risco de mercado (como FIIs, ações ou CDBs sem liquidez diária).`;

    return {
      answer,
      source: 'abc-expert-engine',
      recommendedCalculators: [
        {
          title: 'Calculadora de Reserva de Emergência',
          slug: 'reserva-emergencia',
          params: `?custo=${cost}&tipo=clt`,
        },
        {
          title: 'Simulador Renda Fixa (Liquidez Diária)',
          slug: 'renda-fixa',
        },
      ],
    };
  }

  // Cenário 4: Juros Compostos & Rumo ao 1º Milhão
  if (q.includes('milh') || q.includes('1 milhao') || q.includes('1 milhão') || q.includes('juros compostos') || q.includes('aportar')) {
    const monthly = extractAmountFromQuery(question, 1000);
    const jc = simulateCompoundInterest({
      initialAmount: 5000,
      monthlyContribution: monthly,
      annualRatePct: 12.0,
      years: 15,
      inflationAnnualPct: ipca12m,
    });

    const answer = `**Diagnóstico Direto:**
Com um aporte inicial de **R$ 5.000,00** e investindo **${formatBRL(monthly)} por mês** a uma taxa média de **12,0% ao ano** (compatível com a renda fixa atual de Selic ${formatPct(selic)} e carteira diversificada):
- Você atinge **R$ 1.000.000,00 em aproximadamente ${jc.yearsToFirstMillion} anos** (${jc.monthsToFirstMillion} meses).
- Em 15 anos, seu patrimônio acumulado será de **${formatBRL(jc.finalAmount)}**.
- **A força dos Juros Compostos:** Desse montante, **${formatPct(jc.interestSharePct, 1)}** veio exclusivamente de juros sobre juros (${formatBRL(jc.totalInterest)}), enquanto você tirou do bolso apenas ${formatBRL(jc.totalInvested)}.

**Poder de Compra Real (Descontando a Inflação):**
Com a inflação IPCA atual em **${formatPct(ipca12m)} ao ano**, seu poder de compra real acumulado equivalente a hoje será de **${formatBRL(jc.realFinalAmount)}**.

**Ponto de Atenção Prático:**
No início (primeiros 3 a 5 anos), a maior parte do crescimento vem do seu esforço de aporte mensal. É a partir do 7º ano que o "efeito bola de neve" se inverte e os juros gerados no mês superam o valor do seu próprio aporte. A consistência nos aportes importa mais do que tentar adivinhar o ativo da moda.`;

    return {
      answer,
      source: 'abc-expert-engine',
      recommendedCalculators: [
        {
          title: 'Calculadora Juros Compostos & 1º Milhão',
          slug: 'juros-compostos',
          params: `?inicial=5000&mensal=${monthly}&taxa=12`,
        },
      ],
    };
  }

  // Cenário 5: Alugar vs Financiar Imóvel
  if (q.includes('alug') || q.includes('financiar') || q.includes('financiamento') || q.includes('imovel') || q.includes('imóvel') || q.includes('comprar casa')) {
    const homeValue = extractAmountFromQuery(question, 450000);

    const answer = `**Diagnóstico Direto:**
No ambiente de juros altos com a taxa Selic a **${formatPct(selic)} a.a.**, **financiar um imóvel costuma ser matematicamente desfavorável** se comparado à estratégia de morar de aluguel e investir a diferença de capital na renda fixa:
- A taxa de juros média de um financiamento imobiliário (SFH/SFI) gira entre **10,5% a 12,5% ao ano** + seguro e taxas de administração.
- O aluguel residencial no Brasil custa historicamente entre **0,35% a 0,45% ao mês** do valor de mercado do imóvel (cerca de 4,5% a 5,5% ao ano).

**Comparativo Financeiro para Imóvel de ${formatBRL(homeValue)}:**
1. **No Financiamento:** Uma entrada de 20% (${formatBRL(homeValue * 0.2)}) mais parcelas iniciais elevadas de amortização farão você pagar até 2,2 a 2,8 vezes o valor original do imóvel ao longo de 30 anos (SAC).
2. **No Aluguel + Aporte da Diferença:** Pagando um aluguel de ~0,4% (${formatBRL(homeValue * 0.004)}/mês) e investindo a entrada e a economia mensal a ${formatPct(cdi)} do CDI, você acumula o patrimônio suficiente para **comprar o imóvel à vista na metade do prazo** e ainda manter uma sobra expressiva.

**Ponto de Atenção Prático:**
A decisão não é apenas financeira, envolve aspectos emocionais de segurança familiar e reformas. Se optar por financiar, priorize amortizações extraordinárias pelo saldo devedor (Tabela SAC) para eliminar anos de juros futuros.`;

    return {
      answer,
      source: 'abc-expert-engine',
      recommendedCalculators: [
        {
          title: 'Simulador Alugar vs. Financiar Imóvel',
          slug: 'alugar-vs-financiar',
          params: `?imovel=${homeValue}`,
        },
        {
          title: 'Calculadora de Juros Compostos',
          slug: 'juros-compostos',
        },
      ],
    };
  }

  // Cenário Genérico / Padrão: Como Começar a Investir ou Alocação Inteligente
  const answer = `**Diagnóstico Direto:**
No cenário macroeconômico atual com **Selic a ${formatPct(selic)} a.a.** e **CDI a ${formatPct(cdi)} a.a.**, o investidor brasileiro tem uma oportunidade histórica na renda fixa conservadora com liquidez diária, permitindo acumular patrimônio sem correr riscos desnecessários.

**Plano Prático em 3 Etapas para Alocar seu Capital:**
1. **Passo 1 (Segurança Imediata):** Monte sua Reserva de Emergência (3 a 6 meses do seu custo de vida) em **Tesouro Selic** ou **CDB 100% do CDI** de liquidez diária.
2. **Passo 2 (Ganho Real contra a Inflação):** Aloque 30% a 50% dos seus aportes em títulos atrelados ao **Tesouro IPCA+** para travar um ganho real líquido acima da inflação oficial (${formatPct(ipca12m)}).
3. **Passo 3 (Geração de Renda Passiva):** Conforme sua base de segurança crescer, inicie posições graduais em **Fundos Imobiliários (FIIs)** e ações pagadoras de dividendos para receber proventos mensais isentos.

**Ponto de Atenção Prático:**
Evite concentrar patrimônio em um único banco ou produto financeiro. Aplique a **Regra 50/30/20** no seu orçamento mensal para garantir que pelo menos 20% da sua renda líquida seja aportada com disciplina todo mês.`;

  return {
    answer,
    source: 'abc-expert-engine',
    recommendedCalculators: [
      {
        title: 'Simulador Renda Fixa (CDB vs LCI)',
        slug: 'renda-fixa',
      },
      {
        title: 'Calculadora Juros Compostos & 1º Milhão',
        slug: 'juros-compostos',
      },
      {
        title: 'Calculadora de Reserva de Emergência',
        slug: 'reserva-emergencia',
      },
    ],
  };
}

/**
 * Função principal do Consultor IA:
 * 1. Tenta API Gemini se a chave estiver disponível
 * 2. Se não houver chave ou se falhar, aciona o motor heurístico com zero latência
 */
export async function processConsultantQuery(
  question: string,
  indicatorsOverride?: Partial<EconomicIndicators>,
  options: ConsultantQueryOptions = {}
): Promise<AssistantResponse> {
  const indicators: EconomicIndicators = {
    selic: indicatorsOverride?.selic ?? SITE_CONFIG.defaultIndicators.selic,
    cdi: indicatorsOverride?.cdi ?? SITE_CONFIG.defaultIndicators.cdi,
    ipca12m: indicatorsOverride?.ipca12m ?? SITE_CONFIG.defaultIndicators.ipca12m,
    dolar: indicatorsOverride?.dolar ?? SITE_CONFIG.defaultIndicators.dolar,
  };

  // Perguntas de simulação numérica nunca vão ao LLM: o motor local responde
  // com matemática auditada usando as taxas oficiais (sem risco de o modelo
  // inventar CDI/Selic diferentes dos dados injetados pelo Banco Central).
  if (isDeterministicScenario(question)) {
    return generateLocalExpertResponse(question, indicators);
  }

  if (typeof window !== 'undefined') {
    const payload = JSON.stringify({
      question,
      indicators,
      conversationConsent: options.conversationConsent === true,
      history: options.history,
    });

    // Tenta a rota principal e, se falhar ou for bloqueada (bloqueadores de conteudo do
    // navegador podem mirar /api/ia), cai na rota alternativa /api/consulta.
    // Timeout de 30s em cada tentativa: se a API travar, o motor local responde na hora.
    for (const endpoint of ['/api/ia', '/api/consulta']) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000),
          body: payload,
        });

        if (response.ok) {
          const data = (await response.json()) as {
            answer?: string;
            mode?: string;
            remainingFree?: number;
          };

          if (typeof data.answer === 'string' && data.answer.trim()) {
            return {
              answer: data.answer,
              source:
                data.mode === 'gemini-live'
                  ? 'gemini-flash'
                  : data.mode === 'cloudflare-live'
                    ? 'cloudflare-ai'
                    : data.mode === 'groq-live'
                      ? 'groq-llama'
                      : data.mode === 'openrouter-live'
                        ? 'openrouter-free'
                        : 'abc-expert-engine',
              remainingFree: typeof data.remainingFree === 'number' ? data.remainingFree : undefined,
              recommendedCalculators: detectRecommendedCalculators(question),
            };
          }
        }
      } catch {
        // tenta a próxima rota; se todas falharem, o motor local responde
      }
    }
  }

  return generateLocalExpertResponse(question, indicators);
}
