// Dispara um rebuild na Vercel. O build busca as séries do BCB, então rebuilding
// o mesmo commit já publica taxas novas — não é preciso commitar dados nem buildar
// aqui. Agende no servidor 24h; a URL do hook fica só no ambiente.
const hook = process.env.VERCEL_DEPLOY_HOOK_URL;

if (!hook) {
  console.error('[ABC dados] VERCEL_DEPLOY_HOOK_URL ausente. Crie o Deploy Hook no painel da Vercel (Settings > Git > Deploy Hooks).');
  process.exit(1);
}

try {
  // Sem o BCB no ar, o build cairia nos defaults hardcoded e trocaria taxas boas
  // por taxas velhas. Melhor manter no ar a última publicação bem-sucedida.
  const probe = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) },
  );
  if (!probe.ok) {
    console.log(`[ABC dados] BCB indisponível (HTTP ${probe.status}); rebuild adiado para manter os dados atuais.`);
    process.exit(0);
  }

  const response = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(30000) });
  const body = await response.text();

  if (!response.ok) {
    console.error(`[ABC dados] Vercel recusou o deploy (HTTP ${response.status}): ${body}`);
    process.exit(1);
  }

  const job = JSON.parse(body)?.job;
  console.log(`[ABC dados] Rebuild disparado em ${new Date().toISOString()}${job?.id ? ` (job ${job.id})` : ''}`);
} catch (error) {
  console.error('[ABC dados] Falha ao disparar o rebuild:', error.message);
  process.exit(1);
}