# Diário do Investidor — Briefing Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar toda edição material do Diário em uma leitura completa, com briefing em três blocos, painel factual dos quatro indicadores, evento quando houver e fallback determinístico para dias sem notícias.

**Architecture:** O schema passa para a versão 2 e o validador continua sendo o gate de publicação. Briefings sem notícias são gerados deterministicamente; briefings com notícias são redigidos somente sobre a seleção aprovada. O hub permanece compacto e a experiência completa fica restrita à página datada material.

**Tech Stack:** Astro 5, TypeScript estrito, Vitest 3, Node 22, `tsx`, componentes Astro estáticos e store JSON file-backed.

**Spec:** `docs/superpowers/specs/2026-11-23-diario-briefing-completo-design.md`

## Global Constraints

- O hub `/diario-do-investidor/` continua com o template atual; o briefing completo aparece somente em `[date].astro`.
- Toda edição `material` usa `schemaVersion: 2` e possui `briefing`; toda edição `morno` proíbe `briefing` e não ganha URL datada.
- `briefing.whatHappened` tem 240–1600 caracteres; `whyItMatters`, 200–1200; `whatToWatch` tem 2–4 itens de 60–320 caracteres.
- `event` é obrigatório quando `decision.eventId` existe e deve corresponder ao evento aprovado no cofre.
- Briefing sem notícias é determinístico; a IA nunca reescreve `decision.status` nem transforma rascunho material inválido em edição morna.
- Nenhum arquivo de `src/data/diario/curadoria/` muda nesta iteração.
- Nenhuma chamada externa nova em `astro build`; o arquivo datado continua sem `getIndicators()`.
- Todo número editorial vem do snapshot BCB ou de fato determinístico; a prosa editorial não contém algarismos.
- O painel factual mostra Selic, CDI, IPCA acumulado e Dólar/PTAX, inclusive quando ausentes, sem inventar valor ou data.
- Sem paywall, sem copiar corpo de matéria e sem recomendação de compra/venda.
- The Conversation Brasil permanece sob CC BY-ND: excerpt literal curto, atribuição e link; nunca insumo para paráfrase, resumo ou tradução pela IA.
- Preservar os arquivos já sujos em `src/pages/privacidade.astro`, `tests/planilha.test.ts` e `docs/privacidade/`.
- `origin/main` é a fonte da verdade. Confirmar a base antes da primeira edição; se `origin/main` não for ancestral de `HEAD`, parar para integração segura.
- Commit com caminhos explícitos; nunca `git add -A`.
- Mudança visual exige frame local desktop/mobile, aprovação do dono e só então push. Aprovação do design não aprova publicação.
- Nenhum push está autorizado nesta iteração.

## Review Focus

- **Edição material sem notícias com briefing ausente, genérico ou divergente:** o leitor recebe os três blocos completos e o validador exige o resultado determinístico exato. Testes: `schema.test.ts > requires a briefing for material editions`, `briefing.test.ts > builds deterministic briefing for a dollar-trigger edition`, `validate.test.ts > rejects a deterministic briefing that differs from the approved facts`.
- **Briefing de notícia copiado de edição anterior:** a similaridade e a igualdade normalizada de seções rejeitam republicação, mesmo que os itens tenham sido levemente reescritos. Teste: `validate.test.ts > rejects a news briefing copied from a recent material edition`.
- **Indicador ausente, stale ou dólar sem variação:** a UI mostra ausência/origem sem zerar valor nem inventar data, e a variação só aparece quando existe. Teste: `surface.test.ts > renders all four indicators including unavailable values without inventing freshness`.
- **Evento referenciado mas diferente do cofre:** a edição não publica evento de outra data, título ou URL. Teste: `validate.test.ts > rejects an event that does not match the approved calendar`.
- **Automação produzindo schema antigo ou rebaixando material inválido:** o prompt exige schema 2, briefing e parada em caso de rascunho inválido. Teste: `automation-prompt.test.ts > forbids schema drift, status rewriting and vault edits`.

---

## Context

A Task 5 do plano original foi concluída e o template do hub/arquivo foi aprovado. A seed atual é material por variação do dólar, mas não possui notícias, fontes públicas nem narrativa editorial; por isso `SourceList` desaparece e o artigo fica incompleto.

Esta iteração implementa o design aprovado sem reabrir a política do cofre. A base esperada é o commit `dfe1179` da branch `feat/diario-do-investidor`; o documento de design e este plano entram no commit inicial da iteração.

