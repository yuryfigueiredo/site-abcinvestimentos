# Diário do Investidor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um Diário do Investidor com curadoria diária de notícias financeiras lastreada em fontes allowlisted, hub vivo de uma URL, arquivo datado só quando há substância real, e uma automação segura no Mac.

**Architecture:** Um subsistema file-backed separa coleta determinística, decisão de materialidade, redação assistida por IA e validação. O Astro só renderiza JSON já validado; a automação roda fora do build, busca BCB/RSS, escreve um rascunho ignorado e só publica após testes e gate de proveniência.

**Tech Stack:** Astro 5, TypeScript estrito, Vitest 3, Node 22, `tsx` e `fast-xml-parser` (a instalar), RSS/HTTP allowlisted, JSON file store.

**Spec:** `docs/superpowers/specs/2026-11-23-diario-do-investidor-design.md` — a Task 0 atualiza este documento para incorporar a curadoria de notícias grounded, o cofre e a correção do rebuild diário decididos neste plano.

## Global Constraints

- Regra nº 1: trabalhar **com** o Google; nunca publicar página datada fina/duplicada só para cumprir calendário.
- Escopo inicial: `renda-fixa`, `juros`, `inflacao`, `cambio`, `bolsa-fiis`, `regulacao`. Cripto fica fora.
- Fontes: oficiais (BCB/IBGE/CVM/Tesouro/governo) + pequena allowlist de mídia confiável. Só HTTPS, hosts exatos, redirect automático desativado, cada hop revalidado, no máximo três hops e falha fechada por fonte. Sem paywall, sem copiar corpo de matéria.
- Nenhuma chamada externa nova em `astro build`. A coleta roda na automação; o build lê apenas JSON commitado e a coleta BCB já existente.
- Todos os números editoriais publicados vêm exclusivamente do snapshot BCB da edição; a prosa editorial não contém algarismos e blocos numéricos são renderizados separadamente. Não existe esquema de fato determinístico.
- Conteúdo educacional, nunca recomendação de compra/venda. Aviso fixo e não editável pela IA em toda edição.
- `origin/main` é a fonte da verdade. Antes de editar: `git pull --ff-only origin main`. Commit com caminhos explícitos; nunca `git add -A`.
- Mudança visual exige frame local desktop/mobile → aprovação do dono → só então push. Aprovação do design não aprova publicação.
- A aprovação visual cobre o **template** do Diário; edições diárias já validadas não exigem novo frame. Mudança de template ou do cofre exige nova aprovação explícita.
- Preservar os arquivos já sujos: `src/pages/privacidade.astro`, `tests/planilha.test.ts`, `docs/privacidade/`. Não reverter, fazer stash ou incluir por acidente.
- O cofre da curadoria só muda por ordem explícita do dono, registrada em `approval.json` e `changelog.md`; o hash cobre somente os seis arquivos de conteúdo e a aprovação tem campos/formatos validados.
- Automação prevista: 19:00 BRT; data da edição em `America/Sao_Paulo`; gatilho de dólar `|Δ%| >= 1,0`; lição semanal às segundas, no máximo 1 por semana ISO e só quando não há notícia/evento/gatilho.
- Automação adquire lock exclusivo antes do pull, segura até o commit e libera em cleanup `finally`-style; lock existente/stale para o run para revisão do operador, sem deleção automática.

## Review Focus

- **BCB indisponível ou observação antiga:** não apresentar fallback como dado de hoje; hub rotula origem/fallback e edição usa `stale`/`unavailable`. Teste em `tests/diario/ingest.test.ts` e `tests/diario/validate.test.ts`.
- **RSS malformado, paywall, redirect ou host fora da allowlist:** redirect automático desativado; alvo proibido nunca é requisitado; malformado/loop/excesso de hops pula somente a fonte. Teste em `tests/diario/ingest.test.ts`.
- **Notícia sem lastro ou número inventado na prosa:** rejeitar a edição; nenhum dígito em `Edition.title/summary`, `NewsItem.headline/summary/whyItMatters` ou `Lesson.title/body` e todo número editorial vem do snapshot. Teste em `tests/diario/validate.test.ts`.
- **Repetição, evento sem evidência nova ou payload materialmente similar:** comparar com as dez edições materiais recentes e cair para quiet quando não houver delta substantivo. Teste em `tests/diario/curate.test.ts` e `tests/diario/validate.test.ts`.
- **Dia morno, fim de semana ou segunda com lição já usada:** não gerar URL datada; hub/endpoint podem mostrar a edição morna. Teste em `tests/diario/curate.test.ts` e `tests/diario/store.test.ts`.
- **Mudança autônoma no cofre ou edição do mesmo dia sobrescrita:** hash/campos/formato de aprovação inválidos ou arquivo existente devem falhar. Teste em `tests/diario/governance.test.ts` e `tests/diario/validate.test.ts`.

---

## Context

