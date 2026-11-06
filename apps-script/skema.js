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
if (typeof module !== "undefined") module.exports = { SKEMA: SKEMA, KUNCI: KUNCI };
