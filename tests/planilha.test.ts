import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import path from 'node:path';

const EXPECTED_TABS = [
  'Comece Aqui',
  'Configuração',
  'Lançamentos',
  'Painel do Mês',
  'Ano (12 Meses)',
  'Reserva de Emergência',
  'Metas Financeiras',
  'Rumo ao 1º Milhão',
];

const ERROR_TOKENS = ['#REF!', '#NAME?', '#VALUE!', '#DIV/0!', '#N/A', '#NUM!'];

describe('Planilha ABC (.xlsx) — Auditoria Automatizada de Qualidade', () => {
  it('valida todas as 8 abas, fórmulas, resultados e ausência de erros no Template e no Exemplo', async () => {
    const files = [
      path.resolve('produtos/Planilha-ABC-Oficial.xlsx'),
      path.resolve('produtos/planilha-abc/Planilha-ABC-Controle-Financeiro-e-1-Milhao.xlsx'),
      path.resolve('produtos/planilha-abc/Planilha-ABC-Exemplo-Preenchido.xlsx'),
    ];

    for (const filePath of files) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      const sheetNames = wb.worksheets.map((ws) => ws.name);
      expect(sheetNames).toEqual(EXPECTED_TABS);

      // Verifica ausência de erros em todas as células de todas as abas
      for (const ws of wb.worksheets) {
        ws.eachRow((row) => {
          row.eachCell((cell) => {
            const text = String(cell.value && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value ?? '');
            for (const token of ERROR_TOKENS) {
              expect(text).not.toContain(token);
            }
          });
        });
      }

      // Verifica Configuração (50% + 30% + 20% = 100%)
      const wsConfig = wb.getWorksheet('Configuração')!;
      const sumMetaCell = wsConfig.getCell('B10').value as ExcelJS.CellFormulaValue;
      expect(sumMetaCell.formula).toBe('SUM(B7:B9)');
      expect(sumMetaCell.result).toBeCloseTo(1.0, 4);

      // Verifica Painel do Mês (fórmula SUMIFS conectada a Lançamentos)
      const wsMes = wb.getWorksheet('Painel do Mês')!;
      const recMesCell = wsMes.getCell('D4').value as ExcelJS.CellFormulaValue;
      expect(recMesCell.formula).toContain('SUMIFS');
      expect(Number(recMesCell.result)).toBeGreaterThan(8000);

      // Verifica Reserva de Emergência (fórmula B5*B6 com B5 linkado à Configuração)
      const wsRes = wb.getWorksheet('Reserva de Emergência')!;
      const custoB5 = wsRes.getCell('B5').value as ExcelJS.CellFormulaValue;
      expect(custoB5.formula).toBe('Configuração!B6*Configuração!B7');
      const metaReservaCell = wsRes.getCell('B7').value as ExcelJS.CellFormulaValue;
      expect(metaReservaCell.formula).toBe('B5*B6');
      expect(metaReservaCell.result).toBe(25500);

      // Verifica Validação de Dados nos Lançamentos (1.000 linhas)
      const wsLanc = wb.getWorksheet('Lançamentos')!;
      expect(wsLanc.rowCount).toBe(1004);
      expect(wsLanc.getCell('C5').dataValidation?.type).toBe('list');
      expect(wsLanc.getCell('D5').dataValidation?.type).toBe('list');
      expect(wsLanc.getCell('F5').dataValidation?.type).toBe('list');
      expect(wsLanc.getCell('H5').dataValidation?.type).toBe('list');

      // Verifica Painel do Mês (Dropdown do mês e fórmula expandida até a linha 1004)
      expect(wsMes.getCell('B4').dataValidation?.type).toBe('list');
      expect(recMesCell.formula).toContain('1004');

      // Verifica Ano (12 Meses) (Linha 3 oculta)
      const wsAno = wb.getWorksheet('Ano (12 Meses)')!;
      expect(wsAno.getRow(3).hidden).toBe(true);

      // Verifica Rumo ao 1º Milhão (30 anos de projeção e conquista do 1º Milhão)
      const wsMilhao = wb.getWorksheet('Rumo ao 1º Milhão')!;
      const ano30Nominal = wsMilhao.getCell('D35').value as ExcelJS.CellFormulaValue;
      const ano30Status = wsMilhao.getCell('H35').value as ExcelJS.CellFormulaValue;
      expect(Number(ano30Nominal.result)).toBeGreaterThan(1000000);
      expect(ano30Status.result).toBe('1º MILHÃO ALCANÇADO!');
    }
  });
});
