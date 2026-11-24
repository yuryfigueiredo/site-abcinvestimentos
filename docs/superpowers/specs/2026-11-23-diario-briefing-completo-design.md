# Design: briefing completo do Diário do Investidor

Data: 2026-11-23. Worktree: `feat/diario-do-investidor`. HEAD de referência: `dfe1179`.

## Tamanho do trabalho

É uma **iteração de produto e editorial**, não só um ajuste de CSS. Ela amplia o formato da
edição material, o schema publicado, o portão de validação e a experiência de leitura. O hub,
a política de materialidade, os thresholds, as fontes e o cofre permanecem como estão.

## Intent e porquê

O leitor deve terminar uma edição material sabendo **o que aconteceu**, **por que aquilo importa**
e **o que merece acompanhamento**, sem precisar montar essa narrativa sozinho.

Hoje uma edição material causada apenas pelo dólar mostra título, resumo e snapshot, mas não
explica o movimento nem oferece um fechamento de leitura. A seed atual não tem notícias nem
fontes jornalísticas; portanto, melhorar apenas a tipografia deixaria a matéria fina.

A direção escolhida é manter a curadoria grounded e transformar cada edição material em um
briefing completo. Em dia sem notícia, o contexto nasce do snapshot e de regras determinísticas.
Em dia com notícia, a redação usa exclusivamente as fontes já selecionadas.

## Goals

1. Toda edição material tem três blocos editoriais explícitos: **O que aconteceu**, **Por que
   importa** e **O que observar**.
2. O snapshot é mostrado como base factual completa, incluindo a variação do dólar quando ela
   existe e a indisponibilidade de indicadores ausentes.
3. Toda edição mostra uma base de fontes útil: BCB para dados, evento oficial para calendário e
   fontes allowlisted para notícias.
4. A prosa continua sem algarismos e sem HTML; todos os números vêm do snapshot ou de metadados
   factuais separados.
5. A leitura fica confortável em desktop e mobile, com medida, hierarquia e ritmo editorial
   melhores, sem JavaScript novo.
6. O payload do endpoint já nasce completo para consumo futuro da newsletter.
7. O cofre não é alterado.

## Non-goals

- Não publicar página datada em dia morno.
- Não criar notícia, fonte ou fato novo para preencher o briefing.
- Não transformar “O que observar” em recomendação de compra, venda ou aplicação.
- Não buscar corpo de matéria, paywall ou conteúdo CC BY-ND para paráfrase.
- Não mudar thresholds, allowlist, calendário, lições ou critério de materialidade.
- Não redesenhar o hub nem a identidade visual do site.
- Não resolver newsletter, LGPD ou disparos; continuam no Projeto 2.

## Anti-goals

- Três seções genéricas repetidas em toda edição só para inflar a página.
- Um “Por que importa” que afirme causalidade sem lastro.
- Um “O que observar” que invente eventos futuros ou números.
- Esconder indicador indisponível ou apresentar dado antigo como observação de hoje.
- Fazer o endpoint crescer sem que a UI e o validador acompanhem o novo formato.

## Constraints

- Nenhuma chamada externa nova no `astro build`.
- Nenhum arquivo em `src/data/diario/curadoria/` muda nesta iteração.
- A data da edição continua em `America/Sao_Paulo`; a automação continua prevista para 19:00 BRT.
- Página datada continua exclusiva para edição `material` e sem `getIndicators()`.
- Todo número editorial continua vindo de `edition.snapshot`; datas de fonte e códigos de série
  são metadados factuais, não prosa editorial.
- Aviso educacional fixo continua em toda edição.
- The Conversation Brasil continua sem paráfrase, resumo ou tradução pela IA.
- Mudança de template exige novos frames desktop/mobile e aprovação visual antes de qualquer push.

## Abordagens consideradas

### (a) Briefing completo estruturado — ESCOLHIDA

