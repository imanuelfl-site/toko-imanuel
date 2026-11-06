// Bagian A: beranda, catat uang, tutup toko, riwayat.
import { S, simpan, idBaru, kat, dom, namaPengguna, pengaturan } from "../data.js";
import { hariIni, angka, aktif, ringkasBulan } from "../hitung.js";
import { esc, rp, titik, tglPanjang, tglPendek, IKON, toast, tanya, pasangUang, opsiKategori, opsiDompet, kartuTransaksi } from "../ui.js";
import { segarkan } from "../app.js";

const lokal = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- A0 Beranda ----------
export function beranda(main) {
  const hari = hariIni();
  const tt = S.data.tutup_toko.find(x => x.tanggal === hari);
  const terakhir = S.data.transaksi.filter(t => aktif(t) && t.sumber !== "impor").sort((a, b) => (String(a.dibuat) < String(b.dibuat) ? 1 : -1)).slice(0, 5);
  main.innerHTML = `
    <div class="baris"><h2>Halo, ${esc(S.nama || S.user)}</h2><span class="small muted">${tglPanjang(hari)}</span></div>
    <form class="cari" id="cari" role="search">${IKON.cari}<input id="q" placeholder="Cari harga barang…" autocomplete="off" aria-label="Cari harga barang"></form>
    <div class="ubin">
      <a href="#/catat/keluar"><b class="out">−</b>Uang keluar<span>belanja, makan, tagihan</span></a>
      <a href="#/catat/masuk"><b class="in">+</b>Uang masuk<span>bonus, komisi, modal</span></a>
      <a href="#/catat/pindah"><b>⇄</b>Pindah dana<span>setor bank, isi Fastpay</span></a>
      <a href="#/nota"><b>▤</b>Nota belanja<span>barang dari supplier</span></a>
      <a href="#/tutup-toko" class="lebar ${tt ? "sudah" : ""}">Tutup toko hari ini<span>${tt ? (tt.tutup ? "Sudah diisi · toko tutup" : `Sudah diisi · pendapatan ${rp(angka(tt.tunai) + angka(tt.transfer) + angka(tt.jt_admin))}`) : "Belum diisi · penjualan, transfer, jasa transfer"}</span></a>
    </div>
    <div class="subjudul">Catatan terakhir</div>
    <div class="daftar">${terakhir.length ? terakhir.map(t => kartuTransaksi(t, { namaPengguna })).join("") : '<p class="small muted">Belum ada catatan baru. Mulai dengan tombol di atas.</p>'}</div>
    <div class="baris small muted"><span>Data dimuat ${S.dimuat ? S.dimuat.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}</span><button class="link" id="segar">Muat ulang data</button></div>`;
  main.querySelector("#cari").onsubmit = e => { e.preventDefault(); location.hash = "#/harga?q=" + encodeURIComponent(main.querySelector("#q").value.trim()); };
  main.querySelector("#q").addEventListener("input", e => { if (e.target.value.trim().length >= 2) location.hash = "#/harga?q=" + encodeURIComponent(e.target.value.trim()); });
  main.querySelector("#segar").onclick = segarkan;
}