## File Structure

```text
src/lib/diario/types.ts                    # EditorialBriefing e Edition schema 2
src/lib/diario/schema.ts                   # parsing estrito de briefing/evento
src/lib/diario/briefing.ts                 # fallback determinístico sem notícias
src/lib/diario/curate.ts                   # payload editorial compartilhado e delta
src/lib/diario/validate.ts                 # gate de briefing, evento e duplicação
scripts/diario/curate.ts                   # grava briefing.json quando aplicável
scripts/diario/verify-build.ts             # confere headings do artigo no dist
src/data/diario/edicoes/2026-11-23.json     # seed migrada para schema 2
src/components/diario/EditionBody.astro    # variantes hub/article
src/components/diario/IndicatorGrid.astro  # quatro indicadores, ausência e fonte BCB
src/components/diario/EventCard.astro      # cartão do evento oficial
src/pages/diario-do-investidor/[date].astro # artigo completo com snapshot próprio
src/pages/diario-do-investidor/metodologia.astro
docs/diario/automation-prompt.md           # Task 7 antecipada, schema 2
docs/diario/mutation-ledger.md             # mutações desta iteração
AGENTS.md                                  # regra operacional do Diário
tests/diario/fixtures.ts                   # fixtures schema 2
tests/diario/schema.test.ts
tests/diario/briefing.test.ts
tests/diario/curate.test.ts
tests/diario/validate.test.ts
tests/diario/cli.test.ts
tests/diario/surface.test.ts
tests/diario/automation-prompt.test.ts
tests/seo-schema.test.ts
```

### Task 0: Registrar o design e o plano aprovados

**Files:**
- Create: `docs/superpowers/specs/2026-11-23-diario-briefing-completo-design.md`
- Create: `docs/superpowers/plans/2026-11-23-diario-briefing-completo.md`

**Interfaces:**
- Consumes: design aprovado pelo dono e plano original já executado até a Task 5.
- Produces: base documental para as tasks 1–6.

- [ ] **Step 1: Conferir branch, árvore e base remota.**

Run: `git status --short && git branch --show-current && git fetch origin main && git merge-base --is-ancestor origin/main HEAD`

Expected: branch `feat/diario-do-investidor`; somente o design e este plano novos; `origin/main` ancestral de `HEAD`. Não fazer stash, reset ou alterar o checkout principal.

- [ ] **Step 2: Commitar somente os dois documentos.**

```bash
git add docs/superpowers/specs/2026-11-23-diario-briefing-completo-design.md docs/superpowers/plans/2026-11-23-diario-briefing-completo.md
git commit -m "docs(diario): registra plano do briefing completo"
```

### Task 1: Introduzir o schema 2 de briefing e evento

**Files:**
- Modify: `src/lib/diario/types.ts`
- Modify: `src/lib/diario/schema.ts`
- Modify: `tests/diario/fixtures.ts`
- Modify: `tests/diario/schema.test.ts`
- Modify: `src/data/diario/edicoes/2026-11-23.json`

**Interfaces:**
- Produces:
  ```ts
  interface EditorialBriefing {
    whatHappened: string;
    whyItMatters: string;
    whatToWatch: string[];
  }
  interface Edition {
    schemaVersion: 2;
    briefing?: EditorialBriefing;
    event?: CalendarEvent;
  }
  ```
- Produces: `parseEditorialBriefing(value: unknown): EditorialBriefing` e `parseCalendarEvent(value: unknown, path: string): CalendarEvent`.

- [ ] **Step 1: Escrever os testes que falham em `schema.test.ts`.**

Adicionar casos com estas asserções exatas:

- `accepts a schema 2 material edition with a complete briefing`.
- `rejects a schema 1 edition`.
- `requires a briefing for material editions`.
- `rejects a briefing in a quiet edition`.
- `rejects an event in a quiet edition`.
- `accepts a material edition without an event when eventId is absent`.
- `requires an event when decision.eventId exists`.
- `rejects a briefing outside the documented length limits`.
- `rejects fewer than two or more than four watch items`.
- `rejects duplicate normalized watch items`.
- `rejects digits and HTML in every briefing prose field`.

- [ ] **Step 2: Rodar e confirmar RED.**

Run: `npx vitest run tests/diario/schema.test.ts`

Expected: falhas indicando `schemaVersion must be 2`, `briefing`/`event` ausentes ou limites não aplicados.

