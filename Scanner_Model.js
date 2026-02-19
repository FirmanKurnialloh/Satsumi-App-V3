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

/**
 * MODEL: Menyimpan Log Presensi dengan Format Murni Teks
 */
function model_saveLog(rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PRESENSI") || ss.insertSheet("PRESENSI");
  
  // 1. Cari baris kosong berikutnya
  const nextRow = sheet.getLastRow() + 1;
  const numColumns = rowData.length;
  
  // 2. Tentukan jangkauan (range) sel tempat data akan masuk
  const range = sheet.getRange(nextRow, 1, 1, numColumns);
  
  // 3. KUNCI UTAMA: Set format range tersebut menjadi Plain Text ("@") SEBELUM data masuk
  range.setNumberFormat("@");
  
  // 4. Masukkan data menggunakan setValues (harus dalam bentuk array 2D)
  // Semua data akan dipaksa mengikuti format teks yang sudah diset di atas
  range.setValues([rowData]);
}

function model_getRawData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PRESENSI");
  return sheet ? sheet.getDataRange().getDisplayValues() : [];
}