// ---------- A1 Catat uang ----------
export function catat(main, [arg], q) {
  const lama = ["masuk", "keluar", "pindah"].includes(arg) ? null : S.data.transaksi.find(t => t.id === arg);
  if (!lama && !["masuk", "keluar", "pindah"].includes(arg)) { main.innerHTML = '<div class="catatan bad">Catatan tidak ditemukan.</div>'; return; }
  const v = lama ? { ...lama } : {
    jenis: arg, tanggal: q.tgl || hariIni(), kategori: q.kategori || "", nominal: angka(q.nominal) || "", keterangan: q.ket || "", tagihan: q.tagihan || "",
    dompet: q.dompet || lokal.get("toko-dompet-" + arg) || "cash-toko", dompet_tujuan: arg === "pindah" ? (lokal.get("toko-tujuan") || "fastpay") : "", perjalanan: ""
  };
  if (!lama && !v.perjalanan) { const p = S.data.perjalanan.find(p => p.mulai <= v.tanggal && (!p.selesai || p.selesai >= v.tanggal)); if (p) v.perjalanan = p.id; }
  const tagihanAktif = S.data.tagihan.filter(t => t.aktif);
  main.innerHTML = `
    ${lama && lama.sumber !== "manual" ? `<div class="catatan info">${lama.sumber === "impor" ? `Dari data lama: ${esc(lama.asal || "")}${lama.catatan ? ` · ${esc(lama.catatan)}` : ""}` : String(lama.sumber).startsWith("tutup:") ? `Dibuat dari <a href="#/tutup-toko?tgl=${esc(lama.tanggal)}">Tutup toko ${tglPendek(lama.tanggal)}</a>. Sebaiknya diubah di sana.` : lama.nota ? "Dibuat dari nota belanja." : esc(lama.sumber)}</div>` : ""}
    <form class="tumpuk" id="form">
      <div class="seg" role="group" aria-label="Jenis">${["masuk", "keluar", "pindah"].map(j => `<button type="button" data-v="${j}" class="${v.jenis === j ? "on" : ""}">${j === "masuk" ? "Masuk" : j === "keluar" ? "Keluar" : "Pindah"}</button>`).join("")}</div>
      <div class="isian"><label for="nominal">Nominal</label><input class="input besar uang" id="nominal" inputmode="numeric" placeholder="Rp0" value="${v.nominal ? titik(v.nominal) : ""}" required></div>
      <div class="isian" id="b-kategori"><label for="kategori">Kategori</label><select class="input" id="kategori"></select></div>
      <div class="isian"><label for="dompet" id="l-dompet">Dompet</label><select class="input" id="dompet">${opsiDompet(v.dompet)}</select></div>
      <div class="isian" id="b-tujuan"><label for="tujuan">Ke dompet</label><select class="input" id="tujuan">${opsiDompet(v.dompet_tujuan)}</select></div>
      <div class="isian"><label for="ket">Keterangan</label><input class="input" id="ket" value="${esc(v.keterangan)}" placeholder="misalnya: makan malam" autocomplete="off"></div>
      <div id="peringatan"></div>
      <div class="grid2">
        <div class="isian"><label for="tanggal">Tanggal</label><input class="input" type="date" id="tanggal" value="${esc(v.tanggal)}" required></div>
        <div class="isian" id="b-tagihan"><label for="tagihan">Tagihan rutin</label><select class="input" id="tagihan"><option value="">–</option>${tagihanAktif.map(t => `<option value="${esc(t.id)}" ${t.id === v.tagihan ? "selected" : ""}>${esc(t.nama)}</option>`).join("")}</select></div>
      </div>
      ${S.data.perjalanan.length ? `<div class="isian"><label for="perjalanan">Perjalanan</label><select class="input" id="perjalanan"><option value="">–</option>${S.data.perjalanan.slice().reverse().map(p => `<option value="${esc(p.id)}" ${p.id === v.perjalanan ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select></div>` : ""}
      <button class="tombol blok" id="simpan">${lama ? "Simpan perubahan" : "Simpan"}</button>
      ${lama ? '<button type="button" class="tombol hapus blok" id="hapus">Hapus catatan ini</button>' : ""}
      ${lama ? `<p class="tiny muted">Dicatat oleh ${esc(namaPengguna(lama.oleh))}${lama.dibuat ? " · " + esc(String(lama.dibuat).slice(0, 16).replace("T", " ")) : ""}${lama.diubah ? " · diubah " + esc(String(lama.diubah).slice(0, 16).replace("T", " ")) : ""}</p>` : ""}
    </form>`;
  pasangUang(main);
  const f = main.querySelector("#form");
  const $ = s => f.querySelector(s);
  let jenis = v.jenis;
  const perbarui = () => {
    f.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.v === jenis));
    $("#b-kategori").classList.toggle("hidden", jenis === "pindah");
    $("#b-tujuan").classList.toggle("hidden", jenis !== "pindah");
    $("#b-tagihan").classList.toggle("hidden", jenis !== "keluar");
    $("#l-dompet").textContent = jenis === "keluar" ? "Dibayar dari dompet" : jenis === "masuk" ? "Masuk ke dompet" : "Dari dompet";
    if (jenis !== "pindah") { const pilih = $("#kategori").value || v.kategori; $("#kategori").innerHTML = opsiKategori(jenis, pilih); }
    cekPeringatan();
  };
  const cekPeringatan = () => {
    const box = $("#peringatan");
    if (jenis === "pindah") {
      const a = dom($("#dompet").value).pemilik, b = dom($("#tujuan").value).pemilik;
      box.innerHTML = a === "toko" && b === "pribadi" ? '<div class="catatan warn"><b>Uang toko pindah ke dompet pribadi</b><span>Dihitung sebagai uang toko dipakai pribadi.</span></div>' : a === "pribadi" && b === "toko" ? '<div class="catatan info"><b>Uang pribadi masuk ke dompet toko</b><span>Dihitung sebagai uang pribadi masuk ke toko.</span></div>' : "";
      return;
    }
    const k = kat($("#kategori").value), d = dom($("#dompet").value);
    if (!$("#kategori").value) { box.innerHTML = ""; return; }
    if (k.pos === "pribadi" && d.pemilik === "toko") box.innerHTML = jenis === "keluar" ? '<div class="catatan warn"><b>Uang toko dipakai pribadi</b><span>Tercatat otomatis. Tidak mengurangi laba toko, tetapi mengurangi uang toko.</span></div>' : '<div class="catatan info"><b>Uang pribadi masuk ke dompet toko</b><span>Tidak dihitung sebagai pendapatan toko.</span></div>';
    else if (k.pos === "toko" && d.pemilik === "pribadi") box.innerHTML = jenis === "keluar" ? '<div class="catatan info"><b>Keperluan toko dibayar dari dompet pribadi</b><span>Tetap dihitung sebagai biaya toko.</span></div>' : '<div class="catatan warn"><b>Uang toko masuk ke dompet pribadi</b><span>Dihitung sebagai pendapatan toko yang langsung dipakai pribadi.</span></div>';
    else box.innerHTML = "";
  };
  f.querySelectorAll(".seg button").forEach(b => (b.onclick = () => { jenis = b.dataset.v; perbarui(); }));
  ["#kategori", "#dompet", "#tujuan"].forEach(s => $(s).addEventListener("change", cekPeringatan));
  $("#tagihan").addEventListener("change", () => {
    const t = S.data.tagihan.find(x => x.id === $("#tagihan").value);
    if (!t) return;
    if (t.kategori) { $("#kategori").value = t.kategori; }
    if (t.dompet) $("#dompet").value = t.dompet;
    if (!angka($("#nominal").value) && angka(t.nominal)) $("#nominal").value = titik(t.nominal);
    if (!$("#ket").value) $("#ket").value = t.nama;
    cekPeringatan();
  });
  perbarui();

  f.onsubmit = async e => {
    e.preventDefault();
    const nominal = angka($("#nominal").value);
    const kategori = jenis === "pindah" ? "pindah" : $("#kategori").value;
    const dompet = $("#dompet").value, tujuan = jenis === "pindah" ? $("#tujuan").value : "";
    if (!nominal) return toast("Isi nominal dulu.", true);
    if (!kategori) return toast("Pilih kategori.", true);
    if (jenis === "pindah" && dompet === tujuan) return toast("Dompet asal dan tujuan sama.", true);
    const row = {
      ...(lama || {}), id: lama ? lama.id : idBaru("T"), tanggal: $("#tanggal").value, jenis, kategori, dompet, dompet_tujuan: tujuan, nominal,
      keterangan: $("#ket").value.trim(), tagihan: jenis === "keluar" ? $("#tagihan").value : "", perjalanan: f.querySelector("#perjalanan") ? f.querySelector("#perjalanan").value : (lama ? lama.perjalanan : ""),
      sumber: lama ? lama.sumber : "manual", hapus: false
    };
    const b = $("#simpan"); b.disabled = true; b.textContent = "Menyimpan…";
    try {
      await simpan([{ tabel: "transaksi", simpan: row }]);
      lokal.set("toko-dompet-" + jenis, dompet); if (jenis === "pindah") lokal.set("toko-tujuan", tujuan);
      toast(lama ? "Perubahan tersimpan" : "Tersimpan");
      location.hash = lama ? "#/riwayat" : "#/beranda";
    } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Simpan"; }
  };
  if (lama) $("#hapus").onclick = async () => {
    if (!(await tanya("Hapus catatan?", `${lama.keterangan || kat(lama.kategori).nama} · ${rp(lama.nominal)}. Catatan yang dihapus tidak dihitung lagi.`, "Hapus", true))) return;
    try { await simpan([{ tabel: "transaksi", simpan: { ...lama, hapus: true } }]); toast("Catatan dihapus"); history.back(); }
    catch (err) { toast(err.message, true); }
  };
}

// ---------- A2 Tutup toko ----------
export function tutupToko(main, _, q) {
  const tgl = q.tgl || hariIni();
  const ada = S.data.tutup_toko.find(x => x.tanggal === tgl);
  const v = ada || { tanggal: tgl, tutup: false, tunai: "", transfer: "", dompet_transfer: lokal.get("toko-dompet-transfer") || "seabank-cendana", jt_nominal: "", jt_admin: "", jt_jumlah: "", jt_dompet: lokal.get("toko-dompet-jt") || "seabank-cendana", catatan: "" };
  const [ty, tm, td] = tgl.split("-").map(Number);
  const geser = n => hariIni(new Date(ty, tm - 1, td + n));
  // Hari yang belum diisi bulan ini (sejak sistem mulai dipakai)
  const mulai = pengaturan("mulai_dipakai", "2026-11-07");
  const kosong = [];
  const now = new Date();
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); hariIni(d) < hariIni(); d.setDate(d.getDate() + 1)) {
    const s = hariIni(d);
    if (s >= mulai && !S.data.tutup_toko.find(x => x.tanggal === s)) kosong.push(s);
  }
  // Rata-rata pendapatan 30 hari terakhir dari tutup toko
  const lalu = S.data.tutup_toko.filter(x => x.tanggal < tgl && x.tanggal >= geser(-30) && !x.tutup);
  const rata = lalu.length ? lalu.reduce((s, x) => s + angka(x.tunai) + angka(x.transfer) + angka(x.jt_admin), 0) / lalu.length : 0;
  main.innerHTML = `
    <div class="baris"><button class="tombol garis kecil" id="kemarin">‹ ${tglPendek(geser(-1))}</button><b>${tglPanjang(tgl)}</b>${tgl < hariIni() ? `<button class="tombol garis kecil" id="besok">${tglPendek(geser(1))} ›</button>` : "<span></span>"}</div>
    ${kosong.length ? `<div class="catatan warn"><b>Belum diisi bulan ini</b><span>${kosong.map(s => `<a href="#/tutup-toko?tgl=${s}">${tglPendek(s)}</a>`).join(", ")}</span></div>` : ""}
    ${ada ? '<div class="catatan ok">Hari ini sudah diisi. Mengubah dan menyimpan lagi akan mengganti isian sebelumnya.</div>' : ""}
    <form class="tumpuk" id="form">
      <label class="saklar" for="tutup"><span>Toko tutup hari ini (Minggu/libur)</span><input type="checkbox" id="tutup" ${v.tutup ? "checked" : ""}></label>
      <div id="isian-buka" class="tumpuk">
        <div class="isian"><label for="tunai">Penjualan tunai (tanpa uang titipan jasa transfer)</label><input class="input besar uang" id="tunai" inputmode="numeric" placeholder="Rp0" value="${v.tunai ? titik(v.tunai) : ""}"><span class="tiny muted">Masuk ke Cash Toko</span></div>
        <div class="grid2">
          <div class="isian"><label for="transfer">Penjualan transfer / QRIS</label><input class="input uang" id="transfer" inputmode="numeric" placeholder="Rp0" value="${v.transfer ? titik(v.transfer) : ""}"></div>
          <div class="isian"><label for="dtransfer">Masuk ke</label><select class="input" id="dtransfer">${opsiDompet(v.dompet_transfer)}</select></div>
        </div>
        <div class="subjudul">Jasa transfer hari ini</div>
        <div class="grid2">
          <div class="isian"><label for="jtn">Uang pelanggan yang ditransfer</label><input class="input uang" id="jtn" inputmode="numeric" placeholder="Rp0" value="${v.jt_nominal ? titik(v.jt_nominal) : ""}"></div>
          <div class="isian"><label for="jtd">Ditransfer dari</label><select class="input" id="jtd">${opsiDompet(v.jt_dompet)}</select></div>
          <div class="isian"><label for="jta">Admin yang diterima (tunai)</label><input class="input uang" id="jta" inputmode="numeric" placeholder="Rp0" value="${v.jt_admin ? titik(v.jt_admin) : ""}"></div>
          <div class="isian"><label for="jtj">Jumlah transaksi (boleh kosong)</label><input class="input" id="jtj" inputmode="numeric" value="${v.jt_jumlah || ""}"></div>
        </div>
        <div class="catatan info" id="ringkas"></div>
      </div>
      <div class="isian"><label for="cat">Catatan (boleh kosong)</label><input class="input" id="cat" value="${esc(v.catatan || "")}"></div>
      <button class="tombol blok" id="simpan">Simpan</button>
    </form>`;
  pasangUang(main);
  const f = main.querySelector("#form"), $ = s => f.querySelector(s);
  main.querySelector("#kemarin").onclick = () => (location.hash = "#/tutup-toko?tgl=" + geser(-1));
  const bs = main.querySelector("#besok"); if (bs) bs.onclick = () => (location.hash = "#/tutup-toko?tgl=" + geser(1));
  const hitung = () => {
    $("#isian-buka").classList.toggle("hidden", $("#tutup").checked);
    const tot = angka($("#tunai").value) + angka($("#transfer").value) + angka($("#jta").value);
    const jt = angka($("#jtn").value);
    $("#ringkas").innerHTML = `<b>Pendapatan hari ini: ${rp(tot)}</b>${rata ? `<span>Rata-rata 30 hari terakhir: ${rp(rata)}</span>` : ""}${jt ? `<span>${rp(jt)} uang pelanggan hanya berpindah: keluar dari ${esc(dom($("#jtd").value).nama)}, masuk ke laci.</span>` : ""}`;
  };
  f.addEventListener("input", hitung); f.addEventListener("change", hitung); hitung();
  f.onsubmit = async e => {
    e.preventDefault();
    const tutup = $("#tutup").checked;
    const row = { tanggal: tgl, tutup, tunai: tutup ? 0 : angka($("#tunai").value), transfer: tutup ? 0 : angka($("#transfer").value), dompet_transfer: $("#dtransfer").value, jt_nominal: tutup ? 0 : angka($("#jtn").value), jt_admin: tutup ? 0 : angka($("#jta").value), jt_jumlah: tutup ? 0 : angka($("#jtj").value), jt_dompet: $("#jtd").value, catatan: $("#cat").value.trim(), oleh: S.user, diubah: new Date().toISOString() };
    if (!tutup && !row.tunai && !row.transfer && !row.jt_admin && !row.jt_nominal) return toast("Isi penjualan, atau centang toko tutup.", true);
    const sumber = "tutup:" + tgl;
    const ops = S.data.transaksi.filter(t => t.sumber === sumber).map(t => ({ tabel: "transaksi", hapus: t.id }));
    const T = (jenis, kategori, dompet, nominal, keterangan, tujuan = "") => ({ tabel: "transaksi", simpan: { id: idBaru("T"), tanggal: tgl, jenis, kategori, dompet, dompet_tujuan: tujuan, nominal, keterangan, perjalanan: "", tagihan: "", nota: "", sumber, catatan: "", hapus: false } });
    if (!tutup) {
      if (row.tunai) ops.push(T("masuk", "penjualan", "cash-toko", row.tunai, "Penjualan tunai"));
      if (row.transfer) ops.push(T("masuk", "penjualan", row.dompet_transfer, row.transfer, "Penjualan transfer/QRIS"));
      if (row.jt_nominal) ops.push(T("pindah", "pindah", row.jt_dompet, row.jt_nominal, `Uang jasa transfer pelanggan${row.jt_jumlah ? ` (${row.jt_jumlah} trx)` : ""}`, "cash-toko"));
      if (row.jt_admin) ops.push(T("masuk", "admin-transfer", "cash-toko", row.jt_admin, `Admin jasa transfer${row.jt_jumlah ? ` (${row.jt_jumlah} trx)` : ""}`));
    }
    ops.push({ tabel: "tutup_toko", simpan: row });
    const b = $("#simpan"); b.disabled = true; b.textContent = "Menyimpan…";
    try {
      await simpan(ops);
      lokal.set("toko-dompet-transfer", row.dompet_transfer); lokal.set("toko-dompet-jt", row.jt_dompet);
      toast("Tutup toko tersimpan"); location.hash = "#/beranda";
    } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Simpan"; }
  };
}

// ---------- Riwayat ----------
export function riwayat(main, _, q) {
  let batas = 60, saring = q.oleh || "semua", cari = "";
  const pengguna = S.data.pengguna.filter(u => u.aktif !== false);
  const gambar = () => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    const list = S.data.transaksi.filter(t => aktif(t) && (saring === "semua" || t.oleh === saring) && kata.every(k => `${t.keterangan} ${kat(t.kategori).nama} ${dom(t.dompet).nama}`.toLowerCase().includes(k)))
      .slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : String(a.dibuat) < String(b.dibuat) ? 1 : -1));
    let tgl = "", html = "";
    list.slice(0, batas).forEach(t => { if (t.tanggal !== tgl) { tgl = t.tanggal; html += `<div class="tglgrup">${tglPanjang(tgl)}</div>`; } html += kartuTransaksi(t, { namaPengguna }); });
    main.querySelector("#daftar").innerHTML = html || '<p class="muted small">Tidak ada catatan.</p>';
    main.querySelector("#lagi").classList.toggle("hidden", list.length <= batas);
  };
  main.innerHTML = `
    <form class="cari" id="cari" role="search">${IKON.cari}<input id="q" placeholder="Cari catatan…" autocomplete="off" aria-label="Cari catatan"></form>
    <div class="chips" id="chips"><button data-v="semua" class="on">Semua</button>${pengguna.map(u => `<button data-v="${esc(u.username)}">${esc(u.nama)}</button>`).join("")}</div>
    <div class="daftar" id="daftar"></div>
    <button class="tombol garis" id="lagi">Tampilkan lebih banyak</button>`;
  main.querySelector("#cari").onsubmit = e => e.preventDefault();
  main.querySelector("#q").oninput = e => { cari = e.target.value; batas = 60; gambar(); };
  main.querySelector("#chips").onclick = e => { const b = e.target.closest("button"); if (!b) return; saring = b.dataset.v; main.querySelectorAll("#chips button").forEach(x => x.classList.toggle("on", x === b)); gambar(); };
  main.querySelector("#lagi").onclick = () => { batas += 60; gambar(); };
  gambar();
}
