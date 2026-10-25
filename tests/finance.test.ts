import { describe, it, expect } from 'vitest';
import {
  annualToMonthlyDecimal,
  monthlyDecimalToAnnualPct,
  getRegressiveIrRatePct,
  getPoupancaAnnualRatePct,
  simulateCompoundInterest,
  simulateFixedIncomeComparison,
  simulateDividendsAndPassiveIncome,
  simulateEmergencyFund,
  simulateRentVsFinance,
  calculateStockValuationAndFiiMagicNumber,
} from '../src/lib/finance';

describe('Motor Financeiro ABC Investimentos (Regras 2026)', () => {
  it('converte taxas anuais e mensais com equivalência composta exata', () => {
    const monthly = annualToMonthlyDecimal(12);
    expect(monthly).toBeCloseTo(0.00948879, 6);
    const backToAnnual = monthlyDecimalToAnnualPct(monthly);
    expect(backToAnnual).toBeCloseTo(12, 5);
  });

  it('aplica a Tabela Regressiva de IR da Renda Fixa nas 4 faixas legais', () => {
    expect(getRegressiveIrRatePct(90)).toBe(22.5);
    expect(getRegressiveIrRatePct(180)).toBe(22.5);
    expect(getRegressiveIrRatePct(181)).toBe(20.0);
    expect(getRegressiveIrRatePct(360)).toBe(20.0);
    expect(getRegressiveIrRatePct(361)).toBe(17.5);
    expect(getRegressiveIrRatePct(720)).toBe(17.5);
    expect(getRegressiveIrRatePct(721)).toBe(15.0);
    expect(getRegressiveIrRatePct(1080)).toBe(15.0);
  });

  it('calcula a Poupança nas duas regras (Selic > 8,5% e Selic <= 8,5%)', () => {
    // Selic alta (14.25% > 8.5%) com TR zerada => 0,5% a.m. = 6,1678% a.a.
    const rateHighSelic = getPoupancaAnnualRatePct(14.25, 0);
    expect(rateHighSelic).toBeCloseTo(6.1678, 3);

    // Selic baixa (7.0% <= 8.5%) com TR zerada => 70% de 7% = 4,90% a.a.
    const rateLowSelic = getPoupancaAnnualRatePct(7.0, 0);
    expect(rateLowSelic).toBeCloseTo(4.9, 3);
  });

  it('simula Juros Compostos com aportes mensais e tempo até o 1º Milhão', () => {
    const res = simulateCompoundInterest({
      initialAmount: 10_000,
      monthlyContribution: 1_500,
      annualRatePct: 12,
      years: 20,
      inflationAnnualPct: 4.5,
    });

    expect(res.totalInvested).toBe(10_000 + 1_500 * 240); // R$ 370.000
    expect(res.finalAmount).toBeGreaterThan(1_000_000);
    expect(res.totalInterest).toBeCloseTo(res.finalAmount - res.totalInvested, 1);
    expect(res.monthsToFirstMillion).not.toBeNull();
    expect(res.monthsToFirstMillion!).toBeLessThanOrEqual(240);
    expect(res.yearlyBreakdown).toHaveLength(20);
  });

  it('compara Renda Fixa (Poupança, Tesouro Selic, CDB e LCI/LCA) com equivalência de IR', () => {
    const res = simulateFixedIncomeComparison({
      amount: 20_000,
      monthlyContribution: 0,
      months: 24, // 720 dias -> alíquota de 17,5%
      cdiAnnualPct: 14.15,
      selicAnnualPct: 14.25,
      ipcaAnnualPct: 4.5,
      cdbPctCdi: 105,
      lciLcaPctCdi: 92,
      trAnnualPct: 0.9,
    });

    expect(res.irBracketPct).toBe(17.5);
    // Para 17,5% de IR, uma LCI de 92% do CDI equivale a 92 / (1 - 0.175) = 111.5% do CDI
    expect(res.equivalentCdbPctForLci).toBeCloseTo(111.5, 1);
    expect(res.winner.id).toBe('lci_lca');
    expect(res.differenceWinnerVsPoupanca).toBeGreaterThan(2_000);
  });

  it('calcula meta de Dividendos e alerta da Lei 15.270/2025 acima de R$ 50 mil/mês', () => {
    const normal = simulateDividendsAndPassiveIncome({
      desiredMonthlyIncome: 5_000,
      dividendYieldAnnualPct: 9.5,
      currentPatrimony: 50_000,
      monthlyContribution: 2_000,
      reinvestDividends: true,
    });

    expect(normal.requiredPatrimony).toBeGreaterThan(600_000);
    expect(normal.exceeds50kLaw15270Threshold).toBe(false);
    expect(normal.monthsToGoal).not.toBeNull();

    const highIncome = simulateDividendsAndPassiveIncome({
      desiredMonthlyIncome: 60_000,
      dividendYieldAnnualPct: 9.5,
      currentPatrimony: 500_000,
      monthlyContribution: 10_000,
      reinvestDividends: true,
    });
    expect(highIncome.exceeds50kLaw15270Threshold).toBe(true);
  });

  it('calcula Reserva de Emergência por perfil profissional (CLT, Autônomo, Servidor)', () => {
    const clt = simulateEmergencyFund({
      monthlyEssentialCost: 4_000,
      profile: 'clt',
      monthlySavingsCapacity: 1_000,
      currentReserve: 4_000,
      cdiAnnualPct: 14.15,
    });
    expect(clt.recommendedMonths).toBe(6);
    expect(clt.recommendedTarget).toBe(24_000);
    expect(clt.gapToTarget).toBe(20_000);

    const autonomo = simulateEmergencyFund({
      monthlyEssentialCost: 4_000,
      profile: 'autonomo',
      monthlySavingsCapacity: 1_000,
      currentReserve: 0,
      cdiAnnualPct: 14.15,
    });
    expect(autonomo.recommendedMonths).toBe(12);
    expect(autonomo.recommendedTarget).toBe(48_000);
  });

  it('simula Alugar vs. Financiar Imóvel pela Tabela SAC', () => {
    const res = simulateRentVsFinance({
      propertyValue: 500_000,
      downPayment: 100_000,
      financingYears: 30,
      financingAnnualRatePct: 11.5,
      monthlyRent: 2_300,
      rentInflationAnnualPct: 4.5,
      investmentNetAnnualRatePct: 11.5,
      propertyAppreciationAnnualPct: 4.5,
    });

    expect(res.loanAmount).toBe(400_000);
    expect(res.firstInstallmentSac).toBeGreaterThan(res.lastInstallmentSac);
    expect(res.totalPaidFinancing).toBeGreaterThan(500_000);
  });

  it('calcula Preço-Teto Bazin, Valor Intrínseco Graham e Número Mágico de FIIs', () => {
    const res = calculateStockValuationAndFiiMagicNumber({
      stockPrice: 30,
      annualDividendPerShare: 2.4, // 2.4 / 0.06 = R$ 40,00
      desiredYieldBazinPct: 6,
      lpa: 4.0,
      vpa: 25.0, // sqrt(22.5 * 4 * 25) = sqrt(2250) = 47.43
      fiiQuotaPrice: 100,
      fiiMonthlyDividend: 1.0, // 100 cotas para gerar R$ 100/mês
      currentQuotas: 35,
    });

    expect(res.bazinCeilingPrice).toBe(40.0);
    expect(res.bazinMarginPct).toBeCloseTo(33.3, 1);
    expect(res.grahamIntrinsicValue).toBeCloseTo(47.43, 2);
    expect(res.fiiMagicNumberQuotas).toBe(100);
    expect(res.fiiCapitalForMagicNumber).toBe(10_000);
    expect(res.fiiCurrentMonthlyIncome).toBe(35);
  });
});
