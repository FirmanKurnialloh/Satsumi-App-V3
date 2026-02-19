/**
 * ==========================================
 * SATSUMI APP V3: SCANNER CONTROLLER
 * ==========================================
 * File ini menangani logika bisnis Scanner, validasi duplikat, 
 * anti-spam waktu, penentuan sesi, dan pemrosesan gambar foto.
 */

function getCurrentSessionMode() {
  const now = new Date();
  const jam = Utilities.formatDate(now, "GMT+7", "HH:mm");
  const menit = timeToMinutes(jam);

  // Mengambil parameter waktu dari Sys_Model (CACHE)
  const masukMulai   = timeToMinutes(CONFIG.get("Masuk Mulai") || "06:00");
  const masukSampai  = timeToMinutes(CONFIG.get("Masuk Sampai") || "07:30");
  const pulangMulai  = timeToMinutes(CONFIG.get("Pulang Mulai") || "14:00");
  const pulangSampai = timeToMinutes(CONFIG.get("Pulang Sampai") || "16:00");

  let mode = "DI LUAR SESI";
  if (menit < masukMulai) mode = "HADIR CEPAT";
  else if (menit >= masukMulai && menit <= masukSampai) mode = "SESI MASUK";
  else if (menit > masukSampai && menit < pulangMulai) mode = "TERLAMBAT";
  else if (menit >= pulangMulai && menit <= pulangSampai) mode = "SESI PULANG";
  else if (menit > pulangSampai) mode = "SESI LEMBUR";

  return { mode };
}

function getScannerData() {
  const data = model_getRawData(); // Memanggil fungsi di Scanner_Model.js
  const today = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
  let logs = [], stats = { masuk: 0, izin: 0, sakit: 0, pulang: 0, lembur: 0 }, first = null;

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === today) {
      const entry = { nama: data[i][3], jabatan: data[i][4], waktu: data[i][1], mode: data[i][5], keterangan: data[i][6], foto: data[i][7] };
      logs.push(entry);
      
      let m = entry.mode.toLowerCase();
      if (stats.hasOwnProperty(m)) stats[m]++;
      
      first = entry; // Yang terakhir di loop (paling atas di sheet untuk hari ini) adalah orang pertama (first scan)
    }
  }
  return { logs: logs.slice(0, 15), stats: stats, first: first };
}

function simpanPresensi(qrHash, photoData) {
  try {
    const user = model_getUserByHash(qrHash);
    if (!user) return { status: "error", message: "QR tidak terdaftar." };

    const now = new Date();
    const tglStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    const jamStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
    
    // Tentukan User Masuk, Pulang, atau Lembur
    const session = getModeAndKeterangan(now);
    
    // 1. VALIDASI DUPLIKAT DAN ANTI-SPAM
    const dataPresensi = model_getRawData();
    const BATAS_SPAM_DETIK = 180; // Jeda minimal 3 menit
    let isEarlyBird = true; 

    for (let i = dataPresensi.length - 1; i >= 1; i--) {
      const rowTgl = String(dataPresensi[i][0]).trim();
      const rowJam = String(dataPresensi[i][1]).trim();
      const rowNik = String(dataPresensi[i][2]).trim();
      const rowMode = String(dataPresensi[i][5]).trim();
      
      // Deteksi Early Bird: Kalau sudah ada yang absen "Masuk", user ini bukan orang pertama
      if (rowTgl === tglStr && rowMode === "Masuk") {
        isEarlyBird = false;
      }

      // Lanjut ke validasi spesifik milik user yang sedang absen ini
      if (rowNik !== String(user.nik) || rowTgl !== tglStr) continue;

      // A. Cek Duplikat Sesi/Mode (Misal: Sudah absen "Masuk", tidak bisa absen "Masuk" lagi)
      if (rowMode === session.mode) {
        return { 
          status: "duplikat", 
          nama: user.nama, 
          mode: session.mode, 
          message: "Presensi " + session.mode + " Anda sudah tercatat hari ini." 
        };
      }

      // B. Cek Duplikat Jam Sama & Anti-Spam Beruntun
      try {
        const jamScanLama = rowJam.split(":"); // [HH, mm, ss]
        const jamScanBaru = jamStr.split(":"); // [HH, mm, ss]
        
        // Block jika scan di jam dan menit yang persis sama
        if (jamScanLama[0] === jamScanBaru[0] && jamScanLama[1] === jamScanBaru[1]) {
           return { status: "duplikat", nama: user.nama, message: "Terdeteksi scan ganda pada menit yang sama." };
        }

        // Block jika jarak antar scan kurang dari 3 menit
        const [d, m, y] = tglStr.split("/");
        const lastTime = new Date(`${y}-${m}-${d}T${rowJam}`);
        const diffDetik = (now.getTime() - lastTime.getTime()) / 1000;
        
        if (diffDetik < BATAS_SPAM_DETIK) {
          return { status: "duplikat", nama: user.nama, message: "Tunggu " + Math.ceil((BATAS_SPAM_DETIK - diffDetik)/60) + " menit lagi untuk scan selanjutnya." };
        }
      } catch(e) {
        console.warn("Gagal menghitung selisih waktu", e);
      }
      
      break; // Sudah mengecek aktivitas log terakhir dari user ini untuk hari ini, jadi bisa berhenti.
    }

    // 2. SIMPAN FOTO KE GOOGLE DRIVE
    let photoUrl = "";
    if (photoData) photoUrl = savePhoto(photoData, user.nik);

    // 3. SIMPAN KE SHEET LEWAT MODEL
    model_saveLog([tglStr, jamStr, user.nik, user.nama, user.jabatan, session.mode, session.ket, photoUrl]);

    // Kembalikan Response ke UI Scanner
    return { 
      status: "success", 
      nama: user.nama, 
      mode: session.mode, 
      keterangan: session.ket, 
      foto: photoUrl, 
      is_early_bird: (session.mode === "Masuk" && isEarlyBird) 
    };

  } catch (e) { 
    return { status: "error", message: e.toString() }; 
  }
}