- [ ] **Step 3: Implementar tipos e parsing estrito.**

Em `types.ts`, adicionar `EditorialBriefing`, mudar `Edition.schemaVersion` para `2` e incluir `briefing?`/`event?`. Em `schema.ts`, extrair o parser de evento existente para `parseCalendarEvent`, exportar `parseEditorialBriefing` e usá-lo em `parseEdition`.

Aplicar os limites após `trim()`: `whatHappened` 240–1600; `whyItMatters` 200–1200; cada item de `whatToWatch` 60–320; quantidade 2–4. Rejeitar duplicatas após NFKC, minúsculas, remoção de diacríticos e colapso de espaços. Rejeitar dígitos/HTML e caracteres de controle com as regras existentes de `prose()`. Em `parseEdition`, exigir `briefing` em material e proibir `briefing`/`event` em morno; exigir `event` quando `decision.eventId` existe e proibir `event` caso contrário.

- [ ] **Step 4: Migrar fixtures e seed sem alterar o cofre.**

Em `fixtures.ts`, `draft()` passa a retornar `schemaVersion: 2`; material recebe um briefing estruturalmente válido e morno omite o campo. `previousEdition()` herda essa fixture. Na fixture local de `schema.test.ts`, fazer o mesmo.

Na seed `2026-11-23.json`, mudar somente `schemaVersion` para `2` e adicionar um briefing válido coerente com o gatilho cambial; não alterar snapshot, decisão, policy ou provenance. A Task 2 substituirá esse texto pelo resultado determinístico exato.

- [ ] **Step 5: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/schema.test.ts tests/diario/store.test.ts
git add src/lib/diario/types.ts src/lib/diario/schema.ts tests/diario/fixtures.ts tests/diario/schema.test.ts src/data/diario/edicoes/2026-11-23.json
git commit -m "feat(diario): introduz schema 2 de briefing e evento"
```

### Task 2: Gerar briefing determinístico e artefato de curadoria

**Files:**
- Create: `src/lib/diario/briefing.ts`
- Create: `tests/diario/briefing.test.ts`
- Modify: `scripts/diario/curate.ts`
- Modify: `tests/diario/cli.test.ts`
- Modify: `tests/diario/fixtures.ts`
- Modify: `src/data/diario/edicoes/2026-11-23.json`

**Interfaces:**
- Consumes: `Edition`, `EditorialBriefing`, `Vault`, `CalendarEvent` e `parseEditorialBriefing`.
- Produces: `buildDeterministicBriefing(edition: Edition, vault: Vault): EditorialBriefing`.
- Produces: `.cache/diario/<date>/briefing.json` para edição material sem clusters de notícia.

- [ ] **Step 1: Escrever os testes que falham em `briefing.test.ts`.**

Cobrir:

- `builds deterministic briefing for a dollar-trigger edition`: material por `dollar-trigger`, sem itens; texto menciona dólar e limiar, não contém dígitos e produz 2–4 observações.
- `uses the approved event in an event briefing`: `decision.eventId` aponta para evento do cofre; `whatHappened` inclui o título aprovado e o tópico deriva do evento.
- `uses the approved lesson in a monday-lesson briefing`: material por lição, dia de semana compatível; texto inclui o título da lição aprovada.
- `returns identical output for identical approved facts`.
- `rejects quiet editions and news editions`: a função só é chamada para material sem notícias.

- [ ] **Step 2: Rodar e confirmar RED.**

Run: `npx vitest run tests/diario/briefing.test.ts`

Expected: módulo `src/lib/diario/briefing.ts` ausente.

- [ ] **Step 3: Implementar o helper determinístico.**

Criar `briefing.ts` sem aleatoriedade, relógio, rede ou IA. A prioridade é: evento aprovado, lição aprovada, gatilho do dólar e, por último, composição conservadora baseada nos `reasonCodes` e no título da edição. O texto deve caber nos limites do schema e não pode conter algarismos.

Exportar `EVENT_TOPICS` de `curate.ts` e reutilizá-lo em `briefing.ts`, evitando mapas divergentes entre decisão e redação determinística.

- [ ] **Step 4: Estender o teste de CLI.**

Em `cli.test.ts`, adicionar `writes deterministic briefing without publishing a no-news material edition`: usar `inputs()` com observações de dólar que disparam materialidade, executar `curate`, ler `.cache/diario/<date>/briefing.json` e comparar com `buildDeterministicBriefing` aplicado à edição fixture correspondente. Confirmar que nenhuma URL/edião foi publicada.

Adicionar também a negativa: com uma fonte oficial selecionada e clusters de notícia, `curate` não grava `briefing.json`.

- [ ] **Step 5: Implementar o artefato no CLI.**

Em `scripts/diario/curate.ts`, manter `selection.json` e, quando `decision.status === 'material'` e `newsClusterIds.length === 0`, construir o briefing a partir da decisão, snapshot e cofre, validar com `parseEditorialBriefing` e gravar `.cache/diario/<date>/briefing.json` com JSON determinístico e newline final.

- [ ] **Step 6: Migrar fixtures e seed para o resultado determinístico.**

Atualizar `tests/diario/fixtures.ts` para usar `buildDeterministicBriefing` em material sem notícias. Aplicar o mesmo helper à seed migrada e preservar seus fatos. Validar a seed com `parseEdition`.

- [ ] **Step 7: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/briefing.test.ts tests/diario/cli.test.ts tests/diario/curate.test.ts
git add src/lib/diario/briefing.ts src/lib/diario/curate.ts scripts/diario/curate.ts tests/diario/briefing.test.ts tests/diario/cli.test.ts tests/diario/fixtures.ts src/data/diario/edicoes/2026-11-23.json
git commit -m "feat(diario): gera briefing deterministico em dias sem noticias"
```

