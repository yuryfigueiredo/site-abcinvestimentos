# Mutation ledger — Diário do Investidor

Data: 2026-11-23. Task 3.

Comando de execução:

```bash
node .superpowers/sdd/2026-11-23-diario-do-investidor/run-task-3-mutations.mjs
```

Cada mutação foi aplicada isoladamente, o arquivo de teste indicado foi executado e o arquivo original foi restaurado em `finally`. Nenhuma mutação permaneceu no código. A primeira execução ampliada abortou por um alvo sintático incorreto no runner; após corrigir o alvo, uma lacuna de teste foi identificada e fechada antes da execução final.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Remover a rejeição de dígitos na prosa | `validateEdition > rejects digits and HTML in editorial prose` | 1 falha / 33 passes |
| Remover a rejeição de HTML na prosa | `validateEdition > rejects digits and HTML in editorial prose` | 1 falha / 33 passes |
| Ignorar a reconstrução do snapshot | Três testes de snapshot, futuro e stale em `validate.test.ts` | 3 falhas / 31 passes |
| Aceitar mídia sem publishers independentes | Dois testes de publishers em `validate.test.ts` | 2 falhas / 32 passes |
| Aceitar CC BY-ND como única base autoral | `validateEdition > rejects a rewritten NewsItem based only on a CC BY-ND source` | 1 falha / 33 passes |
| Ignorar a recomputação de material/morno | Status adulterado e fonte repetida em `validate.test.ts` | 2 falhas / 32 passes |
| Desvincular evidência da coleta | `validateEdition > rejects evidence that differs from the collected source` | 1 falha / 33 passes |
| Desligar o delta substantivo do payload | `validateEdition > rejects a materially similar editorial payload` | 1 falha / 33 passes |
| Permitir reutilização de lição | `decideEdition > does not repeat a lesson already used in an earlier week` | 1 falha / 36 passes |
| Ignorar o hash do cofre | Dois testes de hash em `governance.test.ts` | 2 falhas / 35 passes |
| Ignorar lacuna no histórico diário | `validateAndPublish > marks history unavailable when a daily edition is missing instead of proving novelty` | 1 falha / 33 passes |
| Excluir observação da data da edição | Quatro testes de threshold/snapshot em `curate.test.ts` | 4 falhas / 33 passes |
| Rotular stale como medição atual | Cinco testes de stale em `curate.test.ts` | 5 falhas / 32 passes |
| Ignorar policy divergente | `validateEdition > rejects policy versions or source sets that diverge from the approved vault` | 1 falha / 33 passes |
| Reconstruir a seleção sem histórico | `decideEdition > keeps selected IDs aligned when a repeated source precedes a new cluster` | 1 falha / 36 passes |
| Aceitar observação anterior ambígua do dólar | `buildBcbSnapshot > does not calculate dollar change from conflicting observations on the prior date` | 1 falha / 36 passes |
| Aceitar edição de notícia sem evidência | `validateEdition > rejects a news edition that drops all selected evidence` | 1 falha / 33 passes |
| Desvincular data da edição da data BRT da coleta | `validateEdition > rejects a collection date that differs from the BRT retrieval date` | 1 falha / 33 passes |
| Contar aliases do mesmo publisher como mídia independente na curadoria | `decideEdition > does not count two allowlist IDs from one publisher as independent media` | 1 falha / 36 passes |
| Contar aliases do mesmo publisher como mídia independente na validação | `validateEdition > rejects two allowlist IDs that belong to the same media publisher` | 1 falha / 33 passes |
| Reabrir evento com excerpt copiado de título anterior | `decideEdition > does not treat an excerpt copied from a prior event source title as new evidence` | 1 falha / 36 passes |
| Calcular variação sobre valor stale publicado | `buildBcbSnapshot > does not calculate a dollar change when the published value remains stale` | 1 falha / 36 passes |
| Ignorar host da allowlist | `decideEdition > rejects an allowlisted source ID when the article host is not approved` | 1 falha / 36 passes |
| Aceitar item sem fonte | `validateEdition > rejects an item with no source` | 1 falha / 33 passes |
| Aceitar URL canônica repetida | `decideEdition > rejects repeated canonical URL` | 1 falha / 36 passes |
| Aceitar título normalizado repetido | `decideEdition > rejects repeated normalized title` | 1 falha / 36 passes |

Resultado: **26 de 26 mutações detectadas**.

## Achados da revisão focal

A revisão independente do diff não commitado contra `750937d` encontrou quatro achados altos/médios e um achado baixo. Os achados de código foram reproduzidos com testes antes da correção:

