// Bagian B lanjutan: tutup buku, perjalanan, tagihan, data induk, akun.
import { S, simpan, idBaru, kat, dom, namaPengguna, unggahFoto } from "../data.js";
import { saldoDompet, statusTagihan, bulanIni, hariIni, akhirBulan, angka, aktif, satukanNama, kunciNama, lapisan, isiTotal, kolomLapisan, teksLapisan } from "../hitung.js";
import { esc, rp, rpTanda, titik, namaBulan, namaBulanPendek, tglPendek, toast, tanya, formDialog, pasangUang, tagPos, kartuTransaksi, isian, fotoUrl, lihatFoto, htmlFoto, pasangFoto, htmlLapisan, segarkanLapisan, DAFTAR_SATUAN } from "../ui.js";
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
      const d = dom(tr.dataset.d);
      ops.push(...opsCocokkanSaldo(d, angka(inp.value), Math.round(saldo[d.id] || 0), tanggal));
    });
    if (!ops.length) return toast("Isi saldo asli minimal satu dompet.", true);
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
// Barang tampil seperti sheet "Belanja Toko": per supplier dan tahun beli, satu baris per nama (pembelian terakhir).
// Tahun nota: dari tanggal, atau dari nama file sheet asal untuk nota impor tanpa tanggal ("Belanja Toko 2026").
const tahunNota = n => String(n.tanggal || "").slice(0, 4) || (String(n.catatan || "").match(/\b(20\d\d)\b/) || [])[1] || "-";
function barisBarang({ supplier, tahun, cari, saring }) {
  const nota = new Map(S.data.nota.map(n => [n.id, n]));
  const wakil = new Map(satukanNama(S.data.barang).map(b => [kunciNama(b.nama), b]));
  const perId = new Map(S.data.barang.map(b => [b.id, b]));
  const grup = new Map();
  for (const it of S.data.nota_item) {
    const n = nota.get(it.nota); if (!n) continue;
    const tgl = String(n.tanggal || "");
    if (supplier && n.supplier !== supplier) continue;
    if (tahun !== "semua" && tahunNota(n) !== tahun) continue;
    const kunci = n.supplier + "|" + kunciNama(it.nama);
    const g = grup.get(kunci);
    const beli = { ...it, tanggal: tgl, tahun: tahunNota(n), supplier: n.supplier };
    if (!g) grup.set(kunci, { beli, kali: 1 });
    else { g.kali++; if (tgl > g.beli.tanggal || (tgl === g.beli.tanggal && String(it.id) > String(g.beli.id))) g.beli = beli; }
  }
  let rows = [...grup.values()].map(({ beli, kali }) => {
    const b = wakil.get(kunciNama(beli.nama)) || perId.get(beli.barang) || null;
    return { b, nama: beli.nama, supplier: beli.supplier, tanggal: beli.tanggal, tahun: beli.tahun, kali, qty: angka(beli.qty), satuan: beli.satuan, isi: angka(beli.isi) || 1, harga: angka(beli.harga), total: angka(beli.total) || angka(beli.qty) * angka(beli.harga), modal: angka(beli.modal) };
  });
  // Barang yang belum pernah ada di nota (ditambah manual) tampil di "Semua tahun"
  if (tahun === "semua") {
    const ada = new Set(rows.map(r => r.supplier + "|" + kunciNama(r.nama)));
    for (const b of wakil.values()) {
      if (supplier && b.supplier !== supplier) continue;
      if ([...b._kembar].some(id => { const x = perId.get(id); return x && ada.has(x.supplier + "|" + kunciNama(x.nama)); })) continue;
      const L = lapisan(b);
      rows.push({ b, nama: b.nama, supplier: b.supplier, tanggal: "", kali: 0, qty: 0, satuan: L[0].satuan, isi: isiTotal(L), harga: angka(b.modal) * isiTotal(L), total: 0, modal: angka(b.modal) });
    }
  }
  const kata = kunciNama(cari).split(" ").filter(Boolean);
  if (kata.length) rows = rows.filter(r => { const k = kunciNama(r.nama); return kata.every(w => k.includes(w)); });
  if (saring === "harga") rows = rows.filter(r => !(r.b && angka(r.b.harga_jual) > 0));
  if (saring === "foto") rows = rows.filter(r => !(r.b && r.b.foto));
  const urut = new Map(S.data.supplier.map((s, i) => [s.id, angka(s.urutan) || i + 1]));
  rows.sort((a, b) => (urut.get(a.supplier) || 999) - (urut.get(b.supplier) || 999) || String(a.nama).localeCompare(String(b.nama), "id", { sensitivity: "base" }));
  return rows;
}