### Task 3: Fechar validação, evento e anti-duplicação

**Files:**
- Modify: `src/lib/diario/curate.ts`
- Modify: `src/lib/diario/validate.ts`
- Modify: `tests/diario/curate.test.ts`
- Modify: `tests/diario/validate.test.ts`
- Modify: `tests/diario/fixtures.ts`

**Interfaces:**
- Consumes: `buildDeterministicBriefing`, `parseEditorialBriefing`, `parseCalendarEvent`.
- Produces: `editorialPayload(edition: Edition): string` exportado de `curate.ts`.

- [ ] **Step 1: Escrever os testes que falham.**

Em `validate.test.ts`, adicionar:

- `rejects a deterministic briefing that differs from the approved facts`.
- `rejects a news briefing copied from a recent material edition`.
- `rejects an event that does not match the approved calendar`.
- `rejects an event date that differs from the edition date`.
- `allows recurring deterministic explanations when the factual differential changes`.
- `rejects repeated no-news material editions with the same factual differential`.

Em `curate.test.ts`, ajustar ou adicionar casos para provar que o delta de notícia compara o texto candidato contra `editorialPayload` das edições anteriores, incluindo briefing, e que evidência de evento copiada do payload anterior não reabre o evento.

- [ ] **Step 2: Rodar e confirmar RED.**

Run: `npx vitest run tests/diario/validate.test.ts tests/diario/curate.test.ts`

Expected: as mutações de briefing/evento ainda são aceitas.

- [ ] **Step 3: Compartilhar o payload editorial.**

Em `curate.ts`, exportar `editorialPayload(edition)` incluindo `title`, `summary`, todos os campos dos itens, todos os blocos do briefing, lição e, quando existir, título e URL oficial do evento. Remover a função privada equivalente de `validate.ts` e importar a versão compartilhada.

Atualizar a comparação de clusters e de evidência de evento para usar esse payload completo contra as edições materiais anteriores.

- [ ] **Step 4: Validar evento e briefing determinístico.**

Em `validate.ts`, após validar cofre e decisão:

- Se `decision.eventId` existe, exigir `edition.event` e comparar objeto por objeto com `vault.calendar`; exigir `event.date === edition.date`.
- Se `decision.eventId` não existe, rejeitar `edition.event`.
- Se material sem itens, comparar `edition.briefing` com `buildDeterministicBriefing(edition, vault)` usando igualdade profunda.
- Se material com itens, manter o briefing obrigatório pelo schema, sem impor texto determinístico.

- [ ] **Step 5: Diferenciar duplicação por tipo de edição.**

Para duas edições sem notícias, não comparar somente os templates fixos. Comparar um `factualDifferential` contendo `reasonCodes`, `eventId`, `lessonId`, entradas de `snapshot.measured` e `dollarChangePct`; diferença factual permite nova edição, diferencial idêntico rejeita.

