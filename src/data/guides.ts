export interface GuideArticle {
  slug: string;
  level: 'A' | 'B' | 'C';
  levelTitle: string;
  title: string;
  subtitle: string;
  readTime: string;
  summary: string;
  relatedCalculatorSlug: string;
  relatedCalculatorLabel: string;
  sections: {
    heading: string;
    paragraphs: string[];
    bullets?: string[];
    highlightBox?: string;
  }[];
}

export interface GlossaryItem {
  term: string;
  category: 'Renda Fixa' | 'Indicadores' | 'Bolsa & FIIs' | 'Tributação & Segurança';
  definition: string;
  practicalExample: string;
}

export const GUIDES: GuideArticle[] = [
  {
    slug: 'como-montar-reserva-de-emergencia',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Como Montar sua Reserva de Emergência e Sair da Poupança de Vez',
    subtitle: 'O primeiro passo obrigatório antes de buscar rentabilidades maiores: quanto guardar, onde aplicar com liquidez diária e o que evitar.',
    readTime: '6 min de leitura',
    summary:
      'Entenda por que a Reserva de Emergência é o seguro da sua liberdade financeira, quantos meses do seu custo de vida acumular e quais títulos substituem a poupança com segurança superior.',
    relatedCalculatorSlug: 'reserva-emergencia',
    relatedCalculatorLabel: 'Simular minha Reserva de Emergência',
    sections: [
      {
        heading: '1. Por que ninguém deve investir em Bolsa ou títulos longos sem Reserva?',
        paragraphs: [
          'Imagine que você colocou todo o seu dinheiro em um título com vencimento para daqui a 3 anos ou em Fundos Imobiliários, e no mês seguinte surge um imprevisto médico ou uma manutenção urgente no carro. Sem uma reserva de liquidez imediata, você será forçado a vender seus investimentos no pior momento ou recorrer a empréstimos caros.',
          'A Reserva de Emergência não serve para deixar você rico da noite para o dia — ela serve para garantir que nenhum imprevisto destrua o seu plano de enriquecimento de longo prazo.',
        ],
        highlightBox:
          'Regra de Ouro ABC: Na Reserva de Emergência, segurança e liquidez diária (resgate no mesmo dia) vêm sempre antes da busca por décimos extras de rentabilidade.',
      },
      {
        heading: '2. Quantos meses do custo de vida acumular?',
        paragraphs: [
          'O tamanho ideal do seu colchão de segurança depende diretamente da estabilidade da sua fonte de renda e da rapidez com que você conseguiria recolocação profissional:',
        ],
        bullets: [
          'Servidor Público concursado (3 a 4 meses dos custos essenciais): alta previsibilidade de receita mensal.',
          'Trabalhador CLT (6 meses dos custos essenciais): conta com FGTS e seguro-desemprego como amortecedores adicionais.',
          'Autônomo, MEI, Profissional Liberal ou Empresário (12 meses dos custos essenciais): renda variável exige proteção dobrada para meses de baixa.',
        ],
      },
      {
        heading: '3. Onde guardar a Reserva com segurança máxima?',
        paragraphs: [
          'Enquanto a caderneta de poupança rende apenas 0,5% ao mês + TR quando a Selic está acima de 8,5% ao ano (e ainda perde todo o rendimento do mês se você sacar antes do "dia de aniversário"), existem duas alternativas clássicas superiores:',
        ],
        bullets: [
          'Tesouro Selic (Risco Soberano): título público federal considerado o ativo de menor risco de crédito do país, com liquidez diária.',
          'CDB de Liquidez Diária a 100% do CDI (em grandes bancos sólidos): acompanha integralmente a taxa DI diária e conta com a cobertura do FGC até R$ 250 mil por instituição.',
        ],
      },
    ],
  },
  {
    slug: 'regra-50-30-20-orcamento-inteligente',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'O Método 50/30/20 na Prática: Como Fazer Sobrar Dinheiro Todo Mês',
    subtitle: 'Aprenda a dividir sua renda líquida em três baldes claros para viver bem no presente sem sacrificar o seu futuro financeiro.',
    readTime: '5 min de leitura',
    summary:
      'Descubra como estruturar seu orçamento mensal sem precisar anotar cada centavo de café, automatizando seus aportes logo no dia em que o salário cai na conta.',
    relatedCalculatorSlug: 'juros-compostos',
    relatedCalculatorLabel: 'Simular meus 20% na Calculadora do 1º Milhão',
    sections: [
      {
        heading: '1. O erro de tentar investir "o que sobrar no fim do mês"',
        paragraphs: [
          'A maioria das pessoas recebe o salário, paga as contas, gasta ao longo do mês e promete investir o que sobrar no dia 30. Na prática, quase nunca sobra nada — porque nossos gastos se expandem naturalmente até consumir toda a renda disponível.',
          'O segredo dos investidores consistentes é inverter a ordem: assim que a renda entra, você separa primeiro a fatia do seu futuro ("pague-se primeiro") e vive com o restante.',
        ],
      },
      {
        heading: '2. Os 3 Baldes da Regra 50/30/20',
        paragraphs: [
          'A divisão 50/30/20 funciona como uma bússola simples para diagnosticar rapidamente se o seu padrão de vida cabe dentro da sua renda líquida:',
        ],
        bullets: [
          '50% para Necessidades Essenciais: moradia, condomínio, energia, água, supermercado básico, saúde, transporte para o trabalho e educação.',
          '30% para Estilo de Vida e Desejos: lazer, restaurantes, viagens, assinaturas de streaming, hobbies e compras pessoais.',
          '20% para Liberdade Financeira: quitação de dívidas caras (se houver), formação da Reserva de Emergência e aportes mensais para o 1º milhão.',
        ],
        highlightBox:
          'Dica Prática: Se seus gastos essenciais hoje consomem 70% da renda, comece investindo 5% ou 10% todo mês sem falhar e reduza gradualmente os custos fixos até atingir os 20%.',
      },
    ],
  },
  {
    slug: 'cdb-vs-lci-lca-tesouro-como-comparar',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'CDB, LCI, LCA ou Tesouro Direto: Como Comparar e Descontar o Imposto de Renda',
    subtitle: 'Entenda a tabela regressiva de IR em 2026, a fórmula de equivalência das letras isentas e o papel do FGC.',
    readTime: '7 min de leitura',
    summary:
      'Nunca mais compare taxas brutas com taxas líquidas: aprenda em 2 minutos a calcular qual título de Renda Fixa coloca mais dinheiro limpo no seu bolso.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Abrir Comparador CDB vs. LCI/LCA',
    sections: [
      {
        heading: '1. Taxa Bruta vs. Taxa Líquida: A Pegadinha mais Comum',
        paragraphs: [
          'Quando você vê na corretora um CDB pagando 108% do CDI e uma LCI pagando 93% do CDI pelo mesmo prazo, qual rende mais? Quem olha apenas o número maior escolhe o CDB — e acaba ganhando menos dinheiro!',
          'Isso acontece porque sobre o lucro do CDB e do Tesouro Direto incide o Imposto de Renda pela Tabela Regressiva, enquanto LCI e LCA continuam 100% isentas de IR para pessoa física em 2026.',
        ],
      },
      {
        heading: '2. A Tabela Regressiva do Imposto de Renda (Vigente em 2026)',
        paragraphs: [
          'Na Renda Fixa tributada, quanto mais tempo seu dinheiro permanece investido, menor é a mordida do Leão sobre os rendimentos (nunca sobre o principal investido):',
        ],
        bullets: [
          'Até 180 dias (6 meses): 22,5% de IR sobre o lucro.',
          'De 181 a 360 dias (6 meses a 1 ano): 20,0% de IR sobre o lucro.',
          'De 361 a 720 dias (1 a 2 anos): 17,5% de IR sobre o lucro.',
          'Acima de 720 dias (mais de 2 anos): 15,0% de IR sobre o lucro (alíquota mínima).',
        ],
        highlightBox:
          'Fórmula de Bolso: Taxa Equivalente do CDB = Taxa da LCI ÷ (1 − Alíquota de IR). Exemplo para 2 anos (IR 15%): LCI de 93% ÷ 0,85 = CDB de 109,4% do CDI.',
      },
      {
        heading: '3. O que é o FGC e quais são os limites reais?',
        paragraphs: [
          'O Fundo Garantidor de Créditos (FGC) protege CDBs, LCIs, LCAs e RDBs em até R$ 250.000 por CPF e por conglomerado financeiro, limitado a um teto global de R$ 1 milhão renovável a cada 4 anos. Importante: o valor de R$ 250 mil inclui tanto o capital investido quanto os juros acumulados até a data de eventual intervenção.',
        ],
      },
    ],
  },
  {
    slug: 'tesouro-ipca-ganho-real-inflacao',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'Tesouro IPCA+ e Ganho Real: Como Proteger seu Patrimônio da Inflação',
    subtitle: 'Por que olhar apenas a rentabilidade nominal pode enganar você e como funcionam os títulos híbridos atrelados ao IPCA.',
    readTime: '6 min de leitura',
    summary:
      'Entenda a diferença entre juro nominal e juro real, como o Tesouro IPCA+ protege seu poder de compra por décadas e o que é marcação a mercado.',
    relatedCalculatorSlug: 'juros-compostos',
    relatedCalculatorLabel: 'Simular Ganho Real Descontando o IPCA',
    sections: [
      {
        heading: '1. Ilusão Monetária: Juro Nominal vs. Juro Real',
        paragraphs: [
          'Se o seu investimento rendeu 12% no ano, mas a inflação (IPCA) do mesmo período foi de 5%, você não ficou 12% mais rico. Parte daquele rendimento serviu apenas para repor a perda do poder de compra da moeda.',
          'O Ganho Real é calculado pela Equação de Fisher: (1 + Taxa Líquida) ÷ (1 + Inflação) − 1. No exemplo acima, 1,12 ÷ 1,05 − 1 = 6,67% de ganho real verdadeiro.',
        ],
      },
      {
        heading: '2. Como funciona o Tesouro IPCA+?',
        paragraphs: [
          'O Tesouro IPCA+ combina duas parcelas: a variação integral da inflação oficial (IPCA) mais uma taxa fixa de juro real contratada no momento da compra (por exemplo, IPCA + 6,5% ao ano).',
          'Se você mantiver o título até a data de vencimento combinada, tem a garantia matemática de que seu dinheiro renderá exatamente a inflação do período mais a taxa contratada, não importa o que aconteça no caminho.',
        ],
        highlightBox:
          'Atenção à Marcação a Mercado: Antes do vencimento, o preço do Tesouro IPCA+ oscila diariamente. Só invista nele o dinheiro que você não precisará resgatar antes do prazo.',
      },
    ],
  },
  {
    slug: 'como-viver-de-renda-Com-fiis-e-dividendos',
    level: 'C',
    levelTitle: 'Nível C — Renda Passiva, FIIs e Ações',
    title: 'A Bola de Neve dos Dividendos e o Número Mágico dos FIIs (Atualizado 2026)',
    subtitle: 'Como construir uma carteira geradora de renda mensal recorrente e o que mudou com a Lei 15.270/2025.',
    readTime: '8 min de leitura',
    summary:
      'Aprenda na prática o conceito do Magic Number nos Fundos Imobiliários, como selecionar empresas pagadoras de dividendos e as regras fiscais vigentes em 2026.',
    relatedCalculatorSlug: 'dividendos',
    relatedCalculatorLabel: 'Simular minha Bola de Neve de Dividendos',
    sections: [
      {
        heading: '1. O que é o "Número Mágico" nos Fundos Imobiliários?',
        paragraphs: [
          'Imagine um Fundo Imobiliário (FII) cuja cota custa R$ 100,00 e que distribui R$ 1,00 por mês por cota. Quando você acumula 100 cotas (R$ 10.000 investidos), você passa a receber R$ 100,00 todos os meses.',
          'Nesse exato ponto, os próprios rendimentos das suas 100 cotas compram +1 nova cota todo mês, mesmo que você não tire mais nenhum real do seu salário! Esse marco é chamado de Número Mágico (Magic Number).',
        ],
      },
      {
        heading: '2. Tributação de FIIs e Dividendos em 2026 (Lei 15.270/2025)',
        paragraphs: [
          'Com a entrada em vigor da Lei nº 15.270 em janeiro de 2026, vale conhecer com clareza as regras atuais para planejar sua renda passiva:',
        ],
        bullets: [
          'Rendimentos de FIIs continuam 100% isentos de Imposto de Renda para Pessoa Física (desde que o fundo tenha ao menos 100 cotistas e cotas negociadas exclusivamente em bolsa).',
          'Dividendos de Ações permanecem isentos de retenção até R$ 50.000,00 por mês por empresa pagadora. Apenas valores distribuídos acima de R$ 50 mil no mesmo mês por uma mesma PJ sofrem retenção de 10% na fonte.',
          'Venda de cotas de FIIs com lucro na bolsa tem alíquota de 20% sobre o ganho de capital (sem a isenção de R$ 20 mil/mês que existe para ações no mercado à vista).',
        ],
      },
    ],
  },
  {
    slug: 'metodo-bazin-e-graham-preco-justo-acoes',
    level: 'C',
    levelTitle: 'Nível C — Renda Passiva, FIIs e Ações',
    title: 'Preço-Teto de Décio Bazin e Valor Intrínseco de Benjamin Graham Explicados',
    subtitle: 'Duas das fórmulas mais consagradas da história das finanças para nunca pagar caro demais por uma ação.',
    readTime: '7 min de leitura',
    summary:
      'Entenda passo a passo como Décio Bazin e Benjamin Graham calculavam a margem de segurança de uma ação antes de investir.',
    relatedCalculatorSlug: 'preco-teto-acoes-fiis',
    relatedCalculatorLabel: 'Testar Calculadora de Bazin & Graham',
    sections: [
      {
        heading: '1. O Método de Décio Bazin (Piso de 6% de Dividend Yield)',
        paragraphs: [
          'No clássico livro "Faça Fortuna com Ações, Antes que Seja Tarde", o jornalista e investidor brasileiro Décio Bazin defendia que o investidor só deveria comprar ações de empresas com baixo endividamento e que pagassem no mínimo 6% ao ano em dividendos.',
          'Para descobrir o preço máximo que você pode pagar por uma ação garantindo 6% de retorno em dividendos, basta dividir o dividendo anual esperado por 0,06 (ou multiplicar por 16,67). Se uma empresa paga R$ 2,40 de dividendos por ação no ano, seu Preço-Teto de Bazin é R$ 2,40 ÷ 0,06 = R$ 40,00.',
        ],
      },
      {
        heading: '2. A Fórmula de Benjamin Graham (Valor Intrínseco)',
        paragraphs: [
          'Benjamin Graham, mentor de Warren Buffett, propôs uma fórmula prática para estimar o valor justo de empresas lucrativas e consolidadas combinando o Lucro por Ação (LPA) e o Valor Patrimonial por Ação (VPA).',
          'Considerando que uma empresa saudável não deveria negociar acima de um P/L (Preço/Lucro) de 15x nem acima de um P/VP (Preço/Valor Patrimonial) de 1,5x (onde 15 × 1,5 = 22,5), chegamos à fórmula: Valor Intrínseco = √(22,5 × LPA × VPA).',
        ],
        highlightBox:
          'Importante: Fórmulas matemáticas são filtros iniciais de estudo, não recomendações automáticas de compra. Sempre avalie a qualidade da gestão, dívida e setor da empresa.',
      },
    ],
  },
];