O site é estático e hoje seu frescor vem apenas do rebuild do BCB. O cron atual só dispara quando a data da observação muda (`api/cron/indicadores.ts:91-107`), portanto não garante atualização diária. O dono quer notícias relevantes todos os dias para atrair visitas e criar ritual de leitura, sem produzir conteúdo em massa e mantendo o padrão YMYL.

As decisões já tomadas são: nome **Diário do Investidor**; slug `/diario-do-investidor/`; macro tradicional primeiro; fontes oficiais + mídia allowlisted; newsletter como Projeto 2 separado; repositório como cofre com aprovação + hash + teste. O hub vivo é diário; o arquivo datado só recebe edição `material`. A automação do Mac registra toda edição diária (inclusive `morno`) e o cron ganha um rebuild diário de garantia.

## File Structure

```text
src/lib/bcb.ts                         # fetch/parse BCB sem import.meta.env
src/lib/diario/types.ts                # tipos de edição, fonte, decisão e snapshot
src/lib/diario/time.ts                 # data BRT e semana ISO
src/lib/diario/schema.ts               # validação estrutural
src/lib/diario/governance.ts           # hash do cofre + aprovação
src/lib/diario/ingest.ts               # BCB/RSS allowlisted, redirect, cache
src/lib/diario/curate.ts               # decisão determinística material/morno
src/lib/diario/validate.ts             # gate final e publicação imutável
src/lib/diario/store.ts                # leitura/ordenação das edições
scripts/diario/collect.ts              # coleta + evidência ignorada
scripts/diario/curate.ts               # seleção determinística dos clusters
scripts/diario/validate.ts             # valida + publica
scripts/diario/verify-build.ts         # confere dist do Diário
src/data/diario/edicoes/<date>.json    # edições commitadas
src/data/diario/curadoria/             # cofre versionado
src/components/diario/                 # corpo, indicadores, fontes, arquivo, byline
src/pages/diario-do-investidor/        # hub, [date], metodologia
src/pages/api/diario/edicao.json.ts    # última edição para o Projeto 2
docs/diario/                           # prompt da automação + mutation ledger
tests/diario/                          # testes do subsistema
```

## Contratos de dados

```ts
type Topic = 'renda-fixa' | 'juros' | 'inflacao' | 'cambio' | 'bolsa-fiis' | 'regulacao';
type MeasuredKey = 'selic' | 'cdi' | 'ipca12m' | 'dolar';
type ReasonCode = 'calendar-event' | 'dollar-trigger' | 'official-news'
  | 'corroborated-media-news' | 'monday-lesson' | 'no-substantive-delta'
  | 'history-unavailable';

interface SourceRef {
  id: string; sourceId: string; kind: 'official' | 'media'; publisher: string;
  title: string; canonicalUrl: string; publishedAt: string | null; retrievedAt: string;
}
interface SourceCandidate extends SourceRef {
  excerpt: string; excerptSha256: string; // só no cache ignorado, nunca na edição publicada
}
interface SelectedSourceEvidence extends SourceCandidate {
  clusterId: string; topic: Topic;
}
interface Selection {
  date: string; decision: CurationDecision;
  clusters: { id: string; topic: Topic; sourceIds: string[] }[];
  selectedSources: SelectedSourceEvidence[]; eventId?: string; lessonId?: string;
}
interface NewsItem {
  id: string; topic: Topic; headline: string; summary: string;
  whyItMatters: string; sourceIds: string[];
}
interface Lesson { id: string; title: string; body: string; guideSlug: string; }
interface CalendarEvent { id: string; date: string; title: string; sourceUrl: string; }
interface BcbObservation { value: number; date: string; }
interface MeasuredValue { value: number; observedOn: string; origin: 'bcb-sgs' | 'stale' | 'unavailable'; }
interface BcbSnapshot {
  status: 'ok' | 'stale' | 'unavailable'; measured: Partial<Record<MeasuredKey, MeasuredValue>>;
  staleFields: MeasuredKey[]; dollarChangePct: number | null;
}
interface CurationDecision {
  status: 'material' | 'morno'; reasonCodes: ReasonCode[]; eventId?: string;
  lessonId?: string; newsClusterIds: string[];
}
interface Edition {
  schemaVersion: 1; id: string; date: string; generatedAt: string; title: string; summary: string;
  snapshot: BcbSnapshot; decision: CurationDecision; items: NewsItem[]; lesson?: Lesson;
  sources: SourceRef[]; relatedCalculatorSlug: string;
  policy: { charterVersion: string; allowlistVersion: string; thresholdsVersion: string;
    sourceIds: string[]; allowedHosts: string[] };
  provenance: { generator: 'qoder-diario'; promptVersion: string;
    disclaimerKey: 'educacional-nao-e-recomendacao' };
}
interface Approval {
  bundleSha256: string; charterVersion: string; approvedAt: string;
  approvedBy: string; instructionRef: string;
}
interface Vault {
  charterVersion: string; allowlistVersion: string; allowlist: AllowlistSource[]; thresholds: Thresholds;
  calendar: CalendarEvent[]; lessons: Lesson[]; bundleSha256: string; approval: Approval;
}
interface CollectedInputs {
  date: string; retrievedAt: string; bcb: Partial<Record<MeasuredKey, BcbObservation[]>>;
  sources: SourceCandidate[]; events: CalendarEvent[]; lessons: Lesson[];
  previousEditions: Edition[];
}
interface ValidationContext {
  vault: Vault; selection: Selection; evidence: SourceCandidate[];
  previousEditions: Edition[]; root?: string;
}
interface CollectOptions { root?: string; now?: Date; fetch?: typeof fetch; }
```

