// Bagian B lanjutan: tutup buku, perjalanan, tagihan, data induk, akun.
import { S, simpan, idBaru, kat, dom, namaPengguna, pengaturan } from "../data.js";
import { saldoDompet, statusTagihan, bulanIni, hariIni, geserBulan, akhirBulan, angka, aktif, ringkasBulan } from "../hitung.js";
import { esc, rp, titik, namaBulan, namaBulanPendek, tglPendek, toast, tanya, formDialog, pasangUang, tagPos, kartuTransaksi } from "../ui.js";
import { api } from "../api.js";
import { keluar } from "../app.js";

// ---------- B3 Tutup buku ----------
export function tutupBuku(main, _, q) {
  const bulan = q.bulan || bulanIni();
  const tanggal = bulan === bulanIni() ? hariIni() : akhirBulan(bulan);
  const saldo = saldoDompet(S.data, tanggal);
  const sudah = S.data.tutup_buku.filter(x => x.bulan === bulan);
  const dompet = S.data.dompet.filter(d => d.aktif);
  main.innerHTML = `
    <div class="baris"><h2>${namaBulan(bulan)}</h2><span class="small muted">saldo per ${tglPendek(tanggal)}</span></div>
    ${sudah.length ? `<div class="catatan ok">Bulan ini sudah ditutup ${tglPendek(String(sudah[0].dibuat).slice(0, 10))} oleh ${esc(namaPengguna(sudah[0].oleh))}. Menyimpan lagi akan menambah penyesuaian baru bila masih ada selisih.</div>` : ""}
    <div class="catatan info"><b>Cara mengisi</b><span>Untuk Cash Toko, hitung uang di laci. Untuk dompet lain, lihat saldo di aplikasi bank atau aplikasi Fastpay. Kosongkan dompet yang tidak mau dicek.</span></div>
    <form class="kartu" id="form"><div class="tabel"><table>
      <thead><tr><th>Dompet</th><th class="num">Menurut catatan</th><th class="num">Saldo asli</th><th class="num">Selisih</th></tr></thead>
      <tbody>${dompet.map(d => `<tr data-d="${esc(d.id)}"><td>${esc(d.nama)} ${tagPos(d.pemilik)}${d.tipe === "fastpay" ? '<div class="tiny muted">wajib: dipakai menghitung laba</div>' : ""}</td><td class="num">${rp(saldo[d.id] || 0)}</td><td class="num"><input class="input uang" inputmode="numeric" style="min-width:130px;text-align:right" placeholder="isi"></td><td class="num" data-sel>–</td></tr>`).join("")}</tbody>
    </table></div>
    <div id="ringkas" class="catatan info hidden"></div>
    <button class="tombol blok" id="simpan">Simpan tutup buku</button></form>
    <p class="tiny muted">Selisih Fastpay dicatat sebagai pemakaian saldo Fastpay (biaya layanan toko). Selisih dompet lain dicatat sebagai "Penyesuaian saldo" dan tidak dihitung ke laba. Tutup buku pertama kali menyamakan saldo catatan dengan saldo asli.</p>`;
  pasangUang(main);
  const f = main.querySelector("#form");
  const hitung = () => {
    let total = 0, ada = 0;
    f.querySelectorAll("tr[data-d]").forEach(tr => {
      const inp = tr.querySelector("input"), sel = tr.querySelector("[data-sel]");
      if (!inp.value.trim()) { sel.textContent = "–"; sel.className = "num"; return; }
      const d = angka(inp.value) - (saldo[tr.dataset.d] || 0);
      ada++; if (dom(tr.dataset.d).tipe !== "fastpay") total += d;
      sel.textContent = d === 0 ? "cocok" : (d > 0 ? "+" : "−") + titik(d);
      sel.className = "num " + (d === 0 ? "plus" : d < 0 ? "minus" : "");
    });
    const box = f.querySelector("#ringkas");
    box.classList.toggle("hidden", !ada);
    box.innerHTML = `<b>${ada} dompet diisi</b><span>Total selisih (tanpa Fastpay): ${total === 0 ? "cocok semua" : (total > 0 ? "+" : "−") + rp(Math.abs(total))}</span>`;
  };
  f.addEventListener("input", hitung);
  f.onsubmit = async e => {
    e.preventDefault();
    const ops = [];
    f.querySelectorAll("tr[data-d]").forEach(tr => {
      const inp = tr.querySelector("input"); if (!inp.value.trim()) return;
      const d = dom(tr.dataset.d), asli = angka(inp.value), sistem = Math.round(saldo[d.id] || 0), sel = asli - sistem;
      let tId = "";
      if (sel !== 0) {
        tId = idBaru("T");
        const fp = d.tipe === "fastpay";
        ops.push({ tabel: "transaksi", simpan: { id: tId, tanggal, jenis: sel < 0 ? "keluar" : "masuk", kategori: fp && sel < 0 ? "pemakaian-fastpay" : "penyesuaian", dompet: d.id, dompet_tujuan: "", nominal: Math.abs(sel), keterangan: fp && sel < 0 ? `Pemakaian saldo Fastpay ${namaBulan(bulan)}` : `Penyesuaian saldo ${d.nama} (tutup buku ${namaBulanPendek(bulan)})`, perjalanan: "", tagihan: "", nota: "", sumber: "tutup-buku", catatan: `catatan ${sistem}, asli ${asli}`, hapus: false } });
      }
      ops.push({ tabel: "tutup_buku", simpan: { id: idBaru("K"), bulan, dompet: d.id, saldo_sistem: sistem, saldo_asli: asli, selisih: sel, transaksi: tId, oleh: S.user, dibuat: new Date().toISOString() } });
    });
    if (!ops.length) return toast("Isi saldo asli minimal satu dompet.", true);
    // Kategori penyesuaian "masuk": pakai jenis masuk dengan kategori penyesuaian
    const b = f.querySelector("#simpan"); b.disabled = true; b.textContent = "Menyimpan…";
    try { await simpan(ops); toast("Tutup buku tersimpan"); location.hash = "#/dashboard"; }
    catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Simpan tutup buku"; }
  };
}