- **Alto:** edição com clusters de notícia podia descartar todos os itens e fontes. O validador agora exige evidência selecionada quando `newsClusterIds` não está vazio.
- **Alto:** `dollarChangePct` podia descrever observações diferentes do `measured.dolar` publicado. O cálculo agora exige que o valor publicado seja a observação atual `bcb-sgs` correspondente.
- **Médio:** a data da edição não era confrontada com a data BRT da coleta. `parseCollectedInputs` agora exige correspondência entre `inputs.date` e `inputs.retrievedAt`.
- **Médio:** dois IDs de allowlist do mesmo publisher contavam como independência. Curadoria e validação agora contam o publisher normalizado.
- **Médio:** evento anterior podia ser reaberto por excerpt copiado do título de uma fonte anterior. A comparação agora inclui títulos das fontes do evento; uma fonte oficial nova continua podendo justificar `official-news` por motivo independente.
- **Baixo, diferido:** o parser de `scripts/diario/curate.ts` aceita `--root` antes da data e ignora posicionais extras. O caminho usado pela automação não passa argumentos posicionais; a correção fica registrada para uma task futura sem ampliar este commit.

A execução final de mutações também expôs uma lacuna no teste de valor stale: o gate de decisão já bloqueava o gatilho, mas o snapshot ainda precisava de asserção direta de `dollarChangePct === null`. O teste novo falhou com a mutação (`expected 25 to be null`) e passou após restaurar o código original.

## Seed real

- Data: `2026-11-23`.
- Coleta: 54 candidatos, somente feeds allowlisted; nenhum corpo de matéria.
- Decisão: `material`, motivo `dollar-trigger`.
- Snapshot: dólar e demais campos exclusivamente do cache BCB; Selic futura foi omitida.
- Validação sem publicação: aprovada.
- Publicação exclusiva: `src/data/diario/edicoes/2026-11-23.json`.
- Nenhum push realizado.

## Task 6 — briefing, superfícies e prompt da automação

Data de execução: 2026-11-24. BASE: `35d85f0bd2a61167ae4f65490e62850f2aad16ca`.

Comando de execução:

```bash
node .superpowers/sdd/2026-11-23-diario-briefing-completo/run-task-6-mutations.mjs
```

As 14 mutações foram aplicadas isoladamente com substituição textual exata e única. Cada teste direcionado falhou com o código mutado; o conteúdo original foi restaurado em `finally`, com SHA-256 igual antes/depois e `git diff --exit-code -- <arquivo>` com código zero. O runner não usa `checkout`, `restore`, `reset`, `clean` ou `stash`.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Remover a seção “O que aconteceu” | `surface.test.ts > renders the complete briefing only in the article variant` | Ausência de `briefing.whatHappened`; 1 falha / 18 skips |
| Remover a seção “Por que importa” | `surface.test.ts > renders the complete briefing only in the article variant` | Ausência de `briefing.whyItMatters`; 1 falha / 18 skips |
| Remover a seção “O que observar” | `surface.test.ts > renders the complete briefing only in the article variant` | Ausência de `briefing.whatToWatch`; 1 falha / 18 skips |
| Desligar a rejeição de dígitos na prosa | `schema.test.ts > rejects digits and HTML in every briefing prose field` | Parser não lançou erro; 1 falha / 72 skips |
| Desligar a rejeição de HTML na prosa | `schema.test.ts > rejects digits and HTML in every briefing prose field` | Parser não lançou erro; 1 falha / 72 skips |
| Aceitar apenas um item em “O que observar” | `schema.test.ts > rejects fewer than two or more than four watch items` | Parser não lançou erro; 1 falha / 72 skips |
| Aceitar briefing em edição morna | `schema.test.ts > rejects a briefing in a quiet edition` | Parser não lançou erro; 1 falha / 72 skips |
| Ignorar a reconstrução do briefing determinístico | `validate.test.ts > rejects a deterministic briefing that differs from the approved facts` | Validador não lançou erro; 1 falha / 39 skips |
| Aceitar seção de briefing copiada de edição material recente | `validate.test.ts > rejects a news briefing copied from a recent material edition` | Validador não lançou erro; 1 falha / 39 skips |
| Aceitar evento divergente do calendário aprovado | `validate.test.ts > rejects an event that does not match the approved calendar` | Validador não lançou erro; 1 falha / 39 skips |
| Ocultar indicador indisponível | `surface.test.ts > renders all four indicators including unavailable values without inventing freshness` | Sumiu o tratamento de valor nulo; 1 falha / 18 skips |
| Ocultar variação arquivada do dólar | `surface.test.ts > passes the archived dollar change and enables the BCB series note only in the archive` | Sumiu o bloco de `dollarChangePct`; 1 falha / 18 skips |
| Permitir reescrita de status e downgrade no prompt | `automation-prompt.test.ts > forbids schema drift, status rewriting and vault edits` | Sumiu a proibição de alterar `decision.status`; 1 falha / 9 skips |
| Rebaixar o schema do prompt para a versão 1 | `automation-prompt.test.ts > exige schema 2, briefing apenas em material e metadados factuais separados` | Prompt deixou de conter `schemaVersion: 2`; 1 falha / 9 skips |

