# AGENTS.md — contrato do repositório

Instruções para qualquer sessão (Qoder PC, Qoder Mac ou humano) que mexer neste projeto.

## Máquinas

- O **servidor oficial** é o Mac A1278 (Linux Mint 22.3, `ssh mac-server`, pasta canônica `/home/yury/Documentos/Projeto/abcinvestimentos`). Fica ligado 24h na tomada; o histórico de sessões do Qoder de lá vive amarrado a esse caminho — **nunca renomear `~/Documentos/Projeto`**.
- O PC Windows é máquina de edição secundária. O trabalho acontece em qualquer uma; **`origin/main` é a única fonte de verdade**.
- Antes de editar: `git pull --ff-only origin main`. Antes de reportar "está sincronizado": `git rev-parse 'HEAD^{tree}'` nas duas máquinas — hashes de árvore iguais = os arquivos rastreados são byte-idênticos.
- Guardas já instaladas: `tests/pc-independence.test.ts` (nenhuma referência a máquina específica) e `tests/icon-pipeline.test.ts` (pipeline de ícone). Teste por mutação antes de confiar em portão novo.

## Publicar

- Publicar = `git push origin main` — a Vercel rebuilda sozinha (integração Git + cron diário `30 17 * * *` UTC = 14:30 BRT). O Mac **tem** chave de escrita deste repo e já provou push por `--dry-run`.
- Mudança visual: frame local → aprovação dele → só então push. Aprovar um conserto não é aprovar a publicação.
- Commit com caminhos explícitos, nunca `git add -A`.
- `vercel`/`gh` CLI não existem no Mac; variáveis de ambiente, logs de deployment e Search Console são trabalho de navegador (painel dele).

## Deploy keys

- Chaves são por repositório (regra do GitHub) e ficam em `~/.ssh/` no Mac com alias `Host github.com-<apelido>` + `IdentitiesOnly yes`.
- Chaves de leitura se chamam `mac-servidor A1278 (so leitura)`. Chave de **escrita** só com aprovação explícita dele — cada uma é um credencial nova de escrita nos repos dele.
- Os sites `Site-acalmo` e `site-leli-figueiredo` são públicos: os clones existentes usam HTTPS e não dependem de credencial.
