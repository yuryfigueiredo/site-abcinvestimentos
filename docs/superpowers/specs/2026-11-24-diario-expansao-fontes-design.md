# Expansão mínima das fontes do Diário do Investidor — Design

Data: 2026-11-24

## Intenção

Ampliar a coleta oficial para produzir briefings com notícia econômica real, sem aumentar ruído editorial, copiar corpos de matérias ou contornar licenças. A ordem do dono foi “ok, pode expandir”; o recorte exato abaixo é a decisão técnica desta sessão.

## Escopo exato

Ativar somente:

- Banco Central do Brasil: `https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notastecnicas`, com os seis tópicos editoriais.
- Câmara dos Deputados: `https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA`, com os seis tópicos editoriais e `termsUrl` `https://www2.camara.leg.br/termo-de-uso-e-politica-de-privacidade`.

Manter os três feeds atuais do Banco Central e o Atom da The Conversation Brasil. Não ativar Senado, feed de atos e comunicados do BCB, CVM, IBGE, Tesouro, governo federal ou qualquer mídia adicional nesta mudança.

## Evidência de 2026-11-24

Somente feeds foram requisitados; nenhum corpo de artigo foi baixado.

| Candidato | Resultado | Decisão |
| --- | --- | --- |
| BCB notas técnicas | Atom válido, dez itens, excerpts úteis, links HTTPS | Ativar |
| BCB atos e comunicados | Atom válido, mas a curadoria real escolheu avisos de baixo valor | Não ativar |
| Câmara Economia | RSS válido, dez itens recentes, links HTTPS, pauta econômica | Ativar |
| Senado geral | RSS válido, mas a curadoria real classificou cultura como bolsa e fundos imobiliários | Não ativar |
| CVM | Feeds válidos, links canônicos HTTP e licença CC BY-ND no portal | Não ativar |
| Agência Pública | Feed válido, mas CC BY-ND e política exigem reprodução integral ou autorização | Não ativar |

Na simulação com Câmara e Senado, a coleta produziu 79 candidatos e três clusters; o falso positivo do Senado confirmou que o feed geral não é seguro para curadoria automática. O recorte final será validado novamente pelo coletor real após a mudança governada.

## Abordagens consideradas

1. **Expansão oficial mínima — escolhida.** Dois feeds novos, ambos oficiais, com sindicância e termos verificados. Menor cobertura que uma ampla agregação, porém maior precisão e nenhuma dependência de permissão de mídia.
2. **Ampla expansão oficial.** Incluiria Senado, CVM e atos do BCB. Mais volume, mas exige filtro de relevância, política de links HTTP e tratamento de licenças; não cabe nesta mudança.
3. **Expansão com mídia independente.** Nenhum candidato adicional tem autorização clara para resumo automatizado sem reprodução integral ou contato prévio. Fica fora.

## Metas

- Aumentar a chance de selecionar notícia oficial econômica em dias sem movimento do dólar.
- Preservar o filtro conservador e a regra de fonte oficial suficiente.
- Registrar a nova procedência no cofre e nas edições futuras.

## Não metas

- Não adicionar fontes só para inflar candidatos.
- Não alterar parser, thresholds, forma do schema ou UI; apenas atualizar `APPROVED_INSTRUCTION_REF` para o plano desta mudança, como exige o approval.
- Não reescrever a edição publicada de 2026-11-23.
- Não publicar ou fazer push.

## Restrições

- Nenhum corpo de matéria, paywall ou conteúdo não autorizado.
- Nenhuma chamada externa nova em `astro build`.
- CC BY-ND continua bloqueado para paráfrase pela IA.
- O cofre muda somente pela ordem explícita já recebida, com changelog, hash e approval atualizados.
- Commit com caminhos explícitos; nenhum push sem ordem separada.

## Governança

- Carta: `1.0.2` → `1.0.3`.
- Allowlist: `1.1.0` → `1.2.0`.
- Changelog: nova entrada `1.0.3` em 2026-11-24.
- Hash: recomputar os seis arquivos na ordem canônica.
- Approval: atualizar hash, versão, data e `instructionRef` para o plano desta mudança.
- Testes de governança passam a fixar a lista exata de fontes e feeds habilitados.

## Critérios de aceite

- Os testes de governança falham antes da mudança e passam depois.
- Mutação de um feed ou da versão é detectada.
- Coleta real retorna candidatos da Câmara e do BCB, sem requisitar artigos.
- Typecheck, suíte serial, build e `diario:verify-build` passam.
- Revisão final de padrões e spec sem achados críticos ou importantes.
- Commit local criado; worktree limpo; nenhum push.
