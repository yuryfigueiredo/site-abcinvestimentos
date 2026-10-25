# PROJECT BLUEPRINT — ABC Investimentos (`abcinvestimentos.com.br`)

## 1. Visão Geral & Posicionamento Institucional
O **ABC Investimentos** é uma plataforma brasileira de inteligência financeira, simuladores patrimoniais e educação prática construída sob o conceito **"Enxuto, Limpo, Institucional e 100% Funcional"**.
Toda a direção de arte segue o padrão das melhores fintechs globais e nacionais (*Mais Retorno*, *Linear*, *Stripe*), combinando:
- **Modo Escuro Padrão (Midnight Navy Iluminado)**: Fundo `#0a0f1d` com iluminação radial atmosférica central (`rgba(32, 68, 134, 0.58)` + `rgba(56, 189, 248, 0.22)`) que destaca o Hero, a barra de IA e os 4 simuladores principais.
- **Modo Claro Otimizado (Clean Slate Editorial)**: Superfícies `#ffffff` sobre canvas `#f8fafc`, tipografia `#0f172a` de alto contraste e bordas `#cbd5e1` governadas automaticamente via CSS `light-dark()` e `color-scheme`.
- **Painel Mecânico Split-Flap (Solari Board)**: Barra superior (`Ticker.astro`) com módulos mecânicos individuais 3D que giram sem pressa exibindo Selic, CDI, IPCA (12m) e Dólar sincronizados com a API SGS do Banco Central.

---

## 2. Arquitetura de Monetização: O Conceito **LuxuryAd**

### 2.1. Filosofia Central ("Utilidade Primeiro, Publicidade de Private Banking")
Sites financeiros amadores destroem a confiança do usuário (e derrubam o tempo de permanência no Google) ao espalhar banners piscantes no topo da tela ou no meio das calculadoras.
No **ABC Investimentos**, aplicamos o conceito **LuxuryAd**:
1. **Zero Poluição na Primeira Dobra (Zona Sagrada de Credibilidade)**: É estritamente proibido exibir anúncios no Ticker mecânico, no Header, no Hero da IA ou entre os controles deslizantes (sliders) e os KPIs de resultado das calculadoras.
2. **Inserção Exclusiva Pós-Valor (Zona de Transição Editorial)**: O anúncio ou recomendação só aparece **depois** que o usuário já recebeu o cálculo financeiro ou concluiu a leitura de um bloco de alto valor.
3. **Moldura Editorial Integrada (`.luxury-ad-frame`)**: Nenhum bloco do Google AdSense fica "solto" na página. Todo anúncio é envelopado pelo componente [`src/components/AdSlot.astro`](file:///c:/Users/Yury/Documents/Projetos%20Yury/Site%20abcinvestimentos.com.br/src/components/AdSlot.astro) com:
   - Superfície em vidro escuro/claro adaptativo (`background: var(--bg-surface)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`).
   - Cabeçalho minimalista com micro-tipografia espaçada (`ESPAÇO PUBLICITÁRIO • PARCEIRO INSTITUCIONAL` em `0.65rem`, `letter-spacing: 0.08em`).
   - Gatilho comercial embutido (`"Anuncie no ABC ↗"`), transformando cada espaço do AdSense em uma vitrine para vender patrocínios diretos (Mídia Kit) para corretoras, FIIs, assessores e fintechs por valores muito superiores ao CPM comum.
   - Reserva estrita de altura (`min-block-size: 124px` + `contain: layout style paint`) garantindo **Zero CLS (Cumulative Layout Shift)** no Core Web Vitals.

---

### 2.2. Mapa de Posicionamento LuxuryAd por Página

| Página / Rota | Onde É Proibido (Zona Limpa) | Posição Exata do LuxuryAd (`AdSlot.astro`) | Posição da Recomendação Nativa (`NextStepCard.astro`) |
| :--- | :--- | :--- | :--- |
| **Home (`/`)** | Ticker, Header, Hero IA, 4 Cards Principais | `home-mid-editorial`: Na transição silenciosa entre o *Catálogo das 6 Calculadoras* e a *Vitrine da Planilha ABC* | Vitrine Executiva da Planilha ABC + Biblioteca Amazon (6 livros) antes do rodapé |
| **6 Calculadoras (`/calculadoras/*`)** | Acima do simulador, dentro dos Sliders, entre Sliders e Gráfico/KPIs | `calc-[slug]-bottom`: Posicionado **após** o `NextStepCard` e **antes** da seção de *Perguntas Frequentes (FAQ)* | Imediatamente abaixo da Tabela Anual de Evolução Patrimonial (Planilha ABC R$ 29,90 + 1 Livro contextual da Amazon) |
| **Guias & Glossário (`/guia` e `/guia/[slug]`)** | Cabeçalho do artigo e primeiro parágrafo | `guia-[slug]-bottom`: No fechamento do guia técnico, após o card de atalho para a calculadora prática | Card contextual convidando o leitor a testar os números na calculadora correspondente |
| **Página da Planilha (`/planilha-abc`)** | **100% Livre de AdSense** (Página de conversão pura do Produto Próprio) | Nenhum anúncio externo (para não desviar cliques do checkout de R$ 29,90) | Card da Lista VIP do Produto PRO #2 (Rastreador de Dividendos, FIIs & DARF IR) |

---

### 2.3. Ecossistema de Receita em 4 Pilares (Configuração Central em `src/config/site.ts`)
1. **Pilar 1 — Produto Próprio #1 (Conversão Imediata)**:
   - **Planilha Oficial ABC — Controle Financeiro 50/30/20 & Rumo ao 1º Milhão (`R$ 29,90`)**.
   - Arquivo `.xlsx` real de 8 abas (sem macros VBA, compatível com Excel e Google Sheets) gerado automaticamente por `scripts/generate-planilha-abc.mjs` + versão demonstrativa gratuita para download imediato.
2. **Pilar 2 — Produto Próprio #2 (Escala de Ticket Médio)**:
   - **Planilha PRO #2 — Rastreador de Dividendos, FIIs & Apuração de DARF IR (`R$ 47,00`)**, integrada à captação de lista VIP.
3. **Pilar 3 — Curadoria Afiliados Amazon Associados (`rel="sponsored"`)**:
   - 6 clássicos de finanças (*A Psicologia Financeira*, *O Investidor Inteligente*, *O Rei dos Dividendos*, *Pai Rico Pai Pobre*, *O Homem Mais Rico da Babilônia*, *Investindo em Ações no Longo Prazo*) vinculados contextualmente a cada calculadora.
4. **Pilar 4 — Google AdSense LuxuryAd + Patrocínios Diretos (Mídia Kit)**:
   - Ativação com 1 chave em `src/config/site.ts` (`adsense.enabled: true` e `adsense.clientId: 'ca-pub-...'`) + Modal nativo `<dialog id="parcerias-dialog">` para recebimento de propostas de patrocínio direto.
