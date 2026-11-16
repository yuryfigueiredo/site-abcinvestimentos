import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Independência de máquina: este repositório roda no PC Windows e no Mac (Linux Mint),
// que é o servidor oficial. Caminho absoluto de máquina, UNC, IP do PC ou comando
// só-Windows transformam o repo em coisa de uma máquina só — o mesmo sintoma do
// cluster em texto puro: não falha em build nem em teste, quebra longe de quem escreveu.

const roots = ['src', 'api', 'scripts', 'tests', 'public'];
const rootFiles = ['package.json', 'package-lock.json', 'vercel.json', 'astro.config.mjs'];
const extensions = /\.(astro|ts|tsx|js|mjs|cjs|json|md|yml|yaml|css|html|sh)$/;
// A régua não mede a si mesma: este arquivo contém os padrões e as sondas como
// texto literal e sempre derrubaria o portão.
const selfFile = 'tests/pc-independence.test.ts';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.qoder-backup') continue;
      out.push(...walk(p));
    } else if (extensions.test(entry)) out.push(p);
  }
  return out;
}

// Um padrão por dependência de máquina; cada um tem motivo documentado.
// O padrão de unidade exige UMA letra em início de palavra antes dos dois-pontos:
// é isso que separa "C:\Users" de escapes de template/regex como "Proposta:\n",
// "libsql:\/" e "Disallow:\s" — sem esse limite, o portão grita falso positivo.
const machineBoundPatterns: Array<{ reason: string; re: RegExp }> = [
  { reason: 'caminho de unidade do Windows (C:\\...)', re: /\b[A-Za-z]:\\/ },
  { reason: 'caminho UNC (\\\\servidor\\...)', re: /\\\\[A-Za-z]/ },
  { reason: 'link file:// apontando para disco local', re: /file:\/\/\/[A-Za-z]:/i },
  { reason: 'variável de ambiente só do Windows', re: /%USERPROFILE%|%APPDATA%|%SystemRoot%|%ProgramFiles%|%LOCALAPPDATA%/ },
  { reason: 'comando que não existe no Linux', re: /\brobocopy\b|\bxcopy\b|\bfindstr\b|\bpowershell\b|cmd \/c\b/ },
  { reason: 'IP do PC na rede local', re: /192\.168\.0\.7/ },
];

function findOffenders(): string[] {
  const offenders: string[] = [];
  const files = [...roots.flatMap(walk), ...rootFiles.filter((f) => statSync(f).isFile())];
  for (const file of files) {
    if (file.replace(/\\/g, '/') === selfFile) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { reason, re } of machineBoundPatterns) {
        if (re.test(line)) offenders.push(`${file}:${i + 1} ${reason}`);
      }
    });
  }
  return offenders;
}

describe('independência de máquina', () => {
  it('nenhum arquivo do repo referencia uma máquina específica', () => {
    expect(findOffenders(), 'referências amarradas a uma máquina:\n' + findOffenders().join('\n')).toEqual([]);
  });

  it('o portão enxerga dependência de máquina quando ela entra', () => {
    const probe = 'C:\\Users\\alguem\\foto.png';
    expect(machineBoundPatterns.some(({ re }) => re.test(probe))).toBe(true);
    expect(machineBoundPatterns.some(({ re }) => re.test('https://www.abcinvestimentos.com.br/'))).toBe(false);
    expect(machineBoundPatterns.some(({ re }) => re.test('192.168.0.8'))).toBe(false);
    // Falsos positivos já corrigidos: dois-pontos seguido de escape não é caminho.
    expect(machineBoundPatterns.some(({ re }) => re.test('Proposta:\\nE-mail:'))).toBe(false);
    expect(machineBoundPatterns.some(({ re }) => re.test('/^libsql:\\/\\//'))).toBe(false);
    expect(machineBoundPatterns.some(({ re }) => re.test('/^Disallow:\\s*/'))).toBe(false);
  });
});
