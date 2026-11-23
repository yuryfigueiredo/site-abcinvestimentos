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
   Todo número editorial publicado pertence ao snapshot BCB da edição.
4. Curadoria estruturada como cofre versionado: carta, allowlist, thresholds, calendário,
   lições, changelog e aprovação, com hash e teste impedindo mudança autônoma.
5. Honestidade nos dias mornos: a edição registra "sem alteração relevante" e o hub/endpoint
   podem mostrá-la, mas **nenhuma URL datada duplicada** é criada.
6. Um portão com teste por mutação que derruba a publicação se houver número fora do snapshot,
   fonte inválida, status/materialidade incorretos, aviso ausente, URL/evento/lição/payload
   duplicado ou cofre/aprovação divergentes.
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
  matéria. Toda requisição de feed usa o User-Agent transparente
  `ABCInvestimentosDiario/1.0 (+https://www.abcinvestimentos.com.br/diario-do-investidor/)`.
  Toda requisição de ingestão desativa redirect automático. Cada `Location` é
  resolvido e validado antes de novo request: somente `https:`, host e porta exatamente
  allowlisted, sem credenciais; no máximo três hops. Alvo proibido, `Location` malformado,
  loop ou excesso de hops falha fechado e pula somente aquela fonte. O excerpt vem de
  `description`/`summary`; apenas na ausência deles, usa `content` do Atom tipo `text`
  (ou sem tipo) ou `html`, normalizado como texto e limitado a 600 caracteres. Tipos
  desconhecidos, inclusive `application/xhtml+xml`, falham fechado sem extrair texto
  aninhado. RSS `content:encoded` não é fallback e artigo completo nunca é requisitado.
- Todos os números editoriais publicados vêm exclusivamente do snapshot BCB da edição. A
  prosa editorial não contém algarismos; blocos numéricos são renderizados separadamente a
  partir de `edition.snapshot`. Não existe esquema de fato determinístico nem permissão para
  publicar número calculado ou redigido fora do snapshot.
- Conteúdo educacional, nunca recomendação de compra/venda. O aviso é fixo e não editável pela
  IA em toda edição.
- O cofre da curadoria só muda por ordem explícita do dono, registrada em `approval.json` e
  `changelog.md`, com hash recomputado e testes verdes. O hash cobre somente os seis arquivos
  de conteúdo; `approval.json` é validado, nunca incluído no próprio hash.
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
número editorial aparece fora do snapshot e nenhum dígito aparece na prosa editorial. O
`policy` público contém apenas versões, IDs de fontes e hosts; thresholds numéricos ficam no
cofre e não são renderados como fatos.

**Cofre de curadoria com aprovação/hash/teste.** `src/data/diario/curadoria/` contém
`carta.md`, `allowlist.json`, `thresholds.json`, `calendario.json`, `licoes.json`,
`changelog.md` e `approval.json`. A carta registra escopo tradicional, política de fontes,
critério material/morno, cadência, automação, regra de mudança e newsletter fora do escopo.
O procedimento é: ordem explícita do dono → editar arquivos do cofre → append no changelog →
recomputar o hash → atualizar `approval.json` com `instructionRef` → rodar os testes. O hash
SHA-256 cobre somente os bytes dos seis arquivos de conteúdo em ordem fixa (`carta.md`,
`allowlist.json`, `thresholds.json`, `calendario.json`, `licoes.json`, `changelog.md`),
separados por `path + \0 + bytes + \0`; `approval.json` nunca entra no próprio hash.
`approval.json` exige `bundleSha256` hexadecimal minúsculo de 64 caracteres igual ao hash,
`charterVersion` no formato `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` e igual ao charter/changelog,
`approvedAt` em UTC ISO válido, `approvedBy` com um a 120 caracteres após trim e sem controles,
e `instructionRef` com o caminho relativo exato do plano commitado.
A automação apenas lê e verifica o cofre; nunca o edita.

**Curadoria é dado + evidência, não decisão livre da IA em runtime.** A coleta busca BCB e
somente feeds `enabled` da allowlist, revalida cada hop e guarda evidência normalizada no
cache ignorado. `SourceRef` e `SourceCandidate` aceitam `author?` e `licenseUrl?` opcionais;
`AllowlistSource` declara `licenseUrl?`, propagado sem invenção para cada candidato. O autor
vem de Atom `author/name` ou RSS `dc:creator` com o prefixo `dc` vinculado ao namespace
Dublin Core canônico; prefixo ausente, URI falsa ou autor inválido omitem a atribuição.
Múltiplos autores Atom são preservados em ordem, separados por `; `. `decideEdition` usa
somente calendário, thresholds, lições e
notícias coletadas. `selection.json` registra a decisão e, para cada fonte selecionada,
`sourceId`, `publisher`, `kind`, `title`, `canonicalUrl`, `publishedAt`, `retrievedAt`,
`author?`, `licenseUrl?`, `excerpt`, `excerptSha256`, cluster e tópico. A IA lê somente
`selection.json` e as entradas aprovadas de lição/evento explicitamente referenciadas ali;
nunca busca corpo de matéria. Redige no máximo 3 itens, com prosa original e sem recomendação.