Ampliar a edição material com um objeto editorial próprio, validar esse objeto e renderizar uma
sequência clara de leitura. Em dias sem notícia, o briefing é determinístico; em dias com notícia,
a IA o escreve a partir das fontes selecionadas.

**Por que escolhemos:** resolve a causa do problema, que é a ausência de narrativa completa, e
mantém o mesmo nível de lastro do restante do Diário.

**Custo:** migração de schema, atualização da seed, testes e validação adicional.

### (b) Só melhorar diagramação — REJEITADA

Aumentar corpo, espaçamento e hierarquia sem mudar o conteúdo.

**Por que não atende:** a página continuaria sendo um resumo curto em dias de gatilho cambial.

### (c) Contexto educativo genérico em toda edição — REJEITADA

Usar trechos dos guias para completar o artigo independentemente da pauta.

**Por que não atende:** tende a virar enchimento, duplica conteúdo evergreen e enfraquece a
promessa de leitura do dia.

## Experiência de leitura

A página datada passa a ter esta ordem:

```text
Pão de morno + data
Badge + data + byline honesta
Título
Resumo em uma ou duas frases

O QUE ACONTECEU
Relato completo e sóbrio do fato do dia

Painel factual da edição
Indicadores, datas de observação, origem e variação cambial

POR QUE IMPORTA
Leitura de contexto, sem recomendação

Notícias selecionadas (quando houver)
Cada item mantém tema, resumo, importância e fontes

O QUE OBSERVAR
Dois a quatro pontos de acompanhamento, sem fato novo

Lição da semana (quando houver)
Evento oficial (quando houver)
Fontes e aviso legal
Calculadora relacionada + voltar ao hub
```

No desktop, o painel factual fica na coluna lateral e acompanha a leitura. No mobile, ele vem
logo após o resumo, antes do desenvolvimento, para o leitor entender os números antes da
interpretação.

## Contrato editorial

### Comum a toda edição material

- `title`: manchete específica, sem clickbait e sem algarismos.
- `summary`: síntese de uma ou duas frases; não repete mecanicamente todo o briefing.
- `briefing.whatHappened`: relato do fato que tornou a edição material.
- `briefing.whyItMatters`: contexto educacional proporcional ao fato, sem recomendação.
- `briefing.whatToWatch`: lista de dois a quatro acompanhamentos concretos.
- Todos os campos de prosa continuam sem dígitos, HTML, controles e espaços externos.
- O briefing integra a comparação anti-duplicação como o restante do payload editorial.

### Edição com notícias

- A IA escreve o briefing usando apenas `selection.json`, os itens e as fontes já aprovadas.
- Nenhuma seção pode introduzir fonte, número ou evento que não esteja no payload validado.
- “O que observar” aponta desdobramentos possíveis ou perguntas a acompanhar; não afirma que
  acontecerão.
- As fontes continuam aparecendo por item e na lista final.

### Edição sem notícias

- O briefing é **determinístico**, derivado de `decision.reasonCodes`, `snapshot`,
  `eventId` e `lessonId`.
- `diario:curate` grava `.cache/diario/<data>/briefing.json` somente nesses casos. O prompt
  copia esse artefato para o rascunho; título e resumo continuam sendo redigidos pela IA.
- O validador também recomputa esse briefing e exige igualdade profunda; a IA não pode
  improvisá-lo.
- Gatilho cambial: explicar que a variação superou o limiar editorial, mostrar a variação no
  painel factual e orientar o leitor a acompanhar novas observações e compromissos em moeda
  estrangeira, sempre em tom educacional.
- Evento de calendário: registrar o evento aprovado, sua data e fonte oficial, sem inventar
  resultado.
- Lição de segunda: usar o título e o corpo aprovados da lição e manter o link para o guia.
- Quando houver mais de uma razão material, o texto determina prioridade editorial, mas todos
  os fatos relevantes aparecem no painel ou em bloco próprio.

