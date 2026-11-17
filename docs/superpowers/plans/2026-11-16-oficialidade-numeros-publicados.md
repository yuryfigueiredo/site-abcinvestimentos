# Oficialidade dos Números Publicados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-subagent-driven-development (recommended) or superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada número publicado sob rótulo "oficial do Banco Central" declara sua origem, a Poupança passa a mostrar que é fórmula com TR de referência datada, e campos sem fonte saem do payload.

**Architecture:** A proveniência sai do agregado mentiroso (`source: 'bcb-sgs-live'` sobre oito campos de origens diferentes) e vira uma origem por campo no `Indicators`, calculada no `load()`. A TR sai de `defaultIndicators` (que significa "usado quando o BCB falha") e vira `SITE_CONFIG.poupancaTrReference`, com data. Uma única função gera a frase da ressalva, consumida pela barra e pelas páginas de simulação, e um portão por mutação amarra as duas promessas.

**Tech Stack:** Astro 5, TypeScript, vitest. Sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-16-oficialidade-numeros-publicados-design.md`

## Global Constraints

- Nenhuma chamada externa nova no build. `getIndicators()` permanece com uma única coleta memoizada; o timeout por série é 3500ms (`fetchBcbLastValue`).
- A cifra publicada não muda neste plano: com Selic 13,75% e TR de referência 0,95%, `poupanca` continua 7,12. Trocar a cifra é a tarefa (b).
- Cópia em pt-BR. O texto da ressalva é gerado por função, nunca escrito à mão em dois lugares.
- `defaultIndicators` passa a conter apenas `selic`, `cdi`, `ipca12m`, `dolar`, `updatedAt`. Sem `ibovespa`, `ifix`, `trAnual`, `poupanca`.
- Commit com caminhos explícitos, nunca `git add -A`. Nenhuma referência a máquina específica (porta `tests/pc-independence.test.ts`).
- Mudança visual: frame local → aprovação do dono → só então push. Este plano termina antes do push; publicar é ato separado e autorizado à parte.
- Testes: `npm test` (vitest), hoje 70 casos em 11 arquivos, todos verdes.

## Review Focus

1. **BCB fora do ar no build** — cada campo tem de nascer com origem `config-fallback`, e o carimbo de data não pode apresentar valor velho como se fosse de hoje. É o apodrecimento original, agora do outro lado.
2. **Promessa em meta description e JSON-LD** — `[valor].astro:82` escreve "Com as taxas do Banco Central de {data} (...) {produto} rende ..." e `:62` "Taxas BCB de {data}". Numa página de Poupança, essa frase carimba como taxa do Banco Central um número que a página calculou por fórmula. O texto estruturado mente igual ao visível, e é ele que o Google lê primeiro.
3. **Consumidor externo do `/api/indicadores.json`** — o shape muda (`source`, `ibovespa`, `ifix` saem; `origins` e `poupancaRule` entram). Espera-se payload 200 sem os campos, não 500 nem campo com `null`. O dono confirmou que nenhum script fora do repo lê o endpoint; se aparecer um, é reverter este item, não o resto.
4. **Selic ≤ 8,5% a.a.** — a Poupança deixa de ser "0,5% a.m. + TR" e passa a ser "70% da Selic". A frase da ressalva tem de mudar com o ramo; uma copy fixa mentiria no dia em que a Selic cair.
5. **Calculadora nova pré-preenchendo taxa** — `tests/calculator-rate-source.test.ts` tem de continuar pegando Selic/CDI/IPCA/Dólar depois que `poupanca` sair da lista de valores do feed (nenhuma página hoje hardcodeia 7,12, verificado por grep).
6. **Custo do build em 2 núcleos** — a coleta é uma por build e compartilhada; nenhum task deste plano adiciona `fetch`.

---

### Task 1: Proveniência por campo no `Indicators` e TR com referência datada

**Files:**
- Modify: `src/config/site.ts:24-34` (objeto `defaultIndicators`, e novo `poupancaTrReference` ao lado dele)
- Modify: `src/lib/indicators.ts:4-14` (interface) e `src/lib/indicators.ts:61-87` (corpo de `load()`)
- Test: `tests/indicator-provenance.test.ts` (cria o arquivo)

**Interfaces:**
- Consumes: nada de outros tasks.
- Produces:
  - `type IndicatorOrigin = 'bcb-sgs' | 'config-fallback' | 'formula'`
  - `Indicators.origins: { selic: IndicatorOrigin; cdi: IndicatorOrigin; ipca12m: IndicatorOrigin; dolar: IndicatorOrigin; poupanca: 'formula' }`
  - `Indicators.poupancaRule: { basis: 'tr'; trAnualPct: number; referencia: string } | { basis: 'selic-70'; selicUsada: number }`
  - `function poupancaReferenceText(ind: Indicators): string` — em `src/lib/indicators.ts`, exportada. Retorna a frase em pt-BR usada pela barra e pelas páginas: base `tr` ⇒ `Poupança = 0,5% a.m. + TR (TR de referência ${referencia})`; base `selic-70` ⇒ `Poupança = 70% da Selic de ${formatPct} a.a.`
  - `SITE_CONFIG.poupancaTrReference: { annualPct: number; referencia: string }` com `annualPct: 0.95` e `referencia: 'Out/2026'`.
  - Saem de `Indicators`: `ibovespa`, `ifix`, `source`. Saem de `defaultIndicators`: `ibovespa`, `ifix`, `trAnual`, `poupanca`.

- [ ] **Step 1: Escrever o teste que falha** em `tests/indicator-provenance.test.ts`

Use o estilo de `tests/calculator-rate-source.test.ts`: arquivo-fonte lido como texto, asserts sobre padrão, comentário curto explicando o bug real. Seis casos, todos sobre `load()` com `fetch` mockado (Caso E com Selic mockada em 8,4%):

```ts
// Caso A: as quatro series respondem.
expect(ind.origins).toEqual({ selic: 'bcb-sgs', cdi: 'bcb-sgs', ipca12m: 'bcb-sgs', dolar: 'bcb-sgs', poupanca: 'formula' });
// Caso B: as quatro series falham.
expect(ind.origins.selic).toBe('config-fallback');
expect(ind.origins.dolar).toBe('config-fallback');
// Caso C: a Poupança nunca e apresentada sem a regra que a gerou.
expect(ind.poupancaRule.basis).toBe('tr');
expect(poupancaReferenceText(ind)).toContain('Out/2026');
// Caso D: o payload nao carrega campo sem fonte.
expect(ind).not.toHaveProperty('ibovespa');
expect(ind).not.toHaveProperty('ifix');
expect(ind).not.toHaveProperty('source');
// Caso E: Selic em 8,4% troca a regra, e a frase troca junto.
expect(ind2.poupancaRule).toEqual({ basis: 'selic-70', selicUsada: 8.4 });
expect(poupancaReferenceText(ind2)).toContain('70% da Selic');
expect(poupancaReferenceText(ind2)).not.toContain('0,5% a.m.');
// Caso F: a coleta continua quatro series, nenhuma a mais.
expect(fetchCalls).toEqual([432, 4389, 13522, 1]);
```

O mock de `fetch` do Caso F é a própria série de chamadas: se aparecer uma quinta, o plano inteiro ganhou um custo de build que ninguém pediu.

Nomeie os casos pela promessa que cada um quebra: `series vivas declaram origem bcb-sgs`, `serie ausente declara origem config-fallback`, `poupanca sempre traz a regra que a gerou`, `payload nao publica campo sem fonte`, `selic baixa troca a regra e a frase junto`, `coleta continua quatro series do bcb`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run tests/indicator-provenance.test.ts`
Expected: FAIL — `ind.origins` é `undefined` e `poupancaReferenceText` não existe.

