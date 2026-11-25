interface VercelRequest {
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  end(body?: string): void;
}

// 432 Meta Selic, 4389 CDI, 13522 IPCA 12m, 1 Dólar: as mesmas séries do build.
const SERIE_CODES = [432, 4389, 13522, 1];

function json(response: VercelResponse, status: number, data: unknown): void {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(data));
}

async function lastObservation(code: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3500) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ data: string; valor: string }>;
    if (!Array.isArray(data) || !data[0]?.data || !Number.isFinite(Number(String(data[0].valor).replace(',', '.')))) return null;
    return data[0].data;
  } catch {
    return null;
  }
}

/**
 * Data da observação realizada mais recente, descartando as futuras: a Meta Selic
 * (432) já vem datada para o próximo período do Copom.
 */
function latestRealizedDate(dates: Array<string | null>): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const iso = dates
    .map((d) => /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d ?? ''))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => `${m[3]}-${m[2]}-${m[1]}`)
    .filter((value) => value <= today)
    .sort();
  const latest = iso.at(-1);
  if (!latest) return null;
  const [year, month, day] = latest.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Cron diário: o site é estático, então taxas novas só entram no HTML com um
 * rebuild. O build já busca o BCB, logo basta disparar o Deploy Hook.
 *
 * O rebuild é de garantia: acontece sempre que as quatro séries do BCB
 * respondem, mesmo sem observação nova, para o hub vivo não envelhecer entre
 * uma publicação e a seguinte. Qualquer série fora interrompe o ciclo, porque
 * nesse caso o build publicaria a referência de configuração como se fosse
 * medição do dia.
 *
 * Este arquivo não importa nada do projeto de propósito. Cada arquivo em api/ é
 * compilado como função isolada pela Vercel: importar de outra função ou de src/
 * quebra em runtime (src/config/site.ts usa import.meta.env, que não existe aqui).
 * A lógica de data duplica a de src/lib/bcb.ts -- se mudar uma, mude outra.
 */
export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  // 500 e não 401 quando a variável falta: é config nossa, e o Vercel marca a
  // invocação agendada como falha, o que dispara o alerta de e-mail do cron.
  if (!cronSecret) {
    json(response, 500, { error: 'CRON_SECRET não configurada.' });
    return;
  }
  if (request.headers?.authorization !== `Bearer ${cronSecret}`) {
    json(response, 401, { error: 'Unauthorized' });
    return;
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    json(response, 500, { error: 'VERCEL_DEPLOY_HOOK_URL não configurada.' });
    return;
  }

  const observed = await Promise.all(SERIE_CODES.map(lastObservation));
  const failedSeries = SERIE_CODES.filter((_, index) => observed[index] === null);
  const freshDate = latestRealizedDate(observed);
  if (failedSeries.length > 0 || !freshDate) {
    // Rebuildar agora trocaria as taxas publicadas pelos defaults hardcoded. Com
    // uma série só fora, o build publicaria a referência de configuração
    // também como se fosse medição do dia.
    json(response, 200, { skipped: 'bcb-indisponivel', failedSeries });
    return;
  }

  // Somados ao fetch do BCB, os timeouts ficam abaixo do maxDuration de 30s.
  const triggered = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15000) });
  if (!triggered.ok) {
    json(response, 502, { error: `Deploy Hook recusou (HTTP ${triggered.status}).` });
    return;
  }

  json(response, 200, { rebuilt: true, updatedAt: freshDate });
}