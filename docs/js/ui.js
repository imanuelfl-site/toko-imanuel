// Alat bantu tampilan.
import { S, kat, dom } from "./data.js";
import { angka } from "./hitung.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const titik = n => Math.round(Math.abs(angka(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const rp = n => (angka(n) < 0 ? "−Rp" : "Rp") + titik(n);
export const rpTanda = n => (angka(n) > 0 ? "+" : angka(n) < 0 ? "−" : "") + "Rp" + titik(n);
export const persen = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const tglPendek = s => { if (!s) return "tanpa tanggal"; const [y, m, d] = s.slice(0, 10).split("-").map(Number); return `${d} ${BLN[m - 1]}`; };
export const tglPanjang = s => { if (!s) return "tanpa tanggal"; const [y, m, d] = s.slice(0, 10).split("-").map(Number); const dt = new Date(y, m - 1, d); return `${HARI[dt.getDay()]}, ${d} ${BLN[m - 1]} ${y}`; };
export const namaBulan = b => { const [y, m] = b.split("-").map(Number); return `${BULAN[m - 1]} ${y}`; };
export const namaBulanPendek = b => { const [y, m] = b.split("-").map(Number); return `${BLN[m - 1]} ${String(y).slice(2)}`; };

export const IKON = {
  cari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bulan: '<svg class="ikon-bulan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  matahari: '<svg class="ikon-matahari" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  kembali: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  mata: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  rumah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  riwayat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  laporan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
};

export function toast(pesan, galat = false) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "toast" + (galat ? " galat" : "");
  t.setAttribute("role", galat ? "alert" : "status");
  t.textContent = pesan;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), galat ? 5000 : 2200);
}

// Dialog konfirmasi sendiri (confirm() bawaan tidak dipakai).
export function tanya(judul, pesan, ya = "Ya", bahaya = false) {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.innerHTML = `<div class="isi"><h3>${esc(judul)}</h3><p class="small">${esc(pesan)}</p><div class="baris"><button class="tombol garis" data-v="0">Batal</button><button class="tombol ${bahaya ? "hapus" : ""}" data-v="1">${esc(ya)}</button></div></div>`;
    document.body.appendChild(d);
    d.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) { d.close(); d.remove(); res(b.dataset.v === "1"); } });
    d.addEventListener("cancel", () => { d.remove(); res(false); });
    d.showModal();
  });
}

// Dialog isian kecil. fields: [{ id, label, value, type, options }]
export function formDialog(judul, fields, simpanLabel = "Simpan") {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.innerHTML = `<form class="isi" method="dialog"><h3>${esc(judul)}</h3>${fields.map(f => isian(f)).join("")}<div class="baris"><button type="button" class="tombol garis" data-batal>Batal</button><button class="tombol">${esc(simpanLabel)}</button></div></form>`;
    document.body.appendChild(d);
    pasangUang(d);
    const form = d.querySelector("form");
    d.querySelector("[data-batal]").onclick = () => { d.close(); d.remove(); res(null); };
    form.onsubmit = e => {
      e.preventDefault();
      const out = {};
      fields.forEach(f => { const el = form.querySelector(`[name="${f.id}"]`); out[f.id] = f.type === "checkbox" ? el.checked : f.type === "uang" ? angka(el.value) : el.value.trim(); });
      d.close(); d.remove(); res(out);
    };
    d.addEventListener("cancel", () => { d.remove(); res(null); });
    d.showModal();
  });
}

export function isian(f) {
  const id = `f-${f.id}`;
  if (f.type === "select") return `<div class="isian"><label for="${id}">${esc(f.label)}</label><select class="input" id="${id}" name="${f.id}">${f.options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`;
  if (f.type === "checkbox") return `<label class="saklar" for="${id}"><span>${esc(f.label)}</span><input type="checkbox" id="${id}" name="${f.id}" ${f.value ? "checked" : ""}></label>`;
  if (f.type === "uang") return `<div class="isian"><label for="${id}">${esc(f.label)}</label><input class="input uang" inputmode="numeric" id="${id}" name="${f.id}" value="${f.value ? titik(f.value) : ""}" placeholder="0"></div>`;
  return `<div class="isian"><label for="${id}">${esc(f.label)}</label><input class="input" type="${f.type || "text"}" id="${id}" name="${f.id}" value="${esc(f.value ?? "")}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}></div>`;
}

