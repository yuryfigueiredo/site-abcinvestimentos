# Diário do Investidor — cobertura governada e simulação isolada

**Data:** 2026-11-27
**Status:** design para execução local; não autoriza publicação
**Edição preservada:** `src/data/diario/edicoes/2026-11-27.json`

## Intenção

Reduzir falsos negativos editoriais sem transformar o Diário em um agregador nem enfraquecer a curadoria. A edição morna de 27/11 revelou três limites concretos: a janela de 24 horas exclui uma norma publicada às 18h do dia anterior, a taxonomia não reconhece pagamentos/crédito, trabalho/renda e consumo, e o pipeline não explica por que cada candidato foi descartado.

A melhoria deve permitir uma simulação realista da edição de 28/11, usando apenas o que já é conhecido no momento da execução, sem falsificar o instante da coleta e sem escrever em `src/data/diario/edicoes/`.

## Decisões do dono

- Não alterar a edição publicada de 27/11.
- Não publicar a edição simulada de 28/11.
- Manter o cofre como fonte governada; esta ordem autoriza somente as mudanças exatas abaixo.
- Preservar o padrão de curadoria: sem recomendação, sem cripto, sem corpo de matéria, sem paráfrase de fonte CC BY-ND e sem material gerado em massa.

## Chamadas do implementador

- Manter a coleta diária às 19:00 BRT. Uma cadência apenas em dias úteis criaria um buraco de sexta para segunda e tornaria o histórico indisponível.
- Usar 30 horas de janela em dias úteis e 72 horas em sábado ou domingo, sempre relativas ao instante de referência da curadoria.
- Adicionar somente o feed de normativos do BCB, dentro do source `bcb` já aprovado. A URL anual exige manutenção explícita; ela não será atualizada silenciosamente.
- Adicionar os tópicos `pagamentos-credito`, `trabalho-renda` e `consumo`; remapear `payroll` para `trabalho-renda`.
- Manter no máximo três clusters selecionados e a exigência de duas mídias independentes para cluster de mídia.
- Criar diagnóstico persistente em cache, sem excerpts, para tornar cada descarte auditável.
- Criar uma simulação separada, sem fluxo de publicação e sem escrita em edições.

## Abordagens consideradas

### 1. Apenas ampliar palavras-chave

Adicionaria Black Friday, Pix e emprego ao classificador atual.

**Vantagem:** mudança pequena.
**Problema:** não corrige a borda da janela, não explica descartes e não oferece uma prévia futura segura.

### 2. Aumentar muito a janela e adicionar vários veículos

Tentaria compensar cobertura insuficiente com volume.

**Vantagem:** mais candidatos.
**Problema:** aumenta notícia velha, risco de duplicação, exposição a termos de uso e enfraquece a curadoria. Rejeitado.

### 3. Ampliação mínima governada, janela adaptativa e simulação isolada — escolhida

Combina exatamente as correções demonstradas pelos dados de 27/11, mantém limites editoriais e produz evidência antes de qualquer publicação.

## Escopo

### Janela de notícias

- `newsWindowHours: 30` para segunda a sexta.
- `weekendNewsWindowHours: 72` para sábado e domingo.
- O cálculo usa o dia editorial em `America/Sao_Paulo` e o instante de referência da curadoria.
- Uma notícia com publicação futura em relação ao instante de referência continua descartada.
- A janela maior não contorna deduplicação, allowlist, lastro ou limite de itens.

### Taxonomia

- `pagamentos-credito`: Pix, meio de pagamento, conta de pagamento, crédito, financiamento, endividamento, spread, cartão, empréstimo, securitização e originação de crédito.
- `trabalho-renda`: emprego, desemprego, ocupação, trabalho informal, renda, salário, salário mínimo, folha de pagamento e CAGED.
- `consumo`: consumo, Black Friday, compras, varejo, intenção de compra, desconto, poder de compra e confiança do consumidor.
- Incluir a variante `IGP-M` no reconhecimento de inflação.
- `payroll` passa a apontar para `trabalho-renda`.
- Em empate de pontuação, a precedência é: consumo, pagamentos/crédito, trabalho/renda, câmbio, inflação, bolsa/FIIs, renda fixa, juros e regulação. Assim, `spread` não fica sombreado por juros e crédito não é engolido por renda fixa.
- Palavras relacionadas a cripto continuam bloqueando a classificação.
- The Conversation Brasil continua descartada antes do clustering; a restrição CC BY-ND não é relaxada.
- Os três contextos de briefing serão educacionais, sem algarismos, sem HTML e sem recomendação.

### Fonte governada

Adicionar ao source `bcb` o feed:

```text
https://www.bcb.gov.br/api/feed/app/normativos/normativos?ano=2026
```

O feed é Atom, usa ementa curta e foi verificado com resposta 200. A URL sem o parâmetro anual retorna 500. A manutenção anual fica registrada no changelog e no design; o coletor não inventa outro ano automaticamente.

