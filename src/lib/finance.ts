/**
 * Motor Matemático e Financeiro — ABC Investimentos (abcinvestimentos.com.br)
 * Regras fiscais brasileiras atualizadas para 2026:
 * - Tabela regressiva de IR de Renda Fixa mantida (22,5% até 180d; 20% até 360d; 17,5% até 720d; 15% acima de 720d)
 * - Isenção de IR para Pessoa Física em LCI, LCA, CRI, CRA e Debêntures Incentivadas
 * - Rendimento da Poupança conforme Lei 12.703/2012 (Selic > 8,5% a.a. => 0,5% a.m. + TR; Selic <= 8,5% a.a. => 70% da Selic + TR)
 * - Dividendos e FIIs: FIIs permanecem isentos para PF; Dividendos societários contam com alerta educativo da Lei 15.270/2025 (retenção de 10% acima de R$ 50 mil/mês por empresa pagadora).
 */

export interface YearlyProjectionRow {
  year: number;
  months: number;
  totalInvested: number;
  totalInterest: number;
  totalAccumulated: number;
  realAccumulated?: number;
}

export interface CompoundInterestInput {
  initialAmount: number;
  monthlyContribution: number;
  annualRatePct: number;
  years: number;
  inflationAnnualPct?: number;
}

export interface CompoundInterestResult {
  finalAmount: number;
  totalInvested: number;
  totalInterest: number;
  interestSharePct: number;
  monthlyRatePct: number;
  realFinalAmount: number;
  monthsToFirstMillion: number | null;
  yearsToFirstMillion: number | null;
  monthlyNeededForMillionInPeriod: number;
  yearlyBreakdown: YearlyProjectionRow[];
}

export interface FixedIncomeInput {
  amount: number;
  monthlyContribution?: number;
  months: number;
  cdiAnnualPct: number;
  selicAnnualPct: number;
  ipcaAnnualPct: number;
  cdbPctCdi: number;
  lciLcaPctCdi: number;
  trAnnualPct?: number;
}

export interface FixedIncomeOptionResult {
  id: 'poupanca' | 'tesouro_selic' | 'cdb' | 'lci_lca';
  name: string;
  grossAnnualRatePct: number;
  netAnnualRatePct: number;
  grossFinalAmount: number;
  irRatePct: number;
  irAmount: number;
  b3FeeAmount: number;
  netFinalAmount: number;
  netProfit: number;
  realNetReturnPct: number;
  totalInvested: number;
  isWinner?: boolean;
}

export interface FixedIncomeComparisonResult {
  days: number;
  irBracketPct: number;
  totalInvested: number;
  equivalentCdbPctForLci: number;
  equivalentLciPctForCdb: number;
  options: FixedIncomeOptionResult[];
  winner: FixedIncomeOptionResult;
  differenceWinnerVsPoupanca: number;
}

export interface DividendsInput {
  desiredMonthlyIncome: number;
  dividendYieldAnnualPct: number;
  currentPatrimony: number;
  monthlyContribution: number;
  reinvestDividends: boolean;
}

export interface DividendsResult {
  requiredPatrimony: number;
  monthlyYieldPct: number;
  currentMonthlyIncome: number;
  monthsToGoal: number | null;
  yearsToGoal: number | null;
  exceeds50kLaw15270Threshold: boolean;
  netDesiredAfterLaw15270Notice: string;
  yearlySnowball: {
    year: number;
    patrimony: number;
    monthlyPassiveIncome: number;
    totalInvestedOutOfPocket: number;
  }[];
}

export type EmploymentProfile = 'clt' | 'autonomo' | 'servidor' | 'empresario';

export interface EmergencyFundInput {
  monthlyEssentialCost: number;
  profile: EmploymentProfile;
  monthlySavingsCapacity: number;
  currentReserve: number;
  cdiAnnualPct: number;
}

export interface EmergencyFundResult {
  recommendedMonths: number;
  recommendedTarget: number;
  gapToTarget: number;
  currentProgressPct: number;
  monthsToComplete: number;
  monthlyNetYieldWhenComplete: number;
  profileExplanation: string;
}

