// A3 Nota belanja: barang dari supplier, modal per buah, harga jual, dan pembayaran.
import { S, simpan, idBaru, dom } from "../data.js";
import { hariIni, angka, cariBarang, hargaSaran, hargaJagaUntung, untungPersen } from "../hitung.js";
import { esc, rp, titik, toast, pasangUang, opsiDompet, formDialog, tglPendek } from "../ui.js";
import { pengaturan } from "../data.js";

const bulat = () => angka(pengaturan("pembulatan_harga", 500)) || 500;

export function nota(main, _, q) {
  const st = { supplier: q.supplier || "", tanggal: hariIni(), dompet: "seabank-cendana", items: [] };
  const kelompokSupplier = () => (S.data.supplier.find(s => s.id === st.supplier) || {}).kelompok || "";
  const kelompokId = nama => (S.data.kelompok.find(k => k.nama === nama || k.id === nama) || S.data.kelompok[S.data.kelompok.length - 1] || {}).id;
  const markup = kid => angka((S.data.kelompok.find(k => k.id === kid) || {}).markup) || 30;
  const itemBaru = () => ({ uid: Math.random().toString(36).slice(2), barang: "", nama: "", qty: 1, satuan: "bh", isi: 1, harga: 0, jual: 0, kelompok: kelompokId(kelompokSupplier()), keputusan: "" });

  main.innerHTML = `
    <form class="tumpuk" id="form">
      <div class="grid2">
        <div class="isian"><label for="supplier">Supplier</label><select class="input" id="supplier"><option value="">Pilih supplier…</option>${S.data.supplier.filter(s => s.aktif).map(s => `<option value="${esc(s.id)}" ${s.id === st.supplier ? "selected" : ""}>${esc(s.nama)}</option>`).join("")}<option value="__baru">＋ Supplier baru…</option></select><span class="tiny muted" id="info-sup"></span></div>
        <div class="isian"><label for="tanggal">Tanggal nota</label><input class="input" type="date" id="tanggal" value="${st.tanggal}"></div>
      </div>
      <div class="tumpuk" id="items"></div>
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
      const r = await formDialog("Supplier baru", [{ id: "nama", label: "Nama supplier" }, { id: "kelompok", label: "Kelompok barang", type: "select", value: "perabot", options: S.data.kelompok.map(k => ({ value: k.nama, label: k.nama })) }]);
      if (!r || !r.nama) { $("#supplier").value = st.supplier; return; }
      const row = { id: idBaru("S"), nama: r.nama, kelompok: r.kelompok, aktif: true, urutan: S.data.supplier.length + 1 };
      try { await simpan([{ tabel: "supplier", simpan: row }]); } catch (e) { toast(e.message, true); return; }
      $("#supplier").insertAdjacentHTML("afterbegin", `<option value="${esc(row.id)}">${esc(row.nama)}</option>`);
      $("#supplier").value = row.id;
    }
    st.supplier = $("#supplier").value; infoSupplier();
    // Barang baru mengikuti kelompok supplier
    const kid = kelompokId(kelompokSupplier());
    st.items.forEach(it => { if (!it.barang) it.kelompok = kid; });
    $("#items").querySelectorAll(".item").forEach(el => { const it = st.items.find(x => x.uid === el.dataset.uid); if (it && !it.barang) { el.querySelector('[data-f="kelompok"]').value = kid; hitungItem(el, it); } });
  };
  $("#tanggal").onchange = () => (st.tanggal = $("#tanggal").value);
  $("#dompet").onchange = () => (st.dompet = $("#dompet").value);

  function htmlItem(it, i) {
    return `<div class="item" data-uid="${it.uid}">
      <div class="baris"><b>Barang ${i + 1}</b><button type="button" class="link" data-hapus>Hapus</button></div>
      <div class="isian saran"><label>Nama barang</label><input class="input" data-f="nama" value="${esc(it.nama)}" placeholder="ketik untuk mencari…" autocomplete="off"><div class="saran-list hidden"></div></div>
      <div class="g3">
        <div class="isian"><label>Jumlah</label><input class="input" data-f="qty" inputmode="decimal" value="${it.qty || ""}"></div>
        <div class="isian"><label>Satuan</label><input class="input" data-f="satuan" value="${esc(it.satuan)}" list="daftar-satuan"></div>
        <div class="isian"><label>Isi per satuan</label><input class="input" data-f="isi" inputmode="numeric" value="${it.isi || 1}"></div>
      </div>
      <div class="g2">
        <div class="isian"><label>Harga per satuan</label><input class="input uang" data-f="harga" inputmode="numeric" value="${it.harga ? titik(it.harga) : ""}" placeholder="Rp0"></div>
        <div class="isian"><label>Harga jual per buah</label><input class="input uang" data-f="jual" inputmode="numeric" value="${it.jual ? titik(it.jual) : ""}" placeholder="Rp0"></div>
      </div>
      <div class="isian ${it.barang ? "hidden" : ""}" data-kel><label>Kelompok (barang baru)</label><select class="input" data-f="kelompok">${S.data.kelompok.map(k => `<option value="${esc(k.id)}" ${k.id === it.kelompok ? "selected" : ""}>${esc(k.nama)} · untung ${k.markup}%</option>`).join("")}</select></div>
      <div data-info class="small"></div>
    </div>`;
  }

  function hitungItem(el, it) {
    const b = S.data.barang.find(x => x.id === it.barang);
    const modal = it.isi ? it.harga / it.isi : it.harga;
    const info = el.querySelector("[data-info]");
    el.classList.remove("peringatan");
    if (!it.harga) { info.innerHTML = b ? `<span class="muted">Modal terakhir ${rp(b.modal)}/buah${b.harga_jual ? ` · jual ${rp(b.harga_jual)}` : ""}</span>` : ""; return; }
    const total = it.qty * it.harga;
    let html = `<div class="baris"><span class="muted">Total ${rp(total)} · modal ${rp(modal)}/buah</span>${it.jual ? `<span class="${untungPersen(modal, it.jual) < 15 ? "minus" : "plus"}">untung ${rp(it.jual - modal)} (${untungPersen(modal, it.jual)}%)</span>` : ""}</div>`;
    if (b && b.modal && modal > b.modal * 1.005 && it.keputusan) {
      html += `<div class="catatan ok">Modal naik ${rp(modal - b.modal)}/buah. Harga jual ${it.keputusan === "pakai" ? "diubah ke" : "tetap"} ${rp(it.jual)}.</div>`;
    } else if (b && b.modal && modal > b.modal * 1.005) {
      const saran = hargaJagaUntung(b.modal, b.harga_jual, modal, bulat());
      el.classList.add("peringatan");
      html += `<div class="catatan warn"><b>Harga dari supplier naik ${rp(modal - b.modal)}/buah</b><span>Modal lama ${rp(b.modal)}${b.harga_jual ? `, untung lama ${untungPersen(b.modal, b.harga_jual)}%` : ""}.${saran ? ` Supaya untung tetap, saran harga jual ${rp(saran)}.` : ""}</span>
        ${saran ? `<div class="baris"><button type="button" class="tombol kecil" data-pakai="${saran}">Pakai ${rp(saran)}</button><button type="button" class="tombol garis kecil" data-tetap>Tetap ${rp(it.jual || b.harga_jual)}</button></div>` : ""}</div>`;
    } else if (!b) {
      const saran = hargaSaran(modal, markup(it.kelompok), bulat());
      html += `<div class="baris"><span class="muted">Barang baru. Saran harga jual (untung ${markup(it.kelompok)}%):</span><button type="button" class="tombol kecil garis" data-pakai="${saran}">Pakai ${rp(saran)}</button></div>`;
    }
    info.innerHTML = html;
  }

  function gambarItems() {
    const box = $("#items");
    box.innerHTML = st.items.map(htmlItem).join("") + `<datalist id="daftar-satuan"><option value="bh"><option value="pcs"><option value="krt"><option value="lsn"><option value="box"><option value="pak"><option value="roll"><option value="tabung"><option value="kg"><option value="karung"></datalist>`;
    pasangUang(box);
    box.querySelectorAll(".item").forEach(el => {
      const it = st.items.find(x => x.uid === el.dataset.uid);
      hitungItem(el, it);
      el.addEventListener("input", e => {
        const fld = e.target.dataset.f; if (!fld) return;
        if (fld === "nama") { it.nama = e.target.value; it.barang = ""; el.querySelector("[data-kel]").classList.remove("hidden"); tampilSaran(el, it); }
        else if (fld === "satuan") it.satuan = e.target.value;
        else if (fld === "kelompok") it.kelompok = e.target.value;
        else { it[fld] = angka(e.target.value); if (fld === "harga" || fld === "isi") it.keputusan = ""; }
        hitungItem(el, it); ringkas();
      });
      el.addEventListener("change", e => { if (e.target.dataset.f === "kelompok") { it.kelompok = e.target.value; hitungItem(el, it); } });
      el.addEventListener("click", e => {
        if (e.target.closest("[data-hapus]")) { st.items = st.items.filter(x => x !== it); gambarItems(); ringkas(); return; }
        const p = e.target.closest("[data-pakai]");
        if (p) { it.jual = angka(p.dataset.pakai); it.keputusan = "pakai"; el.querySelector('[data-f="jual"]').value = titik(it.jual); hitungItem(el, it); ringkas(); return; }
        if (e.target.closest("[data-tetap]")) { const b = S.data.barang.find(x => x.id === it.barang); it.jual = it.jual || angka(b && b.harga_jual); it.keputusan = "tetap"; el.querySelector('[data-f="jual"]').value = it.jual ? titik(it.jual) : ""; hitungItem(el, it); return; }
        const pilih = e.target.closest("[data-barang]");
        if (pilih) {
          const b = S.data.barang.find(x => x.id === pilih.dataset.barang);
          Object.assign(it, { barang: b.id, nama: b.nama, satuan: b.satuan_beli || "bh", isi: angka(b.isi) || 1, jual: angka(b.harga_jual), kelompok: b.kelompok });
          el.querySelector('[data-f="nama"]').value = b.nama;
          el.querySelector('[data-f="satuan"]').value = it.satuan;
          el.querySelector('[data-f="isi"]').value = it.isi;
          el.querySelector('[data-f="jual"]').value = it.jual ? titik(it.jual) : "";
          el.querySelector('[data-f="harga"]').placeholder = "terakhir " + rp(angka(b.modal) * it.isi);
          el.querySelector("[data-kel]").classList.add("hidden");
          el.querySelector(".saran-list").classList.add("hidden");
          hitungItem(el, it); ringkas();
          el.querySelector('[data-f="harga"]').focus();
        }
      });
      el.querySelector('[data-f="nama"]').addEventListener("blur", () => setTimeout(() => el.querySelector(".saran-list").classList.add("hidden"), 200));
    });
  }

  function tampilSaran(el, it) {
    const list = el.querySelector(".saran-list");
    if (it.nama.trim().length < 2) { list.classList.add("hidden"); return; }
    let hasil = cariBarang(S.data.barang, it.nama, 30);
    hasil.sort((a, b) => (a.supplier === st.supplier ? 0 : 1) - (b.supplier === st.supplier ? 0 : 1));
    hasil = hasil.slice(0, 8);
    list.innerHTML = hasil.map(b => `<button type="button" data-barang="${esc(b.id)}"><span>${esc(b.nama)}</span><span class="muted small">${rp(b.modal)}</span></button>`).join("") || '<div class="small muted" style="padding:10px 12px">Barang baru, belum ada di daftar.</div>';
    list.classList.remove("hidden");
  }

  function ringkas() {
    const isi = st.items.filter(i => i.nama && i.harga);
    const total = isi.reduce((s, i) => s + i.qty * i.harga, 0);
    const jual = isi.reduce((s, i) => s + i.qty * (i.isi || 1) * (i.jual || 0), 0);
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
    const notaId = idBaru("N"), tId = idBaru("T");
    const total = Math.round(isi.reduce((s, i) => s + i.qty * i.harga, 0));
    const sup = S.data.supplier.find(s => s.id === st.supplier);
    const ops = [];
    isi.forEach(i => {
      const modal = Math.round(i.harga / (i.isi || 1));
      let b = S.data.barang.find(x => x.id === i.barang);
      if (!b) { const sama = S.data.barang.find(x => x.nama.toLowerCase().trim() === i.nama.toLowerCase().trim()); if (sama) b = sama; }
      const barangRow = b
        ? { ...b, modal, supplier: st.supplier, satuan_beli: i.satuan, isi: i.isi || 1, terakhir_beli: st.tanggal, harga_jual: i.jual || b.harga_jual, harga_diubah: i.jual && i.jual !== angka(b.harga_jual) ? st.tanggal : (i.keputusan === "tetap" ? st.tanggal : b.harga_diubah) }
        : { id: idBaru("B"), nama: i.nama.trim(), kelompok: i.kelompok, supplier: st.supplier, satuan_jual: (i.isi || 1) > 1 ? "pcs" : i.satuan || "bh", satuan_beli: i.satuan, isi: i.isi || 1, modal, harga_jual: i.jual || "", harga_diubah: i.jual ? st.tanggal : "", terakhir_beli: st.tanggal, aktif: true };
      ops.push({ tabel: "barang", simpan: barangRow });
      ops.push({ tabel: "nota_item", simpan: { id: idBaru("I"), nota: notaId, barang: barangRow.id, nama: i.nama.trim(), qty: i.qty, satuan: i.satuan, isi: i.isi || 1, harga: i.harga, total: Math.round(i.qty * i.harga), modal } });
    });
    ops.push({ tabel: "nota", simpan: { id: notaId, tanggal: st.tanggal, supplier: st.supplier, dompet: st.dompet, total, transaksi: tId, sumber: "manual", catatan: "" } });
    ops.push({ tabel: "transaksi", simpan: { id: tId, tanggal: st.tanggal, jenis: "keluar", kategori: "belanja-stok", dompet: st.dompet, dompet_tujuan: "", nominal: total, keterangan: `Nota ${sup ? sup.nama : ""} (${isi.length} barang)`, perjalanan: "", tagihan: "", nota: notaId, sumber: "nota", catatan: "", hapus: false } });
    const b = $("#simpan"); b.disabled = true; b.textContent = "Menyimpan…";
    try { await simpan(ops); toast(`Nota tersimpan · ${rp(total)} dari ${dom(st.dompet).nama}`); location.hash = "#/beranda"; }
    catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Simpan nota"; }
  };
}
