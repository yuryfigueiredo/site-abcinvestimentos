# Preflight da automação do Diário — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [x]`) para rastreamento.

**Goal:** Impedir que a automação do Diário escreva em pasta, branch, remote ou superfície diferente do contrato aprovado.

**Architecture:** Uma biblioteca determinística verifica o repositório e os arquivos obrigatórios; um CLI sem argumentos a invoca a partir de `process.cwd()`. O prompt chama esse CLI antes do lock e versão o contrato operacional.

**Tech Stack:** Node.js 22, TypeScript strict, Vitest 3, Git CLI.

**Spec:** `docs/superpowers/specs/2026-11-26-diario-automation-preflight-design.md`

## Global Constraints

- Não configurar Qoder, não agendar automação e não alterar site, cofre ou conteúdo publicado.
- Nenhum commit ou push nesta etapa sem pedido explícito do dono.
- Preflight não escreve arquivos, não cria lock/cache e não faz chamada externa.
- CLI não aceita `--root`; somente a biblioteca recebe raiz esperada opcional para testes.
- Caminho de produção: `/home/yury/Documentos/Projeto/abcinvestimentos`.
- Branch: `main`.
- Remote de pull e push: `git@github.com-abcinvestimentos:yuryfigueiredo/site-abcinvestimentos.git`.
- Prompt versão: `diario-2026-11-26-preflight-v3`.
- Commit futuro da automação usa caminhos explícitos; `git add -A` permanece proibido.

## Review Focus

- Caminho físico errado ou link simbólico deve falhar antes de qualquer comando Git.
- Worktree ligado ao checkout canônico deve falhar mesmo com branch e remote aparentemente corretos.
- HEAD destacado deve falhar como branch inválida.
- URL de push divergente do URL de fetch e URLs adicionais em qualquer direção devem falhar separadamente.
- Diário offline deve falhar por rota pública ausente, sem produzir edição.

---

### Task 1: Portão determinístico de repositório e superfície

