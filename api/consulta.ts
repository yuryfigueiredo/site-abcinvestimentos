// Rota alternativa anti-adblock: mesmo handler de /api/ia, sem duplicar a lógica.
// O `config` fica explícito aqui porque a Vercel o detecta por análise estática do arquivo.
export const config = { api: { bodyParser: false } };

export { default } from './ia';
