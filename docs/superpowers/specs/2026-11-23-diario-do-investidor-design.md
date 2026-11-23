# Desenho: Diário do Investidor — motor de conteúdo fresco no site (Projeto 1 de 2)

Data: 2026-11-23. Máquina: Mac A1278 (servidor oficial). HEAD de referência: `9e7b6e3`.

## Tamanho do trabalho

Um **projeto** (cria subsistema, não só mexe em superfície existente): curadoria grounded de
notícias financeiras, coleta BCB/RSS fora do build, cofre versionado com governança, decisão
determinística "dia material vs. dia morno", validação e publicação de edições, hub vivo,
arquivo datado seletivo, endpoint para consumo futuro, rebuild diário de garantia e o prompt
da automação que roda no Qoder do Mac. A **newsletter é o Projeto 2**, separado, e depende
deste — está fora do escopo aqui.

## Intent e o porquê

O site hoje é evergreen: 20 guias, 8 calculadoras, glossário, `/quanto-rende/*` e um hub de
indicadores do BCB. O cron atual só dispara quando a data da observação muda, portanto não
garante atualização diária. Falta um motivo para o Google mandar **gente nova todo dia** e
para o leitor criar o **ritual de voltar**.

A Regra nº 1 do dono é inequívoca: **trabalhar sempre com o Google, nunca contra** — e nunca
deixar o site parar de trabalhar com o Google. Isso descarta página datada todo dia (conteúdo
fino/duplicado) e comentário de notícia sem lastro (a armadilha de "scaled content" em YMYL),
mas não descarta notícia financeira verificada e contextualizada.

O que sobra é **curadoria grounded**: macro tradicional primeiro; fatos de fontes oficiais e
de uma pequena allowlist de mídia confiável; página nova só quando há substância nova; todo
número publicado com proveniência. O hub vivo mantém o ritual diário em uma URL canônica, o
arquivo material acumula frescor indexável e a newsletter (Projeto 2) será o envio diário.

## Goals

1. Um hub vivo `/diario-do-investidor/` (1 URL canônica) sempre mostrando a edição de "hoje",
   com indicadores atuais, origem/fallback explícitos e JSON-LD correto.
2. Um arquivo material `/diario-do-investidor/<AAAA-MM-DD>/` com uma página por edição que tem
   diferencial genuíno: evento, gatilho, notícia oficial, mídia corroborada ou lição elegível.
3. Curadoria grounded com fontes oficiais (BCB/IBGE/CVM/Tesouro/governo) e fontes allowlisted
   de mídia confiável. Toda notícia tem evidência suficiente; a IA não decide materialidade.
4. Curadoria estruturada como cofre versionado: carta, allowlist, thresholds, calendário,
   lições, changelog e aprovação, com hash e teste impedindo mudança autônoma.
5. Honestidade nos dias mornos: a edição registra "sem alteração relevante" e o hub/endpoint
   podem mostrá-la, mas **nenhuma URL datada duplicada** é criada.
6. Um portão com teste por mutação que derruba a publicação se houver número não rastreável,
   fonte inválida, status/materialidade incorretos, aviso ausente, lição repetida ou cofre
   divergente da aprovação.
7. Automação diária às **19:00 BRT** e **rebuild diário de garantia**, mantendo o site fresco
   mesmo quando a observação BCB não muda de data.

## Non-goals

- **Newsletter fora do escopo**: captura de e-mail, opt-in LGPD, provedor de envio e disparo
  ficam para o Projeto 2.
- Cripto. O escopo inicial é `renda-fixa`, `juros`, `inflacao`, `cambio`, `bolsa-fiis` e
  `regulacao`.
- Buscar fonte nova de dado de mercado (Ibovespa/IFIX). Foram removidos de propósito por
  proveniência; o Diário vive do macro BCB que já é confiável.
- Comentar notícias sem lastro, sem fonte suficiente ou fora da allowlist; a automação não
  tem autonomia para inventar pauta ou transformar qualquer notícia em recomendação.
- Usar paywall, copiar corpo de matéria ou publicar evidência que não possa ser auditada.
- Mudar calculadoras, guias existentes ou precificação.

## Anti-goals

- Publicar página datada em dia realmente vazio só para "ter todo dia" — é o conteúdo fino que
  a Regra nº 1 proíbe.
- Queimar a fila finita de lições em páginas quase-duplicadas ou usar lição fora da cadência.
- Byline mentirosa: carimbar a edição como revisada por um humano que não revisou, ou número
  gerado como se fosse medição do BCB sem ser.
- Deixar a automação dar `git add -A`, commitar com teste/build falhando, fazer push sem
  aprovação ou alterar o cofre sem ordem explícita do dono.
- Construir o Diário de um jeito que a newsletter (Projeto 2) não consiga consumir a edição
  como payload sem retrabalho.

## Restrições

