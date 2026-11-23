import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { verifyGovernance } from './governance';
import { parseEdition } from './schema';
import type { Edition } from './types';

const MAX_EDITION_BYTES = 5_000_000;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function byNewestDate(left: Edition, right: Edition): number {
  return right.date.localeCompare(left.date);
}

export function readEditions(root: string = process.cwd()): Edition[] {
  verifyGovernance(root);
  const directory = join(resolve(root), 'src', 'data', 'diario', 'edicoes');
  let files: string[];
  try {
    files = readdirSync(directory).filter((file) => file.endsWith('.json')).sort();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Nenhuma edição encontrada em ${directory}; a seed do Diário está ausente.`);
    }
    throw error;
  }
  if (files.length === 0) {
    throw new Error(`Nenhuma edição encontrada em ${directory}; a seed do Diário está ausente.`);
  }

  return files.map((file) => {
    const path = join(directory, file);
    const bytes = readFileSync(path);
    if (bytes.length > MAX_EDITION_BYTES) throw new Error(`${file} exceeds the maximum edition size`);
    let value: unknown;
    try {
      value = JSON.parse(utf8Decoder.decode(bytes));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(`${file} must contain valid JSON`);
      throw new Error(`${file} must contain valid UTF-8`);
    }
    try {
      const edition = parseEdition(value);
      if (edition.date !== file.slice(0, -'.json'.length)) {
        throw new Error(`a data declarada ${edition.date} não corresponde ao nome do arquivo`);
      }
      return edition;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'edição inválida';
      throw new Error(`Edição inválida em ${file}: ${message}`);
    }
  }).sort(byNewestDate);
}

export function latestEdition(editions: Edition[]): Edition {
  if (editions.length === 0) throw new Error('Nenhuma edição do Diário está disponível.');
  return [...editions].sort(byNewestDate)[0];
}

export function materialEditions(editions: Edition[]): Edition[] {
  return editions.filter((edition) => edition.decision.status === 'material').sort(byNewestDate);
}