// ===============================================
// FUNGSI HELPER (BANTUAN) INTERNAL CONTROLLER
// ===============================================

function getModeAndKeterangan(now) {
  const jamStr = Utilities.formatDate(now, "GMT+7", "HH:mm");
  const menitSekarang = timeToMinutes(jamStr);

  const masukMulai   = timeToMinutes(CONFIG.get("Masuk Mulai") || "06:00");
  const masukSampai  = timeToMinutes(CONFIG.get("Masuk Sampai") || "07:30");
  const pulangMulai  = timeToMinutes(CONFIG.get("Pulang Mulai") || "14:00");
  const pulangSampai = timeToMinutes(CONFIG.get("Pulang Sampai") || "16:00");

  if (menitSekarang < masukMulai) return { mode: "Masuk", ket: "Hadir Cepat" };
  if (menitSekarang >= masukMulai && menitSekarang <= masukSampai) return { mode: "Masuk", ket: "Tepat Waktu" };
  if (menitSekarang > masukSampai && menitSekarang < pulangMulai) {
    const telat = menitSekarang - masukSampai;
    return { mode: "Masuk", ket: "Terlambat " + formatMenit(telat) };
  }
  if (menitSekarang >= pulangMulai && menitSekarang <= pulangSampai) return { mode: "Pulang", ket: "Normal" };
  if (menitSekarang < pulangMulai) return { mode: "Pulang", ket: "Pulang Cepat" };
  if (menitSekarang > pulangSampai) {
    const lembur = menitSekarang - pulangSampai;
    return { mode: "Lembur", ket: "Lembur " + formatMenit(lembur) };
  }
  return { mode: "Masuk", ket: "Normal" };
}

function timeToMinutes(t) { 
  if(!t) return 0; 
  const p = t.split(":"); 
  return parseInt(p[0])*60 + parseInt(p[1]); 
}

function formatMenit(menit) {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0) return jam + " jam " + sisa + " mnt";
  return sisa + " mnt";
}

function savePhoto(base64, nik) {
  try {
    const folderName = "Satsumi_Foto_Presensi";
    const folder = DriveApp.getFoldersByName(folderName).hasNext() 
                   ? DriveApp.getFoldersByName(folderName).next() 
                   : DriveApp.createFolder(folderName);
                   
    // Mengurai Base64 dari Canvas Frontend
    const base64Data = base64.split(",")[1];
    if (!base64Data) return "Error: Format Base64 tidak valid";

    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/jpeg", nik + "_" + Date.now() + ".jpg");
    const file = folder.createFile(blob);
    
    // Set agar foto bisa dilihat secara publik via link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://drive.google.com/thumbnail?id=" + file.getId();
    
  } catch(e) { 
    // Jika gagal, tulis pesan error-nya ke Sheet agar kita tahu masalahnya!
    return "Error Save: " + e.toString(); 
  }
}