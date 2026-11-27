# Prompt da automação — Diário do Investidor

Versão obrigatória: `diario-2026-11-27-preflight-v4`.

Use este prompt no Qoder Automations do Mac, no repositório canônico, todos os dias às
**19:00 BRT**. A data da edição é a data corrente em `America/Sao_Paulo`. A publicação automática
já foi autorizada pelo dono e vale somente depois que todos os portões estiverem verdes; isso não
autoriza religar o Diário enquanto a superfície pública estiver offline.

## Contrato editorial e técnico

- Toda edição usa `schemaVersion: 2`. O `briefing` é obrigatório em edição material.
- O `briefing` é proibido em edição morna.
- Toda edição material traz `O que aconteceu`, `Por que importa` e `O que observar`, com no máximo
  quatro acompanhamentos. A edição com notícias mantém no máximo três notícias.
- Escreva título e resumo específicos, sem clickbait. A prosa editorial permanece sem algarismos e
  sem HTML. Números editoriais vêm exclusivamente do snapshot BCB da edição e ficam no painel
  factual; o título, data e link do evento são metadados factuais separados.
- O evento referenciado por `decision.eventId` deve ser copiado exatamente do calendário aprovado,
  com título, data e link preservados. A lição referenciada por `decision.lessonId` também deve ser
  copiada do registro aprovado, sem alteração.
- Defina `provenance.generator` como `qoder-diario`, `provenance.promptVersion` como
  `diario-2026-11-27-preflight-v4` e `provenance.disclaimerKey` como
  `educacional-nao-e-recomendacao`. Preserve o aviso educacional fixo.
- Nunca altere `decision.status`: a materialidade pertence à camada determinística. Nunca rebaixe
  material inválido para contornar o validador.
- Nunca edite o cofre em `src/data/diario/curadoria/`, incluindo carta, allowlist, thresholds,
  calendário, lições, changelog e approval. O cofre é somente leitura e verificação.
- Nunca use `git add -A`. Preserve arquivos alheios e trabalhe somente nos artefatos ignorados do
  cache e na edição do dia.
- Não copie corpo de matéria e não acesse paywall. Não persista excerpt no rascunho ou na edição.
- Não invente números, fatos, fontes ou eventos. Não publique recomendação de compra, venda ou
  aplicação. Não inclua cripto.
- The Conversation Brasil permanece sob CC BY-ND: seu excerpt é citação literal apenas. Nunca use
  um excerpt CC BY-ND como paráfrase, resumo ou tradução. Se ele for a única base possível para uma
  notícia reescrita e não houver superfície de citação literal aprovada, descarte a fonte e recalcule
  a seleção determinística.
- A cobertura governada usa trinta horas de janela em dias úteis e setenta e duas horas em fins de
  semana. O feed de normativos do Banco Central e os tópicos de pagamentos e crédito, trabalho e
  renda e consumo já fazem parte do cofre; não amplie fontes ou limites por conta própria.

## Workflow operacional

### 0. Provar o checkout canônico antes de qualquer escrita

O primeiro comando da execução é:

```bash
test "$(pwd -P)" = "/home/yury/Documentos/Projeto/abcinvestimentos" && npm run diario:preflight
```

Se o teste de caminho ou o preflight falhar, interrompe o run imediatamente. Não procure outra
pasta e não tente corrigir a pasta, branch ou remote. O preflight confirma a raiz física, a raiz
Git, a ausência de worktree, a branch `main`, os remotes de pull e push, os arquivos do cofre e as
rotas públicas. A ausência de qualquer rota mantém a automação desarmada enquanto o Diário estiver
offline. Nenhum lock, pull, coleta ou escrita pode acontecer antes desse portão.

### 1. Adquirir o lock antes de qualquer pull

1. Garanta `mkdir -p .cache/diario` e crie atomicamente o diretório
   `.cache/diario/automation.lock` com `mkdir`. Se o lock existente já estiver criado, interrompa o
   run para revisão do operador; não use idade, PID ou limpeza automática para removê-lo.
2. Grave um token de dono dentro do lock e instale imediatamente o cleanup `finally-style` com
   `trap ... EXIT`, além de traps de sinal, antes de qualquer pull. O lock permanece durante a
   validação, o build e o commit.
3. Um lock existente ou stale exige revisão do operador. Nunca remove lock alheio ou lock stale
   automaticamente.

### 2. Conferir a árvore e atualizar a base

1. Ainda sob o lock, rode `git status --porcelain`. Se houver árvore suja, interrompe o run.
2. Preserve arquivos alheios: não faça stash, reset, checkout ou limpeza para contornar a sujeira.
3. Rode `git pull --ff-only origin main`. Qualquer divergência ou falha interrompe o run.
4. Compare `git rev-parse HEAD` com `git rev-parse refs/remotes/origin/main`. Se os hashes forem diferentes,
   interrompe o run: não publique commits locais anteriores nem os descarte.
5. Confirme que `src/data/diario/edicoes/<date>.json` ainda não existe. A sobrescrita do mesmo dia é
   proibida; se a edição já existir, pare sem alterá-la.
6. Rode novamente `npm run diario:preflight` sobre o checkout já atualizado. Se a superfície, o
   cofre, a branch ou o remote mudarem no pull, interrompe o run antes de coletar ou escrever.

### 3. Verificar o cofre, coletar e recurar

1. Verifique somente por leitura o cofre e seu `approval.json`. Divergência de hash, versão ou
   aprovação interrompe o run; nunca corrija o cofre autonomamente.
