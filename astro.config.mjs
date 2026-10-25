import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://abcinvestimentos.com.br',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
