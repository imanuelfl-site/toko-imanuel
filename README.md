# Sistem Toko Imanuel

Pencatatan keuangan dan belanja Toko Imanuel: isi data dari HP, laporan laba kas, cek harga barang, tagihan rutin, dan pemisahan uang toko dan pribadi.

- Web: `docs/` (HTML, CSS, JavaScript tanpa build), dipasang di GitHub Pages pada `toko.imanuelfl.my.id`
- Server: `apps-script/` (Google Apps Script yang menempel di Google Sheets database)
- Hitungan: `docs/js/hitung.js` (laba kas, saldo dompet, uang toko ↔ pribadi, tagihan, satuan berlapis, nama barang kembar)
- Foto barang: diunggah lewat Apps Script ke folder Google Drive pemilik; kolom `barang.foto` berisi ID file
- Uji: `node --test tests/*.test.mjs`

Cara pasang: lihat [PANDUAN-PASANG.md](PANDUAN-PASANG.md).

## Struktur

| Path | Isi |
|---|---|
| `docs/index.html`, `docs/js/app.js` | Kerangka, login, rute halaman |
| `docs/js/halaman/isi.js` | Beranda, catat uang, tutup toko, riwayat |
| `docs/js/halaman/nota.js` | Nota belanja |
| `docs/js/halaman/harga.js` | Cek harga |
| `docs/js/halaman/laporan.js` | Dashboard, laba bulanan, buku kas |
| `docs/js/halaman/kelola.js` | Tutup buku, perjalanan, tagihan, data induk, akun |
| `apps-script/skema.js` | Kolom setiap tab database |
| `apps-script/server.js` | Login dan simpan/baca baris; `node tools/bangun-gs.js` menggabungkannya jadi `Code.gs` |

## Konsep hitungan

- Setiap **kategori** punya pos (toko/pribadi) dan peran (penjualan, pendapatan, belanja, biaya, layanan, pindah, pinjaman, cicilan, modal, penyesuaian).
- Setiap **dompet** punya pemilik (toko/pribadi).
- **Laba kas** = penjualan + pendapatan toko − belanja stok − pemakaian saldo Fastpay − biaya toko. Dinilai dari rata-rata 3 bulan.
- **Uang toko dipakai pribadi**: kategori pribadi dibayar dari dompet toko, pendapatan toko masuk dompet pribadi, atau pindah dana toko → pribadi.
- **Uang toko bertambah** = laba kas − dipakai pribadi + uang pribadi masuk toko + pinjaman + modal − cicilan. Diuji sama dengan perubahan saldo dompet toko.