Resultado: **14 de 14 mutações detectadas e 14 de 14 restauradas**, sem diff residual nos arquivos mutados. Verificação focal após a restauração: **4 arquivos / 142 testes aprovados**. Evidência: `task-6-mutation-results.json`, `task-6-mutations-run.log` e os 14 logs `task-6-mutation-<id>.log` em `.superpowers/sdd/2026-11-23-diario-briefing-completo/`.

A inspeção dos frames encontrou um defeito adicional: o mapa do arquivo material omitia `key` nas linhas medidas e no fallback indisponível, removendo os nomes das quatro séries. O teste de superfície foi reforçado, o RED foi observado e o mapa passou a devolver `{ key, ...(measured[key] ?? fallback) }`. GREEN: 19/19 na superfície e 534/534 na suíte serial; build de 90 páginas e `diario:verify-build` aprovados. Os nove frames foram recapturados e o HTML final confirmou os rótulos Selic, CDI, IPCA acumulado e Dólar / PTAX.

## Revisão final, mutações adicionais e dry-run real

A revisão final da branch contra `dfe117986e8cde1a199aa18f3d07ca3d11e2520c` foi executada em dois eixos independentes. Standards aprovou sem achados críticos/importantes e recomendou quatro endurecimentos menores; Spec apontou dois minors iniciais. O primeiro RED da correção focalizada produziu 3 falhas / 26 passes: ausência de `git diff --cached --check`, de `role="list"` e de balanceamento em “Fontes”. A segunda rodada encontrou o título do painel sem balanceamento e uma regra global que poderia alterar o hub; ambas foram movidas para o escopo do artigo. Revisão final: **Standards PASS e Spec PASS, sem achados restantes**.

Duas mutações adicionais comprovaram os testes reforçados:

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Trocar a série do dólar de `1 (Dólar / PTAX)` para `2 (Dólar / PTAX)` | `surface.test.ts > enables the exact BCB series note only in the archive` | A frase exata não foi encontrada; falha focal esperada |
| Trocar `diario-2026-11-23-briefing-v2` por `diario-2026-11-24-briefing-v2` | `automation-prompt.test.ts > fixa a versão exata e a operação no Mac às 19:00 BRT` | Dois tokens de versão distintos detectados; falha focal esperada |

Ambas foram restauradas byte a byte. As correções finais preservaram a semântica da lista com `role="list"`, tornaram os balanceamentos de títulos article-scoped, fixaram a versão exata do prompt e incluíram `git diff --cached --check` depois do staging explícito. Verificação fresca: TypeScript limpo, **534/534 testes**, build de **90 páginas**, `diario:verify-build` e `git diff --check` aprovados. Nove frames desktop/mobile foram recapturados e inspecionados: hub, seed sem notícias, metodologia, artigo rico sintético e menu mobile; **zero erros de console** e fixture temporária removida.

### Dry-run real de 2026-11-24, sem publicação

- Coleta: 54 candidatos allowlisted — 29 do BCB e 25 da The Conversation Brasil; somente feeds e metadados/excerpts limitados.
- Janela de 24 horas: sete candidatos. A única notícia oficial recente do BCB tratava de cooperação entre bancos centrais e não casou com os tópicos editoriais atuais; os seis itens recentes da The Conversation são CC BY-ND e não podem ser parafraseados pela IA.
- Decisão real: `material` por `dollar-trigger`; zero clusters e zero fontes de notícia selecionadas.
- Snapshot bruto: dólar `5.8573` em 2026-11-24 contra `5.9708` em 2026-11-23, variação de **-1,9009178%**; CDI `13,65%`; IPCA-12m `4,63%`; Selic com data futura e portanto não publicada como medição atual.
- Briefing: os três blocos determinísticos foram gerados em cache, coerentes com a queda do dólar e sem dígitos ou recomendação.
- Limite editorial: o dry-run prova o caminho conservador e factual, mas **não prova a qualidade de um briefing rico escrito por IA com notícias**, pois a configuração atual não selecionou notícia financeira utilizável. Nenhuma edição foi publicada, nenhum arquivo do cofre mudou e nenhum push foi realizado.
