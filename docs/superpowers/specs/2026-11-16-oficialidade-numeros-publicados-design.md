# Desenho: oficialidade dos números publicados e campos mortos

Data: 2026-11-16. Máquina: Mac A1278 (servidor oficial). HEAD de referência: `2868f8f`.

## Tamanho do trabalho

Uma mudança pequena, com uma tarefa de follow-up separada. Pequena porque não cria subsistema:
mexe em 1 config, 1 lib de dados, 1 componente de barra, o texto de 8 páginas já existentes,
apaga 1 diretório órfão e acrescenta 1 arquivo de teste. Se no meio aparecer que precisa de
fonte nova de dados, isso é a tarefa (b) e vira trabalho próprio, não expansão desta.

## Intent e o porquê

O site promete, em quatro lugares, "dados oficiais do Banco Central". Três dos números que
chegam em página indexada hoje não vêm de medição nenhuma:

- **Poupança 7,12% a.a.** é `6,17 + trAnual (0,95)`, com a TR congelada em
  `defaultIndicators` desde o commit `49e1855` (25/10/2026). A fórmula segue a regra oficial
  (Selic > 8,5% ⇒ 0,5% a.m. + TR), mas a TR nunca é buscada. Esse número aparece na barra de
  indicadores e nos resultados das 8 páginas `/quanto-rende/poupanca/*`.
- **`ibovespa: 131850`** e **`ifix: 3385`** saem no `/api/indicadores.json` com
  `source: "bcb-sgs-live"` sem nunca terem sido buscados: `load()` só consulta as séries
  432 (Selic), 4389 (CDI), 13522 (IPCA 12m) e 1 (Dólar PTAX). O Ibovespa real medido hoje é
  169.295,4 (fechamento −1,83%) — 22% acima do que o JSON publica como ao vivo.

Nenhum visitante vê o Ibovespa hoje (a barra tem cinco itens e não há consumidor do campo em
`src` nem em `api`). O risco dele é outro, e é exatamente o risco deste servidor: as
atualizações que ainda vamos implementar vão ler `indicators.ibovespa` achando que é vivo.

O objetivo é que, antes de qualquer feature nova, cada número publicado ou seja medido ou
declare ser fórmula com data de referência — e que isso não possa apodrecer de novo em
silêncio.

## Goals

1. Todo número exibido sob rótulo "oficial do Banco Central" é medido, ou é visivelmente
   declarado como fórmula com data de referência.
2. O JSON público para de publicar campo que nenhuma fonte busca.
3. Um portão com teste por mutação impede que a promessa volte a ser falsa.
4. `functions/` (Cloudflare Pages Functions, órfão desde `82e04fe` de 31/10) sai do repo.
5. O roteiro de skills M1/M2/M3 entra no AGENTS.md como contrato, para a próxima máquina
   não refazer a conversa.

## Non-goals

- Buscar a TR real da Poupança. Isso é a tarefa (b), separada, e depende de achar a série SGS
  correta primeiro.
- Redesenhar a barra de indicadores ou qualquer outro visual além do texto de ressalva.
- Criar página nova, produto novo ou mudança de precificação.

## Anti-goals

- Publicar a ressalva de forma tão discreta que o número continue lendo como medição oficial.
- Deixar um campo no JSON "porque alguém vai precisar" sem fonte — é o defeito que estamos
  corrigindo.
- Mexer nos valores em reais das 8 páginas de Poupança sem dizer quais páginas mudam e por quê.
- Fazer a promessa "oficial" voltar por outro caminho: um `source` único que cobre campos de
  origens diferentes.

## Restrições

- Site estático reconstruído na Vercel: taxa nova só entra no HTML com rebuild; o build já faz
  uma única coleta memoizada do BCB (`getIndicators`), e esta mudança não pode adicionar
  chamada externa ao build.
- `AGENTS.md`: mudança visual exige frame local → aprovação dele → só então push. Aprovar o
  conserto não aprova publicar.
- Commit com caminhos explícitos, nunca `git add -A`. Nada de referência a máquina específica
  (porta `tests/pc-independence.test.ts`).
- `vercel` e `gh` CLI não existem aqui; variáveis de ambiente e logs são trabalho de navegador.
- Testes são vitest (`npm test`), hoje em 70 casos / 11 arquivos, todos passando.

## Abordagens consideradas

