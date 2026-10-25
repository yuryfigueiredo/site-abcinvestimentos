import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';

const COLORS = {
  headerDark: 'FF064E3B',      // Deep Emerald Dark
  headerMid: 'FF047857',       // Emerald 700
  accentEmerald: 'FF10B981',   // Emerald 500
  accentGold: 'FFD97706',      // Gold 600
  inputFill: 'FFECFDF5',       // Soft Mint/Emerald tint for editable cells
  calcFill: 'FFF8FAFC',        // Slate 50 for calculated cells
  zebraFill: 'FFF1F5F9',       // Slate 100
  white: 'FFFFFFFF',
  borderLight: 'FFCBD5E1',
  borderEmerald: 'FF6EE7B7',
  textDark: 'FF0F172A',
  textMuted: 'FF475569',
};

const CURRENCY_FMT = '"R$" #,##0.00;("R$" #,##0.00);"-"';
const PERCENT_FMT = '0.0%';
const INT_FMT = '#,##0';

function styleHeaderRow(row, bgArgb = COLORS.headerDark) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.headerMid } },
      bottom: { style: 'medium', color: { argb: COLORS.accentEmerald } },
      left: { style: 'thin', color: { argb: COLORS.headerMid } },
      right: { style: 'thin', color: { argb: COLORS.headerMid } },
    };
    cell.protection = { locked: true };
  });
}

function styleBanner(sheet, title, subtitle, maxCol = 7) {
  sheet.mergeCells(1, 1, 1, maxCol);
  sheet.mergeCells(2, 1, 2, maxCol);

  const r1 = sheet.getRow(1);
  r1.height = 32;
  const c1 = sheet.getCell(1, 1);
  c1.value = title;
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerDark } };
  c1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: COLORS.white } };
  c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const r2 = sheet.getRow(2);
  r2.height = 22;
  const c2 = sheet.getCell(2, 1);
  c2.value = subtitle;
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerMid } };
  c2.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFD1FAE5' } };
  c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}

function markEditable(cell, numFmt = null, align = 'left') {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputFill } };
  cell.font = { name: 'Segoe UI', size: 10, bold: false, color: { argb: COLORS.textDark } };
  cell.alignment = { vertical: 'middle', horizontal: align };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.borderEmerald } },
    bottom: { style: 'thin', color: { argb: COLORS.borderEmerald } },
    left: { style: 'thin', color: { argb: COLORS.borderEmerald } },
    right: { style: 'thin', color: { argb: COLORS.borderEmerald } },
  };
  if (numFmt) cell.numFmt = numFmt;
  cell.protection = { locked: false };
}

function markCalculated(cell, numFmt = null, align = 'right', bold = false) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.calcFill } };
  cell.font = { name: 'Segoe UI', size: 10, bold, color: { argb: COLORS.textDark } };
  cell.alignment = { vertical: 'middle', horizontal: align };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.borderLight } },
    bottom: { style: 'thin', color: { argb: COLORS.borderLight } },
    left: { style: 'thin', color: { argb: COLORS.borderLight } },
    right: { style: 'thin', color: { argb: COLORS.borderLight } },
  };
  if (numFmt) cell.numFmt = numFmt;
  cell.protection = { locked: true };
}