2. Rode, nesta ordem:

   ```bash
   npm run diario:collect
   npm run diario:curate
   ```

3. Confira o código de saída de cada comando. Falha na coleta ou na curadoria interrompe o run.
4. `diario:curate` grava `.cache/diario/<date>/selection.json` em toda curadoria. Ele grava
   `.cache/diario/<date>/briefing.json` somente para material sem notícias e remove um
   `briefing.json` stale ou obsoleto quando essa condição deixa de valer. Se o artefato esperado
   estiver ausente, inconsistente ou obsoleto, pare; não improvise.
5. Leia `.cache/diario/<date>/diagnostics.json` como artefato de auditoria interno, sem excerpts.
   Ele registra um motivo terminal para cada candidato coletado. Nunca copie `diagnostics.json`
   para o rascunho ou para a edição pública.

### 4. Tratar perda de lastro na camada determinística

1. Se uma fonte selecionada não tiver lastro suficiente, descarte a fonte sem lastro do cache de
   evidência do dia, sem tocar no cofre nem nas edições publicadas, e execute novamente
   `npm run diario:curate` para recalcular a seleção determinística.
2. Leia a nova decisão de `selection.json`. Se continuar material, redija apenas com o que restou
   selecionado. A queda para morno somente se a camada determinística não encontrar razão material.
3. A automação nunca decide materialidade nem altera `decision.status`. Se o rascunho material
   ficar inválido, a execução para; não há downgrade silencioso nem publicação incompleta.

### 5. Redigir somente o rascunho ignorado

Escreva `.cache/diario/<date>/draft.json`. Use os fatos não editoriais do cache, como timestamp de
coleta e snapshot BCB, sem buscar dado novo na web. Para notícias, a única fonte de pauta é o cache
de curadoria.

#### Edição material com notícias

1. Faça a leitura exclusiva de `selection.json` para notícias e use somente os IDs selecionados,
  além das entradas aprovadas de lição ou evento explicitamente referenciadas ali.
2. Escreva título e resumo específicos e no máximo três notícias. Cada item usa um cluster
   selecionado, seu tópico e somente os `sourceIds` daquele cluster; preserve os metadados factuais
   das fontes.
3. Redija o briefing completo e original em `O que aconteceu`, `Por que importa` e `O que observar`,
   com dois a quatro acompanhamentos. Não introduza fonte, número ou evento fora do payload
   aprovado, não afirme causalidade sem lastro e não trate acompanhamento como previsão.
4. `O que aconteceu` tem de 240 a 1600 caracteres; `Por que importa`, de 200 a 1200; cada
   acompanhamento, de 60 a 320. A prosa não contém algarismos, HTML ou controles.

#### Edição material sem notícias

1. Copie o briefing determinístico validado do cache `.cache/diario/<date>/briefing.json` para
   `draft.json`, sem reescrever, resumir ou ajustar qualquer campo.
2. Título e resumo continuam sendo redigidos pela IA de forma específica, mas não podem contradizer
   a decisão, o snapshot, o evento ou a lição aprovados. Não reescreva o briefing nem improvise um
   fallback.

#### Edição morna

1. Escreva título e resumo quiet específicos a partir da decisão e dos fatos aprovados. Não inclua
   `briefing`, `event`, notícias, fontes ou lição. A edição morna não ganha URL datada.

Em todos os casos, monte `id`, `date`, `generatedAt`, `snapshot`, `decision`, `policy` e
`provenance` com os valores e fatos já aprovados no cache e no cofre. Preserve o snapshot sem
acrescentar valores ausentes. Inclua `event` apenas quando `decision.eventId` existir e `lesson`
apenas quando `decision.lessonId` existir. Grave somente o rascunho nesta etapa.

### 6. Validar, testar e verificar o build

Rode nesta ordem:

```bash
npm run diario:validate -- --publish
npm test
npm run build
npm run diario:verify-build -- --online
git diff --check
```

O comando de validação confirma schema, cofre, decisão, seleção, fontes, snapshot, briefing,
evento, duplicação e imutabilidade antes de gravar a edição. Um rascunho material inválido
interrompe a execução e não é publicado. Qualquer falha nos testes, no build ou no diff check
também interrompe o run: não commite nem publique. O `diario:verify-build` precisa confirmar a
superfície publicada esperada; qualquer Diário fora do contrato interrompe a execução.

### 7. Commitar e publicar automaticamente após todos os portões

1. Com todos os portões verdes, adicione somente a edição do dia:

   ```bash
   git add src/data/diario/edicoes/<date>.json
   git diff --cached --check
   git commit -m "docs(diario): publica edição <date>"
   ```

2. A checagem staged inclui a nova edição, que o `git diff --check` anterior não consegue ver.
   Qualquer falha interrompe o run antes do commit. O lock permanece até o fim do push. Não use
   `git add -A` nem inclua cache, rascunho, cofre ou arquivos alheios.
3. Com todos os portões verdes, faça `git push origin main`. A publicação automática autorizada
   pelo dono não dispensa validação, teste, build, verify-build, diff check ou a igualdade entre
   HEAD e `refs/remotes/origin/main` antes da edição do dia.

### 8. Liberar o lock em qualquer saída

A trap de cleanup instalada no passo primeiro roda em estilo `finally`, tanto em sucesso quanto em
erro: compara o token atual com o token dono, remove somente o marcador se ainda for o dono e depois
usa `rmdir` no diretório do lock. Não usa remoção recursiva, nunca remove lock alheio e nunca apaga
lock stale automaticamente. Se não puder liberar o próprio lock com segurança, interrompa e relate
o caminho para revisão do operador.
