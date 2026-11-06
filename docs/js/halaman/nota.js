// A3 Nota belanja: barang dari supplier, satuan berlapis, modal per satuan jual, harga jual, foto, dan pembayaran.
import { S, simpan, idBaru, dom, pengaturan, unggahFoto } from "../data.js";
import { hariIni, angka, cariBarang, hargaIkutModal, untungPersen, lapisan, isiTotal, kolomLapisan, kunciNama } from "../hitung.js";
import { esc, rp, titik, toast, pasangUang, opsiDompet, formDialog, tglPendek, fotoUrl, htmlFoto, pasangFoto, htmlLapisan, segarkanLapisan, DAFTAR_SATUAN } from "../ui.js";

const bulat = () => angka(pengaturan("pembulatan_harga", 500)) || 500;

export function nota(main, _, q) {
  const st = { supplier: q.supplier || "", tanggal: hariIni(), dompet: "seabank-cendana", items: [] };
  const itemBaru = () => ({ uid: Math.random().toString(36).slice(2), barang: "", nama: "", qty: 1, L: [{ satuan: "", isi: 1 }], harga: 0, jual: 0, keputusan: "", foto: null, fotoLama: "" });
  const akhir = it => it.L[it.L.length - 1].satuan || "bh";

  main.innerHTML = `
    <form class="tumpuk" id="form">
      <div class="grid2">
        <div class="isian"><label for="supplier">Supplier</label><select class="input" id="supplier"><option value="">Pilih supplier…</option>${S.data.supplier.filter(s => s.aktif).map(s => `<option value="${esc(s.id)}" ${s.id === st.supplier ? "selected" : ""}>${esc(s.nama)}</option>`).join("")}<option value="__baru">＋ Supplier baru…</option></select><span class="tiny muted" id="info-sup"></span></div>
        <div class="isian"><label for="tanggal">Tanggal nota</label><input class="input" type="date" id="tanggal" value="${st.tanggal}"></div>
      </div>
      <div class="catatan info"><b>Satuan berlapis</b><span>Satuan-1 adalah satuan waktu membeli (misalnya dus). Kalau di dalamnya ada isi, isi satuan-2, lalu satuan-3 dan satuan-4 bila berlapis lagi. Harga jual selalu per satuan terakhir.</span></div>
      <div class="tumpuk" id="items"></div>
      ${DAFTAR_SATUAN}
      <button type="button" class="tombol garis" id="tambah">＋ Tambah barang</button>
      <div class="kartu" id="ringkas"></div>
      <div class="isian"><label for="dompet">Dibayar dari</label><select class="input" id="dompet">${opsiDompet(st.dompet)}</select></div>
      <button class="tombol blok" id="simpan">Simpan nota</button>
    </form>`;
  pasangUang(main);
  const f = main.querySelector("#form"), $ = s => f.querySelector(s);

  const infoSupplier = () => {
    const notaTerakhir = S.data.nota.filter(n => n.supplier === st.supplier && n.tanggal).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))[0];
    $("#info-sup").textContent = notaTerakhir ? `nota terakhir ${tglPendek(notaTerakhir.tanggal)}` : "";
  };
  $("#supplier").onchange = async () => {
    if ($("#supplier").value === "__baru") {
      const r = await formDialog("Supplier baru", [{ id: "nama", label: "Nama supplier" }]);
      if (!r || !r.nama) { $("#supplier").value = st.supplier; return; }
      const row = { id: idBaru("S"), nama: r.nama, aktif: true, urutan: S.data.supplier.length + 1 };
      try { await simpan([{ tabel: "supplier", simpan: row }]); } catch (e) { toast(e.message, true); $("#supplier").value = st.supplier; return; }
      $("#supplier").insertAdjacentHTML("afterbegin", `<option value="${esc(row.id)}">${esc(row.nama)}</option>`);
      $("#supplier").value = row.id;
    }
    st.supplier = $("#supplier").value; infoSupplier();
  };
  $("#tanggal").onchange = () => (st.tanggal = $("#tanggal").value);
  $("#dompet").onchange = () => (st.dompet = $("#dompet").value);

  const fotoSrc = it => (it.foto ? it.foto.url : fotoUrl(it.fotoLama));

  function htmlItem(it, i) {
    return `<div class="item" data-uid="${it.uid}">
      <div class="baris"><b>Barang ${i + 1}</b><button type="button" class="link" data-hapus>Hapus</button></div>
      <div class="isian saran"><label>Nama barang</label><input class="input" data-f="nama" value="${esc(it.nama)}" placeholder="ketik untuk mencari…" autocomplete="off"><div class="saran-list hidden"></div></div>
      ${htmlLapisan(it.L, { jumlah: it.qty })}
      <div class="g2">
        <div class="isian"><label>Harga per <span data-lbl-beli>${esc(it.L[0].satuan || "satuan-1")}</span></label><input class="input uang" data-f="harga" inputmode="numeric" value="${it.harga ? titik(it.harga) : ""}" placeholder="Rp0"></div>
        <div class="isian"><label>Harga jual per <span data-lbl-jual>${esc(akhir(it))}</span></label><input class="input uang" data-f="jual" inputmode="numeric" value="${it.jual ? titik(it.jual) : ""}" placeholder="Rp0"></div>
      </div>
      ${htmlFoto(fotoSrc(it))}
      <div data-info class="small"></div>
    </div>`;
  }

  function segarkanSatuan(el, it) {
    it.L = segarkanLapisan(el.querySelector("[data-lapis]"), it.qty);
    el.querySelector("[data-lbl-beli]").textContent = el.querySelector('[data-sat="1"]').value.trim() || "satuan-1";
    el.querySelector("[data-lbl-jual]").textContent = akhir(it);
  }

  function hitungItem(el, it) {
    const b = S.data.barang.find(x => x.id === it.barang);
    const sj = akhir(it), modal = it.harga / isiTotal(it.L);
    const info = el.querySelector("[data-info]");
    el.classList.remove("peringatan");
    const ajakFoto = !it.foto && !it.fotoLama ? ' <span class="muted">Tambahkan foto supaya mudah dikenali.</span>' : "";
    if (!it.harga) {
      info.innerHTML = b ? `<span class="muted">Modal terakhir ${rp(b.modal)}/${esc(b.satuan_jual || sj)}${b.harga_jual ? ` · jual ${rp(b.harga_jual)}` : ""}</span>` : (it.nama.trim() ? `<span class="muted">Barang baru.</span>${ajakFoto}` : "");
      return;
    }
    const p = untungPersen(modal, it.jual);
    let html = `<div class="baris"><span class="muted">Total ${rp(it.qty * it.harga)} · modal ${rp(modal)}/${esc(sj)}</span>${it.jual ? `<span class="${it.jual <= modal ? "minus" : "plus"}">untung ${rp(it.jual - modal)}/${esc(sj)}${p !== null ? ` (${p}%)` : ""}</span>` : ""}</div>`;
    if (b && b.modal && modal > b.modal * 1.005 && it.keputusan) {
      html += `<div class="catatan ok">Modal naik ${rp(modal - b.modal)}/${esc(sj)}. Harga jual ${it.keputusan === "pakai" ? "diubah ke" : "tetap"} ${rp(it.jual)}.</div>`;
    } else if (b && b.modal && modal > b.modal * 1.005) {
      const saran = hargaIkutModal(b.modal, b.harga_jual, modal, bulat());
      el.classList.add("peringatan");
      html += `<div class="catatan warn"><b>Harga dari supplier naik ${rp(modal - b.modal)}/${esc(sj)}</b><span>Modal lama ${rp(b.modal)}${b.harga_jual ? `, harga jual lama ${rp(b.harga_jual)}` : ""}.${saran ? ` Supaya untung per ${esc(sj)} tidak berkurang, saran harga jual ${rp(saran)}.` : ""}</span>
        <div class="baris">${saran ? `<button type="button" class="tombol kecil" data-pakai="${saran}">Pakai ${rp(saran)}</button>` : ""}<button type="button" class="tombol garis kecil" data-tetap>Tetap ${rp(it.jual || b.harga_jual)}</button></div></div>`;
    } else if (!b) {
      html += `<div class="muted">Barang baru: isi harga jual per ${esc(sj)} sendiri.${ajakFoto}</div>`;
    }
    info.innerHTML = html;
  }

  function pasangItem(el, it) {
    segarkanSatuan(el, it);
    hitungItem(el, it);
    pasangUang(el);
    pasangFoto(el, foto => { it.foto = foto; hitungItem(el, it); });
  }

  function gambarItems() {
    const box = $("#items");
    box.innerHTML = st.items.map(htmlItem).join("");
    box.querySelectorAll(".item").forEach(el => {
      const it = st.items.find(x => x.uid === el.dataset.uid);
      pasangItem(el, it);
      el.addEventListener("input", e => {
        const t = e.target;
        if (t.dataset.f === "nama") { it.nama = t.value; it.barang = ""; it.fotoLama = ""; tampilSaran(el, it); }
        else if (t.dataset.f === "qty") { it.qty = angka(t.value); segarkanSatuan(el, it); }
        else if (t.dataset.sat || t.dataset.isi) { segarkanSatuan(el, it); it.keputusan = ""; }
        else if (t.dataset.f === "harga" || t.dataset.f === "jual") { it[t.dataset.f] = angka(t.value); if (t.dataset.f === "harga") it.keputusan = ""; }
        else return;
        hitungItem(el, it); ringkas();
      });
      el.addEventListener("click", e => {
        if (e.target.closest("[data-hapus]")) { st.items = st.items.filter(x => x !== it); gambarItems(); ringkas(); return; }
        const p = e.target.closest("[data-pakai]");
        if (p) { it.jual = angka(p.dataset.pakai); it.keputusan = "pakai"; el.querySelector('[data-f="jual"]').value = titik(it.jual); hitungItem(el, it); ringkas(); return; }
        if (e.target.closest("[data-tetap]")) { const b = S.data.barang.find(x => x.id === it.barang); it.jual = it.jual || angka(b && b.harga_jual); it.keputusan = "tetap"; el.querySelector('[data-f="jual"]').value = it.jual ? titik(it.jual) : ""; hitungItem(el, it); return; }
        const pilih = e.target.closest("[data-barang]");
        if (pilih) pilihBarang(el, it, S.data.barang.find(x => x.id === pilih.dataset.barang));
      });
      el.querySelector('[data-f="nama"]').addEventListener("blur", () => setTimeout(() => el.querySelector(".saran-list").classList.add("hidden"), 200));
    });
  }

  function pilihBarang(el, it, b) {
    Object.assign(it, { barang: b.id, nama: b.nama, L: lapisan(b), jual: angka(b.harga_jual), fotoLama: b.foto || "", keputusan: "" });
    el.querySelector('[data-f="nama"]').value = b.nama;
    el.querySelector("[data-lapis]").outerHTML = htmlLapisan(it.L, { jumlah: it.qty });
    el.querySelector("[data-foto-box]").outerHTML = htmlFoto(fotoSrc(it));
    el.querySelector('[data-f="jual"]').value = it.jual ? titik(it.jual) : "";
    el.querySelector('[data-f="harga"]').placeholder = "terakhir " + rp(angka(b.modal) * isiTotal(it.L));
    el.querySelector(".saran-list").classList.add("hidden");
    pasangItem(el, it); ringkas();
    el.querySelector('[data-f="harga"]').focus();
  }

  function tampilSaran(el, it) {
    const list = el.querySelector(".saran-list");
    if (it.nama.trim().length < 2) { list.classList.add("hidden"); return; }
    let hasil = cariBarang(S.data.barang, it.nama, 30);
    hasil.sort((a, b) => (a.supplier === st.supplier ? 0 : 1) - (b.supplier === st.supplier ? 0 : 1));
    hasil = hasil.slice(0, 8);
    list.innerHTML = hasil.map(b => `<button type="button" data-barang="${esc(b.id)}"><span>${esc(b.nama)}</span><span class="muted small">${rp(b.modal)}/${esc(b.satuan_jual || "bh")}</span></button>`).join("") || '<div class="small muted" style="padding:10px 12px">Barang baru, belum ada di daftar.</div>';
    list.classList.remove("hidden");
  }

  function ringkas() {
    const isi = st.items.filter(i => i.nama && i.harga);
    const total = isi.reduce((s, i) => s + i.qty * i.harga, 0);
    const jual = isi.reduce((s, i) => s + i.qty * isiTotal(i.L) * (i.jual || 0), 0);
    const lengkap = isi.every(i => i.jual);
    $("#ringkas").innerHTML = `<div class="baris"><b>Total ${isi.length} barang</b><b style="font-family:var(--display);font-size:20px">${rp(total)}</b></div>
      ${jual ? `<div class="baris small muted"><span>Kalau semua terjual${lengkap ? "" : " (barang berharga jual saja)"}</span><span>${rp(jual)} · untung ${rp(jual - isi.filter(i => i.jual).reduce((s, i) => s + i.qty * i.harga, 0))}</span></div>` : ""}`;
  }

  $("#tambah").onclick = () => { st.items.push(itemBaru()); gambarItems(); ringkas(); const n = $("#items").querySelectorAll('[data-f="nama"]'); n[n.length - 1].focus(); };
  st.items.push(itemBaru()); gambarItems(); ringkas(); infoSupplier();

  f.onsubmit = async e => {
    e.preventDefault();
    const isi = st.items.filter(i => i.nama.trim());
    if (!st.supplier || st.supplier === "__baru") return toast("Pilih supplier.", true);
    if (!isi.length) return toast("Tambahkan minimal satu barang.", true);
    const kurang = isi.find(i => !i.qty || !i.harga);
    if (kurang) return toast(`Lengkapi jumlah dan harga untuk "${kurang.nama}".`, true);
    const btn = $("#simpan"); btn.disabled = true;
    const gagal = msg => { toast(msg, true); btn.disabled = false; btn.textContent = "Simpan nota"; };
    // Foto dulu: hasilnya ID file Drive yang disimpan di kolom barang.foto
    const perluFoto = isi.filter(i => i.foto && !i.foto.id);
    for (let n = 0; n < perluFoto.length; n++) {
      btn.textContent = `Mengunggah foto ${n + 1}/${perluFoto.length}…`;
      try { perluFoto[n].foto.id = await unggahFoto(perluFoto[n].foto, perluFoto[n].nama.trim()); }
      catch (err) { return gagal(err.message); }
    }
    btn.textContent = "Menyimpan…";
    const notaId = idBaru("N"), tId = idBaru("T");
    const total = Math.round(isi.reduce((s, i) => s + i.qty * i.harga, 0));
    const sup = S.data.supplier.find(s => s.id === st.supplier);
    const ops = [];
    isi.forEach(i => {
      const kol = kolomLapisan(i.L);
      const modal = Math.round(i.harga / kol.isi);
      let b = S.data.barang.find(x => x.id === i.barang);
      if (!b) b = S.data.barang.find(x => kunciNama(x.nama) === kunciNama(i.nama));
      const foto = i.foto ? i.foto.id : (b && b.foto) || "";
      const barangRow = b
        ? { ...b, ...kol, modal, supplier: st.supplier, terakhir_beli: st.tanggal, foto, harga_jual: i.jual || b.harga_jual, harga_diubah: i.jual && i.jual !== angka(b.harga_jual) ? st.tanggal : (i.keputusan === "tetap" ? st.tanggal : b.harga_diubah) }
        : { id: idBaru("B"), nama: i.nama.trim(), supplier: st.supplier, ...kol, modal, harga_jual: i.jual || "", harga_diubah: i.jual ? st.tanggal : "", terakhir_beli: st.tanggal, foto, aktif: true };
      ops.push({ tabel: "barang", simpan: barangRow });
      ops.push({ tabel: "nota_item", simpan: { id: idBaru("I"), nota: notaId, barang: barangRow.id, nama: i.nama.trim(), qty: i.qty, satuan: kol.satuan_beli, isi: kol.isi, harga: i.harga, total: Math.round(i.qty * i.harga), modal } });
    });
    ops.push({ tabel: "nota", simpan: { id: notaId, tanggal: st.tanggal, supplier: st.supplier, dompet: st.dompet, total, transaksi: tId, sumber: "manual", catatan: "" } });
    ops.push({ tabel: "transaksi", simpan: { id: tId, tanggal: st.tanggal, jenis: "keluar", kategori: "belanja-stok", dompet: st.dompet, dompet_tujuan: "", nominal: total, keterangan: `Nota ${sup ? sup.nama : ""} (${isi.length} barang)`, perjalanan: "", tagihan: "", nota: notaId, sumber: "nota", catatan: "", hapus: false } });
    try { await simpan(ops); toast(`Nota tersimpan · ${rp(total)} dari ${dom(st.dompet).nama}`); location.hash = "#/beranda"; }
    catch (err) { gagal(err.message); }
  };
}