- Site estático na Vercel. Esta mudança **não pode** adicionar chamada externa nova ao
  `astro build`: a coleta BCB/RSS roda na automação; o build lê JSON commitado e a coleta BCB
  já existente.
- Fontes: oficiais (BCB/IBGE/CVM/Tesouro/governo) + pequena allowlist de mídia confiável. Só
  HTTPS, hosts exatos e redirecionamentos revalidados; sem paywall e sem copiar corpo de
  matéria. Falha de uma fonte não autoriza buscar host privado nem publicar evidência inválida.
- Todo número editorial vem do snapshot BCB ou de fato determinístico. A prosa da IA não
  contém algarismos; números são renderizados em blocos factuais separados.
- Conteúdo educacional, nunca recomendação de compra/venda. O aviso é fixo e não editável pela
  IA em toda edição.
- O cofre da curadoria só muda por ordem explícita do dono, registrada em `approval.json` e
  `changelog.md`, com hash recomputado e testes verdes.
- A data da edição usa `America/Sao_Paulo`. A automação roda às **19:00 BRT**; o gatilho de
  dólar é `|Δ%| >= 1,0`; lição semanal às segundas, no máximo 1 por semana ISO e só quando não
  há notícia, evento ou gatilho.
- `AGENTS.md`: commit com caminhos explícitos, nunca `git add -A`; mudança visual exige frame
  local desktop/mobile → aprovação → só então push; nada de referência a máquina específica
  em código/teste; `origin/main` é a única fonte de verdade.
- A automação roda no Mac, que tem a chave de escrita e já provou push. `vercel`/`gh` CLI não
  existem lá; Search Console/env são trabalho de navegador.
- Testes vitest (`npm test`), todos passando; portão novo exige teste por mutação antes de
  confiar (regra M2/M3 do AGENTS.md).

## Abordagens consideradas

- **(a) Hub vivo + arquivo material com curadoria grounded — ESCOLHIDA.** Coleta e decisão
  determinísticas, redação restrita às fontes selecionadas, validação antes da publicação e
  cofre governado. Entrega frescor recorrente sem violar a Regra nº 1. Custo: um subsistema
  de conteúdo, curadoria e automação.
- **(b) Página datada todo dia no site — REJEITADA.** 365 URLs quase idênticas = conteúdo
  fino/duplicado, exatamente o que o Google penaliza. Vai contra a Regra nº 1.
- **(c) Só página viva, sem arquivo — REJEITADA.** Perde as URLs datadas indexáveis e a
  acumulação de frescor que o modo-notícia usa; superfície de SEO menor do que o possível.
- **(d) IA comentando livremente as notícias do dia — REJEITADA.** Maior risco de alucinação em
  YMYL e alvo direto das políticas de scaled content. A curadoria grounded só é aceitável
  porque fonte, seleção, número e publicação passam por gates verificáveis.

## Decisões de como fazer (decisões do plano aprovado)

**Store de edições = um arquivo por dia.** `src/data/diario/edicoes/<AAAA-MM-DD>.json`. A
automação registra toda edição diária, inclusive `morno`. Um arquivo por edição evita
conflito de merge e é trivial de ler via `import.meta.glob`. O hub vivo não lê o store para
medir números: usa `getIndicators()` ao vivo e lê a edição mais recente para a leitura do dia.

**Schema da edição.** `schemaVersion`, `id`, `date`, `generatedAt`, `title`, `summary`,
`snapshot`, `decision`, `items`, `lesson?`, `sources`, `relatedCalculatorSlug`, `policy` e
`provenance`. O snapshot guarda apenas `selic`, `cdi`, `ipca12m` e `dolar`, cada um com valor,
data da observação e origem `bcb-sgs` | `stale` | `unavailable`; o status geral é `ok` |
`stale` | `unavailable`. A decisão registra `material` | `morno` e os reason codes. Nenhum
número fora do snapshot ou de bloco factual determinístico; nenhum dígito na prosa editorial.

**Cofre de curadoria com aprovação/hash/teste.** `src/data/diario/curadoria/` contém
`carta.md`, `allowlist.json`, `thresholds.json`, `calendario.json`, `licoes.json`,
`changelog.md` e `approval.json`. A carta registra escopo tradicional, política de fontes,
critério material/morno, cadência, automação, regra de mudança e newsletter fora do escopo.
O procedimento é: ordem explícita do dono → editar arquivos do cofre → append no changelog →
recomputar o hash → atualizar `approval.json` com `instructionRef` → rodar os testes. O hash
SHA-256 cobre os bytes em ordem fixa (`carta.md`, `allowlist.json`, `thresholds.json`,
`calendario.json`, `licoes.json`, `changelog.md`), separados por `path + \0 + bytes + \0`.
`approval.json` guarda `bundleSha256`, `charterVersion`, `approvedAt`, `approvedBy` e a
referência da ordem. A automação apenas lê e verifica o cofre; nunca o edita.

