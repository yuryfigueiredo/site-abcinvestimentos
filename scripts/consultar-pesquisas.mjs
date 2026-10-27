import fs from 'node:fs';

// Leitura automatica das credenciais do .env
const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
}

const rawDbUrl = getEnv('TURSO_DATABASE_URL') || 'libsql://abc-investimentos-yuryfigueiredo.aws-sa-east-1.turso.io';
const authToken = getEnv('TURSO_AUTH_TOKEN');

if (!authToken) {
  console.error('Erro: TURSO_AUTH_TOKEN nao encontrado no .env');
  process.exit(1);
}

const endpoint = rawDbUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '') + '/v2/pipeline';

async function main() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql: 'SELECT id, question, answer, mode, created_at FROM ai_conversations ORDER BY id DESC LIMIT 100;',
          },
        },
        { type: 'close' },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Turso HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const rows = data.results?.[0]?.response?.result?.rows || [];

  console.log('\n========================================================================');
  console.log('   ABC INVESTIMENTOS — HISTÓRICO DE PESQUISAS DOS VISITANTES (TURSO)    ');
  console.log('========================================================================\n');
  console.log(`Total de consultas registradas: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log('Nenhuma pesquisa encontrada ainda.');
    return;
  }

  console.table(
    rows.map((r) => ({
      ID: r[0].value,
      Pergunta: r[1].value,
      'Resposta da IA': r[2].value.length > 60 ? r[2].value.slice(0, 57) + '...' : r[2].value,
      Modo: r[3].value,
      Data: r[4].value,
    }))
  );
}

main().catch(console.error);