`AllowlistSource` e `Thresholds` são interfaces locais de `types.ts`, espelhando os JSONs do cofre. O snapshot do Diário guarda apenas os quatro indicadores medidos; a Poupança continua nas superfícies existentes. `Selection` é o único contrato de evidência lido pelo escritor: `excerpt`/`excerptSha256` ficam no cache ignorado e `SourceRef` público guarda apenas metadados da fonte. Nenhum número editorial é declarado fora de `BcbSnapshot`; thresholds numéricos permanecem internos no cofre.

---

### Task 0: Alinhar spec, plano e working tree

**Files:**
- Modify: `docs/superpowers/specs/2026-11-23-diario-do-investidor-design.md`
- Create: `docs/superpowers/plans/2026-11-23-diario-do-investidor.md`

**Interfaces:**
- Produces: spec corrigida que autoriza curadoria grounded, cofre e rebuild diário.

- [ ] **Step 1: Conferir `git status` e `git pull --ff-only origin main`.**

Parar se houver conflito; não fazer stash/reverter os arquivos sujos já existentes.

- [ ] **Step 2: Atualizar a spec.**

Remover a proibição antiga de notícias externas; registrar: macro tradicional, fontes allowlisted, hub vivo + arquivo material, automação 19:00 BRT, cron de garantia, cofre com aprovação/hash/teste e newsletter fora do escopo.

- [ ] **Step 3: Copiar este plano aprovado para `docs/superpowers/plans/2026-11-23-diario-do-investidor.md`.**

- [ ] **Step 4: Commit explícito.**

```bash
git add docs/superpowers/specs/2026-11-23-diario-do-investidor-design.md docs/superpowers/plans/2026-11-23-diario-do-investidor.md
git commit -m "docs(diario): alinha spec e plano da curadoria grounded"
```

### Task 1: Domínio, tempo e cofre da curadoria

**Files:**
- Create: `src/lib/diario/types.ts`
- Create: `src/lib/diario/time.ts`
- Create: `src/lib/diario/schema.ts`
- Create: `src/lib/diario/governance.ts`
- Create: `src/data/diario/curadoria/carta.md`
- Create: `src/data/diario/curadoria/allowlist.json`
- Create: `src/data/diario/curadoria/thresholds.json`
- Create: `src/data/diario/curadoria/calendario.json`
- Create: `src/data/diario/curadoria/licoes.json`
- Create: `src/data/diario/curadoria/changelog.md`
- Create: `src/data/diario/curadoria/approval.json`
- Test: `tests/diario/time.test.ts`
- Test: `tests/diario/schema.test.ts`
- Test: `tests/diario/governance.test.ts`

**Interfaces:**
- Produces: `Topic`, `MeasuredKey`, `ReasonCode`, `SourceRef`, `SourceCandidate`, `SelectedSourceEvidence`, `Selection`, `NewsItem`, `Lesson`, `BcbObservation`, `MeasuredValue`, `BcbSnapshot`, `CurationDecision`, `Edition`, `Approval`.
- Produces: `currentDateBrt(now?: Date): string`, `isoWeekKey(date: string): string`, `parseEdition(value: unknown): Edition`.
- Produces: `computeCurationBundleHash(root?: string): string`, `verifyGovernance(root?: string): void`.

- [ ] **Step 1: Escrever os testes que falham.**

`time.test.ts`: `2026-11-23T00:30:00Z` → `2026-11-22`; `2026-11-23T03:30:00Z` → `2026-11-23`; semana ISO estável.

`schema.test.ts`: aceita edição material com fontes; rejeita dígito/HTML em prosa editorial; rejeita `status` inválido, campo obrigatório ausente e número editorial fora do snapshot.

`governance.test.ts`: aprovação válida passa; mutar `dollarAbsChangePct` sem atualizar hash falha; hash inválido falha; versão do charter divergente do changelog falha; tópico `cripto` falha. `missing approval field fails` e `invalid approval field format fails` cobrem ausência e formato inválido de `bundleSha256`, `charterVersion`, `approvedAt`, `approvedBy` e `instructionRef`; `non-plan instructionRef fails` rejeita referência fora do plano commitado.

- [ ] **Step 2: Rodar e confirmar RED.**

```bash
npx vitest run tests/diario/time.test.ts tests/diario/schema.test.ts tests/diario/governance.test.ts
```

Esperado: módulos ausentes.

- [ ] **Step 3: Implementar tipos, tempo, schema e cofre.**