**Curadoria é dado + evidência, não decisão livre da IA em runtime.** A coleta busca BCB e
somente feeds `enabled` da allowlist, valida host final e guarda evidência normalizada no
cache ignorado. `decideEdition` usa somente calendário, thresholds, lições e notícias
coletadas. A IA só redige sobre os IDs de `selection.json`, com no máximo 3 itens, prosa
original e sem recomendação.

**Decisão material vs. morno (determinística).** É `material` se houver evento do calendário,
`|Δdólar| >= 1,0`, notícia oficial com fonte suficiente ou notícia de mídia corroborada por
pelo menos 2 veículos independentes. A lição de segunda só entra se o dia estiver quiet e
ainda não houver lição na mesma semana ISO. Caso contrário é `morno`: a edição é registrada e
consumível, mas não vira página indexada.

**Hub vivo = 1 URL canônica, sempre "hoje".** `/diario-do-investidor/` renderiza no build a
partir de `getIndicators()` + a última edição. Os indicadores rotulam origem e fallback;
JSON-LD `CollectionPage`; canonical único; sem página datada concorrente no hub.

**Arquivo material = modo-notícia.** `/diario-do-investidor/<data>/` só para edições
`material`, cada uma com snapshot próprio, `datePublished`, `Article` JSON-LD, breadcrumb,
link para a calculadora relacionada e para o hub. A rota datada não chama `getIndicators()`.
O sitemap lista somente essas URLs. O endpoint `/api/diario/edicao.json` devolve a última
edição, inclusive `morno`, com `Cache-Control: no-store`.

**Proveniência e aviso herdam o que já existe.** Byline honesta: "Diário do Investidor ·
curadoria automática com fontes verificadas", sem revisor humano fingido. Cada notícia guarda
título, link e data das fontes — nunca excerpt longo nem corpo copiado. Reusa `CalcDisclaimer`
e a frase única de origem da poupança nas superfícies existentes. Todo número do Diário ou é
do snapshot medido ou vem rotulado como fato determinístico.

**O portão (teste por mutação obrigatório).** O validador revalida schema, cofre, fontes,
status, snapshot e imutabilidade antes de escrever a edição final. O teste falha se: houver
número não presente no snapshot; faltar `provenance`/`disclaimer`; fonte não allowlisted ou
insuficiente; `morno` gerar URL datada; lição repetida; mesmo dia sobrescrito; hash de aprovação
divergente. Mutação obrigatória antes de confiar — se o teste passar com número inventado ou
cofre alterado, o portão é decorativo.

**A automação (entrega = o prompt).** Roda diariamente no Qoder do Mac às **19:00 BRT**:
`git pull --ff-only` → lock → parar se a árvore estiver suja → verificar cofre →
`diario:collect` → `diario:curate` → preencher somente o rascunho ignorado com os IDs de
`selection.json` → `diario:validate -- --publish` → `npm test` + `npm run build` +
`git diff --check` → commit com caminhos explícitos → `git push origin main` (Vercel
rebuilda). Guardas: nunca `git add -A`; nunca editar o cofre; não commitar/pushar com teste ou
build falhando; em qualquer dúvida de lastro, decair para `morno`.

**Rebuild diário de garantia.** O cron existente (`30 17 * * *` UTC = 14:30 BRT) passa a
sempre disparar o Deploy Hook quando o BCB estiver alcançável, mesmo sem observação nova. Se o
BCB estiver indisponível, mantém o skip e não inventa frescor. A automação das 19:00 BRT
publica a edição e provoca o segundo rebuild do dia: dado da manhã + edição da noite.

**Integração com o Projeto 2 (newsletter).** A edição JSON é o payload que a newsletter
pode enviar, inclusive a morna. O ESP, o opt-in LGPD e o disparo são trabalho de painel humano
e ficam para o Projeto 2. Este projeto só garante que a edição é um artefato consumível.

## O que fica para quem construir

A forma exata do loader de conteúdo; os campos internos do schema desde que as regras duras
valor/observação/origem, fonte, prosa sem dígito, aviso e imutabilidade valham; a estrutura
interna dos testes; o seed inicial seguro do calendário e as primeiras lições derivadas dos
guias existentes; o texto-tipo das edições morna e material. **Não** é escolha do construtor:
publicar página datada em dia morno, publicar número sem lastro, aceitar fonte fora da
allowlist, alterar o cofre sem ordem ou atribuir revisão humana fingida.

## Nome

Decisão do dono: **"Diário do Investidor"**. O slug `/diario-do-investidor/` acompanha o nome.

## Ordem

Projeto 1 (este) primeiro: o motor de conteúdo no site. Projeto 2 (newsletter) depois, por
cima, consumindo a edição como payload.
