// A4 Cek harga barang.
import { S, simpan, pengaturan } from "../data.js";
import { angka, cariBarang, hargaSaran, hariIni } from "../hitung.js";
import { esc, rp, IKON, toast, formDialog, tglPendek } from "../ui.js";

export function cekHarga(main, _, q) {
  let teks = q.q || "", kelompok = "", tampilModal = false;
  const kel = S.data.kelompok;
  const markup = id => angka((kel.find(k => k.id === id) || {}).markup) || 30;
  const sup = id => (S.data.supplier.find(s => s.id === id) || {}).nama || "";
  main.innerHTML = `
    <form class="cari" id="cari" role="search">${IKON.cari}<input id="q" placeholder="Cari harga barang…" autocomplete="off" value="${esc(teks)}" aria-label="Cari harga barang"><button type="button" class="ikonbtn" id="mata" aria-label="Tampilkan modal" title="Tampilkan modal" style="border:0">${IKON.mata}</button></form>
    <div class="chips" id="kel"><button data-v="" class="on">Semua</button>${kel.map(k => `<button data-v="${esc(k.id)}">${esc(k.nama)}</button>`).join("")}</div>
    <div class="baris"><span class="subjudul" id="jumlah"></span><span class="tiny muted" id="ket-modal">modal disembunyikan</span></div>
    <div class="daftar" id="hasil"></div>`;
  const gambar = () => {
    let list = teks.trim() ? cariBarang(S.data.barang, teks, 80) : S.data.barang.filter(b => b.aktif).slice().sort((a, b) => String(b.terakhir_beli).localeCompare(String(a.terakhir_beli))).slice(0, 40);
    if (kelompok) list = list.filter(b => b.kelompok === kelompok);
    main.querySelector("#jumlah").textContent = teks.trim() ? `${list.length} barang` : "Terakhir dibeli";
    main.querySelector("#ket-modal").textContent = tampilModal ? "modal ditampilkan" : "modal disembunyikan";
    main.querySelector("#hasil").innerHTML = list.map(b => {
      const ada = angka(b.harga_jual) > 0;
      const saran = hargaSaran(b.modal, markup(b.kelompok), angka(pengaturan("pembulatan_harga", 500)) || 500);
      return `<div class="harga ${ada ? "" : "kosong"}">
        <b>${esc(b.nama)}</b>
        <span class="rp">${ada ? rp(b.harga_jual) : "belum ada harga"}</span>
        <span class="meta">per ${esc(b.satuan_jual || "buah")}${sup(b.supplier) ? " · " + esc(sup(b.supplier)) : ""}${b.terakhir_beli ? " · dibeli " + tglPendek(b.terakhir_beli) : ""}${tampilModal ? ` · <b>modal ${rp(b.modal)}</b>` : ""}</span>
        <button class="${ada ? "link tiny" : "tombol kecil"}" data-isi="${esc(b.id)}" data-saran="${saran}">${ada ? "Ubah" : `Isi harga${saran ? ` (saran ${rp(saran)})` : ""}`}</button>
      </div>`;
    }).join("") || '<p class="muted small">Tidak ada barang yang cocok. Coba kata lain.</p>';
  };
  const inp = main.querySelector("#q");
  inp.oninput = () => { teks = inp.value; gambar(); };
  main.querySelector("#cari").onsubmit = e => e.preventDefault();
  main.querySelector("#mata").onclick = () => { tampilModal = !tampilModal; gambar(); };
  main.querySelector("#kel").onclick = e => { const b = e.target.closest("button"); if (!b) return; kelompok = b.dataset.v; main.querySelectorAll("#kel button").forEach(x => x.classList.toggle("on", x === b)); gambar(); };
  main.querySelector("#hasil").onclick = async e => {
    const btn = e.target.closest("[data-isi]"); if (!btn) return;
    const b = S.data.barang.find(x => x.id === btn.dataset.isi);
    const r = await formDialog(b.nama, [
      { id: "harga_jual", label: `Harga jual per ${b.satuan_jual || "buah"}${tampilModal ? ` (modal ${rp(b.modal)})` : ""}`, type: "uang", value: angka(b.harga_jual) || angka(btn.dataset.saran) },
      { id: "satuan_jual", label: "Satuan jual", value: b.satuan_jual || "bh" }
    ]);
    if (!r || !r.harga_jual) return;
    try { await simpan([{ tabel: "barang", simpan: { ...b, harga_jual: r.harga_jual, satuan_jual: r.satuan_jual || b.satuan_jual, harga_diubah: hariIni() } }]); toast("Harga tersimpan"); gambar(); }
    catch (err) { toast(err.message, true); }
  };
  gambar();
  inp.focus();
  const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {}
}