`carta.md` registra nome, escopo tradicional, política de fontes, critério material/morno, cadência, automação, regra de mudança e newsletter fora do escopo, com o rationale YMYL/Google. O procedimento de mudança é: ordem explícita → editar arquivos do cofre → append no changelog → recomputar hash → atualizar `approval.json` com `instructionRef` → rodar os testes. `thresholds.json` fixa: `timezone=America/Sao_Paulo`, `runLocal=19:00`, `dollarAbsChangePct=1.0`, `lessonWeekday=1`, `maxLessonsPerIsoWeek=1`, `lessonOnlyWhenQuiet=true`, `newsWindowHours=24`, `minMediaSources=2`, `maxItems=3`, topics tradicionais e eventos `copom/ipca/igp-m/payroll/fomc`.

`approval.json` contém `bundleSha256`, `charterVersion`, `approvedAt`, `approvedBy: "Yury Figueiredo"` e `instructionRef: "docs/superpowers/plans/2026-11-23-diario-do-investidor.md"`. O hash SHA-256 cobre somente os bytes dos seis arquivos de conteúdo em ordem fixa: `carta.md`, `allowlist.json`, `thresholds.json`, `calendario.json`, `licoes.json`, `changelog.md`, separados por `path + \0 + bytes + \0`; `approval.json` fica excluído. A validação exige `bundleSha256` em `/^[a-f0-9]{64}$/` e igual ao hash computado; `charterVersion` em `/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/`, sem espaços nas pontas e igual ao charter/changelog; `approvedAt` em `YYYY-MM-DDTHH:mm:ssZ`, parseável; `approvedBy` com um a 120 caracteres após trim e sem caracteres de controle; e `instructionRef` como caminho relativo exato do plano, sem URL, caminho absoluto ou `..`.

- [ ] **Step 4: Semear calendário e lições com segurança.**

Calendário recebe somente datas verificadas em fonte oficial; na dúvida, fica vazio. Lições recebem 12 itens derivados dos guias existentes, sem afirmação nova e com link para o guia de origem.

- [ ] **Step 5: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/time.test.ts tests/diario/schema.test.ts tests/diario/governance.test.ts
git add src/lib/diario src/data/diario/curadoria tests/diario/time.test.ts tests/diario/schema.test.ts tests/diario/governance.test.ts
git commit -m "feat(diario): adiciona dominio e cofre versionado da curadoria"
```

### Task 2: Coleta BCB/RSS allowlisted sem chamada no build

**Files:**
- Create: `src/lib/bcb.ts`
- Modify: `src/lib/indicators.ts`
- Create: `src/lib/diario/ingest.ts`
- Create: `scripts/diario/collect.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/diario/ingest.test.ts`
- Extend: `tests/indicator-provenance.test.ts`

**Interfaces:**
- Consumes: `BcbObservation` de `types.ts` e `verifyGovernance()` da Task 1.
- Produces: `fetchBcbLastValue(code)`, `fetchBcbRecentValues(code, count)`, `parseBcbDate`, `latestRealizedDate`.
- Produces: `collectInputs(date: string, options?: CollectOptions): Promise<CollectedInputs>`.

- [ ] **Step 1: Escrever os testes que falham.**

Cobrir: toda requisição usa `redirect: "manual"`; `never requests forbidden redirect target` confirma no spy que host não allowlisted não é requisitado; `Location` para `http:`, host com aparência enganosa, credenciais ou porta não allowlisted também nunca é requisitado; `malformed and loop redirects skip only that source` e o teste do quarto hop confirmam que as demais fontes continuam; `401/402/403` interrompe fonte; RSS malformado pula só aquela fonte; XML não processa entidades; cache não guarda corpo de matéria; dólar usa duas observações mais recentes com datas; BCB fora não inventa frescor; `indicators.ts` continua chamando exatamente 432/4389/13522/1.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/diario/ingest.test.ts tests/indicator-provenance.test.ts
```

- [ ] **Step 3: Instalar dependências e extrair BCB.**

```bash
npm install -D tsx fast-xml-parser
```

Mover fetch/parse do BCB para `src/lib/bcb.ts`; `indicators.ts` mantém `getIndicators`, fallback e memoização. O script não importa `src/config/site.ts`, evitando `import.meta.env`.

- [ ] **Step 4: Implementar a coleta.**

Ler e verificar o cofre; buscar BCB; buscar somente feeds `enabled`. Toda requisição HTTP de ingestão, inclusive BCB, usa `redirect: "manual"`. Para cada resposta de redirect, resolver `Location` contra a URL atual e validar antes de qualquer novo request: esquema exatamente `https:`, hostname e porta exatamente allowlisted, sem username/password; seguir no máximo três hops. Alvo proibido, `Location` inválido, loop ou excesso de hops encerra somente aquela fonte, sem requisitar o alvo. Guardar evidência normalizada em `.cache/diario/<date>/`; nunca baixar artigo completo. Parser XML com `processEntities: false`. Deduplicar URL canônica e título normalizado.

Valor Investe e InfoMoney são candidatos iniciais, mas só entram `enabled: true` após smoke test de feed e termos. Se reprovarem, parar e pedir aprovação do dono antes de lançar só com oficiais.