### Edição morna

- Continua sem URL datada.
- Não recebe briefing completo nem página de artigo.
- O hub e o endpoint continuam podendo consumir título e resumo quiet.

## Modelo de dados

A mudança é uma quebra explícita de schema. Como o endpoint ainda não é público e só existe a
seed commits, a versão passa a **2** e a seed é migrada no mesmo commit.

```ts
export interface EditorialBriefing {
  whatHappened: string;
  whyItMatters: string;
  whatToWatch: string[];
}

export interface Edition {
  schemaVersion: 2;
  // campos atuais...
  briefing?: EditorialBriefing;
  event?: CalendarEvent;
}
```

Regras:

- `briefing` é obrigatório em edição `material` e proibido em edição `morno`.
- `whatHappened`: de 240 a 1600 caracteres.
- `whyItMatters`: de 200 a 1200 caracteres.
- `whatToWatch`: de dois a quatro itens, cada um de 60 a 320 caracteres.
- `event` é obrigatório quando `decision.eventId` existe, proibido caso contrário e deve ser
  idêntico ao evento aprovado no cofre.
- `event` e `briefing` entram automaticamente no payload do endpoint.

## Painel factual e fontes

O painel deixa de listar apenas indicadores presentes e passa a mostrar os quatro campos do
snapshot:

- Selic, CDI, IPCA acumulado e Dólar/PTAX.
- Valor e data somente quando existem no snapshot.
- “Indisponível” quando o campo não existe, sem inventar valor ou data.
- Origem por campo: medição BCB, dado anterior ou indisponível.
- Quando `dollarChangePct` não for nulo, a variação aparece em destaque, comparada à observação
  anterior. O número vem exclusivamente do snapshot.
- Rodapé factual: Banco Central do Brasil, SGS, com os códigos das séries usados pelo sistema.

As fontes da matéria ficam organizadas por tipo:

- **Dados:** nota do BCB no painel factual.
- **Calendário:** cartão do evento com título, data e link da fonte oficial.
- **Notícias:** `SourceList` atual, com publisher, título, data, autor e licença quando houver.

## Validação e mutação

O validador passa a exigir:

1. Schema versão 2 e briefing completo para material.
2. Ausência de briefing e evento em edição morna.
3. Evento idêntico ao registro aprovado quando referenciado.
4. Briefing determinístico exato em edição sem notícias.
5. Briefing incluído no payload de similaridade das edições com notícias. Um briefing copiado
   também é rejeitado por igualdade normalizada de seção contra edições materiais anteriores.
6. Em edição sem notícias, os templates explicativos fixos não entram sozinhos no cálculo de
   similaridade; a novidade é julgada pelo diferencial factual, como razão material, indicadores,
   datas de observação e variação cambial. Assim, um novo gatilho cambial não é bloqueado apenas
   por repetir a explicação educativa.
7. Continuação de todos os gates atuais: snapshot, fontes, materialidade, cofre, imutabilidade,
   CC BY-ND e histórico.

### Limites da validação

O gate é machine-checkable para schema, dígitos, HTML, fontes, evento, snapshot, briefing
determinístico e duplicação. Ele não pretende provar semanticamente causalidade ou ausência de
fato novo na prosa livre. Isso continua protegido pela restrição do prompt às fontes selecionadas,
pela revisão da seed e pelo acompanhamento humano da primeira execução real.

### Fallback quando o rascunho perde lastro

A automação nunca reescreve `decision.status`. Se a dúvida estiver na evidência, a fonte é
descartada e a seleção determinística é recalculada; se não restar razão material, a edição nasce
`morna`. Se o rascunho material falhar o validador, a execução para e não publica uma versão
incompleta. O fallback quiet acontece na camada determinística, não por mutação manual do status.

Mutação mínima desta iteração:

