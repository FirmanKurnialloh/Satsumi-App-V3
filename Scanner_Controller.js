/**
 * CONTROLLER: Jembatan API & Logika Sesi
 */
function getPresensiScannerSettings() {
  const settings = model_getSettings();
  return {
    nama: settings["NAMA_SEKOLAH"] || "INSTANSI BELUM DISET",
    info: settings["INFO_TICKER"] || "Sistem Terkoneksi. Menunggu aktivitas...",
    versi: settings["VERSION"] || "Sistem Terkoneksi. Menunggu aktivitas..."
  };
}

function getCurrentSessionMode() {
  const s = model_getSettings();
  const now = new Date();
  const menit = now.getHours() * 60 + now.getMinutes();
  
  const inStart = timeToMinutes(s["Masuk Mulai"]), inEnd = timeToMinutes(s["Masuk Sampai"]);
  const outStart = timeToMinutes(s["Pulang Mulai"]), outEnd = timeToMinutes(s["Pulang Sampai"]);

  if (menit <= inEnd) return { mode: "SESI MASUK" };
  if (menit >= outStart && menit <= outEnd) return { mode: "SESI PULANG" };
  return { mode: "SESI LEMBUR" };
}

function getScannerData() {
  const data = model_getRawData();
  const today = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
  let logs = [], stats = { masuk: 0, izin: 0, sakit: 0, pulang: 0, lembur: 0 }, first = null;

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === today) {
      const entry = { nama: data[i][3], jabatan: data[i][4], waktu: data[i][1], mode: data[i][5], keterangan: data[i][6], foto: data[i][7] };
      logs.push(entry);
      let m = entry.mode.toLowerCase();
      if (stats.hasOwnProperty(m)) stats[m]++;
      first = entry;
    }
  }
  return { logs: logs.slice(0, 15), stats: stats, first: first };
}

function simpanPresensi(qrHash, photoData) {
  try {
    const user = model_getUserByHash(qrHash);
    if (!user) return { status: "error", message: "QR tidak terdaftar." };

    const now = new Date();
    const settings = model_getSettings();
    const tglStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    const jamStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
    
    // Logika Sesi & Keterangan
    const menit = now.getHours() * 60 + now.getMinutes();
    let mode = "Masuk", ket = "Tepat Waktu";
    const inEnd = timeToMinutes(settings["Masuk Sampai"]);
    const outStart = timeToMinutes(settings["Pulang Mulai"]);

    if (menit > inEnd && menit < outStart) { mode = "Masuk"; ket = "Terlambat"; }
    else if (menit >= outStart) { mode = "Pulang"; ket = "Normal"; }

    // Simpan Foto
    let photoUrl = "";
    if (photoData) photoUrl = savePhoto(photoData, user.nik);

    model_saveLog([tglStr, jamStr, user.nik, user.nama, user.jabatan, mode, ket, photoUrl]);

    return { status: "success", nama: user.nama, mode: mode, keterangan: ket, foto: photoUrl, is_early_bird: (mode === "Masuk" && getScannerData().logs.length <= 1) };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function timeToMinutes(t) { if(!t) return 0; const p = t.split(":"); return parseInt(p[0])*60 + parseInt(p[1]); }

function savePhoto(base64, nik) {
  try {
    const folder = DriveApp.getFoldersByName("Satsumi_Foto").hasNext() ? DriveApp.getFoldersByName("Satsumi_Foto").next() : DriveApp.createFolder("Satsumi_Foto");
    const blob = Utilities.newBlob(Utilities.base64Decode(base64.split(",")[1]), "image/jpeg", nik + "_" + Date.now() + ".jpg");
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/thumbnail?id=" + file.getId();
  } catch(e) { return ""; }
}