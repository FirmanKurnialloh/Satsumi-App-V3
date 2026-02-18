/**
 * ==========================================
 * SATSUMI APP V3: MAIN CONTROLLER (ROUTER)
 * ==========================================
 * Modul ini berfungsi sebagai pintu masuk (entry point) aplikasi.
 * Semua parameter URL ditangkap dan diarahkan ke View yang tepat.
 */

function doGet(e) {
  const page = e.parameter.page;
  const view = e.parameter.v;
  const scriptUrl = ScriptApp.getService().getUrl(); // Ambil URL Aktif (Penting!)

  // 1. ROUTING: HALAMAN SCANNER (KIOSK MODE - PUBLIC, NO LOGIN REQUIRED)
  // Serve scanner as standalone full-page document to avoid redirect loops
  if (page === 'scanner') {
    let scannerPage = HtmlService.createTemplateFromFile('Scanner_View_Index');
    scannerPage.scriptUrl = scriptUrl;
    return scannerPage.evaluate()
      .setTitle('Satsumi App Scanner')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 2. ROUTING: HALAMAN VERIFIKASI (Publik - ?page=verify)
  if (page === 'verify') {
    let tmp = HtmlService.createTemplateFromFile('Verify_View_Index');
    tmp.nik = e.parameter.nik || "";
    tmp.period = e.parameter.period || "";
    return tmp.evaluate()
      .setTitle('Satsumi App - Verifikasi')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }

  // 3. ROUTING: HALAMAN LOGIN (Default jika tidak ada parameter, atau ?page=login)
  if (page === 'login' || (!page && !view)) {
    let shell = HtmlService.createTemplateFromFile('Login_View_Index');
    shell.scriptUrl = scriptUrl; 
    shell.params = JSON.stringify(e.parameter || {}); // Kirim parameter v ke JS
    
    return shell.evaluate()
      .setTitle('Satsumi App')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 4. ROUTING: HALAMAN UTAMA / SHELL (Untuk v=admin, v=guru, atau default)
  let shell = HtmlService.createTemplateFromFile('Login_View_Index');
  shell.scriptUrl = scriptUrl; 
  shell.params = JSON.stringify(e.parameter || {}); // Kirim parameter v ke JS
  
  return shell.evaluate()
    .setTitle('Satsumi App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ==========================================
 * HELPER UNTUK MVC VIEW
 * ==========================================
 * Fungsi ini WAJIB ada untuk memasukkan file HTML/CSS/JS 
 * lain ke dalam View Index.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}