export function dataInduk(main, _, q) {
  let tab = q.tab || "kategori", bulan = bulanIni(), cari = "", saring = "", supplier = q.supplier || "";
  const TAHUN = [...new Set(S.data.nota.map(tahunNota))].sort().reverse();
  let tahun = q.tahun || (TAHUN.includes(bulanIni().slice(0, 4)) ? bulanIni().slice(0, 4) : TAHUN.find(t => t !== "-") || "semua");
  if (!["kategori", "dompet", "supplier", "barang", "pengguna"].includes(tab)) tab = "kategori";
  const TABS = [["kategori", "Kategori"], ["dompet", "Dompet"], ["supplier", "Supplier"], ["barang", "Barang"], ["pengguna", "Pengguna"]];
  const supNama = id => (S.data.supplier.find(s => s.id === id) || {}).nama || "Tanpa supplier";

  const gambarBarang = () => {
    const rows = barisBarang({ supplier, tahun, cari, saring });
    let lalu = null, html = "";
    for (const r of rows) {
      if (!supplier && r.supplier !== lalu) { lalu = r.supplier; html += `<tr class="grup"><td colspan="9">${esc(supNama(r.supplier))}</td></tr>`; }
      const b = r.b, src = b ? fotoUrl(b.foto, 120) : "", jual = b ? angka(b.harga_jual) : 0, lap = b ? teksLapisan(lapisan(b)) : "";
      html += `<tr class="klik ${b && !b.aktif ? "muted" : ""}" data-barang="${esc(b ? b.id : "")}" data-kembar="${esc(b ? b._kembar.join(",") : "")}">
        <td><span class="foto-kecil ${src ? "" : "kosong"}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : "📷"}</span></td>
        <td class="num">${r.qty ? titik(r.qty) : ""}</td><td>${esc(r.satuan || "")}</td><td class="num" ${lap ? `title="${esc(lap)}"` : ""}>${titik(r.isi)}</td>
        <td><b>${esc(r.nama)}</b><div class="tiny muted">${r.tanggal ? `dibeli ${tglPendek(r.tanggal)}${tahun === "semua" ? " " + r.tanggal.slice(0, 4) : ""}${r.kali > 1 ? ` · ${r.kali}× beli` : ""}` : r.kali ? `tanpa tanggal${tahun === "semua" && r.tahun !== "-" ? " (" + r.tahun + ")" : ""}${r.kali > 1 ? ` · ${r.kali}× beli` : ""}` : "belum ada nota"}${lap && lap.split("=").length > 2 ? " · " + esc(lap) : ""}</div></td>
        <td class="num">${r.harga ? rp(r.harga) : ""}</td><td class="num">${r.total ? rp(r.total) : ""}</td><td class="num">${r.modal ? rp(r.modal) : ""}</td>
        <td class="num"><b>${jual ? rp(jual) : ""}</b></td>
      </tr>`;
    }
    main.querySelector("#rows-barang").innerHTML = html || '<tr><td colspan="9" class="muted">Tidak ada barang yang cocok.</td></tr>';
    main.querySelector("#jumlah-barang").textContent = `${titik(rows.length)} barang · ${supplier ? supNama(supplier) : "semua supplier"} · ${tahun === "semua" ? "semua tahun" : tahun === "-" ? "tanpa tanggal" : tahun}`;
  };

  const gambar = () => {
    let isi = "";
    if (tab === "kategori") {
      const pakai = {};
      S.data.transaksi.forEach(t => { if (!aktif(t)) return; if (bulan === "semua" || String(t.tanggal).startsWith(bulan)) pakai[t.kategori] = (pakai[t.kategori] || 0) + 1; });
      isi = `<div class="baris"><div class="chips" id="pb"><button data-v="${bulanIni()}" class="${bulan !== "semua" ? "on" : ""}">${namaBulan(bulanIni())}</button><button data-v="semua" class="${bulan === "semua" ? "on" : ""}">Semua waktu</button></div><button class="tombol kecil" data-baru>＋ Kategori</button></div>
        <div class="tabel"><table><thead><tr><th>Kategori</th><th>Jenis</th><th>Pos</th><th class="num">Dipakai</th><th>Aktif</th><th></th></tr></thead><tbody>
        ${S.data.kategori.filter(k => k.peran !== "pindah").map(k => `<tr class="${k.aktif ? "" : "muted"}"><td>${esc(k.nama)}</td><td>${esc(k.jenis)}</td><td>${tagPos(k.pos)}</td><td class="num">${pakai[k.id] || 0} kali</td><td>${k.aktif ? "ya" : "tidak"}</td><td><button class="link small" data-ubah="${esc(k.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div><p class="tiny muted">"Dipakai" dihitung dari buku kas untuk pilihan di atas, tidak pernah direset. Kategori yang tidak dipakai lagi cukup dimatikan, transaksi lamanya tetap aman. Mengubah Pos (toko/pribadi) langsung mengubah hitungan semua bulan.</p>`;
    } else if (tab === "dompet") {
      const s = saldoDompet(S.data, hariIni());
      const cocok = id => S.data.tutup_buku.filter(x => x.dompet === id).sort((a, b) => (String(a.dibuat) < String(b.dibuat) ? 1 : -1))[0];
      const jumlah = p => S.data.dompet.filter(d => d.aktif && d.pemilik === p).reduce((t, d) => t + (s[d.id] || 0), 0);
      isi = `<div class="baris"><span class="small">Toko <b>${rp(jumlah("toko"))}</b> · Pribadi <b>${rp(jumlah("pribadi"))}</b></span><button class="tombol kecil" data-baru>＋ Dompet</button></div>
        <div class="tabel"><table><thead><tr><th>Dompet</th><th>Pemilik</th><th>Jenis</th><th class="num">Saldo</th><th>Terakhir dicocokkan</th><th></th></tr></thead><tbody>
        ${S.data.dompet.map(d => { const c = cocok(d.id); return `<tr class="klik ${d.aktif ? "" : "muted"}" data-ubah="${esc(d.id)}"><td>${esc(d.nama)}${d.aktif ? "" : ' <span class="st grey">tidak dipakai</span>'}</td><td>${tagPos(d.pemilik)}</td><td>${esc(d.tipe)}</td><td class="num ${(s[d.id] || 0) < 0 ? "minus" : ""}"><b>${rp(s[d.id] || 0)}</b></td><td class="small">${c ? `${tglPendek(String(c.dibuat).slice(0, 10))}${angka(c.selisih) ? ` <span class="muted">(selisih ${rpTanda(c.selisih)})</span>` : ' <span class="st ok">cocok</span>'}` : '<span class="muted">belum</span>'}</td><td><button class="link small" data-ubah="${esc(d.id)}">Ubah saldo</button></td></tr>`; }).join("")}
        </tbody></table></div>
        <p class="tiny muted">Saldo dihitung dari semua catatan uang. Di akhir bulan, ketuk dompet lalu isi saldo aslinya (lihat di aplikasi bank, aplikasi Fastpay, atau hitung laci). Selisihnya dicatat sebagai penyesuaian, sama seperti Tutup buku: tidak dihitung ke laba, kecuali Fastpay yang berkurang dicatat sebagai pemakaian saldo Fastpay. Pemilik dompet adalah dasar pemisahan uang toko dan pribadi.</p>`;
    } else if (tab === "supplier") {
      isi = `<div class="baris"><span></span><button class="tombol kecil" data-baru>＋ Supplier</button></div><div class="tabel"><table><thead><tr><th>Supplier</th><th class="num">Barang</th><th class="num">Nota</th><th>Aktif</th><th></th></tr></thead><tbody>
        ${S.data.supplier.map(s => `<tr class="${s.aktif ? "" : "muted"}"><td>${esc(s.nama)}</td><td class="num">${satukanNama(S.data.barang.filter(b => b.supplier === s.id)).length}</td><td class="num">${S.data.nota.filter(n => n.supplier === s.id).length}</td><td>${s.aktif ? "ya" : "tidak"}</td><td><button class="link small" data-ubah="${esc(s.id)}">Ubah</button></td></tr>`).join("")}
        </tbody></table></div>`;
    } else if (tab === "barang") {
      isi = `<div class="saring-barang">
          <div class="isian"><label for="fs">Supplier</label><select class="input" id="fs"><option value="">Semua supplier</option>${S.data.supplier.map(s => `<option value="${esc(s.id)}" ${supplier === s.id ? "selected" : ""}>${esc(s.nama)}</option>`).join("")}</select></div>
          <div class="isian"><label for="ft">Tahun beli</label><select class="input" id="ft">${TAHUN.map(t => `<option value="${t}" ${tahun === t ? "selected" : ""}>${t === "-" ? "Tanpa tanggal" : t}</option>`).join("")}<option value="semua" ${tahun === "semua" ? "selected" : ""}>Semua tahun</option></select></div>
          <div class="isian"><label for="fk">Tampilkan</label><select class="input" id="fk"><option value="">Semua barang</option><option value="harga" ${saring === "harga" ? "selected" : ""}>Belum ada harga jual</option><option value="foto" ${saring === "foto" ? "selected" : ""}>Belum ada foto</option></select></div>
          <div class="isian"><label for="cari-barang">Cari</label><input class="input" id="cari-barang" placeholder="nama barang…" value="${esc(cari)}"></div>
        </div>
        <div class="baris"><span class="subjudul" id="jumlah-barang"></span><button class="tombol kecil" data-baru>＋ Barang</button></div>
        <div class="tabel tabel-barang"><table>
          <thead><tr><th>Foto</th><th colspan="3" style="text-align:center">Jumlah</th><th>Nama Barang</th><th class="num">Harga</th><th class="num">Total</th><th class="num">Modal Awal</th><th class="num">Harga Jual</th></tr></thead>
          <tbody id="rows-barang"></tbody></table></div>
        <p class="tiny muted">Seperti sheet Belanja Toko: Jumlah = banyaknya, satuan beli, dan isinya; Harga per satuan beli; Modal Awal dan Harga Jual per satuan jual. Barang yang dibeli berkali-kali tampil sekali dengan pembelian terakhirnya. Ketuk baris untuk mengubah foto, satuan, dan harga jual.</p>`;
    } else if (tab === "pengguna") {
      isi = `<div class="tabel"><table><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Hak</th></tr></thead><tbody>${S.data.pengguna.map(u => `<tr><td>${esc(u.nama)}</td><td>${esc(u.username)}</td><td><span class="st ok">Admin</span></td></tr>`).join("")}</tbody></table></div>
        <p class="tiny muted">Pengguna dan password diatur di tab "pengguna" pada Google Sheets database (lihat PANDUAN-PASANG.md). Ubah password sendiri lewat menu Akun.</p>`;
    }
    main.innerHTML = `<div class="tabs" id="tabs">${TABS.map(([v, l]) => `<button data-v="${v}" class="${v === tab ? "on" : ""}">${l}</button>`).join("")}</div><div class="kartu">${isi}</div>`;
    main.querySelector("#tabs").onclick = e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.v; gambar(); } };
    const pb = main.querySelector("#pb"); if (pb) pb.onclick = e => { const b = e.target.closest("button"); if (b) { bulan = b.dataset.v; gambar(); } };
    if (tab === "barang") {
      main.querySelector("#cari-barang").oninput = e => { cari = e.target.value; gambarBarang(); };
      main.querySelector("#fs").onchange = e => { supplier = e.target.value; gambarBarang(); };
      main.querySelector("#ft").onchange = e => { tahun = e.target.value; gambarBarang(); };
      main.querySelector("#fk").onchange = e => { saring = e.target.value; gambarBarang(); };
      main.querySelector("#rows-barang").onclick = async e => {
        const tr = e.target.closest("tr[data-barang]"); if (!tr || !tr.dataset.barang) return;
        const row = S.data.barang.find(x => x.id === tr.dataset.barang);
        if (row.foto && e.target.closest(".foto-kecil img")) return lihatFoto(fotoUrl(row.foto, 1200), row.nama);
        if (await ubahBarang(row, tr.dataset.kembar.split(","))) gambarBarang();
      };
      main.querySelector("[data-baru]").onclick = async () => { if (await ubahBarang(null, [], { supplier })) gambarBarang(); };
      gambarBarang();
      return;
    }
    if (tab === "dompet") {
      const buka = async row => { if (await ubahDompet(row)) gambar(); };
      main.querySelector("[data-baru]").onclick = () => buka(null);
      main.querySelector("tbody").onclick = e => { const tr = e.target.closest("[data-ubah]"); if (tr) buka(S.data.dompet.find(d => d.id === tr.dataset.ubah)); };
      return;
    }
    const baru = main.querySelector("[data-baru]"); if (baru) baru.onclick = () => ubah(null);
    main.querySelectorAll("[data-ubah]").forEach(b => (b.onclick = () => ubah(S.data[tab].find(x => x.id === b.dataset.ubah))));
  };
  const ubah = async row => {
    let fields, buat;
    if (tab === "kategori") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, ...(row ? [] : [{ id: "jenis", label: "Jenis", type: "select", value: "keluar", options: [{ value: "keluar", label: "Uang keluar" }, { value: "masuk", label: "Uang masuk" }] }]),
        ...(row && ["pindah", "penyesuaian"].includes(row.peran) ? [] : [{ id: "pos", label: "Pos", type: "select", value: row ? row.pos : "pribadi", options: [{ value: "toko", label: "Toko" }, { value: "pribadi", label: "Pribadi" }] }]),
        { id: "aktif", label: "Aktif", type: "checkbox", value: row ? row.aktif : true }];
      buat = r => ({ id: idBaru("K"), peran: r.jenis === "masuk" ? "pendapatan" : "biaya", urutan: S.data.kategori.length + 1, ...r });
    } else if (tab === "supplier") {
      fields = [{ id: "nama", label: "Nama", value: row ? row.nama : "" }, { id: "aktif", label: "Aktif", type: "checkbox", value: row ? row.aktif : true }];
      buat = r => ({ id: idBaru("S"), urutan: S.data.supplier.length + 1, ...r });
    } else return;
    const r = await formDialog(row ? "Ubah" : "Tambah", fields);
    if (!r || !r.nama) return;
    try { await simpan([{ tabel: tab, simpan: row ? { ...row, ...r } : buat(r) }]); toast("Tersimpan"); gambar(); }
    catch (e) { toast(e.message, true); }
  };
  gambar();
}

