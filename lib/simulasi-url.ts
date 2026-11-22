// Keadaan simulasi di alamat halaman, supaya bisa dibagikan dan tombol kembali berfungsi:
//
//   /simulasi?pagu=350000000&bobot=20-60-20&tambah=<uuid>.8&tambah=<uuid>.5
//
// Aturan:
//  - Nilai yang sama dengan resmi TIDAK ditulis. Keadaan resmi = alamat polos "/simulasi".
//  - Nilai tidak sah diabaikan diam-diam (kembali ke nilai resmi); halaman tidak pernah gagal karena alamat.
//  - Usulan di `tambah` yang sudah bukan berstatus forum (atau tidak dikenal) dihitung di
//    `tidakTersedia` supaya halaman bisa memberi tahu satu kalimat; yang melebihi batas 16 usulan dihitung
//    di `terpotong`.
//  - Boleh memakai satu parameter `tambah` berisi daftar dipisah koma; yang ditulis selalu satu per parameter.
import { BATAS_ADMIN } from "./admin-skema.ts";
import { bacaBobotUrl, samaBobot, tulisBobot } from "./bobot-simulasi.ts";
import { keadaanResmi, sisaTempat, type DataSimulasi, type KeadaanSimulasi, type Tambahan } from "./simulasi.ts";
import { adalahUuid } from "./usulan-skema.ts";

export interface BacaUrl {
  keadaan: KeadaanSimulasi;
  /** Usulan di alamat yang tidak lagi bisa ditambahkan (bukan forum, tersembunyi, atau tidak dikenal). */
  tidakTersedia: number;
  /** Usulan di alamat yang tidak muat karena total usulan sudah 16. */
  terpotong: number;
}

function bacaPagu(teks: string | null): number | null {
  if (teks === null || !/^\d{1,13}$/.test(teks)) return null;
  const n = Number(teks);
  return n >= BATAS_ADMIN.pagu.min && n <= BATAS_ADMIN.pagu.maks ? n : null;
}

/** "<uuid>.8" -> { id, urgensi }, atau null. */
function bacaTambahan(teks: string): Tambahan | null {
  const titik = teks.lastIndexOf(".");
  if (titik < 0) return null;
  const id = teks.slice(0, titik);
  const urgensi = teks.slice(titik + 1);
  if (!adalahUuid(id) || !/^\d{1,2}$/.test(urgensi)) return null;
  const n = Number(urgensi);
  return n >= BATAS_ADMIN.urgensi.min && n <= BATAS_ADMIN.urgensi.maks ? { id, urgensi: n } : null;
}

/** `search` boleh diawali "?" dan boleh kosong. Tidak pernah melempar. */
export function bacaKeadaan(search: string, data: DataSimulasi): BacaUrl {
  const resmi = keadaanResmi(data);
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { keadaan: resmi, tidakTersedia: 0, terpotong: 0 };
  }

  const pagu = bacaPagu(params.get("pagu")) ?? resmi.pagu;
  const bobot = bacaBobotUrl(params.get("bobot") ?? "") ?? resmi.bobot;

  const forum = new Set(data.forum.map((f) => f.id));
  const tempat = sisaTempat(data);
  const tambah: Tambahan[] = [];
  let tidakTersedia = 0;
  let terpotong = 0;
  const dilihat = new Set<string>();
  for (const nilai of params.getAll("tambah").flatMap((t) => t.split(","))) {
    if (nilai.trim() === "") continue;
    const t = bacaTambahan(nilai.trim());
    if (!t || dilihat.has(t.id)) continue; // sampah dan duplikat: diabaikan
    dilihat.add(t.id);
    if (!forum.has(t.id)) tidakTersedia++;
    else if (tambah.length >= tempat) terpotong++;
    else tambah.push(t);
  }
  return { keadaan: { pagu, bobot, tambah }, tidakTersedia, terpotong };
}

/** "" untuk keadaan resmi, selain itu "?pagu=...&bobot=...&tambah=...". */
export function tulisKeadaan(keadaan: KeadaanSimulasi, data: DataSimulasi): string {
  const resmi = keadaanResmi(data);
  const params = new URLSearchParams();
  if (keadaan.pagu !== resmi.pagu) params.set("pagu", String(keadaan.pagu));
  if (!samaBobot(keadaan.bobot, resmi.bobot)) params.set("bobot", tulisBobot(keadaan.bobot));
  for (const t of keadaan.tambah) params.append("tambah", `${t.id}.${t.urgensi}`);
  const teks = params.toString();
  return teks === "" ? "" : `?${teks}`;
}