- [ ] **Step 5: Adicionar scripts e ignorar cache.**

`package.json`: `diario:collect`, `diario:validate`, `diario:verify-build`, `verify`. `.gitignore`: `.cache/` e `.cache/diario/**/draft.json`.

- [ ] **Step 6: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/ingest.test.ts tests/indicator-provenance.test.ts
git add package.json package-lock.json .gitignore src/lib/bcb.ts src/lib/indicators.ts src/lib/diario/ingest.ts scripts/diario/collect.ts tests/diario/ingest.test.ts tests/indicator-provenance.test.ts src/data/diario/curadoria/allowlist.json src/data/diario/curadoria/approval.json src/data/diario/curadoria/changelog.md
git commit -m "feat(diario): coleta BCB e RSS allowlisted fora do build"
```

### Task 3: Curadoria determinística, gate de qualidade e edição-seed

**Files:**
- Create: `src/lib/diario/curate.ts`
- Create: `src/lib/diario/validate.ts`
- Create: `scripts/diario/curate.ts`
- Create: `scripts/diario/validate.ts`
- Create: `src/data/diario/edicoes/<data-da-seed>.json`
- Create: `docs/diario/mutation-ledger.md`
- Modify: `package.json`
- Test: `tests/diario/curate.test.ts`
- Test: `tests/diario/validate.test.ts`

**Interfaces:**
- Produces: `decideEdition(inputs: CollectedInputs, previous: Edition[], vault: Vault): CurationDecision`.
- Produces: `buildSelection(inputs: CollectedInputs, decision: CurationDecision): Selection`.
- Produces: `validateEdition(value: unknown, context: ValidationContext): Edition`.
- Produces: `validateAndPublish(date: string, root?: string): string`.

- [ ] **Step 1: Escrever os testes que falham.**

Curadoria: evento/gatilho/notícia oficial/mídia corroborada → `material`; dia comum → `morno`; segunda usa lição só se quiet e 1x por semana ISO; não repete lição; fim de semana sem observação nova é quiet; threshold usa valor não arredondado. Testes dedicados: `rejects repeated canonical URL`, `rejects repeated normalized title`, `same event without new substantive source evidence falls quiet` e `rejects materially similar editorial payload`; histórico inválido/ambíguo cai para `morno`; duplicatas são removidas sem descartar um cluster genuinamente novo.

`selection.json`: para cada fonte selecionada, conter `sourceId`, `publisher`, `kind`, `title`, `canonicalUrl`, `publishedAt`, `retrievedAt`, `excerpt`, `excerptSha256`, `clusterId` e `topic`; URL segue a normalização canônica, título é trimado, timestamps são ISO, excerpt tem `trim` e colapso de espaços para um único, e o hash é SHA-256 dos bytes UTF-8 desse excerpt. A decisão e os clusters selecionados também estão presentes.

Validador: snapshot confere com evidência BCB; campo `stale` só copia a edição anterior e permanece rotulado; todo item tem fonte suficiente (1 oficial ou 2 veículos independentes) e somente fontes de `selection.json`; prosa sem dígito/HTML em todos os campos editoriais; nenhum número editorial fora do snapshot; material/morno e delta substantivo recomputados; payload similar contra as dez edições materiais recentes é rejeitado; fonte allowlisted; ausência de aviso falha; mesmo dia não sobrescreve; mudança de política ou aprovação inválida falha.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/diario/curate.test.ts tests/diario/validate.test.ts
```

- [ ] **Step 3: Implementar decisão, seleção e gate.**

A IA não decide materialidade. `decideEdition` usa somente dados coletados, o cofre e as edições anteriores. O gate de delta substantivo compara as dez edições `material` mais recentes (ou todas, se houver menos); IDs de lição são comparados com todas as edições anteriores. Lista vazia é histórico válido; arquivo ausente/inválido/ambíguo produz `history-unavailable`. URL canônica é normalizada com URL HTTPS, host em minúsculas, remoção de porta padrão, fragmento e parâmetros de rastreamento conhecidos, e demais query params ordenados. Texto usa Unicode NFKC, minúsculas, remoção de diacríticos e colapso de pontuação/espaços; similaridade é Jaccard de shingles de três tokens com limiar `0.80` (texto curto usa o token normalizado inteiro).

Um cluster é duplicado se todas as fontes repetem URL canônica ou título normalizado já visto, ou se o agregado dos títulos/excertos selecionados atinge o limiar contra `headline/summary/whyItMatters` de item material anterior. Um evento com o mesmo `eventId` só sobrevive se houver fonte com URL canônica inédita para aquele evento, título abaixo do limiar, excerpt não vazio e hash válido, e o excerpt também ficar abaixo do limiar contra o texto editorial e os títulos de fontes daquele evento no histórico. Uma lição é duplicada se o `lessonId` já apareceu ou se título/corpo atingem o limiar. O validador também compara o payload editorial completo (`title`, `summary`, itens e lição) com cada edição material recente e rejeita igualdade normalizada ou similaridade igual/superior a `0.80`. Histórico ausente/inválido/ambíguo produz `morno` com `history-unavailable`; ausência de delta produz `morno` com `no-substantive-delta`.

