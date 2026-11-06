# Guia Google Search Console — ABC Investimentos

## Status Atual

✅ **Pronto para submissão:**
- robots.txt configurado
- sitemap com 68 URLs (49 novas páginas "quanto-rende")
- Site no ar em https://www.abcinvestimentos.com.br

## Passo a Passo

### 1. Acessar o Google Search Console

1. Abra: https://search.google.com/search-console
2. Faça login com sua conta Google
3. Clique em **"Adicionar propriedade"**

### 2. Escolher Método de Verificação

Recomendado: **"Prefixo do URL"**
- URL: `https://www.abcinvestimentos.com.br`
- Clique em **"Continuar"**

### 3. Verificar Propriedade (Meta Tag)

1. Selecione a aba **"Meta tag HTML"**
2. Copie o código fornecido pelo Google (será algo como):
   ```html
   <meta name="google-site-verification" content="XXXXX" />
   ```
3. **Me envie esse código** — eu adiciono ao site e faço o deploy
4. Clique em **"Verificar"** no Search Console

### 4. Submeter o Sitemap

Depois de verificado:

1. No menu lateral, clique em **"Sitemaps"**
2. Em **"Adicionar novo sitemap"**, digite:
   ```
   sitemap-index.xml
   ```
3. Clique em **"Enviar"**
4. O Google vai processar e indexar as 68 páginas

### 5. Solicitar Indexação (Opcional mas Recomendado)

Para acelerar as páginas novas:

1. Vá em **"Inspenção de URL"** (barra superior)
2. Cole: `https://www.abcinvestimentos.com.br/quanto-rende`
3. Clique em **"Solicitar indexação"**
4. Repita para as páginas mais importantes:
   - `/quanto-rende/poupanca/1000-reais`
   - `/quanto-rende/cdb-100-cdi/10000-reais`
   - `/quanto-rende/tesouro-selic/5000-reais`
   - `/calculadoras/renda-fixa`
   - `/calculadoras/juros-compostos`

**Limite:** Google permite ~10 solicitações/dia para sites novos.

## Monitoramento

Depois de submetido:

- **Cobertura:** mostra quantas páginas foram indexadas
- **Desempenho:** exibe consultas de busca, cliques e impressões
- **Sitemaps:** status do sitemap enviado

**Tempo esperado para indexação:** 1-14 dias para as primeiras páginas aparecerem nos resultados.

## Próximos Passos Após Indexação

1. **Registrar no Bing Webmaster Tools** (mesmo processo):
   - https://www.bing.com/webmasters
   - Sitemap: `https://www.abcinvestimentos.com.br/sitemap-index.xml`

2. **Configurar Google Analytics 4** (se ainda não tem):
   - Adicionar tag no BaseLayout
   - Acompanhar tráfego das páginas novas

3. **Monitorar consultas de busca:**
   - Após 2-4 semanas, o Search Console mostra quais queries estão trazendo tráfego
   - Dobre o conteúdo nas queries que já estão performando

## URLs Prioritárias para Indexação Manual

As 10 páginas mais importantes para solicitar indexação primeiro:

1. https://www.abcinvestimentos.com.br/
2. https://www.abcinvestimentos.com.br/quanto-rende
3. https://www.abcinvestimentos.com.br/quanto-rende/poupanca/1000-reais
4. https://www.abcinvestimentos.com.br/quanto-rende/cdb-100-cdi/10000-reais
5. https://www.abcinvestimentos.com.br/quanto-rende/tesouro-selic/5000-reais
6. https://www.abcinvestimentos.com.br/calculadoras/renda-fixa
7. https://www.abcinvestimentos.com.br/calculadoras/juros-compostos
8. https://www.abcinvestimentos.com.br/guia
9. https://www.abcinvestimentos.com.br/guia/como-montar-reserva-de-emergencia
10. https://www.abcinvestimentos.com.br/planilha-abc

---

**Ação necessária:** Me envie o código de verificação do Google Search Console (passo 3) para eu adicionar ao site.
