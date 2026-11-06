// Aplikasi Toko Imanuel: login, kerangka halaman, dan rute.
import { api, sesi, bacaCache, GalatSesi, DEMO } from "./api.js";
import { S, pasangData, muatServer } from "./data.js";
import { esc, IKON, toast } from "./ui.js";
import * as isi from "./halaman/isi.js";
import * as nota from "./halaman/nota.js";
import * as harga from "./halaman/harga.js";
import * as laporan from "./halaman/laporan.js";
import * as kelola from "./halaman/kelola.js";

const app = document.getElementById("app");

// Rute: [pola, judul, fungsi render, tab aktif, lebar]
const RUTE = [
  [/^beranda$/, "", isi.beranda, "isi"],
  [/^catat\/(masuk|keluar|pindah)$/, "Catat uang", isi.catat, "isi"],
  [/^catat\/ubah\/(.+)$/, "Ubah catatan", isi.catat, "riwayat"],
  [/^tutup-toko$/, "Tutup toko", isi.tutupToko, "isi"],
  [/^nota$/, "Nota belanja", nota.nota, "isi"],
  [/^harga$/, "Cek harga", harga.cekHarga, "isi"],
  [/^riwayat$/, "Riwayat", isi.riwayat, "riwayat"],
  [/^laporan$/, "Laporan", laporan.menu, "laporan", true],
  [/^dashboard$/, "Dashboard", laporan.dashboard, "laporan", true],
  [/^laba$/, "Keuangan", laporan.laba, "laporan", true],
  [/^buku-kas$/, "Buku kas", laporan.bukuKas, "laporan", true],
  [/^tutup-buku$/, "Tutup buku", kelola.tutupBuku, "laporan", true],
  [/^perjalanan$/, "Perjalanan", kelola.perjalanan, "laporan", true],
  [/^tagihan$/, "Tagihan rutin", kelola.tagihan, "laporan", true],
  [/^data$/, "Data induk", kelola.dataInduk, "laporan", true],
  [/^akun$/, "Akun", kelola.akun, "laporan"]
];

function temaToggle() {
  const r = document.documentElement;
  const kini = r.getAttribute("data-mode") === "dark" ? "dark" : "light";
  const baru = kini === "dark" ? "light" : "dark";
  r.setAttribute("data-theme", baru); r.setAttribute("data-mode", baru);
  try { localStorage.setItem("toko-tema", baru); } catch (e) {}
}
window.matchMedia && matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", e => {
  if (!document.documentElement.getAttribute("data-theme")) document.documentElement.setAttribute("data-mode", e.matches ? "dark" : "light");
});

function kerangka(judul, tab, lebar, kembali) {
  app.innerHTML = `
    <header class="topbar">
      ${kembali ? `<button class="kembali" data-kembali aria-label="Kembali">${IKON.kembali}</button>` : ""}
      <div class="judul">${judul ? `<h1>${esc(judul)}</h1>` : `<img class="logo" src="img/logo-ikon.png" alt="" width="34" height="34"><h1>Toko <span style="color:var(--brand-ink)">Imanuel</span></h1>`}</div>
      ${DEMO ? '<span class="st warn">demo</span>' : ""}
      <button class="ikonbtn" data-tema aria-label="Ganti mode terang atau gelap" title="Mode terang/gelap">${IKON.bulan}${IKON.matahari}</button>
    </header>
    <main class="${lebar ? "" : "sempit"}" id="isi"></main>
    <nav class="tabbar" aria-label="Menu utama">
      <a href="#/beranda" class="${tab === "isi" ? "on" : ""}">${IKON.rumah}<span>Isi data</span></a>
      <a href="#/riwayat" class="${tab === "riwayat" ? "on" : ""}">${IKON.riwayat}<span>Riwayat</span></a>
      <a href="#/laporan" class="${tab === "laporan" ? "on" : ""}">${IKON.laporan}<span>Laporan</span></a>
    </nav>`;
  app.querySelector("[data-tema]").onclick = temaToggle;
  const k = app.querySelector("[data-kembali]");
  if (k) k.onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/beranda"));
  return app.querySelector("#isi");
}

