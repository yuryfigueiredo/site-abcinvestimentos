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

## Expansão mínima das fontes — 2026-11-24

Commit do cofre: `ea48609ca196a7b6f9393cc8d2909cf3ebcf0595`. A expansão adicionou somente notas técnicas do BCB e o feed econômico da Câmara; Senado, atos e comunicados do BCB, CVM, IBGE, Tesouro, governo federal e mídia adicional continuam desabilitados e sem feeds.

O GREEN encontrou um acoplamento não previsto no plano: `parseApproval` fixava o caminho do plano anterior. A correção foi limitada a `APPROVED_INSTRUCTION_REF`, com teste novo do caminho aprovado e rejeição do caminho anterior; RED observado antes da correção e GREEN depois. A forma do schema, o parser, os thresholds, o coletor e a UI não mudaram.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Trocar o URL da Câmara de `ECONOMIA` para `OUTRA` | Hash do cofre e seed exato da Câmara em `governance.test.ts` | 4 falhas / 34 passes |

O arquivo mutado foi restaurado em `finally`; o SHA-256 de `allowlist.json` foi `97fabd47176e7328cad8dab0bd9530b0d8cf837d2bc248120336fb549968d087` antes e depois. Governança focal: **38/38 testes** após a restauração e após o commit.

### Coleta e curadoria reais, sem publicação

- `npm run diario:collect -- 2026-11-24`: **73 candidatos** — 38 do BCB, 10 da Câmara e 25 da The Conversation Brasil. Os caminhos canônicos confirmaram **9 candidatos de notas técnicas do BCB**; nenhum corpo de artigo foi requisitado.
- `npm run diario:curate -- 2026-11-24`: decisão `material`, motivos `dollar-trigger` e `official-news`, um cluster de `juros` e uma fonte oficial selecionada.
- Fonte selecionada: Câmara dos Deputados, “Motta vê ajuste fiscal como essencial para avançar com investimentos em 2027”, publicada em 2026-11-24; excerpt limitado “Presidente cobrou, porém, mais medidas para conter juros e dólar”.
- A seleção prova que o novo feed produz notícia econômica utilizável. O briefing rico ainda não foi escrito ou validado por IA nesta etapa; a curadoria não publicou uma edição datada nova.
- Verificações: `npx tsc --noEmit` limpo; suíte serial **535/535 testes**; build de **90 páginas**; `diario:verify-build` aprovado com hub, um arquivo material e zero edições mornas sem URL; `git diff --check` aprovado.
- `src/data/diario/edicoes/2026-11-23.json` permaneceu byte-idêntico à base `0e1993e`. Nenhum push foi realizado.

## Verificação end-to-end — 2026-11-25

Comandos e resultados, todos no worktree `feat/diario-do-investidor`:

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo |
| `npx vitest run` | **534/534 testes**, 23 arquivos |
| `npm run build` | **90 páginas** em `dist/` |
| `npm run diario:verify-build` | hub, 1 arquivo material, 0 edição morna sem URL, endpoint alinhado |
| `git diff --check` | limpo |

Rotas no preview local (`astro preview`): hub **200**, arquivo material `2026-11-23` **200**, data quiet `2026-11-22` **404**, metodologia **200**, `/api/diario/edicao.json` **200**. O sitemap local traz hub, arquivo material e metodologia; a data quiet não vira URL. O HTML arquivado preserva o snapshot da edição (`13,65`, `4,63`, `5,9708`) em vez dos valores vivos.

Navegador por CDP (Chromium headless, desktop 1440 e mobile 390): hub, arquivo e metodologia **sem erro de console**. O menu mobile alterna `aria-expanded` de `false` para `true` e a navegação fica visível. O único 404 é `/_vercel/insights/script.js`, presente também nas páginas já publicadas — é artefato do preview local, não regressão.

Comparação com o site no ar: as 86 URLs já publicadas permanecem idênticas no sitemap local; as 3 URLs novas são só do Diário. A home conserva canonical, título e os três blocos de JSON-LD (`WebSite`, `Organization`, `Person`); a diferença no HTML é a navegação e os cards do Diário. Nenhum push foi realizado.

## Task 6 do plano — rebuild diário de garantia

Data de execução: 2026-11-25. BASE: `762ac8d`.

Comando de execução:

```bash
node .superpowers/sdd/2026-11-23-diario-do-investidor/run-task-6-cron-mutations.mjs
```

As mutações foram aplicadas isoladamente com substituição textual exata e única; cada teste focal falhou com o código mutado e o arquivo original foi restaurado em seguida, com SHA-256 igual antes e depois.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Reintroduzir a comparação com `/api/indicadores.json` e o skip `sem-dados-novos` | `rebuilda de garantia sempre que o BCB responde, sem comparar com o publicado` | 1 falha / 6 passes |
| Remover a guarda que interrompe o rebuild quando o BCB não responde | `não rebuilda quando uma das séries do BCB falha, para não publicar referência como medição` | 1 falha / 6 passes |
| Aceitar falha parcial do BCB | `não rebuilda com o BCB fora, para não publicar os defaults hardcoded` e `não rebuilda quando uma das séries do BCB falha, para não publicar referência como medição` | 2 falhas / 5 passes |

Resultado: **3 de 3 mutações detectadas**, com o arquivo restaurado byte a byte.

### Revisão em dois eixos do commit do cron

