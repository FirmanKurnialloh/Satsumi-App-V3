/**
 * ==========================================
 * SATSUMI APP V3: SYSTEM MODEL (CONFIG & SECURITY)
 * ==========================================
 * File ini menangani interaksi langsung dengan Sheet "Settings",
 * caching konfigurasi, enkripsi, dan manajemen folder database.
 */

const CONFIG = {
  get: function(key) {
    if (!this.cache) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
      const data = sheet.getDataRange().getValues();
      this.cache = {};
      for (let i = 1; i < data.length; i++) {
        this.cache[data[i][0]] = data[i][1];
      }
    }
    return this.cache[key];
  }
};

function getAppConfig() {
  return {
    appName: CONFIG.get("APP_NAME"),
    version: CONFIG.get("VERSION")
  };
}

/**
 * BRIDGE UNTUK SCANNER
 * Mengambil data database lewat mesin CONFIG
 */
function getPresensiScannerSettings() {
  return {
    info: CONFIG.get("INFO_TICKER") || "Selamat Datang di SIPGTK",
    nama: CONFIG.get("NAMA_SEKOLAH") || "SMPN 1 SUKARESMI",
    versi: CONFIG.get("VERSION") || "v.1.0.0"
  };
}

/**
 * INIT FOLDER DATABASE UTAMA
 */
function initializeFolders() {
  const appName = CONFIG.get("APP_NAME") || "Satsumi_App";
  const mainFolderName = appName + "_DATABASE";
  
  let mainFolder;
  const folders = DriveApp.getFoldersByName(mainFolderName);
  
  if (folders.hasNext()) {
    mainFolder = folders.next();
  } else {
    mainFolder = DriveApp.createFolder(mainFolderName);
  }
  
  const folderId = mainFolder.getId();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  const data = sheet.getDataRange().getValues();
  
  let found = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "FOLDER_UTAMA") {
      sheet.getRange(i + 1, 2).setValue(folderId);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow(["FOLDER_UTAMA", folderId, "ID Folder Database Utama"]);
  }
  return "Folder Berhasil Disiapkan!";
}

/**
 * ==========================================
 * SATSUMI SYSTEM: SECURITY CONFIG & ENCRYPTION
 * ==========================================
 */

// Secrets are now read from PropertiesService. Set via Project Properties.
function getSecretKey_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('SECRET_KEY') || "Satsumi_Sipgtk_2026_Key";
  } catch (e) { return "Satsumi_Sipgtk_2026_Key"; }
}

function getSecretSalt_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('SECRET_SALT') || "Salt_Sipgtk_Secure_2026";
  } catch (e) { return "Salt_Sipgtk_Secure_2026"; }
}

/**
 * ENKRIPSI NIK (Server Side)
 * Hanya hash satu arah, tidak bisa didekripsi, hanya bisa divalidasi
 */
function encryptNIK(nik) {
  var salt = 'ParuhBurung';
  var signature = Utilities.computeHmacSha256Signature(nik, salt);
  return Utilities.base64Encode(signature);
}

/**
 * VALIDASI NIK (Server Side)
 * Bandingkan hash hasil encryptNIK(nik) dengan hash yang diterima
 */
function validateNIK(nik, hash) {
  return encryptNIK(nik) === hash;
}

/**
 * FUNGSI HASH PASSWORD (Digunakan saat Login & Ganti Sandi)
 */
function hashPassword_(password) {
  try {
    // Use CryptoJS with server-side salt (pepper) if available
    const salt = (typeof getSecretSalt_ === 'function') ? getSecretSalt_() : '';
    
    // Karena Apps Script tidak mendukung CryptoJS secara native di server,
    // kita gunakan ComputeDigest algoritma SHA_256 bawaan Google.
    // Ini mengamankan logika bawaan V2 Anda ke standar GAS murni.
    const rawSignature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
    
    // Convert byte array to hex string
    let hexString = '';
    for (let i = 0; i < rawSignature.length; i++) {
      let byte = rawSignature[i];
      if (byte < 0) byte += 256;
      let hex = byte.toString(16);
      if (hex.length === 1) hex = '0' + hex;
      hexString += hex;
    }
    return hexString;
  } catch (e) {
    return password; // Fallback darurat
  }
}

/**
 * GENERATE RANDOM PASSWORD
 */
function generateRandomPassword(length) {
  length = length || 8;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}