// ---------- B5 Perjalanan ----------
export function perjalanan(main) {
  const list = S.data.perjalanan.slice().sort((a, b) => (a.mulai < b.mulai ? 1 : -1));
  const ringkas = p => {
    const tx = S.data.transaksi.filter(t => aktif(t) && t.perjalanan === p.id && t.jenis === "keluar");
    const toko = tx.filter(t => kat(t.kategori).pos === "toko").reduce((s, t) => s + angka(t.nominal), 0);
    const pribadi = tx.filter(t => kat(t.kategori).pos === "pribadi").reduce((s, t) => s + angka(t.nominal), 0);
    return { tx, toko, pribadi };
  };
  main.innerHTML = `
    <div class="baris"><p class="small muted">Tandai pengeluaran selama perjalanan supaya totalnya terkumpul di sini. Kategori tetap biasa.</p><button class="tombol" id="baru">＋ Mulai perjalanan</button></div>
    ${list.map(p => { const r = ringkas(p); return `<div class="kartu">
      <h3><span>${esc(p.nama)}</span><span class="small muted" style="font-family:var(--body);font-weight:500">${tglPendek(p.mulai)}${p.selesai ? " – " + tglPendek(p.selesai) : " · sedang berjalan"}</span></h3>
      <div class="grid4"><div class="kpi"><span class="k">Total</span><span class="v">${rp(r.toko + r.pribadi)}</span><span class="small muted">${r.tx.length} catatan</span></div><div class="kpi"><span class="k">Urusan toko</span><span class="v" style="color:var(--toko)">${rp(r.toko)}</span></div><div class="kpi"><span class="k">Pribadi</span><span class="v" style="color:var(--pribadi)">${rp(r.pribadi)}</span></div></div>
      <details><summary class="small">Lihat catatan</summary><div class="daftar" style="margin-top:8px">${r.tx.map(t => kartuTransaksi(t, { namaPengguna })).join("") || '<p class="small muted">Belum ada catatan.</p>'}</div></details>
      <div class="baris"><button class="link" data-ubah="${esc(p.id)}">Ubah</button>${!p.selesai ? `<button class="tombol garis kecil" data-selesai="${esc(p.id)}">Selesaikan hari ini</button>` : ""}</div>
    </div>`; }).join("") || '<div class="kartu"><p class="muted">Belum ada perjalanan. Tekan "Mulai perjalanan" sebelum berangkat, misalnya ke Ambon.</p></div>'}
    <div class="catatan info"><b>Toko atau pribadi?</b><span>Kalau tujuannya belanja barang atau urusan toko, ongkos jalan dan angkut barang pakai kategori "Perjalanan urusan toko". Makan, wisata, dan oleh-oleh pakai kategori pribadi.</span></div>`;
  const ubah = async p => {
    const r = await formDialog(p ? "Ubah perjalanan" : "Mulai perjalanan", [
      { id: "nama", label: "Nama perjalanan", value: p ? p.nama : "Ambon " + tglPendek(hariIni()), placeholder: "misalnya: Ambon 12–14 Nov" },
      { id: "mulai", label: "Mulai", type: "date", value: p ? p.mulai : hariIni() },
      { id: "selesai", label: "Selesai (kosongkan kalau belum)", type: "date", value: p ? p.selesai : "" },
      { id: "catatan", label: "Catatan", value: p ? p.catatan : "" }
    ]);
    if (!r || !r.nama) return;
    try { await simpan([{ tabel: "perjalanan", simpan: { ...(p || {}), id: p ? p.id : idBaru("P"), ...r, dibuat: p ? p.dibuat : new Date().toISOString() } }]); toast("Perjalanan tersimpan"); perjalanan(main); }
    catch (e) { toast(e.message, true); }
  };
  main.querySelector("#baru").onclick = () => ubah(null);
  main.onclick = async e => {
    const u = e.target.closest("[data-ubah]"); if (u) return ubah(S.data.perjalanan.find(p => p.id === u.dataset.ubah));
    const s = e.target.closest("[data-selesai]");
    if (s) { const p = S.data.perjalanan.find(x => x.id === s.dataset.selesai); try { await simpan([{ tabel: "perjalanan", simpan: { ...p, selesai: hariIni() } }]); perjalanan(main); } catch (err) { toast(err.message, true); } }
  };
}

