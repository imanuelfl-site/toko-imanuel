// ===== Code.gs — dibuat otomatis oleh tools/bangun-gs.js, jangan diedit langsung =====

// Skema database: satu tab Google Sheets per tabel, baris pertama = nama kolom.
// File ini dipakai oleh Apps Script (digabung ke Code.gs) dan oleh skrip konversi di Node.
var SKEMA = {
  pengguna: ["username", "nama", "password_baru", "salt", "hash", "aktif"],
  kategori: ["id", "nama", "jenis", "pos", "peran", "aktif", "urutan"],
  dompet: ["id", "nama", "pemilik", "tipe", "aktif", "urutan"],
  kelompok: ["id", "nama", "markup", "urutan"],
  supplier: ["id", "nama", "kelompok", "aktif", "urutan"],
  barang: ["id", "nama", "kelompok", "supplier", "satuan_jual", "satuan_beli", "isi", "modal", "harga_jual", "harga_diubah", "terakhir_beli", "aktif"],
  nota: ["id", "tanggal", "supplier", "dompet", "total", "transaksi", "sumber", "catatan", "oleh", "dibuat"],
  nota_item: ["id", "nota", "barang", "nama", "qty", "satuan", "isi", "harga", "total", "modal"],
  transaksi: ["id", "tanggal", "jenis", "kategori", "dompet", "dompet_tujuan", "nominal", "keterangan", "perjalanan", "tagihan", "nota", "sumber", "catatan", "oleh", "dibuat", "diubah", "hapus", "asal"],
  tagihan: ["id", "nama", "kategori", "dompet", "tgl", "nominal", "nomor", "aktif", "urutan", "catatan"],
  perjalanan: ["id", "nama", "mulai", "selesai", "catatan", "dibuat"],
  tutup_toko: ["tanggal", "tutup", "tunai", "transfer", "dompet_transfer", "jt_nominal", "jt_admin", "jt_jumlah", "jt_dompet", "catatan", "oleh", "diubah"],
  tutup_buku: ["id", "bulan", "dompet", "saldo_sistem", "saldo_asli", "selisih", "transaksi", "oleh", "dibuat"],
  pengaturan: ["kunci", "nilai"]
};
// Kunci utama tiap tabel (dipakai untuk ubah/hapus).
var KUNCI = { pengguna: "username", tutup_toko: "tanggal", pengaturan: "kunci" };

// Backend Toko Imanuel: Google Apps Script yang menempel di Google Sheets database.
// Tugasnya hanya menyimpan dan membaca baris. Semua hitungan ada di web (docs/js/hitung.js).
//
// Permintaan: POST body JSON (Content-Type text/plain) { aksi, token, data }
// Jawaban: JSON { ok: true, ... } atau { ok: false, pesan }

var MASA_TOKEN_HARI = 60;

function doGet() {
  return jawab({ ok: true, nama: "API Toko Imanuel", waktu: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (req.aksi === "login") return jawab(login(req.data || {}));
    var user = cekToken(req.token);
    if (!user) return jawab({ ok: false, pesan: "Sesi habis. Silakan masuk lagi.", kode: "sesi" });
    switch (req.aksi) {
      case "muat": return jawab(muat());
      case "batch": return jawab(batch(req.data || {}, user));
      case "ubahPassword": return jawab(ubahPassword(user, req.data || {}));
      case "cek": return jawab({ ok: true, user: user });
      default: return jawab({ ok: false, pesan: "Aksi tidak dikenal: " + req.aksi });
    }
  } catch (err) {
    return jawab({ ok: false, pesan: String(err && err.message ? err.message : err) });
  }
}

function jawab(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Akses sheet ----------
function sheetTabel(nama) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nama);
  if (!sh) {
    sh = ss.insertSheet(nama);
    sh.getRange(1, 1, 1, SKEMA[nama].length).setValues([SKEMA[nama]]);
  }
  return sh;
}

