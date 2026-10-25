export interface CalculatorMeta {
  slug: string;
  id: string;
  title: string;
  shortTitle: string;
  badge: string;
  isTopFour: boolean;
  icon: 'trending-up' | 'percent' | 'coins' | 'shield-check' | 'home' | 'target';
  subtitle: string;
  seoDescription: string;
  nextStepTitle: string;
  nextStepDescription: string;
  nextStepCtaLabel: string;
  nextStepCtaUrl: string;
  recommendedBookId: string;
  faqs: { question: string; answer: string }[];
}

export const CALCULATORS: CalculatorMeta[] = [
  {
    slug: 'juros-compostos',
    id: 'juros-compostos',
    title: 'Calculadora de Juros Compostos e 1º Milhão',
    shortTitle: 'Juros Compostos & 1º Milhão',
    badge: 'Popular',
    isTopFour: true,
    icon: 'trending-up',
    subtitle: 'Veja seu dinheiro se multiplicar mês a mês e descubra quando você chega ao primeiro milhão.',
    seoDescription:
      'Simule gratuitamente o efeito dos juros compostos com aportes mensais, desconto de inflação e cálculo exato de quantos anos faltam para o seu primeiro milhão.',
    nextStepTitle: 'Quer transformar essa simulação em um plano mensal real?',
    nextStepDescription:
      'De nada adianta simular juros compostos se no fim do mês não sobra dinheiro para aportar. A Planilha Oficial ABC organiza seu orçamento na regra 50/30/20 e acompanha sua evolução rumo ao 1º milhão.',
    nextStepCtaLabel: 'Conhecer a Planilha Oficial ABC (R$ 29,90)',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'psicologia-financeira',
    faqs: [
      {
        question: 'Como funciona a fórmula de juros compostos com aportes mensais?',
        answer:
          'A cada mês, o saldo acumulado rende a taxa mensal equivalente — calculada como (1 + taxa anual)^(1/12) - 1 — e recebe o novo aporte mensal. Com o passar dos anos, os juros sobre juros superam o valor que saiu do seu bolso.',
      },
      {
        question: 'Por que devo considerar a inflação (IPCA) ao planejar meu 1º milhão?',
        answer:
          'Porque R$ 1 milhão daqui a 15 ou 20 anos terá um poder de compra menor que hoje. Nosso simulador mostra tanto o Valor Nominal quanto o Valor Real (descontando a inflação projetada).',
      },
    ],
  },
  {
    slug: 'renda-fixa',
    id: 'renda-fixa',
    title: 'Simulador CDI & Comparador de Renda Fixa (CDB vs. LCI/LCA vs. Tesouro)',
    shortTitle: 'Simulador CDI & Renda Fixa',
    badge: 'Comparador',
    isTopFour: true,
    icon: 'percent',
    subtitle: 'Compare quanto seu dinheiro rende líquido (já descontando Imposto de Renda) vs. Poupança.',
    seoDescription:
      'Compare em tempo real CDB, LCI/LCA isenta de IR, Tesouro Selic e Poupança. Calcule automaticamente a tabela regressiva de Imposto de Renda e a taxa equivalente.',
    nextStepTitle: 'Descobriu onde rende mais? Organize seus aportes mensais',
    nextStepDescription:
      'Use a Planilha Oficial ABC para separar automaticamente os 20% do seu salário destinados à Renda Fixa e acompanhar o crescimento líquido do seu patrimônio.',
    nextStepCtaLabel: 'Ver Planilha de Controle & Patrimônio ABC',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'investidor-bom-senso',
    faqs: [
      {
        question: 'LCI e LCA continuam isentas de Imposto de Renda em 2026?',
        answer:
          'Sim! A Medida Provisória 1.303/2025 perdeu a validade sem aprovação, mantendo a isenção integral de IR para Pessoa Física em LCI, LCA, CRI, CRA e debêntures incentivadas, além da tabela regressiva tradicional (22,5% a 15%) para CDBs e Tesouro.',
      },
      {
        question: 'Como saber se uma LCI de 90% do CDI ganha de um CDB de 105% do CDI?',
        answer:
          'Basta dividir a taxa da LCI por (1 - alíquota de IR do prazo). Para prazos acima de 2 anos (IR de 15%), 90% / 0,85 = 105,88% do CDI. Ou seja, a LCI de 90% ganha do CDB de 105%!',
      },
    ],
  },
  {
    slug: 'dividendos',
    id: 'dividendos',
    title: 'Calculadora de Dividendos & Viver de Renda Passiva',
    shortTitle: 'Dividendos & Viver de Renda',
    badge: 'Renda Passiva',
    isTopFour: true,
    icon: 'coins',
    subtitle: 'Descubra quanto patrimônio você precisa para receber a renda mensal dos seus sonhos.',
    seoDescription:
      'Calcule o patrimônio necessário para viver de dividendos de Ações e FIIs, simule o efeito bola de neve reinvestindo proventos e confira as regras da Lei 15.270/2025.',
    nextStepTitle: 'Acelere sua bola de neve poupando mais todos os meses',
    nextStepDescription:
      'Quanto maior o seu aporte mensal, mais rápido você atinge a independência financeira. Veja como estruturar seu orçamento e metas na Planilha Oficial ABC.',
    nextStepCtaLabel: 'Conhecer a Planilha Oficial ABC',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'rei-dos-dividendos',
    faqs: [
      {
        question: 'Os dividendos de FIIs e Ações pagam imposto em 2026?',
        answer:
          'Pela Lei nº 15.270/2025 (em vigor desde jan/2026), os rendimentos de Fundos Imobiliários (FIIs) continuam 100% isentos para Pessoa Física. Já os dividendos de empresas (Ações) só sofrem retenção de 10% na fonte caso passem de R$ 50.000 no mesmo mês pagos por uma única empresa.',
      },
      {
        question: 'Por que reinvestir os dividendos faz tanta diferença no prazo?',
        answer:
          'Quando você reinveste os dividendos recebidos todo mês, você compra novas cotas/ações sem tirar dinheiro extra do bolso, gerando dividendos sobre dividendos (o verdadeiro efeito bola de neve).',
      },
    ],
  },
  {
    slug: 'reserva-emergencia',
    id: 'reserva-emergencia',
    title: 'Calculadora de Reserva de Emergência (CLT, Autônomo/PJ e Servidor)',
    shortTitle: 'Reserva de Emergência',
    badge: 'Essencial',
    isTopFour: true,
    icon: 'shield-check',
    subtitle: 'Calcule em 30 segundos o valor exato da sua segurança financeira (CLT, Autônomo ou PJ).',
    seoDescription:
      'Descubra quantos meses de custo de vida você precisa acumular na sua Reserva de Emergência conforme sua profissão e veja quanto ela rende no Tesouro Selic ou CDB 100% CDI.',
    nextStepTitle: 'Acompanhamento visual da sua Reserva já pronto no Excel/Sheets',
    nextStepDescription:
      'A Planilha Oficial ABC já traz uma aba exclusiva de Reserva de Emergência com barra de progresso automática e separação de gastos essenciais vs. estilo de vida.',
    nextStepCtaLabel: 'Baixar a Planilha Oficial ABC',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'homem-mais-rico-babilonia',
    faqs: [
      {
        question: 'Onde devo guardar minha Reserva de Emergência?',
        answer:
          'Exclusivamente em investimentos com liquidez diária imediata e baixíssimo risco, como o Tesouro Selic ou CDB de grandes bancos sólidos que rendam ao menos 100% do CDI e contem com cobertura do FGC.',
      },
      {
        question: 'Devo calcular a reserva sobre minha renda ou sobre meus custos essenciais?',
        answer:
          'Sobre os seus custos essenciais mensais (moradia, alimentação, saúde, transporte, educação). Se você ganha R$ 6.000 mas vive com R$ 3.500 de custos básicos, sua reserva de 6 meses (CLT) será de R$ 21.000.',
      },
    ],
  },
  {
    slug: 'alugar-vs-financiar',
    id: 'alugar-vs-financiar',
    title: 'Simulador Alugar vs. Financiar Imóvel (Tabela SAC)',
    shortTitle: 'Alugar vs. Financiar Imóvel',
    badge: 'Decisão',
    isTopFour: false,
    icon: 'home',
    subtitle: 'Coloque na ponta do lápis se vale mais financiar pela Tabela SAC ou alugar e investir a diferença.',
    seoDescription:
      'Compare matematicamente o financiamento imobiliário (Tabela SAC) contra morar de aluguel e investir o valor da entrada e a diferença mensal das parcelas em Renda Fixa.',
    nextStepTitle: 'Planejando dar entrada no seu imóvel ou investir a diferença?',
    nextStepDescription:
      'Use a aba de Metas Financeiras da Planilha Oficial ABC para planejar sua entrada imobiliária sem comprometer o orçamento da família.',
    nextStepCtaLabel: 'Ver Planilha Oficial ABC',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'psicologia-financeira',
    faqs: [
      {
        question: 'Por que em épocas de juros altos alugar e investir costuma ganhar matematicamente?',
        answer:
          'Porque quando a Selic está elevada, o custo efetivo do financiamento sobe enquanto o valor da entrada aplicado em Renda Fixa rende mais de 1% ao mês líquido, muitas vezes pagando boa parte do aluguel só com os rendimentos.',
      },
    ],
  },
  {
    slug: 'preco-teto-acoes-fiis',
    id: 'preco-teto-acoes-fiis',
    title: 'Calculadora de Preço-Teto (Bazin & Graham) e Número Mágico de FIIs',
    shortTitle: 'Preço-Teto & Magic Number',
    badge: 'Valuation',
    isTopFour: false,
    icon: 'target',
    subtitle: 'Calcule o Preço-Teto de Décio Bazin (6%), o Valor Intrínseco de Graham e o Magic Number de FIIs.',
    seoDescription:
      'Ferramenta 3 em 1: descubra o Preço-Teto de ações pelo método Décio Bazin, o Valor Intrínseco pela fórmula de Benjamin Graham e quantas cotas de um FII compram uma nova cota sozinhas todo mês.',
    nextStepTitle: 'Domine a mentalidade dos maiores investidores de dividendos',
    nextStepDescription:
      'Organize seus aportes mensais com a Planilha Oficial ABC e estude as obras originais de Décio Bazin, Benjamin Graham e Luiz Barsi.',
    nextStepCtaLabel: 'Conhecer a Planilha ABC & Biblioteca',
    nextStepCtaUrl: '/planilha-abc',
    recommendedBookId: 'faca-fortuna-acoes',
    faqs: [
      {
        question: 'O que é o Número Mágico (Magic Number) nos Fundos Imobiliários?',
        answer:
          'É a quantidade exata de cotas de um FII necessária para que a soma dos dividendos recebidos naquele mês seja suficiente para comprar +1 nova cota inteira sem você tirar nenhum centavo do bolso.',
      },
      {
        question: 'Como funciona a fórmula de Preço-Teto de Décio Bazin?',
        answer:
          'Bazin estabeleceu que uma ação pagadora de dividendos só deveria ser comprada se entregasse no mínimo 6% ao ano em dividendos (em dólar/moeda forte). Logo, Preço-Teto = Dividendo Anual por Ação ÷ 0,06.',
      },
    ],
  },
];
