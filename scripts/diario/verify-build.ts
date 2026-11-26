import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

try {
  const root = process.cwd();
  const dist = join(root, 'dist');
  const hubPath = join(dist, 'diario-do-investidor');
  const endpointsPath = join(dist, 'api', 'diario');

  if (!existsSync(dist)) throw new Error('Build ausente: dist não existe.');
  if (existsSync(hubPath)) throw new Error('Diário publicado: dist/diario-do-investidor existe.');
  if (existsSync(endpointsPath)) throw new Error('Endpoints do Diário publicados: dist/api/diario existe.');

  for (const file of filesUnder(dist)) {
    const extension = extname(file);
    if (extension !== '.html' && extension !== '.xml') continue;

    const content = readFileSync(file, 'utf8');
    const displayPath = relative(root, file);
    if (extension === '.xml' && (content.includes('/diario-do-investidor') || content.includes('/api/diario/'))) {
      throw new Error(`Diário no sitemap: ${displayPath}`);
    }
    if (
      extension === '.html' &&
      (content.includes('/diario-do-investidor') || content.includes('/api/diario/') || content.includes('Diário do Investidor'))
    ) {
      throw new Error(`Referência ao Diário em HTML: ${displayPath}`);
    }
  }

  console.log('Diário offline verificado: páginas, endpoint, sitemap e links públicos ausentes.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida na verificação do build do Diário.');
  process.exitCode = 1;
}
