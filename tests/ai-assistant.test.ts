import { describe, it, expect } from 'vitest';
import {
  getSystemPrompt,
  detectRecommendedCalculators,
  generateLocalExpertResponse,
  processConsultantQuery,
  isDeterministicScenario,
} from '../src/lib/ai-assistant';
import { simulateFixedIncomeComparison, formatBRL } from '../src/lib/finance';
import { SITE_CONFIG } from '../src/config/site';

describe('Consultor IA — Motor de Inteligência & Pré-Prompt Tier-1', () => {
  const indicators = {
    selic: 13.75,
    cdi: 13.65,
    ipca12m: 4.58,
    dolar: 5.04,
  };

  it('deve gerar o pré-prompt de comportamento especialista com taxas oficiais do BCB SGS', () => {
    const prompt = getSystemPrompt(indicators);
    expect(prompt).toContain('Consultor Sênior de Inteligência Financeira e Patrimonial');
    expect(prompt).toContain('13,75%');
    expect(prompt).toContain('13,65%');
    expect(prompt).toContain('4,58%');
    expect(prompt).toContain('R$ 5,04');
    expect(prompt).toContain('DIRETRIZES MANDATÓRIAS DE TOM E RESPOSTA');
    expect(prompt).toContain('DIAGNÓSTICO DIRETO');
  });

  it('deve processar comparativo CDB vs LCI com desconto regressivo de IR e taxas reais', () => {
    const res = generateLocalExpertResponse('Vale mais a pena CDB de 105% do CDI ou LCI de 92% isenta?', indicators);
    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('DIAGNÓSTICO DIRETO');
    expect(res.answer).toContain('105%');
    expect(res.answer).toContain('92%');
    expect(res.answer).toContain('IR de 17,5%');
    expect(res.answer).toContain('FGC');
    expect(res.recommendedCalculators.length).toBeGreaterThan(0);
    expect(res.recommendedCalculators[0].slug).toBe('renda-fixa');
  });

  it('deve calcular CDB com percentual e prazo extraídos da pergunta (matemática exata do motor)', () => {
    const res = generateLocalExpertResponse('Quanto rende R$ 10.000 em um CDB de 110% do CDI por 2 anos?', indicators);

    const expected = simulateFixedIncomeComparison({
      amount: 10000,
      months: 24,
      cdiAnnualPct: indicators.cdi,
      selicAnnualPct: indicators.selic,
      ipcaAnnualPct: indicators.ipca12m,
      cdbPctCdi: 110,
      lciLcaPctCdi: 92,
    });

    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('110%');
    expect(res.answer).toContain('24 meses');
    expect(res.answer).toContain('IR de 15,0%');
    // Números da resposta devem bater exatamente com a simulação auditada
    expect(res.answer).toContain(formatBRL(expected.winner.netFinalAmount));
    expect(res.recommendedCalculators[0].params).toBe('?valor=10000&prazo=24&cdb=110&lci=92');
  });

  it('deve rotear perguntas de simulação numérica para o motor determinístico', () => {
    expect(isDeterministicScenario('Quanto rende R$ 10.000 em CDB 110% do CDI por 2 anos?')).toBe(true);
    expect(isDeterministicScenario('Quanto preciso ter investido para receber R$ 3.000 por mês de dividendos?')).toBe(true);
    expect(isDeterministicScenario('Onde guardar minha reserva de emergência?')).toBe(true);
    expect(isDeterministicScenario('Vale mais a pena alugar ou financiar?')).toBe(true);
  });

  it('deve enviar perguntas conceituais e abertas para o LLM (não simula sem números)', () => {
    expect(isDeterministicScenario('O que é o CDI?')).toBe(false);
    expect(isDeterministicScenario('Como começar a investir com pouco dinheiro?')).toBe(false);
    expect(isDeterministicScenario('Qual a melhor ação da bolsa hoje?')).toBe(false);
  });

  it('deve calcular patrimônio necessário para meta de dividendos mensais', () => {
    const res = generateLocalExpertResponse('Quanto preciso ter investido para receber R$ 3.000 por mês de dividendos?', indicators);
    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('3.000,00');
    expect(res.answer).toContain('Fundos Imobiliários');
    expect(res.recommendedCalculators.some((c) => c.slug === 'dividendos')).toBe(true);
  });

  it('deve dimensionar reserva de emergência para CLT e Autônomo', () => {
    const res = generateLocalExpertResponse('Sou CLT com custo fixo de R$ 4.000. Onde guardar minha Reserva de Emergência?', indicators);
    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('CLT');
    expect(res.answer).toContain('6 meses');
    expect(res.answer).toContain('Tesouro Selic');
    expect(res.recommendedCalculators.some((c) => c.slug === 'reserva-emergencia')).toBe(true);
  });

  it('deve simular prazo rumo ao 1º milhão com juros compostos', () => {
    const res = generateLocalExpertResponse('Em quanto tempo chego ao 1 milhão aportando R$ 1.000 por mês?', indicators);
    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('1.000.000,00');
    expect(res.answer).toContain('Juros Compostos');
    expect(res.recommendedCalculators.some((c) => c.slug === 'juros-compostos')).toBe(true);
  });

  it('deve comparar aluguel vs financiamento no cenário de juros altos', () => {
    const res = generateLocalExpertResponse('Vale mais a pena alugar ou financiar um imóvel de 500 mil?', indicators);
    expect(res.source).toBe('abc-expert-engine');
    expect(res.answer).toContain('aluguel');
    expect(res.answer).toContain('financiamento');
    expect(res.recommendedCalculators.some((c) => c.slug === 'alugar-vs-financiar')).toBe(true);
  });

  it('deve processar consultas gerais sem erros retornando resposta robusta e acionável', async () => {
    const res = await processConsultantQuery('Como começar a investir com pouco dinheiro?');
    expect(res.answer).toBeTruthy();
    expect(res.recommendedCalculators.length).toBeGreaterThan(0);
  });
});
