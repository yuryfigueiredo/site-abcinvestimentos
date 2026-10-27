import { onRequestPost } from '../src/lib/ia-server';

export const config = {
  runtime: 'nodejs',
};

interface VercelRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  end(body?: string): void;
}

function getHeader(request: VercelRequest, name: string): string | null {
  const value = request.headers[name] || request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || null : value || null;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  try {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      response.status(405).end(JSON.stringify({ error: 'Método não permitido.' }));
      return;
    }

    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const clientIp = getHeader(request, 'x-forwarded-for') || getHeader(request, 'x-real-ip');
    if (clientIp) headers.set('x-forwarded-for', clientIp);

    const result = await onRequestPost({
      request: new Request('https://abcinvestimentos.com.br/api/ia', {
        method: 'POST',
        headers,
        body,
      }),
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      },
    });

    response.status(result.status);
    response.setHeader('Content-Type', result.headers.get('Content-Type') || 'application/json; charset=utf-8');
    response.end(await result.text());
  } catch (error) {
    console.error('[ABC IA] Falha no adaptador Vercel:', error);
    response.status(500).end(JSON.stringify({ error: 'Não foi possível processar sua pergunta no momento.' }));
  }
}
