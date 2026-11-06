export interface QuantoRendeProduct {
  slug: string;
  name: string;
  type: 'poupanca' | 'cdb' | 'lci' | 'lca' | 'tesouro-selic' | 'tesouro-ipca' | 'tesouro-prefixado';
  rateType: 'fixed' | 'cdi' | 'ipca';
  rate?: number; // For fixed rate products (annual %)
  ratePercent?: number; // For CDI/IPCA products (percentage of index)
  hasIR: boolean;
  hasFGC: boolean;
  liquidity: 'daily' | 'fixed';
  minAmount?: number;
  description: string;
  contextualText: string;
}

export interface QuantoRendeAmount {
  value: number;
  slug: string;
  displayText: string;
}

export const PRODUCTS: QuantoRendeProduct[] = [
  {
    slug: 'poupanca',
    name: 'Poupança',
    type: 'poupanca',
    rateType: 'fixed',
    rate: 6.17, // 0.5% month + TR ≈ 6.17% year (2026 estimate)
    hasIR: false,
    hasFGC: true,
    liquidity: 'daily',
    description: 'Caderneta de Poupança',
    contextualText: 'A poupança rende 0,5% ao mês + TR quando a Selic está acima de 8,5% ao ano. Embora seja popular, perde para a maioria dos investimentos de renda fixa em rentabilidade líquida.',
  },
  {
    slug: 'cdb-100-cdi',
    name: 'CDB 100% do CDI',
    type: 'cdb',
    rateType: 'cdi',
    ratePercent: 100,
    hasIR: true,
    hasFGC: true,
    liquidity: 'daily',
    description: 'CDB de liquidez diária',
    contextualText: 'CDBs a 100% do CDI são a porta de entrada para investimentos que superam a poupança. Com liquidez diária e proteção do FGC até R$ 250 mil, são ideais para reserva de emergência.',
  },
  {
    slug: 'cdb-110-cdi',
    name: 'CDB 110% do CDI',
    type: 'cdb',
    rateType: 'cdi',
    ratePercent: 110,
    hasIR: true,
    hasFGC: true,
    liquidity: 'daily',
    description: 'CDB promocional',
    contextualText: 'CDBs acima de 100% do CDI são ofertas promocionais de bancos médios buscando captar recursos. Oferecem rentabilidade superior mantendo a segurança do FGC.',
  },
  {
    slug: 'lci-90-cdi',
    name: 'LCI 90% do CDI',
    type: 'lci',
    rateType: 'cdi',
    ratePercent: 90,
    hasIR: false,
    hasFGC: true,
    liquidity: 'fixed',
    description: 'Letra de Crédito Imobiliário',
    contextualText: 'LCIs são isentas de Imposto de Renda para pessoa física, o que torna uma LCI a 90% do CDI equivalente a um CDB de aproximadamente 110% do CDI após descontar o IR.',
  },
  {
    slug: 'tesouro-selic',
    name: 'Tesouro Selic',
    type: 'tesouro-selic',
    rateType: 'cdi',
    ratePercent: 100,
    hasIR: true,
    hasFGC: false,
    liquidity: 'daily',
    description: 'Título público federal',
    contextualText: 'O Tesouro Selic é considerado o investimento de menor risco do país (risco soberano). Acompanha a taxa Selic e é a opção mais segura para reserva de emergência.',
  },
  {
    slug: 'tesouro-ipca-6',
    name: 'Tesouro IPCA+ 6%',
    type: 'tesouro-ipca',
    rateType: 'ipca',
    ratePercent: 6,
    hasIR: true,
    hasFGC: false,
    liquidity: 'fixed',
    description: 'Título protegido contra inflação',
    contextualText: 'O Tesouro IPCA+ garante ganho real acima da inflação. Se mantido até o vencimento, você recebe exatamente a taxa contratada (IPCA + 6% ao ano), protegendo seu poder de compra.',
  },
];

export const AMOUNTS: QuantoRendeAmount[] = [
  { value: 500, slug: '500-reais', displayText: 'R$ 500' },
  { value: 1000, slug: '1000-reais', displayText: 'R$ 1.000' },
  { value: 2000, slug: '2000-reais', displayText: 'R$ 2.000' },
  { value: 5000, slug: '5000-reais', displayText: 'R$ 5.000' },
  { value: 10000, slug: '10000-reais', displayText: 'R$ 10.000' },
  { value: 20000, slug: '20000-reais', displayText: 'R$ 20.000' },
  { value: 50000, slug: '50000-reais', displayText: 'R$ 50.000' },
  { value: 100000, slug: '100000-reais', displayText: 'R$ 100.000' },
];

export interface PeriodCalculation {
  months: number;
  label: string;
  grossReturn: number;
  netReturn: number;
  finalAmount: number;
  irRate?: number;
}

export function calculateReturns(
  principal: number,
  product: QuantoRendeProduct,
  selicAnnual: number,
  ipcaAnnual: number,
  periodMonths: number
): PeriodCalculation {
  const cdiAnnual = selicAnnual - 0.10; // CDI is typically 0.10pp below Selic
  
  let annualRate: number;
  
  if (product.rateType === 'fixed' && product.rate) {
    annualRate = product.rate / 100;
  } else if (product.rateType === 'cdi' && product.ratePercent) {
    annualRate = (cdiAnnual * product.ratePercent) / 100;
  } else if (product.rateType === 'ipca' && product.ratePercent) {
    annualRate = ((ipcaAnnual + product.ratePercent)) / 100;
  } else {
    annualRate = 0;
  }

  // Convert annual rate to monthly
  const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
  
  // Calculate gross return
  const grossReturn = principal * (Math.pow(1 + monthlyRate, periodMonths) - 1);
  
  // Calculate IR rate based on period
  let irRate = 0;
  if (product.hasIR) {
    if (periodMonths <= 6) irRate = 0.225;
    else if (periodMonths <= 12) irRate = 0.20;
    else if (periodMonths <= 24) irRate = 0.175;
    else irRate = 0.15;
  }
  
  // Calculate net return
  const netReturn = grossReturn * (1 - irRate);
  const finalAmount = principal + netReturn;
  
  return {
    months: periodMonths,
    label: periodMonths === 1 ? '1 mês' : `${periodMonths} meses`,
    grossReturn,
    netReturn,
    finalAmount,
    irRate: irRate > 0 ? irRate : undefined,
  };
}