O CLI `npm run diario:curate` lê evidência, histórico e cofre e escreve `.cache/diario/<date>/selection.json` por `buildSelection`. A seleção contém a decisão, clusters e, para cada fonte, todos os campos de `SelectedSourceEvidence`; URL é canônica, título é trimado, timestamps são ISO, excerpt sofre `trim` e colapso de espaços para um único, e `excerptSha256` cobre seus bytes UTF-8. A IA lê somente esse arquivo e as entradas aprovadas de lição/evento explicitamente referenciadas por seus IDs; nunca faz fetch de corpo de matéria. O rascunho pode usar somente os `sourceIds` selecionados. O validador revalida schema, cofre, aprovação, fontes contra a seleção/evidência, status, snapshot, delta e imutabilidade antes de escrever a edição final. A edição final guarda apenas metadados das fontes — não guarda excerpt nem copia matéria.

- [ ] **Step 4: Criar a seed pelo caminho real.**

```bash
npm run diario:collect
npm run diario:curate
# redigir .cache/diario/<date>/draft.json somente com selection.json e as entradas aprovadas ali referenciadas
npm run diario:validate -- --publish
```

Se o dia for quiet ou o gate não provar delta substantivo, a seed é morna; não fabricar arquivo datado.

- [ ] **Step 5: Registrar mutação.**

Executar ao menos 10 mutações deliberadas e registrar qual teste pegou cada uma, incluindo: número editorial fora do snapshot, host fora da allowlist, redirect proibido, fonte faltando, status errado, URL/título repetido, evento sem evidência nova, payload similar, lição repetida, hash divergente e campo/formato inválido de aprovação.

- [ ] **Step 6: Rodar GREEN e commit.**

```bash
npx vitest run tests/diario/curate.test.ts tests/diario/validate.test.ts
git add package.json src/lib/diario/curate.ts src/lib/diario/validate.ts scripts/diario/curate.ts scripts/diario/validate.ts src/data/diario/edicoes docs/diario/mutation-ledger.md tests/diario/curate.test.ts tests/diario/validate.test.ts
git commit -m "feat(diario): decide materialidade e publica somente edicoes validadas"
```

### Task 4: Store, hub vivo, arquivo material e endpoint

**Files:**
- Create: `src/lib/diario/store.ts`
- Create: `src/components/diario/EditionBody.astro`
- Create: `src/components/diario/IndicatorGrid.astro`
- Create: `src/components/diario/SourceList.astro`
- Create: `src/components/diario/ArchiveList.astro`
- Create: `src/components/diario/DiarioByline.astro`
- Create: `src/pages/diario-do-investidor/index.astro`
- Create: `src/pages/diario-do-investidor/[date].astro`
- Create: `src/pages/api/diario/edicao.json.ts`
- Create: `scripts/diario/verify-build.ts`
- Test: `tests/diario/store.test.ts`

**Interfaces:**
- Produces: `readEditions(root?: string): Edition[]`, `latestEdition(editions): Edition`, `materialEditions(editions): Edition[]`.
- Consumes: `getIndicators()` só no hub; arquivo datado consome exclusivamente `edition.snapshot.measured`.

- [ ] **Step 1: Escrever os testes que falham.**

`readEditions` ordena por data; `latestEdition` inclui quiet; `materialEditions` exclui quiet; arquivo inexistente/JSON inválido falha com mensagem acionável; seed ausente falha; inspeção de fonte confirma que `[date].astro` não importa nem chama `getIndicators`; blocos numéricos do arquivo consomem exclusivamente `edition.snapshot.measured`.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/diario/store.test.ts
```

- [ ] **Step 3: Implementar store e páginas.**

Hub: uma URL canônica, indicadores ao vivo com rótulo de origem/fallback, última edição e links do arquivo; JSON-LD `CollectionPage`. Arquivo: `getStaticPaths` apenas para `material`; snapshot próprio; canonical próprio; `Article` JSON-LD com autor/publisher `Organization`; breadcrumb; calculadora relacionada; aviso fixo. Endpoint devolve a última edição, inclusive quiet, com `Cache-Control: no-store`. No root do repositório, `readEditions` chama `verifyGovernance()` antes de ler; fixtures de teste usam um cofre aprovado.

- [ ] **Step 4: Build e verificação de dist.**

```bash
npm run build
npm run diario:verify-build
```

Esperado: hub existe; somente datas materiais têm diretório; data quiet não existe; endpoint existe; JSON-LD/canonical presentes.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/diario/store.ts src/components/diario src/pages/diario-do-investidor src/pages/api/diario/edicao.json.ts scripts/diario/verify-build.ts tests/diario/store.test.ts
git commit -m "feat(diario): renderiza hub vivo e arquivo somente de edicoes materiais"
```

### Task 5: Metodologia, descoberta, SEO e aprovação visual

