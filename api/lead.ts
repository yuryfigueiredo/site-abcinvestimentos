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

/** Normaliza request.body (objeto, string JSON ou Buffer) para objeto — evita 500 por parse quebrado. */
function parseRequestBody(raw: unknown): Record<string, unknown> {
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

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    json(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = parseRequestBody(request.body) as {
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