- [ ] **Step 3: Implementar a referência de TR em `src/config/site.ts`**

Tirar `ibovespa`, `ifix`, `trAnual` e `poupanca` de `defaultIndicators`. Acrescentar ao lado, como chave irmã:

```ts
poupancaTrReference: { annualPct: 0.95, referencia: 'Out/2026' },
```

Comentar por que não mora em `defaultIndicators`: aquele objeto é o valor usado quando o BCB falha, e a TR é usada sempre.

- [ ] **Step 4: Reescrever a interface e o `load()` em `src/lib/indicators.ts`**

Declarar `IndicatorOrigin`, `origins` e `poupancaRule` conforme o bloco Interfaces. Em `load()`, a origem de cada série medida é `'bcb-sgs'` quando `fetchBcbLastValue` devolveu observação e `'config-fallback'` quando caiu no default. A Poupança é `'formula'` nos dois ramos, e o ramo escolhido vira `poupancaRule`: base `tr` usa `SITE_CONFIG.poupancaTrReference` (o `|| 0.95` duplicado de `indicators.ts:73` desaparece, porque agora há um único lugar do número); base `selic-70` registra a Selic usada. Exportar `poupancaReferenceText(ind)` fazendo o texto com `formatPct` de `src/lib/finance.ts`.

- [ ] **Step 5: Rodar o portão de dados**

