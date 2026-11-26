# Restauração local do Diário — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Produzir uma prévia local completa do Diário com a edição do dia, testar o contrato operacional e deixar o trabalho preservado sem commit, push ou execução da automação.

**Architecture:** O commit local anterior é preservado numa branch de fonte; o checkout canônico recebe `origin/main`, o patch de preflight e a restauração pontual da superfície. A edição do dia passa pelo fluxo determinístico existente e pelo build online antes de o trabalho ser movido para uma branch local de prévia.

**Tech Stack:** Astro 5, TypeScript strict, Node.js 22, Vitest 3, Git CLI, scripts existentes do Diário.

**Spec:** `docs/superpowers/specs/2026-11-23-diario-do-investidor-design.md` e `docs/superpowers/specs/2026-11-26-diario-automation-preflight-design.md`.

## Global Constraints

- Não configurar nem acionar o Qoder; não usar “Run now”.
- Não criar commit, não fazer push e não publicar.
- O cofre `src/data/diario/curadoria/` é somente leitura.
- Nunca usar `git add -A`, `git reset --hard`, `git clean`, `rm -rf`, stash ou remoção de lock alheio.
- Preservar qualquer alteração alheia; o checkout canônico precisa estar limpo antes do pull.
- A data da edição é `2026-11-26` em `America/Sao_Paulo`.
- O prompt operacional é `diario-2026-11-26-preflight-v3`.
- A publicação automática continua desarmada até aprovação visual e integração explícita.

## Review Focus

- O checkout canônico está atrás de `origin/main`; o pull remove as rotas que hoje aparecem só pelo commit local anterior.
- O patch de preflight e a restauração da superfície se sobrepõem em `verify-build.ts` e `surface.test.ts`; aplicar cada fonte no arquivo certo.
- O preflight deve falhar com a superfície ausente e passar depois da restauração, sem criar lock ou cache.
- A edição do dia não pode sobrescrever edição existente nem alterar `decision.status`.
- O estado final deve preservar a prévia sem deixar `main` sujo nem permitir que a automação passe o preflight acidentalmente.

---

### Task 1: Preservar a fonte e sincronizar o checkout canônico

**Files:** nenhum arquivo de conteúdo; somente refs Git.

- [ ] **Step 1: Confirmar árvore limpa e commit atual**

Run: `git status --porcelain=v1 && git rev-parse HEAD && git branch --show-current`.

Expected: saída vazia do status, HEAD `8daec29a5ee755df70a1c73a4d5f5a173ecb973b`, branch `main`.

- [ ] **Step 2: Preservar o commit com a superfície restaurada**

Run: `git branch fix/diario-restauracao-fonte-2026-11-26 HEAD`.

Expected: branch local criada sem novo commit.

- [ ] **Step 3: Atualizar a base canônica**

Run: `git pull --ff-only origin main`.

Expected: fast-forward para `4c9a84b1f5efd4d3b871f49baa36ef8acdde1215`, árvore limpa e Diário offline.

- [ ] **Step 4: Confirmar a igualdade com o remoto**

Run: `git rev-parse HEAD && git rev-parse refs/remotes/origin/main && git status --porcelain=v1`.

Expected: hashes iguais e status vazio.

### Task 2: Aplicar o preflight e provar o bloqueio da superfície offline

**Files:**

- Modify: `AGENTS.md`, `docs/diario/automation-prompt.md`, `docs/diario/mutation-ledger.md`, `package.json`, `scripts/diario/verify-build.ts`, `tests/diario/automation-prompt.test.ts`, `tests/diario/surface.test.ts`.
- Create: `scripts/diario/preflight.ts`, `src/lib/diario/preflight.ts`, `tests/diario/preflight.test.ts`, os dois documentos de design/plano do preflight e este plano.

- [ ] **Step 1: Gerar o patch somente das alterações rastreadas do worktree**

Run: `git -C .worktrees/diario-nav-destaque diff --binary > /tmp/diario-preflight.patch`.

Expected: patch não vazio, sem binários ou arquivos alheios.

- [ ] **Step 2: Conferir e aplicar o patch no canônico**

Run: `git apply --check /tmp/diario-preflight.patch && git apply /tmp/diario-preflight.patch`.

Expected: aplicação limpa, apenas working tree modificada.

- [ ] **Step 3: Copiar os arquivos novos explicitamente**

Copiar da worktree para o canônico: `docs/superpowers/plans/2026-11-26-diario-automation-preflight.md`, `docs/superpowers/specs/2026-11-26-diario-automation-preflight-design.md`, `scripts/diario/preflight.ts`, `src/lib/diario/preflight.ts`, `tests/diario/preflight.test.ts` e `docs/superpowers/plans/2026-11-26-diario-restauracao-local.md`.

Expected: seis arquivos presentes, sem `git add`.

- [ ] **Step 4: Rodar o preflight e confirmar RED**

Run: `npm run diario:preflight`.