**Limite CC BY-ND do The Conversation Brasil.** O excerpt dessa fonte é evidência de citação
literal, nunca insumo para paráfrase, resumo ou tradução pela IA. Até existir superfície de
citação literal aprovada, ela pode ser coletada, mas não pode ser a única base de um
`NewsItem` reescrito; a Task 3 deve rejeitar esse caso. Qualquer superfície pública futura
precisa apresentar juntos manchete, trecho literal, autor, publisher, link do artigo e link da
licença.

**Decisão material vs. morno (determinística).** É `material` se houver evento do calendário,
`|Δdólar| >= 1,0`, notícia oficial com fonte suficiente ou notícia de mídia corroborada por
pelo menos 2 veículos independentes. A lição de segunda só entra se o dia estiver quiet e
ainda não houver lição na mesma semana ISO. Caso contrário é `morno`: a edição é registrada e
consumível, mas não vira página indexada.

**Portão substantivo anti-duplicação (determinístico).** O histórico de comparação são as
10 edições `material` mais recentes anteriores à candidata (ou todas, se houver menos); IDs de
lição também são comparados com todas as edições anteriores. Lista vazia é histórico válido;
arquivo de edição ausente, inválido ou ambíguo não é. URL canônica é normalizada com URL HTTPS, host em
minúsculas, remoção de porta padrão, fragmento e parâmetros de rastreamento conhecidos, e
demais query params ordenados. Texto usa Unicode NFKC, minúsculas, remoção de diacríticos e
colapso de pontuação/espaços. Similaridade é Jaccard de shingles de três tokens, com limiar
`0.80`; textos com menos de três tokens usam o texto normalizado inteiro.

Um cluster é rotulado duplicado quando todas as suas fontes repetem URL canônica ou título
normalizado já visto, ou quando o agregado dos títulos/excertos selecionados atinge o limiar
contra `headline/summary/whyItMatters` de um item material anterior. Um evento com o mesmo
`eventId` só é novo se houver ao menos uma fonte com URL canônica inédita para aquele evento,
título com similaridade abaixo do limiar, excerpt não vazio e hash válido, e o excerpt também
ficar abaixo do limiar contra o texto editorial e os títulos de fontes daquele evento no
histórico. Uma lição é duplicada se o `lessonId` já apareceu ou se título/corpo atingem o
limiar. O validador repete
a comparação do payload editorial completo (`title`, `summary`, itens e lição) contra cada
edição material recente e rejeita igualdade normalizada ou similaridade igual/superior a
`0.80`.

Entrada de histórico ausente, inválida ou ambígua não prova novidade: resulta em `morno` com
`history-unavailable`. Se todos os candidatos substantivos forem duplicados e não restar
razão material independente, resulta em `morno` com `no-substantive-delta`. A quiet nunca
cria URL datada.

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
título, link, data, autor e licença das fontes — nunca excerpt longo nem corpo copiado. A UI
futura deve mostrar autor/publisher e link da licença quando existirem; para The Conversation
Brasil, a citação literal só pode aparecer com manchete, trecho, autor, publisher, link do
artigo e link da licença juntos. Reusa `CalcDisclaimer` e a frase única de origem da poupança
nas superfícies existentes. Todo número editorial do Diário vem exclusivamente do snapshot
BCB da edição e é renderizado em bloco separado.

**O portão (teste por mutação obrigatório).** O validador revalida schema, cofre, aprovação,
fontes, delta substantivo, status, snapshot e imutabilidade antes de escrever a edição final.
O teste falha se: houver número editorial fora do snapshot; faltar `provenance`/`disclaimer`;
fonte não allowlisted ou insuficiente; URL/título, evento, lição ou payload duplicado; `morno`
gerar URL datada; mesmo dia sobrescrito; campo/formato de aprovação inválido; hash de aprovação
divergente. Mutação obrigatória antes de confiar — se o teste passar com número inventado,
duplicata ou cofre alterado, o portão é decorativo.

**A automação (entrega = o prompt).** Roda diariamente no Qoder do Mac às **19:00 BRT**:
adquirir lock exclusivo → conferir árvore suja → `git pull --ff-only origin main` → verificar
cofre/aprovação → `diario:collect` → `diario:curate` → preencher somente o rascunho ignorado a
partir de `selection.json` e das entradas aprovadas ali referenciadas → `diario:validate --
--publish` → `npm test` + `npm run build` + `git diff --check` → commit com caminhos
explícitos → `git push origin main` (Vercel rebuilda). O lock é adquirido antes do pull e
mantido até o fim da validação/build/commit; a liberação ocorre em cleanup `finally`-style,
inclusive em erro. Lock existente/stale interrompe o run para revisão do operador e nunca é
apagado automaticamente. Guardas: nunca `git add -A`; nunca editar o cofre; não
commitar/pushar com teste ou build falhando; em qualquer dúvida de lastro ou novidade,
decair para `morno`.

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
