// Bagian B: menu laporan, dashboard, laba bulanan, buku kas.
import { S, kat, dom, namaPengguna, pengaturan } from "../data.js";
import { ringkasBulan, rataLaba, saldoDompet, statusTagihan, hargaNaik, bulanIni, hariIni, geserBulan, akhirBulan, jumlahHari, angka, aktif } from "../hitung.js";
import { esc, rp, rpTanda, titik, persen, namaBulan, namaBulanPendek, tglPendek, tagPos, IKON } from "../ui.js";

const mulaiDipakai = () => String(pengaturan("mulai_dipakai", "2026-11-07"));
const dataLama = b => b < mulaiDipakai().slice(0, 7);

export function menu(main) {
  const item = (href, judul, ket) => `<a href="#/${href}"><b>${judul}</b><span>${ket}</span></a>`;
  main.innerHTML = `
    <div class="menu-laporan">
      ${item("dashboard", "Dashboard", "Ringkasan bulan ini: penjualan, laba, saldo, yang perlu perhatian")}
      ${item("laba", "Laba bulanan", "Laba kas beberapa bulan berdampingan dan ke mana uangnya pergi")}
      ${item("tutup-buku", "Tutup buku", "Sebulan sekali: hitung laci, cek saldo semua dompet dan Fastpay")}
      ${item("buku-kas", "Buku kas", "Semua catatan uang, bisa disaring dan diunduh")}
      ${item("perjalanan", "Perjalanan", "Pengeluaran per perjalanan, dipisah toko dan pribadi")}
      ${item("tagihan", "Tagihan rutin", "Jatuh tempo dan status bayar bulan ini")}
      ${item("data", "Data induk", "Kategori, dompet, supplier, barang, persen untung")}
      ${item("akun", "Akun", "Ubah password, keluar")}
    </div>`;
}

function pemilihBulan(main, bulan, onUbah) {
  const box = document.createElement("div");
  box.className = "pilih-bulan";
  box.innerHTML = `<button class="ikonbtn" data-g="-1" aria-label="Bulan sebelumnya">‹</button><b>${namaBulan(bulan)}</b><button class="ikonbtn" data-g="1" aria-label="Bulan berikutnya" ${bulan >= bulanIni() ? "disabled" : ""}>›</button>`;
  box.onclick = e => { const b = e.target.closest("[data-g]"); if (b && !b.disabled) onUbah(geserBulan(bulan, +b.dataset.g)); };
  return box;
}

