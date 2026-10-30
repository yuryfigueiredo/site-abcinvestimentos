// Wrapper: expoe o handler Vercel de /api/ia a partir da implementacao compartilhada.
// Usa export default literal (nao re-export) para a Vercel detectar a serverless function.
import handler, { config } from '../src/lib/ia-vercel';

export { config };
export default handler;