Expected: código um por rota pública ausente; nenhum `.cache/diario/automation.lock` criado.

### Task 3: Restaurar a superfície local e confirmar o preflight

**Files:** os dez arquivos da restauração que não pertencem ao patch de preflight.

- [ ] **Step 1: Restaurar somente a superfície e seus testes da branch de fonte**

Run: `git restore --source=fix/diario-restauracao-fonte-2026-11-26 --worktree -- astro.config.mjs src/components/Footer.astro src/components/Header.astro src/pages/api/diario/edicao.json.ts 'src/pages/diario-do-investidor/[date].astro' src/pages/diario-do-investidor/index.astro src/pages/diario-do-investidor/metodologia.astro src/pages/index.astro tests/diario/store.test.ts tests/seo-schema.test.ts`.

Expected: páginas, endpoint, links e testes restaurados; `verify-build.ts` e `surface.test.ts` permanecem na versão do preflight.

- [ ] **Step 2: Rodar o preflight e confirmar GREEN**

Run: `npm run diario:preflight`.

Expected: caminho canônico aprovado, branch `main`, remoto único e onze arquivos obrigató presentes.

- [ ] **Step 3: Rodar TypeScript e testes focados**

Run: `npx tsc --noEmit && npx vitest run tests/diario/preflight.test.ts tests/diario/surface.test.ts tests/diario/automation-prompt.test.ts`.

Expected: TypeScript limpo e todos os testes focados aprovados.

### Task 4: Gerar e validar a edição do dia

**Files:**

- Create: `.cache/diario/2026-11-26/selection.json`, artefatos de coleta e `draft.json`.
- Create: `src/data/diario/edicoes/2026-11-26.json` somente pela validação.

- [ ] **Step 1: Inspecionar cache existente sem apagar nada**

Run: `test ! -e src/data/diario/edicoes/2026-11-26.json && if test -d .cache/diario/2026-11-26; then find .cache/diario/2026-11-26 -maxdepth 2 -type f -print; fi`.

Expected: edição inexistente; qualquer cache preexistente é inspecionado antes de reuso.

- [ ] **Step 2: Coletar e recurar**

Run: `npm run diario:collect && npm run diario:curate`.

Expected: códigos zero e `selection.json` novo; `briefing.json` somente se a decisão determinística for material sem notícias.

- [ ] **Step 3: Ler a decisão e redigir o rascunho**

Ler `selection.json` e, quando existir, `briefing.json`. Escrever `.cache/diario/2026-11-26/draft.json` seguindo integralmente `docs/diario/automation-prompt.md`: sem alterar `decision.status`, sem fontes fora da seleção, sem algarismos/HTML na prosa e sem cripto ou recomendação.

Expected: rascunho específico da data, com briefing determinístico copiado sem alteração quando aplicável.

- [ ] **Step 4: Validar e gravar a edição local**

Run: `npm run diario:validate -- --publish`.

Expected: validação aprovada e criação de `src/data/diario/edicoes/2026-11-26.json`; nenhuma outra edição alterada.

### Task 5: Verificar a experiência local completa

**Files:** build gerado e prévias locais.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`.

Expected: zero falhas.

- [ ] **Step 2: Gerar o build e verificar a superfície online**

Run: `npm run build && npm run diario:verify-build -- --online`.

Expected: build aprovado, hub e edição material presentes, endpoint igual à última edição.

- [ ] **Step 3: Repetir os portões finais**

Run: `npm run diario:preflight && git diff --check`.

Expected: preflight aprovado e diff sem erros.

- [ ] **Step 4: Subir a prévia local**

Run: `npm run dev -- --host 0.0.0.0`.

Expected: servidor disponível em `http://localhost:4321/`; hub, arquivo da edição, metodologia e endpoint respondem com sucesso.

- [ ] **Step 5: Verificar as rotas e registrar evidência visual**

Usar browser/Playwright disponível para abrir o hub e a edição em desktop e mobile, conferir headings, painel factual, links e console. Salvar capturas em `.cache/diario/2026-11-26/preview/` e relatar qualquer divergência.

Expected: fluxo principal renderizado sem erro; se não houver browser, declarar a limitação em vez de afirmar aprovação visual.

### Task 6: Preservar a prévia sem publicar

- [ ] **Step 1: Mover as alterações para uma branch local**

Run: `git switch -c fix/diario-preview-local-2026-11-26`.

Expected: alterações carregadas sem commit; `main` deixa de ser a branch ativa e o preflight bloqueia por branch incorreta.

- [ ] **Step 2: Confirmar o estado final**

Run: `git status --short && git branch --show-current && git log -1 --oneline`.

Expected: branch `fix/diario-preview-local-2026-11-26`, HEAD ainda em `4c9a84b`, alterações locais preservadas e nenhum commit novo.

- [ ] **Step 3: Entregar a prévia**

Informar URL local, caminho das capturas e resumo dos portões. Não commitar, não fazer push e não acionar a automação.