// ---------- B6 Tagihan rutin ----------
export function tagihan(main, _, q) {
  const bulan = q.bulan || bulanIni();
  const list = statusTagihan(S.data, bulan);
  const lunas = list.filter(t => t.status === "lunas").length, belum = list.filter(t => ["lewat", "dekat", "belum"].includes(t.status)).length;
  const label = t => t.status === "lunas" ? `<span class="st ok">Lunas ${tglPendek(t.bayar[0].tanggal)}</span>` : t.status === "lewat" ? `<span class="st bad">Lewat ${-t.selisihHari} hari</span>` : t.status === "dekat" ? `<span class="st warn">${t.selisihHari === 0 ? "Hari ini" : t.selisihHari + " hari lagi"}</span>` : t.status === "tidak-tetap" ? '<span class="st grey">Tidak tetap</span>' : `<span class="st grey">Tgl ${t.tgl}</span>`;
  main.innerHTML = `
    <div class="baris"><h2>${namaBulan(bulan)}</h2><span><span class="st ok">${lunas} lunas</span> <span class="st bad">${belum} belum</span></span></div>
    <div class="kartu"><div class="tabel"><table>
      <thead><tr><th>Tagihan</th><th>Tgl</th><th class="num">Nominal</th><th>Pos</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(t => `<tr><td>${esc(t.nama)}${t.nomor ? `<div class="tiny muted">${esc(t.nomor)}</div>` : ""}</td><td>${angka(t.tgl) || "–"}</td><td class="num">${angka(t.nominal) ? titik(t.nominal) : "–"}</td><td>${tagPos(kat(t.kategori).pos)}</td><td>${label(t)}</td>
        <td class="num">${t.status !== "lunas" ? `<a class="tombol kecil" href="#/catat/keluar?tagihan=${encodeURIComponent(t.id)}&kategori=${encodeURIComponent(t.kategori)}&dompet=${encodeURIComponent(t.dompet)}&nominal=${angka(t.nominal)}&ket=${encodeURIComponent(t.nama)}">Bayar</a>` : ""} <button class="link small" data-ubah="${esc(t.id)}">Ubah</button></td></tr>`).join("")}</tbody>
    </table></div><button class="tombol garis" id="baru">＋ Tagihan baru</button></div>
    <p class="tiny muted">Status otomatis jadi lunas kalau di Catat uang Anda memilih tagihan ini. Kategori menentukan apakah tagihan masuk hitungan toko atau pribadi.</p>`;
  const ubah = async t => {
    const r = await formDialog(t ? "Ubah tagihan" : "Tagihan baru", [
      { id: "nama", label: "Nama", value: t ? t.nama : "" },
      { id: "tgl", label: "Tanggal jatuh tempo (1–31, kosong = tidak tetap)", type: "number", value: t ? t.tgl : "" },
      { id: "nominal", label: "Nominal biasa", type: "uang", value: t ? t.nominal : "" },
      { id: "kategori", label: "Kategori", type: "select", value: t ? t.kategori : "tagihan-rumah", options: S.data.kategori.filter(k => k.jenis === "keluar").map(k => ({ value: k.id, label: `${k.nama} (${k.pos})` })) },
      { id: "dompet", label: "Biasanya dibayar dari", type: "select", value: t ? t.dompet : "fastpay", options: S.data.dompet.map(d => ({ value: d.id, label: d.nama })) },
      { id: "nomor", label: "Nomor pelanggan", value: t ? t.nomor : "" },
      { id: "aktif", label: "Aktif", type: "checkbox", value: t ? t.aktif : true }
    ]);
    if (!r || !r.nama) return;
    try { await simpan([{ tabel: "tagihan", simpan: { ...(t || {}), id: t ? t.id : idBaru("G"), ...r, tgl: angka(r.tgl), urutan: t ? t.urutan : S.data.tagihan.length + 1 } }]); toast("Tagihan tersimpan"); tagihan(main, _, q); }
    catch (e) { toast(e.message, true); }
  };
  main.querySelector("#baru").onclick = () => ubah(null);
  main.querySelectorAll("[data-ubah]").forEach(b => (b.onclick = () => ubah(S.data.tagihan.find(t => t.id === b.dataset.ubah))));
}

