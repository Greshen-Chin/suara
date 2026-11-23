// Kalimat untuk halaman /simulasi, dalam bahasa warga. Murni, jadi bisa diuji. Kalimat yang sudah ada di
// lib/pratinjau.ts (ringkasanBanding, TEKS_STATUS, namaDenganRw) dipakai ulang, bukan ditulis ulang.
import { rupiah } from "./format.ts";
import { gabungNama } from "./ketahanan.ts";
import {
  namaDenganRw,
  ringkasanBanding,
  TEKS_STATUS,
  type BarisBanding,
  type HasilBanding,
} from "./pratinjau.ts";

/** Kalimat hasil di bawah batang: "4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta." */
export function ringkasHasil(h: { jumlah: number; terbiayai: number; sisa: number }): string {
  if (h.jumlah === 0) return "Belum ada usulan dalam hitungan anggaran.";
  if (h.terbiayai === 0) return "Belum ada usulan yang muat.";
  if (h.terbiayai === h.jumlah) return `Semua usulan terbiayai, sisa ${rupiah(h.sisa)}.`;
  return `${h.terbiayai} dari ${h.jumlah} usulan terbiayai. Sisa pagu ${rupiah(h.sisa)}.`;
}

/** Satu baris untuk bilah yang menempel di dasar layar ponsel. */
export function ringkasMenempel(pagu: number, h: { terbiayai: number; sisa: number }): string {
  return `${rupiah(pagu)} · ${h.terbiayai} terbiayai · sisa ${rupiah(h.sisa)}`;
}

/** "Dengan urgensi 8, Lampu gang RW 07 berada di peringkat 4 dari 8: Terbiayai." */
export function kalimatPosisiAndaian(b: BarisBanding, urgensi: number): string {
  const s = b.sesudah;
  if (!s) return `Dengan urgensi ${urgensi}, ${namaDenganRw(b)} belum bisa dihitung.`;
  return `Dengan urgensi ${urgensi}, ${namaDenganRw(b)} berada di peringkat ${s.peringkat} dari ${s.jumlah}: ${TEKS_STATUS[s.status]}.`;
}

const BATAS_NAMA = 3;

/** Peringkat naik atau turun tanpa mengubah status: "Jembatan RW 07 naik dari peringkat 3 ke 2, tetapi tetap Terbiayai." */
function kalimatPeringkat(tetap: readonly BarisBanding[]): string[] {
  const bergeser = tetap.filter((b) => b.sebelum && b.sesudah && b.sebelum.peringkat !== b.sesudah.peringkat);
  const tampil = bergeser.slice(0, BATAS_NAMA).map((b) => {
    const dari = b.sebelum!.peringkat;
    const ke = b.sesudah!.peringkat;
    return `${namaDenganRw(b)} ${ke < dari ? "naik" : "turun"} dari peringkat ${dari} ke ${ke}, tetapi tetap ${TEKS_STATUS[b.sesudah!.status].toLowerCase()}.`;
  });
  const sisa = bergeser.length - BATAS_NAMA;
  if (sisa > 0) tampil.push(`${sisa} usulan lain juga berganti peringkat.`);
  return tampil;
}

/** Pergeseran status dikelompokkan menurut asal dan tujuannya: "Gapura RW 01 dan Balai warga RW 01 berubah dari Tidak terpilih menjadi Ditunda." */
function kalimatStatus(berubah: readonly BarisBanding[]): string[] {
  const kelompok = new Map<string, BarisBanding[]>();
  for (const b of berubah) {
    const kunci = `${b.sebelum!.status}>${b.sesudah!.status}`;
    kelompok.set(kunci, [...(kelompok.get(kunci) ?? []), b]);
  }
  return [...kelompok.values()].map((daftar) => {
    const { sebelum, sesudah } = daftar[0];
    return `${gabungNama(daftar.map(namaDenganRw))} berubah dari ${TEKS_STATUS[sebelum!.status]} menjadi ${TEKS_STATUS[sesudah!.status]}.`;
  });
}

export interface KonteksBanding {
  /** Bobot di simulasi berbeda dari bobot resmi. */
  bobotBeda: boolean;
  /** Ada skor yang berbeda dari rekomendasi resmi (bila diketahui). */
  skorBeda: boolean;
  /**
   * false = kalimat pergeseran status tidak ditulis, untuk layar yang sudah menampilkannya sebagai daftar
   * berlabel status (PerbandinganPagu). Bawaan true.
   */
  sertakanStatus?: boolean;
}

/**
 * Apa yang berubah dibanding rekomendasi resmi, dalam kalimat. Tidak pernah diam: bila yang terbiayai tetap
 * sama, kalimatnya tetap menyebut peringkat, status "Ditunda", atau skor yang bergeser.
 *   ["2 usulan berubah status. Sisa pagu Rp 15 juta menjadi Rp 5 juta.", "Gapura RW 01 ... berubah dari Tidak terpilih menjadi Ditunda."]
 */
export function kalimatYangBerubah(b: HasilBanding, { bobotBeda, skorBeda, sertakanStatus = true }: KonteksBanding): string[] {
  const status = sertakanStatus ? kalimatStatus(b.berubah) : [];
  const peringkat = kalimatPeringkat(b.tetap);
  const terbiayaiSama = b.berubah.every((x) => (x.sebelum!.status === "terpilih") === (x.sesudah!.status === "terpilih"));
  const adaPerubahanDaftar = b.masuk.length > 0 || b.keluar !== null;

  const hasil: string[] = [ringkasanBanding(b)];
  if (terbiayaiSama && !adaPerubahanDaftar && (b.berubah.length > 0 || peringkat.length > 0)) {
    hasil.push("Usulan yang terbiayai sama dengan rekomendasi resmi.");
  }
  hasil.push(...status, ...peringkat);
  if (b.berubah.length === 0 && peringkat.length === 0 && bobotBeda) {
    hasil.push(
      skorBeda
        ? "Bobot yang berbeda mengubah skor, tetapi urutan dan status tiap usulan sama."
        : "Bobot yang berbeda tidak mengubah skor, urutan, maupun status.",
    );
  }
  return hasil;
}
