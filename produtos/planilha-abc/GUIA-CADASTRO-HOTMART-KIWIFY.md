# Guia Oficial de Cadastro & Vendas — Planilha ABC (Kiwify / Hotmart / Eduzz)

Este guia contém tudo pronto (Textos de Venda, Preço Sugerido, Passo a Passo de Cadastro na Kiwify/Hotmart e Conexão com o Site `abcinvestimentos.com.br`) para você colocar seu primeiro produto digital no ar em menos de 15 minutos.

---

## 1. Arquivos do Produto (Na pasta `produtos/planilha-abc/`)

Você tem **2 arquivos `.xlsx` prontos e auditados**:

1. **`Planilha-ABC-Controle-Financeiro-e-1-Milhao.xlsx`**
   - **Para que serve:** É o arquivo **limpo (template oficial)** que o cliente recebe após o pagamento na Kiwify ou Hotmart.
2. **`Planilha-ABC-Exemplo-Preenchido.xlsx`**
   - **Para que serve:** É o arquivo **bônus demonstrativo**, já preenchido com dados realistas de uma família brasileira, para o cliente ver como os gráficos e indicadores se comportam antes de preencher os próprios dados (e também disponível como amostra demonstrativa no site).

> **Diferencial técnico importante:** As duas planilhas foram construídas **100% sem macros (VBA)**. Isso garante que o comprador nunca receba avisos de "Arquivo Perigoso / Macro Bloqueada" no Windows/Mac e possa usar tanto no **Microsoft Excel** quanto gratuitamente no **Google Planilhas (Google Sheets)** e **LibreOffice Calc**.

---

## 2. Estratégia de Preço Recomendada

- **Preço de Ancoragem (De):** `R$ 67,00`
- **Preço de Lançamento (Por):** `R$ 29,90` (pagamento único)
- **Por que R$ 29,90 converte muito bem no Brasil?**
  - Está abaixo da barreira psicológica de R$ 30,00 (compra por impulso via PIX imediato após o usuário usar a Calculadora de Juros Compostos ou Reserva de Emergência).
  - Permite oferecer **Order Bump** futuro (quando lançarmos a *Planilha #2: Rastreador de Dividendos, FIIs & DARF IR* por +R$ 19,90 no checkout).

---

## 3. Passo a Passo para Cadastrar na Kiwify ou Hotmart (10 Minutos)

1. Crie sua conta gratuita na **Kiwify** (`kiwify.com.br`) ou **Hotmart** (`hotmart.com`).
2. Clique em **Produtos → Criar Produto**:
   - **Tipo:** Pagamento Único • Entrega de Arquivos Digitais / Área de Membros.
   - **Nome do Produto:** `Planilha ABC — Controle Financeiro 50/30/20 & Rumo ao 1º Milhão`
   - **Descrição Curta (copie e cole):**
     > Organize seu orçamento pelo método 50/30/20, calcule sua Reserva de Emergência ideal e projete sua evolução rumo ao 1º Milhão em uma única planilha profissional para Excel e Google Sheets (8 abas automatizadas, zero macros e acesso vitalício).
   - **Preço:** `R$ 29,90` (ative PIX e Cartão em até 4x).
   - **Garantia:** `7 dias` (padrão legal brasileiro que aumenta a confiança do comprador).
3. Na aba **Conteúdo / Entrega do Produto**, crie 2 módulos simples:
   - **Módulo 1 — Sua Planilha Oficial (Template Limpo):** Anexe o arquivo `Planilha-ABC-Controle-Financeiro-e-1-Milhao.xlsx`.
   - **Módulo 2 — Bônus: Planilha Exemplo Preenchida:** Anexe o arquivo `Planilha-ABC-Exemplo-Preenchido.xlsx`.
4. Copie o **Link de Checkout** gerado pela plataforma (ex.: `https://pay.kiwify.com.br/SEU_CODIGO`).
5. Abra o arquivo `src/config/site.ts` do projeto e cole o seu link no campo `checkoutUrl`:
   ```ts
   mainProduct: {
     // ...
     checkoutUrl: 'https://pay.kiwify.com.br/SEU_CODIGO',
   }
   ```
   Pronto! Todos os botões de recomendação contextual dentro das calculadoras e da página `/planilha-abc` passarão a enviar o cliente direto para o seu checkout.

---

## 4. Resumo das 8 Abas da Planilha (Para seu Atendimento ao Cliente)

| Aba | Nome | O que faz |
| :--- | :--- | :--- |
| **01** | `Comece Aqui` | Boas-vindas, código de cores (células editáveis vs. automáticas) e passo a passo em 3 minutos. |
| **02** | `Configuração` | Renda líquida mensal alvo, metas percentuais 50/30/20 (editáveis), taxas Selic/CDI/IPCA e listas de categorias. |
| **03** | `Lançamentos` | Tabela de registro diário/semanal com validação de dados (menus suspensos) e cálculo automático de Mês e Subgrupo. |
| **04** | `Painel do Mês` | Dashboard executivo 50/30/20 (Orçado vs. Realizado via `SUMIFS`), saldo livre e resumo por categoria. |
| **05** | `Ano (12 Meses)` | Matriz consolidada de Janeiro a Dezembro + Total Anual + Média Mensal + Taxa de Poupança/Aporte (%). |
| **06** | `Reserva de Emergência` | Cálculo da meta ideal (3, 6 ou 12 meses do custo essencial), % concluído e previsão de conclusão. |
| **07** | `Metas Financeiras` | Planejador de até 10 metas de curto/médio prazo com cálculo do aporte mensal necessário e barra de progresso. |
| **08** | `Rumo ao 1º Milhão` | Simulador de evolução patrimonial de 30 anos (Patrimônio Nominal vs. Patrimônio Real descontando IPCA e Renda Passiva). |