// Saldo asli satu dompet pada suatu tanggal. Selisih dengan catatan jadi transaksi penyesuaian
// (Fastpay yang berkurang = pemakaian saldo Fastpay, dihitung ke laba), plus baris tutup_buku.
function opsCocokkanSaldo(d, asli, sistem, tanggal, sumber = "tutup-buku") {
  const bulan = tanggal.slice(0, 7), sel = Math.round(asli - sistem), ops = [];
  let tId = "";
  if (sel !== 0) {
    tId = idBaru("T");
    const fp = d.tipe === "fastpay" && sel < 0;
    ops.push({ tabel: "transaksi", simpan: { id: tId, tanggal, jenis: sel < 0 ? "keluar" : "masuk", kategori: fp ? "pemakaian-fastpay" : "penyesuaian", dompet: d.id, dompet_tujuan: "", nominal: Math.abs(sel), keterangan: fp ? `Pemakaian saldo Fastpay ${namaBulan(bulan)}` : `Penyesuaian saldo ${d.nama} (${sumber === "dompet" ? "saldo diubah" : "tutup buku"} ${namaBulanPendek(bulan)})`, perjalanan: "", tagihan: "", nota: "", sumber, catatan: `catatan ${Math.round(sistem)}, asli ${asli}`, hapus: false } });
  }
  ops.push({ tabel: "tutup_buku", simpan: { id: idBaru("K"), bulan, dompet: d.id, saldo_sistem: Math.round(sistem), saldo_asli: asli, selisih: sel, transaksi: tId, oleh: S.user, dibuat: new Date().toISOString() } });
  return ops;
}