Permanecem desabilitados: Senado, CVM, IBGE, Tesouro Nacional, governo federal, Valor, InfoMoney, CNN, Agência Brasil, FGV e G1. Nenhum outro feed entra nesta mudança.

### Diagnóstico de descartes

A curadoria normal e a simulação usarão a mesma função. Cada candidato produzirá uma entrada com identificador, título, publicação, tópico reconhecido e motivo. Motivos mínimos:

- `selected`
- `duplicate-history`
- `outside-window`
- `future-publication`
- `topic-not-allowed`
- `source-not-allowed`
- `cc-by-nd`
- `media-needs-two-sources`
- `cluster-not-selected`
- `item-limit`

Cada entrada em `inputs.sources` recebe um único motivo terminal, na primeira porta que rejeita o candidato; um cluster elegível que não caiba no limite recebe `item-limit`. Entradas brutas que o parser de ingestão descarta por XML inválido, URL ausente ou excerpt vazio não são candidatos e não entram neste diagnóstico.

O diagnóstico fica em `.cache/diario/<date>/diagnostics.json` ou `.cache/diario/simulations/<date>/diagnostics.json`. Não contém excerpt, corpo, HTML ou dado que vá para a edição pública.

### Simulação de 28/11

Novo comando:

```bash
npm run diario:simulate -- 2026-11-28 --as-of 2026-11-28T22:00:00Z
```

- `retrievedAt` é o instante real da execução.
- `referenceAt` é o instante futuro usado apenas para a decisão editorial.
- A data editorial deve corresponder ao dia BRT de `referenceAt`.
- `referenceAt` não pode ser anterior a `retrievedAt`.
- Nenhum candidato com `publishedAt` posterior a `retrievedAt` pode entrar, mesmo que anterior a `referenceAt`; a prévia não usa publicação agendada ou futura.
- Saída exclusiva em `.cache/diario/simulations/2026-11-28/`.
- Gera `inputs.json`, `selection.json`, `diagnostics.json`, `draft.json` e, quando aplicável, `briefing.json`.
- O `draft.json` é uma prévia estrutural determinística, não texto jornalístico final: usa títulos e metadados factuais dos selecionados, contexto educativo do tópico e placeholders claramente neutros. Não invoca IA, não lê corpos e não produz recomendações. Uma redação final continua sendo trabalho editorial separado.
- O comando não aceita `--publish` e não chama publicação.
- A validação usa `npm run diario:validate -- 2026-11-28 --simulation`, também sem escrita em edições.
- O relatório deve dizer que a prévia considera somente o que já se conhece e pode não incluir notícias publicadas depois da coleta real.

### Metodologia e prompt

A metodologia pública explicará a allowlist, as janelas adaptativas, a curadoria e o fato de que a automação não publica notícia só para cumprir calendário. O prompt será versionado para refletir o novo contrato, mantendo preflight, lock, árvore limpa, validação, testes, build, verificação e push apenas após todos os portões.

A automação continua diária às 19:00 BRT. Este trabalho não configura nem altera o painel do Qoder.

## Fora de escopo

- Alterar 27/11.
- Publicar 28/11.
- Forçar status material.
- Criar página datada para edição morna.
- Adicionar recomendação, cripto, paywall ou corpo de matéria.
- Corrigir a ordem atual de validação/publicação antes dos testes no prompt.
- Migrar Astro ou Vitest.
- Criar ranking de relevância ou alterar o limite de três itens.
- Atualizar automaticamente o ano do feed.

## Critérios de aceite

1. Teste prova que uma norma publicada às 18h de quinta entra na janela de sexta às 19h.
2. Teste prova que sábado usa 72h e domingo também.
3. Teste prova que publicação futura em relação a `referenceAt` é rejeitada.
4. Testes cobrem os três tópicos novos, `payroll` e `IGP-M`.
5. Teste prova que o feed de normativos é coletado pelo source BCB.
6. Diagnóstico explica todos os candidatos relevantes e não contém excerpts.
7. Simulação de 28/11 preserva o timestamp real e não cria nem altera arquivo em `src/data/diario/edicoes/`.
8. `diario:validate --simulation` valida sem publicar e rejeita `--publish`.
9. `npm test`, build e verificação da superfície passam.
10. `src/data/diario/edicoes/2026-11-27.json` permanece byte-idêntico.
11. Nenhum commit ou push ocorre sem ordem explícita do dono.

## Riscos e mitigação

- **Janela maior traz notícia velha:** deduplicação e limite de três clusters permanecem; diagnóstico expõe a idade.
- **Feed anual quebra em janeiro:** changelog e metodologia registram a manutenção; nenhuma atualização automática.
- **Normas contábeis viram ruído:** classificação por assunto e insuficiência de mídia continuam valendo; diagnóstico permite auditoria.
- **Simulação futura parecer completa:** relatório e arquivo de saída deixam explícito que conhecem apenas o coletado até `retrievedAt`.
- **Mudança de cofre sem aprovação:** versões, hash, changelog e approval são atualizados juntos e testados.