**Files:**
- Create: `src/pages/diario-do-investidor/metodologia.astro`
- Modify: `src/components/Header.astro:5-9,57-67,146-169`
- Modify: `src/components/Footer.astro:43-52`
- Modify: `src/pages/index.astro:181-222`
- Modify: `astro.config.mjs:17-28`
- Extend: `tests/seo-schema.test.ts`

**Interfaces:**
- Consumes: `materialEditions`, `latestEdition`, `absUrl`, `breadcrumbSchema`, `SITE_CONFIG.legalDisclaimer`.

- [ ] **Step 1: Escrever os testes que falham.**

Links do Diário no menu desktop/mobile, footer e home; hub/arquivo com self-canonical e breadcrumb; arquivo material no sitemap com `lastmod` da edição; hub com `lastmod` igual à maior data entre a última edição e a observação BCB; quiet fora do sitemap; byline não atribui revisão humana falsa.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/seo-schema.test.ts
```

- [ ] **Step 3: Implementar UI e metodologia.**

Reutilizar cards, botões, tokens e `CalcDisclaimer`. Metodologia explica automação, fontes, critério material/morno, limites YMYL e ausência de recomendação. Byline: “Diário do Investidor · curadoria automática com fontes verificadas”, ligada à metodologia.

- [ ] **Step 4: Subir servidor e produzir frames.**

```bash
npm run dev
```

Capturar hub, arquivo material, metodologia e menu mobile em desktop/mobile. **Parar e pedir aprovação do dono antes de qualquer push.**

- [ ] **Step 5: GREEN, build e commit após aprovação.**

```bash
npx vitest run tests/seo-schema.test.ts
npm run build
git add src/pages/diario-do-investidor/metodologia.astro src/components/Header.astro src/components/Footer.astro src/pages/index.astro astro.config.mjs tests/seo-schema.test.ts
git commit -m "feat(diario): conecta hub, metodologia e SEO a navegacao"
```

### Task 6: Rebuild diário de garantia

**Files:**
- Modify: `api/cron/indicadores.ts:91-107`
- Modify: `tests/api-cron-indicadores.test.ts:120-163`

**Interfaces:**
- Preserves: autenticação Bearer, timeout, erro de hook e skip quando BCB indisponível.

- [ ] **Step 1: Alterar o teste que hoje exige skip.**

O caso “mesma data publicada” passa a exigir `rebuilt: true` e uma chamada ao Deploy Hook. Remover a expectativa de fetch ao endpoint publicado.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/api-cron-indicadores.test.ts
```

- [ ] **Step 3: Remover a comparação com `/api/indicadores.json`.**

Remover também a constante `SITE_URL` e a rota `PUBLISHED_URL` dos doubles de teste. Com BCB alcançável, o cron sempre dispara rebuild às 14:30 BRT. A automação das 19:00 BRT publica a edição e provoca o segundo rebuild do dia. Isso é intencional: dado da manhã + edição da noite.

- [ ] **Step 4: GREEN e commit.**

```bash
npx vitest run tests/api-cron-indicadores.test.ts
git add api/cron/indicadores.ts tests/api-cron-indicadores.test.ts
git commit -m "fix(cron): garante rebuild diario mesmo sem observacao nova do BCB"
```

### Task 7: Prompt da automação e regra do cofre

**Files:**
- Create: `docs/diario/automation-prompt.md`
- Modify: `AGENTS.md`
- Test: `tests/diario/automation-prompt.test.ts`

**Interfaces:**
- Produces: prompt versionado, com `promptVersion` usado em toda edição.

- [ ] **Step 1: Escrever teste de salvaguardas.**

Exigir no prompt: aquisição de lock exclusivo antes de `git pull --ff-only origin main`; parada por árvore suja; `npm run diario:collect`; `npm run diario:curate`; leitura exclusiva de `selection.json` e das entradas aprovadas de lição/evento ali referenciadas, nunca fetch de corpo de matéria; `npm run diario:validate -- --publish`; `npm test`; `npm run build`; `git diff --check`; commit com caminhos explícitos; liberação do lock em cleanup `finally`-style; lock existente/stale para o run para revisão do operador sem deleção automática; proibição de `git add -A` e de editar cofre; imutabilidade do mesmo dia e fallback quiet. O teste verifica aquisição do lock antes do pull, pull antes de validação/build, commit antes da execução do cleanup e instalação do `trap` antes do pull; também verifica que o prompt não contém instrução de apagar lock stale.

- [ ] **Step 2: Rodar RED.**

```bash
npx vitest run tests/diario/automation-prompt.test.ts
```

- [ ] **Step 3: Escrever o prompt e a regra no AGENTS.md.**

O prompt e a regra no `AGENTS.md` fixam este procedimento, nesta ordem:

1. Garantir `.cache/diario/` e criar `.cache/diario/automation.lock` com `mkdir` atômico; gravar um token de dono e instalar imediatamente o cleanup `finally`-style com `trap ... EXIT` e traps de sinal, antes de qualquer pull. Se o diretório do lock já existir, parar com erro para revisão do operador; não usar idade, PID ou limpeza automática para removê-lo.
2. Ainda sob o lock, conferir árvore suja e rodar `git pull --ff-only origin main`; qualquer falha interrompe o run.
3. Verificar cofre e `approval.json`; rodar `diario:collect` e `diario:curate`.
4. Ler somente `.cache/diario/<date>/selection.json` e as entradas aprovadas de lição/evento explicitamente referenciadas ali. A seleção precisa trazer a decisão e, por fonte, `sourceId`, `publisher`, `kind`, `title`, `canonicalUrl`, `publishedAt`, `retrievedAt`, `excerpt`, `excerptSha256`, cluster e tópico. Nunca buscar corpo de matéria.
5. Redigir somente o rascunho ignorado, com no máximo 3 itens, prosa original sem dígitos, sem recomendação, sem cripto, sem HTML e sem paywall. Todo número editorial deve vir do snapshot da edição; em dúvida de lastro ou delta substantivo, produzir edição quiet.
6. Rodar `npm run diario:validate -- --publish`, `npm test`, `npm run build` e `git diff --check`; commitar com caminhos explícitos e somente então fazer o push autorizado. O lock permanece durante validação, build e commit.
7. Em qualquer saída, sucesso ou erro, o cleanup instalado no passo 1 remove o marcador somente se o token for dono do lock e depois tenta `rmdir`; nunca remove lock alheio, nunca usa `rm -rf` e nunca apaga lock stale automaticamente.

Nunca alterar `carta/allowlist/thresholds/calendario/licoes/changelog/approval`. Lock stale exige revisão e remoção manual explícita do operador depois de confirmar que não há run ativo.

- [ ] **Step 4: GREEN e commit.**

```bash
npx vitest run tests/diario/automation-prompt.test.ts
git add docs/diario/automation-prompt.md AGENTS.md tests/diario/automation-prompt.test.ts
git commit -m "docs(diario): protege cofre e define prompt da automacao no Mac"
```

### Task 8: Verificação end-to-end e handoff

**Files:**
- No code changes expected.

- [ ] **Step 1: Rodar a suíte completa e o build.**

```bash
npm test
npm run build
npm run diario:verify-build
git diff --check
```

Esperado: 100% dos testes passam, build sem erro e dist coerente.

- [ ] **Step 2: Validar no navegador local.**

Hub 200; arquivo material 200; data quiet 404; endpoint JSON com a última edição; snapshot do arquivo não muda após simular dados novos; menu mobile acessível; sem erro de console.

- [ ] **Step 3: Revisar código e arquitetura.**

Usar `code-review` e repetir o mutation ledger do validador. Corrigir achados antes de prosseguir.

- [ ] **Step 4: Auditar o site local contra o ar.**

Usar `site-audit-visual-functional` com `superpowers-verification-before-completion`. Conferir canonical, sitemap, JSON-LD, links internos, 404 quiet e regressão das calculadoras/guia.

- [ ] **Step 5: Entregar o prompt ao dono e aguardar.**

O dono cria a automação na aba Automações do Qoder no Mac servidor usando `docs/diario/automation-prompt.md`. A primeira execução é acompanhada; Search Console e painéis continuam sendo trabalho humano.

- [ ] **Step 6: Publicar somente após aprovação explícita.**

Push em `origin/main` é publicação. Só ocorre depois da aprovação visual, da auditoria e da ordem explícita do dono.

## Rota de skills

- Execução: `superpowers-subagent-driven-development` (recomendado pela criticidade e pelas interfaces entre tarefas) ou `superpowers-executing-plans`.
- Segurança da coleta/validação: `security-and-hardening`.
- Documentação atual de `tsx`/`fast-xml-parser`: `context7` antes de implementar.
- Revisão final: `code-review`.
- Verificação pasta vs. ar: `site-audit-visual-functional` + `superpowers-verification-before-completion`.
- Passos de painel/credencial no Mac: `matt-wizard`, sem executar ações humanas em nome do dono.

## Verification Final

- `npm test` e `npm run build` passam.
- Mutation ledger registra pelo menos 10 defeitos e os testes que os pegaram.
- Hub e arquivo usam canonical/breadcrumb/JSON-LD corretos.
- Edição quiet não vira URL nem sitemap; edição material vira.
- Nenhuma prosa editorial contém dígito; todo número editorial vem do snapshot da edição; nenhuma fonte fora da allowlist é publicada.
- URL/título repetido, evento sem evidência nova e payload similar não produzem edição material; quiet não cria URL datada.
- BCB indisponível não é apresentado como dado de hoje.
- Cron dispara com BCB ok mesmo sem data nova; automação publica às 19:00 BRT.
- Cofre com hash divergente ou aprovação ausente/inválida falha; automação não tem permissão de editá-lo.
- Lock é adquirido antes do pull, mantido até o commit e liberado em cleanup; lock stale interrompe sem deleção automática.
- Frames desktop/mobile aprovados; site-audit sem regressão.
- Prompt da automação entregue e primeira execução real verificada antes de declarar o Diário em operação.