- Remover cada uma das três seções de uma edição material.
- Inserir algarismo ou HTML no briefing.
- Reduzir “O que observar” a um único item.
- Inserir briefing em edição morna.
- Alterar o briefing determinístico de um dia sem notícias.
- Copiar o briefing de uma edição material com notícias e exigir rejeição por duplicação.
- Referenciar evento divergente do cofre.
- Fazer a UI esconder um indicador ausente ou a variação cambial existente.

## Diagramação

Manter a direção visual já aprovada: fundo midnight, Inter para texto, JetBrains Mono para datas,
rótulos e dados. Não há fonte, imagem, dependência ou JavaScript novo.

Ajustes:

- Corpo com medida próxima de 68–72 caracteres e `line-height` entre 1,75 e 1,85.
- Resumo com corpo maior e `text-wrap: pretty`; títulos com `text-wrap: balance`.
- Blocos editoriais separados por espaço e régua fina, não por cards pesados.
- “Por que importa” ganha uma régua lateral discreta.
- “O que observar” usa lista legível, sem aparência de checklist de recomendação.
- Fontes e metadados com tamanho legível, pelo menos equivalente ao corpo pequeno do site.
- Números com `font-variant-numeric: tabular-nums`.
- Foco visível, contraste existente e responsivo até 390 px.
- Sem animação nova; `prefers-reduced-motion` continua respeitado pelo site.

## Arquivos afetados

- `src/lib/diario/types.ts`
- `src/lib/diario/schema.ts`
- `src/lib/diario/curate.ts`
- `src/lib/diario/validate.ts`
- `scripts/diario/curate.ts`
- `src/components/diario/EditionBody.astro`
- `src/components/diario/IndicatorGrid.astro`
- `src/components/diario/SourceList.astro`
- `src/pages/diario-do-investidor/[date].astro`
- `src/pages/diario-do-investidor/metodologia.astro`
- `src/data/diario/edicoes/2026-11-23.json`
- `tests/diario/*.test.ts` e `tests/seo-schema.test.ts`
- `scripts/diario/verify-build.ts`
- `docs/diario/automation-prompt.md`
- `tests/diario/automation-prompt.test.ts`

A Task 7 é antecipada para esta iteração: não faz sentido ativar uma automação que ainda
produziria o schema antigo. O hub, o endpoint, o store e o sitemap não mudam de comportamento;
apenas passam a consumir o schema 2.

## Automação

O prompt da Task 7 deve exigir:

- título e resumo específicos;
- briefing completo em toda edição material;
- em dia com notícia, uso exclusivo de `selection.json` e dos IDs selecionados;
- em dia sem notícia, uso do briefing determinístico gerado pelo sistema, sem improviso;
- no máximo três notícias e quatro acompanhamentos;
- prosa original, sem dígitos, HTML, recomendação, cripto ou fato novo;
- queda para edição morna em qualquer dúvida de lastro.

## Verificação

- TDD com RED→GREEN para schema, validação e renderização.
- Mutação dos casos listados antes de confiar no portão.
- Suíte completa, TypeScript, build e `diario:verify-build`.
- Frames desktop/mobile de:
  - edição material sem notícias, usando a seed migrada;
  - edição material rica em notícias, usando fixture local descartável;
  - metodologia atualizada.
- Inspeção de console, links internos, canonical, JSON-LD, snapshot imutável e endpoint.
- Nova aprovação visual antes de push. Aprovação do design não aprova publicação.

## O que fica para quem construir

- A redação exata dos templates determinísticos, dentro do contrato acima.
- A implementação do helper de briefing e seus nomes internos.
- Os valores finais de espaçamento e tipografia dentro das faixas definidas.
- A estratégia dos fixtures de teste e das capturas locais.

Não fica para o construtor:

- alterar o cofre ou criar fonte nova;
- publicar página datada morna;
- inventar número, notícia, evento ou recomendação;
- fazer push sem aprovação visual e ordem explícita.
