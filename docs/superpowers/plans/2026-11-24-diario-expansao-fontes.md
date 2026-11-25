# Expansão mínima das fontes do Diário do Investidor — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar o feed de notas técnicas do Banco Central e o feed econômico da Câmara no cofre, com evidência, testes e sem ampliar o ruído editorial.

**Architecture:** A mudança é de dados governados, testes e da referência de plano aprovado no schema: allowlist, carta, changelog, approval e `APPROVED_INSTRUCTION_REF`. A forma do schema, o coletor, a curadoria e a UI permanecem iguais; a coleta real e a curadoria provam o resultado.

**Tech Stack:** Astro 5, TypeScript estrito, Vitest 3, Node 22, `tsx`, `fast-xml-parser`.

**Spec:** `docs/superpowers/specs/2026-11-24-diario-expansao-fontes-design.md`

## Global Constraints

- Ativar somente `https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notastecnicas` e `https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA`.
- Manter Senado, atos e comunicados do BCB, CVM, IBGE, Tesouro, governo federal e mídia adicional desabilitados e sem feeds.
- Nunca baixar corpo de matéria; coletar somente feeds e metadados/excerpts limitados.
- CC BY-ND continua bloqueado para paráfrase pela IA.
- Nenhuma chamada externa nova em `astro build`.
- Carta `1.0.3`; allowlist `1.2.0`; changelog `1.0.3`; approval aponta para este plano.
- Não reescrever `src/data/diario/edicoes/2026-11-23.json`.
- Commit com caminhos explícitos; nenhum push.

## Review Focus

- Um feed desativado acidentalmente ou um feed fora do escopo volta a ser habilitado — teste de lista exata em `governance.test.ts`.
- A versão da allowlist ou da carta diverge do approval — teste de snapshot e validação de governança.
- O hash é atualizado sem corresponder aos seis arquivos — teste de hash e `verifyGovernance`.
- A coleta real não produz candidatos dos novos feeds — inspeção do cache e da curadoria.
- A edição publicada anterior é alterada — verificação de diff e do histórico do arquivo.

---

### Task 1: Fixar o novo contrato de fontes em testes

**Files:**
- Modify: `tests/diario/governance.test.ts:76-102`
- Modify: `tests/diario/governance.test.ts:252-315`

**Interfaces:**
- Consumes: `verifyGovernance(root)`, `computeCurationBundleHash(root)` e o cofre real.
- Produces: contrato exato das versões, fontes, feeds, terms e approval.

- [ ] **Step 1: Atualizar as asserções para carta `1.0.3`, allowlist `1.2.0`, fonte `camara`, quatro feeds BCB e approval do plano novo.**

Fixar a ordem `bcb`, `camara`, `ibge`, `cvm`, `tesouro-nacional`, `governo-federal`, `valor-investe`, `infomoney`, `the-conversation-brasil`; habilitados `bcb`, `camara`, `the-conversation-brasil`; objeto Câmara com publisher, kind, terms e feed exatos.

- [ ] **Step 2: Rodar o teste focado e confirmar RED.**

Run: `npx vitest run tests/diario/governance.test.ts`
Expected: falhas nas asserções de versão, fontes e feeds; nenhuma falha de sintaxe.

- [ ] **Step 3: Não alterar produção neste task; registrar o RED.**

### Task 2: Atualizar o cofre e o approval

**Files:**
- Modify: `src/data/diario/curadoria/allowlist.json`
- Modify: `src/data/diario/curadoria/carta.md`
- Modify: `src/data/diario/curadoria/changelog.md`
- Modify: `src/data/diario/curadoria/approval.json`
- Modify: `src/lib/diario/schema.ts:54`
- Test: `tests/diario/governance.test.ts`

**Interfaces:**
- Consumes: contrato do Task 1.
- Produces: cofre `1.0.3` / allowlist `1.2.0` válido para `collectInputs`.

- [ ] **Step 1: Adicionar o feed `notastecnicas` ao BCB e a fonte `camara`; bump das versões e texto de ativação na carta.**
- [ ] **Step 2: Append da entrada `1.0.3 — 2026-11-24` com escopo, evidência e exclusões.**
- [ ] **Step 3: Atualizar `APPROVED_INSTRUCTION_REF` em `src/lib/diario/schema.ts`, recomputar `computeCurationBundleHash` e atualizar `approval.json` com `charterVersion: "1.0.3"`, `approvedBy: "Yury Figueiredo"`, data UTC real e `instructionRef: "docs/superpowers/plans/2026-11-24-diario-expansao-fontes.md"`.**
- [ ] **Step 4: Rodar `npx vitest run tests/diario/governance.test.ts` e confirmar GREEN.**
- [ ] **Step 5: Mutar temporariamente o URL da Câmara, rodar o teste e confirmar RED; restaurar byte a byte e confirmar GREEN.**
- [ ] **Step 6: Commit dos testes e do cofre com caminhos explícitos.**

### Task 3: Verificar coleta, curadoria e regressões

**Files:**
- Modify: `docs/diario/mutation-ledger.md`

**Interfaces:**
- Consumes: cofre válido e coletor existente.
- Produces: evidência real e registro de verificação.

- [ ] **Step 1: Rodar `npm run diario:collect -- 2026-11-24` e inspecionar `.cache/diario/2026-11-24/inputs.json`.**
- [ ] **Step 2: Rodar `npm run diario:curate -- 2026-11-24` e conferir candidatos, clusters e decisão; não publicar.**
- [ ] **Step 3: Rodar `npx tsc --noEmit`, `npm test -- --maxWorkers=1`, `npm run build`, `npm run diario:verify-build` e `git diff --check`.**
- [ ] **Step 4: Confirmar que `src/data/diario/edicoes/2026-11-23.json` não mudou e que não houve push.**
- [ ] **Step 5: Registrar contagens, seleção, limitações e comandos no mutation ledger; commit do registro.**

### Task 4: Revisão final

**Files:**
- Review: diff desde `0e1993e43cbbc8e09eaf5772fdf95d6a42f8cf09`

**Interfaces:**
- Consumes: Tasks 1–3 concluídos.
- Produces: veredito de padrões e spec.

- [ ] **Step 1: Revisar padrões e spec em eixos separados, sem editar.**
- [ ] **Step 2: Corrigir qualquer achado crítico ou importante e repetir a verificação afetada.**
- [ ] **Step 3: Confirmar worktree limpo, commits locais e ausência de push.**
