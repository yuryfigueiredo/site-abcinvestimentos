# Diário — cobertura governada e simulação isolada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar a cobertura do Diário sem perder rigor editorial e produzir uma prévia isolada de 28/11/2026, sem alterar 27/11 nem publicar.

**Architecture:** O cofre passa a declarar três tópicos adicionais, janelas adaptativas e um quinto feed BCB. A curadoria compartilhada calcula decisão, seleção e diagnóstico terminal por candidato; a simulação reutiliza esse caminho com `retrievedAt` real, `referenceAt` futuro e cache separado.

**Tech Stack:** Astro 5, TypeScript estrito, Node.js 22, Vitest 3, `tsx`, `fast-xml-parser`.

**Spec:** `docs/superpowers/specs/2026-11-27-diario-cobertura-simulacao-design.md`

## Global Constraints

- Não alterar `src/data/diario/edicoes/2026-11-27.json`.
- Não publicar, não commitar e não fazer push sem ordem explícita do dono.
- Cofre muda somente por esta ordem: editar → changelog → hash → approval → testes.
- Commit, se algum dia autorizado, usa caminhos explícitos; nunca `git add -A`.
- Sem recomendações, cripto, corpo de matéria, paywall ou paráfrase CC BY-ND.
- Prosa editorial sem algarismos e sem HTML.
- A automação continua diária às 19:00 BRT, com preflight, lock, árvore limpa e todos os portões antes de push.
- The Conversation Brasil continua descartada antes do clustering.
- A simulação é prévia estrutural determinística; não invoca IA nem promete texto final.

## Review Focus

- **Futuro agendado:** um item com `publishedAt` depois de `retrievedAt`, mas antes de `referenceAt`, deve ser rejeitado como `future-publication`.
- **Empate de tópicos:** `spread` deve cair em `pagamentos-credito`; crédito/financiamento não deve ser sombreado por renda fixa.
- **Diagnóstico terminal:** cada entrada de `inputs.sources` recebe exatamente um motivo, inclusive duplicatas internas, mídia insuficiente e clusters além do limite.
- **Isolamento de escrita:** simulação e validação simulada não podem criar, alterar ou remover arquivos em `src/data/diario/edicoes/`.
- **Continuidade histórica:** 28/11 usa o histórico publicado até 27/11; se a corrente estiver quebrada, o resultado é `history-unavailable`, não material forçado.

---

### Task 0: Registrar design e plano

**Files:**
- Create: `docs/superpowers/specs/2026-11-27-diario-cobertura-simulacao-design.md`
- Create: `docs/superpowers/plans/2026-11-27-diario-cobertura-simulacao.md`

**Interfaces:**
- Consumes: pedido do dono, evidência de 27/11, cofre e pipeline atuais.
- Produces: autoridade de design e plano referenciados pelo `approval.json`.

- [ ] **Step 1: Escrever o design e fazer builder check**
- [ ] **Step 2: Incorporar as respostas do builder como chamadas explícitas**
- [ ] **Step 3: Escrever e auto-revisar este plano**

### Task 1: Contrato, taxonomia e cofre governado

**Files:**
- Modify: `src/lib/diario/types.ts`
- Modify: `src/lib/diario/schema.ts`
- Modify: `src/lib/diario/governance.ts`
- Modify: `src/data/diario/curadoria/carta.md`
- Modify: `src/data/diario/curadoria/allowlist.json`
- Modify: `src/data/diario/curadoria/thresholds.json`
- Modify: `src/data/diario/curadoria/changelog.md`
- Modify: `src/data/diario/curadoria/approval.json`
- Modify: `tests/diario/fixtures.ts`
- Test: `tests/diario/schema.test.ts`
- Test: `tests/diario/governance.test.ts`

**Interfaces:**
- Consumes: tipos e parsers atuais.
- Produces: `Topic` com nove valores; `Thresholds.weekendNewsWindowHours`; `CollectedInputs.referenceAt?`; `APPROVED_INSTRUCTION_REF` apontando para este plano.

- [ ] **Step 1: Escrever testes RED em `schema.test.ts`**
  - `parseThresholds` aceita `newsWindowHours: 30`, `weekendNewsWindowHours: 72` e os nove tópicos.
  - `parseThresholds` rejeita janela fim de semana fora de 1..168 ou menor que a janela regular.
  - `parseCollectedInputs` aceita `referenceAt` futuro quando a data bate com o dia BRT de `referenceAt`.
  - `parseCollectedInputs` rejeita `referenceAt < retrievedAt`.
  - Sem `referenceAt`, continua exigindo `date === currentDateBrt(retrievedAt)`.

- [ ] **Step 2: Rodar os testes e confirmar RED**

Run: `npx vitest run tests/diario/schema.test.ts`
Expected: falhas por campo desconhecido, enum ausente ou validação temporal ausente.

