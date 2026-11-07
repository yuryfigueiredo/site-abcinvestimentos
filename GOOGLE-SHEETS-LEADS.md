# Leads no Google Sheets — guia de configuração

Objetivo: cada lead capturado pelo site (Nome + WhatsApp/e-mail + pergunta) passa a
aparecer como uma linha numa planilha Google que você abre e lê direto. O banco Turso
continua gravando normalmente — o Sheets é um **espelho**, não uma substituição. Se a
planilha estiver fora do ar, o lead não se perde.

Tempo total: ~10 minutos. Só as etapas A, B e C dependem de você (navegador logado na
sua conta Google).

---

## A. Criar a planilha

1. Acesse https://sheets.new e crie uma planilha em branco.
2. Dê um nome, por exemplo: **`ABC — Leads do Site`**.
3. Não precisa criar aba nem cabeçalho — o script cria a aba `Leads` sozinho no primeiro
   lead. (Opcional: você pode já criar uma aba vazia chamada `Leads`.)

> Importante: deixe a planilha **fechada para compartilhamento público**. Ela só recebe
> dados através do script, e o script roda como você. Não precisa "publicar na web".

---

## B. Colar o Apps Script

1. Na planilha, menu **Extensões → Apps Script**. (Se pedir, autorize com sua conta.)
2. No editor, apague todo o conteúdo padrão do arquivo `Código.gs`.
3. Cole **inteiro** o conteúdo de [`scripts/GoogleLeadsAppsScript.gs`](scripts/GoogleLeadsAppsScript.gs).
4. Clique em **Salvar** (ícone de disquete ou `Ctrl+S`).

O que o script faz:
- Cria a aba `Leads` com o cabeçalho `Data | Nome | WhatsApp/E-mail | Pergunta`.
- A cada POST, grava uma linha nova com a data/hora do servidor Google.
- Usa trava (`LockService`) para não perder linha se chegarem dois leads ao mesmo tempo.

---

## C. Publicar como App da Web

1. No editor do Apps Script, clique em **Implantar → Nova implantação**.
2. Em "Escolha o tipo", selecione **App da Web**.
3. Configure assim:
   - **Descrição**: `ABC Leads receptor` (ou o que quiser)
   - **Executar como**: `Eu (seu e-mail)`
   - **Quem pode acessar**: `Qualquer pessoa`
4. Clique em **Implantar**.
5. O Google vai pedir autorização ("O app precisa de acesso"). Confirme com sua conta e
   aceite. Se aparecer a tela "Acesso bloqueado", clique em **Mostrar configurações
   avançadas → Acessar (irracional)** e depois **Permitir** — é o fluxo normal para
   scripts da sua própria conta.
6. Copie a **URL do app da web** — termina em `/exec`. Exemplo:
   `https://script.google.com/macros/s/AKfycb.../exec`

Cole essa URL aqui no chat (não é uma senha; é só o endereço do receptor).

---

## D. Ligar o site ao Sheets (eu faço esta parte)

Com a URL em mãos, eu:
1. Adiciono a variável de ambiente `GOOGLE_LEADS_WEBAPP_URL` no projeto do Vercel
   (ou você adiciona em Settings → Environment Variables, se preferir).
2. Faço o deploy.
3. Testamos juntos: você envia um lead pelo site e conferimos a linha aparecer na planilha.

Enquanto a variável não estiver definida, o site **só grava no Turso** (comportamento de
hoje) — nada quebra.

---

## E. Como testar sem mexer no site (opcional)

Depois da etapa C, abra a URL `/exec` no navegador. Deve aparecer:

```json
{"ok":true,"service":"abc-leads","sheet":"Leads"}
```

Se aparecer isso, o receptor está vivo. A linha `Leads` só é criada quando chega o
primeiro POST real (que vem do site).

---

## Solução de problemas

- **Linha não aparece no Sheets, mas o lead existe no Turso**
  → Confira se a URL termina em `/exec` (não `/dev`). Confira se "Quem pode acessar" está
  como `Qualquer pessoa`. Reimplante (Implantar → Gerenciar implantações → Editar → Nova
  versão) depois de qualquer mudança no script.

- **`Acesso bloqueado` ao implantar**
  → É o aviso padrão para scripts pessoais. Siga "Mostrar configurações avançadas" e
  permita o acesso.

- **Latência alta (3–8s no primeiro envio)**
  → Normal: o Apps Script "esquenta" no primeiro acesso. Como o envio do lead é
  assíncrono no site, o usuário não espera por isso.

- **Privacidade / LGPD**
  → A Política de Privacidade do site passou a declarar que Nome e contato do
  formulário de lead são armazenados em banco e espelhados em planilha Google, com
  contato para exclusão. Veja a seção correspondente em `/privacidade`.

---

## O que NÃO muda

- Formulário de lead, campos, validação e o limite de 3 consultas/dia ficam iguais.
- O fluxo do modal continua fechando na hora e liberando a resposta da IA.
- O banco Turso continua sendo a fonte de verdade (histórico completo).