// ---------- B7 Data induk ----------
export function dataInduk(main, _, q) {
  let tab = q.tab || "kategori", bulan = bulanIni(), cari = "";
  const TABS = [["kategori", "Kategori"], ["dompet", "Dompet"], ["supplier", "Supplier"], ["barang", "Barang"], ["kelompok", "Persen untung"], ["pengguna", "Pengguna"]];
  const gambar = () => {
    let isi = "";
    if (tab === "kategori") {
      const pakai = {}, semua = {};
      S.data.transaksi.forEach(t => { if (!aktif(t)) return; semua[t.kategori] = (semua[t.kategori] || 0) + 1; if (bulan === "semua" || String(t.tanggal).startsWith(bulan)) pakai[t.kategori] = (pakai[t.kategori] || 0) + 1; });
      isi = `<div class="baris"><div class="chips" id="pb"><button data-v="${bulanIni()}" class="${bulan !== "semua" ? "on" : ""}">${namaBulan(bulanIni())}</button><button data-v="semua" class="${bulan === "semua" ? "on" : ""}">Semua waktu</button></div><button class="tombol kecil" data-baru>＋ Kategori</button></div>
        <div class="tabel"><table><thead><tr><th>Kategori</th><th>Jenis</th><th>Pos</th><th class="num">Dipakai</th><th>Aktif</th><th></th></tr></thead><tbody>
        ${S.data.kategori.filter(k => k.peran !== "pindah").map(k => `<tr class="${k.aktif ? "" : "muted"}"><td>${esc(k.nama)}</td><td>${esc(k.jenis)}</td><td>${tagPos(k.pos)}</td><td class="num">${pakai[k.id] || 0} kali</td><td>${k.aktif ? "ya" : "tidak"}</td><td><button class="link small" data-ubah="${esc(k.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div><p class="tiny muted">"Dipakai" dihitung dari buku kas untuk pilihan di atas, tidak pernah direset. Kategori yang tidak dipakai lagi cukup dimatikan, transaksi lamanya tetap aman. Mengubah Pos (toko/pribadi) langsung mengubah hitungan semua bulan.</p>`;
    } else if (tab === "dompet") {
      const s = saldoDompet(S.data);
      isi = `<div class="baris"><span></span><button class="tombol kecil" data-baru>＋ Dompet</button></div><div class="tabel"><table><thead><tr><th>Dompet</th><th>Pemilik</th><th>Jenis</th><th class="num">Saldo catatan</th><th>Aktif</th><th></th></tr></thead><tbody>
        ${S.data.dompet.map(d => `<tr class="${d.aktif ? "" : "muted"}"><td>${esc(d.nama)}</td><td>${tagPos(d.pemilik)}</td><td>${esc(d.tipe)}</td><td class="num">${rp(s[d.id] || 0)}</td><td>${d.aktif ? "ya" : "tidak"}</td><td><button class="link small" data-ubah="${esc(d.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div><p class="tiny muted">Pemilik dompet adalah dasar pemisahan uang toko dan pribadi.</p>`;
    } else if (tab === "supplier") {
      isi = `<div class="baris"><span></span><button class="tombol kecil" data-baru>＋ Supplier</button></div><div class="tabel"><table><thead><tr><th>Supplier</th><th>Kelompok</th><th class="num">Nota</th><th>Aktif</th><th></th></tr></thead><tbody>
        ${S.data.supplier.map(s => `<tr class="${s.aktif ? "" : "muted"}"><td>${esc(s.nama)}</td><td>${esc(s.kelompok)}</td><td class="num">${S.data.nota.filter(n => n.supplier === s.id).length}</td><td>${s.aktif ? "ya" : "tidak"}</td><td><button class="link small" data-ubah="${esc(s.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div>`;
    } else if (tab === "barang") {
      const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
      const list = S.data.barang.filter(b => kata.every(k => String(b.nama).toLowerCase().includes(k))).slice(0, 150);
      const kel = id => (S.data.kelompok.find(k => k.id === id) || {}).nama || id;
      isi = `<input class="input" id="cari-barang" placeholder="Cari barang…" value="${esc(cari)}"><div class="tabel"><table><thead><tr><th>Barang</th><th>Kelompok</th><th class="num">Modal</th><th class="num">Harga jual</th><th class="num">Untung</th><th></th></tr></thead><tbody>
        ${list.map(b => { const u = angka(b.harga_jual) && angka(b.modal) ? Math.round(((angka(b.harga_jual) - angka(b.modal)) / angka(b.modal)) * 100) : null; return `<tr class="${b.aktif ? "" : "muted"}"><td>${esc(b.nama)}<div class="tiny muted">per ${esc(b.satuan_jual)} · beli per ${esc(b.satuan_beli)} isi ${b.isi}</div></td><td>${esc(kel(b.kelompok))}</td><td class="num">${titik(b.modal)}</td><td class="num">${angka(b.harga_jual) ? titik(b.harga_jual) : "–"}</td><td class="num ${u !== null && u < 15 ? "minus" : ""}">${u === null ? "–" : u + "%"}</td><td><button class="link small" data-ubah="${esc(b.id)}">Ubah</button></td></tr>`; }).join("")}
        </tbody></table></div><p class="tiny muted">Menampilkan ${list.length} dari ${S.data.barang.length} barang.</p>`;
    } else if (tab === "kelompok") {
      isi = `<div class="tabel"><table><thead><tr><th>Kelompok</th><th class="num">Persen untung untuk saran harga</th><th class="num">Barang</th><th></th></tr></thead><tbody>
        ${S.data.kelompok.map(k => `<tr><td>${esc(k.nama)}</td><td class="num">${k.markup}%</td><td class="num">${S.data.barang.filter(b => b.kelompok === k.id).length}</td><td><button class="link small" data-ubah="${esc(k.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div><p class="tiny muted">Saran harga jual = modal + persen ini, dibulatkan ke atas ke Rp${titik(pengaturan("pembulatan_harga", 500))}.</p>`;
    } else if (tab === "pengguna") {
      isi = `<div class="tabel"><table><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Hak</th></tr></thead><tbody>${S.data.pengguna.map(u => `<tr><td>${esc(u.nama)}</td><td>${esc(u.username)}</td><td><span class="st ok">Admin</span></td></tr>`).join("")}</tbody></table></div>
        <p class="tiny muted">Pengguna dan password diatur di tab "pengguna" pada Google Sheets database (lihat PANDUAN-PASANG.md). Ubah password sendiri lewat menu Akun.</p>`;
    }
    main.innerHTML = `<div class="tabs" id="tabs">${TABS.map(([v, l]) => `<button data-v="${v}" class="${v === tab ? "on" : ""}">${l}</button>`).join("")}</div><div class="kartu">${isi}</div>`;
    main.querySelector("#tabs").onclick = e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.v; gambar(); } };
    const pb = main.querySelector("#pb"); if (pb) pb.onclick = e => { const b = e.target.closest("button"); if (b) { bulan = b.dataset.v; gambar(); } };
    const cb = main.querySelector("#cari-barang"); if (cb) { cb.oninput = () => { cari = cb.value; const pos = cb.selectionStart; gambar(); const n = main.querySelector("#cari-barang"); n.focus(); n.setSelectionRange(pos, pos); }; }
    const baru = main.querySelector("[data-baru]"); if (baru) baru.onclick = () => ubah(null);
    main.querySelectorAll("[data-ubah]").forEach(b => (b.onclick = () => ubah(S.data[tab].find(x => x.id === b.dataset.ubah))));
  };
  const ubah = async row => {
    const ya = [{ value: "true", label: "Ya" }, { value: "false", label: "Tidak" }];
    let fields, buat;
    if (tab === "kategori") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, ...(row ? [] : [{ id: "jenis", label: "Jenis", type: "select", value: "keluar", options: [{ value: "keluar", label: "Uang keluar" }, { value: "masuk", label: "Uang masuk" }] }]),
        ...(row && ["pindah", "penyesuaian"].includes(row.peran) ? [] : [{ id: "pos", label: "Pos", type: "select", value: row ? row.pos : "pribadi", options: [{ value: "toko", label: "Toko" }, { value: "pribadi", label: "Pribadi" }] }]),
        { id: "aktif", label: "Aktif", type: "checkbox", value: row ? row.aktif : true }];
      buat = r => ({ id: idBaru("K"), peran: r.jenis === "masuk" ? "pendapatan" : "biaya", urutan: S.data.kategori.length + 1, ...r });
    } else if (tab === "dompet") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, { id: "pemilik", label: "Pemilik", type: "select", value: row ? row.pemilik : "toko", options: [{ value: "toko", label: "Toko" }, { value: "pribadi", label: "Pribadi" }] }, { id: "aktif", label: "Aktif", type: "checkbox", value: row ? row.aktif : true }];
      buat = r => ({ id: idBaru("D"), tipe: "bank", urutan: S.data.dompet.length + 1, ...r });
    } else if (tab === "supplier") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, { id: "kelompok", label: "Kelompok", type: "select", value: row ? row.kelompok : "Perabot", options: S.data.kelompok.map(k => ({ value: k.nama, label: k.nama })) }, { id: "aktif", label: "Aktif", type: "checkbox", value: row ? row.aktif : true }];
      buat = r => ({ id: idBaru("S"), urutan: S.data.supplier.length + 1, ...r });
    } else if (tab === "barang") {
      if (!row) return;
      fields = [{ id: "nama", label: "Nama", value: row.nama }, { id: "kelompok", label: "Kelompok", type: "select", value: row.kelompok, options: S.data.kelompok.map(k => ({ value: k.id, label: k.nama })) }, { id: "harga_jual", label: "Harga jual", type: "uang", value: row.harga_jual }, { id: "satuan_jual", label: "Satuan jual", value: row.satuan_jual }, { id: "modal", label: "Modal per satuan jual", type: "uang", value: row.modal }, { id: "aktif", label: "Aktif", type: "checkbox", value: row.aktif }];
    } else if (tab === "kelompok") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, { id: "markup", label: "Persen untung (%)", type: "number", value: row ? row.markup : 30 }];
    }
    void ya;
    const r = await formDialog(row ? "Ubah" : "Tambah", fields);
    if (!r || ("nama" in r && !r.nama)) return;
    if ("markup" in r) r.markup = angka(r.markup);
    const baris = row ? { ...row, ...r, ...(tab === "barang" && angka(r.harga_jual) !== angka(row.harga_jual) ? { harga_diubah: hariIni() } : {}) } : buat(r);
    try { await simpan([{ tabel: tab, simpan: baris }]); toast("Tersimpan"); gambar(); }
    catch (e) { toast(e.message, true); }
  };
  gambar();
}

// ---------- Akun ----------
export function akun(main) {
  main.innerHTML = `
    <div class="kartu"><h3>Masuk sebagai ${esc(S.nama)} (${esc(S.user)})</h3>
      <form class="tumpuk" id="pw">
        <div class="isian"><label for="lama">Password lama</label><input class="input" type="password" id="lama" autocomplete="current-password" required></div>
        <div class="isian"><label for="baru">Password baru (minimal 6 karakter)</label><input class="input" type="password" id="baru" autocomplete="new-password" minlength="6" required></div>
        <button class="tombol">Ubah password</button>
      </form>
    </div>
    <button class="tombol hapus blok" id="keluar">Keluar dari aplikasi</button>`;
  main.querySelector("#pw").onsubmit = async e => {
    e.preventDefault();
    try { await api.ubahPassword(main.querySelector("#lama").value, main.querySelector("#baru").value); toast("Password diubah"); e.target.reset(); }
    catch (err) { toast(err.message, true); }
  };
  main.querySelector("#keluar").onclick = async () => { if (await tanya("Keluar?", "Data tersimpan di HP ini akan dihapus. Masuk lagi dengan password.", "Keluar")) keluar(); };
}
