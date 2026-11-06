// Data di memori + simpan ke server.
import { api, cacheData } from "./api.js";
import { indeks } from "./hitung.js";

const ANGKA = new Set(["nominal", "total", "qty", "isi", "harga", "modal", "harga_jual", "markup", "tgl", "urutan", "tunai", "transfer", "jt_nominal", "jt_admin", "jt_jumlah", "saldo_sistem", "saldo_asli", "selisih", "nilai"]);
const YA = new Set(["aktif", "hapus", "tutup"]);
const KUNCI = { pengguna: "username", tutup_toko: "tanggal", pengaturan: "kunci" };
const TABEL = ["pengguna", "kategori", "dompet", "kelompok", "supplier", "barang", "nota", "nota_item", "transaksi", "tagihan", "perjalanan", "tutup_toko", "tutup_buku", "pengaturan"];

export const S = { data: null, ix: null, user: "", nama: "", dimuat: null };

function normalBaris(row) {
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    if (YA.has(k)) o[k] = v === true || v === "TRUE" || v === "true" || v === 1 || v === "1";
    else if (ANGKA.has(k) && k !== "nilai") o[k] = v === "" || v === null || v === undefined ? (k === "harga_jual" ? "" : 0) : Number(String(v).replace(/[^\d.-]/g, "")) || 0;
    else o[k] = v === null || v === undefined ? "" : (typeof v === "number" && k !== "nilai" ? String(v) : v);
  }
  if ("aktif" in row && (row.aktif === "" || row.aktif === undefined)) o.aktif = true;
  return o;
}

export function pasangData(data) {
  const d = {};
  for (const t of TABEL) d[t] = (data[t] || []).map(normalBaris);
  // urutkan
  ["kategori", "dompet", "kelompok", "supplier", "tagihan"].forEach(t => d[t].sort((a, b) => (a.urutan || 0) - (b.urutan || 0)));
  d.transaksi.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : String(a.dibuat) < String(b.dibuat) ? -1 : 1));
  S.data = d;
  S.ix = indeks(d);
  S.dimuat = new Date();
}

export async function muatServer() {
  const r = await api.muat();
  pasangData(r.data);
  cacheData(r.data);
  return S.data;
}

export const pengaturan = (k, awal = "") => { const p = S.data.pengaturan.find(x => x.kunci === k); return p ? p.nilai : awal; };

export function idBaru(awalan) {
  return awalan + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function terapkan(ops) {
  for (const op of ops) {
    const tabel = S.data[op.tabel] || (S.data[op.tabel] = []);
    const k = KUNCI[op.tabel] || "id";
    if (op.simpan) {
      const row = normalBaris(op.simpan);
      const i = tabel.findIndex(x => String(x[k]) === String(row[k]));
      if (i >= 0) tabel[i] = { ...tabel[i], ...row }; else tabel.push(row);
    } else if (op.hapus !== undefined) {
      const i = tabel.findIndex(x => String(x[k]) === String(op.hapus));
      if (i >= 0) tabel.splice(i, 1);
    }
  }
  S.data.transaksi.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : String(a.dibuat) < String(b.dibuat) ? -1 : 1));
  S.ix = indeks(S.data);
  cacheData(S.data);
}

// ops: [{ tabel, simpan: row } | { tabel, hapus: kunci }]
export async function simpan(ops) {
  const sekarang = new Date().toISOString();
  ops.forEach(op => {
    if (op.simpan && op.tabel === "transaksi") {
      if (!op.simpan.dibuat) op.simpan.dibuat = sekarang; else op.simpan.diubah = sekarang;
      if (!op.simpan.oleh) op.simpan.oleh = S.user;
    }
    if (op.simpan && op.tabel === "nota" && !op.simpan.dibuat) { op.simpan.dibuat = sekarang; op.simpan.oleh = op.simpan.oleh || S.user; }
  });
  await api.batch(ops);
  terapkan(ops);
}

// Pencarian cepat
export const kat = id => S.ix.kat.get(id) || { id, nama: id || "–", pos: "khusus", jenis: "keluar", peran: "biaya" };
export const dom = id => S.ix.dom.get(id) || { id, nama: id || "–", pemilik: "toko" };
export const namaPengguna = u => { const p = (S.data.pengguna || []).find(x => x.username === u); return p ? p.nama : (u === "impor" ? "data lama" : u || ""); };