Para edições com notícias, manter o limiar Jaccard `0.80` sobre `editorialPayload` e rejeitar qualquer seção do briefing cujo texto normalizado seja idêntico ao de uma das dez edições materiais recentes.

- [ ] **Step 6: Ajustar fixtures sem enfraquecer testes.**

Onde testes alteram `decision`, `items`, `sources`, `lesson` ou `event`, atualizar o briefing/evento da fixture para manter a coerência antes de testar a regra-alvo. Não remover asserções existentes.

- [ ] **Step 7: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/validate.test.ts tests/diario/curate.test.ts tests/diario/briefing.test.ts tests/diario/cli.test.ts
git add src/lib/diario/curate.ts src/lib/diario/validate.ts tests/diario/curate.test.ts tests/diario/validate.test.ts tests/diario/fixtures.ts
git commit -m "fix(diario): valida briefing, evento e novidade editorial"
```

### Task 4: Construir o artigo completo e o painel factual

**Files:**
- Create: `src/components/diario/EventCard.astro`
- Create: `tests/diario/surface.test.ts`
- Modify: `src/components/diario/EditionBody.astro`
- Modify: `src/components/diario/IndicatorGrid.astro`
- Modify: `src/pages/diario-do-investidor/index.astro`
- Modify: `src/pages/diario-do-investidor/[date].astro`
- Modify: `scripts/diario/verify-build.ts`

**Interfaces:**
- Produces:
  ```ts
  interface IndicatorRow {
    key: MeasuredKey;
    value: number | null;
    observedOn: string | null;
    origin: 'bcb-sgs' | 'stale' | 'unavailable' | 'config-fallback';
  }
  interface EditionBodyProps {
    edition: Edition;
    variant: 'hub' | 'article';
    showSummary?: boolean;
  }
  ```
- Consumes: `edition.briefing`, `edition.event`, `edition.snapshot.measured` e `edition.snapshot.dollarChangePct`.

- [ ] **Step 1: Escrever os testes de superfície que falham.**

Em `surface.test.ts`, usar leitura de fonte como os testes existentes e verificar:

- Hub passa `variant="hub"` e arquivo passa `variant="article"`.
- O artigo contém os headings “O que aconteceu”, “Por que importa” e “O que observar”.
- O hub não recebe os novos headings do briefing completo.
- `EventCard.astro` é renderizado apenas quando `edition.event` existe.
- Cada item de notícia liga suas fontes selecionadas e a lista final `SourceList` permanece.
- `[date].astro` renderiza o resumo antes do grid, passa `variant="article"` e `showSummary={false}`, declarando as quatro chaves `['selic', 'cdi', 'ipca12m', 'dolar']`, usando `null` para ausentes e sem importar/chamar `getIndicators`.
- `IndicatorGrid.astro` mostra “Indisponível” para `value === null`, não formata zero/NaN e preserva `observedOn`.
- O arquivo passa `dollarChangePct` e ativa a nota de fonte BCB com os códigos `432`, `4389`, `13522` e `1`.
- `verify-build.ts` verifica os três headings em toda página material.

- [ ] **Step 2: Rodar e confirmar RED.**

Run: `npx vitest run tests/diario/surface.test.ts`

Expected: variante, headings, ausências e códigos ainda não existentes.

- [ ] **Step 3: Ampliar `IndicatorGrid` sem quebrar o hub.**

Alterar a linha para `value: number | null` e `observedOn: string | null`. Quando `value` for `null`, renderizar “Indisponível” sem data. Manter formatação existente para números e todos os rótulos/origens atuais.

Adicionar props opcionais `dollarChangePct?: number | null` e `showBcbSource?: boolean`. A variação só é renderizada quando não nula, com rótulo explícito de comparação à observação anterior. A nota BCB lista os códigos das quatro séries e é ativada somente no arquivo datado.

- [ ] **Step 4: Implementar as variantes de `EditionBody`.**

Tornar `variant` obrigatório e `showSummary` opcional, com padrão `true`. Em `article`, a ordem é: “O que aconteceu”, “Por que importa”, notícias, “O que observar”, lição, evento, fontes, aviso e calculadora. Cada notícia renderiza links para suas fontes por ID e a lista final permanece. Em `hub`, preservar a estrutura atual e não renderizar o briefing completo nem o cartão de evento.

Criar `EventCard.astro` para data, título e link oficial do `CalendarEvent`, sem JavaScript. Aplicar corpo com medida de 68–72 caracteres e `line-height` 1,75–1,85; resumo com corpo maior e `text-wrap: pretty`; títulos com `text-wrap: balance`; separadores por espaço e régua fina; régua lateral discreta em “Por que importa”; lista de acompanhamento sem aparência de checklist; fontes legíveis; e `font-variant-numeric: tabular-nums` nos dados. Manter foco visível, contraste e layout responsivo até 390 px, sem animação ou JavaScript novo. Escopar tudo isso à variante `article`.

- [ ] **Step 5: Montar os quatro indicadores no arquivo datado.**

Em `[date].astro`, mover `edition.summary` para o header, antes do grid, e passar `showSummary={false}` ao corpo. Assim, no mobile, o painel aparece logo após o resumo e antes do desenvolvimento; no desktop, permanece na coluna lateral. Mapear as quatro chaves fixas; para cada chave usar a medição publicada ou `{ value: null, observedOn: null, origin: 'unavailable' }`. Passar `edition.snapshot.dollarChangePct` e `showBcbSource={true}`. Não consultar `getIndicators`.

- [ ] **Step 6: Fortalecer o verificador de build.**

Em `verify-build.ts`, para cada página material, exigir os três headings do briefing. Não exigir fonte externa em edição sem notícias e não criar URL para morno.

- [ ] **Step 7: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/surface.test.ts tests/diario/store.test.ts tests/seo-schema.test.ts
git add src/components/diario/EventCard.astro src/components/diario/EditionBody.astro src/components/diario/IndicatorGrid.astro src/pages/diario-do-investidor/index.astro src/pages/diario-do-investidor/[date].astro scripts/diario/verify-build.ts tests/diario/surface.test.ts
git commit -m "feat(diario): apresenta briefing completo e painel factual"
```