- [ ] **Step 3: Implementar tipos e schema**
  - `Topic`: acrescentar `pagamentos-credito`, `trabalho-renda`, `consumo`.
  - `Thresholds`: acrescentar `weekendNewsWindowHours: number`.
  - `CollectedInputs`: acrescentar `referenceAt?: string`.
  - `schema.ts`: ampliar `TOPICS`, aceitar a nova chave e validar a data contra `referenceAt` quando presente.

- [ ] **Step 4: Escrever testes RED de governance**
  - Cofre esperado: carta `1.0.4`, allowlist `1.3.0`, thresholds `1.1.0`.
  - BCB possui cinco feeds, incluindo o feed anual de normativos com tópicos `pagamentos-credito` e `regulacao`.
  - Thresholds fixados são 30h/72h e nove tópicos.
  - `approval.instructionRef` é este plano.
  - Mutação de qualquer arquivo do bundle sem atualizar hash/approval continua falhando.

- [ ] **Step 5: Rodar governance e confirmar RED**

Run: `npx vitest run tests/diario/governance.test.ts`
Expected: versões, feed, thresholds ou instructionRef divergentes.

- [ ] **Step 6: Atualizar cofre e governance**
  - Carta `1.0.4`: cadência diária, janelas, tópicos, fonte anual e regra de manutenção.
  - Allowlist `1.3.0`: adicionar somente `https://www.bcb.gov.br/api/feed/app/normativos/normativos?ano=2026`.
  - Thresholds `1.1.0`: 30h, 72h, nove tópicos e eventos atuais.
  - Changelog `1.0.4`: registrar aprovados e todos os rejeitados permanentes.
  - `governance.ts`: fixar os novos valores.
  - `schema.ts`: `APPROVED_INSTRUCTION_REF` passa a ser este plano.
  - Atualizar fixtures sem alterar editions publicadas.

- [ ] **Step 7: Recomputar hash e atualizar approval**
  - Rodar `computeCurationBundleHash`, gravar o resultado em `approval.json`, manter `approvedBy: Yury Figueiredo` e registrar o instante real em `approvedAt`.

- [ ] **Step 8: Rodar testes focados e suíte completa**

Run: `npx vitest run tests/diario/schema.test.ts tests/diario/governance.test.ts && npm test`
Expected: todos passam; nenhuma edition publicada muda.

### Task 2: Curadoria adaptativa e diagnóstico terminal

**Files:**
- Create: `src/lib/diario/curation.ts`
- Modify: `src/lib/diario/curate.ts`
- Modify: `src/lib/diario/briefing.ts`
- Modify: `src/lib/diario/types.ts`
- Modify: `scripts/diario/curate.ts`
- Modify: `tests/diario/fixtures.ts`
- Test: `tests/diario/curate.test.ts`
- Test: `tests/diario/briefing.test.ts`

**Interfaces:**
- Consumes: `CollectedInputs.referenceAt?`, thresholds 30h/72h, nove tópicos.
- Produces: `curateCollectedInputs(inputs, previous, vault, historyUnavailable = false): CurationResult` com `decision`, `selection`, `briefing?` e `diagnostics`.

- [ ] **Step 1: Escrever testes RED de classificação e janela**
  - Pix/conta de pagamento → `pagamentos-credito`.
  - Black Friday/intenção de compra → `consumo`.
  - CAGED/desemprego → `trabalho-renda`.
  - `IGP-M` → `inflacao`.
  - `payroll` → `trabalho-renda`.
  - `spread` isolado → `pagamentos-credito`.
  - Crédito/financiamento isolado → `pagamentos-credito`.
  - Norma de quinta às 18h entra na sexta às 19h com janela de 30h.
  - Quinta às 18h entra no sábado às 19h com janela de 72h.
  - Domingo usa 72h.
  - Item com 31h em dia útil fica fora.
  - Item com 73h no fim de semana fica fora.
  - `referenceAt` futuro desloca a janela sem mudar `retrievedAt`.
  - Item publicado depois de `retrievedAt` é rejeitado mesmo antes de `referenceAt`.

- [ ] **Step 2: Rodar `curate.test.ts` e confirmar RED**

Run: `npx vitest run tests/diario/curate.test.ts`
Expected: tópicos novos ou janelas adaptativas não reconhecidos.

- [ ] **Step 3: Implementar classificação e janela**
  - Ampliar `TOPIC_TERMS` e criar precedência explícita para empates.
  - Remapear `EVENT_TOPICS.payroll`.
  - `normalizeCandidate` usa `collectionTime = retrievedAt` para o corte de publicação e `referenceTime = referenceAt ?? retrievedAt` para a idade.
  - Dia editorial em UTC derivado da data de calendário seleciona 30h ou 72h.