export interface RentVsFinanceInput {
  propertyValue: number;
  downPayment: number;
  financingYears: number;
  financingAnnualRatePct: number;
  monthlyRent: number;
  rentInflationAnnualPct: number;
  investmentNetAnnualRatePct: number;
  propertyAppreciationAnnualPct: number;
}

export interface RentVsFinanceResult {
  loanAmount: number;
  firstInstallmentSac: number;
  lastInstallmentSac: number;
  averageInstallmentSac: number;
  totalPaidFinancing: number;
  totalInterestPaidFinancing: number;
  finalPropertyValue: number;
  renterFinalInvestmentPortfolio: number;
  totalRentPaid: number;
  netWealthBuyer: number;
  netWealthRenter: number;
  advantageSide: 'alugar_investir' | 'financiar' | 'empate';
  wealthDifference: number;
}

export interface ValuationFiiInput {
  // Bazin
  stockPrice: number;
  annualDividendPerShare: number;
  desiredYieldBazinPct?: number;
  // Graham
  lpa: number;
  vpa: number;
  // FII Magic Number
  fiiQuotaPrice: number;
  fiiMonthlyDividend: number;
  currentQuotas?: number;
}

export interface ValuationFiiResult {
  bazinCeilingPrice: number;
  bazinMarginPct: number;
  bazinCurrentDyPct: number;
  grahamIntrinsicValue: number;
  grahamMarginPct: number;
  fiiMagicNumberQuotas: number;
  fiiCapitalForMagicNumber: number;
  fiiMonthlyYieldPct: number;
  fiiAnnualizedYieldPct: number;
  fiiCurrentMonthlyIncome: number;
}

/**
 * Converte taxa anual percentual (ex: 12%) em taxa mensal equivalente decimal (ex: 0.009488...)
 */