// Dialog dompet: nama, pemilik, jenis, dan saldo asli per tanggal. Hasil: true kalau tersimpan.
function ubahDompet(row) {
  return new Promise(res => {
    const d0 = row || { nama: "", pemilik: "toko", tipe: "bank", aktif: true };
    const dlg = document.createElement("dialog");
    dlg.innerHTML = `<form class="isi" method="dialog"><h3>${row ? esc(row.nama) : "Dompet baru"}</h3>
      ${isian({ id: "nama", label: "Nama dompet", value: d0.nama })}
      <div class="g2">
        ${isian({ id: "pemilik", label: "Pemilik", type: "select", value: d0.pemilik, options: [{ value: "toko", label: "Toko" }, { value: "pribadi", label: "Pribadi" }] })}
        ${isian({ id: "tipe", label: "Jenis", type: "select", value: d0.tipe, options: ["tunai", "bank", "e-wallet", "fastpay"].map(v => ({ value: v, label: v })) })}
      </div>
      ${isian({ id: "aktif", label: "Masih dipakai", type: "checkbox", value: d0.aktif })}
      <div class="subjudul">Saldo</div>
      <div class="g2">
        ${isian({ id: "tanggal", label: "Saldo per tanggal", type: "date", value: hariIni() })}
        <div class="isian"><label for="f-saldo">${row ? "Saldo asli" : "Saldo awal"}</label><input class="input uang" inputmode="numeric" id="f-saldo" name="saldo" placeholder="0"></div>
      </div>
      <div class="catatan info" data-info></div>
      <div class="baris"><button type="button" class="tombol garis" data-batal>Batal</button><button class="tombol" data-simpan>Simpan</button></div>
    </form>`;
    document.body.appendChild(dlg);
    pasangUang(dlg);
    const form = dlg.querySelector("form"), inSaldo = form.elements.saldo, inTgl = form.elements.tanggal;
    let disentuh = false;
    const sistem = () => (row ? saldoDompet(S.data, inTgl.value || hariIni())[row.id] || 0 : 0);
    const info = () => {
      const s = Math.round(sistem());
      if (!disentuh && row) inSaldo.value = s ? (s < 0 ? "-" : "") + titik(s) : "0";
      const sel = disentuh ? angka(inSaldo.value) - s : 0;
      const fp = form.elements.tipe.value === "fastpay" && sel < 0;
      dlg.querySelector("[data-info]").innerHTML = row
        ? `<b>Menurut catatan: ${rp(s)}</b><span>${!disentuh ? "Ubah angka di atas kalau saldo aslinya berbeda." : sel === 0 ? "Cocok, tidak ada penyesuaian." : `Selisih ${rpTanda(sel)} dicatat ${fp ? "sebagai pemakaian saldo Fastpay (biaya toko)" : "sebagai penyesuaian saldo (tidak dihitung ke laba)"} pada ${tglPendek(inTgl.value)}.`}</span>`
        : `<span>Saldo awal dicatat sebagai penyesuaian saldo, tidak dihitung ke laba.</span>`;
    };
    inSaldo.addEventListener("input", () => { disentuh = true; info(); });
    inTgl.addEventListener("change", info);
    form.elements.tipe.addEventListener("change", info);
    info();
    const tutup = v => { dlg.close(); dlg.remove(); res(v); };
    dlg.querySelector("[data-batal]").onclick = () => tutup(false);
    dlg.addEventListener("cancel", e => { e.preventDefault(); tutup(false); });
    form.onsubmit = async e => {
      e.preventDefault();
      const nama = form.elements.nama.value.trim();
      if (!nama) return toast("Isi nama dompet.", true);
      const tanggal = inTgl.value || hariIni();
      if (tanggal > hariIni()) return toast("Tanggal saldo tidak boleh setelah hari ini.", true);
      const d = { ...(row || { id: idBaru("D"), urutan: S.data.dompet.length + 1 }), nama, pemilik: form.elements.pemilik.value, tipe: form.elements.tipe.value, aktif: form.elements.aktif.checked };
      const ops = [{ tabel: "dompet", simpan: d }];
      if (row ? disentuh : angka(inSaldo.value)) ops.push(...opsCocokkanSaldo(d, angka(inSaldo.value), row ? sistem() : 0, tanggal, "dompet"));
      const btn = dlg.querySelector("[data-simpan]"); btn.disabled = true; btn.textContent = "Menyimpan…";
      try { await simpan(ops); toast(ops.length > 1 ? "Dompet dan saldo tersimpan" : "Dompet tersimpan"); tutup(true); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = "Simpan"; }
    };
    dlg.showModal();
  });
}

