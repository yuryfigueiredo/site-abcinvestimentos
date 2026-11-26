# Design: preflight da automação do Diário do Investidor

Data: 2026-11-26. Worktree: `fix/diario-offline-2026-11-26`. HEAD de referência: `4c9a84b`.

## Tamanho do trabalho

Pequena mudança de segurança operacional: um portão determinístico antes de qualquer escrita da
automação. Não restaura o Diário, não altera o site e não configura o Qoder.

## Intent e porquê

Uma execução anterior entrou na pasta errada e causou estrago. Texto de prompt, sozinho, não é
suficiente: o primeiro comando precisa provar que está no checkout canônico do Mac e parar antes de
lock, pull, coleta ou escrita quando não estiver.

## Goals

1. Expor `npm run diario:preflight`, sem argumentos e sem escrita.
2. Exigir a raiz física `/home/yury/Documentos/Projeto/abcinvestimentos`, branch `main` e exatamente
   um URL de pull e um de push em `origin`, ambos iguais ao remote aprovado.
3. Rejeitar worktree, HEAD destacado, diretório sem Git, arquivo obrigatório ausente e superfície
   pública do Diário ainda offline.
4. Fazer o prompt usar o preflight como primeiro comando e parar sem procurar outra pasta.
5. Versionar o prompt e cobrir o contrato com testes de mutação.
6. Após o pull, exigir `HEAD` igual a `refs/remotes/origin/main` e repetir o preflight antes da
   coleta, para não publicar commits locais anteriores nem aceitar uma superfície que mudou no pull.

## Non-goals

- Configurar, agendar ou executar automação no Qoder.
- Restaurar páginas, endpoint ou links do Diário.
- Alterar o cofre, a curadoria, o conteúdo publicado ou a identidade visual.
- Commitar ou publicar esta mudança sem pedido explícito.

## Anti-goals

- Aceitar worktree ou branch de feature como se fosse o checkout canônico.
- Validar apenas o primeiro URL de fetch ou push e ignorar URLs adicionais.
- Continuar depois de qualquer divergência.
- Deixar a automação produzir edição enquanto a superfície pública estiver removida.

## Constraints

- Nenhuma chamada externa, lock, cache ou modificação de arquivo no preflight.
- O CLI usa exclusivamente `process.cwd()`; não oferece `--root` para contornar o contrato.
- A função de biblioteca aceita a raiz esperada somente para testar o contrato em repositórios
  temporários; o CLI sempre usa a constante de produção.
- Falha retorna código um e mensagem única em português.
- O prompt mantém cofre somente leitura, `git add -A` proibido e validação antes de publicação.

## Approaches

### (a) Reforçar somente o texto do prompt — rejeitada

O modelo poderia ignorar a instrução ou interpretar “procure o repositório” de forma ampla. Não há
portão executável nem mutação que prove a parada.

### (b) Inline shell no prompt — rejeitada

Repete lógica em documentação, dificulta testes e permite divergência entre o prompt e o script.

### (c) Script versionado + preflight no prompt — escolhida

O script é testado contra repositórios temporários e o prompt só chama esse portão. A checagem da
superfície pública mantém a automação desarmada enquanto o Diário estiver offline.

## Contrato

```ts
export const DIARIO_AUTOMATION_CONTRACT = {
  root: '/home/yury/Documentos/Projeto/abcinvestimentos',
  branch: 'main',
  remote: 'git@github.com-abcinvestimentos:yuryfigueiredo/site-abcinvestimentos.git',
  requiredFiles: string[],
} as const;

export function verifyDiarioPreflight(
  actualRoot: string,
  expectedRoot?: string,
): void;
```

Ordem de verificação: raiz física → raiz Git → checkout comum (não worktree) → branch → URLs de
pull → URLs de push → arquivos obrigatórios. A leitura usa `git remote get-url --all` e exige uma
única URL aprovada em cada direção. Os arquivos obrigatórios incluem os sete arquivos do cofre e as
quatro rotas públicas removidas na retirada.

O prompt passa a usar `diario-2026-11-26-preflight-v3`, chama o preflight antes do lock e inclui
`npm run diario:verify-build -- --online` no portão final. A publicação automática já autorizada pelo
dono vale somente depois que todos os portões passarem; ela não autoriza religar o Diário offline.

### Estados da superfície e verificação de build

O verificador tem modo explícito. Sem argumentos, ele preserva o bloqueio offline e rejeita qualquer
página, endpoint, sitemap ou link público do Diário. Com `--online`, ele verifica hub, arquivos
materiais, ausência de URL datada para edição morna e endpoint alinhado à última edição. O fixture
online usa um dataset isolado com uma única edição, para não quebrar quando uma edição posterior for
acrescentada ao repositório. Os testes de superfície acompanham o estado real do checkout: todas as
quatro fontes presentes indicam o modo online; todas ausentes indicam o modo offline; estado parcial
falha. Nenhum desses caminhos restaura o Diário neste trabalho.

## Verificação

- RED→GREEN para raiz errada, worktree em `main`, branch errado, HEAD destacado, remotes de pull e
  push errados, URLs adicionais em pull e push, cada arquivo obrigatório ausente e superfície offline.
- Provar que o preflight não cria `.cache` nem lock.
- Suíte completa, TypeScript, build, `diario:verify-build` offline, fixture do modo online e
  `git diff --check`.
- Antes de ativar no Mac, rodar manualmente no checkout canônico. Com o Diário offline, a falha pela
  superfície ausente é o resultado correto e prova o bloqueio; a liberação só ocorre após restauração
  visual aprovada.

## O que fica para o construtor

- Mensagens exatas de erro dentro do contrato.
- Implementação mínima do script e dos testes.
- Ajuste do prompt e da versão sem configurar Qoder.
