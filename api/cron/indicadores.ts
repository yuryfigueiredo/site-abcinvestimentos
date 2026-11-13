import { getIndicators } from '../../src/lib/indicators';
import { SITE_CONFIG } from '../../src/config/site';

interface VercelRequest {
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  end(body?: string): void;
}

function json(response: VercelResponse, status: number, data: unknown): void {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(data));
}

/**
 * Cron diário: o site é estático, então taxas novas só entram no HTML com um
 * rebuild. O build já busca o BCB, logo basta disparar o Deploy Hook.
 */
export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers?.authorization !== `Bearer ${cronSecret}`) {
    json(response, 401, { error: 'Unauthorized' });
    return;
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    json(response, 500, { error: 'VERCEL_DEPLOY_HOOK_URL não configurada.' });
    return;
  }

  const fresh = await getIndicators();
  if (fresh.source !== 'bcb-sgs-live') {
    // Rebuildar agora trocaria as taxas publicadas pelos defaults hardcoded.
    json(response, 200, { skipped: 'bcb-indisponivel' });
    return;
  }

  // A entrega do cron é best-effort e pode repetir o mesmo agendamento, e em fins
  // de semana o BCB não publica série nova. Só rebuilda quando a data mudou.
  try {
    const current = await fetch(`${SITE_CONFIG.url}/api/indicadores.json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (current.ok) {
      const published = (await current.json()) as { updatedAt?: string };
      if (published.updatedAt === fresh.updatedAt) {
        json(response, 200, { skipped: 'sem-dados-novos', updatedAt: fresh.updatedAt });
        return;
      }
    }
  } catch {
    // Sem o valor publicado não dá para comparar; rebuildar é o lado seguro.
  }

  // Somados ao fetch do BCB, os timeouts ficam abaixo do maxDuration de 30s.
  const triggered = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15000) });
  if (!triggered.ok) {
    json(response, 502, { error: `Deploy Hook recusou (HTTP ${triggered.status}).` });
    return;
  }

  json(response, 200, { rebuilt: true, updatedAt: fresh.updatedAt });
}