export function annualToMonthlyDecimal(annualPct: number): number {
  if (annualPct <= -100) return 0;
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/**
 * Converte taxa mensal decimal em taxa anual percentual (ex: 12.68%)
 */
export function monthlyDecimalToAnnualPct(monthlyDecimal: number): number {
  return (Math.pow(1 + monthlyDecimal, 12) - 1) * 100;
}

/**
 * Retorna a alíquota da Tabela Regressiva de IR da Renda Fixa no Brasil
 */
export function getRegressiveIrRatePct(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20.0;
  if (days <= 720) return 17.5;
  return 15.0;
}

/**
 * Calcula a taxa anual da Poupança conforme a Lei nº 12.703/2012
 * - Selic > 8,5% a.a.: 0,5% ao mês (6,1678% a.a.) + TR
 * - Selic <= 8,5% a.a.: 70% da Selic + TR
 */
export function getPoupancaAnnualRatePct(selicAnnualPct: number, trAnnualPct = 0.95): number {
  if (selicAnnualPct > 8.5) {
    const baseMonthly = 0.005; // 0,5% a.m.
    const trMonthly = annualToMonthlyDecimal(trAnnualPct);
    const combinedMonthly = (1 + baseMonthly) * (1 + trMonthly) - 1;
    return monthlyDecimalToAnnualPct(combinedMonthly);
  }
  const baseAnnual = selicAnnualPct * 0.7;
  const baseMonthly = annualToMonthlyDecimal(baseAnnual);
  const trMonthly = annualToMonthlyDecimal(trAnnualPct);
  const combinedMonthly = (1 + baseMonthly) * (1 + trMonthly) - 1;
  return monthlyDecimalToAnnualPct(combinedMonthly);
}

/**
 * 1. Calculadora de Juros Compostos & Rumo ao 1º Milhão
 */
export function simulateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const initial = Math.max(0, input.initialAmount);
  const monthly = Math.max(0, input.monthlyContribution);
  const years = Math.max(1, Math.min(60, Math.round(input.years)));
  const totalMonths = years * 12;
  const r = annualToMonthlyDecimal(input.annualRatePct);
  const infMonthly = annualToMonthlyDecimal(input.inflationAnnualPct ?? 0);

  let balance = initial;
  let invested = initial;
  const yearlyBreakdown: YearlyProjectionRow[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    balance = balance * (1 + r) + monthly;
    invested += monthly;

    if (m % 12 === 0 || m === totalMonths) {
      const yr = Math.ceil(m / 12);
      const inflationFactor = Math.pow(1 + infMonthly, m);
      yearlyBreakdown.push({
        year: yr,
        months: m,
        totalInvested: Number(invested.toFixed(2)),
        totalInterest: Number((balance - invested).toFixed(2)),
        totalAccumulated: Number(balance.toFixed(2)),
        realAccumulated: Number((balance / inflationFactor).toFixed(2)),
      });
    }
  }

  const finalAmount = Number(balance.toFixed(2));
  const totalInvested = Number(invested.toFixed(2));
  const totalInterest = Number((finalAmount - totalInvested).toFixed(2));
  const interestSharePct = finalAmount > 0 ? Number(((totalInterest / finalAmount) * 100).toFixed(1)) : 0;
  const totalInflationFactor = Math.pow(1 + infMonthly, totalMonths);
  const realFinalAmount = Number((finalAmount / totalInflationFactor).toFixed(2));

  // Cálculo de quantos meses para atingir R$ 1.000.000
  const millionTarget = 1_000_000;
  let monthsToFirstMillion: number | null = null;
  if (initial >= millionTarget) {
    monthsToFirstMillion = 0;
  } else if (monthly > 0 || (initial > 0 && r > 0)) {
    let simBalance = initial;
    for (let m = 1; m <= 1200; m++) {
      simBalance = simBalance * (1 + r) + monthly;
      if (simBalance >= millionTarget) {
        monthsToFirstMillion = m;
        break;
      }
    }
  }

  // Quanto precisaria aportar por mês para chegar a R$ 1 milhão no prazo escolhido
  let monthlyNeededForMillionInPeriod = 0;
  const compoundedInitial = initial * Math.pow(1 + r, totalMonths);
  if (compoundedInitial < millionTarget) {
    const remainingTarget = millionTarget - compoundedInitial;
    if (r > 0) {
      const annuityFactor = (Math.pow(1 + r, totalMonths) - 1) / r;
      monthlyNeededForMillionInPeriod = Number((remainingTarget / annuityFactor).toFixed(2));
    } else {
      monthlyNeededForMillionInPeriod = Number((remainingTarget / totalMonths).toFixed(2));
    }
  }

  return {
    finalAmount,
    totalInvested,
    totalInterest,
    interestSharePct,
    monthlyRatePct: Number((r * 100).toFixed(4)),
    realFinalAmount,
    monthsToFirstMillion,
    yearsToFirstMillion: monthsToFirstMillion !== null ? Number((monthsToFirstMillion / 12).toFixed(1)) : null,
    monthlyNeededForMillionInPeriod,
    yearlyBreakdown,
  };
}

/**
 * 2. Simulador CDI & Comparador de Renda Fixa (Poupança vs. Tesouro Selic vs. CDB vs. LCI/LCA)
 */