const BARANG_KOSONG = { nama: "", supplier: "", modal: 0, harga_jual: "", aktif: true, foto: "" };

// Dialog ubah/tambah barang: foto, nama, supplier, satuan berlapis, modal dan harga jual per satuan terakhir.
// kembar: id barang lain bernama sama; harga jual dan foto ikut diubah. Hasil: true kalau tersimpan.
function ubahBarang(row, kembar, awal = {}) {
  return new Promise(res => {
    const b = row || { ...BARANG_KOSONG, ...awal };
    let L = row ? lapisan(row) : [{ satuan: "", isi: 1 }], fotoBaru = null;
    let modalBeli = angka(b.modal) * isiTotal(L); // modal per satuan-1 tetap saat susunan satuan diubah
    const lain = kembar.filter(id => id && id !== b.id);
    const d = document.createElement("dialog");
    d.innerHTML = `<form class="isi" method="dialog"><h3>${row ? "Ubah barang" : "Barang baru"}</h3>
      ${htmlFoto(fotoUrl(b.foto, 320))}
      ${isian({ id: "nama", label: "Nama barang", value: b.nama })}
      ${isian({ id: "supplier", label: "Supplier", type: "select", value: b.supplier, options: [{ value: "", label: "–" }, ...S.data.supplier.map(s => ({ value: s.id, label: s.nama }))] })}
      ${htmlLapisan(L)}
      <div class="g2">
        <div class="isian"><label for="f-modal">Modal per <span data-lbl-jual></span></label><input class="input uang" inputmode="numeric" id="f-modal" name="modal" value="${angka(b.modal) ? titik(b.modal) : ""}" placeholder="0"></div>
        <div class="isian"><label for="f-jual">Harga jual per <span data-lbl-jual></span></label><input class="input uang" inputmode="numeric" id="f-jual" name="harga_jual" value="${angka(b.harga_jual) ? titik(b.harga_jual) : ""}" placeholder="0"></div>
      </div>
      <span class="tiny muted" data-beli></span>
      ${isian({ id: "aktif", label: "Masih dijual", type: "checkbox", value: b.aktif })}
      ${lain.length ? `<p class="tiny muted">Ada ${lain.length} catatan lain bernama sama. Harga jual dan foto ikut diubah supaya seragam.</p>` : ""}
      ${DAFTAR_SATUAN}
      <div class="baris"><button type="button" class="tombol garis" data-batal>Batal</button><button class="tombol" data-simpan>Simpan</button></div>
    </form>`;
    document.body.appendChild(d);
    pasangUang(d);
    const form = d.querySelector("form"), lap = d.querySelector("[data-lapis]"), inModal = form.elements.modal;
    const segarkan = () => {
      L = segarkanLapisan(lap);
      d.querySelectorAll("[data-lbl-jual]").forEach(x => (x.textContent = L[L.length - 1].satuan));
      d.querySelector("[data-beli]").textContent = modalBeli && L.length > 1 ? `Modal per ${L[0].satuan}: ${rp(modalBeli)}` : "";
    };
    lap.addEventListener("input", () => { segarkan(); if (modalBeli) inModal.value = titik(Math.round(modalBeli / isiTotal(L))); });
    inModal.addEventListener("input", () => { modalBeli = angka(inModal.value) * isiTotal(L); segarkan(); });
    segarkan();
    pasangFoto(d, f => (fotoBaru = f));
    const tutup = v => { d.close(); d.remove(); res(v); };
    d.querySelector("[data-batal]").onclick = () => tutup(false);
    d.addEventListener("cancel", e => { e.preventDefault(); tutup(false); });
    form.onsubmit = async e => {
      e.preventDefault();
      const nama = form.elements.nama.value.trim();
      if (!nama) return toast("Isi nama barang.", true);
      const btn = d.querySelector("[data-simpan]"); btn.disabled = true;
      let foto = b.foto || "";
      if (fotoBaru) {
        btn.textContent = "Mengunggah foto…";
        try { foto = await unggahFoto(fotoBaru, nama); } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = "Simpan"; return; }
      }
      const jual = angka(form.elements.harga_jual.value), hargaBerubah = jual !== angka(b.harga_jual);
      const isiBaris = { nama, supplier: form.elements.supplier.value, ...kolomLapisan(L), modal: angka(inModal.value), harga_jual: jual || "", foto, aktif: form.elements.aktif.checked };
      const ops = [{ tabel: "barang", simpan: row
        ? { ...row, ...isiBaris, harga_diubah: hargaBerubah ? hariIni() : row.harga_diubah }
        : { id: idBaru("B"), ...isiBaris, harga_diubah: jual ? hariIni() : "", terakhir_beli: "" } }];
      lain.map(id => S.data.barang.find(x => x.id === id)).filter(Boolean).forEach(x => {
        if (hargaBerubah || fotoBaru) ops.push({ tabel: "barang", simpan: { ...x, ...(hargaBerubah ? { harga_jual: jual || "", harga_diubah: hariIni() } : {}), ...(fotoBaru ? { foto } : {}) } });
      });
      btn.textContent = "Menyimpan…";
      try { await simpan(ops); toast("Barang tersimpan"); tutup(true); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = "Simpan"; }
    };
    d.showModal();
  });
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