Standards: nenhuma violação dura de `AGENTS.md`; os achados foram de evidência e de legibilidade. Spec: o comportamento pedido foi cumprido, com um achado médio sobre a falha parcial do BCB.

Rulings:

- **Falha parcial interrompe o rebuild.** O código anterior reconstruía com uma série do BCB fora e o build publicava a referência de configuração sob uma data fresca, sem rótulo. O cron agora exige as quatro séries, e o skip passa a reportar `failedSeries` para o operador distinguir queda total de série única.
- **Nomenclatura `freshDate`/`updatedAt` mantida.** `updatedAt` é o nome de contrato do payload publicado em `/api/indicadores.json` e do ticker; renomear a chave só dentro da resposta do cron mudaria o nome sem mudar o que o consumidor vê.
- **Teste duplicado removido.** O caso “rebuilda mesmo sem observação nova do BCB” exercitava o mesmo caminho do caso base depois que o double deixou de modelar a data publicada. A cobertura distintiva ficou em um caso só, com `skipped` indefinido e nenhuma chamada fora do BCB e do Deploy Hook.
- **Host de produção fora do teste.** O stub agora registra qualquer destino fora do BCB e do Deploy Hook como inesperado, o que é mais forte do que fixar o domínio do site no teste.
- **Ponteiro de duplicação corrigido.** A lógica de data duplicada pelo cron está em `src/lib/bcb.ts`, não em `src/lib/indicators.ts`.

### Achado aberto, fora do escopo deste commit

- O ticker global (`src/components/Ticker.astro`) mostra os valores do `/api/indicadores.json` e a data de `updatedAt`, mas não lê `origins`. Se uma série do BCB cair durante o build, o ticker exibe a referência de configuração ao lado de uma data fresca, sem rótulo. As superfícies do Diário rotulam a origem (`Referência de configuração` em `src/components/diario/IndicatorGrid.astro`). A janela é do build, que busca o BCB de forma independente; o rebuild diário de garantia apenas aumenta o número de builds. Fica registrado para task dedicada de rotulagem no ticker.
- Meta Selic com data futura: o build publica a observação datada para o próximo período do Copom como Selic corrente, enquanto o snapshot curado do Diário descarta datas futuras. Alinhamento pendente e já conhecido.

## Revisão final da expansão

- **Standards:** nenhuma violação dura de `AGENTS.md`. Um achado Minor de duplicação: a lista exata de fontes habilitadas é afirmada tanto no snapshot verificado quanto na seed bruta em `governance.test.ts`. Fica diferido porque ambas as asserções protegem contratos distintos e a repetição não altera comportamento.
- **Spec:** PASS, sem achados Critical, Important ou Minor. A revisão independente confirmou os dois feeds novos, as fontes excluídas, as versões, o hash canônico, a referência do plano, a coleta somente de feeds e a edição anterior intacta.
- Não houve achados Critical ou Important; nenhuma rodada adicional de correção foi necessária. Nenhum push foi realizado.

## Conserto de 2026-11-26 — item sem corpo e corrente de continuidade

Dois portões novos, cada um escrito como teste RED antes da mudança de código e executado
isoladamente com restauração em seguida.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| `if (!title \|\| !url) continue` (portão novo removido) | `discards an RSS item with an empty description / no description at all` e os cinco testes de corpo rejeitado | 7 falhas / 170 passes |
| Conferir `primaryExcerpt` em vez de `excerpt` (mata o fallback Atom) | Seis testes de fallback de conteúdo Atom em `ingest.test.ts` | 6 falhas / 171 passes |
| Corrente voltando a começar no arquivo mais antigo | `ignores a gap older than the most recent edition when proving the chain` | 1 falha / 41 passes |
| Exigir a véspera, sem perdoar noite perdida | `forgives the single night the automation itself missed` | 1 falha / 41 passes |
| Remover o portão de continuidade | `marks history unavailable when two nights are missing after the most recent edition` | 1 falha / 41 passes |

Rulings:

- **Quatro testes reescritos, não enfraquecidos.** `rejects unknown Atom content types`, `rejects Atom XHTML content`,
  `rejects inherited object names used as HTML entities` e `does not treat RSS content:encoded as an Atom content fallback`
  afirmavam `excerpt: ''` — exatamente o estado que o schema recusa e que derrubou a rodada de 25/11. Passaram a afirmar que
  o item não chega ao cache, mantendo a asserção do sentinela ausente no JSON persistido.
- **Teste renomeado.** `marks history unavailable when a daily edition is missing instead of proving novelty` virou
  `... when two nights are missing after the most recent edition`; a linha antiga deste ledger aponta para o nome anterior.
- **Onze fixtures em sete testes ganharam corpo.** Itens de parsing de título e URL em `ingest.test.ts` não tinham
  `description` e, sem corpo, deixaram de ser candidato; a asserção original sobre título e URL permaneceu.
- **Evidência real, fora da árvore canônica:** coleta de 2026-11-26 reproduzida em cópia do repo — 73 fontes no cache,
  zero `excerpt` vazio, curadoria concluiu e decidiu `morno` por `history-unavailable` (última edição 2026-11-23, três noites
  perdidas, além do perdão de uma). Câmara dos Deputados seguiu contribuindo 9 itens.
- Suíte completa: 544 testes em 23 arquivos; `npm run build` e `npm run diario:verify-build` verdes. Nenhum push foi realizado.
