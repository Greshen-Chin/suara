// Membaca biaya yang diketik warga. Toleran terhadap cara menulis sehari-hari:
//   85000000   85.000.000   Rp 85.000.000,-   Rp 85 jt   85 juta   1,5 miliar   750 ribu
// Hasilnya angka bulat rupiah. Tidak menebak yang ambigu: "85,5" tanpa satuan ditolak
// dengan petunjuk, bukan diam-diam dibaca sebagai 855 atau 85,5.

export type HasilRupiah = { ok: true; nilai: number } | { ok: false; pesan: string };

const PESAN_KOSONG = "Isi perkiraan biaya.";
const PESAN_FORMAT =
  "Tulis biaya dalam angka, misalnya 85.000.000 atau 85 juta.";
const PESAN_KOMA =
  "Tulis tanpa koma desimal, misalnya 85.500.000, atau pakai satuan seperti 85,5 juta.";
const PESAN_BESAR = "Angkanya terlalu besar. Periksa jumlah nol.";
const PESAN_NOL = "Biaya harus lebih dari nol.";

const KALI: Record<string, number> = {
  miliar: 1_000_000_000,
  milyar: 1_000_000_000,
  m: 1_000_000_000,
  juta: 1_000_000,
  jt: 1_000_000,
  ribu: 1_000,
  rb: 1_000,
  k: 1_000,
};

// Rp / IDR di depan, angka, satuan (opsional), lalu ",-" / ",00" / "rupiah" di belakang.
const POLA =
  /^(?:rp\.?|idr)?\s*(\d[\d.,\s]*?)\s*(miliar|milyar|juta|ribu|jt|rb|m|k)?\s*(?:rupiah)?\s*(?:,-|,00|,0)?\s*\.?$/;
const POLA_RIBUAN = /^\d{1,3}([.,]\d{3})+$/;

export function parseRupiah(masukan: string): HasilRupiah {
  const teks = masukan.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  if (teks === "") return { ok: false, pesan: PESAN_KOSONG };

  const cocok = POLA.exec(teks);
  if (!cocok) return { ok: false, pesan: PESAN_FORMAT };

  const angka = cocok[1].replace(/\s/g, "");
  const satuan = cocok[2];
  let nilai: number;

  if (!satuan) {
    // Tanpa satuan, titik dan koma hanya boleh menjadi pemisah ribuan (85.000.000).
    if (/^\d+$/.test(angka)) nilai = Number(angka);
    else if (POLA_RIBUAN.test(angka)) nilai = Number(angka.replace(/[.,]/g, ""));
    else return { ok: false, pesan: PESAN_KOMA };
  } else {
    // Dengan satuan, satu pemisah di antara angka dibaca sebagai desimal: "1,5 miliar".
    // Beberapa kelompok tiga digit ("1.500") tetap dibaca sebagai ribuan.
    let bersih: string;
    if (/^\d+$/.test(angka)) bersih = angka;
    else if (POLA_RIBUAN.test(angka)) bersih = angka.replace(/[.,]/g, "");
    else if (/^\d+[.,]\d{1,2}$/.test(angka)) bersih = angka.replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(angka)) bersih = angka.replace(/\./g, "").replace(",", ".");
    else return { ok: false, pesan: PESAN_FORMAT };
    nilai = Math.round(Number(bersih) * KALI[satuan]);
  }

  if (!Number.isFinite(nilai) || nilai > 1e12) return { ok: false, pesan: PESAN_BESAR };
  if (nilai <= 0) return { ok: false, pesan: PESAN_NOL };
  return { ok: true, nilai };
}
