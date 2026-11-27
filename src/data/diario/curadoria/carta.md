# Diário do Investidor — Carta da Curadoria

Versão da carta: 1.0.4

## Nome e propósito

O **Diário do Investidor** é uma publicação educacional de macroeconomia e finanças tradicionais. O hub vivo oferece um ponto canonical de leitura; o arquivo datado só recebe edições com substância nova.

## Escopo tradicional

O escopo é renda fixa, juros, inflação, câmbio, bolsa e fundos imobiliários, regulação, pagamentos e crédito, trabalho e renda e consumo. Cripto fica fora. O conteúdo é educacional, nunca recomendação de compra ou venda, e toda edição carrega o aviso fixo de que conteúdo educacional não é recomendação.

## Política de fontes

A curadoria usa fontes oficiais do Banco Central, IBGE, CVM, Tesouro Nacional, Câmara dos Deputados e governo federal, além de uma pequena allowlist de mídia confiável. Somente feeds explicitamente habilitados e verificados entram na coleta. Toda requisição usa HTTPS, host exato e redirect manual; cada destino é revalidado antes de ser requisitado. O coletor se identifica com User-Agent transparente. Paywall, cópia do corpo da matéria e fonte sem lastro não são aceitos.

A ativação verificada cobre exclusivamente os cinco feeds do Banco Central, incluindo o feed anual de normativos, o feed econômico RSS da Câmara dos Deputados e o feed Atom do The Conversation Brasil. O excerpt usa `description` ou `summary`; na ausência deles, pode usar `content` do Atom, normalizado como texto e limitado a seiscentos caracteres. O artigo nunca é requisitado. A evidência preserva autor quando o feed oferece Atom `author/name` ou RSS `dc:creator`, além do publisher e da licença HTTPS declarada na allowlist. A Câmara declara suas informações em domínio público e exige citação da fonte e da autoria quando houver.

O The Conversation Brasil usa CC BY-ND. Seu excerpt é evidência de citação literal, nunca insumo para paráfrase, resumo ou tradução pela IA. Até existir superfície de citação literal aprovada, essa fonte pode ser coletada, mas não pode ser a única base de notícia editorial autoral. Qualquer superfície pública futura deve apresentar juntos manchete, trecho literal, autor, publisher, link do artigo e link da licença.

Notícia de veículo oficial precisa de fonte oficial suficiente. Notícia de mídia exige pelo menos dois veículos independentes. A seleção registra a evidência; a redação não busca o corpo da matéria nem inventa pauta.

## Critério material ou morno

Uma edição é **material** quando há evento do calendário, gatilho de variação do dólar, notícia oficial com evidência suficiente ou notícia de mídia corroborada. O delta substantivo e a ausência de repetição são revalidados no portão final.

Sem novidade comprovada, a edição é **morna**. Ela pode ser consumida no hub e pelo endpoint, mas não cria URL datada nem entrada no sitemap. Esse cuidado evita conteúdo fino e duplicado apenas para cumprir calendário.

## Números e prosa

Todos os números editoriais publicados vêm exclusivamente do snapshot BCB da edição e são renderizados em blocos numéricos separados. A prosa editorial não contém algarismos. O snapshot guarda Selic, CDI, IPCA acumulado e dólar; a poupança permanece nas superfícies existentes, fora deste snapshot.

## Cadência e automação

A automação roda diariamente às **19:00** no fuso **America/Sao_Paulo**, com lock exclusivo e verificação do cofre antes da coleta. A data da edição segue o fuso de São Paulo. A janela de notícias é de trinta horas de segunda a sexta e de setenta e duas horas no fim de semana; a idade é medida pela referência editorial, mas nenhum item publicado depois da coleta real pode entrar. A lição semanal pode sair às segundas, no máximo uma por semana ISO, e somente quando não há notícia, evento ou gatilho.

A automação lê o cofre, mas nunca o altera. O rebuild diário de garantia mantém o hub vivo mesmo sem observação nova do BCB; indisponibilidade não é apresentada como dado de hoje.

## Rationale YMYL e Google

Finanças é área YMYL: rigor, proveniência e ausência de recomendação imprudente são indispensáveis. A política também trabalha com o Google: uma URL canônica viva, arquivo somente quando há substância, fontes rastreáveis e números com origem evitam páginas finas, duplicadas ou sem lastro. O objetivo é ritual de leitura com confiança, não volume de URLs.

## Regra de mudança do cofre

O cofre só muda por ordem explícita do dono. O procedimento é, nesta ordem:

1. Receber a ordem explícita do dono.
2. Editar os arquivos do cofre.
3. Fazer append no changelog.
4. Recomputar o hash dos seis arquivos de conteúdo.
5. Atualizar `approval.json` com o `instructionRef` do plano commitado.
6. Rodar os testes.

O hash cobre `carta.md`, `allowlist.json`, `thresholds.json`, `calendario.json`, `licoes.json` e `changelog.md`, nessa ordem. `approval.json` é validado separadamente e nunca entra no próprio hash.

## Newsletter fora do escopo

Captura de e-mail, opt-in LGPD, provedor de envio e disparo são um projeto separado. Esta carta não autoriza newsletter; a edição validada apenas permanece um payload consumível no futuro.
