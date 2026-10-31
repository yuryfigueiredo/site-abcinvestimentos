// Desativa o body parser da Vercel: assim o getter `request.body` não lança "Invalid JSON"
// e o stream cru fica intacto para o nosso readJsonBody ler com segurança.
export const config = { api: { bodyParser: false } };

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
 * Normaliza qualquer formato de body (objeto, string JSON, Buffer) para objeto.
 */
function normalizeBody(raw: unknown): Record<string, unknown> {
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

/**
 * Lê o body do request da Vercel SEM quebrar:
 * - O getter `request.body` do runtime Node da Vercel pode lançar "Invalid JSON"
 *   (acontece com clientes HTTP/1.1 como curl) — por isso o acesso fica dentro de try/catch.
 * - Se o body parseado estiver vazio, cai no fallback lendo o stream cru (IncomingMessage)
 *   e tentando JSON e depois application/x-www-form-urlencoded.
 */
async function readJsonBody(request: VercelRequest): Promise<Record<string, unknown>> {
  // 1) Tenta request.body (getter que pode lançar "Invalid JSON" em clientes HTTP/1.1)
  let pre: unknown;
  try {
    pre = request.body;
  } catch {
    pre = undefined;
  }
  const parsed = normalizeBody(pre);
  if (Object.keys(parsed).length > 0) return parsed;

  // 2) Tenta request.rawBody (string/Buffer cru provided pela Vercel quando o body parser está ativo)
  try {
    const rawBody = (request as unknown as { rawBody?: unknown }).rawBody;
    const fromRaw = normalizeBody(rawBody);
    if (Object.keys(fromRaw).length > 0) return fromRaw;
    if (typeof rawBody === 'string' && rawBody.trim()) {
      const params = new URLSearchParams(rawBody);
      const entries = [...params.entries()];
      if (entries.length > 0) return Object.fromEntries(entries) as Record<string, unknown>;
    }
  } catch {
    // segue para o stream
  }

  // 3) Fallback final: lê o stream cru (IncomingMessage)
  try {
    const stream = request as unknown as AsyncIterable<Uint8Array | string>;
    if (typeof (request as unknown as NodeJS.ReadableStream).on === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) {
        try {
          return normalizeBody(JSON.parse(raw));
        } catch {
          const params = new URLSearchParams(raw);
          const entries = [...params.entries()];
          if (entries.length > 0) return Object.fromEntries(entries) as Record<string, unknown>;
        }
      }
    }
  } catch {
    // stream indisponível — segue com body vazio
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

/* ---------------------------------------------------------------------------
 * Motor determinístico local (espelho de src/lib/ai-assistant.ts + finance.ts).
 * Chamadas diretas a /api/ia (fora do site, ex.: bots) não passam pelo
 * roteador do navegador nem enviam indicadores. Perguntas numéricas precisam
 * de matemática auditada — nunca de um LLM, que pode inventar taxas.
 * Este arquivo é self-contained de propósito: a Vercel não empacota imports
 * de src/lib nos handlers de api/.
 * ------------------------------------------------------------------------- */

interface ServerIndicators {
  selic: number;
  cdi: number;
  ipca12m: number;
}

interface ServerRecommendedCalculator {
  title: string;
  slug: string;
  params?: string;
}

function formatBRL(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPct(value: number, decimals = 2): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function annualToMonthlyDecimal(annualPct: number): number {
  if (annualPct <= -100) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function monthlyDecimalToAnnualPct(monthlyDecimal: number): number {
  return (Math.pow(1 + monthlyDecimal, 12) - 1) * 100;
}

function getRegressiveIrRatePct(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20.0;
  if (days <= 720) return 17.5;
  return 15.0;
}

function getPoupancaAnnualRatePct(selicAnnualPct: number, trAnnualPct = 0.95): number {
  const trMonthly = annualToMonthlyDecimal(trAnnualPct);
  const baseMonthly = selicAnnualPct > 8.5 ? 0.005 : annualToMonthlyDecimal(selicAnnualPct * 0.7);
  return monthlyDecimalToAnnualPct((1 + baseMonthly) * (1 + trMonthly) - 1);
}

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
  if (currencyMatch) return Number(currencyMatch[1].replace(/\./g, '').replace(',', '.'));

  const reaisMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(reais|reales)/);
  if (reaisMatch) return Number(reaisMatch[1].replace(/\./g, '').replace(',', '.'));

  for (const candidate of clean.matchAll(/(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}(?:,\d{2})?)/g)) {
    const match = candidate[0];
    const nextChar = clean.slice((candidate.index ?? 0) + match.length).trimStart()[0];
    if (nextChar === '%') continue;
    const value = Number(match.replace(/\./g, '').replace(',', '.'));
    if (value >= 50) return value;
  }

  return defaultAmount;
}

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
  if (years) return Math.min(360, Math.max(1, Math.round(Number(years[1].replace(',', '.')) * 12)));
  const months = clean.match(/(\d+)\s*(meses?|months?)/);
  if (months) return Math.min(360, Math.max(1, Number(months[1])));
  return defaultMonths;
}

