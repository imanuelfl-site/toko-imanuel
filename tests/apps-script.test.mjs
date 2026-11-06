// Uji Code.gs dengan tiruan layanan Google (SpreadsheetApp, Utilities, dll.).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

function tiruanGoogle(awal) {
  const sheets = {};
  for (const [nama, rows] of Object.entries(awal)) sheets[nama] = rows.map(r => r.slice());
  const lebar = n => Math.max(1, ...sheets[n].map(r => r.length));
  const range = (n, r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sheets[n][r - 1 + i] || [])[c - 1 + j] ?? "")),
    getDisplayValues() { return this.getValues().map(row => row.map(String)); },
    setValues: vals => vals.forEach((row, i) => { const rr = sheets[n][r - 1 + i] || (sheets[n][r - 1 + i] = []); row.forEach((v, j) => (rr[c - 1 + j] = v)); }),
    setValue: v => { const rr = sheets[n][r - 1] || (sheets[n][r - 1] = []); rr[c - 1] = v; },
    setNumberFormat() { return this; }
  });
  const sheet = n => ({
    getDataRange: () => range(n, 1, 1, sheets[n].length, lebar(n)),
    getRange: (r, c, nr = 1, nc = 1) => range(n, r, c, nr, nc),
    getLastRow: () => sheets[n].length,
    getLastColumn: () => lebar(n),
    deleteRow: r => sheets[n].splice(r - 1, 1)
  });
  const props = {};
  const drive = { folder: [], file: [] };
  const b64 = buf => Buffer.from(buf).toString("base64");
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => (sheets[n] ? sheet(n) : null), insertSheet: n => { sheets[n] = []; return sheet(n); } }), flush() {} },
    ContentService: { createTextOutput: s => ({ setMimeType() { return s; } }), MimeType: { JSON: "json" } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => (props[k] = v) }) },
    Session: { getScriptTimeZone: () => "Asia/Jayapura" },
    Logger: { log() {} },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: "link" }, Permission: { VIEW: "view" },
      createFolder: nama => { const f = { id: "F" + drive.folder.length, nama, getId() { return this.id; }, isTrashed: () => false, getUrl: () => "url", createFile: blob => { const file = { id: "D" + drive.file.length, blob, getId() { return this.id; }, setSharing(a, p) { file.berbagi = a + ":" + p; } }; drive.file.push(file); return file; } }; drive.folder.push(f); return f; },
      getFolderById: id => drive.folder.find(f => f.id === id)
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (alg, s) => [...crypto.createHash("sha256").update(s, "utf8").digest()],
      computeHmacSha256Signature: (s, k) => [...crypto.createHmac("sha256", k).update(s).digest()],
      base64Encode: b => b64(Buffer.from(b.map ? b.map(x => x & 255) : b)),
      base64EncodeWebSafe: b => Buffer.from(typeof b === "string" ? Buffer.from(b) : b.map(x => x & 255)).toString("base64url"),
      base64DecodeWebSafe: s => [...Buffer.from(s, "base64url")],
      newBlob: (bytes, mime, nama) => ({ mime, nama, ukuran: bytes.length, getDataAsString: () => Buffer.from(bytes).toString("utf8") }),
      base64Decode: s => [...Buffer.from(s, "base64")],
      formatDate: (d, tz, f) => f.includes("HH") ? d.toISOString().slice(0, 19) : d.toISOString().slice(0, 10),
      sleep() {}
    }
  };
  return { g, sheets, drive };
}