function hbars(rows, warna) {
  const list = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  if (!list.length) return '<p class="small muted">Tidak ada.</p>';
  const m = list[0][1] || 1;
  return list.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><span class="t"><i style="width:${(v / m) * 100}%;background:${warna}"></i></span><span class="num">${rp(v)}</span></div>`).join("");
}

function grafikHarian(r) {
  const n = jumlahHari(r.bulan);
  const nilai = Array.from({ length: n }, (_, i) => r.hari[String(i + 1).padStart(2, "0")] || 0);
  const maks = Math.max(...nilai, 1);
  const langkah = maks > 4e6 ? 2e6 : maks > 2e6 ? 1e6 : maks > 1e6 ? 5e5 : 2.5e5;
  const atas = Math.ceil(maks / langkah) * langkah;
  const rata = r.hariBuka ? r.penjualan / r.hariBuka : 0;
  let garis = "";
  for (let v = 0; v <= atas; v += langkah) garis += `<div class="garis" style="top:calc((100% - 20px) * ${1 - v / atas})"><span>${v >= 1e6 ? (v / 1e6).toLocaleString("id-ID") + " jt" : v ? v / 1e3 + " rb" : "0"}</span></div>`;
  const batang = nilai.map((v, i) => `<div class="${v > rata * 2 && v ? "tinggi" : ""}" title="${i + 1} ${namaBulanPendek(r.bulan)}: ${v ? rp(v) : "tidak ada penjualan"}"><i style="height:${(v / atas) * 100}%"></i>${i === 0 || (i + 1) % 5 === 0 ? `<em>${i + 1}</em>` : ""}</div>`).join("");
  return `<div class="grafik" role="img" aria-label="Penjualan harian ${namaBulan(r.bulan)}">${garis}<div class="batang">${batang}</div></div>`;
}

// ---------- B1 Dashboard ----------
export function dashboard(main, _, q) {
  const gambar = bulan => {
    const ix = S.ix;
    const r = ringkasBulan(S.data, bulan, ix);
    const lalu = ringkasBulan(S.data, geserBulan(bulan, -1), ix);
    const rata = rataLaba(S.data, bulan, 3, ix);
    const sampai = bulan === bulanIni() ? hariIni() : akhirBulan(bulan);
    const saldo = saldoDompet(S.data, sampai);
    const dompetToko = S.data.dompet.filter(d => d.aktif && d.pemilik === "toko");
    const totalToko = dompetToko.filter(d => d.tipe !== "fastpay").reduce((s, d) => s + (saldo[d.id] || 0), 0);
    const fp = dompetToko.filter(d => d.tipe === "fastpay").reduce((s, d) => s + (saldo[d.id] || 0), 0);
    const tb = S.data.tutup_buku.slice().sort((a, b) => (a.bulan < b.bulan ? 1 : -1))[0];
    // Bulan berjalan dibandingkan dengan periode yang sama bulan lalu (tanggal 1 s.d. hari ini).
    const berjalan = bulan === bulanIni();
    const hariKini = new Date().getDate();
    const pembanding = berjalan ? Object.entries(lalu.hari).filter(([d]) => +d <= hariKini).reduce((s, [, v]) => s + v, 0) : lalu.penjualan;
    const naik = persen(r.penjualan - pembanding, pembanding);
    lalu.penjualan = pembanding;
    // Perlu perhatian
    const perhatian = [];
    if (bulan === bulanIni()) {
      const tg = statusTagihan(S.data, bulan);
      const belum = tg.filter(t => t.status === "lewat" || t.status === "dekat");
      if (belum.length) perhatian.push(`<div class="catatan bad"><b>${belum.length} tagihan perlu dibayar</b><span>${belum.map(t => `${esc(t.nama)} (${t.status === "lewat" ? `lewat ${-t.selisihHari} hari` : t.selisihHari === 0 ? "hari ini" : `${t.selisihHari} hari lagi`})`).join(", ")}</span><a href="#/tagihan">Lihat tagihan</a></div>`);
      const hn = hargaNaik(S.data, geserBulan(bulan, -2) + "-01");
      if (hn.length) perhatian.push(`<div class="catatan warn"><b>${hn.length} barang modalnya naik, harga jual belum diubah</b><span>${hn.slice(0, 4).map(x => `${esc(x.barang.nama)} (${rp(x.modalLama)} → ${rp(x.modalBaru)})`).join(", ")}${hn.length > 4 ? ", …" : ""}</span><a href="#/harga">Cek harga</a></div>`);
      const mulai = mulaiDipakai();
      const kemarin = hariIni(new Date(Date.now() - 864e5));
      if (kemarin >= mulai && !S.data.tutup_toko.find(x => x.tanggal === kemarin)) perhatian.push(`<div class="catatan warn"><b>Tutup toko kemarin belum diisi</b><a href="#/tutup-toko?tgl=${kemarin}">Isi sekarang</a></div>`);
      const hariKe = new Date().getDate();
      const blnLalu = geserBulan(bulan, -1);
      if (blnLalu >= mulai.slice(0, 7) && !S.data.tutup_buku.find(x => x.bulan === blnLalu)) perhatian.push(`<div class="catatan info"><b>Tutup buku ${namaBulan(blnLalu)} belum dilakukan</b><a href="#/tutup-buku?bulan=${blnLalu}">Tutup buku</a></div>`);
      else if (hariKe >= jumlahHari(bulan) - 1) perhatian.push(`<div class="catatan info"><b>Akhir bulan: waktunya tutup buku</b><span>Hitung laci dan cek saldo semua dompet, termasuk Fastpay.</span><a href="#/tutup-buku">Tutup buku</a></div>`);
    }
    main.innerHTML = "";
    const atas = document.createElement("div"); atas.className = "baris";
    atas.appendChild(pemilihBulan(main, bulan, gambar));
    main.appendChild(atas);
    main.insertAdjacentHTML("beforeend", `
      ${dataLama(bulan) ? '<div class="catatan warn"><b>Bulan ini dari data lama</b><span>Uang yang masuk lewat rekening mungkin tidak tercatat, dan pemakaian Fastpay dihitung dengan perkiraan. Pakai angka ini sebagai gambaran kasar.</span></div>' : ""}
      <div class="grid4">
        <div class="kpi"><span class="k">Penjualan</span><span class="v">${rp(r.penjualan)}</span><span class="small ${naik >= 0 ? "plus" : "minus"}">${lalu.penjualan ? `${naik >= 0 ? "▲" : "▼"} ${Math.abs(naik)}% dari ${berjalan ? `1–${hariKini} ` : ""}${namaBulanPendek(lalu.bulan)}` : "&nbsp;"}</span></div>
        <div class="kpi"><span class="k">Laba kas</span><span class="v" style="${r.laba < 0 ? "color:var(--keluar)" : ""}">${rp(r.laba)}</span><span class="small muted">rata-rata 3 bulan ${rp(rata.rata)}</span></div>
        <div class="kpi"><span class="k">Uang toko dipakai pribadi</span><span class="v" style="color:var(--pribadi)">${rp(r.prive)}</span><span class="small muted">${r.laba > 0 ? `${persen(r.prive, r.laba)}% dari laba kas` : "laba kas tidak positif"}</span></div>
        <div class="kpi"><span class="k">Saldo dompet toko</span><span class="v">${rp(totalToko)}</span><span class="small muted">+ saldo Fastpay ${rp(fp)}</span></div>
      </div>
      <div class="kartu"><h3><span>Penjualan harian</span><span class="small muted" style="font-family:var(--body);font-weight:500">${r.hariBuka} hari ada penjualan · rata-rata ${rp(r.hariBuka ? r.penjualan / r.hariBuka : 0)}</span></h3>${grafikHarian(r)}</div>
      <div class="dua-kolom">
        <div class="kartu"><h3><span>Saldo per dompet</span>${tb ? `<span class="st ok">tutup buku ${namaBulanPendek(tb.bulan)}</span>` : '<span class="st warn">belum pernah dicocokkan</span>'}</h3>
          <div class="tumpuk small">${["toko", "pribadi"].map(p => `<div class="subjudul">${p === "toko" ? "Toko" : "Pribadi"}</div>${S.data.dompet.filter(d => d.aktif && d.pemilik === p).map(d => `<div class="baris"><span>${esc(d.nama)}</span><span class="${(saldo[d.id] || 0) < 0 ? "minus" : ""}">${rp(saldo[d.id] || 0)}</span></div>`).join("")}`).join("")}</div>
          ${tb ? "" : '<p class="tiny muted">Saldo di atas dihitung dari catatan saja. Lakukan tutup buku sekali supaya sama dengan saldo asli.</p>'}
        </div>
        <div class="kartu"><h3>Perlu perhatian</h3>${perhatian.join("") || '<p class="small muted">Tidak ada yang mendesak.</p>'}</div>
      </div>
      <div class="dua-kolom">
        <div class="kartu"><h3><span>Biaya toko per kategori</span><span>${rp(r.biaya)}</span></h3>${hbars(r.biayaPer, "var(--toko)")}</div>
        <div class="kartu"><h3><span>Uang toko dipakai pribadi</span><span>${rp(r.prive)}</span></h3>${hbars(r.privePer, "var(--pribadi)")}</div>
      </div>`);
  };
  gambar(q.bulan || bulanIni());
}

// ---------- B2 Laba bulanan ----------
export function laba(main, _, q) {
  let n = +(q.n || 3), akhir = q.bulan || bulanIni();
  const gambar = () => {
    const ix = S.ix;
    const bulanList = Array.from({ length: n }, (_, i) => geserBulan(akhir, -(n - 1 - i)));
    const R = bulanList.map(b => ringkasBulan(S.data, b, ix));
    const ada = R.filter(r => r.jumlahTransaksi);
    const rata = ada.length ? ada.reduce((s, r) => s + r.laba, 0) / ada.length : 0;
    const tahunLalu = ringkasBulan(S.data, geserBulan(akhir, -12), ix);
    const baris = (label, fn, kelas = "", tanda = false) => `<tr class="${kelas}"><td>${label}</td>${R.map(r => { const v = fn(r); return `<td class="num ${tanda && v < 0 ? "minus" : tanda && v > 0 ? "" : ""}">${v ? (tanda ? rpTanda(v) : titik(v)) : "–"}</td>`; }).join("")}</tr>`;
    const biayaKat = [...new Set(R.flatMap(r => Object.keys(r.biayaPer)))];
    const pendKat = [...new Set(R.flatMap(r => Object.keys(r.pendapatanPer)))];
    main.innerHTML = `
      <div class="baris"><div class="chips" id="n">${[3, 6, 12].map(x => `<button data-v="${x}" class="${x === n ? "on" : ""}">${x} bulan</button>`).join("")}</div><div id="pb"></div></div>
      <div class="kartu">
        <div class="tabel"><table>
          <thead><tr><th>Pos</th>${bulanList.map(b => `<th class="num">${namaBulanPendek(b)}${dataLama(b) ? "*" : ""}</th>`).join("")}</tr></thead>
          <tbody>
            ${baris("Penjualan harian", r => r.penjualan)}
            ${pendKat.map(k => baris(esc(k), r => r.pendapatanPer[k] || 0)).join("")}
            ${baris("Uang masuk usaha", r => r.masukUsaha, "sorot")}
            ${baris("Belanja stok", r => -r.belanja, "", true)}
            ${baris("Pemakaian saldo Fastpay", r => -r.layanan, "", true)}
            ${baris("Biaya toko", r => -r.biaya, "", true)}
            ${biayaKat.map(k => baris(esc(k), r => r.biayaPer[k] || 0, "rinci")).join("")}
            ${baris("Laba kas", r => r.laba, "sorot", true)}
            <tr class="sorot"><td>Rata-rata ${ada.length} bulan</td><td class="num" colspan="${n}">${rp(rata)} per bulan</td></tr>
            <tr><td colspan="${n + 1}" style="padding-top:18px;border:0"><b>Ke mana laba ini pergi</b></td></tr>
            ${baris("Diambil untuk pribadi", r => -r.prive, "", true)}
            ${baris("Uang pribadi masuk ke toko", r => r.setoran, "", true)}
            ${baris("Pinjaman dan modal masuk", r => r.pinjaman + r.modal, "", true)}
            ${baris("Cicilan pinjaman", r => -r.cicilan, "", true)}
            ${baris("Uang toko bertambah", r => r.perubahanToko, "sorot", true)}
          </tbody>
        </table></div>
        ${bulanList.some(dataLama) ? '<p class="tiny muted">* Data lama yang diimpor: uang masuk lewat rekening mungkin tidak tercatat dan pemakaian Fastpay dihitung dengan perkiraan.</p>' : ""}
      </div>
      <div class="kartu"><h3>Dibanding tahun lalu</h3>
        <div class="tabel"><table><thead><tr><th>Pos</th><th class="num">${namaBulanPendek(tahunLalu.bulan)}</th><th class="num">${namaBulanPendek(akhir)}</th></tr></thead><tbody>
          ${[["Penjualan", "penjualan"], ["Belanja stok", "belanja"], ["Biaya toko", "biaya"], ["Laba kas", "laba"]].map(([l, k]) => `<tr><td>${l}</td><td class="num">${tahunLalu.jumlahTransaksi ? rp(tahunLalu[k]) : "–"}</td><td class="num">${rp(R[R.length - 1][k])}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="catatan info"><b>Cara membaca</b><span>Laba kas = uang masuk usaha − belanja stok − pemakaian Fastpay − biaya toko. Bulan dengan belanja besar terlihat kecil atau minus, jadi nilai toko dari rata-ratanya, bukan dari satu bulan.</span></div>`;
    main.querySelector("#pb").appendChild(pemilihBulan(main, akhir, b => { akhir = b; gambar(); }));
    main.querySelector("#n").onclick = e => { const b = e.target.closest("button"); if (b) { n = +b.dataset.v; gambar(); } };
  };
  gambar();
}

// ---------- B4 Buku kas ----------
export function bukuKas(main, _, q) {
  const f = { bulan: q.bulan || bulanIni(), dompet: q.dompet || "", kategori: q.kategori || "", pos: "", tanda: "", cari: "", batas: 200 };
  const bulanAda = [...new Set(S.data.transaksi.map(t => (t.tanggal || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  if (!bulanAda.includes(bulanIni())) bulanAda.unshift(bulanIni());
  main.innerHTML = `
    <div class="kartu">
      <div class="grid4">
        <div class="isian"><label for="fb">Bulan</label><select class="input" id="fb"><option value="">Semua</option>${bulanAda.map(b => `<option value="${b}" ${b === f.bulan ? "selected" : ""}>${namaBulan(b)}</option>`).join("")}</select></div>
        <div class="isian"><label for="fd">Dompet</label><select class="input" id="fd"><option value="">Semua dompet</option>${S.data.dompet.map(d => `<option value="${esc(d.id)}" ${d.id === f.dompet ? "selected" : ""}>${esc(d.nama)}</option>`).join("")}</select></div>
        <div class="isian"><label for="fk">Kategori</label><select class="input" id="fk"><option value="">Semua kategori</option>${S.data.kategori.map(k => `<option value="${esc(k.id)}" ${k.id === f.kategori ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div>
        <div class="isian"><label for="fq">Cari</label><input class="input" id="fq" placeholder="keterangan…"></div>
      </div>
      <div class="chips" id="ft"><button data-v="" class="on">Semua</button><button data-v="toko">Toko</button><button data-v="pribadi">Pribadi</button><button data-v="prive">Pribadi dari toko</button><button data-v="perjalanan">Perjalanan</button><button data-v="lama">Data lama</button></div>
    </div>
    <div class="baris"><span class="small" id="total"></span><button class="tombol garis kecil" id="unduh">Unduh CSV</button></div>
    <div class="kartu"><div class="tabel"><table><thead><tr><th>Tgl</th><th>Keterangan</th><th>Kategori</th><th>Dompet</th><th class="num">Nominal</th><th>Tanda</th><th>Oleh</th></tr></thead><tbody id="rows"></tbody></table></div>
    <button class="tombol garis hidden" id="lagi">Tampilkan lebih banyak</button></div>`;
  const $ = s => main.querySelector(s);
  const saring = () => {
    const kata = f.cari.toLowerCase().split(/\s+/).filter(Boolean);
    return S.data.transaksi.filter(t => {
      if (!aktif(t)) return false;
      if (f.bulan && !String(t.tanggal).startsWith(f.bulan)) return false;
      if (f.dompet && t.dompet !== f.dompet && t.dompet_tujuan !== f.dompet) return false;
      if (f.kategori && t.kategori !== f.kategori) return false;
      const k = kat(t.kategori);
      if (f.tanda === "toko" && k.pos !== "toko") return false;
      if (f.tanda === "pribadi" && k.pos !== "pribadi") return false;
      if (f.tanda === "prive" && !(k.pos === "pribadi" && dom(t.dompet).pemilik === "toko" && t.jenis !== "pindah")) return false;
      if (f.tanda === "perjalanan" && !t.perjalanan) return false;
      if (f.tanda === "lama" && t.sumber !== "impor") return false;
      if (kata.length && !kata.every(w => `${t.keterangan} ${k.nama}`.toLowerCase().includes(w))) return false;
      return true;
    }).sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : String(a.dibuat) < String(b.dibuat) ? 1 : -1));
  };
  const gambar = () => {
    const list = saring();
    const masuk = list.filter(t => t.jenis === "masuk").reduce((s, t) => s + angka(t.nominal), 0);
    const keluar = list.filter(t => t.jenis === "keluar").reduce((s, t) => s + angka(t.nominal), 0);
    $("#total").innerHTML = `${list.length} catatan · <span class="plus">masuk ${rp(masuk)}</span> · <span class="minus">keluar ${rp(keluar)}</span>`;
    $("#rows").innerHTML = list.slice(0, f.batas).map(t => {
      const k = kat(t.kategori);
      const prive = t.jenis !== "pindah" && k.pos === "pribadi" && dom(t.dompet).pemilik === "toko";
      const per = t.perjalanan && S.data.perjalanan.find(p => p.id === t.perjalanan);
      return `<tr class="klik" data-id="${esc(t.id)}"><td>${tglPendek(t.tanggal)}</td><td>${esc(t.keterangan)}</td><td>${t.jenis === "pindah" ? '<span class="tag khusus">Pindah dana</span>' : `<span class="tag ${k.pos}">${esc(k.nama)}</span>`}</td><td>${t.jenis === "pindah" ? `${esc(dom(t.dompet).nama)} → ${esc(dom(t.dompet_tujuan).nama)}` : esc(dom(t.dompet).nama)}</td>
        <td class="num ${t.jenis === "masuk" ? "plus" : t.jenis === "keluar" ? "minus" : ""}">${t.jenis === "masuk" ? "+" : t.jenis === "keluar" ? "−" : ""}${titik(t.nominal)}</td>
        <td>${prive ? '<span class="st warn">pribadi dari toko</span> ' : ""}${per ? `<span class="st grey">${esc(per.nama)}</span> ` : ""}${t.sumber === "impor" ? '<span class="st grey">lama</span>' : String(t.sumber).startsWith("tutup:") ? '<span class="st grey">tutup toko</span>' : t.sumber === "nota" ? '<span class="st grey">nota</span>' : ""}</td><td class="small muted">${esc(namaPengguna(t.oleh))}</td></tr>`;
    }).join("") || '<tr><td colspan="7" class="muted">Tidak ada catatan.</td></tr>';
    $("#lagi").classList.toggle("hidden", list.length <= f.batas);
  };
  $("#fb").onchange = e => { f.bulan = e.target.value; gambar(); };
  $("#fd").onchange = e => { f.dompet = e.target.value; gambar(); };
  $("#fk").onchange = e => { f.kategori = e.target.value; gambar(); };
  $("#fq").oninput = e => { f.cari = e.target.value; gambar(); };
  $("#ft").onclick = e => { const b = e.target.closest("button"); if (!b) return; f.tanda = b.dataset.v; main.querySelectorAll("#ft button").forEach(x => x.classList.toggle("on", x === b)); gambar(); };
  $("#rows").onclick = e => { const tr = e.target.closest("tr[data-id]"); if (tr) location.hash = "#/catat/ubah/" + encodeURIComponent(tr.dataset.id); };
  $("#lagi").onclick = () => { f.batas += 200; gambar(); };
  $("#unduh").onclick = () => {
    const list = saring();
    const kolom = ["tanggal", "jenis", "kategori", "pos", "dompet", "dompet_tujuan", "nominal", "keterangan", "oleh"];
    const sel = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [kolom.join(","), ...list.map(t => [t.tanggal, t.jenis, kat(t.kategori).nama, kat(t.kategori).pos, dom(t.dompet).nama, t.dompet_tujuan ? dom(t.dompet_tujuan).nama : "", angka(t.nominal), t.keterangan, namaPengguna(t.oleh)].map(sel).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `buku-kas-${f.bulan || "semua"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  gambar();
}
