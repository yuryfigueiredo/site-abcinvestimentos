# Mutation ledger — Diário do Investidor

Data: 2026-11-23. Task 3.

Comando de execução:

```bash
node .superpowers/sdd/2026-11-23-diario-do-investidor/run-task-3-mutations.mjs
```

Cada mutação foi aplicada isoladamente, o arquivo de teste indicado foi executado e o arquivo original foi restaurado em `finally`. Nenhuma mutação permaneceu no código. A primeira execução ampliada abortou por um alvo sintático incorreto no runner; após corrigir o alvo, uma lacuna de teste foi identificada e fechada antes da execução final.

| Mutação deliberada | Teste que falhou | Resultado observado |
|---|---|---|
| Remover a rejeição de dígitos na prosa | `validateEdition > rejects digits and HTML in editorial prose` | 1 falha / 33 passes |
| Remover a rejeição de HTML na prosa | `validateEdition > rejects digits and HTML in editorial prose` | 1 falha / 33 passes |
| Ignorar a reconstrução do snapshot | Três testes de snapshot, futuro e stale em `validate.test.ts` | 3 falhas / 31 passes |
| Aceitar mídia sem publishers independentes | Dois testes de publishers em `validate.test.ts` | 2 falhas / 32 passes |
| Aceitar CC BY-ND como única base autoral | `validateEdition > rejects a rewritten NewsItem based only on a CC BY-ND source` | 1 falha / 33 passes |
| Ignorar a recomputação de material/morno | Status adulterado e fonte repetida em `validate.test.ts` | 2 falhas / 32 passes |
| Desvincular evidência da coleta | `validateEdition > rejects evidence that differs from the collected source` | 1 falha / 33 passes |
| Desligar o delta substantivo do payload | `validateEdition > rejects a materially similar editorial payload` | 1 falha / 33 passes |
| Permitir reutilização de lição | `decideEdition > does not repeat a lesson already used in an earlier week` | 1 falha / 36 passes |
| Ignorar o hash do cofre | Dois testes de hash em `governance.test.ts` | 2 falhas / 35 passes |
| Ignorar lacuna no histórico diário | `validateAndPublish > marks history unavailable when a daily edition is missing instead of proving novelty` | 1 falha / 33 passes |
| Excluir observação da data da edição | Quatro testes de threshold/snapshot em `curate.test.ts` | 4 falhas / 33 passes |
| Rotular stale como medição atual | Cinco testes de stale em `curate.test.ts` | 5 falhas / 32 passes |
| Ignorar policy divergente | `validateEdition > rejects policy versions or source sets that diverge from the approved vault` | 1 falha / 33 passes |
| Reconstruir a seleção sem histórico | `decideEdition > keeps selected IDs aligned when a repeated source precedes a new cluster` | 1 falha / 36 passes |
| Aceitar observação anterior ambígua do dólar | `buildBcbSnapshot > does not calculate dollar change from conflicting observations on the prior date` | 1 falha / 36 passes |
| Aceitar edição de notícia sem evidência | `validateEdition > rejects a news edition that drops all selected evidence` | 1 falha / 33 passes |
| Desvincular data da edição da data BRT da coleta | `validateEdition > rejects a collection date that differs from the BRT retrieval date` | 1 falha / 33 passes |
| Contar aliases do mesmo publisher como mídia independente na curadoria | `decideEdition > does not count two allowlist IDs from one publisher as independent media` | 1 falha / 36 passes |
| Contar aliases do mesmo publisher como mídia independente na validação | `validateEdition > rejects two allowlist IDs that belong to the same media publisher` | 1 falha / 33 passes |
| Reabrir evento com excerpt copiado de título anterior | `decideEdition > does not treat an excerpt copied from a prior event source title as new evidence` | 1 falha / 36 passes |
| Calcular variação sobre valor stale publicado | `buildBcbSnapshot > does not calculate a dollar change when the published value remains stale` | 1 falha / 36 passes |
| Ignorar host da allowlist | `decideEdition > rejects an allowlisted source ID when the article host is not approved` | 1 falha / 36 passes |
| Aceitar item sem fonte | `validateEdition > rejects an item with no source` | 1 falha / 33 passes |
| Aceitar URL canônica repetida | `decideEdition > rejects repeated canonical URL` | 1 falha / 36 passes |
| Aceitar título normalizado repetido | `decideEdition > rejects repeated normalized title` | 1 falha / 36 passes |

Resultado: **26 de 26 mutações detectadas**.

## Achados da revisão focal

A revisão independente do diff não commitado contra `750937d` encontrou quatro achados altos/médios e um achado baixo. Os achados de código foram reproduzidos com testes antes da correção:

- **Alto:** edição com clusters de notícia podia descartar todos os itens e fontes. O validador agora exige evidência selecionada quando `newsClusterIds` não está vazio.
- **Alto:** `dollarChangePct` podia descrever observações diferentes do `measured.dolar` publicado. O cálculo agora exige que o valor publicado seja a observação atual `bcb-sgs` correspondente.
- **Médio:** a data da edição não era confrontada com a data BRT da coleta. `parseCollectedInputs` agora exige correspondência entre `inputs.date` e `inputs.retrievedAt`.
- **Médio:** dois IDs de allowlist do mesmo publisher contavam como independência. Curadoria e validação agora contam o publisher normalizado.
- **Médio:** evento anterior podia ser reaberto por excerpt copiado do título de uma fonte anterior. A comparação agora inclui títulos das fontes do evento; uma fonte oficial nova continua podendo justificar `official-news` por motivo independente.
- **Baixo, diferido:** o parser de `scripts/diario/curate.ts` aceita `--root` antes da data e ignora posicionais extras. O caminho usado pela automação não passa argumentos posicionais; a correção fica registrada para uma task futura sem ampliar este commit.

A execução final de mutações também expôs uma lacuna no teste de valor stale: o gate de decisão já bloqueava o gatilho, mas o snapshot ainda precisava de asserção direta de `dollarChangePct === null`. O teste novo falhou com a mutação (`expected 25 to be null`) e passou após restaurar o código original.

## Seed real

- Data: `2026-11-23`.
- Coleta: 54 candidatos, somente feeds allowlisted; nenhum corpo de matéria.
- Decisão: `material`, motivo `dollar-trigger`.
- Snapshot: dólar e demais campos exclusivamente do cache BCB; Selic futura foi omitida.
- Validação sem publicação: aprovada.
- Publicação exclusiva: `src/data/diario/edicoes/2026-11-23.json`.
- Nenhum push realizado.