Run: `npx vitest run tests/indicator-provenance.test.ts`
Expected: PASS, seis casos.

- [ ] **Step 6: Rodar a regressão completa**

Run: `npm test`
Expected: 12 arquivos verdes. Se `tests/calculator-rate-source.test.ts:17` quebrar, é esperado: remover `SITE_CONFIG.defaultIndicators.poupanca` da lista `feedRateValues`, que deixa de existir. Nenhuma página de calculadora hardcodeia 7,12, então a lista perde um valor que nunca pegou nada — os quatro valores que ficam continuam cobrindo as taxas medidas.

- [ ] **Step 7: Confirmar o JSON sem os campos mortos**

Run: `npx astro build && grep -o '"ibovespa"\|"ifix"\|"source"' dist/index.html 2>/dev/null | head`
Expected: nenhuma ocorrência no HTML. O endpoint é função serverless, então conferir a resposta no preview: `npx astro preview` e `curl -s localhost:4321/api/indicadores.json` sem os três campos e com `origins` e `poupancaRule` presentes.

- [ ] **Step 8: Commit**

```bash
git add src/config/site.ts src/lib/indicators.ts tests/indicator-provenance.test.ts tests/calculator-rate-source.test.ts
git commit -m "refactor(indicadores): proveniencia por campo e TR com referencia datada"
```

---

### Task 2: Pílula da Poupança declara a fórmula na barra

**Files:**
- Modify: `src/components/Ticker.astro:13` (`poupancaChars`), `:18` (`aria-label` do contêiner), `:105-115` (pílula da Poupança)
- Test: `tests/indicator-provenance.test.ts` (adicionar o `describe` de superfície publicada)

