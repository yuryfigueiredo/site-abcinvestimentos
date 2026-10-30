// Rota alternativa da IA: /api/consulta (alias de /api/ia).
// Usada pelo cliente como fallback quando bloqueadores do navegador miram /api/ia.
// export default literal para a Vercel detectar a serverless function.
import handler, { config } from '../src/lib/ia-vercel';

export { config };
export default handler;
