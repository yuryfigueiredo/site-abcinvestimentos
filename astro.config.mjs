import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { getIndicators } from './src/lib/indicators';

// Compartilha a coleta memoizada com o build: nenhuma chamada extra ao BCB.
const indicators = await getIndicators();
const parsedDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(indicators.updatedAt);
const dataLastmod = parsedDate ? `${parsedDate[3]}-${parsedDate[2]}-${parsedDate[1]}` : undefined;

export default defineConfig({
  site: 'https://www.abcinvestimentos.com.br',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.includes('/ignorar-analytics'),
      serialize(item) {
        const { pathname } = new URL(item.url);
        if (dataLastmod && (pathname === '/' || pathname.startsWith('/quanto-rende/'))) {
          item.lastmod = dataLastmod;
        }
        return item;
      },
    }),
  ],
});
