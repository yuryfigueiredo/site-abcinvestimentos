# Changelog do Cofre da Curadoria

## 1.0.0 — 2026-11-23

- Criação do Diário do Investidor com escopo macro tradicional, política de fontes e critério material ou morno.
- Cadência e automação fixadas no fuso de São Paulo, com lição semanal somente em dia quiet.
- Allowlist inicial com candidatos ainda desabilitados até a verificação de feeds e termos.
- Calendário deixado vazio por falta de datas macro verificadas em fonte oficial durante esta tarefa.
- Doze lições educacionais derivadas de guias existentes, sem afirmação factual nova.

## 1.0.1 — 2026-11-23

- Lição de resgate corrigida: aniversário da poupança e IOF regressivo do CDB antes de trinta dias ficaram em regras distintas.
- Parser estrutural passou a rejeitar IDs duplicados de notícias e fontes e referências de notícias a fontes inexistentes.
- Lista de hosts passou a aceitar o limite DNS de cento e cinquenta e três caracteres, sem afrouxar os demais identificadores.
- Allowlist passou a declarar versão semântica própria em `{ version, sources }`; `Vault.allowlistVersion` guarda esse valor e `Vault.allowlist` continua sendo o array de fontes.

## 1.0.2 — 2026-11-23

- Por ordem explícita do dono, a ativação governada habilitou somente os três feeds verificados do Banco Central e o feed Atom do The Conversation Brasil; IBGE, CVM, Tesouro Nacional, governo federal, Valor Investe e InfoMoney continuam desabilitados e sem feeds.
- A verificação dos feeds ocorreu em 2026-11-23, sem requisitar artigos. Termos do Banco Central: https://www.bcb.gov.br/acessoinformacao/politicaprivacidade. Termos do The Conversation Brasil: https://theconversation.com/br/republishing-guidelines.
- O The Conversation Brasil declara CC BY-ND (https://creativecommons.org/licenses/by-nd/4.0/); o excerpt é citação literal e não pode alimentar paráfrase, resumo ou tradução pela IA.
- A evidência passou a preservar autor e licença opcionais, e o coletor passou a identificar-se com User-Agent transparente e a usar `content` Atom apenas como fallback normalizado do excerpt.
