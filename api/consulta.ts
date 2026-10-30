// Rota alternativa da API da IA (alias de /api/ia).
// Usada pelo cliente como fallback caso bloqueadores de conteudo/trackers do navegador
// impeçam a rota /api/ia — assim a consulta continua funcionando mesmo nesse cenario.
export { default, config } from './ia';
