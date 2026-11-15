import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// As paginas do cluster usam a camada de utilitarios escrita a mao (abc-*). Uma classe
// sem regra nao da erro em build nem em teste nenhum: a pagina sobe desformatada e o
// unico sintoma e visual — foi assim que 49 paginas ficaram em texto puro em producao.

const srcDir = 'src';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(astro|tsx|jsx)$/.test(entry)) out.push(p);
  }
  return out;
}

// `.sm\:abc-grid-cols-2` define a classe `sm:abc-grid-cols-2`; a contrabarra e do CSS, nao do nome.
function selectorsDefined(css: string): Set<string> {
  const set = new Set<string>();
  for (const m of css.matchAll(/\.((?:\\.|[\w-])+)/g)) set.add(m[1].replace(/\\/g, ''));
  return set;
}

function scopedStyles(astroSource: string): string {
  return [...astroSource.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

function classAttributes(source: string): string[] {
  const tokens: string[] = [];
  for (const m of source.matchAll(/\sclass="([^"]*)"/g)) tokens.push(...m[1].split(/\s+/));
  let idx = 0;
  while ((idx = source.indexOf('class:list={', idx)) !== -1) {
    let depth = 0;
    let end = idx + 'class:list={'.length;
    for (; end < source.length; end += 1) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const region = source.slice(idx, end);
    for (const m of region.matchAll(/['"`]([^'"`$]*)['"`]/g)) tokens.push(...m[1].split(/\s+/));
    idx = end;
  }
  return tokens.filter((t) => t.startsWith('abc-'));
}

const globalCss = readFileSync(join(srcDir, 'styles/global.css'), 'utf8');
const globalDefined = selectorsDefined(globalCss);

const offenders: string[] = [];
for (const file of walk(srcDir)) {
  const source = readFileSync(file, 'utf8');
  const own = selectorsDefined(scopedStyles(source));
  for (const token of new Set(classAttributes(source))) {
    if (!globalDefined.has(token) && !own.has(token)) offenders.push(`${file} -> .${token}`);
  }
}

describe('camada de utilitarios abc-*', () => {
  it('toda classe abc-* aplicada em uma pagina tem regra CSS', () => {
    expect(offenders, 'classes sem regra:\n' + offenders.join('\n')).toEqual([]);
  });

  it('o arquivo de estilos existe e define a camada', () => {
    expect(globalCss).toContain('.abc-card');
    expect([...globalDefined].filter((s) => s.startsWith('abc-')).length).toBeGreaterThan(60);
  });
});
