/**
 * ABC Investimentos — receptor de leads no Google Sheets
 *
 * COMO USAR (resumo; o passo a passo completo está em GOOGLE-SHEETS-LEADS.md):
 *   1. Crie uma planilha nova no Google Sheets.
 *   2. Menu Extensões > Apps Script.
 *   3. Apague o conteúdo padrão e cole este arquivo inteiro.
 *   4. Implantar > Nova implantação > App da Web.
 *        - Executar como: Eu (seu e-mail)
 *        - Quem pode acessar: Qualquer pessoa
 *   5. Copie a URL que termina em /exec e cole na variável de ambiente
 *      GOOGLE_LEADS_WEBAPP_URL no Vercel.
 *
 * O site faz POST aqui com { name, contact, question }. Cada lead vira uma
 * linha na aba "Leads". Nada do site quebra se esta planilha estiver offline:
 * o lead continua sendo gravado no banco Turso.
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['Data', 'Nome', 'WhatsApp/E-mail', 'Pergunta'];

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange('1:1').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 220);
    sheet.setColumnWidth(4, 460);
  }
  return sheet;
}

function readPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents) || {};
  } catch (err) {
    // Apps Script às vezes entrega formulário simples em vez de JSON cru.
    return (e.postData && e.postData.contents) ? e.parameter || {} : {};
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    lock.waitLock(10000);
    acquired = true;

    const data = readPayload_(e);
    const name = String(data.name || '').trim().slice(0, 150);
    const contact = String(data.contact || '').trim().slice(0, 150);
    const question = String(data.question || '').trim().slice(0, 500);

    if (!name || !contact) {
      return json_({ ok: false, error: 'name and contact are required' });
    }

    getSheet_().appendRow([new Date(), name, contact, question]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (acquired) {
      try {
        lock.releaseLock();
      } catch (ignored) {}
    }
  }
}

// Teste rápido no navegador: abre a URL /exec e deve responder {"ok":true,...}.
function doGet() {
  return json_({ ok: true, service: 'abc-leads', sheet: SHEET_NAME });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