function isDeterministicScenario(question: string): boolean {
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

function normalizeIndicators(raw: unknown): ServerIndicators {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const pick = (key: string, fallback: number): number => {
    const value = source[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    selic: pick('selic', 13.75),
    cdi: pick('cdi', 13.65),
    ipca12m: pick('ipca12m', 4.58),
  };
}

interface ServerFixedIncomeOption {
  id: 'poupanca' | 'tesouro_selic' | 'cdb' | 'lci_lca';
  name: string;
  grossAnnualRatePct: number;
  netAnnualRatePct: number;
  irAmount: number;
  netFinalAmount: number;
  netProfit: number;
}

function computeFixedIncomeComparison(input: {
  amount: number;
  months: number;
  cdiAnnualPct: number;
  selicAnnualPct: number;
  cdbPctCdi: number;
  lciLcaPctCdi: number;
}) {
  const initial = Math.max(0, input.amount);
  const months = Math.max(1, Math.min(360, Math.round(input.months)));
  const days = Math.round(months * (365.25 / 12));
  const irBracketPct = getRegressiveIrRatePct(days);
  const irDecimal = irBracketPct / 100;
  const totalInvested = Number(initial.toFixed(2));

  const poupancaAnnualPct = getPoupancaAnnualRatePct(input.selicAnnualPct);
  const cdbGrossAnnualPct = (input.cdiAnnualPct * input.cdbPctCdi) / 100;
  const lciGrossAnnualPct = (input.cdiAnnualPct * input.lciLcaPctCdi) / 100;
  const tesouroGrossAnnualPct = input.selicAnnualPct;

  const compound = (annualRatePct: number): number => {
    const r = annualToMonthlyDecimal(annualRatePct);
    let balance = initial;
    for (let m = 1; m <= months; m++) balance = balance * (1 + r);
    return balance;
  };

  // Poupança: isenta de IR (Lei 12.703/2012)
  const poupancaGrossFinal = compound(poupancaAnnualPct);
  const poupancaNetProfit = poupancaGrossFinal - totalInvested;

  // Tesouro Selic: IR regressivo + taxa B3 de 0,20% a.a. só sobre o que exceder R$ 10 mil
  const tesouroGrossFinal = compound(tesouroGrossAnnualPct);
  const avgBalanceTesouro = (initial + tesouroGrossFinal) / 2;
  const b3FeeAmount = Math.max(0, avgBalanceTesouro - 10_000) * 0.002 * (months / 12);
  const tesouroGrossProfit = Math.max(0, tesouroGrossFinal - totalInvested - b3FeeAmount);
  const tesouroIrAmount = tesouroGrossProfit * irDecimal;
  const tesouroNetFinal = totalInvested + tesouroGrossProfit - tesouroIrAmount;

  // CDB: IR regressivo, sem taxa de custódia
  const cdbGrossFinal = compound(cdbGrossAnnualPct);
  const cdbGrossProfit = Math.max(0, cdbGrossFinal - totalInvested);
  const cdbIrAmount = cdbGrossProfit * irDecimal;
  const cdbNetFinal = cdbGrossFinal - cdbIrAmount;

  // LCI/LCA: isenta de IR para pessoa física
  const lciGrossFinal = compound(lciGrossAnnualPct);
  const lciNetProfit = Math.max(0, lciGrossFinal - totalInvested);

  const options: ServerFixedIncomeOption[] = [
    {
      id: 'poupanca',
      name: 'Poupança (Isenta)',
      grossAnnualRatePct: Number(poupancaAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(poupancaAnnualPct.toFixed(2)),
      irAmount: 0,
      netFinalAmount: Number(poupancaGrossFinal.toFixed(2)),
      netProfit: Number(poupancaNetProfit.toFixed(2)),
    },
    {
      id: 'tesouro_selic',
      name: 'Tesouro Selic',
      grossAnnualRatePct: Number(tesouroGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number((tesouroGrossAnnualPct * (1 - irDecimal)).toFixed(2)),
      irAmount: Number(tesouroIrAmount.toFixed(2)),
      netFinalAmount: Number(tesouroNetFinal.toFixed(2)),
      netProfit: Number((tesouroNetFinal - totalInvested).toFixed(2)),
    },
    {
      id: 'cdb',
      name: `CDB (${input.cdbPctCdi}% do CDI)`,
      grossAnnualRatePct: Number(cdbGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number((cdbGrossAnnualPct * (1 - irDecimal)).toFixed(2)),
      irAmount: Number(cdbIrAmount.toFixed(2)),
      netFinalAmount: Number(cdbNetFinal.toFixed(2)),
      netProfit: Number((cdbNetFinal - totalInvested).toFixed(2)),
    },
    {
      id: 'lci_lca',
      name: `LCI / LCA (${input.lciLcaPctCdi}% do CDI Isenta)`,
      grossAnnualRatePct: Number(lciGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(lciGrossAnnualPct.toFixed(2)),
      irAmount: 0,
      netFinalAmount: Number(lciGrossFinal.toFixed(2)),
      netProfit: Number(lciNetProfit.toFixed(2)),
    },
  ];

  const winner = options.reduce((best, opt) => (opt.netFinalAmount > best.netFinalAmount ? opt : best), options[0]);

  return {
    irBracketPct,
    winner,
    options,
    differenceWinnerVsPoupanca: Number((winner.netFinalAmount - options[0].netFinalAmount).toFixed(2)),
    equivalentCdbPctForLci: Number((input.lciLcaPctCdi / (1 - irDecimal)).toFixed(1)),
  };
}

function computeDividendsGoal(desiredMonthlyIncome: number) {
  const desiredMonthly = Math.max(100, desiredMonthlyIncome);
  const monthlyYieldDecimal = annualToMonthlyDecimal(9.0);
  const requiredPatrimony = Number((desiredMonthly / monthlyYieldDecimal).toFixed(2));

  let balance = 0;
  let monthsToGoal: number | null = null;
  for (let m = 1; m <= 600; m++) {
    balance = balance * (1 + monthlyYieldDecimal) + 1500;
    if (monthsToGoal === null && balance >= requiredPatrimony) {
      monthsToGoal = m;
      break;
    }
  }

  return {
    requiredPatrimony,
    yearsToGoal: monthsToGoal !== null ? Number((monthsToGoal / 12).toFixed(1)) : null,
  };
}

function computeCompoundGoal(monthlyContribution: number, inflationAnnualPct: number) {
  const monthly = Math.max(0, monthlyContribution);
  const r = annualToMonthlyDecimal(12.0);
  const totalMonths = 15 * 12;
  let balance = 5000;
  let invested = 5000;
  for (let m = 1; m <= totalMonths; m++) {
    balance = balance * (1 + r) + monthly;
    invested += monthly;
  }

  const finalAmount = Number(balance.toFixed(2));
  const totalInvested = Number(invested.toFixed(2));
  const totalInterest = Number((finalAmount - totalInvested).toFixed(2));
  const interestSharePct = finalAmount > 0 ? Number(((totalInterest / finalAmount) * 100).toFixed(1)) : 0;
  const realFinalAmount = Number(
    (finalAmount / Math.pow(1 + annualToMonthlyDecimal(inflationAnnualPct), totalMonths)).toFixed(2)
  );

  let monthsToFirstMillion: number | null = null;
  let simBalance = 5000;
  for (let m = 1; m <= 1200; m++) {
    simBalance = simBalance * (1 + r) + monthly;
    if (simBalance >= 1_000_000) {
      monthsToFirstMillion = m;
      break;
    }
  }

  return {
    finalAmount,
    totalInvested,
    totalInterest,
    interestSharePct,
    realFinalAmount,
    monthsToFirstMillion,
    yearsToFirstMillion: monthsToFirstMillion !== null ? Number((monthsToFirstMillion / 12).toFixed(1)) : null,
  };
}

function buildDeterministicAnswer(
  question: string,
  indicators: ServerIndicators
): { answer: string; recommendedCalculators: ServerRecommendedCalculator[] } {
  const q = question.toLowerCase();
  const { selic, cdi, ipca12m } = indicators;
  const amount = extractAmountFromQuery(question, 10000);

  const isRendaFixaQuestion =
    /cdb|lci|lca|renda fixa|poupança|tesouro selic|prefixado|p[óo]s[- ]fixado|% do cdi|% cdi/.test(q);
  const isYieldQuestion =
    /quanto rende|rendimento de|renderia/.test(q) && !/dividendo|fii|fundo imobili|a[cç][ãa]o|reserva|emerg[êe]ncia/.test(q);

  // Cenário 1: Renda Fixa
  if (isRendaFixaQuestion || isYieldQuestion) {
    const cdbPctCdi = extractCdbPctCdiFromQuery(question) ?? 105;
    const lciPctCdi = extractLciPctCdiFromQuery(question) ?? 92;
    const months = extractMonthsFromQuery(question, 12);
    const rf = computeFixedIncomeComparison({
      amount,
      months,
      cdiAnnualPct: cdi,
      selicAnnualPct: selic,
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
      recommendedCalculators: [
        {
          title: 'Simulador Renda Fixa (CDB vs LCI)',
          slug: 'renda-fixa',
          params: `?valor=${amount}&prazo=${months}&cdb=${cdbPctCdi}&lci=${lciPctCdi}`,
        },
      ],
    };
  }

  // Cenário 2: Renda Passiva / Dividendos
  if (q.includes('dividendo') || q.includes('viver de renda') || q.includes('3.000') || q.includes('renda passiva') || q.includes('fii')) {
    const monthlyTarget = extractAmountFromQuery(question, 3000);
    const div = computeDividendsGoal(monthlyTarget);

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
    const monthlyCost = Math.max(100, cost);
    const targetClt = Number((monthlyCost * 6).toFixed(2));
    const targetAutonomo = Number((monthlyCost * 12).toFixed(2));

    const answer = `**Diagnóstico Direto:**
A Reserva de Emergência **não foi feita para dar lucro, mas sim para dar paz**. Seu valor exato depende do seu regime profissional e custo de vida essencial (moradia, alimentação, saúde, contas básicas):
- **Se você for CLT:** A recomendação oficial é de **6 meses** do seu custo essencial = **${formatBRL(targetClt)}**.
- **Se você for Autônomo, PJ ou Profissional Liberal:** A recomendação é de **12 meses** = **${formatBRL(targetAutonomo)}**, por causa da volatilidade na receita mensal.

**Onde Deixar esse Dinheiro Guardado em 2026:**
1. **Tesouro Selic (Tesouro Direto):** O investimento mais seguro do Brasil, com rentabilidade atrelada à Selic (${formatPct(selic)} a.a.) e liquidez D+1.
2. **CDB de Liquidez Diária (100% a 102% do CDI):** De bancos sólidos, resgatável a qualquer momento com garantia do FGC até R$ 250 mil.
3. **Jamais coloque na Poupança:** A poupança rende ~6,17% a.a. + TR e só credita juros na data de aniversário mensal. Se resgatar no 29º dia, você perde 100% do rendimento do mês.

**Ponto de Atenção Prático:**
A reserva deve ficar **100% separada** da conta corrente do dia a dia para evitar gastos por impulso, e nunca em ativos com carência ou risco de mercado (como FIIs, ações ou CDBs sem liquidez diária).`;

    return {
      answer,
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
    const jc = computeCompoundGoal(monthly, ipca12m);

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

  // Cenário Genérico / Padrão
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
    const body = (await readJsonBody(request)) as {
      question?: string;
      conversationConsent?: boolean;
      history?: ChatHistoryItem[];
      indicators?: unknown;
    };
    const question = (body.question || '').trim().slice(0, 500);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    if (!question) {
      json(response, 400, { error: 'Digite uma dúvida sobre investimentos.' });
      return;
    }

    // Defesa em profundidade: perguntas numéricas são respondidas com matemática
    // auditada antes de qualquer provedor — inclusive para chamadas diretas à API
    // (bots) que não passam pelo roteador determinístico do navegador.
    if (isDeterministicScenario(question)) {
      const deterministic = buildDeterministicAnswer(question, normalizeIndicators(body.indicators));

      if (body.conversationConsent === true) {
        try {
          await saveConversation(question, deterministic.answer, 'abc-expert-engine');
        } catch (error) {
          console.error('[ABC IA] Falha ao registrar conversa:', error);
        }
      }

      const firstCalculator = deterministic.recommendedCalculators[0];
      json(response, 200, {
        answer: deterministic.answer,
        mode: 'abc-expert-engine',
        remainingFree: 3,
        recommendedCalculators: deterministic.recommendedCalculators,
        suggestedTool: firstCalculator
          ? {
              label: firstCalculator.title,
              url: `/calculadoras/${firstCalculator.slug}${firstCalculator.params ?? ''}`,
            }
          : undefined,
      });
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
    json(response, 500, { error: 'Não foi possível processar sua pergunta no momento.' });
  }
}