async function createPlanilhaABC({ isDemo = false }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ABC Investimentos (abcinvestimentos.com.br)';
  wb.lastModifiedBy = 'ABC Investimentos';
  wb.created = new Date('2026-10-25T12:00:00Z');
  wb.modified = new Date('2026-10-25T12:00:00Z');
  wb.calcProperties.fullCalcOnLoad = true;

  // =========================================================================
  // ABA 1: Comece Aqui
  // =========================================================================
  const wsHome = wb.addWorksheet('Comece Aqui', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.accentEmerald } },
  });
  wsHome.columns = [
    { width: 4 },
    { width: 24 },
    { width: 52 },
    { width: 32 },
    { width: 22 },
  ];

  styleBanner(
    wsHome,
    'ABC INVESTIMENTOS — PLANILHA OFICIAL 50/30/20 & RUMO AO 1º MILHÃO',
    'Guia Rápido de Boas-Vindas • 100% Compatível com Excel, Google Sheets e LibreOffice (Zero Macros)',
    5
  );

  const steps = [
    ['PASSO 1', 'Configuração', 'Defina sua Renda Líquida Mensal Alvo, sua divisão ideal 50/30/20 e as taxas atuais (Selic, CDI e IPCA).', 'Leva 2 minutos'],
    ['PASSO 2', 'Lançamentos', 'Registre suas receitas, gastos essenciais, gastos de estilo de vida e aportes usando os menus suspensos.', 'Uso diário/semanal'],
    ['PASSO 3', 'Painel do Mês', 'Acompanhe o termômetro 50/30/20 automático: veja quanto já consumiu de cada grupo e se está na meta.', 'Automático (SUMIFS)'],
    ['PASSO 4', 'Ano (12 Meses)', 'Compare Janeiro a Dezembro lado a lado, identifique meses caros e veja sua taxa de aporte anual.', 'Automático'],
    ['PASSO 5', 'Reserva de Emergência', 'Descubra sua meta exata de segurança (3, 6 ou 12 meses) e quantos meses faltam para atingir 100%.', 'Automático + Saldo'],
    ['PASSO 6', 'Metas Financeiras', 'Planeje objetivos específicos (viagem, carro, entrada de imóvel, estudos) com cálculo do aporte mensal.', 'Até 10 metas'],
    ['PASSO 7', 'Rumo ao 1º Milhão', 'Simule sua evolução ano a ano (Patrimônio Nominal vs. Poder de Compra Real descontando IPCA).', 'Projeção 30 anos'],
  ];

  wsHome.getRow(4).values = ['', 'Etapa', 'Aba da Planilha', 'O que fazer / Como funciona', 'Tempo / Tipo'];
  styleHeaderRow(wsHome.getRow(4));

  steps.forEach((s, idx) => {
    const r = wsHome.getRow(5 + idx);
    r.height = 24;
    r.values = ['', s[0], s[1], s[2], s[3]];
    markCalculated(r.getCell(2), null, 'center', true);
    markCalculated(r.getCell(3), null, 'left', true);
    markCalculated(r.getCell(4), null, 'left', false);
    markCalculated(r.getCell(5), null, 'center', false);
  });

  // Legenda de Cores
  wsHome.getRow(14).values = ['', 'Código de Cores', 'Significado Visual', 'Regra de Edição', 'Proteção'];
  styleHeaderRow(wsHome.getRow(14), COLORS.headerMid);

  const rEdit = wsHome.getRow(15);
  rEdit.height = 24;
  rEdit.values = ['', 'Célula Verde-Clara', 'Campo de Entrada (Onde você digita seus números)', 'Pode editar livremente', 'Desbloqueada'];
  markEditable(rEdit.getCell(2), null, 'center');
  markCalculated(rEdit.getCell(3), null, 'left');
  markCalculated(rEdit.getCell(4), null, 'left');
  markCalculated(rEdit.getCell(5), null, 'center');

  const rCalc = wsHome.getRow(16);
  rCalc.height = 24;
  rCalc.values = ['', 'Célula Cinza-Clara', 'Cálculo Automático (Fórmula integrada)', 'Não apague (calcula sozinha)', 'Protegida (sem senha)'];
  markCalculated(rCalc.getCell(2), null, 'center', true);
  markCalculated(rCalc.getCell(3), null, 'left');
  markCalculated(rCalc.getCell(4), null, 'left');
  markCalculated(rCalc.getCell(5), null, 'center');

  // =========================================================================
  // ABA 2: Configuração
  // =========================================================================
  const wsConfig = wb.addWorksheet('Configuração', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.headerMid } },
  });
  wsConfig.columns = [
    { width: 34 },
    { width: 20 },
    { width: 42 },
    { width: 24 },
    { width: 24 },
  ];

  styleBanner(
    wsConfig,
    'CONFIGURAÇÃO PESSOAL & PARÂMETROS ECONÔMICOS (50 / 30 / 20)',
    'Edite apenas as células verdes-claras • Todas as outras abas utilizam estes valores automaticamente',
    5
  );

  wsConfig.getRow(4).values = ['Parâmetro Principal', 'Valor Atual', 'Explicação Prática', 'Categorias Padrão', 'Subgrupo 50/30/20'];
  styleHeaderRow(wsConfig.getRow(4));

  const configRows = [
    ['Ano Base do Orçamento', 2026, 'Ano de referência dos lançamentos', 'Salário / Pró-labore', 'Receita'],
    ['Renda Líquida Mensal Alvo (R$)', 8500, 'Sua renda líquida mensal média esperada', 'Renda Extra / Freelance', 'Receita'],
    ['Meta % — Custos Essenciais (50%)', 0.50, 'Moradia, mercado, saúde, transporte, contas básicas', 'Dividendos / Rendimentos', 'Receita'],
    ['Meta % — Estilo de Vida / Desejos (30%)', 0.30, 'Lazer, restaurantes, streaming, compras pessoais', 'Moradia (Aluguel/Condomínio)', 'Essencial (50%)'],
    ['Meta % — Aportes & Liberdade (20%)', 0.20, 'Investimentos mensais + Reserva de Emergência', 'Supermercado & Feira', 'Essencial (50%)'],
    ['Soma das Metas (%) — Deve ser 100%', { formula: 'SUM(B7:B9)', result: 1.0 }, 'Verificação automática (50% + 30% + 20% = 100%)', 'Saúde, Farmácia & Plano', 'Essencial (50%)'],
    ['Taxa Anual Esperada da Carteira (% a.a.)', 0.12, 'Rentabilidade nominal anual estimada (ex.: 12% a.a.)', 'Transporte / Combustível', 'Essencial (50%)'],
    ['Inflação Anual Estimada — IPCA (% a.a.)', 0.045, 'Inflação média para cálculo de Poder de Compra Real', 'Contas (Luz, Água, Internet)', 'Essencial (50%)'],
    ['Taxa Real Anual Acima da Inflação (% a.a.)', { formula: '((1+B11)/(1+B12))-1', result: (1.12 / 1.045) - 1 }, 'Fórmula exata de Fisher: (1+Nominal)/(1+IPCA) - 1', 'Educação & Cursos', 'Essencial (50%)'],
    ['Regra de Retirada Segura Anual (SWR %)', 0.06, 'Percentual anual para cálculo de Renda Passiva Mensal', 'Restaurantes & Delivery', 'Estilo de Vida (30%)'],
    ['Meses de Segurança — Reserva de Emergência', 6, 'Recomendado: 3 (Servidor), 6 (CLT) ou 12 (Autônomo/PJ)', 'Lazer, Viagens & Passeios', 'Estilo de Vida (30%)'],
    ['Patrimônio Inicial Já Investido (R$)', 25000, 'Quanto você já possui acumulado hoje para o 1º Milhão', 'Assinaturas & Streaming', 'Estilo de Vida (30%)'],
    ['Aporte Mensal Planejado Rumo ao Milhão (R$)', { formula: 'B6*B9', result: 1700 }, 'Calculado automaticamente (Renda Alvo × % Aportes)', 'Compras Pessoais & Vestuário', 'Estilo de Vida (30%)'],
    ['Meta do 1º Milhão (R$)', 1000000, 'Valor-alvo da aba Rumo ao 1º Milhão', 'Aporte Tesouro / Renda Fixa', 'Aportes (20%)'],
    ['Status da Configuração', { formula: 'IF(ROUND(B10,4)=1,"OK — 100% FECHADO","AJUSTAR % PARA SOMAR 100%")', result: 'OK — 100% FECHADO' }, 'Confirma se os 3 grupos somam exatamente 100%', 'Aporte Ações / FIIs / ETFs', 'Aportes (20%)'],
  ];

  configRows.forEach((item, idx) => {
    const rowIdx = 5 + idx;
    const r = wsConfig.getRow(rowIdx);
    r.height = 22;
    r.getCell(1).value = item[0];
    r.getCell(2).value = item[1];
    r.getCell(3).value = item[2];
    r.getCell(4).value = item[3];
    r.getCell(5).value = item[4];

    markCalculated(r.getCell(1), null, 'left', true);
    markCalculated(r.getCell(3), null, 'left', false);
    markCalculated(r.getCell(4), null, 'left', false);
    markCalculated(r.getCell(5), null, 'center', false);

    const isFormulaRow = typeof item[1] === 'object' && item[1] !== null && 'formula' in item[1];
    let fmt = null;
    if ([6, 16, 17, 18].includes(rowIdx)) fmt = CURRENCY_FMT;
    else if ([7, 8, 9, 10, 11, 12, 13, 14].includes(rowIdx)) fmt = PERCENT_FMT;
    else if ([5, 15].includes(rowIdx)) fmt = INT_FMT;

    if (isFormulaRow) {
      markCalculated(r.getCell(2), fmt, 'right', true);
    } else {
      markEditable(r.getCell(2), fmt, 'right');
    }
  });

  // =========================================================================
  // ABA 3: Lançamentos
  // =========================================================================
  const wsLanc = wb.addWorksheet('Lançamentos', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.accentEmerald } },
  });
  wsLanc.columns = [
    { width: 14 }, // A: Data
    { width: 12 }, // B: Mês (1-12) automático
    { width: 22 }, // C: Grupo 50/30/20
    { width: 28 }, // D: Categoria
    { width: 34 }, // E: Descrição
    { width: 18 }, // F: Meio de Pagamento
    { width: 18 }, // G: Valor (R$)
    { width: 15 }, // H: Status
  ];

  styleBanner(
    wsLanc,
    'REGISTRO DE LANÇAMENTOS MENSAIS (RECEITAS, DESPESAS E APORTES)',
    'Preencha Data, Grupo, Categoria, Descrição, Meio e Valor • A coluna Mês (B) calcula sozinha e alimenta os Painéis',
    8
  );

  wsLanc.getRow(4).values = [
    'Data',
    'Mês (Auto)',
    'Grupo 50/30/20',
    'Categoria',
    'Descrição do Lançamento',
    'Conta / Meio',
    'Valor (R$)',
    'Status',
  ];
  styleHeaderRow(wsLanc.getRow(4));

  const starterTransactions = [
    // Mês 1 (Janeiro)
    [new Date('2026-01-05T12:00:00Z'), 'Receita', 'Salário / Pró-labore', 'Salário Mensal Líquido', 'PIX / Conta', 8200, 'Pago'],
    [new Date('2026-01-07T12:00:00Z'), 'Essencial (50%)', 'Moradia (Aluguel/Condomínio)', 'Aluguel + Condomínio', 'Boleto', 2250, 'Pago'],
    [new Date('2026-01-10T12:00:00Z'), 'Essencial (50%)', 'Supermercado & Feira', 'Compras do Mês Atacadista', 'Cartão Crédito', 1180, 'Pago'],
    [new Date('2026-01-12T12:00:00Z'), 'Essencial (50%)', 'Contas (Luz, Água, Internet)', 'Energia + Fibra Óptica', 'Débito Automático', 390, 'Pago'],
    [new Date('2026-01-15T12:00:00Z'), 'Estilo de Vida (30%)', 'Restaurantes & Delivery', 'Jantar de fim de semana', 'Cartão Crédito', 460, 'Pago'],
    [new Date('2026-01-18T12:00:00Z'), 'Estilo de Vida (30%)', 'Assinaturas & Streaming', 'Streaming + Academia', 'Cartão Crédito', 240, 'Pago'],
    [new Date('2026-01-20T12:00:00Z'), 'Aportes (20%)', 'Aporte Tesouro / Renda Fixa', 'Aporte Tesouro Selic Reserva', 'Corretora', 1200, 'Pago'],
    [new Date('2026-01-22T12:00:00Z'), 'Aportes (20%)', 'Aporte Ações / FIIs / ETFs', 'Compra de FIIs e Ações Dividendos', 'Corretora', 650, 'Pago'],
  ];

  const demoExtraTransactions = [
    // Mês 1 extra
    [new Date('2026-01-25T12:00:00Z'), 'Receita', 'Dividendos / Rendimentos', 'Proventos FIIs Janeiro', 'Corretora', 320, 'Pago'],
    [new Date('2026-01-26T12:00:00Z'), 'Essencial (50%)', 'Transporte / Combustível', 'Abastecimento mensal', 'Cartão Crédito', 420, 'Pago'],
    [new Date('2026-01-28T12:00:00Z'), 'Estilo de Vida (30%)', 'Lazer, Viagens & Passeios', 'Passeio em família', 'PIX / Conta', 580, 'Pago'],
    // Mês 2 (Fevereiro)
    [new Date('2026-02-05T12:00:00Z'), 'Receita', 'Salário / Pró-labore', 'Salário Mensal Líquido', 'PIX / Conta', 8200, 'Pago'],
    [new Date('2026-02-10T12:00:00Z'), 'Receita', 'Renda Extra / Freelance', 'Consultoria TI Fim de Semana', 'PIX / Conta', 950, 'Pago'],
    [new Date('2026-02-07T12:00:00Z'), 'Essencial (50%)', 'Moradia (Aluguel/Condomínio)', 'Aluguel + Condomínio', 'Boleto', 2250, 'Pago'],
    [new Date('2026-02-11T12:00:00Z'), 'Essencial (50%)', 'Supermercado & Feira', 'Supermercado Mensal', 'Cartão Crédito', 1220, 'Pago'],
    [new Date('2026-02-14T12:00:00Z'), 'Essencial (50%)', 'Saúde, Farmácia & Plano', 'Plano de Saúde + Farmácia', 'Boleto', 610, 'Pago'],
    [new Date('2026-02-18T12:00:00Z'), 'Estilo de Vida (30%)', 'Restaurantes & Delivery', 'Saídas e iFood Fevereiro', 'Cartão Crédito', 510, 'Pago'],
    [new Date('2026-02-20T12:00:00Z'), 'Aportes (20%)', 'Aporte Tesouro / Renda Fixa', 'Aporte CDB 102% CDI', 'Corretora', 1300, 'Pago'],
    [new Date('2026-02-22T12:00:00Z'), 'Aportes (20%)', 'Aporte Ações / FIIs / ETFs', 'Aporte Carteira Previdenciária', 'Corretora', 800, 'Pago'],
    // Mês 3 (Março)
    [new Date('2026-03-05T12:00:00Z'), 'Receita', 'Salário / Pró-labore', 'Salário Mensal Líquido', 'PIX / Conta', 8200, 'Pago'],
    [new Date('2026-03-08T12:00:00Z'), 'Essencial (50%)', 'Moradia (Aluguel/Condomínio)', 'Aluguel + Condomínio', 'Boleto', 2250, 'Pago'],
    [new Date('2026-03-12T12:00:00Z'), 'Essencial (50%)', 'Supermercado & Feira', 'Supermercado & Feira', 'Cartão Crédito', 1190, 'Pago'],
    [new Date('2026-03-16T12:00:00Z'), 'Estilo de Vida (30%)', 'Compras Pessoais & Vestuário', 'Roupas e Presente', 'Cartão Crédito', 490, 'Pago'],
    [new Date('2026-03-20T12:00:00Z'), 'Aportes (20%)', 'Aporte Tesouro / Renda Fixa', 'Aporte Tesouro IPCA+', 'Corretora', 1250, 'Pago'],
    [new Date('2026-03-25T12:00:00Z'), 'Aportes (20%)', 'Aporte Ações / FIIs / ETFs', 'Reinvestimento + Aporte FIIs', 'Corretora', 750, 'Pago'],
  ];

  const rowsToPopulate = isDemo
    ? [...starterTransactions, ...demoExtraTransactions]
    : starterTransactions;

  const totalLancRows = 120;
  for (let i = 0; i < totalLancRows; i++) {
    const rowIdx = 5 + i;
    const r = wsLanc.getRow(rowIdx);
    r.height = 20;
    const item = rowsToPopulate[i];

    if (item) {
      const dt = item[0];
      const monthNum = dt.getUTCMonth() + 1;
      r.getCell(1).value = dt;
      r.getCell(2).value = { formula: `IF(ISNUMBER(A${rowIdx}),MONTH(A${rowIdx}),"")`, result: monthNum };
      r.getCell(3).value = item[1];
      r.getCell(4).value = item[2];
      r.getCell(5).value = item[3];
      r.getCell(6).value = item[4];
      r.getCell(7).value = item[5];
      r.getCell(8).value = item[6];
    } else {
      r.getCell(1).value = null;
      r.getCell(2).value = { formula: `IF(ISNUMBER(A${rowIdx}),MONTH(A${rowIdx}),"")`, result: '' };
      r.getCell(3).value = null;
      r.getCell(4).value = null;
      r.getCell(5).value = null;
      r.getCell(6).value = null;
      r.getCell(7).value = null;
      r.getCell(8).value = null;
    }

    markEditable(r.getCell(1), 'dd/mm/yyyy', 'center');
    markCalculated(r.getCell(2), INT_FMT, 'center', true);
    markEditable(r.getCell(3), null, 'left');
    markEditable(r.getCell(4), null, 'left');
    markEditable(r.getCell(5), null, 'left');
    markEditable(r.getCell(6), null, 'center');
    markEditable(r.getCell(7), CURRENCY_FMT, 'right');
    markEditable(r.getCell(8), null, 'center');

    // Data validations for Grupo and Status
    r.getCell(3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Receita,Essencial (50%),Estilo de Vida (30%),Aportes (20%)"'],
    };
    r.getCell(8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Pago,Pendente"'],
    };
  }

  // Helper to compute exact sum from rowsToPopulate for pre-populated formula results
  const sumByMonthAndGroup = (m, grp) =>
    rowsToPopulate.reduce((acc, row) => {
      const rm = row[0].getUTCMonth() + 1;
      return rm === m && row[1] === grp ? acc + row[5] : acc;
    }, 0);

  // =========================================================================
  // ABA 4: Painel do Mês (Dashboard 50/30/20)
  // =========================================================================
  const wsMes = wb.addWorksheet('Painel do Mês', {
    views: [{ state: 'frozen', ySplit: 5 }],
    properties: { tabColor: { argb: COLORS.accentGold } },
  });
  wsMes.columns = [
    { width: 32 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 26 },
  ];

  styleBanner(
    wsMes,
    'PAINEL EXECUTIVO DO MÊS — TERMÔMETRO 50 / 30 / 20',
    'Selecione o número do mês (1 a 12) na célula B4 • Todos os indicadores abaixo são calculados automaticamente',
    6
  );

  const rSel = wsMes.getRow(4);
  rSel.height = 24;
  rSel.getCell(1).value = 'Mês Selecionado para Análise (1 a 12):';
  rSel.getCell(2).value = 1;
  rSel.getCell(3).value = 'Receita Realizada no Mês:';
  const janRec = sumByMonthAndGroup(1, 'Receita');
  rSel.getCell(4).value = {
    formula: 'SUMIFS(Lançamentos!G$5:G$124,Lançamentos!B$5:B$124,B4,Lançamentos!C$5:C$124,"Receita")',
    result: janRec,
  };
  rSel.getCell(5).value = 'Saldo Livre em Caixa:';
  const janEss = sumByMonthAndGroup(1, 'Essencial (50%)');
  const janEst = sumByMonthAndGroup(1, 'Estilo de Vida (30%)');
  const janApo = sumByMonthAndGroup(1, 'Aportes (20%)');
  rSel.getCell(6).value = {
    formula: 'D4-SUM(C7:C9)',
    result: janRec - (janEss + janEst + janApo),
  };

  markCalculated(rSel.getCell(1), null, 'left', true);
  markEditable(rSel.getCell(2), INT_FMT, 'center');
  markCalculated(rSel.getCell(3), null, 'right', true);
  markCalculated(rSel.getCell(4), CURRENCY_FMT, 'right', true);
  markCalculated(rSel.getCell(5), null, 'right', true);
  markCalculated(rSel.getCell(6), CURRENCY_FMT, 'right', true);

  wsMes.getRow(6).values = [
    'Bloco do Método 50/30/20',
    'Meta Orçada (R$)',
    'Valor Realizado (R$)',
    '% da Receita Real',
    'Diferença (R$)',
    'Diagnóstico Automático',
  ];
  styleHeaderRow(wsMes.getRow(6));

  const grupos503020 = [
    {
      label: 'Essencial (50%)',
      configPctCell: 'Configuração!B7',
      pctVal: 0.5,
      realVal: janEss,
      isAporte: false,
    },
    {
      label: 'Estilo de Vida (30%)',
      configPctCell: 'Configuração!B8',
      pctVal: 0.3,
      realVal: janEst,
      isAporte: false,
    },
    {
      label: 'Aportes (20%)',
      configPctCell: 'Configuração!B9',
      pctVal: 0.2,
      realVal: janApo,
      isAporte: true,
    },
  ];

  grupos503020.forEach((g, idx) => {
    const rowIdx = 7 + idx;
    const r = wsMes.getRow(rowIdx);
    r.height = 24;
    const orcado = janRec * g.pctVal;
    const pctReal = janRec > 0 ? g.realVal / janRec : 0;
    const diff = orcado - g.realVal;
    const diag = g.isAporte
      ? g.realVal >= orcado
        ? 'META DE APORTE BATIDA!'
        : 'Aporte abaixo da meta'
      : g.realVal <= orcado
        ? 'DENTRO DO ORÇAMENTO'
        : 'ACIMA DO LIMITE';

    r.getCell(1).value = g.label;
    r.getCell(2).value = { formula: `MAX($D$4,Configuração!B6)*${g.configPctCell}`, result: Math.max(janRec, 8500) * g.pctVal };
    r.getCell(3).value = {
      formula: `SUMIFS(Lançamentos!G$5:G$124,Lançamentos!B$5:B$124,$B$4,Lançamentos!C$5:C$124,A${rowIdx})`,
      result: g.realVal,
    };
    r.getCell(4).value = { formula: `IF($D$4>0,C${rowIdx}/$D$4,0)`, result: pctReal };
    r.getCell(5).value = { formula: `B${rowIdx}-C${rowIdx}`, result: Math.max(janRec, 8500) * g.pctVal - g.realVal };
    r.getCell(6).value = {
      formula: g.isAporte
        ? `IF(C${rowIdx}>=B${rowIdx},"META DE APORTE BATIDA!","Aporte abaixo da meta")`
        : `IF(C${rowIdx}<=B${rowIdx},"DENTRO DO ORÇAMENTO","ACIMA DO LIMITE")`,
      result: diag,
    };

    markCalculated(r.getCell(1), null, 'left', true);
    markCalculated(r.getCell(2), CURRENCY_FMT, 'right', false);
    markCalculated(r.getCell(3), CURRENCY_FMT, 'right', true);
    markCalculated(r.getCell(4), PERCENT_FMT, 'right', false);
    markCalculated(r.getCell(5), CURRENCY_FMT, 'right', false);
    markCalculated(r.getCell(6), null, 'center', true);
  });

  // Linha de Total do Painel do Mês
  const rTotMes = wsMes.getRow(10);
  rTotMes.height = 24;
  rTotMes.getCell(1).value = 'TOTAL ALOCADO NO MÊS';
  rTotMes.getCell(2).value = { formula: 'SUM(B7:B9)', result: Math.max(janRec, 8500) };
  rTotMes.getCell(3).value = { formula: 'SUM(C7:C9)', result: janEss + janEst + janApo };
  rTotMes.getCell(4).value = { formula: 'SUM(D7:D9)', result: janRec > 0 ? (janEss + janEst + janApo) / janRec : 0 };
  rTotMes.getCell(5).value = { formula: 'SUM(E7:E9)', result: Math.max(janRec, 8500) - (janEss + janEst + janApo) };
  rTotMes.getCell(6).value = { formula: 'IF(D4>=C10,"SUPERÁVIT NO MÊS","DÉFICIT NO MÊS")', result: 'SUPERÁVIT NO MÊS' };
  for (let c = 1; c <= 6; c++) {
    markCalculated(rTotMes.getCell(c), c === 4 ? PERCENT_FMT : c >= 2 && c <= 5 ? CURRENCY_FMT : null, c === 1 ? 'left' : c === 6 ? 'center' : 'right', true);
  }

  // =========================================================================
  // ABA 5: Ano (12 Meses)
  // =========================================================================
  const wsAno = wb.addWorksheet('Ano (12 Meses)', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.headerMid } },
  });

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  wsAno.columns = [
    { width: 28 },
    ...monthNames.map(() => ({ width: 14 })),
    { width: 16 },
    { width: 16 },
  ];

  styleBanner(
    wsAno,
    'VISÃO CONSOLIDADA ANUAL (JANEIRO A DEZEMBRO) + MÉDIA E ACUMULADO',
    'Todos os meses são preenchidos automaticamente a partir da aba Lançamentos',
    15
  );

  // Linha 3 oculta/auxiliar com o número do mês (1 a 12) para fórmulas SUMIFS limpas
  const rMonthNums = wsAno.getRow(3);
  rMonthNums.height = 18;
  rMonthNums.getCell(1).value = 'Nº do Mês';
  markCalculated(rMonthNums.getCell(1), null, 'left', true);
  for (let m = 1; m <= 12; m++) {
    const cell = rMonthNums.getCell(1 + m);
    cell.value = m;
    markCalculated(cell, INT_FMT, 'center', false);
  }
  rMonthNums.getCell(14).value = 'Acumulado';
  rMonthNums.getCell(15).value = 'Média';
  markCalculated(rMonthNums.getCell(14), null, 'center', true);
  markCalculated(rMonthNums.getCell(15), null, 'center', true);

  const rAnoHeader = wsAno.getRow(4);
  rAnoHeader.values = ['Grupo / Indicador', ...monthNames, 'Total Ano', 'Média Mensal'];
  styleHeaderRow(rAnoHeader);

  const anoGroups = ['Receita', 'Essencial (50%)', 'Estilo de Vida (30%)', 'Aportes (20%)'];
  anoGroups.forEach((grp, gIdx) => {
    const rowIdx = 5 + gIdx;
    const r = wsAno.getRow(rowIdx);
    r.height = 22;
    r.getCell(1).value = grp;
    markCalculated(r.getCell(1), null, 'left', true);

    let annualTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const colIdx = 1 + m;
      const colLetter = wsAno.getColumn(colIdx).letter;
      const val = sumByMonthAndGroup(m, grp);
      annualTotal += val;
      const cell = r.getCell(colIdx);
      cell.value = {
        formula: `SUMIFS(Lançamentos!$G$5:$G$124,Lançamentos!$B$5:$B$124,${colLetter}$3,Lançamentos!$C$5:$C$124,$A${rowIdx})`,
        result: val,
      };
      markCalculated(cell, CURRENCY_FMT, 'right', false);
    }

    const cTot = r.getCell(14);
    cTot.value = { formula: `SUM(B${rowIdx}:M${rowIdx})`, result: annualTotal };
    markCalculated(cTot, CURRENCY_FMT, 'right', true);

    const cAvg = r.getCell(15);
    cAvg.value = { formula: `AVERAGE(B${rowIdx}:M${rowIdx})`, result: annualTotal / 12 };
    markCalculated(cAvg, CURRENCY_FMT, 'right', false);
  });

  // Linha 9: Saldo Livre de Caixa no Mês
  const rSaldoAno = wsAno.getRow(9);
  rSaldoAno.height = 22;
  rSaldoAno.getCell(1).value = 'Saldo Livre de Caixa (R$)';
  markCalculated(rSaldoAno.getCell(1), null, 'left', true);

  // Linha 10: Taxa de Aporte / Investimento (%)
  const rTaxaAno = wsAno.getRow(10);
  rTaxaAno.height = 22;
  rTaxaAno.getCell(1).value = 'Taxa de Aporte Mensal (%)';
  markCalculated(rTaxaAno.getCell(1), null, 'left', true);

  let totalSaldoAnual = 0;
  for (let m = 1; m <= 12; m++) {
    const colIdx = 1 + m;
    const colLetter = wsAno.getColumn(colIdx).letter;
    const rec = sumByMonthAndGroup(m, 'Receita');
    const ess = sumByMonthAndGroup(m, 'Essencial (50%)');
    const est = sumByMonthAndGroup(m, 'Estilo de Vida (30%)');
    const apo = sumByMonthAndGroup(m, 'Aportes (20%)');
    const saldo = rec - ess - est - apo;
    totalSaldoAnual += saldo;

    const cSaldo = rSaldoAno.getCell(colIdx);
    cSaldo.value = { formula: `${colLetter}5-${colLetter}6-${colLetter}7-${colLetter}8`, result: saldo };
    markCalculated(cSaldo, CURRENCY_FMT, 'right', true);

    const cTaxa = rTaxaAno.getCell(colIdx);
    cTaxa.value = { formula: `IF(${colLetter}5>0,${colLetter}8/${colLetter}5,0)`, result: rec > 0 ? apo / rec : 0 };
    markCalculated(cTaxa, PERCENT_FMT, 'right', true);
  }

  rSaldoAno.getCell(14).value = { formula: 'SUM(B9:M9)', result: totalSaldoAnual };
  markCalculated(rSaldoAno.getCell(14), CURRENCY_FMT, 'right', true);
  rSaldoAno.getCell(15).value = { formula: 'AVERAGE(B9:M9)', result: totalSaldoAnual / 12 };
  markCalculated(rSaldoAno.getCell(15), CURRENCY_FMT, 'right', false);

  const totalRecAnual = wsAno.getRow(5).getCell(14).value.result;
  const totalApoAnual = wsAno.getRow(8).getCell(14).value.result;
  rTaxaAno.getCell(14).value = { formula: 'IF(N5>0,N8/N5,0)', result: totalRecAnual > 0 ? totalApoAnual / totalRecAnual : 0 };
  markCalculated(rTaxaAno.getCell(14), PERCENT_FMT, 'right', true);
  rTaxaAno.getCell(15).value = { formula: 'IF(O5>0,O8/O5,0)', result: totalRecAnual > 0 ? totalApoAnual / totalRecAnual : 0 };
  markCalculated(rTaxaAno.getCell(15), PERCENT_FMT, 'right', false);

  // =========================================================================
  // ABA 6: Reserva de Emergência
  // =========================================================================
  const wsRes = wb.addWorksheet('Reserva de Emergência', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.accentEmerald } },
  });
  wsRes.columns = [
    { width: 38 },
    { width: 22 },
    { width: 44 },
  ];

  styleBanner(
    wsRes,
    'CALCULADORA & RASTREADOR DA RESERVA DE EMERGÊNCIA',
    'Dimensione seu colchão de segurança em Tesouro Selic ou CDB 100% CDI com liquidez diária',
    3
  );

  wsRes.getRow(4).values = ['Indicador da Reserva de Emergência', 'Valor / Resultado', 'Orientação Técnica'];
  styleHeaderRow(wsRes.getRow(4));

  const custoEssencialPadrao = 4250;
  const mesesSeguranca = 6;
  const metaReserva = custoEssencialPadrao * mesesSeguranca;
  const saldoReservaAtual = isDemo ? 18500 : 12000;
  const faltaReserva = Math.max(0, metaReserva - saldoReservaAtual);
  const aporteReserva = 1000;
  const mesesFaltantes = Math.ceil(faltaReserva / aporteReserva);

  const resRows = [
    ['Seu Custo Mensal Essencial Médio (R$)', custoEssencialPadrao, 'Soma de moradia, alimentação, saúde, transporte e contas fixas', false, CURRENCY_FMT],
    ['Meses de Segurança Recomendados', { formula: 'Configuração!B15', result: mesesSeguranca }, 'Puxado da aba Configuração (3 = Servidor, 6 = CLT, 12 = Autônomo/PJ)', true, INT_FMT],
    ['META TOTAL DA SUA RESERVA (R$)', { formula: 'B5*B6', result: metaReserva }, 'Valor total que traz paz de espírito para sua família', true, CURRENCY_FMT],
    ['Saldo Atual Já Guardado na Reserva (R$)', saldoReservaAtual, 'Some apenas aplicações de Liquidez Diária (Tesouro Selic / CDB 100% CDI)', false, CURRENCY_FMT],
    ['Percentual Concluído da Reserva (%)', { formula: 'IF(B7>0,MIN(1,B8/B7),0)', result: saldoReservaAtual / metaReserva }, 'Progresso rumo a 100% da sua Reserva de Emergência', true, PERCENT_FMT],
    ['Valor que Ainda Falta Acumular (R$)', { formula: 'MAX(0,B7-B8)', result: faltaReserva }, 'Diferença entre a Meta Total e o Saldo Atual', true, CURRENCY_FMT],
    ['Aporte Mensal Dedicado à Reserva (R$)', aporteReserva, 'Quanto você vai destinar por mês até completar a Reserva', false, CURRENCY_FMT],
    ['Meses Estimados para Concluir 100%', { formula: 'IF(B10<=0,0,IF(B11>0,B10/B11,0))', result: faltaReserva / aporteReserva }, 'Tempo aproximado (sem contar os juros compostos do Tesouro Selic a seu favor)', true, '0.0'],
    ['Status da Reserva de Segurança', { formula: 'IF(B8>=B7,"RESERVA 100% COMPLETA!","EM CONSTRUÇÃO — PRIORIDADE Nº 1")', result: 'EM CONSTRUÇÃO — PRIORIDADE Nº 1' }, 'Complete a Reserva antes de investir em renda variável', true, null],
  ];

  resRows.forEach((item, idx) => {
    const rowIdx = 5 + idx;
    const r = wsRes.getRow(rowIdx);
    r.height = 24;
    r.getCell(1).value = item[0];
    r.getCell(2).value = item[1];
    r.getCell(3).value = item[2];

    markCalculated(r.getCell(1), null, 'left', true);
    if (item[3]) {
      markCalculated(r.getCell(2), item[4], item[4] ? 'right' : 'center', true);
    } else {
      markEditable(r.getCell(2), item[4], 'right');
    }
    markCalculated(r.getCell(3), null, 'left', false);
  });

  // =========================================================================
  // ABA 7: Metas Financeiras
  // =========================================================================
  const wsMetas = wb.addWorksheet('Metas Financeiras', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.accentGold } },
  });
  wsMetas.columns = [
    { width: 30 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 16 },
    { width: 20 },
    { width: 16 },
    { width: 22 },
  ];

  styleBanner(
    wsMetas,
    'PLANEJADOR DE METAS FINANCEIRAS (CURTO E MÉDIO PRAZO)',
    'Planeje viagens, troca de veículo, entrada de imóvel ou equipamentos sem entrar em financiamentos caros',
    8
  );

  wsMetas.getRow(4).values = [
    'Nome do Objetivo / Meta',
    'Prioridade',
    'Valor-Alvo (R$)',
    'Valor Já Guardado (R$)',
    'Prazo (Meses)',
    'Falta Acumular (R$)',
    '% Concluído',
    'Aporte Mensal Necessário',
  ];
  styleHeaderRow(wsMetas.getRow(4));

  const sampleGoals = [
    ['Viagem de Férias em Família', 'Alta', 12000, 4500, 10],
    ['Troca de Notebook / Setup Trabalho', 'Média', 7500, 3000, 6],
    ['Entrada Apartamento / Amortização', 'Alta', 60000, 18000, 24],
    ['Fundo Anual IPVA + IPTU + Seguros', 'Alta', 6000, 2400, 8],
    ['Pós-Graduação / Certificação', 'Média', 9000, 1500, 12],
  ];

  for (let i = 0; i < 10; i++) {
    const rowIdx = 5 + i;
    const r = wsMetas.getRow(rowIdx);
    r.height = 22;
    const g = sampleGoals[i];

    if (g) {
      const falta = Math.max(0, g[2] - g[3]);
      const pct = g[2] > 0 ? g[3] / g[2] : 0;
      const aporteMes = g[4] > 0 ? falta / g[4] : 0;

      r.getCell(1).value = g[0];
      r.getCell(2).value = g[1];
      r.getCell(3).value = g[2];
      r.getCell(4).value = g[3];
      r.getCell(5).value = g[4];
      r.getCell(6).value = { formula: `MAX(0,C${rowIdx}-D${rowIdx})`, result: falta };
      r.getCell(7).value = { formula: `IF(C${rowIdx}>0,D${rowIdx}/C${rowIdx},0)`, result: pct };
      r.getCell(8).value = { formula: `IF(E${rowIdx}>0,F${rowIdx}/E${rowIdx},0)`, result: aporteMes };
    } else {
      r.getCell(1).value = '';
      r.getCell(2).value = '';
      r.getCell(3).value = 0;
      r.getCell(4).value = 0;
      r.getCell(5).value = 12;
      r.getCell(6).value = { formula: `MAX(0,C${rowIdx}-D${rowIdx})`, result: 0 };
      r.getCell(7).value = { formula: `IF(C${rowIdx}>0,D${rowIdx}/C${rowIdx},0)`, result: 0 };
      r.getCell(8).value = { formula: `IF(E${rowIdx}>0,F${rowIdx}/E${rowIdx},0)`, result: 0 };
    }

    markEditable(r.getCell(1), null, 'left');
    markEditable(r.getCell(2), null, 'center');
    markEditable(r.getCell(3), CURRENCY_FMT, 'right');
    markEditable(r.getCell(4), CURRENCY_FMT, 'right');
    markEditable(r.getCell(5), INT_FMT, 'center');
    markCalculated(r.getCell(6), CURRENCY_FMT, 'right', false);
    markCalculated(r.getCell(7), PERCENT_FMT, 'right', true);
    markCalculated(r.getCell(8), CURRENCY_FMT, 'right', true);
  }

  // =========================================================================
  // ABA 8: Rumo ao 1º Milhão (30 Anos)
  // =========================================================================
  const wsMilhao = wb.addWorksheet('Rumo ao 1º Milhão', {
    views: [{ state: 'frozen', ySplit: 5 }],
    properties: { tabColor: { argb: COLORS.accentEmerald } },
  });
  wsMilhao.columns = [
    { width: 10 }, // A: Ano #
    { width: 14 }, // B: Ano Calendário
    { width: 22 }, // C: Total Investido do Bolso
    { width: 24 }, // D: Patrimônio Nominal (Bruto)
    { width: 22 }, // E: Só Juros Compostos Ganhos
    { width: 24 }, // F: Patrimônio Real (Descontando IPCA)
    { width: 24 }, // G: Renda Passiva Mensal Real
    { width: 24 }, // H: Status 1º Milhão
  ];

  styleBanner(
    wsMilhao,
    'SIMULADOR DE INDEPENDÊNCIA FINANCEIRA — RUMO AO 1º MILHÃO (30 ANOS)',
    'Projeção anual baseada no Patrimônio Inicial, Aporte Mensal e Taxas definidas na aba Configuração',
    8
  );

  // Linha 4: Resumo das Premissas
  const rPrem = wsMilhao.getRow(4);
  rPrem.height = 22;
  rPrem.getCell(1).value = 'Inicial:';
  rPrem.getCell(2).value = { formula: 'Configuração!B16', result: 25000 };
  rPrem.getCell(3).value = 'Aporte Mensal:';
  rPrem.getCell(4).value = { formula: 'Configuração!B17', result: 1700 };
  rPrem.getCell(5).value = 'Taxa Nominal a.a.:';
  rPrem.getCell(6).value = { formula: 'Configuração!B11', result: 0.12 };
  rPrem.getCell(7).value = 'Taxa Real (pós-IPCA):';
  rPrem.getCell(8).value = { formula: 'Configuração!B13', result: (1.12 / 1.045) - 1 };

  markCalculated(rPrem.getCell(1), null, 'right', true);
  markCalculated(rPrem.getCell(2), CURRENCY_FMT, 'right', true);
  markCalculated(rPrem.getCell(3), null, 'right', true);
  markCalculated(rPrem.getCell(4), CURRENCY_FMT, 'right', true);
  markCalculated(rPrem.getCell(5), null, 'right', true);
  markCalculated(rPrem.getCell(6), PERCENT_FMT, 'right', true);
  markCalculated(rPrem.getCell(7), null, 'right', true);
  markCalculated(rPrem.getCell(8), PERCENT_FMT, 'right', true);

  wsMilhao.getRow(5).values = [
    'Ano #',
    'Ano Civil',
    'Total Investido do Bolso',
    'Patrimônio Nominal (R$)',
    'Juros Acumulados (R$)',
    'Patrimônio Real (Pós-IPCA)',
    'Renda Passiva Mensal',
    'Status da Meta (R$ 1M)',
  ];
  styleHeaderRow(wsMilhao.getRow(5));

  const initCapital = 25000;
  const monthlyContrib = 1700;
  const annualContribution = monthlyContrib * 12;
  const nominalRate = 0.12;
  const realRate = (1 + nominalRate) / (1 + 0.045) - 1;
  const swrRate = 0.06;

  let prevNominal = initCapital;
  let prevReal = initCapital;

  for (let yr = 1; yr <= 30; yr++) {
    const rowIdx = 5 + yr;
    const r = wsMilhao.getRow(rowIdx);
    r.height = 20;

    const totalInvested = initCapital + annualContribution * yr;
    const currentNominal = prevNominal * (1 + nominalRate) + annualContribution;
    const totalInterest = currentNominal - totalInvested;
    const currentReal = prevReal * (1 + realRate) + annualContribution;
    const passiveMonthly = (currentReal * swrRate) / 12;
    const statusText = currentNominal >= 1000000 ? '1º MILHÃO ALCANÇADO!' : 'Acumulando...';

    r.getCell(1).value = yr;
    r.getCell(2).value = { formula: `Configuração!$B$5+A${rowIdx}`, result: 2026 + yr };
    r.getCell(3).value = {
      formula: `Configuração!$B$16+(Configuração!$B$17*12*A${rowIdx})`,
      result: totalInvested,
    };

    if (yr === 1) {
      r.getCell(4).value = {
        formula: `Configuração!$B$16*(1+Configuração!$B$11)+(Configuração!$B$17*12)`,
        result: currentNominal,
      };
      r.getCell(6).value = {
        formula: `Configuração!$B$16*(1+Configuração!$B$13)+(Configuração!$B$17*12)`,
        result: currentReal,
      };
    } else {
      const prevRow = rowIdx - 1;
      r.getCell(4).value = {
        formula: `D${prevRow}*(1+Configuração!$B$11)+(Configuração!$B$17*12)`,
        result: currentNominal,
      };
      r.getCell(6).value = {
        formula: `F${prevRow}*(1+Configuração!$B$13)+(Configuração!$B$17*12)`,
        result: currentReal,
      };
    }

    r.getCell(5).value = { formula: `D${rowIdx}-C${rowIdx}`, result: totalInterest };
    r.getCell(7).value = { formula: `(F${rowIdx}*Configuração!$B$14)/12`, result: passiveMonthly };
    r.getCell(8).value = {
      formula: `IF(D${rowIdx}>=Configuração!$B$18,"1º MILHÃO ALCANÇADO!","Acumulando...")`,
      result: statusText,
    };

    markCalculated(r.getCell(1), INT_FMT, 'center', true);
    markCalculated(r.getCell(2), INT_FMT, 'center', false);
    markCalculated(r.getCell(3), CURRENCY_FMT, 'right', false);
    markCalculated(r.getCell(4), CURRENCY_FMT, 'right', true);
    markCalculated(r.getCell(5), CURRENCY_FMT, 'right', false);
    markCalculated(r.getCell(6), CURRENCY_FMT, 'right', true);
    markCalculated(r.getCell(7), CURRENCY_FMT, 'right', true);
    markCalculated(r.getCell(8), null, 'center', currentNominal >= 1000000);

    prevNominal = currentNominal;
    prevReal = currentReal;
  }

  // Protect all sheets without password so formulas aren't accidentally erased
  for (const sheet of wb.worksheets) {
    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatColumns: true,
      formatRows: true,
      autoFilter: true,
    });
  }

  return wb;
}

