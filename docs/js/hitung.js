// Semua hitungan sistem (tanpa tampilan). Bisa diuji di Node.
// state: { kategori, dompet, transaksi, tagihan, barang, ... } (larik baris dari database)

export const bulanIni = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const hariIni = (d = new Date()) => `${bulanIni(d)}-${String(d.getDate()).padStart(2, "0")}`;
export const geserBulan = (b, n) => { const [y, m] = b.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return bulanIni(d); };
export const akhirBulan = b => { const [y, m] = b.split("-").map(Number); return `${b}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
export const jumlahHari = b => +akhirBulan(b).slice(8);
const keTgl = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
export const geserHari = (tgl, n) => { const d = keTgl(tgl); d.setDate(d.getDate() + n); return hariIni(d); };
// Minggu dimulai hari Senin.
export const awalMinggu = tgl => geserHari(tgl, -((keTgl(tgl).getDay() + 6) % 7));
export const namaHari = tgl => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][keTgl(tgl).getDay()];

export function indeks(state) {
  const kat = new Map(state.kategori.map(k => [k.id, k]));
  const dom = new Map(state.dompet.map(d => [d.id, d]));
  return { kat, dom };
}

export const aktif = t => !(t.hapus === true || t.hapus === "TRUE" || t.hapus === "true");
// Angka dari isian atau data. "15.000" dan "15.000,5" dibaca format Indonesia (titik = ribuan).
export const angka = v => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/rp|\s/gi, "");
  if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  return parseFloat(s.replace(/[^\d.-]/g, "")) || 0;
};

// Saldo setiap dompet sampai tanggal tertentu (termasuk).
export function saldoDompet(state, sampai = "9999-12-31") {
  const s = Object.fromEntries(state.dompet.map(d => [d.id, 0]));
  for (const t of state.transaksi) {
    if (!aktif(t) || t.tanggal > sampai) continue;
    const n = angka(t.nominal);
    if (t.jenis === "masuk") s[t.dompet] = (s[t.dompet] || 0) + n;
    else if (t.jenis === "keluar") s[t.dompet] = (s[t.dompet] || 0) - n;
    else if (t.jenis === "pindah") { s[t.dompet] = (s[t.dompet] || 0) - n; s[t.dompet_tujuan] = (s[t.dompet_tujuan] || 0) + n; }
  }
  return s;
}

// Ringkasan satu bulan: laba kas dan aliran uang toko <-> pribadi. r.hari berkunci tanggal "01".."31".
export function ringkasBulan(state, bulan, ix = indeks(state)) {
  const r = ringkasRentang(state, bulan + "-01", akhirBulan(bulan), ix);
  r.bulan = bulan;
  r.hari = Object.fromEntries(Object.entries(r.hari).map(([t, v]) => [t.slice(8, 10), v]));
  return r;
}

// Ringkasan rentang tanggal dari..sampai (termasuk keduanya). r.hari berkunci tanggal lengkap.
export function ringkasRentang(state, dari, sampai, ix = indeks(state)) {
  const r = {
    dari, sampai, penjualan: 0, pendapatan: 0, pendapatanPer: {}, belanja: 0, layanan: 0, biaya: 0, biayaPer: {},
    prive: 0, privePer: {}, setoran: 0, setoranPer: {}, pinjaman: 0, cicilan: 0, modal: 0,
    hari: {}, jumlahTransaksi: 0, hariBuka: 0
  };
  const tambah = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
  const pemilik = id => (ix.dom.get(id) || {}).pemilik || "toko";
  for (const t of state.transaksi) {
    const tg = String(t.tanggal || "").slice(0, 10);
    if (!aktif(t) || !tg || tg < dari || tg > sampai) continue;
    const n = angka(t.nominal);
    r.jumlahTransaksi++;
    if (t.jenis === "pindah") {
      const a = pemilik(t.dompet), b = pemilik(t.dompet_tujuan);
      if (a === "toko" && b === "pribadi") { r.prive += n; tambah(r.privePer, "Pindah ke dompet pribadi", n); }
      if (a === "pribadi" && b === "toko") { r.setoran += n; tambah(r.setoranPer, "Pindah dari dompet pribadi", n); }
      continue;
    }
    const k = ix.kat.get(t.kategori) || { pos: "toko", peran: "biaya", nama: t.kategori };
    if (k.peran === "penyesuaian") continue;
    const milik = pemilik(t.dompet);
    if (k.pos === "toko") {
      if (k.peran === "penjualan") { r.penjualan += n; tambah(r.hari, tg, n); }
      else if (k.peran === "pendapatan") { r.pendapatan += n; tambah(r.pendapatanPer, k.nama, n); }
      else if (k.peran === "belanja") r.belanja += n;
      else if (k.peran === "layanan") r.layanan += n;
      else if (k.peran === "biaya") { r.biaya += n; tambah(r.biayaPer, k.nama, n); }
      else if (k.peran === "pinjaman") r.pinjaman += n;
      else if (k.peran === "cicilan") r.cicilan += n;
      else if (k.peran === "modal") r.modal += n;
      if (milik === "pribadi") {
        if (t.jenis === "masuk") { r.prive += n; tambah(r.privePer, "Uang toko masuk ke dompet pribadi", n); }
        else { r.setoran += n; tambah(r.setoranPer, "Keperluan toko dibayar dari dompet pribadi", n); }
      }
    } else if (k.pos === "pribadi" && milik === "toko") {
      if (t.jenis === "keluar") { r.prive += n; tambah(r.privePer, k.nama, n); }
      else { r.setoran += n; tambah(r.setoranPer, k.nama, n); }
    }
  }
  r.hariBuka = Object.keys(r.hari).length;
  r.masukUsaha = r.penjualan + r.pendapatan;
  r.laba = r.masukUsaha - r.belanja - r.layanan - r.biaya;
  r.perubahanToko = r.laba - r.prive + r.setoran + r.pinjaman + r.modal - r.cicilan;
  return r;
}

export function rataLaba(state, bulan, n = 3, ix = indeks(state)) {
  const list = [];
  for (let i = n - 1; i >= 0; i--) list.push(ringkasBulan(state, geserBulan(bulan, -i), ix));
  const ada = list.filter(x => x.jumlahTransaksi > 0);
  return { list, rata: ada.length ? ada.reduce((s, x) => s + x.laba, 0) / ada.length : 0, bulanAda: ada.length };
}

// Status tagihan rutin untuk satu bulan.
export function statusTagihan(state, bulan, hari = hariIni()) {
  return state.tagihan.filter(t => t.aktif !== false && t.aktif !== "FALSE").map(t => {
    const bayar = state.transaksi.filter(x => aktif(x) && x.tagihan === t.id && x.tanggal.slice(0, 7) === bulan).sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1));
    const tgl = Math.min(Math.max(1, Math.round(angka(t.tgl)) || 1), jumlahHari(bulan));
    const jatuh = `${bulan}-${String(tgl).padStart(2, "0")}`;
    let status = "belum", selisihHari = Math.round((new Date(jatuh) - new Date(hari)) / 864e5);
    if (bayar.length) status = "lunas";
    else if (!angka(t.tgl)) status = "tidak-tetap";
    else if (selisihHari < 0) status = "lewat";
    else if (selisihHari <= 3) status = "dekat";
    return { ...t, jatuh, status, selisihHari, bayar };
  }).sort((a, b) => (angka(a.tgl) || 99) - (angka(b.tgl) || 99));
}

export const untungPersen = (modal, jual) => { const m = angka(modal), j = angka(jual); return m > 0 && j > 0 ? Math.round(((j - m) / m) * 100) : null; };

// Modal naik: harga jual lama ditambah kenaikan modal (untung rupiah tetap), dibulatkan ke atas.
export function hargaIkutModal(modalLama, jualLama, modalBaru, bulat = 500) {
  const j = angka(jualLama);
  if (!j) return 0;
  return Math.ceil((j + angka(modalBaru) - angka(modalLama)) / bulat) * bulat;
}

// Satuan berlapis, misalnya dus > pak > pcs. Lapis pertama = satuan beli, lapis terakhir = satuan jual.
// Hasil: [{ satuan, isi }] dengan isi = jumlah lapis ini di dalam satu lapis sebelumnya (lapis pertama isi 1).
export function lapisan(b) {
  const L = [{ satuan: String(b.satuan_beli || b.satuan_jual || "bh").trim(), isi: 1 }];
  for (const k of [2, 3, 4]) {
    const s = String(b["satuan_" + k] || "").trim();
    if (!s) break;
    L.push({ satuan: s, isi: angka(b["isi_" + k]) || 1 });
  }
  // Data lama: hanya ada satuan beli + isi total (mis. lsn isi 12 pcs)
  if (L.length === 1 && angka(b.isi) > 1) L.push({ satuan: String(b.satuan_jual && b.satuan_jual !== b.satuan_beli ? b.satuan_jual : "pcs"), isi: angka(b.isi) });
  return L;
}
export const isiTotal = L => L.reduce((p, l, i) => (i ? p * (angka(l.isi) || 1) : p), 1);
export function kolomLapisan(L) {
  const o = { satuan_beli: L[0].satuan, satuan_jual: L[L.length - 1].satuan, isi: isiTotal(L) };
  for (const k of [2, 3, 4]) { const l = L[k - 1]; o["satuan_" + k] = l ? l.satuan : ""; o["isi_" + k] = l ? l.isi : ""; }
  return o;
}
// "1 dus = 10 pak = 120 pcs"
export function teksLapisan(L) {
  if (L.length < 2) return "";
  let n = 1;
  return [`1 ${L[0].satuan}`, ...L.slice(1).map(l => `${(n *= angka(l.isi) || 1)} ${l.satuan}`)].join(" = ");
}

// Nama sama (beda huruf besar, spasi, atau tanda baca) dianggap satu barang.
export const kunciNama = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Tampilkan sekali per nama: yang paling baru dibeli (yang punya harga jual didahulukan bila sama).
// Setiap hasil membawa _kembar: semua id barang dengan nama itu.
export function satukanNama(barang) {
  const m = new Map();
  const lebihBaik = (x, y) => String(x.terakhir_beli || "") > String(y.terakhir_beli || "") || (String(x.terakhir_beli || "") === String(y.terakhir_beli || "") && angka(x.harga_jual) > 0 && !(angka(y.harga_jual) > 0));
  for (const b of barang) {
    const k = kunciNama(b.nama), a = m.get(k);
    if (!a) m.set(k, { ...b, _kembar: [b.id] });
    else { const kembar = [...a._kembar, b.id]; m.set(k, lebihBaik(b, a) ? { ...b, _kembar: kembar } : { ...a, _kembar: kembar }); }
  }
  return [...m.values()];
}

// Cari barang: semua kata harus ada di nama (tanpa beda huruf besar/kecil). Nama kembar tampil sekali.
export function cariBarang(barang, q, batas = 60) {
  const kata = kunciNama(q).split(" ").filter(Boolean);
  const hasil = satukanNama(barang.filter(b => b.aktif !== false && b.aktif !== "FALSE")).filter(b => { const n = kunciNama(b.nama); return kata.every(k => n.includes(k)); });
  const awal = kata[0] || "";
  hasil.sort((a, b) => { const sa = kunciNama(a.nama).startsWith(awal) ? 0 : 1, sb = kunciNama(b.nama).startsWith(awal) ? 0 : 1; return sa - sb || String(a.nama).localeCompare(String(b.nama)); });
  return hasil.slice(0, batas);
}

// Barang yang modalnya naik di nota terakhir tetapi harga jualnya belum diubah sejak itu.
export function hargaNaik(state, sejak) {
  const notaTgl = new Map(state.nota.map(n => [n.id, n.tanggal]));
  const perBarang = new Map();
  for (const it of state.nota_item) {
    if (!it.barang || !angka(it.modal)) continue;
    const tgl = notaTgl.get(it.nota) || "";
    if (!tgl) continue;
    const arr = perBarang.get(it.barang) || [];
    arr.push({ tgl, modal: angka(it.modal) });
    perBarang.set(it.barang, arr);
  }
  const out = [];
  const barang = new Map(state.barang.map(b => [b.id, b]));
  for (const [id, arr] of perBarang) {
    arr.sort((a, b) => (a.tgl < b.tgl ? -1 : 1));
    if (arr.length < 2) continue;
    const akhir = arr[arr.length - 1], sebelum = arr[arr.length - 2];
    const b = barang.get(id);
    if (!b || akhir.tgl < sejak || akhir.modal <= sebelum.modal) continue;
    if (b.harga_diubah && b.harga_diubah >= akhir.tgl) continue;
    out.push({ barang: b, modalLama: sebelum.modal, modalBaru: akhir.modal, tanggal: akhir.tgl });
  }
  return out;
}
