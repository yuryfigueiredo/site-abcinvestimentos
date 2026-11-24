# AGENTS.md — contrato do repositório

Instruções para qualquer sessão (Qoder PC, Qoder Mac ou humano) que mexer neste projeto.

## Máquinas

- O **servidor oficial** é o Mac A1278 (Linux Mint 22.3, `ssh mac-server`, pasta canônica `/home/yury/Documentos/Projeto/abcinvestimentos`). Fica ligado 24h na tomada; o histórico de sessões do Qoder de lá vive amarrado a esse caminho — **nunca renomear `~/Documentos/Projeto`**.
- O PC Windows é máquina de edição secundária. O trabalho acontece em qualquer uma; **`origin/main` é a única fonte de verdade**.
- Antes de editar: `git pull --ff-only origin main`. Antes de reportar "está sincronizado": `git rev-parse 'HEAD^{tree}'` nas duas máquinas — hashes de árvore iguais = os arquivos rastreados são byte-idênticos.
- Guardas já instaladas: `tests/pc-independence.test.ts` (nenhuma referência a máquina específica) e `tests/icon-pipeline.test.ts` (pipeline de ícone). Teste por mutação antes de confiar em portão novo.

## Rotas de skill

Três portas de entrada, uma por tipo de pedido — escolher outra rota é refazer a conversa que já aconteceu.

- **M1 — "a pasta bate com o site no ar?"**: entra por `site-audit-visual-functional`, com `superpowers-verification-before-completion` por cima. Nenhuma afirmação de "está certo" sem comando rodado e saída conferida.
- **M2 — fechar um achado de auditoria**: entra por `superpowers-brainstorming`. O que é painel humano (variável de ambiente, Search Console, decisão de métrica) vai por `matt-wizard`; o que é código vai por `superpowers-test-driven-development`, com teste por mutação antes de confiar em portão novo.
- **M3 — atualização futura do produto**: `superpowers-brainstorming` → `superpowers-writing-plans` → `superpowers-executing-plans` (inline, um revisor no fim) ou `superpowers-subagent-driven-development` (um revisor por task) → `code-review` → `site-audit-visual-functional` antes do push.

Fora destas rotas, por decisão de 2026-11-16: `matt-wayfinder`, `matt-chief-of-staff`, `matt-software-factory`, `matt-triage`, `matt-to-tickets` — elas distribuem trabalho em tracker, e aqui `origin/main` é a única fonte de verdade.

## Publicar

- Publicar = `git push origin main` — a Vercel rebuilda sozinha (integração Git + cron diário `30 17 * * *` UTC = 14:30 BRT). O Mac **tem** chave de escrita deste repo e já provou push por `--dry-run`.
- `/api/indicadores.json` mudou de forma em 2026-11-16: não tem mais `source`, `ibovespa` nem `ifix`. A origem é declarada por campo em `origins`, e o que não é medição vem com a regra em `poupancaRule`. Quem consumir o endpoint de fora precisa saber disso.
- Mudança visual: frame local → aprovação dele → só então push. Aprovar um conserto não é aprovar a publicação.
- Commit com caminhos explícitos, nunca `git add -A`.
- `vercel`/`gh` CLI não existem no Mac; variáveis de ambiente, logs de deployment e Search Console são trabalho de navegador (painel dele).

## Diário e schema

- Automação do Diário: seguir `docs/diario/automation-prompt.md`, versão `diario-2026-11-23-briefing-v2`.
- Edições usam `schemaVersion: 2`; `briefing` é obrigatório em material e proibido em morno.
- O cofre em `src/data/diario/curadoria/` é imutável pela automação.
- Rascunho material inválido interrompe a execução; nunca rebaixar, editar `decision.status` ou publicar incompleto.

## Deploy keys

- Chaves são por repositório (regra do GitHub) e ficam em `~/.ssh/` no Mac com alias `Host github.com-<apelido>` + `IdentitiesOnly yes`.
- Chaves de leitura se chamam `mac-servidor A1278 (so leitura)`. Chave de **escrita** só com aprovação explícita dele — cada uma é um credencial nova de escrita nos repos dele.
- Os sites `Site-acalmo` e `site-leli-figueiredo` são públicos: os clones existentes usam HTTPS e não dependem de credencial.
