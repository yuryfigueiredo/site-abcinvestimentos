import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function promptSource(): string {
  const path = join(process.cwd(), 'docs/diario/automation-prompt.md');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const prompt = promptSource();
const normalized = prompt.replace(/\s+/gu, ' ');

function expectInOrder(...fragments: string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const index = normalized.indexOf(fragment);
    expect(index, `Missing or out-of-order prompt fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe('Prompt da automação do Diário', () => {
  it('fixa a versão exata e a operação no Mac às 19:00 BRT', () => {
    expect(normalized).toContain('diario-2026-11-23-briefing-v2');
    expect(normalized).toContain('19:00 BRT');
    expect(normalized).toContain('America/Sao_Paulo');
    expect(normalized).toContain('Mac');
    expect(normalized).toContain('provenance.promptVersion');
  });

  it('adquire o lock antes do pull, para em árvore suja e preserva arquivos alheios', () => {
    expectInOrder('automation.lock', 'trap', 'git pull --ff-only origin main', 'npm run diario:collect');
    expect(normalized).toContain('mkdir');
    expect(normalized).toContain('token');
    expect(normalized).toMatch(/árvore suja/iu);
    expect(normalized).toMatch(/interrompe(?:r)? (?:o run|a execução)/iu);
    expect(normalized).toMatch(/arquivos alheios/iu);
    expect(normalized).toMatch(/lock (?:existente|stale)/iu);
    expect(normalized).toMatch(/revisão do operador/iu);
    expect(normalized).toMatch(/nunca (?:remove|apaga) lock (?:alheio|stale) automaticamente/iu);
    expect(normalized).toMatch(/rmdir/u);
    expect(normalized).not.toMatch(/rm\s+-rf/iu);
  });

  it('coleta, recura e deixa o lock durante validação, build e commit', () => {
    expectInOrder(
      'git pull --ff-only origin main',
      'npm run diario:collect',
      'npm run diario:curate',
      'npm run diario:validate -- --publish',
      'npm test',
      'npm run build',
      'git diff --check',
      'git commit',
    );
    expect(normalized.lastIndexOf('trap')).toBeGreaterThan(normalized.indexOf('git commit'));
    expect(normalized).toMatch(/lock (?:permanece|mantido).*(?:validação|build).*(?:commit)/iu);
    expect(normalized).toMatch(/cleanup .*finally-style/iu);
  });

  it('escreve título e resumo específicos e usa apenas selection.json nas notícias', () => {
    expect(normalized).toMatch(/t[íi]tulo e resumo espec[íi]ficos/iu);
    expect(normalized).toContain('.cache/diario/<date>/selection.json');
    expect(normalized).toMatch(/leitura exclusiva de `selection\.json`/u);
    expect(normalized).toMatch(/somente os IDs selecionados/u);
    expect(normalized).toMatch(/no m[áa]ximo tr[êe]s not[íi]cias/u);
    expect(normalized).toContain('no máximo quatro acompanhamentos');
    expect(normalized).toMatch(/t[íi]tulo e resumo quiet espec[íi]ficos/iu);
  });

  it('copia briefing.json validado em material sem notícias e nunca improvisa o fallback', () => {
    expect(normalized).toContain('.cache/diario/<date>/briefing.json');
    expect(normalized).toMatch(/material sem not[íi]cias/u);
    expect(normalized).toMatch(/cop(?:ia|ie) o briefing determin[íi]stico validado do cache/iu);
    expect(normalized).toMatch(/n[ãa]o (?:reescreva|improvise)/u);
    expect(normalized).toMatch(/briefing\.json.*(?:stale|obsoleto)|(?:stale|obsoleto).*briefing\.json/iu);
  });

  it('exige schema 2, briefing apenas em material e metadados factuais separados', () => {
    expect(normalized).toContain('schemaVersion: 2');
    expect(normalized).toMatch(/`briefing` (?:é )?obrigat[óo]rio em (?:edi[çc][ãa]o )?material/u);
    expect(normalized).toMatch(/`briefing` (?:é )?proibido em (?:edi[çc][ãa]o )?morna/u);
    expect(normalized).toContain('O que aconteceu');
    expect(normalized).toContain('Por que importa');
    expect(normalized).toContain('O que observar');
    expect(normalized).toMatch(/t[íi]tulo, data e link .*metadados factuais/iu);
    expect(normalized).toMatch(/painel factual/iu);
    expect(normalized).toMatch(/prosa.*sem algarismos.*sem HTML/iu);
  });

  it('descarta fonte sem lastro e só fica morno quando a camada determinística não acha razão material', () => {
    expect(normalized).toMatch(/descarte a fonte sem lastro/u);
    expect(normalized).toMatch(/recalcule a sele[çc][ãa]o determin[íi]stica/u);
    expect(normalized).toMatch(/queda para morno somente se a camada determin[íi]stica n[ãa]o encontrar raz[ãa]o material/u);
    expect(normalized).toMatch(/nunca decide materialidade/u);
  });

  it('forbids schema drift, status rewriting and vault edits', () => {
    expect(normalized).toMatch(/nunca use `git add -A`/iu);
    expect(normalized).toMatch(/nunca edite o cofre/iu);
    expect(normalized).toContain('src/data/diario/curadoria/');
    expect(normalized).toMatch(/nunca altere `decision\.status`/iu);
    expect(normalized).toMatch(/nunca rebaixe material inv[áa]lido/iu);
    expect(normalized).toMatch(/sobrescrita do mesmo dia/iu);
    expect(normalized).toMatch(/rascunho material inv[áa]lido.*interrompe/iu);
  });

  it('proíbe corpo, paywall, paráfrase CC BY-ND, números inventados, recomendação e cripto', () => {
    expect(normalized).toMatch(/n[ãa]o cop(?:ie|ar) corpo de mat[ée]ria/iu);
    expect(normalized).toMatch(/n[ãa]o acesse paywall/iu);
    expect(normalized).toContain('The Conversation Brasil');
    expect(normalized).toContain('CC BY-ND');
    expect(normalized).toMatch(/cita[çc][ãa]o literal/iu);
    expect(normalized).toMatch(/nunca (?:use|parafraseie).*excerpt.*par[áa]frase/iu);
    expect(normalized).toMatch(/n[ãa]o invente n[úu]meros/iu);
    expect(normalized).toMatch(/n[ãa]o publique recomenda[çc][ãa]o/iu);
    expect(normalized).toMatch(/n[ãa]o inclua cripto/iu);
    expect(normalized).toMatch(/n[úu]meros editoriais.*snapshot/iu);
  });

  it('commita caminhos explícitos e não confunde validação com publicação antecipada', () => {
    expect(normalized).toMatch(/git add src\/data\/diario\/edicoes\/<date>\.json/u);
    expect(normalized).toMatch(/git commit/u);
    expect(normalized).toMatch(/git push origin main/u);
    expect(normalized).toMatch(/push.*aprova[çc][ãa]o expl[íi]cita/u);
    expectInOrder('npm run diario:validate -- --publish', 'npm test', 'npm run build', 'git diff --check', 'git add src/data/diario/edicoes/<date>.json', 'git commit', 'git push origin main');
  });
});
