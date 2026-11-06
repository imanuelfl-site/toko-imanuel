// Uji hitungan: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ringkasBulan, saldoDompet, hargaSaran, hargaJagaUntung, statusTagihan, geserBulan, akhirBulan, cariBarang, indeks } from "../docs/js/hitung.js";

const dompet = [
  { id: "cash", pemilik: "toko" }, { id: "sea", pemilik: "toko" }, { id: "fp", pemilik: "toko" }, { id: "bca", pemilik: "pribadi" }
];
const kategori = [
  { id: "jual", pos: "toko", peran: "penjualan", jenis: "masuk", nama: "Penjualan" },
  { id: "admin", pos: "toko", peran: "pendapatan", jenis: "masuk", nama: "Admin" },
  { id: "stok", pos: "toko", peran: "belanja", jenis: "keluar", nama: "Belanja" },
  { id: "fpuse", pos: "toko", peran: "layanan", jenis: "keluar", nama: "Fastpay" },
  { id: "listrik", pos: "toko", peran: "biaya", jenis: "keluar", nama: "Listrik" },
  { id: "makan", pos: "pribadi", peran: "biaya", jenis: "keluar", nama: "Makan" },
  { id: "komisi", pos: "pribadi", peran: "pendapatan", jenis: "masuk", nama: "Komisi" },
  { id: "cicil", pos: "toko", peran: "cicilan", jenis: "keluar", nama: "Cicilan" },
  { id: "pinjam", pos: "toko", peran: "pinjaman", jenis: "masuk", nama: "Pinjaman" },
  { id: "sesuai", pos: "khusus", peran: "penyesuaian", jenis: "keluar", nama: "Penyesuaian" },
  { id: "pindah", pos: "khusus", peran: "pindah", jenis: "pindah", nama: "Pindah" }
];
const T = (tanggal, jenis, kat, dom, nominal, tujuan = "") => ({ tanggal, jenis, kategori: kat, dompet: dom, dompet_tujuan: tujuan, nominal, hapus: false });

test("laba kas dan aliran toko-pribadi", () => {
  const transaksi = [
    T("2026-11-02", "masuk", "jual", "cash", 1000000),
    T("2026-11-02", "masuk", "jual", "bca", 200000),        // penjualan masuk rekening pribadi -> prive
    T("2026-11-03", "masuk", "admin", "cash", 40000),
    T("2026-11-03", "keluar", "stok", "sea", 500000),
    T("2026-11-04", "keluar", "stok", "bca", 100000),       // belanja toko dibayar pribadi -> setoran
    T("2026-11-04", "pindah", "pindah", "sea", 300000, "fp"),
    T("2026-11-30", "keluar", "fpuse", "fp", 250000),
    T("2026-11-05", "keluar", "listrik", "fp", 80000),
    T("2026-11-05", "keluar", "makan", "cash", 15000),      // prive
    T("2026-11-06", "masuk", "komisi", "sea", 50000),       // setoran
    T("2026-11-07", "pindah", "pindah", "cash", 60000, "bca"), // prive
    T("2026-11-08", "keluar", "cicil", "sea", 70000),
    T("2026-11-09", "masuk", "pinjam", "sea", 90000),
    T("2026-11-10", "keluar", "sesuai", "cash", 5000),      // tidak dihitung
    { ...T("2026-11-10", "masuk", "jual", "cash", 999999), hapus: true }
  ];
  const state = { dompet, kategori, transaksi };
  const r = ringkasBulan(state, "2026-11");
  assert.equal(r.penjualan, 1200000);
  assert.equal(r.pendapatan, 40000);
  assert.equal(r.belanja, 600000);
  assert.equal(r.layanan, 250000);
  assert.equal(r.biaya, 80000);
  assert.equal(r.laba, 1200000 + 40000 - 600000 - 250000 - 80000);
  assert.equal(r.prive, 200000 + 15000 + 60000);
  assert.equal(r.setoran, 100000 + 50000);
  // Identitas: perubahan uang toko = selisih saldo dompet toko (tanpa penyesuaian).
  const tanpaSesuai = { ...state, transaksi: transaksi.filter(t => t.kategori !== "sesuai") };
  const s = saldoDompet(tanpaSesuai);
  const totalToko = ["cash", "sea", "fp"].reduce((a, id) => a + s[id], 0);
  assert.equal(r.perubahanToko, totalToko);
  assert.equal(r.hari["02"], 1200000);
});

test("identitas berlaku pada data hasil konversi", { skip: !fs.existsSync(new URL("../data-keluaran/data.json", import.meta.url)) }, () => {
  const db = JSON.parse(fs.readFileSync(new URL("../data-keluaran/data.json", import.meta.url)));
  const ix = indeks(db);
  const toko = db.dompet.filter(d => d.pemilik === "toko").map(d => d.id);
  const bulanList = [...new Set(db.transaksi.map(t => t.tanggal.slice(0, 7)))].sort();
  let total = 0;
  for (const b of bulanList) total += ringkasBulan(db, b, ix).perubahanToko;
  const s = saldoDompet(db);
  const saldoToko = toko.reduce((a, id) => a + (s[id] || 0), 0);
  assert.equal(Math.round(total), Math.round(saldoToko));
});

test("harga saran dan jaga untung", () => {
  assert.equal(hargaSaran(310000, 30), 403000);
  assert.equal(hargaSaran(3500, 50), 5500);
  assert.equal(hargaJagaUntung(6500, 9000, 7000), 10000);
  assert.equal(hargaSaran(0, 30), 0);
});

test("bulan dan tagihan", () => {
  assert.equal(geserBulan("2026-01", -1), "2025-12");
  assert.equal(akhirBulan("2026-02"), "2026-02-28");
  const st = statusTagihan({ tagihan: [{ id: "a", tgl: 3 }, { id: "b", tgl: 10 }, { id: "c", tgl: 28 }, { id: "d", tgl: 8 }], transaksi: [{ tagihan: "a", tanggal: "2026-11-03", hapus: false }] }, "2026-11", "2026-11-06");
  const m = Object.fromEntries(st.map(x => [x.id, x.status]));
  assert.deepEqual(m, { a: "lunas", b: "belum", c: "belum", d: "dekat" });
  const lewat = statusTagihan({ tagihan: [{ id: "x", tgl: 2 }], transaksi: [] }, "2026-11", "2026-11-06");
  assert.equal(lewat[0].status, "lewat");
});

test("baca angka format Indonesia", async () => {
  const { angka } = await import("../docs/js/hitung.js");
  assert.equal(angka("15.000"), 15000);
  assert.equal(angka("1.234.567"), 1234567);
  assert.equal(angka("Rp 2.500"), 2500);
  assert.equal(angka("1,5"), 1.5);
  assert.equal(angka("8283.958333"), 8283.958333);
  assert.equal(angka("4500"), 4500);
  assert.equal(angka(""), 0);
  assert.equal(angka(12), 12);
});

test("cari barang", () => {
  const b = [{ nama: "Kompor HOCK 16" }, { nama: "kepala kompor 22" }, { nama: "panci DD 22" }];
  assert.deepEqual(cariBarang(b, "kompor").map(x => x.nama), ["Kompor HOCK 16", "kepala kompor 22"]);
  assert.deepEqual(cariBarang(b, "22 kompor").map(x => x.nama), ["kepala kompor 22"]);
});