let ruteAktif = "";
export function render() {
  if (!S.data) return;
  const h = decodeURIComponent((location.hash || "#/beranda").replace(/^#\/?/, ""));
  const [jalur, qs] = h.split("?");
  const cocok = RUTE.find(([re]) => re.test(jalur)) || RUTE[0];
  const m = jalur.match(cocok[0]) || [];
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  const main = kerangka(cocok[1], cocok[3], cocok[4], cocok[1] && !["riwayat", "laporan"].includes(jalur));
  ruteAktif = jalur;
  window.scrollTo(0, 0);
  try { cocok[2](main, m.slice(1), params); }
  catch (e) { console.error(e); main.innerHTML = `<div class="catatan bad"><b>Halaman gagal ditampilkan</b><span>${esc(e.message)}</span></div>`; }
}
window.addEventListener("hashchange", render);

function layarLogin(pesan = "") {
  app.innerHTML = `<div class="login"><form class="kartu" id="form-login">
    <img src="img/logo-toko.png" alt="Logo Toko Imanuel" width="128" height="128">
    <h1 style="text-align:center">Toko <span style="color:var(--brand-ink)">Imanuel</span></h1>
    ${DEMO ? '<div class="catatan warn">Mode demo: data hanya di browser ini. Nama pengguna: imanuel atau istri, password bebas.</div>' : ""}
    <div class="isian"><label for="u">Nama pengguna</label><input class="input" id="u" autocomplete="username" autocapitalize="none" required></div>
    <div class="isian"><label for="p">Password</label><input class="input" id="p" type="password" autocomplete="current-password" required></div>
    <div id="pesan" class="${pesan ? "catatan bad" : "hidden"}">${esc(pesan)}</div>
    <button class="tombol blok" id="masuk">Masuk</button>
  </form></div>`;
  const f = app.querySelector("#form-login");
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector("#masuk"); b.disabled = true; b.textContent = "Memeriksa…";
    try {
      const r = await api.login(f.querySelector("#u").value.trim(), f.querySelector("#p").value);
      sesi.simpan(r);
      await mulai(true);
    } catch (err) {
      b.disabled = false; b.textContent = "Masuk";
      const p = f.querySelector("#pesan"); p.className = "catatan bad"; p.textContent = err.message;
    }
  };
}

export function keluar() { sesi.hapus(); S.data = null; layarLogin(); }

async function mulai(baruLogin = false) {
  S.user = sesi.user; S.nama = sesi.nama;
  const cache = !baruLogin && bacaCache();
  if (cache) { pasangData(cache); render(); }
  else app.innerHTML = '<div class="memuat"><div class="putar"></div><span>Memuat data toko…</span></div>';
  try {
    await muatServer();
    // Jangan ganggu orang yang sedang mengisi formulir.
    const sedangIsi = /^(catat|tutup-toko|nota|tutup-buku)/.test(ruteAktif) && cache;
    if (!sedangIsi) render();
  } catch (e) {
    if (e instanceof GalatSesi) { sesi.hapus(); layarLogin(e.message); return; }
    if (cache) toast("Memakai data tersimpan di HP: " + e.message, true);
    else app.innerHTML = `<div class="login"><div class="kartu"><h2>Data gagal dimuat</h2><p>${esc(e.message)}</p><button class="tombol" onclick="location.reload()">Coba lagi</button><button class="link" id="keluar">Keluar</button></div></div>`, app.querySelector("#keluar").onclick = keluar;
  }
}

export async function segarkan() {
  try { await muatServer(); render(); toast("Data terbaru dimuat"); }
  catch (e) { if (e instanceof GalatSesi) keluar(); else toast(e.message, true); }
}

if (sesi.token) mulai(); else layarLogin();