export async function generateWorkbooks() {
  const outDir = path.resolve('produtos/planilha-abc');
  const publicDir = path.resolve('public/downloads');
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  const cleanWb = await createPlanilhaABC({ isDemo: false });
  const cleanPath = path.join(outDir, 'Planilha-ABC-Controle-Financeiro-e-1-Milhao.xlsx');
  await cleanWb.xlsx.writeFile(cleanPath);

  const demoWb = await createPlanilhaABC({ isDemo: true });
  const demoPath = path.join(outDir, 'Planilha-ABC-Exemplo-Preenchido.xlsx');
  await demoWb.xlsx.writeFile(demoPath);

  const publicDemoPath = path.join(publicDir, 'Planilha-ABC-Exemplo-Preenchido.xlsx');
  await fs.copyFile(demoPath, publicDemoPath);

  return { cleanPath, demoPath, publicDemoPath };
}

// Execute when run directly via node
if (import.meta.url.endsWith('build-planilha-abc.mjs')) {
  generateWorkbooks()
    .then(({ cleanPath, demoPath, publicDemoPath }) => {
      console.log('Planilhas geradas com sucesso:');
      console.log(' - Template Oficial:', cleanPath);
      console.log(' - Exemplo Preenchido:', demoPath);
      console.log(' - Demo Público:', publicDemoPath);
    })
    .catch((err) => {
      console.error('Erro ao gerar planilhas:', err);
      process.exit(1);
    });
}
