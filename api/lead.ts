interface VercelRequest {
  method?: string;
  body?: unknown;
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
  response.end(JSON.stringify(data));
}

/** Normaliza qualquer formato de body (objeto, string JSON, Buffer) para objeto. */
function normalizeBody(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      value = JSON.parse(trimmed);
    } catch {
      return {};
    }
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    try {
      value = JSON.parse(value.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Lê o body do request da Vercel sem quebrar: o getter `request.body` pode lançar
 * "Invalid JSON" em alguns clientes, então cai no fallback lendo o stream cru.
 */
async function readJsonBody(request: VercelRequest): Promise<Record<string, unknown>> {
  // 1) Tenta request.body (getter que pode lançar "Invalid JSON" em clientes HTTP/1.1)
  let pre: unknown;
  try {
    pre = request.body;
  } catch {
    pre = undefined;
  }
  const parsed = normalizeBody(pre);
  if (Object.keys(parsed).length > 0) return parsed;

  // 2) Tenta request.rawBody (string/Buffer cru fornecido pela Vercel quando o body parser está ativo)
  try {
    const rawBody = (request as unknown as { rawBody?: unknown }).rawBody;
    const fromRaw = normalizeBody(rawBody);
    if (Object.keys(fromRaw).length > 0) return fromRaw;
    if (typeof rawBody === 'string' && rawBody.trim()) {
      const params = new URLSearchParams(rawBody);
      const entries = [...params.entries()];
      if (entries.length > 0) return Object.fromEntries(entries) as Record<string, unknown>;
    }
  } catch {
    // segue para o stream
  }

  // 3) Fallback final: lê o stream cru (IncomingMessage)
  try {
    const stream = request as unknown as AsyncIterable<Uint8Array | string>;
    if (typeof (request as unknown as NodeJS.ReadableStream).on === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) {
        try {
          return normalizeBody(JSON.parse(raw));
        } catch {
          const params = new URLSearchParams(raw);
          const entries = [...params.entries()];
          if (entries.length > 0) return Object.fromEntries(entries) as Record<string, unknown>;
        }
      }
    }
  } catch {
    // stream indisponível — segue com body vazio
  }
  return {};
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    json(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = (await readJsonBody(request)) as {
      name?: string;
      contact?: string;
      question?: string;
    };

    const name = (body.name || '').trim().slice(0, 150);
    const contact = (body.contact || '').trim().slice(0, 150);
    const question = (body.question || '').trim().slice(0, 500);

    if (!name || !contact) {
      json(response, 400, { error: 'Nome e contato (WhatsApp ou e-mail) são obrigatórios.' });
      return;
    }

    const databaseUrl = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (databaseUrl && authToken) {
      try {
        const endpoint = databaseUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '') + '/v2/pipeline';
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            requests: [
              {
                type: 'execute',
                stmt: {
                  sql: `CREATE TABLE IF NOT EXISTS leads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    contact TEXT NOT NULL,
                    question TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                  );`,
                },
              },
              {
                type: 'execute',
                stmt: {
                  sql: 'INSERT INTO leads (name, contact, question) VALUES (?, ?, ?)',
                  args: [
                    { type: 'text', value: name },
                    { type: 'text', value: contact },
                    { type: 'text', value: question },
                  ],
                },
              },
              { type: 'close' },
            ],
          }),
        });
      } catch (dbErr) {
        console.error('[ABC Lead] Erro ao gravar lead no banco Turso:', dbErr);
      }
    }

    console.log(`[ABC Lead Capturado] Nome: ${name} | Contato: ${contact} | Pergunta: ${question}`);
    json(response, 200, { success: true, message: 'Lead registrado com sucesso.' });
  } catch (error) {
    console.error('[ABC Lead] Erro no processamento do lead:', error);
    json(response, 200, { success: true, fallback: true });
  }
}