- [ ] **Step 4: Escrever testes RED de diagnóstico**
  - Cada candidato gera uma entrada terminal.
  - Cobre `selected`, `invalid-candidate`, `duplicate-candidate`, `source-not-allowed`, `cc-by-nd`, `crypto-excluded`, `topic-not-allowed`, `future-publication`, `outside-window`, `media-needs-two-sources`, `duplicate-history`, `item-limit`.
  - Diagnóstico não contém `excerpt`, `excerptSha256` nem HTML.
  - Histório indisponível produz decisão morna e diagnóstico `history-unavailable`.

- [ ] **Step 5: Implementar `curation.ts` e refatorar `curate.ts`**
  - `normalizeCandidate` passa a devolver resultado discriminado com candidato ou motivo.
  - `buildClusters` continua removendo duplicatas internas, mas seus IDs recebem `duplicate-candidate`.
  - Clusters insuficientes, repetidos ou além do limite recebem o motivo correspondente.
  - `curateCollectedInputs` chama decisão/seleção uma única vez e monta briefing determinístico quando cabível.
  - `scripts/diario/curate.ts` grava `selection.json`, `diagnostics.json` e `briefing.json` no cache normal.

- [ ] **Step 6: Escrever testes RED dos contextos novos**
  - `buildDeterministicBriefing` cobre os três tópicos novos sem dígitos, HTML ou recomendação.

- [ ] **Step 7: Implementar contextos e rodar testes**

Run: `npx vitest run tests/diario/curate.test.ts tests/diario/briefing.test.ts tests/diario/cli.test.ts && npm test`
Expected: todos passam e `curate` normal grava diagnóstico.

### Task 3: Coleta e cache de simulação isolados

**Files:**
- Create: `src/lib/diario/cache.ts`
- Modify: `src/lib/diario/ingest.ts`
- Modify: `src/lib/diario/types.ts`
- Test: `tests/diario/ingest.test.ts`

**Interfaces:**
- Consumes: `referenceAt`, cofre ampliado.
- Produces: `diarioCachePath(root, date, scope)`; `CollectOptions.referenceAt?` e `cacheScope?: 'edition' | 'simulation'`.

- [ ] **Step 1: Escrever teste RED de persistência**
  - `collectInputs(..., { referenceAt, cacheScope: 'simulation' })` grava apenas `.cache/diario/simulations/<date>/inputs.json`.
  - `retrievedAt` é o `now` real; `referenceAt` é preservado.
  - Sem `cacheScope`, continua gravando `.cache/diario/<date>/inputs.json`.
  - O quinto feed BCB é solicitado e seu candidato Atom entra em `sources`.

- [ ] **Step 2: Rodar `ingest.test.ts` e confirmar RED**

Run: `npx vitest run tests/diario/ingest.test.ts`
Expected: diretório ou campo novo ausente.

- [ ] **Step 3: Implementar cache e ingestão**
  - `cache.ts` centraliza o caminho por escopo.
  - `ingest.ts` valida `referenceAt` e grava no escopo solicitado sem tocar no cache normal em simulação.

- [ ] **Step 4: Rodar testes focados e suíte**

Run: `npx vitest run tests/diario/ingest.test.ts && npm test`
Expected: todos passam.

### Task 4: Prévia estrutural, CLI e validação sem publicação

**Files:**
- Create: `src/lib/diario/preview.ts`
- Create: `src/lib/diario/simulate.ts`
- Create: `scripts/diario/simulate.ts`
- Modify: `src/lib/diario/validate.ts`
- Modify: `scripts/diario/validate.ts`
- Modify: `package.json`
- Test: `tests/diario/preview.test.ts`
- Test: `tests/diario/simulate.test.ts`
- Test: `tests/diario/cli.test.ts`

**Interfaces:**
- Consumes: `curateCollectedInputs`, `diarioCachePath`, `collectInputs`, `loadPreviousEditions`.
- Produces: `buildSimulationDraft(...)`, `simulateDiario(date, options)`, `loadSimulationValidationContext(date, root)` e script `diario:simulate`.

- [ ] **Step 1: Escrever testes RED da prévia**
  - `buildSimulationDraft` preserva `generatedAt = retrievedAt`.
  - Itens usam apenas metadados e contexto educativo; prosa não contém dígitos ou HTML.
  - Fontes vêm da seleção e não carregam excerpt.
  - Material sem notícias usa briefing determinístico.
  - Prévia passa por `validateEdition`.

- [ ] **Step 2: Implementar `preview.ts`**
  - Título e resumo identificam explicitamente prévia estrutural.
  - Headline remove algarismos do título factual; summary e why usam texto neutro do tópico.
  - `provenance.promptVersion: 'diario-simulate'`.
  - Nenhum texto é apresentado como redação final ou recomendação.