function muatServer(awal) {
  const { g, sheets, drive } = tiruanGoogle(awal);
  const ctx = vm.createContext({ ...g, console, Date, JSON, Math, String, Object, Number });
  vm.runInContext(fs.readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"), ctx);
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
  return { post, sheets, drive };
}

const awal = () => ({
  pengguna: [["username", "nama", "password_baru", "salt", "hash", "aktif"], ["imanuel", "Imanuel", "rahasia-uji", "", "", true], ["istri", "Istri", "", "", "", true]],
  transaksi: [["id", "tanggal", "jenis", "kategori", "dompet", "dompet_tujuan", "nominal", "keterangan", "perjalanan", "tagihan", "nota", "sumber", "catatan", "oleh", "dibuat", "diubah", "hapus", "asal"], ["L1", "2026-11-01", "masuk", "penjualan", "cash-toko", "", 870000, "uang masuk toko", "", "", "", "impor", "", "impor", "2026-11-06", "", false, "x"]]
});

test("login, muat, simpan, hapus", () => {
  const { post, sheets } = muatServer(awal());
  assert.equal(post({ aksi: "muat", token: "palsu" }).kode, "sesi");
  assert.equal(post({ aksi: "login", data: { username: "imanuel", password: "salah" } }).ok, false);
  const l = post({ aksi: "login", data: { username: "Imanuel", password: "rahasia-uji" } });
  assert.equal(l.ok, true, l.pesan);
  assert.equal(sheets.pengguna[1][2], "", "password_baru dikosongkan");
  assert.ok(sheets.pengguna[1][4], "hash tersimpan");
  // login kedua memakai hash
  assert.equal(post({ aksi: "login", data: { username: "imanuel", password: "rahasia-uji" } }).ok, true);
  assert.equal(post({ aksi: "login", data: { username: "istri", password: "apa saja" } }).ok, false, "tanpa password tidak bisa masuk");
  const m = post({ aksi: "muat", token: l.token });
  assert.equal(m.ok, true);
  assert.equal(m.data.transaksi.length, 1);
  assert.deepEqual(Object.keys(m.data.pengguna[0]).sort(), ["aktif", "nama", "username"], "hash tidak dikirim");
  assert.ok(m.data.kategori, "tab kosong dibuat otomatis");
  const b = post({ aksi: "batch", token: l.token, data: { ops: [
    { tabel: "transaksi", simpan: { id: "T1", tanggal: "2026-11-06", jenis: "keluar", kategori: "makan", dompet: "cash-toko", nominal: 15000, keterangan: "makan malam", hapus: false } },
    { tabel: "transaksi", simpan: { id: "L1", keterangan: "uang masuk toko (diubah)" } },
    { tabel: "tutup_toko", simpan: { tanggal: "2026-11-06", tutup: false, tunai: 520000 } }
  ] } });
  assert.equal(b.ok, true, b.pesan);
  const m2 = post({ aksi: "muat", token: l.token });
  const t1 = m2.data.transaksi.find(t => t.id === "T1");
  assert.equal(t1.oleh, "imanuel");
  assert.equal(t1.nominal, "15000");
  assert.equal(t1.hapus, "FALSE");
  assert.equal(m2.data.transaksi.find(t => t.id === "L1").keterangan, "uang masuk toko (diubah)");
  assert.equal(String(m2.data.transaksi.find(t => t.id === "L1").nominal), "870000", "kolom yang tidak dikirim tetap");
  assert.equal(m2.data.tutup_toko[0].tunai, "520000");
  post({ aksi: "batch", token: l.token, data: { ops: [{ tabel: "transaksi", hapus: "T1" }] } });
  assert.equal(post({ aksi: "muat", token: l.token }).data.transaksi.length, 1);
  assert.equal(post({ aksi: "batch", token: l.token, data: { ops: [{ tabel: "pengguna", simpan: { username: "x" } }] } }).ok, false, "tabel pengguna terkunci");
});

test("ubah password", () => {
  const { post } = muatServer(awal());
  const l = post({ aksi: "login", data: { username: "imanuel", password: "rahasia-uji" } });
  assert.equal(post({ aksi: "ubahPassword", token: l.token, data: { lama: "salah", baru: "baru123" } }).ok, false);
  assert.equal(post({ aksi: "ubahPassword", token: l.token, data: { lama: "rahasia-uji", baru: "baru123" } }).ok, true);
  assert.equal(post({ aksi: "login", data: { username: "imanuel", password: "baru123" } }).ok, true);
  assert.equal(post({ aksi: "login", data: { username: "imanuel", password: "rahasia-uji" } }).ok, false);
});

test("unggah foto ke Drive", () => {
  const { post, drive } = muatServer(awal());
  assert.equal(post({ aksi: "unggahFoto", token: "palsu", data: { data: "eA==" } }).kode, "sesi", "harus login");
  const l = post({ aksi: "login", data: { username: "imanuel", password: "rahasia-uji" } });
  const data = Buffer.from("gambar-palsu").toString("base64");
  const r1 = post({ aksi: "unggahFoto", token: l.token, data: { nama: "Kompor HOCK 16/2", mime: "image/jpeg", data } });
  assert.equal(r1.ok, true, r1.pesan);
  const r2 = post({ aksi: "unggahFoto", token: l.token, data: { nama: "Panci", mime: "text/html", data } });
  assert.equal(drive.folder.length, 1, "satu folder dipakai ulang");
  assert.equal(drive.file.length, 2);
  assert.equal(drive.file[0].getId(), r1.id);
  assert.equal(drive.file[0].blob.nama, "Kompor HOCK 16 2.jpg", "nama file aman");
  assert.equal(drive.file[1].blob.mime, "image/jpeg", "mime selain gambar diganti");
  assert.equal(drive.file[0].berbagi, "link:view");
  assert.equal(post({ aksi: "unggahFoto", token: l.token, data: {} }).ok, false, "foto kosong ditolak");
  assert.ok(r2.ok);
});

test("kolom baru barang ditambahkan ke sheet lama", () => {
  const db = awal();
  db.barang = [["id", "nama", "kelompok", "supplier", "satuan_jual", "satuan_beli", "isi", "modal", "harga_jual", "harga_diubah", "terakhir_beli", "aktif"], ["B1", "Termos", "perabot", "cm", "bh", "bh", 1, 50000, "", "", "", true]];
  const { post, sheets } = muatServer(db);
  const l = post({ aksi: "login", data: { username: "imanuel", password: "rahasia-uji" } });
  const r = post({ aksi: "batch", token: l.token, data: { ops: [{ tabel: "barang", simpan: { id: "B1", satuan_beli: "dus", satuan_2: "pcs", isi_2: 12, isi: 12, satuan_jual: "pcs", foto: "D9" } }] } });
  assert.equal(r.ok, true, r.pesan);
  const kepala = sheets.barang[0];
  for (const k of ["satuan_2", "isi_2", "satuan_3", "foto"]) assert.ok(kepala.includes(k), "kolom " + k);
  const b = post({ aksi: "muat", token: l.token }).data.barang[0];
  assert.equal(b.nama, "Termos"); assert.equal(b.kelompok, "perabot", "kolom lama tetap");
  assert.equal(b.satuan_2, "pcs"); assert.equal(b.isi_2, "12"); assert.equal(b.foto, "D9");
});