### Task 5: Atualizar metodologia e antecipar a automação

**Files:**
- Modify: `src/pages/diario-do-investidor/metodologia.astro`
- Modify: `tests/seo-schema.test.ts`
- Create: `docs/diario/automation-prompt.md`
- Create: `tests/diario/automation-prompt.test.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: prompt versionado `diario-2026-11-23-briefing-v2`.
- Consumes: schema 2, `selection.json` e `briefing.json` da Task 2.

- [ ] **Step 1: Escrever os testes que falham.**

Em `seo-schema.test.ts`, exigir que a metodologia explique “O que aconteceu”, “Por que importa”, “O que observar”, o fallback determinístico e que o hub permanece compacto.

Em `automation-prompt.test.ts`, exigir no prompt:

- `git pull --ff-only`, lock, parada em árvore suja e preservação de arquivos alheios.
- `npm run diario:collect` e `npm run diario:curate`.
- Título e resumo específicos, leitura exclusiva de `selection.json` para notícias e de `briefing.json` em material sem notícias.
- `schemaVersion: 2`, `briefing` obrigatório em material e proibido em morno, no máximo três notícias e quatro acompanhamentos.
- Descarte de fonte sem lastro e recálculo da seleção determinística; queda para morno somente se a camada determinística não encontrar razão material.
- `npm run diario:validate -- --publish`, `npm test`, `npm run build` e `git diff --check`.
- Proibição de `git add -A`, edição do cofre, alteração de `decision.status`, sobrescrita do mesmo dia e rebaixamento de material inválido.
- Proibição de copiar corpo de matéria, acessar paywall, usar excerpt CC BY-ND como paráfrase, inventar números, publicar recomendação ou incluir cripto.
- Versão exata `diario-2026-11-23-briefing-v2`.

- [ ] **Step 2: Rodar e confirmar RED.**

Run: `npx vitest run tests/seo-schema.test.ts tests/diario/automation-prompt.test.ts`

Expected: metodologia e arquivo de prompt ainda não cobrem o contrato novo.

- [ ] **Step 3: Atualizar a metodologia.**

Explicar os três blocos, o painel factual, a diferença entre hub e arquivo, o uso de evento do cofre e o fallback determinístico. Deixar explícito que material inválido para a automação, sem inventar exceção silenciosa.

- [ ] **Step 4: Escrever o prompt e a regra operacional.**

Criar `docs/diario/automation-prompt.md` com o workflow completo e a versão exata. Em notícias, a IA escreve o briefing somente com os IDs selecionados e mantém no máximo três itens. Sem notícias, copia o briefing determinístico validado do cache. Em dúvida de lastro, descarta a fonte e recalcula a seleção; nunca decide materialidade.

Adicionar em `AGENTS.md` uma seção curta “Diário e schema” apontando para o prompt e registrando: schema 2, briefing obrigatório em material, cofre imutável e parada em rascunho inválido.

- [ ] **Step 5: Rodar GREEN e commit.**

```bash
npx vitest run tests/seo-schema.test.ts tests/diario/automation-prompt.test.ts
git add src/pages/diario-do-investidor/metodologia.astro tests/seo-schema.test.ts docs/diario/automation-prompt.md tests/diario/automation-prompt.test.ts AGENTS.md
git commit -m "docs(diario): atualiza metodologia e prompt do schema 2"
```

### Task 6: Verificação, mutação, frames e revisão final

**Files:**
- Modify: `docs/diario/mutation-ledger.md`
- No production changes expected unless verification finds a defect.

**Interfaces:**
- Consumes: todas as tasks anteriores.
- Produces: evidência de mutação, frames desktop/mobile, revisão e handoff sem push.

- [ ] **Step 1: Rodar a suíte completa e o build.**

```bash
npx tsc --noEmit
npm test -- --maxWorkers=1
npm run build
npm run diario:verify-build
git diff --check
```

Expected: TypeScript limpo, todos os testes passam, build sem erro, dist com headings do briefing e nenhuma URL morna.

- [ ] **Step 2: Executar e registrar mutações novas.**

Seguir o padrão do ledger existente, restaurando cada arquivo em `finally`. Registrar as mutações explícitas do design, isoladas uma a uma:

1. Remover cada uma das três seções obrigatórias do briefing.
2. Inserir algarismo e, separadamente, HTML no briefing.
3. Reduzir “O que observar” a um único item.
4. Inserir briefing em edição morna.
5. Alterar o briefing determinístico de um dia sem notícias.
6. Copiar o briefing de uma edição material com notícias.
7. Referenciar evento divergente do cofre.
8. Ocultar indicador ausente e, separadamente, ocultar a variação cambial existente.
9. Permitir no prompt reescrita de `decision.status` ou schema antigo.

Expected: cada mutação produz falha no teste correspondente; nenhuma mutação permanece no código.

- [ ] **Step 3: Capturar frames locais.**

Subir o servidor local e capturar em desktop e mobile:

- hub, para provar que o template compacto não mudou;
- arquivo material da seed sem notícias, com os três blocos e indicador ausente;
- metodologia;
- menu mobile;
- um artigo material com notícias e evento, usando uma fixture temporária `src/data/diario/edicoes/2026-11-22.json` criada apenas para a captura.

Remover a fixture temporária após as capturas e antes do build final. Conferir zero erros de console.

- [ ] **Step 4: Apresentar os frames e aguardar aprovação visual.**

Entregar os caminhos das imagens ao dono. Não fazer push. Se houver ajuste visual, corrigir com teste primeiro quando houver comportamento testável e repetir a captura.

- [ ] **Step 5: Fazer revisão final da branch.**

Usar `code-review` com ponto fixo anterior à Task 0, spec novo e plano novo em eixos separados de standards/spec. Corrigir achados críticos/importantes com RED→GREEN e repetir a suíte serial. Registrar minors deferidos.

- [ ] **Step 6: Commitar evidência e encerrar sem publicar.**

```bash
git add docs/diario/mutation-ledger.md
git commit -m "test(diario): registra mutacoes do briefing completo"
git status --short
```

Expected: árvore limpa no worktree, frames aprovados, nenhum push e nenhuma alteração no checkout principal sujo.

## Verification Final

- Schema 1 é rejeitado; material exige briefing e morno o proíbe.
- Briefing sem notícias é determinístico, validado e gravado em `briefing.json`.
- Briefing com notícias entra no delta e seção copiada é rejeitada.
- Evento publicado corresponde ao cofre e à data da edição.
- O arquivo material mostra os quatro indicadores, inclusive ausentes, com origem e fonte BCB.
- O hub permanece compacto e sem briefing completo.
- Metodologia e prompt de automação refletem schema 2.
- Mutation ledger registra todas as mutações explícitas do design e as anteriores.
- Suíte serial, TypeScript, build, `diario:verify-build` e `git diff --check` passam.
- Frames desktop/mobile foram inspecionados e aprovados antes de qualquer push.
- Nenhum push foi feito; a primeira execução real da automação no Mac continua pendente.