- [ ] **Step 3: Escrever testes RED de simulação**
  - `simulateDiario` grava inputs, selection, diagnostics, draft e briefing somente no cache de simulação.
  - Usa o histórico publicado até a data simulada.
  - `retrievedAt` real e `referenceAt` explícito.
  - Retorna relatório com limite: conhece apenas o coletado até `retrievedAt`.
  - Não cria arquivo em `src/data/diario/edicoes/`.
  - `asOf < now` ou data diferente do dia BRT de `asOf` falha.
  - `loadSimulationValidationContext` lê o cache simulado.
  - CLI `diario:validate --simulation` valida sem publicar.
  - `--simulation --publish` falha antes de qualquer escrita.

- [ ] **Step 4: Rodar testes e confirmar RED**

Run: `npx vitest run tests/diario/preview.test.ts tests/diario/simulate.test.ts tests/diario/cli.test.ts`
Expected: módulos, flags ou isolamento ausentes.

- [ ] **Step 5: Implementar biblioteca, validação e CLIs**
  - `simulateDiario` coleta, carrega histórico, cura, monta prévia, grava cache e valida sem publicar.
  - `scripts/diario/simulate.ts` aceita `[YYYY-MM-DD] --as-of <ISO> [--root <path>]`; rejeita `--publish` e flags desconhecidas.
  - `scripts/diario/validate.ts` aceita `--simulation`; se combinado com `--publish`, encerra com usage.
  - `package.json`: acrescentar `"diario:simulate": "tsx scripts/diario/simulate.ts"`.

- [ ] **Step 6: Rodar testes focados e suíte**

Run: `npx vitest run tests/diario/preview.test.ts tests/diario/simulate.test.ts tests/diario/cli.test.ts && npm test`
Expected: todos passam e nenhuma edition é criada.

### Task 5: Metodologia, prompt e verificação real de 28/11

**Files:**
- Modify: `src/pages/diario-do-investidor/metodologia.astro`
- Modify: `docs/diario/automation-prompt.md`
- Modify: `tests/diario/automation-prompt.test.ts`
- Modify: `AGENTS.md`
- Test: `tests/diario/surface.test.ts`

**Interfaces:**
- Consumes: comportamento final implementado.
- Produces: contrato público e de automação coerentes; evidência da simulação.

- [ ] **Step 1: Escrever testes RED do novo prompt**
  - Versão exata `diario-2026-11-27-preflight-v4`.
  - Permanece uma única ocorrência da versão.
  - Mantém preflight, lock, pull, coleta, curadoria, validação, testes, build, verificação, commit e push na ordem atual.
  - Menciona `diagnostics.json` como artefato de auditoria, sem excerpts públicos.

- [ ] **Step 2: Atualizar prompt, AGENTS e metodologia**
  - Prompt v4 e testes na mesma mudança.
  - Metodologia explica janelas 30h/72h, feed de normativos, tópicos ampliados, deduplicação e ausência de publicação por calendário.
  - AGENTS registra a versão v4.

- [ ] **Step 3: Rodar testes de prompt e suíte**

Run: `npx vitest run tests/diario/automation-prompt.test.ts && npm test`
Expected: todos passam.

- [ ] **Step 4: Registrar hash da edição de 27/11 e rodar a simulação real**

Run:
```bash
sha256sum src/data/diario/edicoes/2026-11-27.json
npm run diario:simulate -- 2026-11-28 --as-of 2026-11-28T22:00:00Z
npm run diario:validate -- 2026-11-28 --simulation
sha256sum src/data/diario/edicoes/2026-11-27.json
```
Expected: simulação e validação terminam com exit 0; hashes de 27/11 idênticos; nenhuma edition de 28/11 criada.

- [ ] **Step 5: Build e verificação da superfície**

Run:
```bash
npm run build
npm run diario:verify-build -- --online
```
Expected: exit 0; hub, metodologia, home, arquivo, endpoint e sitemap coerentes.

- [ ] **Step 6: Revisão final e auditoria**
  - Revisar o diff completo contra `main` com agente fresco.
  - Corrigir achados críticos/importantes com RED→GREEN.
  - Auditar metodologia e fluxo sem publicar.
  - Registrar resultado da simulação, incluindo selecionados e principais descartes.

## Self-review

- **Cobertura da spec:** Tasks 1–5 cobrem fonte, tópicos, janelas, diagnóstico, simulação, validação, metodologia e preservação de 27/11.
- **Passos:** cada RED vem antes da implementação correspondente; nenhuma etapa de commit ou push foi incluída.
- **Consistência de tipos:** `referenceAt`, `cacheScope`, `CurationResult` e `diarioCachePath` têm nomes únicos e são introduzidos antes de consumo.
- **Review Focus:** futuro agendado, empates, diagnóstico terminal, isolamento de escrita e continuidade histórica têm teste explícito.
- **Proporção:** o plano fixa contratos e verificações; corpos de algoritmo ficam para a implementação.