**Interfaces:**
- Consumes: `poupancaReferenceText(ind)` e `Indicators.origins` do Task 1.
- Produces: a pílula da Poupança como o único item da barra cujo `title` e `aria-label` carregam a regra de origem; as outras quatro pílulas continuam com o número puro.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('a pilula da poupanca declara a regra que gerou o numero', () => {
  const src = readFileSync('src/components/Ticker.astro', 'utf8');
  expect(src).toContain('poupancaReferenceText');
  const poupancaPill = src.slice(src.indexOf('id="bcb-poupanca"'));
  expect(poupancaPill).toContain('title={poupancaReferenceText(d)}');
});
it('nenhum valor de taxa sai hardcoded na barra', () => {
  const src = readFileSync('src/components/Ticker.astro', 'utf8');
  expect(src).not.toMatch(/poupanca \|\| 7\.12/);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run tests/indicator-provenance.test.ts -t 'pilula da poupanca'`
Expected: FAIL — `poupancaReferenceText` não aparece no Ticker.

- [ ] **Step 3: Implementar a pílula**

No frontmatter, importar `poupancaReferenceText` e derivar `const poupancaRef = poupancaReferenceText(d);`. Na pílula (`:105`), trocar `title` pela frase da referência e concatenar a referência no `aria-label`; manter `data-value`/`data-suffix` e o flap board intactos. Substituir as três ocorrências de `d.poupanca || 7.12` por `d.poupanca` — o valor é sempre numérico, e o literal era uma segunda cópia da taxa. Trocar o `aria-label` do contêiner (`:18`) de "Indicadores macroeconômicos oficiais do Banco Central do Brasil" para "Indicadores econômicos: Banco Central e regra oficial de poupança", porque um dos cinco itens não é medição. Não tocar nas outras pílulas nem no selo `BCB SGS`/`updatedAt`.

- [ ] **Step 4: Rodar o portão**

Run: `npx vitest run tests/indicator-provenance.test.ts`
Expected: PASS.

- [ ] **Step 5: Frame local para aprovação**

Run: `npm run dev` e abrir `/`. Expected visual: cinco itens na barra, o da Poupança com a frase da regra no tooltip e um marcador discreto ao lado do valor; os demais inalterados. **Parar aqui e entregar o frame ao dono antes do commit** — é mudança visual em superfície indexada.

- [ ] **Step 6: Commit**

```bash
git add src/components/Ticker.astro tests/indicator-provenance.test.ts
git commit -m "feat(barra): pilula da poupanca declara a formula e a referencia da TR"
```

---

### Task 3: Ressalva nas oito páginas de Poupança

**Files:**
- Modify: `src/pages/quanto-rende/[produto]/[valor].astro` (logo após a `table.abc-table` de `:197`, dentro da section que fecha em `:228`)
- Test: `tests/indicator-provenance.test.ts`

**Interfaces:**
- Consumes: `poupancaReferenceText` do Task 1, e o ramo `isPoupanca` que já existe em `:32`.
- Produces: uma linha de ressalva acima do aviso CVM nas páginas `/quanto-rende/poupanca/*`, nada nas outras, e a `description`/JSON-LD dessas páginas deixando de carimbar o número da fórmula como taxa do Banco Central.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('pagina de poupanca publica a ressalva pela mesma funcao da barra', () => {
  const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
  expect(src).toContain('poupancaReferenceText');
  expect(src).toMatch(/isPoupanca\s*&&/);
});
it('meta description de pagina de poupanca nao chama a formula de taxa do bcb', () => {
  const src = readFileSync('src/pages/quanto-rende/[produto]/[valor].astro', 'utf8');
  const descriptionLine = src.slice(src.indexOf('text: `Com as taxas do Banco Central'), src.indexOf('}`,', src.indexOf('text: `Com as taxas do Banco Central')));
  expect(descriptionLine).toContain('isPoupanca ? poupancaReferenceText(indicators)');
});
```

O assert de `isPoupanca &&` é o que impede a frase aparecer em página de CDB, onde a taxa é medida. O segundo é o que impede o conserto parar só no visível: `:82` hoje escreve "Com as taxas do Banco Central de {data} ... {produto} rende ..." para qualquer produto, inclusive a Poupança calculada por fórmula, e é essa string que o Google lê.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run tests/indicator-provenance.test.ts -t 'pagina de poupanca'`
Expected: FAIL nos dois casos.

- [ ] **Step 3: Implementar a linha**

Imediatamente após o `</table>` da tabela de resultados, renderizar `{isPoupanca && (<p className="abc-text-xs ...">{poupancaReferenceText(indicators)} — por isso o valor da Poupança não é lido diretamente de série do BCB.</p>)}`. Reaproveitar a classe de nota já usada na página em vez de criar estilo novo. A cifra da tabela não muda.

- [ ] **Step 4: Implementar a `description`**

No template que monta o texto em `:82`, trocar o trecho fixo "Com as taxas do Banco Central de {data}" por uma variante condicionada a `isPoupanca` que insere `poupancaReferenceText(indicators)` no lugar da alegação de taxa medida, mantendo Selic e CDI — esses dois são medidos e continuam verdadeiros.

- [ ] **Step 5: Rodar o portão e a regressão**

Run: `npx vitest run tests/indicator-provenance.test.ts`
Expected: PASS em todos os casos de superfície publicada.
Run: `npm test`
Expected: verdes, incluindo `tests/seo-schema.test.ts`, que lê as strings estruturadas das páginas.

- [ ] **Step 6: Frame local para aprovação**

Run: `npm run dev`, abrir `/quanto-rende/poupanca/10000-reais` e `/quanto-rende/cdb-100-cdi/10000-reais`. Expected: a ressalva aparece na primeira, não aparece na segunda; e o `<meta name="description">` da primeira traz a fórmula no lugar da alegação de taxa medida. **Parar e entregar o frame antes do commit.**

- [ ] **Step 7: Commit**

```bash
git add 'src/pages/quanto-rende/[produto]/[valor].astro' tests/indicator-provenance.test.ts
git commit -m "feat(quanto-rende): ressalva da formula da poupanca nas 8 paginas"
```

---

### Task 4: Verificação por mutação do portão novo

**Files:**
- Modify: `tests/indicator-provenance.test.ts` (comentar as mutações feitas e o resultado, na cabeça do arquivo)

**Interfaces:**
- Consumes: todos os asserts dos Tasks 1 a 3.
- Produces: a garantia de que o portão não é decorativo, no padrão que o AGENTS.md exige antes de confiar em portão novo.

- [ ] **Step 1: Mutar uma promessa por vez e rodar**

Sete mutações, cada uma com `npx vitest run tests/indicator-provenance.test.ts` depois e reverte em seguida:
 (i) `origins.poupanca = 'bcb-sgs'`; (ii) `load()` volta a publicar `ibovespa`; (iii) a frase sai de `title` na pílula; (iv) `{isPoupanca &&}` vira render incondicional; (v) `poupancaReferenceText` some do Ticker e a frase é escrita à mão; (vi) `poupancaTrReference.referencia` fica vazia; (vii) a `description` de `[valor].astro` volta a dizer "com as taxas do Banco Central" para a Poupança.
Expected: as sete falham no assert correspondente. Uma mutação que passa é um buraco no portão: adicionar o assert antes de seguir.

- [ ] **Step 2: Registrar o resultado no arquivo**

Documentar no comentário de cabeçalho, uma linha por mutação, o que foi quebrado e qual assert pegou — é o que a próxima sessão lê para saber que o portão foi testado.

- [ ] **Step 3: Suíte completa**

Run: `npm test`
Expected: todos os arquivos verdes, com o novo `indicator-provenance.test.ts` contando.

- [ ] **Step 4: Commit**

```bash
git add tests/indicator-provenance.test.ts
git commit -m "test(indicadores): portao de proveniencia verificado por mutacao"
```

---

### Task 5: Retirar `functions/` do repo

**Files:**
- Delete: `functions/api/ia.ts`, `functions/api/indicadores.ts` (e o diretório vazio)

**Interfaces:**
- Consumes: nada.
- Produces: fim da segunda cópia de `FALLBACK_INDICATORS` (`ipca12m: 4.58`, `dolar: 5.42`) e do espelho do handler de IA.

- [ ] **Step 1: Confirmar que nada aponta para lá**

Run: `grep -rn "functions/" --include='*.ts' --include='*.mjs' --include='*.json' --include='*.astro' . | grep -v node_modules | grep -v '^./functions'`
Expected: sem resultado. Confere também que `vercel.json` só referencia `api/**` e `astro.config.mjs` nada de Cloudflare.

- [ ] **Step 2: Remover**

```bash
git rm -r functions
```
O histórico preserva: `git show 82e04fe -- functions` recupera o conteúdo.

- [ ] **Step 3: Rodar a suíte**

Run: `npm test`
Expected: verdes.

- [ ] **Step 4: Rodar o build**

Run: `npm run build`
Expected: build completo sem erro de módulo ausente. Nada importa `functions/`, então a saída não muda de forma; se mudar, é consumidor que o Step 1 perdeu.

- [ ] **Step 5: Commit**

```bash
git add -u functions
git commit -m "chore: remove functions/ -- cloudflare pages orphan desde 2026-10-31"
```

---

### Task 6: Rotas de skill e o novo shape do JSON no AGENTS.md

**Files:**
- Modify: `AGENTS.md` (seção nova antes de "Publicar", e uma linha em "Publicar" sobre o payload)

**Interfaces:**
- Consumes: a redação aprovada da conversa de 2026-11-16.
- Produces: contrato de rota para a próxima sessão, em qualquer máquina.

- [ ] **Step 1: Escrever a seção de rotas**

Três entradas, uma linha cada com a skill de entrada e o gate, na forma que o AGENTS.md já usa (prosa direta, imperativo):
- **M1 verificar pasta vs. ar** — `site-audit-visual-functional`, com `superpowers-verification-before-completion` por cima: nenhuma afirmação de "está certo" sem comando rodado e saída conferida.
- **M2 fechar achado de auditoria** — `superpowers-brainstorming` → o que é painel humano vai por `matt-wizard`, o que é código vai por `superpowers-test-driven-development` (mutação obrigatória antes de confiar em portão novo).
- **M3 atualização futura** — `superpowers-brainstorming` → `superpowers-writing-plans` → `superpowers-executing-plans` (inline, um revisor no fim) ou `superpowers-subagent-driven-development` → `code-review` → `site-audit-visual-functional` antes do push.
Deitar fora e por quê, uma linha: `matt-wayfinder`, `matt-chief-of-staff`, `matt-software-factory`, `matt-triage`, `matt-to-tickets` — trabalho distribuído em tracker, e aqui `origin/main` é a única fonte de verdade.

- [ ] **Step 2: Registrar a mudança do payload**

Uma linha em "Publicar": `/api/indicadores.json` não tem mais `source`, `ibovespa` nem `ifix`; a origem é por campo em `origins`, e o que não é medição vem com a regra em `poupancaRule`. Quem consumir o endpoint de fora precisa saber.

- [ ] **Step 3: Rodar o portão de máquina**

Run: `npx vitest run tests/pc-independence.test.ts`
Expected: PASS — a seção nova não pode citar máquina nenhuma.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): rotas M1/M2/M3 de skill e o novo shape do indicadores.json"
```

---

## Fora deste plano

**Tarefa (b) — TR medida.** Preciso de um plano próprio, e o primeiro passo é pesquisa, não código: as candidatas SGS probeadas hoje não servem (26 ⇒ 31/01/2024; 179 ⇒ 01/03/2001; 220 ⇒ 01/11/1995; 20106 ⇒ 105,27, que não é taxa de aplicação). Antes de mover a cifra das 8 páginas de Poupança, alguém tem de confirmar no catálogo SGS qual série publica a TR mensal ou o rendimento aplicado da poupança, e então escrever (b) para trocar `poupancaTrReference` por medição — o portão dos Tasks 1 a 4 já obriga a dizer de onde veio.

**Achados A e B da auditoria.** As 6 variáveis que faltam no `.env` local em relação ao `.env.example` e o TODO de GA4 em `GOOGLE-SEARCH-CONSOLE.md:78` são painel e decisão de métrica, não código. Entram por `matt-wizard` na rota M2, quando o dono quiser.