- **(a) Publicar o que é fórmula sem fingir medição** — escolhida. A TR sai de
  `defaultIndicators` e vira parâmetro com data explícita; a barra e as 8 páginas dizem de
  onde vem o 7,12%. Custo: texto de ressalva em superfície existente, nenhum dado novo para
  manter. É a única opção que não pode errar para frente.
- **(b) Buscar a TR/Poupança medida** — adiada como tarefa própria. O probe feito hoje não
  resolveu a série: SGS 26 devolve 31/01/2024, SGS 179 devolve 01/03/2001, SGS 220 devolve
  01/11/1995, SGS 20106 devolve 105,27 (não é taxa de aplicação). Iria mover os valores
  publicados das 8 páginas, então precisa da série certa antes de código.
- **(c) Tirar Poupança do feed e deixar só a fórmula interna** — rejeitada: remove um número
  que o visitante procura, sem corrigir a promessa de oficialidade em que a barra insiste.

## Decisões de como fazer (minhas, marcadas como meus chamados)

**Fonte da verdade por campo, não por payload.** `Indicators` ganha proveniência explícita por
campo em vez de um `source` único. O `source` agregado sai do JSON; quem consome o payload
passa a ver o que é medido e o que é referência. Motivo: um rótulo só cobre oito campos de
origens diferentes, que foi precisamente o defeito que passou pela auditoria.

**Campos sem fonte saem, não ficam rotulados.** `ibovespa` e `ifix` desaparecem de
`defaultIndicators`, da interface `Indicators` e do JSON. Motivo: não há consumidor hoje e o
custo de reintroduzir com fonte é duas linhas quando a série existir.

**A TR sai de `defaultIndicators` e vira referência datada.** `defaultIndicators` é, por
definição, o valor usado quando o BCB falha; a TR é usada sempre, então ela não pertence
àquele objeto. Vai para um constante nomeada com `valor` e `referencia` (data), lida pelo
`load()` e exibida na ressalva.

**Texto da ressalva (rascunho, para aprovação junto com o frame).** Na barra: o item Poupança
passa a trazer no `title`/`aria-label` e num marcador discreto ao lado do valor a origem
("0,5% a.m. + TR ref. Out/2026"). Nas 8 páginas `/quanto-rende/poupanca/*`: uma linha abaixo da
tabela de resultados, antes do aviso CVM, com a mesma fórmula e a data de referência. O número
em si continua 7,12% — muda a alegação, não a cifra; a cifra é a tarefa (b) mexer.

**O portão.** Um arquivo de teste novo que amarra as duas coisas que acabam de ser verdade:
nenhum campo do JSON sem proveniência medida pode chegar ao payload, e a Poupança só pode ser
publicada acompanhada da referência. Teste por mutação obrigatório antes de confiar nele — se
eu escrever o teste de um jeito que passa com a promessa falsa de volta, o portão é decorativo.

**AGENTS.md.** Uma seção nova, curta, com as rotas M1 (verificação pasta vs. ar), M2 (achados
de auditoria) e M3 (atualizações futuras), cada uma com o nome da skill de entrada e o gate de
aprovação antes do push. Sem isso, a próxima sessão escolhe outra rota.

## O que fica para quem construir

A redação final da ressalva dentro do que for aprovado no frame; a estrutura interna do teste
(asserts separados ou parametrizados); como organizar a constante de referência desde que a
regra "referência tem data" continue valendo. O que não é escolha do construtor: manter campo
sem fonte no JSON, ou exibir Poupança sem dizer de onde vem.

## Estado medido de referência

Auditado hoje: `git` sync e árvore idênticas ao `origin/main`; 70/70 testes; HTML de `dist`
idêntico ao ar em 6 páginas, diferindo só de nomes de variáveis do minificador no snippet da
`@vercel/analytics`; 9 assets de `public/` com md5 igual no ar; 86 URLs no sitemap; JSON-LD em
todas as páginas testadas; cron respondendo 401 sem Bearer (logo `CRON_SECRET` existe na
Vercel); zero erro de console e 11/11 requisições 200. GA4 não roda no ar (sem id), Vercel Web
Analytics roda, e o opt-out funciona pelos dois caminhos.

Fora do escopo desta mudança, para decidir depois: as 6 variáveis que faltam no `.env` local em
relação ao `.env.example`, e o TODO de GA4 no `GOOGLE-SEARCH-CONSOLE.md:78`.