**Files:**
- Create: `src/lib/diario/preflight.ts`
- Create: `scripts/diario/preflight.ts`
- Create: `tests/diario/preflight.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: constante de contrato e Git CLI.
- Produces: `DIARIO_AUTOMATION_CONTRACT`, `verifyDiarioPreflight(actualRoot, expectedRoot?)` e script npm `diario:preflight`.

- [x] **Step 1: Escrever os testes de comportamento**

Criar `tests/diario/preflight.test.ts` com repositórios temporários reais. Os fixtures criam Git em `main`, remote correto, os sete arquivos do cofre e as quatro rotas públicas. Testes:

1. `accepts the canonical repository without writing cache or lock` — não lança; `.cache` continua ausente.
2. `rejects a different physical root before reading Git metadata` — `Pasta de trabalho incorreta`.
3. `rejects a linked worktree even when its path and branch look valid` — `Worktree não permitido`.
4. `rejects a non-main branch` — `Branch incorreta`.
5. `rejects detached HEAD` — `HEAD detached`.
6. `rejects a different fetch remote` — `remote origin incorreto para pull`.
7. `rejects a different push remote` — `remote origin incorreto para push`.
8. `rejects an additional fetch URL` e `rejects an additional push URL` — mais de um URL em qualquer direção deve falhar.
9. `it.each(requiredFiles)` — cada um dos onze arquivos obrigatórios ausentes deve citar o caminho.

- [x] **Step 2: Rodar o teste e confirmar RED**

Run: `npx vitest run tests/diario/preflight.test.ts`

Expected: falha porque `src/lib/diario/preflight.ts` ainda não existe.

- [x] **Step 3: Implementar o contrato e a biblioteca**

Criar `src/lib/diario/preflight.ts` com a constante e a função do contrato. Usar `realpathSync`, `existsSync`, `statSync`, `execFileSync`, `join` e `resolve`. A função verifica, na ordem: raiz física, raiz Git, common dir igual a `<root>/.git`, branch, fetch, push e arquivos. Fetch e push usam `git remote get-url --all` e exigem exatamente um URL aprovado. Qualquer divergência lança `Error` com prefixo estável em português.

- [x] **Step 4: Implementar o CLI e o script npm**

Criar `scripts/diario/preflight.ts` que chama `verifyDiarioPreflight(process.cwd())`, imprime o caminho aprovado e define `process.exitCode = 1` em falha. Adicionar `"diario:preflight": "tsx scripts/diario/preflight.ts"` a `package.json`.

- [x] **Step 5: Rodar o teste e confirmar GREEN**

Run: `npx vitest run tests/diario/preflight.test.ts`

Expected: 20 testes aprovados.

- [x] **Step 6: Verificar o bloqueio seguro no worktree atual**

Run: `npm run diario:preflight`

Expected: código um por raiz/branch/superfície fora do contrato; nenhum `.cache/diario/automation.lock` criado.

### Task 2: Prompt versionado e ordem operacional

**Files:**
- Modify: `tests/diario/automation-prompt.test.ts`
- Modify: `docs/diario/automation-prompt.md`
- Modify: `AGENTS.md`
- Modify: `docs/diario/mutation-ledger.md`

**Interfaces:**
- Consumes: script `diario:preflight` da Task 1.
- Produces: prompt `diario-2026-11-26-preflight-v3` e testes que fixam ordem, versão e publicação condicionada.

- [x] **Step 1: Atualizar os testes do prompt para RED**

Em `tests/diario/automation-prompt.test.ts`:

- Trocar a versão esperada para `diario-2026-11-26-preflight-v3`.
- Ajustar o regex de tokens para o novo formato.
- Adicionar teste que exige, nesta ordem: `pwd -P` com a raiz canônica, `npm run diario:preflight`, `automation.lock`, `trap`, `git pull --ff-only origin main`.
- Exigir as frases de parada sem procurar outra pasta e sem corrigir divergência.
- Incluir `npm run diario:verify-build -- --online` entre build e `git diff --check`.
- Exigir `git rev-parse HEAD`, `git rev-parse refs/remotes/origin/main`, parada quando os hashes divergirem e um segundo `npm run diario:preflight` após o pull.
- Substituir a exigência de aprovação diária por publicação automática condicionada a todos os portões verdes.

- [x] **Step 2: Rodar o teste e confirmar RED**

Run: `npx vitest run tests/diario/automation-prompt.test.ts`

Expected: falhas de versão, preflight, verify-build e autorização.

- [x] **Step 3: Atualizar o prompt**

Em `docs/diario/automation-prompt.md`:

- Versionar para `diario-2026-11-26-preflight-v3`.
- Inserir a seção zero com o comando físico e `npm run diario:preflight`.
- Determinar parada imediata, sem busca de outra pasta, em qualquer divergência.
- Manter lock, cofre, curadoria e validação como estão.
- Adicionar `npm run diario:verify-build -- --online` após o build.
- Exigir igualdade entre HEAD e `refs/remotes/origin/main` e repetir o preflight depois do pull, antes de coletar ou produzir a edição.
- Registrar a autorização permanente de commit/push automático somente após todos os portões verdes, sem confundir isso com autorização para religar o Diário offline.

- [x] **Step 4: Atualizar a referência da versão**

Em `AGENTS.md`, trocar a versão do prompt para `diario-2026-11-26-preflight-v3`.

- [x] **Step 5: Rodar o teste e confirmar GREEN**

Run: `npx vitest run tests/diario/automation-prompt.test.ts`

Expected: todos os testes do prompt aprovados.

### Task 3: Verificação integral e registro de mutações

**Files:**
- Modify: `docs/diario/mutation-ledger.md`

**Interfaces:**
- Consumes: Tasks 1 e 2 verdes.
- Produces: evidência fresca e matriz de mutações do preflight.

- [x] **Step 1: Rodar TypeScript e suíte completa**

Run:

```bash
npx tsc --noEmit
npm test
```

Expected: TypeScript limpo e zero falhas na suíte.

- [x] **Step 2: Rodar build e verificadores**

Run:

```bash
npm run build
npm run diario:verify-build
git diff --check
```

Expected: build aprovado, Diário ainda offline e diff sem erros.

- [x] **Step 3: Registrar os resultados**

Acrescentar ao mutation ledger uma seção curta com a versão do prompt, os nove casos de preflight e os comandos efetivamente observados. Não registrar resultado que não tenha sido executado.

- [x] **Step 4: Revisar o diff final**

Run: `git status --short && git diff --stat && git diff --check`

Expected: somente os arquivos desta mudança; nenhuma configuração do Qoder, cofre ou rota pública alterada.

### Task 4: Corrigir os achados da revisão independente

**Files:**
- Modify: `src/lib/diario/preflight.ts`
- Modify: `scripts/diario/verify-build.ts`
- Modify: `tests/diario/preflight.test.ts`
- Modify: `tests/diario/surface.test.ts`
- Modify: `tests/diario/automation-prompt.test.ts`
- Modify: `docs/diario/automation-prompt.md`

**Interfaces:**
- Consumes: preflight e prompt das Tasks 1–3.
- Produces: remotos sem URL adicional, ref remota não ambígua, worktree de teste em `main` e verificador de build compatível com os estados offline e online.

- [x] **Step 1: Escrever testes RED para URLs múltiplas, ref qualificada e modo online**

Cobrir URL adicional de pull e push, `refs/remotes/origin/main`, `--online`, endpoint divergente e preservação do padrão offline. Fortalecer o fixture de worktree para usar `main`.

- [x] **Step 2: Implementar as correções mínimas**

Usar `get-url --all` e exigir uma única URL por direção. Qualificar a ref no prompt. Separar `verifyOffline` e `verifyOnline` no script, tornando os testes de superfície coerentes com o modo real do checkout.

- [x] **Step 3: Repetir mutações e verificação integral**

Mutações detectadas: URL adicional de pull, URL adicional de push, desligar o modo online, ignorar a igualdade do endpoint, usar `origin/main` ambíguo e remover `--online` do prompt. Depois, rodar TypeScript, suíte completa, build, verificador offline, preflight bloqueado no worktree e `git diff --check`.

- [x] **Step 4: Isolar o fixture online após a revisão**

Reproduzir o achado com uma edição posterior temporária: o fixture que copiava todas as edições falhava por página material ausente. Copiar somente a edição fixa do fixture e confirmar GREEN mesmo com a edição posterior presente; remover a edição temporária em seguida.
