# Panduan pasang Sistem Toko Imanuel

Sistem ini terdiri dari tiga bagian:

| Bagian | Isinya | Tempatnya |
|---|---|---|
| Database | Semua data toko (transaksi, barang, nota, tagihan) | Google Sheets milik Anda (privat) |
| Server kecil | Penghubung web dengan Google Sheets, plus login | Apps Script yang menempel di Google Sheets itu |
| Web | Halaman yang dibuka di HP dan laptop | GitHub Pages, alamat `toko.imanuelfl.my.id` |

Data keuangan tidak pernah masuk GitHub. Yang ada di GitHub hanya kode tampilan.

Langkah 1–4 dikerjakan sekali saja, kira-kira 20 menit.

---

## 1. Buat database di Google Sheets

1. Buka [drive.google.com](https://drive.google.com) dengan akun Google toko.
2. Unggah file `data-keluaran/toko-imanuel-database.xlsx` (ada di folder `toko imanuel` di komputer).
3. Klik kanan file itu, pilih **Buka dengan → Google Spreadsheet**.
4. Di Google Sheets pilih **File → Simpan sebagai Google Spreadsheet**. Beri nama `toko-imanuel-database` dan simpan di folder **Data-keluaran** di Google Drive.
5. Hapus file `.xlsx` yang tadi diunggah, supaya tidak tertukar.

Periksa: ada 14 tab di bawah (pengguna, kategori, dompet, … transaksi, …). Tab `transaksi` berisi ±1.490 baris dari catatan uang 2025–2026.

## 2. Isi password

1. Buka tab **pengguna**.
2. Di baris `istri`, ganti kolom **nama** dengan nama istri Anda (nama pengguna untuk masuk tetap `istri`, atau ganti juga kolom **username** kalau mau).
3. Ketik password yang diinginkan di kolom **password_baru**, untuk Anda dan untuk istri.
4. Saat pertama kali masuk, sistem mengubah password itu menjadi kode acak (kolom hash) dan mengosongkan kolom password_baru.

Lupa password? Ketik password baru lagi di kolom **password_baru**, lalu masuk dengan password itu.

## 3. Pasang server (Apps Script)

1. Di Google Sheets database, pilih **Ekstensi → Apps Script**.
2. Hapus semua isi `Code.gs` yang ada, lalu tempel seluruh isi file `apps-script/Code.gs` dari folder ini. Klik **Simpan** (ikon disket).
3. Klik **Terapkan → Deployment baru**.
   - Klik ikon roda gigi di samping "Pilih jenis", pilih **Aplikasi web**.
   - **Jalankan sebagai:** Saya (akun Anda).
   - **Yang memiliki akses:** Siapa saja.
   - Klik **Terapkan**.
4. Google meminta izin. Pilih akun Anda, lalu klik **Lanjutan → Buka Toko Imanuel (tidak aman)**, lalu **Izinkan**. Peringatan ini muncul karena skripnya buatan sendiri, bukan dari toko aplikasi Google.
5. Salin **URL aplikasi web** (berakhiran `/exec`) dan kirim ke Claude. Claude akan menaruhnya di `docs/js/config.js`.

"Siapa saja" artinya halaman web bisa menghubungi server. Data tetap terkunci: setiap permintaan harus membawa tanda masuk dari login yang benar.

## 4. Pasang web di GitHub dan domain

1. Buat repo baru di GitHub, misalnya `toko-imanuel` (Public, karena GitHub Pages gratis hanya untuk repo publik). Isinya hanya kode, tanpa data keuangan.
2. Kirim alamat repo ke Claude untuk diunggah, atau unggah sendiri isi folder ini (file di `.gitignore` tidak ikut).
3. Di repo: **Settings → Pages**.
   - Source: **Deploy from a branch**. Branch: `main`, folder `/docs`. Simpan.
   - Custom domain: `toko.imanuelfl.my.id`. Simpan.
4. Di tempat Anda membeli domain `imanuelfl.my.id`, buka pengaturan DNS dan tambahkan:

   | Tipe | Nama/Host | Nilai |
   |---|---|---|
   | CNAME | `toko` | `<nama-akun-github>.github.io` |

   Ganti `<nama-akun-github>` dengan nama akun GitHub Anda.
5. Tunggu 10 menit sampai beberapa jam. Setelah GitHub menampilkan "DNS check successful", centang **Enforce HTTPS**.

## 5. Mulai memakai

1. Buka `https://toko.imanuelfl.my.id` di HP, lalu masuk.
2. Di menu browser pilih **Tambahkan ke layar utama**, supaya muncul ikon Toko Imanuel seperti aplikasi.
3. **Hari pertama, lakukan Tutup buku** (Laporan → Tutup buku): hitung uang di laci dan isi saldo asli setiap dompet, termasuk Fastpay. Saldo dari data lama tidak akurat karena dulu saldo digabung jadi satu, dan tutup buku pertama menyamakannya dengan saldo asli.
4. Setiap hari: catat uang keluar/masuk saat terjadi, dan isi **Tutup toko** saat toko tutup.
5. Setiap belanja dari supplier: isi **Nota belanja**.
6. Akhir bulan: **Tutup buku** untuk semua dompet sekaligus, atau ubah saldo satu dompet di **Laporan → Data induk → Dompet**. Keduanya mencatat selisihnya sebagai penyesuaian.

## Memperbarui server setelah ada perubahan

Kalau Claude mengubah `apps-script/Code.gs`:

1. Buka Apps Script, ganti isi `Code.gs` dengan versi baru, Simpan.
2. **Untuk foto barang:** di bilah atas editor, pilih fungsi `izinkanFoto` lalu klik **Jalankan**. Kalau Google meminta izin Google Drive, pilih akun Anda → **Lanjutan → Buka Toko Imanuel (tidak aman)** → **Izinkan**. Fungsi ini memastikan folder **Toko Imanuel - Foto barang** ada di folder yang sama dengan file database. Kalau belum, folder itu dipindahkan ke sana. Lokasinya tertulis di **Log eksekusi**.
3. **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan**.

Alamat `/exec` tetap sama, jadi web tidak perlu diubah.

Susunan di Google Drive:

```
My Drive
└── Data-keluaran
    ├── toko-imanuel-database      (Google Sheets: database + Apps Script)
    └── Toko Imanuel - Foto barang (foto barang)
```

Server mengenali folder foto dari ID-nya, jadi folder Data-keluaran boleh dipindah atau diganti nama. Jangan hapus folder foto. Foto barang disimpan dengan akses "siapa saja yang punya tautan bisa melihat", supaya bisa tampil di web. Hanya foto barang yang ada di sana, bukan data keuangan.

Kolom baru di tab `barang` (satuan_2, isi_2, … , foto) ditambahkan otomatis oleh server saat pertama kali menyimpan barang. Kolom lama `kelompok` dan tab `kelompok` tidak dipakai lagi dan boleh dibiarkan.

## Mencoba di komputer tanpa server

```bash
node tools/serve.js
```

Lalu buka `http://localhost:8787/docs/?demo=/data-keluaran/data.json`. Mode demo memakai salinan data di browser saja, jadi aman untuk mencoba.