function nilaiKeluar(v) {
  if (v instanceof Date) {
    var tz = Session.getScriptTimeZone();
    var jam = Utilities.formatDate(v, tz, "HH:mm:ss");
    return jam === "00:00:00" ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return v;
}

function bacaTabel(nama) {
  var sh = sheetTabel(nama);
  var nilai = sh.getDataRange().getValues();
  if (nilai.length < 2) return [];
  var kepala = nilai[0].map(String);
  var out = [];
  for (var i = 1; i < nilai.length; i++) {
    var r = nilai[i];
    if (r.every(function (c) { return c === "" || c === null; })) continue;
    var o = {};
    for (var j = 0; j < kepala.length; j++) if (kepala[j]) o[kepala[j]] = nilaiKeluar(r[j]);
    out.push(o);
  }
  return out;
}

function muat() {
  var data = {};
  Object.keys(SKEMA).forEach(function (t) {
    if (t === "pengguna") {
      data.pengguna = bacaTabel("pengguna").map(function (u) { return { username: u.username, nama: u.nama, aktif: u.aktif }; });
    } else data[t] = bacaTabel(t);
  });
  return { ok: true, data: data, waktu: new Date().toISOString() };
}

// ops: [{ tabel, simpan: {baris} } | { tabel, hapus: kunci }]
function batch(data, user) {
  var ops = data.ops || [];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cache = {};
    ops.forEach(function (op) {
      if (!SKEMA[op.tabel] || op.tabel === "pengguna") throw new Error("Tabel tidak boleh diubah: " + op.tabel);
      var c = cache[op.tabel] || (cache[op.tabel] = siapkan(op.tabel));
      var kunci = KUNCI[op.tabel] || "id";
      if (op.simpan) {
        var row = op.simpan;
        if (!row[kunci]) throw new Error("Baris " + op.tabel + " tanpa " + kunci);
        if (op.tabel === "transaksi" || op.tabel === "nota") {
          if (!row.oleh) row.oleh = user;
          if (!row.dibuat) row.dibuat = new Date().toISOString();
        }
        tulisBaris(c, row, kunci);
      } else if (op.hapus !== undefined) {
        hapusBaris(c, String(op.hapus), kunci);
      }
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true, jumlah: ops.length, waktu: new Date().toISOString() };
}

function siapkan(tabel) {
  var sh = sheetTabel(tabel);
  var kepala = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  SKEMA[tabel].forEach(function (k) { // tambah kolom yang belum ada
    if (kepala.indexOf(k) < 0) { kepala.push(k); sh.getRange(1, kepala.length).setValue(k); }
  });
  var kunci = KUNCI[tabel] || "id";
  var ki = kepala.indexOf(kunci);
  var last = sh.getLastRow();
  var kunciList = last > 1 ? sh.getRange(2, ki + 1, last - 1, 1).getDisplayValues().map(function (r) { return String(r[0]); }) : [];
  return { sh: sh, kepala: kepala, kunciList: kunciList };
}

function tulisBaris(c, row, kunci) {
  var idx = c.kunciList.indexOf(String(row[kunci]));
  var rowNum;
  var lama = null;
  if (idx >= 0) {
    rowNum = idx + 2;
    lama = c.sh.getRange(rowNum, 1, 1, c.kepala.length).getValues()[0];
  } else {
    rowNum = c.kunciList.length + 2;
    c.kunciList.push(String(row[kunci]));
  }
  var vals = c.kepala.map(function (k, j) {
    if (Object.prototype.hasOwnProperty.call(row, k)) { var v = row[k]; return v === null || v === undefined ? "" : v; }
    return lama ? lama[j] : "";
  });
  var rg = c.sh.getRange(rowNum, 1, 1, c.kepala.length);
  // Format teks: tanggal tetap "2026-11-06", nomor HP tidak kehilangan nol di depan.
  // Web mengubah kembali kolom angka dan ya/tidak saat memuat data.
  rg.setNumberFormat("@");
  rg.setValues([vals.map(function (v) { return v instanceof Date ? nilaiKeluar(v) : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v); })]);
}

function hapusBaris(c, nilaiKunci, kunci) {
  var idx = c.kunciList.indexOf(nilaiKunci);
  if (idx < 0) return;
  c.sh.deleteRow(idx + 2);
  c.kunciList.splice(idx, 1);
}

// ---------- Login ----------
function rahasia() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty("RAHASIA_TOKEN");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("RAHASIA_TOKEN", s); }
  return s;
}

function hashPassword(password, salt) {
  var h = salt + "|" + password;
  for (var i = 0; i < 2000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + "|" + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function login(d) {
  var username = String(d.username || "").trim().toLowerCase();
  var password = String(d.password || "");
  if (!username || !password) return { ok: false, pesan: "Isi nama pengguna dan password." };
  var c = siapkan("pengguna");
  var semua = bacaTabel("pengguna");
  var u = null;
  for (var i = 0; i < semua.length; i++) if (String(semua[i].username).toLowerCase() === username) u = semua[i];
  if (!u || u.aktif === false || String(u.aktif).toUpperCase() === "FALSE") return { ok: false, pesan: "Nama pengguna atau password salah." };
  // Password baru diketik pemilik di sheet "pengguna" kolom password_baru: simpan sebagai hash lalu kosongkan.
  if (u.password_baru) {
    var salt = Utilities.getUuid();
    u.salt = salt; u.hash = hashPassword(String(u.password_baru), salt); u.password_baru = "";
    tulisBaris(c, { username: u.username, salt: u.salt, hash: u.hash, password_baru: "" }, "username");
  }
  if (!u.hash || hashPassword(password, String(u.salt)) !== String(u.hash)) {
    Utilities.sleep(800);
    return { ok: false, pesan: "Nama pengguna atau password salah." };
  }
  return { ok: true, token: buatToken(String(u.username)), user: String(u.username), nama: String(u.nama || u.username) };
}

function buatToken(username) {
  var exp = Date.now() + MASA_TOKEN_HARI * 864e5;
  var isi = username + "|" + exp;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(isi, rahasia()));
  return Utilities.base64EncodeWebSafe(isi) + "." + sig;
}

function cekToken(token) {
  if (!token) return null;
  var bagian = String(token).split(".");
  if (bagian.length !== 2) return null;
  var isi = Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString();
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(isi, rahasia()));
  if (sig !== bagian[1]) return null;
  var p = isi.split("|");
  if (+p[1] < Date.now()) return null;
  return p[0];
}

function ubahPassword(user, d) {
  var c = siapkan("pengguna");
  var semua = bacaTabel("pengguna");
  var u = semua.filter(function (x) { return String(x.username) === user; })[0];
  if (!u || hashPassword(String(d.lama || ""), String(u.salt)) !== String(u.hash)) return { ok: false, pesan: "Password lama salah." };
  if (String(d.baru || "").length < 6) return { ok: false, pesan: "Password baru minimal 6 karakter." };
  var salt = Utilities.getUuid();
  tulisBaris(c, { username: user, salt: salt, hash: hashPassword(String(d.baru), salt), password_baru: "" }, "username");
  return { ok: true };
}

// Jalankan sekali dari editor Apps Script untuk memeriksa database (menu Jalankan > cekDatabase).
function cekDatabase() {
  Object.keys(SKEMA).forEach(function (t) {
    var n = bacaTabel(t).length;
    Logger.log(t + ": " + n + " baris");
  });
}
