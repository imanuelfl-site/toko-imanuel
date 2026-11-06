// A4 Cek harga barang.
import { S, simpan } from "../data.js";
import { angka, cariBarang, hariIni, satukanNama, lapisan, teksLapisan } from "../hitung.js";
import { esc, rp, IKON, toast, formDialog, tglPendek, fotoUrl, lihatFoto } from "../ui.js";

export function cekHarga(main, _, q) {
  let teks = q.q || "", supplier = "", tampilModal = false;
  const sup = id => (S.data.supplier.find(s => s.id === id) || {}).nama || "";
  const pakaiSup = S.data.supplier.filter(s => S.data.barang.some(b => b.supplier === s.id));
  main.innerHTML = `
    <form class="cari" id="cari" role="search">${IKON.cari}<input id="q" placeholder="Cari harga barang…" autocomplete="off" value="${esc(teks)}" aria-label="Cari harga barang"><button type="button" class="ikonbtn" id="mata" aria-label="Tampilkan modal" title="Tampilkan modal" style="border:0">${IKON.mata}</button></form>
    <div class="chips" id="sup"><button data-v="" class="on">Semua</button>${pakaiSup.map(s => `<button data-v="${esc(s.id)}">${esc(s.nama)}</button>`).join("")}</div>
    <div class="baris"><span class="subjudul" id="jumlah"></span><span class="tiny muted" id="ket-modal">modal disembunyikan</span></div>
    <div class="daftar" id="hasil"></div>`;
  const gambar = () => {
    let list;
    if (teks.trim()) list = cariBarang(supplier ? S.data.barang.filter(b => b.supplier === supplier) : S.data.barang, teks, 80);
    else {
      list = satukanNama(S.data.barang.filter(b => b.aktif && (!supplier || b.supplier === supplier))).sort((a, b) => String(b.terakhir_beli).localeCompare(String(a.terakhir_beli)));
      if (!supplier) list = list.slice(0, 40);
    }
    main.querySelector("#jumlah").textContent = teks.trim() || supplier ? `${list.length} barang` : "Terakhir dibeli";
    main.querySelector("#ket-modal").textContent = tampilModal ? "modal ditampilkan" : "modal disembunyikan";
    main.querySelector("#hasil").innerHTML = list.map(b => {
      const ada = angka(b.harga_jual) > 0, src = fotoUrl(b.foto, 160), lap = teksLapisan(lapisan(b));
      return `<div class="harga ${ada ? "" : "kosong"} ${src ? "pakai-foto" : ""}">
        ${src ? `<span class="foto-kecil" data-lihat="${esc(b.id)}"><img src="${esc(src)}" alt="" loading="lazy"></span>` : ""}
        <b>${esc(b.nama)}</b>
        <span class="rp">${ada ? rp(b.harga_jual) : "belum ada harga"}</span>
        <span class="meta">per ${esc(b.satuan_jual || "buah")}${lap ? " · " + esc(lap) : ""}${sup(b.supplier) ? " · " + esc(sup(b.supplier)) : ""}${b.terakhir_beli ? " · dibeli " + tglPendek(b.terakhir_beli) : ""}${tampilModal ? ` · <b>modal ${rp(b.modal)}</b>` : ""}</span>
        <button class="${ada ? "link tiny" : "tombol kecil"}" data-isi="${esc(b.id)}" data-kembar="${esc(b._kembar.join(","))}">${ada ? "Ubah" : "Isi harga"}</button>
      </div>`;
    }).join("") || '<p class="muted small">Tidak ada barang yang cocok. Coba kata lain.</p>';
  };
  const inp = main.querySelector("#q");
  inp.oninput = () => { teks = inp.value; gambar(); };
  main.querySelector("#cari").onsubmit = e => e.preventDefault();
  main.querySelector("#mata").onclick = () => { tampilModal = !tampilModal; gambar(); };
  main.querySelector("#sup").onclick = e => { const b = e.target.closest("button"); if (!b) return; supplier = b.dataset.v; main.querySelectorAll("#sup button").forEach(x => x.classList.toggle("on", x === b)); gambar(); };
  main.querySelector("#hasil").onclick = async e => {
    const lihat = e.target.closest("[data-lihat]");
    if (lihat) { const b = S.data.barang.find(x => x.id === lihat.dataset.lihat); return lihatFoto(fotoUrl(b.foto, 1200), b.nama); }
    const btn = e.target.closest("[data-isi]"); if (!btn) return;
    const b = S.data.barang.find(x => x.id === btn.dataset.isi);
    const r = await formDialog(b.nama, [
      { id: "harga_jual", label: `Harga jual per ${b.satuan_jual || "buah"}${tampilModal ? ` (modal ${rp(b.modal)})` : ""}`, type: "uang", value: angka(b.harga_jual) }
    ]);
    if (!r || !r.harga_jual) return;
    // Barang bernama sama ikut diubah supaya harganya seragam
    const ops = btn.dataset.kembar.split(",").filter(Boolean).map(id => S.data.barang.find(x => x.id === id)).filter(Boolean)
      .map(x => ({ tabel: "barang", simpan: { ...x, harga_jual: r.harga_jual, harga_diubah: hariIni() } }));
    try { await simpan(ops); toast("Harga tersimpan"); gambar(); }
    catch (err) { toast(err.message, true); }
  };
  gambar();
  inp.focus();
  const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {}
}