export function simulateFixedIncomeComparison(input: FixedIncomeInput): FixedIncomeComparisonResult {
  const initial = Math.max(0, input.amount);
  const monthly = Math.max(0, input.monthlyContribution ?? 0);
  const months = Math.max(1, Math.min(360, Math.round(input.months)));
  // Dias corridos reais (365,25/12 por mês) para a tabela regressiva de IR:
  // 6 meses ≈ 183d → 20%; 12 meses ≈ 365d → 17,5%; 24 meses ≈ 731d → 15%.
  const days = Math.round(months * (365.25 / 12));
  const irBracketPct = getRegressiveIrRatePct(days);
  const irDecimal = irBracketPct / 100;
  const totalInvested = Number((initial + monthly * months).toFixed(2));

  const poupancaAnnualPct = getPoupancaAnnualRatePct(input.selicAnnualPct, input.trAnnualPct ?? 0.95);
  const cdbGrossAnnualPct = (input.cdiAnnualPct * input.cdbPctCdi) / 100;
  const lciGrossAnnualPct = (input.cdiAnnualPct * input.lciLcaPctCdi) / 100;
  const tesouroGrossAnnualPct = input.selicAnnualPct;

  function computeCompoundGross(annualRatePct: number): number {
    const r = annualToMonthlyDecimal(annualRatePct);
    let bal = initial;
    for (let m = 1; m <= months; m++) {
      bal = bal * (1 + r) + monthly;
    }
    return bal;
  }

  const periodInflationFactor = Math.pow(1 + annualToMonthlyDecimal(input.ipcaAnnualPct), months) - 1;

  // 1. Poupança (Isenta de IR)
  const poupancaGrossFinal = computeCompoundGross(poupancaAnnualPct);
  const poupancaNetProfit = poupancaGrossFinal - totalInvested;
  const poupancaNetReturnDecimal = totalInvested > 0 ? poupancaNetProfit / totalInvested : 0;
  const poupancaRealReturnPct = ((1 + poupancaNetReturnDecimal) / (1 + periodInflationFactor) - 1) * 100;

  // 2. Tesouro Selic (IR regressivo + Taxa B3 de 0,20% a.a. apenas sobre o que exceder R$ 10.000)
  const tesouroGrossFinal = computeCompoundGross(tesouroGrossAnnualPct);
  const avgBalanceTesouro = (initial + tesouroGrossFinal) / 2;
  const taxableB3Base = Math.max(0, avgBalanceTesouro - 10_000);
  const b3FeeAmount = taxableB3Base * 0.002 * (months / 12);
  const tesouroGrossProfitAfterFee = Math.max(0, tesouroGrossFinal - totalInvested - b3FeeAmount);
  const tesouroIrAmount = tesouroGrossProfitAfterFee * irDecimal;
  const tesouroNetFinal = totalInvested + tesouroGrossProfitAfterFee - tesouroIrAmount;
  const tesouroNetProfit = tesouroNetFinal - totalInvested;
  const tesouroNetReturnDecimal = totalInvested > 0 ? tesouroNetProfit / totalInvested : 0;
  const tesouroRealReturnPct = ((1 + tesouroNetReturnDecimal) / (1 + periodInflationFactor) - 1) * 100;
  const tesouroNetAnnualPct = tesouroGrossAnnualPct * (1 - irDecimal);

  // 3. CDB (% do CDI, IR regressivo, zero taxa de custódia)
  const cdbGrossFinal = computeCompoundGross(cdbGrossAnnualPct);
  const cdbGrossProfit = Math.max(0, cdbGrossFinal - totalInvested);
  const cdbIrAmount = cdbGrossProfit * irDecimal;
  const cdbNetFinal = cdbGrossFinal - cdbIrAmount;
  const cdbNetProfit = cdbNetFinal - totalInvested;
  const cdbNetReturnDecimal = totalInvested > 0 ? cdbNetProfit / totalInvested : 0;
  const cdbRealReturnPct = ((1 + cdbNetReturnDecimal) / (1 + periodInflationFactor) - 1) * 100;
  const cdbNetAnnualPct = cdbGrossAnnualPct * (1 - irDecimal);

  // 4. LCI / LCA (% do CDI, Isenta de IR para Pessoa Física)
  const lciGrossFinal = computeCompoundGross(lciGrossAnnualPct);
  const lciNetProfit = Math.max(0, lciGrossFinal - totalInvested);
  const lciNetReturnDecimal = totalInvested > 0 ? lciNetProfit / totalInvested : 0;
  const lciRealReturnPct = ((1 + lciNetReturnDecimal) / (1 + periodInflationFactor) - 1) * 100;

  const options: FixedIncomeOptionResult[] = [
    {
      id: 'poupanca',
      name: 'Poupança (Isenta)',
      grossAnnualRatePct: Number(poupancaAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(poupancaAnnualPct.toFixed(2)),
      grossFinalAmount: Number(poupancaGrossFinal.toFixed(2)),
      irRatePct: 0,
      irAmount: 0,
      b3FeeAmount: 0,
      netFinalAmount: Number(poupancaGrossFinal.toFixed(2)),
      netProfit: Number(poupancaNetProfit.toFixed(2)),
      realNetReturnPct: Number(poupancaRealReturnPct.toFixed(2)),
      totalInvested,
    },
    {
      id: 'tesouro_selic',
      name: 'Tesouro Selic',
      grossAnnualRatePct: Number(tesouroGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(tesouroNetAnnualPct.toFixed(2)),
      grossFinalAmount: Number(tesouroGrossFinal.toFixed(2)),
      irRatePct: irBracketPct,
      irAmount: Number(tesouroIrAmount.toFixed(2)),
      b3FeeAmount: Number(b3FeeAmount.toFixed(2)),
      netFinalAmount: Number(tesouroNetFinal.toFixed(2)),
      netProfit: Number(tesouroNetProfit.toFixed(2)),
      realNetReturnPct: Number(tesouroRealReturnPct.toFixed(2)),
      totalInvested,
    },
    {
      id: 'cdb',
      name: `CDB (${input.cdbPctCdi}% do CDI)`,
      grossAnnualRatePct: Number(cdbGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(cdbNetAnnualPct.toFixed(2)),
      grossFinalAmount: Number(cdbGrossFinal.toFixed(2)),
      irRatePct: irBracketPct,
      irAmount: Number(cdbIrAmount.toFixed(2)),
      b3FeeAmount: 0,
      netFinalAmount: Number(cdbNetFinal.toFixed(2)),
      netProfit: Number(cdbNetProfit.toFixed(2)),
      realNetReturnPct: Number(cdbRealReturnPct.toFixed(2)),
      totalInvested,
    },
    {
      id: 'lci_lca',
      name: `LCI / LCA (${input.lciLcaPctCdi}% do CDI Isenta)`,
      grossAnnualRatePct: Number(lciGrossAnnualPct.toFixed(2)),
      netAnnualRatePct: Number(lciGrossAnnualPct.toFixed(2)),
      grossFinalAmount: Number(lciGrossFinal.toFixed(2)),
      irRatePct: 0,
      irAmount: 0,
      b3FeeAmount: 0,
      netFinalAmount: Number(lciGrossFinal.toFixed(2)),
      netProfit: Number(lciNetProfit.toFixed(2)),
      realNetReturnPct: Number(lciRealReturnPct.toFixed(2)),
      totalInvested,
    },
  ];

  // Identifica o vencedor líquido
  let winner = options[0];
  for (const opt of options) {
    if (opt.netFinalAmount > winner.netFinalAmount) {
      winner = opt;
    }
  }
  options.forEach((opt) => {
    opt.isWinner = opt.id === winner.id;
  });

  // Equivalência de taxas entre CDB e LCI/LCA para o prazo selecionado
  const equivalentCdbPctForLci = Number((input.lciLcaPctCdi / (1 - irDecimal)).toFixed(1));
  const equivalentLciPctForCdb = Number((input.cdbPctCdi * (1 - irDecimal)).toFixed(1));

  return {
    days,
    irBracketPct,
    totalInvested,
    equivalentCdbPctForLci,
    equivalentLciPctForCdb,
    options,
    winner,
    differenceWinnerVsPoupanca: Number((winner.netFinalAmount - options[0].netFinalAmount).toFixed(2)),
  };
}

/**
 * 3. Calculadora de Dividendos & Independência Financeira ("Viver de Renda")
 */
export function simulateDividendsAndPassiveIncome(input: DividendsInput): DividendsResult {
  const desiredMonthly = Math.max(100, input.desiredMonthlyIncome);
  const dyAnnual = Math.max(0.5, input.dividendYieldAnnualPct);
  const monthlyYieldDecimal = annualToMonthlyDecimal(dyAnnual);

  const requiredPatrimony = Number((desiredMonthly / monthlyYieldDecimal).toFixed(2));
  const currentMonthlyIncome = Number((Math.max(0, input.currentPatrimony) * monthlyYieldDecimal).toFixed(2));

  let bal = Math.max(0, input.currentPatrimony);
  let outOfPocket = bal;
  let monthsToGoal: number | null = bal >= requiredPatrimony ? 0 : null;
  const yearlySnowball: DividendsResult['yearlySnowball'] = [];

  for (let m = 1; m <= 600; m++) {
    const monthlyDividend = bal * monthlyYieldDecimal;
    if (input.reinvestDividends) {
      bal += monthlyDividend + Math.max(0, input.monthlyContribution);
    } else {
      bal += Math.max(0, input.monthlyContribution);
    }
    outOfPocket += Math.max(0, input.monthlyContribution);

    if (monthsToGoal === null && bal >= requiredPatrimony) {
      monthsToGoal = m;
    }

    if (m <= 360 && m % 12 === 0) {
      yearlySnowball.push({
        year: m / 12,
        patrimony: Number(bal.toFixed(2)),
        monthlyPassiveIncome: Number((bal * monthlyYieldDecimal).toFixed(2)),
        totalInvestedOutOfPocket: Number(outOfPocket.toFixed(2)),
      });
    }
  }

  const exceeds50kLaw15270Threshold = desiredMonthly > 50_000;
  const netDesiredAfterLaw15270Notice = exceeds50kLaw15270Threshold
    ? 'Atenção à Lei nº 15.270/2025: a partir de 2026, dividendos pagos por uma mesma empresa (PJ) acima de R$ 50.000/mês sofrem retenção de 10% na fonte. Diversificar entre múltiplas empresas e FIIs (cujos rendimentos seguem isentos para PF) evita esse degrau tributário.'
    : 'Rendimentos de FIIs (com 100+ cotistas em bolsa) e dividendos de ações abaixo de R$ 50.000/mês por empresa pagadora permanecem isentos de retenção na fonte para Pessoa Física (Lei 15.270/2025).';

  return {
    requiredPatrimony,
    monthlyYieldPct: Number((monthlyYieldDecimal * 100).toFixed(3)),
    currentMonthlyIncome,
    monthsToGoal,
    yearsToGoal: monthsToGoal !== null ? Number((monthsToGoal / 12).toFixed(1)) : null,
    exceeds50kLaw15270Threshold,
    netDesiredAfterLaw15270Notice,
    yearlySnowball,
  };
}

/**
 * 4. Calculadora de Reserva de Emergência
 */
export function simulateEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const cost = Math.max(100, input.monthlyEssentialCost);
  const current = Math.max(0, input.currentReserve);
  const monthlySave = Math.max(0, input.monthlySavingsCapacity);

  const profileMap: Record<EmploymentProfile, { months: number; explanation: string }> = {
    servidor: {
      months: 3,
      explanation: 'Servidor Público (Estabilidade): 3 meses dos seus custos essenciais cobrem imprevistos médicos ou familiares com folga.',
    },
    clt: {
      months: 6,
      explanation: 'Profissional CLT: 6 meses de custos essenciais garantem tranquilidade mesmo em caso de transição de carreira, somando-se ao FGTS.',
    },
    autonomo: {
      months: 12,
      explanation: 'Autônomo / MEI / PJ: como a renda mensal oscila e não há FGTS/Seguro-Desemprego, 12 meses de reserva blindam sua paz financeira.',
    },
    empresario: {
      months: 12,
      explanation: 'Empresário / Empreendedor: 12 meses de custo pessoal separam com segurança o caixa da sua família das oscilações do negócio.',
    },
  };

  const { months: recommendedMonths, explanation: profileExplanation } = profileMap[input.profile] ?? profileMap.clt;
  const recommendedTarget = Number((cost * recommendedMonths).toFixed(2));
  const gapToTarget = Number(Math.max(0, recommendedTarget - current).toFixed(2));
  const currentProgressPct = Number(Math.min(100, (current / recommendedTarget) * 100).toFixed(1));

  // Considera rendimento líquido de 100% do CDI (descontando alíquota média de 20% de IR)
  const netAnnualCdi = input.cdiAnnualPct * 0.8;
  const monthlyNetDecimal = annualToMonthlyDecimal(netAnnualCdi);

  let monthsToComplete = 0;
  if (gapToTarget > 0) {
    if (monthlySave <= 0 && current <= 0) {
      monthsToComplete = 999;
    } else {
      let sim = current;
      for (let m = 1; m <= 600; m++) {
        sim = sim * (1 + monthlyNetDecimal) + monthlySave;
        if (sim >= recommendedTarget) {
          monthsToComplete = m;
          break;
        }
      }
      if (monthsToComplete === 0) monthsToComplete = 600;
    }
  }

  const monthlyNetYieldWhenComplete = Number((recommendedTarget * monthlyNetDecimal).toFixed(2));

  return {
    recommendedMonths,
    recommendedTarget,
    gapToTarget,
    currentProgressPct,
    monthsToComplete,
    monthlyNetYieldWhenComplete,
    profileExplanation,
  };
}

/**
 * 5. Simulador Alugar vs. Financiar Imóvel (Tabela SAC vs. Aluguel + Investimento da Diferença)
 */
export function simulateRentVsFinance(input: RentVsFinanceInput): RentVsFinanceResult {
  const propVal = Math.max(50_000, input.propertyValue);
  const down = Math.min(propVal * 0.9, Math.max(0, input.downPayment));
  const loanAmount = Number((propVal - down).toFixed(2));
  const years = Math.max(1, Math.min(35, Math.round(input.financingYears)));
  const totalMonths = years * 12;

  const rLoan = annualToMonthlyDecimal(input.financingAnnualRatePct);
  const rInvest = annualToMonthlyDecimal(input.investmentNetAnnualRatePct);
  const rRentInf = annualToMonthlyDecimal(input.rentInflationAnnualPct);
  const rPropApp = annualToMonthlyDecimal(input.propertyAppreciationAnnualPct);

  const monthlyAmortization = loanAmount / totalMonths;
  let outstandingDebt = loanAmount;
  let totalPaidFinancing = down;
  let totalInterestPaidFinancing = 0;
  let firstInstallmentSac = 0;
  let lastInstallmentSac = 0;

  // Quem aluga começa investindo o valor da entrada (downPayment)
  let renterPortfolio = down;
  let currentRent = Math.max(0, input.monthlyRent);
  let totalRentPaid = 0;

  for (let m = 1; m <= totalMonths; m++) {
    const interestMonth = outstandingDebt * rLoan;
    const sacInstallment = monthlyAmortization + interestMonth;
    if (m === 1) firstInstallmentSac = sacInstallment;
    if (m === totalMonths) lastInstallmentSac = sacInstallment;

    outstandingDebt = Math.max(0, outstandingDebt - monthlyAmortization);
    totalPaidFinancing += sacInstallment;
    totalInterestPaidFinancing += interestMonth;

    // Atualiza carteira do locatário: rende rInvest + aporta a diferença entre a parcela SAC e o aluguel
    const monthlyDifference = sacInstallment - currentRent;
    renterPortfolio = renterPortfolio * (1 + rInvest) + monthlyDifference;
    totalRentPaid += currentRent;

    // Reajusta o aluguel anualmente (a cada 12 meses)
    if (m % 12 === 0) {
      currentRent = currentRent * Math.pow(1 + rRentInf, 12);
    }
  }

  const finalPropertyValue = Number((propVal * Math.pow(1 + rPropApp, totalMonths)).toFixed(2));
  const renterFinalInvestmentPortfolio = Number(Math.max(0, renterPortfolio).toFixed(2));
  const netWealthBuyer = finalPropertyValue;
  const netWealthRenter = renterFinalInvestmentPortfolio;
  const wealthDifference = Number(Math.abs(netWealthRenter - netWealthBuyer).toFixed(2));

  let advantageSide: RentVsFinanceResult['advantageSide'] = 'empate';
  if (netWealthRenter > netWealthBuyer * 1.01) {
    advantageSide = 'alugar_investir';
  } else if (netWealthBuyer > netWealthRenter * 1.01) {
    advantageSide = 'financiar';
  }

  return {
    loanAmount,
    firstInstallmentSac: Number(firstInstallmentSac.toFixed(2)),
    lastInstallmentSac: Number(lastInstallmentSac.toFixed(2)),
    averageInstallmentSac: Number(((firstInstallmentSac + lastInstallmentSac) / 2).toFixed(2)),
    totalPaidFinancing: Number(totalPaidFinancing.toFixed(2)),
    totalInterestPaidFinancing: Number(totalInterestPaidFinancing.toFixed(2)),
    finalPropertyValue,
    renterFinalInvestmentPortfolio,
    totalRentPaid: Number(totalRentPaid.toFixed(2)),
    netWealthBuyer,
    netWealthRenter,
    advantageSide,
    wealthDifference,
  };
}

/**
 * 6. Calculadora de Preço-Teto (Décio Bazin & Benjamin Graham) + Número Mágico de FIIs
 */
export function calculateStockValuationAndFiiMagicNumber(input: ValuationFiiInput): ValuationFiiResult {
  const stockPrice = Math.max(0.01, input.stockPrice);
  const annualDiv = Math.max(0, input.annualDividendPerShare);
  const desiredBazinYieldDecimal = Math.max(1, input.desiredYieldBazinPct ?? 6) / 100;

  // Bazin: Preço-Teto = Dividendo Anual / 0.06
  const bazinCeilingPrice = Number((annualDiv / desiredBazinYieldDecimal).toFixed(2));
  const bazinMarginPct = Number((((bazinCeilingPrice - stockPrice) / stockPrice) * 100).toFixed(1));
  const bazinCurrentDyPct = Number(((annualDiv / stockPrice) * 100).toFixed(2));

  // Graham: Valor Intrínseco = sqrt(22.5 * LPA * VPA)
  const productGraham = 22.5 * Math.max(0, input.lpa) * Math.max(0, input.vpa);
  const grahamIntrinsicValue = productGraham > 0 ? Number(Math.sqrt(productGraham).toFixed(2)) : 0;
  const grahamMarginPct =
    grahamIntrinsicValue > 0 ? Number((((grahamIntrinsicValue - stockPrice) / stockPrice) * 100).toFixed(1)) : -100;

  // FII Número Mágico: ceil(Preço da Cota / Rendimento Mensal por Cota)
  const fiiPrice = Math.max(0.01, input.fiiQuotaPrice);
  const fiiDiv = Math.max(0.01, input.fiiMonthlyDividend);
  const fiiMagicNumberQuotas = Math.ceil(fiiPrice / fiiDiv);
  const fiiCapitalForMagicNumber = Number((fiiMagicNumberQuotas * fiiPrice).toFixed(2));
  const fiiMonthlyYieldDecimal = fiiDiv / fiiPrice;
  const fiiMonthlyYieldPct = Number((fiiMonthlyYieldDecimal * 100).toFixed(2));
  const fiiAnnualizedYieldPct = Number((monthlyDecimalToAnnualPct(fiiMonthlyYieldDecimal)).toFixed(2));
  const fiiCurrentMonthlyIncome = Number(((input.currentQuotas ?? 0) * fiiDiv).toFixed(2));

  return {
    bazinCeilingPrice,
    bazinMarginPct,
    bazinCurrentDyPct,
    grahamIntrinsicValue,
    grahamMarginPct,
    fiiMagicNumberQuotas,
    fiiCapitalForMagicNumber,
    fiiMonthlyYieldPct,
    fiiAnnualizedYieldPct,
    fiiCurrentMonthlyIncome,
  };
}

/**
 * Utilitário de formatação monetária BRL (R$)
 */
export function formatBRL(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Utilitário de formatação percentual pt-BR
 */
export function formatPct(value: number, decimals = 2): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}
