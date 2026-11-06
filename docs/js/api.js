// Penghubung ke backend (Apps Script) atau ke data demo di browser.
import { API_URL, DEMO_PARAM } from "./config.js";

const simpanLokal = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const bacaLokal = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

const params = new URLSearchParams(location.search);
export const DEMO = params.get(DEMO_PARAM);
export const sesi = {
  get token() { return bacaLokal("toko-token"); },
  get user() { return bacaLokal("toko-user"); },
  get nama() { return bacaLokal("toko-nama"); },
  simpan(d) { simpanLokal("toko-token", d.token); simpanLokal("toko-user", d.user); simpanLokal("toko-nama", d.nama); },
  hapus() { ["toko-token", "toko-user", "toko-nama", "toko-cache"].forEach(k => simpanLokal(k, null)); }
};

export class GalatSesi extends Error {}

async function panggil(aksi, data) {
  if (DEMO) return demo(aksi, data);
  if (!API_URL) throw new Error("Alamat server belum diisi di js/config.js (lihat PANDUAN-PASANG.md).");
  let res;
  try {
    res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ aksi, token: sesi.token, data }), redirect: "follow" });
  } catch (e) {
    throw new Error("Tidak tersambung ke server. Periksa internet lalu coba lagi.");
  }
  const json = await res.json().catch(() => ({ ok: false, pesan: "Jawaban server tidak terbaca." }));
  if (!json.ok) { if (json.kode === "sesi") throw new GalatSesi(json.pesan); throw new Error(json.pesan || "Gagal."); }
  return json;
}

export const api = {
  login: (username, password) => panggil("login", { username, password }),
  muat: () => panggil("muat", {}),
  batch: ops => panggil("batch", { ops }),
  ubahPassword: (lama, baru) => panggil("ubahPassword", { lama, baru }),
  unggahFoto: d => panggil("unggahFoto", d)
};

export function cacheData(data) { simpanLokal("toko-cache", data ? JSON.stringify(data) : null); }
export function bacaCache() { const s = bacaLokal("toko-cache"); try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ---------- Mode demo: semua di memori browser ----------
let demoDb = null;
async function demo(aksi, data) {
  await new Promise(r => setTimeout(r, 150));
  if (!demoDb) {
    const lokal = bacaLokal("toko-demo");
    demoDb = lokal ? JSON.parse(lokal) : await fetch(DEMO).then(r => r.json());
  }
  const KUNCI = { pengguna: "username", tutup_toko: "tanggal", pengaturan: "kunci" };
  if (aksi === "login") {
    if (!data.username || !data.password) return { ok: false, pesan: "Isi nama pengguna dan password." };
    const u = demoDb.pengguna.find(x => x.username === String(data.username).toLowerCase());
    if (!u) return { ok: false, pesan: "Nama pengguna atau password salah." };
    return { ok: true, token: "demo", user: u.username, nama: u.nama };
  }
  if (aksi === "muat") return { ok: true, data: JSON.parse(JSON.stringify(demoDb)) };
  if (aksi === "batch") {
    for (const op of data.ops) {
      const tabel = demoDb[op.tabel] || (demoDb[op.tabel] = []);
      const k = KUNCI[op.tabel] || "id";
      if (op.simpan) {
        const row = { ...op.simpan };
        if ((op.tabel === "transaksi" || op.tabel === "nota") && !row.oleh) row.oleh = sesi.user;
        const i = tabel.findIndex(x => String(x[k]) === String(row[k]));
        if (i >= 0) tabel[i] = { ...tabel[i], ...row }; else tabel.push(row);
      } else if (op.hapus !== undefined) {
        const i = tabel.findIndex(x => String(x[k]) === String(op.hapus));
        if (i >= 0) tabel.splice(i, 1);
      }
    }
    try { localStorage.setItem("toko-demo", JSON.stringify(demoDb)); } catch (e) {}
    return { ok: true };
  }
  if (aksi === "ubahPassword") return { ok: true };
  if (aksi === "unggahFoto") return { ok: true, id: `data:${data.mime};base64,${data.data}` };
  return { ok: false, pesan: "aksi demo tidak dikenal" };
}
