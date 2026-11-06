// Uji hitungan: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ringkasBulan, ringkasRentang, awalMinggu, geserHari, namaHari, saldoDompet, hargaIkutModal, lapisan, isiTotal, kolomLapisan, teksLapisan, satukanNama, statusTagihan, geserBulan, akhirBulan, cariBarang, indeks } from "../docs/js/hitung.js";

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

test("harga ikut modal", () => {
  assert.equal(hargaIkutModal(6500, 9000, 7000), 9500);
  assert.equal(hargaIkutModal(6500, 9000, 7100), 10000, "dibulatkan ke atas Rp500");
  assert.equal(hargaIkutModal(6500, "", 7000), 0, "tanpa harga jual lama tidak ada saran");
});

test("satuan berlapis", () => {
  const L = lapisan({ satuan_beli: "dus", satuan_2: "pak", isi_2: 10, satuan_3: "pcs", isi_3: 12 });
  assert.deepEqual(L.map(l => l.satuan), ["dus", "pak", "pcs"]);
  assert.equal(isiTotal(L), 120);
  assert.equal(teksLapisan(L), "1 dus = 10 pak = 120 pcs");
  const k = kolomLapisan(L);
  assert.equal(k.satuan_jual, "pcs"); assert.equal(k.isi, 120); assert.equal(k.satuan_4, ""); assert.equal(k.isi_4, "");
  // data lama: satuan beli + isi total
  const lama = lapisan({ satuan_beli: "lsn", satuan_jual: "pcs", isi: 12 });
  assert.deepEqual(lama, [{ satuan: "lsn", isi: 1 }, { satuan: "pcs", isi: 12 }]);
  assert.equal(isiTotal(lapisan({ satuan_beli: "bh", satuan_jual: "bh", isi: 1 })), 1);
  assert.deepEqual(lapisan({ satuan_beli: "krt", satuan_jual: "krt", isi: 24 }).map(l => l.satuan), ["krt", "pcs"]);
});

test("nama kembar tampil sekali", () => {
  const b = [
    { id: "1", nama: "Toples neo 5,5L", terakhir_beli: "2025-06-11", harga_jual: "" },
    { id: "2", nama: "toples neo 5.5L", terakhir_beli: "2021-12-13", harga_jual: 25000 },
    { id: "3", nama: "Toples neo 10,5L", terakhir_beli: "2025-06-11" }
  ];
  const s = satukanNama(b);
  assert.equal(s.length, 2);
  const neo = s.find(x => x._kembar.length === 2);
  assert.equal(neo.id, "1", "yang paling baru dibeli");
  assert.deepEqual(neo._kembar.sort(), ["1", "2"]);
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

test("ringkasan harian dan mingguan", () => {
  const state = { kategori, dompet, transaksi: [
    T("2026-11-01", "masuk", "jual", "cash", 300000),
    T("2026-11-02", "masuk", "jual", "cash", 500000),
    T("2026-11-02", "keluar", "stok", "cash", 200000),
    T("2026-11-08", "masuk", "jual", "cash", 100000),
    T("2026-11-09", "masuk", "jual", "cash", 700000)
  ] };
  assert.equal(awalMinggu("2026-11-06"), "2026-11-02", "minggu mulai Senin");
  assert.equal(awalMinggu("2026-11-08"), "2026-11-02", "Minggu ikut minggu sebelumnya");
  assert.equal(awalMinggu("2026-11-02"), "2026-11-02");
  assert.equal(geserHari("2026-11-30", 1), "2026-12-01");
  assert.equal(namaHari("2026-11-06"), "Jum");
  const hari = ringkasRentang(state, "2026-11-02", "2026-11-02");
  assert.equal(hari.penjualan, 500000);
  assert.equal(hari.laba, 300000);
  const minggu = ringkasRentang(state, "2026-11-02", geserHari("2026-11-02", 6));
  assert.equal(minggu.penjualan, 600000);
  assert.equal(minggu.hariBuka, 2);
  const bulan = ringkasBulan(state, "2026-11");
  assert.equal(bulan.penjualan, 1600000);
  assert.deepEqual(Object.keys(bulan.hari).sort(), ["01", "02", "08", "09"], "ringkasBulan tetap berkunci tanggal 2 digit");
});
