// Menjalankan generator yang berat tanpa memblokir utas utama: satu putaran paling lama `anggaranMs`, lalu
// menyerahkan giliran ke peramban (setTimeout 0) sebelum melanjutkan. Putaran ditakar dengan jam, bukan jumlah
// langkah, jadi di perangkat yang lambat (atau CPU diperlambat) tugas utas utama tetap pendek.
// Dibatalkan dengan fungsi yang dikembalikan; generator yang ditinggalkan tidak menyisakan apa pun.

export const ANGGARAN_PUTARAN_MS = 8;

export function jalankanBertahap<T>(
  gen: Generator<number, T, void>,
  selesai: (hasil: T) => void,
  anggaranMs = ANGGARAN_PUTARAN_MS,
): () => void {
  let batal = false;
  let pewaktu: ReturnType<typeof setTimeout> | undefined;

  const putaran = () => {
    if (batal) return;
    const mulai = performance.now();
    for (;;) {
      const r = gen.next();
      if (r.done) {
        selesai(r.value);
        return;
      }
      if (performance.now() - mulai >= anggaranMs) break;
    }
    pewaktu = setTimeout(putaran, 0);
  };

  pewaktu = setTimeout(putaran, 0);
  return () => {
    batal = true;
    if (pewaktu !== undefined) clearTimeout(pewaktu);
  };
}
