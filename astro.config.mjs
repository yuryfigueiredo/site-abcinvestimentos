import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getIndicators } from './src/lib/indicators';
import { diarioHubLastmod, diarioSitemapMetadata } from './src/lib/diario/seo';
import { latestEdition, materialEditions, readEditions } from './src/lib/diario/store';

// Compartilha a coleta memoizada com o build: nenhuma chamada extra ao BCB.
const indicators = await getIndicators();
const parsedDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(indicators.updatedAt);
const dataLastmod = parsedDate ? `${parsedDate[3]}-${parsedDate[2]}-${parsedDate[1]}` : undefined;
const editions = readEditions();
const diarioSitemapContext = {
  hubLastmod: diarioHubLastmod(latestEdition(editions).date, dataLastmod),
  materialDates: new Set(materialEditions(editions).map((edition) => edition.date)),
};

export default defineConfig({
  site: 'https://www.abcinvestimentos.com.br',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    sitemap({
      // Página de utilidade interna, bloqueada no robots.txt: listá-la seria contraditório.
      // Datas do Diário só entram se a edição for material; uma URL quiet residual não entra.
      filter: (page) => {
        const { pathname } = new URL(page);
        return !pathname.includes('/ignorar-analytics') && diarioSitemapMetadata(pathname, diarioSitemapContext).include;
      },
      // lastmod só nas páginas cujo HTML muda com as taxas do BCB ou com a edição do Diário.
      // Marcar o resto como atualizado todo dia seria sinal falso, que o Google passa a ignorar.
      serialize(item) {
        const { pathname } = new URL(item.url);
        const diario = diarioSitemapMetadata(pathname, diarioSitemapContext);
        if (diario.lastmod) item.lastmod = diario.lastmod;
        else if (dataLastmod && (pathname === '/' || pathname.startsWith('/quanto-rende/'))) {
          item.lastmod = dataLastmod;
        }
        return item;
      },
    }),
  ],
});