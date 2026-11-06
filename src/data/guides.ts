export interface GuideArticle {
  slug: string;
  level: 'A' | 'B' | 'C';
  levelTitle: string;
  title: string;
  subtitle: string;
  readTime: string;
  /** ISO date the article first went live. Defaults to SITE_PUBLISHED_AT when omitted. */
  datePublished?: string;
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

export const SITE_PUBLISHED_AT = '2026-10-25';

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
  {
    slug: 'como-investir-do-zero-guia-completo',
    datePublished: '2026-11-06',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Como Investir do Zero: Guia Completo para Iniciantes em 2026',
    subtitle: 'O passo a passo exato para sair da poupança e fazer sua primeira aplicação, mesmo que você tenha apenas R$ 100.',
    readTime: '8 min de leitura',
    summary:
      'Aprenda os 5 passos fundamentais para começar a investir: organizar dívidas, montar reserva, abrir corretora, escolher o primeiro ativo e criar o hábito de aportar todo mês.',
    relatedCalculatorSlug: 'reserva-emergencia',
    relatedCalculatorLabel: 'Descobrir Quanto Preciso Guardar',
    sections: [
      {
        heading: '1. Antes de Investir: Quite Dívidas Caras',
        paragraphs: [
          'Nenhum investimento de Renda Fixa no Brasil rende de forma consistente acima de 15% ao ano. Já o cartão de crédito rotativo e o cheque especial cobram entre 8% e 16% AO MÊS (mais de 150% ao ano).',
          'Matematicamente, quitar uma dívida cara é o investimento com melhor retorno garantido que existe. Só comece a investir em ativos financeiros depois de eliminar dívidas com juros acima de 2% ao mês.',
        ],
        highlightBox:
          'Regra ABC: Se o juro da sua dívida é maior que 24% ao ano, pague-a antes de investir qualquer real.',
      },
      {
        heading: '2. Monte sua Reserva de Emergência',
        paragraphs: [
          'A Reserva de Emergência é o colchão de segurança que evita que você venda investimentos na baixa quando um imprevisto aparece. O valor ideal é de 3 a 12 meses do seu custo de vida essencial, dependendo da estabilidade da sua renda.',
          'Onde guardar: Tesouro Selic (risco soberano, liquidez diária) ou CDB de liquidez diária de 100% do CDI em banco sólido. Nunca em ativos de risco como ações ou FIIs.',
        ],
      },
      {
        heading: '3. Abra Conta em uma Corretora',
        paragraphs: [
          'Corretoras de valores são plataformas que dão acesso a todos os investimentos do mercado com taxas menores que os grandes bancos. As principais opções gratuitas no Brasil incluem plataformas consolidadas e reguladas pela CVM.',
          'O processo de abertura leva menos de 15 minutos pelo celular: envie foto do documento, comprove endereço e aguarde a aprovação (geralmente no mesmo dia). Não é necessário depósito mínimo para abrir a conta.',
        ],
      },
      {
        heading: '4. Escolha seu Primeiro Investimento',
        paragraphs: [
          'Para quem está começando, os ativos mais adequados são:',
        ],
        bullets: [
          'Tesouro Selic: o investimento mais seguro do país, com rendimento colado na taxa Selic.',
          'CDB de liquidez diária 100% do CDI: rende o mesmo que o Tesouro Selic, com proteção do FGC.',
          'LCI/LCA isenta de IR: para prazos maiores que 6 meses, a isenção fiscal compensa.',
          'Fundos de Renda Fixa simples: boa opção para quem quer diversificação automática.',
        ],
      },
      {
        heading: '5. Crie o Hábito de Aportar Todo Mês',
        paragraphs: [
          'O segredo dos investidores de sucesso não é acertar o timing do mercado — é a consistência. Aportes mensais de R$ 100, R$ 300 ou R$ 500, feitos toda semana de pagamento durante 10 ou 20 anos, constroem patrimônio real.',
          'Use a Calculadora de Juros Compostos para simular quanto seu aporte mensal pode render em 5, 10, 20 e 30 anos. Ver o número crescer na tela é o combustível para manter o hábito.',
        ],
        highlightBox:
          'Comece pequeno, mas comece AGORA. R$ 100 investidos hoje valem mais que R$ 1.000 que você promete investir "quando sobrar".',
      },
    ],
  },
  {
    slug: 'melhor-investimento-para-iniciante',
    datePublished: '2026-11-06',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Qual o Melhor Investimento para Iniciante em 2026?',
    subtitle: 'Comparamos os 5 ativos mais seguros para quem está começando, com números reais do Banco Central.',
    readTime: '7 min de leitura',
    summary:
      'Descubra qual é o melhor primeiro investimento para iniciantes: Tesouro Selic, CDB 100% CDI, LCI isenta, fundo de renda fixa ou ações? Comparativo direto com taxas atuais.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Comparar Rendimento Líquido',
    sections: [
      {
        heading: 'A Resposta Direta (Para Quem Tem Pressa)',
        paragraphs: [
          'O melhor investimento para iniciantes é o Tesouro Selic ou um CDB de liquidez diária a 100% do CDI. Ambos oferecem segurança máxima, liquidez imediata e rendimento superior à poupança, sem exigir conhecimento técnico.',
          'Com Selic em 13,75% ao ano, R$ 1.000 no Tesouro Selic rendem aproximadamente R$ 114 líquidos em 12 meses, contra apenas R$ 71 na poupança.',
        ],
      },
      {
        heading: 'Ranking dos 5 Primeiros Investimentos',
        paragraphs: [
          'Ordenamos do mais seguro ao mais arriscado para quem está começando:',
        ],
        bullets: [
          '1º — Tesouro Selic: risco soberano, liquidez D+1, ideal para reserva de emergência.',
          '2º — CDB 100% CDI liquidez diária: proteção FGC, rende igual ao Tesouro.',
          '3º — LCI/LCA isenta de IR: para quem pode deixar o dinheiro preso por 90 dias a 2 anos.',
          '4º — Tesouro IPCA+: para objetivos de médio/longo prazo que precisam bater a inflação.',
          '5º — ETF de índice (BOVA11 ou WINET11): para quem já tem reserva e quer expor uma pequena fatia à bolsa.',
        ],
      },
      {
        heading: 'O Erro que Todo Iniciante Comete',
        paragraphs: [
          'O maior erro não é escolher o ativo errado — é começar pela renda variável sem reserva de emergência. Quando o mercado cai 30% e surge um imprevisto pessoal, o iniciante é forçado a vender na baixa, realizando prejuízo real.',
          'A sequência correta é sempre: quitar dívidas caras → montar reserva de emergência → investir em renda fixa com prazo maior → só então alocar em ações, FIIs ou cripto.',
        ],
        highlightBox:
          'Regra dos 10%: Nos primeiros 2 anos de investimentos, nunca aloc mais que 10% do patrimônio em renda variável.',
      },
    ],
  },
  {
    slug: 'poupanca-vs-cdb-qual-melhor',
    datePublished: '2026-11-06',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Poupança vs. CDB: Qual Rende Mais em 2026? (Números Reais)',
    subtitle: 'Comparação lado a lado com taxas do Banco Central: veja quanto seu dinheiro rende em cada um, mês a mês.',
    readTime: '6 min de leitura',
    summary:
      'A poupança rende 0,5% ao mês + TR. Um CDB 100% do CDI rende mais de 1% ao mês bruto. Veja o comparativo exato para R$ 1.000, R$ 5.000, R$ 10.000 e R$ 50.000.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Simular Poupança vs. CDB',
    sections: [
      {
        heading: 'Resposta Rápida: CDB Sempre Ganha',
        paragraphs: [
          'Com a Selic acima de 8,5% ao ano (como está em 2026), a poupança rende 0,5% ao mês + TR, o que dá aproximadamente 7,12% ao ano. Um CDB de liquidez diária a 100% do CDI rende cerca de 13,65% ao ano bruto — quase o dobro.',
          'Mesmo descontando o Imposto de Renda de 22,5% (para prazos curtos) ou 15% (para prazos longos), o CDB ainda supera a poupança com folga.',
        ],
      },
      {
        heading: 'Comparativo Numérico Direto',
        paragraphs: [
          'Simulação com R$ 10.000 investidos por 12 meses:',
        ],
        bullets: [
          'Poupança: rendimento de ~R$ 712 (isento de IR) → Total: R$ 10.712',
          'CDB 100% CDI: rendimento bruto de ~R$ 1.365 − IR de 20% (R$ 273) = R$ 1.092 líquido → Total: R$ 11.092',
          'Diferença: o CDB coloca R$ 380 a mais no seu bolso em apenas 1 ano.',
        ],
        highlightBox:
          'Para R$ 50.000, essa diferença passa de R$ 1.900 em 12 meses. A escolha do produto importa mais que o valor investido.',
      },
      {
        heading: 'Quando a Poupança Ainda Faz Sentido',
        paragraphs: [
          'A poupança só vence o CDB em um cenário: saques antes de 30 dias da aplicação, quando o IOF regressivo consome todo o rendimento do CDB. Fora isso, a poupança perde em todos os prazos.',
          'Além da rentabilidade inferior, a poupança tem outro problema grave: se você sacar antes do "dia de aniversário" (último dia do mês de depósito), perde todo o rendimento do mês corrente.',
        ],
      },
    ],
  },
  {
    slug: 'tesouro-selic-vs-cdb-comparativo',
    datePublished: '2026-11-06',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'Tesouro Selic ou CDB: Qual Rende Mais em 2026?',
    subtitle: 'Os dois campeões da reserva de emergência lado a lado: rentabilidade, segurança, liquidez e custo.',
    readTime: '7 min de leitura',
    summary:
      'Tesouro Selic e CDB 100% do CDI têm rendimento quase idêntico. A diferença está na segurança (risco soberano vs. FGC) e na praticidade. Veja qual escolher.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Comparar Tesouro vs. CDB',
    sections: [
      {
        heading: 'Rendimento: Empate Técnico',
        paragraphs: [
          'Com Selic em 13,75% a.a., o Tesouro Selic rende aproximadamente 13,60% ao ano bruto. Um CDB de liquidez diária a 100% do CDI rende 13,65% ao ano bruto. A diferença de 0,05 ponto percentual é irrelevante para o bolso.',
          'Ambos sofrem a mesma tabela regressiva de IR (22,5% a 15%). O rendimento líquido é praticamente idêntico.',
        ],
      },
      {
        heading: 'Segurança: Cada Um Tem um Escudo Diferente',
        paragraphs: [
          'O Tesouro Selic é lastreado pelo Governo Federal (risco soberano). É o investimento de menor risco de crédito do país — o risco é o próprio Brasil quebrar.',
          'O CDB é protegido pelo FGC até R$ 250 mil por CPF e por instituição. Para valores acima disso, há risco real de perda em caso de intervenção do banco.',
        ],
        bullets: [
          'Até R$ 250 mil no mesmo banco: CDB e Tesouro são igualmente seguros.',
          'Acima de R$ 250 mil: diversifique entre bancos ou use Tesouro Selic.',
          'Em crise bancária: o Tesouro não depende de instituição privada.',
        ],
      },
      {
        heading: 'Praticidade e Custos',
        paragraphs: [
          'O Tesouro Selic exige cadastro no Tesouro Direto e tem taxa de custódia da B3 de 0,20% ao ano (isenção até R$ 10 mil investidos). O resgate leva D+1.',
          'CDBs de liquidez diária não têm taxa de custódia e o resgate costuma cair no mesmo dia ou D+0. Basta ter conta na corretora.',
        ],
        highlightBox:
          'Regra prática: Reserva de emergência até R$ 10 mil → Tesouro Selic (isenção de custódia + segurança máxima). Reserva maior ou necessidade de resgate no mesmo dia → CDB de liquidez diária.',
      },
    ],
  },
  {
    slug: 'cdb-110-por-cento-cdi-vale-a-pena',
    datePublished: '2026-11-06',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'CDB 110% do CDI Vale a Pena? Análise Completa 2026',
    subtitle: 'Quando um CDB acima de 100% do CDI compensa, qual o risco embutido e como comparar com alternativas isentas.',
    readTime: '6 min de leitura',
    summary:
      'CDBs a 110% ou 120% do CDI são ofertas de bancos médios. Veja a fórmula para comparar com LCI isenta e quando a taxa extra realmente compensa o risco.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Comparar CDB vs. LCI',
    sections: [
      {
        heading: 'O Que Significa 110% do CDI',
        paragraphs: [
          'Um CDB a 110% do CDI paga 10% a mais que a taxa CDI no período. Com CDI em 13,65% ao ano, isso equivale a aproximadamente 15% ao ano bruto.',
          'Essas taxas acima de 100% são ofertas promocionais de bancos médios e digitais buscando captar recursos para crescer. Grandes bancos raramente pagam acima de 102% do CDI.',
        ],
      },
      {
        heading: 'A Fórmula de Equivalência com LCI Isenta',
        paragraphs: [
          'Para saber se um CDB 110% vale mais que uma LCI isenta de IR, use a fórmula: CDB Equivalente = LCI ÷ (1 − Alíquota de IR).',
        ],
        bullets: [
          'Para prazos até 6 meses (IR 22,5%): LCI de 85% do CDI equivale a CDB de 110% do CDI.',
          'Para 1 ano (IR 20%): LCI de 88% do CDI equivale a CDB de 110% do CDI.',
          'Para 2 anos (IR 17,5%): LCI de 91% do CDI equivale a CDB de 110% do CDI.',
          'Acima de 2 anos (IR 15%): LCI de 93,5% do CDI equivale a CDB de 110% do CDI.',
        ],
        highlightBox:
          'Se a LCI oferecer percentual do CDI acima dos valores da tabela, ela rende MAIS que o CDB 110%, mesmo com a taxa bruta menor.',
      },
      {
        heading: 'O Risco que Ninguém Te Conta',
        paragraphs: [
          'CDBs que pagam muito acima de 100% do CDI (120%+) geralmente vêm de bancos menores e mais arriscados. A proteção do FGC cobre até R$ 250 mil, mas o processo de intervenção pode levar meses até você receber de volta.',
          'Para reserva de emergência, prefira CDBs de bancos sólidos a 100-105% do CDI. Para dinheiro que pode ficar preso, a taxa extra de 110-120% pode compensar — dentro do limite do FGC.',
        ],
      },
    ],
  },
  {
    slug: 'ipca-mais-ou-prefixado-2026',
    datePublished: '2026-11-06',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'IPCA+ ou Prefixado: Qual Escolher em 2026?',
    subtitle: 'A decisão que define seu ganho real nos próximos 5 anos. Compare com números atuais e entenda o risco de cada um.',
    readTime: '7 min de leitura',
    summary:
      'Tesouro IPCA+ paga inflação + taxa fixa. Prefixado paga taxa fixa só. Qual ganha depende da inflação futura. Veja a análise completa com números de 2026.',
    relatedCalculatorSlug: 'juros-compostos',
    relatedCalculatorLabel: 'Simular Ganho Real',
    sections: [
      {
        heading: 'A Diferença Fundamental',
        paragraphs: [
          'Prefixado: você sabe exatamente quanto vai receber no vencimento. Se comprou a 13,5% ao ano, R$ 10.000 viram R$ 13.500 em um ano (bruto), não importa o que aconteça na economia.',
          'IPCA+: você recebe a inflação do período MAIS uma taxa real. Se o IPCA foi 4,58% e você comprou IPCA+ 6%, seu rendimento bruto foi de aproximadamente 10,9% no ano.',
        ],
      },
      {
        heading: 'Quando Cada Um Vence',
        paragraphs: [
          'O prefixado ganha se a inflação SURPREENDER para baixo. Exemplo: você travou 13,5% e a inflação veio 3% — seu ganho real foi de 10,2%.',
          'O IPCA+ ganha se a inflação SURPREENDER para cima. Exemplo: você travou IPCA+6% e a inflação veio 8% — seu rendimento foi 14,5% e você ainda garantiu 6% de ganho real.',
        ],
        highlightBox:
          'Regra ABC: Para objetivos de LONGO prazo (aposentadoria, patrimônio), IPCA+ é mais seguro porque garante ganho real independentemente da inflação. Para prazos curtos e previsíveis, o prefixado pode render mais.',
      },
      {
        heading: 'O Risco da Marcação a Mercado',
        paragraphs: [
          'Ambos sofrem marcação a mercado se você precisar vender antes do vencimento. Se os juros de mercado subirem depois da sua compra, o preço do seu título CAI e você pode vender no prejuízo.',
          'O IPCA+ longo (vencimento 2029+) é o mais volátil. Em 2021, títulos IPCA+ caíram mais de 20% no meio do caminho. Só invista o que pode segurar até o vencimento.',
        ],
      },
    ],
  },
  {
    slug: 'como-viver-de-renda-com-500-mil',
    datePublished: '2026-11-06',
    level: 'C',
    levelTitle: 'Nível C — Renda Passiva, FIIs e Ações',
    title: 'Como Viver de Renda com R$ 500 Mil: Simulação Realista',
    subtitle: 'Quanto de renda mensal R$ 500 mil geram em FIIs, dividendos e renda fixa? Veja os números e o que falta no caminho.',
    readTime: '8 min de leitura',
    summary:
      'Com R$ 500 mil investidos, é possível gerar de R$ 3.500 a R$ 5.000 de renda mensal. Simulamos 3 carteiras completas com números reais de 2026.',
    relatedCalculatorSlug: 'dividendos',
    relatedCalculatorLabel: 'Simular Minha Renda Mensal',
    sections: [
      {
        heading: 'A Matemática da Renda de R$ 500 Mil',
        paragraphs: [
          'O quanto R$ 500 mil geram depende do yield (renda percentual) da carteira montada:',
        ],
        bullets: [
          'Carteira conservadora (100% renda fixa): ~R$ 4.800/mês bruto (CDI 13,65% ao ano), ~R$ 4.100 líquido de IR.',
          'Carteira mista (50% FIIs + 50% Tesouro IPCA+): ~R$ 4.200/mês, sendo a maior parte isenta de IR.',
          'Carteira de dividendos (100% ações DY 8%): ~R$ 3.300/mês isentos (até R$ 50 mil/mês por empresa).',
        ],
      },
      {
        heading: 'O Problema da Renda Fixa Pura',
        paragraphs: [
          'A renda fixa paga mais hoje, mas o rendimento é nominal: se a inflação for 5% ao ano, parte da sua renda mensal serve apenas para repor a perda do poder de compra. Além disso, quando a Selic cair para 8% ou 6%, sua renda mensal cai junto.',
          'FIIs e ações de dividendos têm renda inicial menor, mas tendem a crescer com a inflação ao longo dos anos (aluguéis e lucros sobem).',
        ],
      },
      {
        heading: 'A Regra dos 4% Funciona no Brasil?',
        paragraphs: [
          'A famosa regra de retirar 4% do patrimônio ao ano vem do mercado americano e considera inflação de 3% e retorno real de 7%. No Brasil, com nossa volatilidade de juros, o percentual seguro é mais baixo: 3% a 3,5% ao ano.',
          'Para R$ 500 mil, isso significa uma retirada segura de R$ 1.250 a R$ 1.450 mensais, ajustados pela inflação a cada ano — sem nunca comprometer o principal.',
        ],
        highlightBox:
          'R$ 500 mil é um marco, não a linha final. Para viver de renda com custos de R$ 5.000/mês no Brasil, o patrimônio-alvo realista é entre R$ 1,5 e R$ 2 milhões.',
      },
    ],
  },
  {
    slug: 'reserva-de-emergencia-3-6-ou-12-meses',
    datePublished: '2026-11-06',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Reserva de Emergência: 3, 6 ou 12 Meses? Qual o Seu Número',
    subtitle: 'O guia para calcular quantos meses de custo de vida você realmente precisa guardar, segundo sua profissão.',
    readTime: '6 min de leitura',
    summary:
      'Servidor público precisa de menos reserva que autônomo. Veja a tabela completa por perfil, onde guardar e o que nunca fazer com a reserva.',
    relatedCalculatorSlug: 'reserva-emergencia',
    relatedCalculatorLabel: 'Calcular Minha Reserva Ideal',
    sections: [
      {
        heading: 'A Regra por Perfil de Renda',
        paragraphs: [
          'O tamanho da reserva depende de duas variáveis: estabilidade da sua renda e velocidade de recolocação profissional.',
        ],
        bullets: [
          'Servidor público concursado: 3 a 4 meses (renda garantida por lei).',
          'CLT em empresa sólida: 6 meses (conta com FGTS e seguro-desemprego).',
          'CLT em setor volátil (tecnologia, varejo): 9 meses.',
          'Autônomo, MEI ou profissional liberal: 12 meses (renda variável, sem rede de proteção).',
          'Empresário com folha de pagamento: 12 a 18 meses (custos fixos da empresa correm mesmo sem receita).',
        ],
      },
      {
        heading: 'Custo de Vida ≠ Salário',
        paragraphs: [
          'A reserva é calculada sobre o que você GASTA para sobreviver, não sobre o que ganha. Se você ganha R$ 5.000 mas gasta R$ 3.500 com o essencial (moradia, comida, saúde, transporte, contas), sua reserva de 6 meses é R$ 21.000 — não R$ 30.000.',
          'Some apenas os gastos que não podem ser cortados em uma emergência. Lazer, assinaturas e compras entram no orçamento, mas não na conta da reserva.',
        ],
      },
      {
        heading: 'Onde Guardar (e Onde Nunca Guardar)',
        paragraphs: [
          'A reserva precisa de três atributos simultâneos: liquidez diária, segurança máxima e rendimento acima da poupança. Só dois produtos atendem: Tesouro Selic e CDB de liquidez diária a 100% do CDI.',
        ],
        highlightBox:
          'Nunca coloque reserva de emergência em: ações, FIIs, criptomoedas, títulos prefixados ou IPCA+ com vencimento longo. Qualquer um desses pode estar desvalorizado no dia exato em que você precisar do dinheiro.',
      },
    ],
  },
  {
    slug: 'lci-lca-isencao-imposto-renda',
    datePublished: '2026-11-06',
    level: 'B',
    levelTitle: 'Nível B — Dominando a Renda Fixa Inteligente',
    title: 'LCI e LCA São Isentas de IR? Regras e Pegadinhas de 2026',
    subtitle: 'Tudo sobre a isenção de imposto das letras imobiliárias e do agronegócio: quem tem direito, limites e quando ela acaba.',
    readTime: '6 min de leitura',
    summary:
      'LCI e LCA continuam isentas de IR para pessoa física em 2026? Sim. Mas há regras de prazo mínimo, carência e um projeto de tributação no Congresso. Veja o quadro completo.',
    relatedCalculatorSlug: 'renda-fixa',
    relatedCalculatorLabel: 'Comparar LCI vs. CDB',
    sections: [
      {
        heading: 'A Isenção Continua Valendo em 2026',
        paragraphs: [
          'LCI e LCA continuam 100% isentas de Imposto de Renda para pessoas físicas em 2026. A isenção está na lei desde 2007 (LCI) e 2006 (LCA) e não foi alterada pela Lei 15.270/2025.',
          'Atenção: a isenção é apenas sobre o IR. O IOF regressivo continua valendo para resgates antes de 30 dias.',
        ],
      },
      {
        heading: 'A Pegadinha do Prazo Mínimo',
        paragraphs: [
          'Desde as regras do CMN de 2020, LCI e LCA têm carência mínima de 9 a 12 meses conforme o indexador. Isso significa que seu dinheiro fica PRESO nesse período — não há liquidez diária como nos CDBs.',
          'Além da carência, muitos títulos só podem ser resgatados no vencimento (2 a 4 anos). Antes disso, só com venda no mercado secundário, se houver comprador.',
        ],
      },
      {
        heading: 'Quando LCI/LCA Vale Mais que CDB',
        paragraphs: [
          'Use a fórmula da taxa equivalente: CDB Equivalente = LCI ÷ (1 − IR). Uma LCI a 95% do CDI equivale a um CDB de 118% do CDI para prazos de 1 ano.',
        ],
        bullets: [
          'Se o banco oferece LCI acima de 90% do CDI para 1 ano: provavelmente vale mais que CDB.',
          'Se a LCI paga menos de 88% do CDI: um CDB 110% do CDI pode render mais líquido.',
          'Sempre compare o valor LÍQUIDO final, não a taxa bruta.',
        ],
        highlightBox:
          'Risco: LCI/LCA são emitidas por bancos menores com frequência. Dentro do limite de R$ 250 mil por CPF/instituição, o FGC cobre. Acima disso, o risco é real.',
      },
    ],
  },
  {
    slug: 'juros-compostos-explicados-simples',
    datePublished: '2026-11-06',
    level: 'A',
    levelTitle: 'Nível A — Alicerce & Reserva de Emergência',
    title: 'Juros Compostos Explicados de Forma Simples (Com Exemplos)',
    subtitle: 'A fórmula que Einstein chamou de oitava maravilha do mundo, traduzida em números que você vê no dia a dia.',
    readTime: '6 min de leitura',
    summary:
      'Entenda por que R$ 300/mês viram R$ 1 milhão em 25 anos, qual a diferença entre juros simples e compostos, e a Regra dos 72 para saber quando seu dinheiro dobra.',
    relatedCalculatorSlug: 'juros-compostos',
    relatedCalculatorLabel: 'Ver Meus Juros Compostos',
    sections: [
      {
        heading: 'Juros Simples vs. Compostos',
        paragraphs: [
          'Juros simples: o rendimento é calculado sempre sobre o valor inicial. R$ 1.000 a 1% ao mês rende R$ 10 todo mês. Em 12 meses: R$ 1.120.',
          'Juros compostos: o rendimento de cada mês é somado ao principal e passa a render junto. R$ 1.000 a 1% ao mês rende R$ 10 no primeiro mês, R$ 10,10 no segundo, R$ 10,20 no terceiro. Em 12 meses: R$ 1.127.',
          'Parece pouco? A 10% ao ano, R$ 10.000 em juros simples viram R$ 20.000 em 10 anos. Em juros compostos, viram R$ 25.937. A diferença de R$ 5.937 vem de um único conceito: juros sobre juros.',
        ],
      },
      {
        heading: 'A Regra dos 72',
        paragraphs: [
          'Para saber em quantos anos seu dinheiro DOBRA, divida 72 pela taxa anual de juros. Com CDI a 13,65% ao ano: 72 ÷ 13,65 = 5,3 anos para dobrar.',
          'Na poupança (7,12% a.a.): 72 ÷ 7,12 = 10,1 anos para dobrar. A escolha do produto corta o tempo de crescimento pela metade.',
        ],
        highlightBox:
          'Na prática: R$ 100 mil rendendo 13,65% ao ano viram R$ 200 mil em ~5 anos, R$ 400 mil em ~11 anos e R$ 800 mil em ~16 anos. É por isso que começar cedo importa mais que começar grande.',
      },
      {
        heading: 'O Fator Tempo: A Parte que Ninguém Vê',
        paragraphs: [
          'Os juros compostos são exponenciais: crescem devagar no começo e explodem no final. Em uma simulação de R$ 300/mês a 12% ao ano, os primeiros 10 anos rendem R$ 62 mil de juros. Os segundos 10 anos rendem R$ 187 mil. Os TERCEIROS 10 anos rendem R$ 560 mil.',
          'Por isso desistir no meio é o maior erro: é exatamente nos últimos anos que a mágica acontece. Quem investe por 20 anos tem um patrimônio 5x maior que quem investe por 10 anos com o mesmo aporte mensal.',
        ],
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
