export interface BookRecommendation {
  id: string;
  title: string;
  author: string;
  badge: string;
  summary: string;
  whyRead: string;
  amazonUrl: string;
}

const AMAZON_ASSOCIATE_TAG = 'abcinvestimen-20';

export const SITE_CONFIG = {
  name: 'ABC Investimentos',
  domain: 'abcinvestimentos.com.br',
  url: 'https://www.abcinvestimentos.com.br',
  tagline: 'Simuladores Financeiros, Guia do A ao Z e Inteligência para o seu Patrimônio',
  description:
    'Calculadoras financeiras gratuitas e precisas (Juros Compostos, Comparador CDB vs. LCI/LCA e Tesouro, Dividendos, Reserva de Emergência, Alugar vs. Financiar), Guia ABC do Investidor e Consultor Educativo com IA.',

  // Fallback seguro das séries oficiais do Banco Central e B3 (usado caso a API esteja indisponível)
  defaultIndicators: {
    selic: 13.75,
    cdi: 13.65,
    poupanca: 7.12,
    ipca12m: 4.58,
    dolar: 5.42,
    ibovespa: 131850,
    ifix: 3385,
    trAnual: 0.95,
    updatedAt: 'Out/2026 (Referência BCB)',
  },

  // Produto Digital Oficial de Lançamento (Foco 100% em utilidade real e zero risco fiscal)
  product: {
    title: 'Planilha ABC — Controle Financeiro 50/30/20 & Rumo ao 1º Milhão',
    shortTitle: 'Planilha Oficial ABC (.xlsx)',
    subtitle:
      'Organize seu orçamento em 5 minutos por semana, construa sua Reserva de Emergência e acompanhe mês a mês sua jornada até o primeiro milhão.',
    priceOriginal: 67.0,
    priceLaunch: 29.9,
    pricePromo: 19.9,
    // Quando criar o produto na Kiwify ou Hotmart, basta colar o link de checkout aqui:
    checkoutUrl: 'https://pay.kiwify.com.br/GrHxxXx',
    externalCheckoutUrl: 'https://pay.kiwify.com.br/GrHxxXx',
    salesPageUrl: 'https://kiwify.app/iNfYrKX',
    guaranteeDays: 7,
    compatibility: 'Excel 2016+, Excel Online, Google Planilhas (Sheets) e LibreOffice Calc — Sem macros que travam.',
    tabs: [
      {
        name: '1. Comece Aqui',
        desc: 'Passo a passo visual em 3 etapas com legenda de cores (células brancas = você preenche; células verdes = cálculo automático).',
      },
      {
        name: '2. Configuração & Regra 50/30/20',
        desc: 'Defina sua renda líquida e personalize suas categorias de Essenciais (50%), Estilo de Vida (30%) e Liberdade Financeira (20%).',
      },
      {
        name: '3. Lançamentos Rápidos',
        desc: 'Tabela inteligente com listas suspensas de categorias, forma de pagamento (Pix, Cartão, Débito) e classificação automática.',
      },
      {
        name: '4. Painel do Mês (Dashboard)',
        desc: 'Visão clara de Receitas, Despesas, Saldo Livre, % da Renda Poupada e comparativo Orçado vs. Realizado com alertas visuais.',
      },
      {
        name: '5. Visão Anual (12 Meses)',
        desc: 'Consolidação automática de Janeiro a Dezembro para identificar ralos financeiros e evolução da sua taxa de poupança.',
      },
      {
        name: '6. Reserva de Emergência',
        desc: 'Cálculo automático do colchão ideal para o seu perfil (CLT, Autônomo/PJ ou Servidor) e barra de progresso até 100%.',
      },
      {
        name: '7. Metas & Objetivos',
        desc: 'Planejador de até 6 metas financeiras simultâneas mostrando exatamente quanto guardar por mês para cada conquista.',
      },
      {
        name: '8. Rumo ao 1º Milhão',
        desc: 'Simulador patrimonial ano a ano em 3 cenários (Conservador, Moderado e Otimista) mostrando quando sua bola de neve atinge R$ 1.000.000.',
      },
    ],
  },

  // Configuração Oficial de Afiliados Amazon Brasil (ID aprovado do criador)
  amazonAssociateTag: AMAZON_ASSOCIATE_TAG,
  books: [
    {
      id: 'psicologia-financeira',
      title: 'A Psicologia Financeira',
      author: 'Morgan Housel',
      badge: 'Mais Vendido • Mentalidade',
      summary: 'Lições atemporais sobre fortuna, ganância e felicidade. Mostra por que o sucesso financeiro depende mais do seu comportamento do que de planilhas complexas.',
      whyRead: 'Ideal para não cair em armadilhas emocionais e manter a constância nos aportes mensais.',
      amazonUrl: `https://www.amazon.com.br/s?k=A+Psicologia+Financeira+Morgan+Housel&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
    {
      id: 'investidor-bom-senso',
      title: 'O Investidor de Bom Senso',
      author: 'John C. Bogle',
      badge: 'Essencial • Longo Prazo',
      summary: 'Escrito pelo fundador da Vanguard, demonstra matematicamente como custos baixos, diversificação e juros compostos superam 90% dos especuladores.',
      whyRead: 'Leitura obrigatória depois de simular seus aportes na Calculadora do 1º Milhão.',
      amazonUrl: `https://www.amazon.com.br/s?k=O+Investidor+de+Bom+Senso+John+Bogle&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
    {
      id: 'rei-dos-dividendos',
      title: 'O Rei dos Dividendos',
      author: 'Luiz Barsi Filho',
      badge: 'Renda Passiva Brasil',
      summary: 'A trajetória do maior investidor pessoa física da Bolsa brasileira saindo do zero até viver exclusivamente de dividendos de grandes empresas.',
      whyRead: 'Complemento perfeito para a Calculadora de Dividendos e Preço-Teto de Bazin.',
      amazonUrl: `https://www.amazon.com.br/s?k=O+Rei+dos+Dividendos+Luiz+Barsi&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
    {
      id: 'faca-fortuna-acoes',
      title: 'Faça Fortuna com Ações, Antes que Seja Tarde',
      author: 'Décio Bazin',
      badge: 'Clássico Brasileiro',
      summary: 'O livro que originou o famoso método do Preço-Teto baseado em Dividend Yield mínimo de 6% ao ano sem dívidas excessivas.',
      whyRead: 'Explica na fonte a fórmula exata usada na nossa Calculadora de Preço-Teto.',
      amazonUrl: `https://www.amazon.com.br/s?k=Faca+Fortuna+com+Acoes+Decio+Bazin&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
    {
      id: 'homem-mais-rico-babilonia',
      title: 'O Homem Mais Rico da Babilônia',
      author: 'George S. Clason',
      badge: 'Iniciantes • Hábito de Poupar',
      summary: 'O princípio clássico de "pagar-se primeiro" (guardar ao menos 10% a 20% de tudo o que ganha) explicado em parábolas diretas e fáceis de aplicar.',
      whyRead: 'O melhor primeiro livro para quem está começando a montar a Reserva de Emergência.',
      amazonUrl: `https://www.amazon.com.br/s?k=O+Homem+Mais+Rico+da+Babilonia&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
    {
      id: 'investidor-inteligente',
      title: 'O Investidor Inteligente',
      author: 'Benjamin Graham',
      badge: 'Valuation & Margem de Segurança',
      summary: 'A bíblia do Value Investing escrita pelo mentor de Warren Buffett, apresentando os conceitos de Sr. Mercado, Valor Intrínseco e Margem de Segurança.',
      whyRead: 'Base teórica da nossa Calculadora de Valor Intrínseco de Graham.',
      amazonUrl: `https://www.amazon.com.br/s?k=O+Investidor+Inteligente+Benjamin+Graham&tag=${AMAZON_ASSOCIATE_TAG}`,
    },
  ] satisfies BookRecommendation[],

  // Google Analytics 4 (GA4) com proteção e exclusão de tráfego interno
  analytics: {
    enabled: true,
    measurementId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID || '', // Ex: 'G-XXXXXXXXXX'
  },

  // Google AdSense (Mantido desligado até a aprovação oficial da conta para deixar o site 100% limpo)
  adsense: {
    enabled: false,
    clientId: '', // Ex: 'ca-pub-0000000000000000'
  },

  // Contato comercial & Parcerias
  contact: {
    email: 'contato@abcinvestimentos.com.br',
    partnershipsEmail: 'parcerias@abcinvestimentos.com.br',
    whatsappNumber: '', // Opcional: Ex: '5511999999999'
  },

  // Aviso Legal de Compliance (CVM & Propriedade Intelectual)
  legalDisclaimer:
    'O portal ABC Investimentos (abcinvestimentos.com.br) é uma plataforma independente de educação financeira, conteúdo informativo e simuladores matemáticos. Não realizamos recomendações de compra ou venda de valores mobiliários, consultoria ou análise de investimentos (atividades reguladas pela CVM). Este portal não possui qualquer vínculo societário, comercial ou institucional com o Banco ABC Brasil S.A. (abcbrasil.com.br) ou com a AABC Consultoria de Investimentos Ltda. (abcinvestimentos.com).',
} as const;