export const GLOSSARY_TERMS: GlossaryItem[] = [
  {
    term: 'Selic (Taxa Básica de Juros)',
    category: 'Indicadores',
    definition: 'É a taxa mãe da economia brasileira, definida a cada 45 dias pelo Copom (Banco Central). Serve de referência para todos os demais juros do país.',
    practicalExample: 'Quando a Selic está em 13,75% a.a., o Tesouro Selic rende praticamente essa taxa bruta ao ano.',
  },
  {
    term: 'CDI (Certificado de Depósito Interbancário)',
    category: 'Indicadores',
    definition: 'Taxa dos empréstimos diários entre bancos, que anda sempre colada na Selic (geralmente 0,10 ponto percentual abaixo da Selic Meta).',
    practicalExample: 'Um CDB que paga "100% do CDI" rende exatamente a variação do CDI no período.',
  },
  {
    term: 'IPCA (Índice Nacional de Preços ao Consumidor Amplo)',
    category: 'Indicadores',
    definition: 'É o índice oficial da inflação no Brasil, medido mensalmente pelo IBGE. Para enriquecer de verdade, seus investimentos precisam render acima do IPCA.',
    practicalExample: 'No Tesouro IPCA+ 6%, você recebe a inflação integral do período mais 6% ao ano de ganho real.',
  },
  {
    term: 'TR (Taxa Referencial)',
    category: 'Indicadores',
    definition: 'Taxa calculada pelo Banco Central que compõe o rendimento da Poupança, do FGTS e de alguns financiamentos imobiliários.',
    practicalExample: 'Com a Selic acima de 8,5% a.a., a poupança rende 0,5% ao mês + TR.',
  },
  {
    term: 'CDB (Certificado de Depósito Bancário)',
    category: 'Renda Fixa',
    definition: 'Título emitido por bancos para captar recursos. Você empresta dinheiro ao banco em troca de juros (pós-fixados no CDI, prefixados ou IPCA+). Conta com proteção do FGC.',
    practicalExample: 'CDB de liquidez diária a 100% do CDI é um dos destinos favoritos para Reserva de Emergência.',
  },
  {
    term: 'LCI e LCA (Letras de Crédito Imobiliário e do Agronegócio)',
    category: 'Renda Fixa',
    definition: 'Títulos emitidos por bancos lastreados nos setores imobiliário e agrícola. Seu grande diferencial é a isenção total de Imposto de Renda para Pessoa Física.',
    practicalExample: 'Uma LCI de 92% do CDI em 1 ano supera um CDB de 110% do CDI porque não desconta IR.',
  },
  {
    term: 'Tesouro Selic',
    category: 'Renda Fixa',
    definition: 'Título público federal pós-fixado que acompanha a taxa Selic diária. Possui baixíssimo risco de oscilações e liquidez diária.',
    practicalExample: 'Ideal para a Reserva de Emergência; até R$ 10 mil investidos no Tesouro Selic têm isenção da taxa de custódia da B3.',
  },
  {
    term: 'Tesouro IPCA+',
    category: 'Renda Fixa',
    definition: 'Título público federal que paga a variação da inflação (IPCA) somada a uma taxa prefixada de juro real se levado até o vencimento.',
    practicalExample: 'Excelente para aposentadoria e objetivos de médio/longo prazo.',
  },
  {
    term: 'FGC (Fundo Garantidor de Créditos)',
    category: 'Tributação & Segurança',
    definition: 'Entidade privada sem fins lucrativos que protege investidores de CDB, LCI, LCA, RDB e Poupança até R$ 250 mil por CPF/instituição (com teto de R$ 1 milhão a cada 4 anos).',
    practicalExample: 'Para ficar 100% coberto pelo FGC, evite aplicar mais de R$ 200 mil no mesmo banco para deixar espaço para os juros.',
  },
  {
    term: 'Tabela Regressiva do IR',
    category: 'Tributação & Segurança',
    definition: 'Regra de tributação da Renda Fixa onde a alíquota cai conforme o tempo: 22,5% (até 180d), 20% (181–360d), 17,5% (361–720d) e 15% (acima de 720d).',
    practicalExample: 'O imposto incide apenas sobre o lucro no momento do resgate ou vencimento.',
  },
  {
    term: 'IOF Regressivo (30 dias)',
    category: 'Tributação & Segurança',
    definition: 'Imposto sobre Operações Financeiras cobrado sobre o rendimento caso você resgate um CDB ou Tesouro antes de completar 30 dias da aplicação.',
    practicalExample: 'No 30º dia corrido, a alíquota do IOF cai para zero.',
  },
  {
    term: 'Liquidez Diária (D+0 / D+1)',
    category: 'Renda Fixa',
    definition: 'Capacidade de converter o investimento em dinheiro na conta rapidamente (no mesmo dia útil D+0 ou no dia útil seguinte D+1) sem perda de rentabilidade.',
    practicalExample: 'Todo dinheiro de Reserva de Emergência deve ter liquidez diária.',
  },
  {
    term: 'Marcação a Mercado',
    category: 'Renda Fixa',
    definition: 'Atualização diária do preço pelo qual um título Prefixado ou IPCA+ pode ser vendido antecipadamente antes do vencimento.',
    practicalExample: 'Se você levar o título até a data de vencimento, recebe exatamente a taxa contratada na compra.',
  },
  {
    term: 'FIIs (Fundos de Investimento Imobiliário)',
    category: 'Bolsa & FIIs',
    definition: 'Fundos negociados em bolsa que investem em imóveis físicos (galpões, shoppings, lajes) ou títulos imobiliários e distribuem aluguéis mensais isentos de IR para PF.',
    practicalExample: 'Com cerca de R$ 10 ou R$ 100 você já consegue comprar 1 cota de um FII e receber proventos todo mês.',
  },
  {
    term: 'Dividend Yield (DY)',
    category: 'Bolsa & FIIs',
    definition: 'Indicador que mostra quantos por cento uma ação ou FII pagou em dividendos nos últimos 12 meses em relação ao preço atual da cota.',
    practicalExample: 'Uma ação que custa R$ 20 e pagou R$ 2,00 de dividendos no ano tem um Dividend Yield de 10% a.a.',
  },
  {
    term: 'Número Mágico (Magic Number)',
    category: 'Bolsa & FIIs',
    definition: 'Quantidade de cotas de um FII ou Ação a partir da qual os próprios dividendos mensais já compram 1 nova cota inteira todo mês.',
    practicalExample: 'Cota a R$ 100 pagando R$ 1,00/mês tem Número Mágico de 100 cotas.',
  },
  {
    term: 'P/VP (Preço sobre Valor Patrimonial)',
    category: 'Bolsa & FIIs',
    definition: 'Compara o preço de mercado da ação/FII na bolsa com o valor contábil do seu patrimônio líquido. P/VP = 1,00 significa negociado exatamente pelo valor patrimonial.',
    practicalExample: 'P/VP abaixo de 1,00 indica que o mercado está negociando o ativo com desconto sobre o patrimônio.',
  },
  {
    term: 'P/L (Preço sobre Lucro)',
    category: 'Bolsa & FIIs',
    definition: 'Indica em quantos anos o lucro atual de uma empresa pagaria o preço pago pela ação, mantendo-se os lucros constantes.',
    practicalExample: 'Uma ação com P/L de 8 negocia a 8 vezes o seu lucro líquido anual.',
  },
  {
    term: 'LPA e VPA',
    category: 'Bolsa & FIIs',
    definition: 'Lucro Por Ação (lucro líquido dividido pelo total de ações) e Valor Patrimonial por Ação (patrimônio líquido dividido pelo total de ações).',
    practicalExample: 'São os dois insumos usados na Fórmula de Valor Intrínseco de Benjamin Graham.',
  },
  {
    term: 'JCP (Juros sobre Capital Próprio)',
    category: 'Bolsa & FIIs',
    definition: 'Forma de remuneração de acionistas semelhante ao dividendo, porém com retenção obrigatória de 15% de IR na fonte antes de cair na conta.',
    practicalExample: 'Se a empresa anuncia R$ 1,00 bruto de JCP por ação, caem R$ 0,85 líquidos na sua corretora.',
  },
  {
    term: 'ETF (Exchange Traded Fund)',
    category: 'Bolsa & FIIs',
    definition: 'Fundo de índice negociado em bolsa que replica uma cesta inteira de ativos (como o S&P 500 americano ou o Ibovespa) com uma única cota.',
    practicalExample: 'Permite diversificar em 500 empresas globais comprando apenas um código na corretora.',
  },
  {
    term: 'Tabela SAC vs. Tabela Price',
    category: 'Renda Fixa',
    definition: 'Sistemas de amortização de financiamentos. Na SAC, a amortização da dívida é constante e as parcelas começam maiores e caem todo mês. Na Price, as parcelas são fixas.',
    practicalExample: 'No longo prazo, a Tabela SAC costuma gerar um gasto total menor com juros que a Tabela Price.',
  },
  {
    term: 'Ganho Real',
    category: 'Indicadores',
    definition: 'É o quanto seu patrimônio cresceu acima da inflação (IPCA), já descontados todos os impostos e taxas.',
    practicalExample: 'É o único número que realmente aumenta o seu poder de compra no futuro.',
  },
  {
    term: 'Come-Cotas',
    category: 'Tributação & Segurança',
    definition: 'Antecipação semestral (maio e novembro) do Imposto de Renda que existe em fundos de investimento tradicionais de Renda Fixa e Multimercado.',
    practicalExample: 'Títulos diretos como CDB, LCI, LCA, Tesouro Direto, Ações e FIIs NÃO possuem come-cotas.',
  },
];