// Input rupiah: tampil dengan titik ribuan.
export function pasangUang(root) {
  root.querySelectorAll("input.uang").forEach(el => {
    if (el.dataset.uang) return;
    el.dataset.uang = "1";
    el.addEventListener("input", () => {
      const pos = el.value.length - el.selectionStart;
      const n = el.value.replace(/[^\d]/g, "");
      el.value = n ? Number(n).toLocaleString("id-ID") : "";
      const p = Math.max(0, el.value.length - pos);
      try { el.setSelectionRange(p, p); } catch (e) {}
    });
  });
}

export const tagPos = pos => pos === "toko" ? '<span class="tag toko">Toko</span>' : pos === "pribadi" ? '<span class="tag pribadi">Pribadi</span>' : '<span class="tag khusus">Khusus</span>';

export function opsiKategori(jenis, pilih) {
  const list = S.data.kategori.filter(k => k.aktif && k.jenis === jenis && k.peran !== "penyesuaian");
  const grup = g => list.filter(k => k.pos === g);
  const opt = k => `<option value="${esc(k.id)}" ${k.id === pilih ? "selected" : ""}>${esc(k.nama)}</option>`;
  return `<option value="">Pilih kategori…</option><optgroup label="Toko">${grup("toko").map(opt).join("")}</optgroup><optgroup label="Pribadi">${grup("pribadi").map(opt).join("")}</optgroup>${grup("khusus").length ? `<optgroup label="Khusus">${grup("khusus").map(opt).join("")}</optgroup>` : ""}`;
}

export function opsiDompet(pilih, kosong = false) {
  const list = S.data.dompet.filter(d => d.aktif || d.id === pilih);
  const opt = d => `<option value="${esc(d.id)}" ${d.id === pilih ? "selected" : ""}>${esc(d.nama)}</option>`;
  return `${kosong ? '<option value="">–</option>' : ""}<optgroup label="Toko">${list.filter(d => d.pemilik === "toko").map(opt).join("")}</optgroup><optgroup label="Pribadi">${list.filter(d => d.pemilik === "pribadi").map(opt).join("")}</optgroup>`;
}

// Satu baris transaksi untuk daftar (riwayat, beranda, perjalanan).
export function kartuTransaksi(t, { tampilOleh = true, namaPengguna = u => u } = {}) {
  const k = kat(t.kategori);
  const tanda = t.jenis === "masuk" ? "plus" : t.jenis === "keluar" ? "minus" : "";
  const nominal = (t.jenis === "masuk" ? "+" : t.jenis === "keluar" ? "−" : "") + "Rp" + titik(t.nominal);
  const dompetTeks = t.jenis === "pindah" ? `${dom(t.dompet).nama} → ${dom(t.dompet_tujuan).nama}` : dom(t.dompet).nama;
  const prive = t.jenis !== "pindah" && k.pos === "pribadi" && dom(t.dompet).pemilik === "toko";
  return `<a class="trx" href="#/catat/ubah/${encodeURIComponent(t.id)}">
    <span>${esc(t.keterangan || k.nama)}</span><span class="n ${tanda}">${nominal}</span>
    <span class="k">${esc(k.nama)} · ${esc(dompetTeks)}${tampilOleh && t.oleh ? ` · oleh ${esc(namaPengguna(t.oleh))}` : ""}</span>
    <span class="k">${prive ? '<span class="st warn">pribadi dari toko</span>' : ""}</span>
  </a>`;
}
