import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { latestEdition, materialEditions, readEditions } from '../../src/lib/diario/store';

try {
  const root = process.cwd();
  const dist = join(root, 'dist');
  const editions = readEditions(root);
  const latest = latestEdition(editions);
  const material = materialEditions(editions);
  const hubPath = join(dist, 'diario-do-investidor', 'index.html');
  const endpointPath = join(dist, 'api', 'diario', 'edicao.json');

  if (!existsSync(hubPath)) throw new Error('Hub do Diário ausente em dist/diario-do-investidor/index.html');
  if (!existsSync(endpointPath)) throw new Error('Endpoint do Diário ausente em dist/api/diario/edicao.json');

  const hub = readFileSync(hubPath, 'utf8');
  if (!hub.includes('rel="canonical"') || !hub.includes('application/ld+json') || !hub.includes('CollectionPage')) {
    throw new Error('Hub do Diário está sem canonical ou JSON-LD CollectionPage');
  }

  for (const edition of editions) {
    const datedPath = join(dist, 'diario-do-investidor', edition.date, 'index.html');
    if (edition.decision.status === 'material') {
      if (!existsSync(datedPath)) throw new Error(`Arquivo material ausente: ${edition.date}`);
      const html = readFileSync(datedPath, 'utf8');
      if (!html.includes('rel="canonical"') || !html.includes('application/ld+json') || !html.includes('"@type":"Article"')) {
        throw new Error(`Arquivo material ${edition.date} está sem canonical ou JSON-LD Article`);
      }
    } else if (existsSync(datedPath)) {
      throw new Error(`Edição morna virou URL datada: ${edition.date}`);
    }
  }

  const endpoint = JSON.parse(readFileSync(endpointPath, 'utf8')) as unknown;
  if (!isDeepStrictEqual(endpoint, latest)) {
    throw new Error('Endpoint não corresponde à última edição, inclusive uma edição morna');
  }

  console.log(`Diário verificado: hub, ${material.length} arquivo(s) material(is), ${editions.length - material.length} edição(ões) morna(s) sem URL e endpoint alinhado.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na verificação do build do Diário.');
  process.exitCode = 1;
}
