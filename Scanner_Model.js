/**
 * MODEL: Urusan Data Spreadsheet
 */
function model_getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  const data = sheet.getDataRange().getDisplayValues();
  let cfg = {};
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];
    const val = data[i][1];
    if (key && val) cfg[key] = val;
  }
  return cfg;
}

function model_getUserByHash(qrHash) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName("DUK");
  const userData = userSheet.getDataRange().getDisplayValues(); 
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][0]).trim() === qrHash) {
      return { nik: userData[i][1], nama: userData[i][2], jabatan: userData[i][3] || "Staff" };
    }
  }
  return null;
}

function model_saveLog(rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PRESENSI") || ss.insertSheet("PRESENSI");
  sheet.appendRow(rowData);
}

function model_getRawData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PRESENSI");
  return sheet ? sheet.getDataRange().getDisplayValues() : [];
}