"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { kirimKomentar } from "@/app/forum/aksi";
import { STATUS_KOMENTAR_AWAL } from "@/lib/forum-status";
import { RUTE } from "@/lib/tautan";
import { BATAS, panjang } from "@/lib/usulan-skema";
import styles from "./Detail.module.css";

interface Props {
  idUsulan: string;
  /** Alamat halaman ini, untuk kembali setelah masuk lagi. */
  lanjut: string;
}

// Sisa karakter yang diumumkan ke pembaca layar. Hanya saat melewati ambang ini, bukan setiap
// ketukan: angka yang berubah terus-menerus membuat aria-live tidak bisa dipakai.
const AMBANG_UMUM = [200, 100, 50, 20, 10, 0];

function umumkanSisa(sisa: number): string {
  if (sisa < 0) return `Lebih ${-sisa} karakter dari batas.`;
  const ambang = AMBANG_UMUM.find((a) => sisa <= a);
  return ambang === undefined ? "" : `Sisa ${ambang === 0 ? 0 : sisa} karakter.`;
}

const kunciDraf = (idUsulan: string) => `suara:draf-komentar:${idUsulan}`;

function bacaDraf(idUsulan: string): string {
  try {
    return sessionStorage.getItem(kunciDraf(idUsulan)) ?? "";
  } catch {
    return ""; // penyimpanan bisa ditolak (mode privat); draf hanyalah kemudahan
  }
}

function tulisDraf(idUsulan: string, isi: string) {
  try {
    if (isi) sessionStorage.setItem(kunciDraf(idUsulan), isi);
    else sessionStorage.removeItem(kunciDraf(idUsulan));
  } catch {
    /* abaikan */
  }
}

const tanpaLangganan = () => () => {};

export function FormKomentar({ idUsulan, lanjut }: Props) {
  const router = useRouter();
  const [status, aksi, menunggu] = useActionState(kirimKomentar, STATUS_KOMENTAR_AWAL);
  // null = belum diketik apa pun; yang tampil adalah draf tersimpan (komentar yang sempat ditulis
  // sebelum sesi habis). Di server dan saat hidrasi drafnya kosong, lalu terbaca di klien.
  const draf = useSyncExternalStore(tanpaLangganan, () => bacaDraf(idUsulan), () => "");
  const [diketik, setDiketik] = useState<string | null>(null);
  const [bucket, setBucket] = useState("");
  const [nomorDilihat, setNomorDilihat] = useState(0);

  const isi = diketik ?? draf;
  const dipakai = panjang(isi);
  const sisa = BATAS.komentar.maks - dipakai;

  // Hasil baru dari server: komentar terkirim -> kosongkan kolom dan draf.
  if (status.nomor !== nomorDilihat) {
    setNomorDilihat(status.nomor);
    if (status.hasil === "terkirim") {
      setDiketik("");
      setBucket("");
    }
  }

  // Sesi habis: simpan isian, lalu ke halaman masuk. Setelah masuk lagi, drafnya kembali.
  useEffect(() => {
    if (status.hasil === "terkirim") tulisDraf(idUsulan, "");
    if (status.hasil === "galat" && status.perluMasuk) {
      tulisDraf(idUsulan, isi);
      router.push(`${RUTE.masuk}?lanjut=${encodeURIComponent(lanjut)}`);
    }
    // Hanya bereaksi pada hasil baru dari server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.nomor]);

  function ubah(nilai: string) {
    setDiketik(nilai);
    tulisDraf(idUsulan, nilai);
    setBucket(umumkanSisa(BATAS.komentar.maks - panjang(nilai)));
  }

  const galatIsi = status.hasil === "galat" ? status.galatIsi : null;
  const galatUmum = status.hasil === "galat" && !status.galatIsi ? status.pesan : null;
  const terlalu = sisa < 0;

  return (
    <form action={aksi} className={styles.formKomentar} noValidate>
      <input type="hidden" name="usulan" value={idUsulan} />

      <div className={styles.kolom}>
        <label htmlFor="isi-komentar">Tulis komentar</label>
        <textarea
          id="isi-komentar"
          name="isi"
          rows={4}
          value={isi}
          onChange={(e) => ubah(e.target.value)}
          aria-invalid={galatIsi || terlalu ? true : undefined}
          aria-describedby={`hitung-komentar${galatIsi ? " galat-komentar" : ""}`}
          autoComplete="off"
        />
        <div className={styles.hitungBaris}>
          <p id="hitung-komentar" className={`${styles.hitung} ${terlalu ? styles.hitungLebih : ""}`}>
            <span aria-hidden="true">
              {dipakai} / {BATAS.komentar.maks}
            </span>
            <span className="sr-only">{`${dipakai} dari ${BATAS.komentar.maks} karakter`}</span>
          </p>
          {/* Pengumuman sopan dan jarang: hanya saat melewati ambang. */}
          <p className="sr-only" aria-live="polite">
            {bucket}
          </p>
        </div>
        {(galatIsi || terlalu) && (
          <p id="galat-komentar" className={styles.galatKolom}>
            {galatIsi ?? `Komentar terlalu panjang. Maksimal ${BATAS.komentar.maks} karakter.`}
          </p>
        )}
      </div>

      <div className={styles.kirimBaris}>
        <button type="submit" className="tombol tombol-utama" aria-disabled={menunggu || undefined} onClick={(e) => menunggu && e.preventDefault()}>
          {menunggu ? "Mengirim…" : "Kirim komentar"}
        </button>
        <p role="status" className={styles.hasil}>
          {status.hasil === "terkirim" ? status.pesan : ""}
        </p>
      </div>

      {galatUmum && (
        <p role="alert" className={styles.galatUmum}>
          {galatUmum}
        </p>
      )}
    </form>
  );
}
