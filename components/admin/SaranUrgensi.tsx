"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mintaSaranUrgensi } from "@/app/admin/saran-aksi";
import { bandingkanDenganSaran, cariKutipan, drafAlasan, susunMasukan } from "@/lib/saran-urgensi";
import type { SaranUi } from "@/lib/saran-urgensi-tipe";
import { RUBRIK_URGENSI } from "@/lib/urgensi";
import { useSorotKutipan } from "./SaranProvider";
import styles from "./Saran.module.css";

interface Props {
  idUsulan: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  /** Nilai yang dipilih admin. Tombol baru aktif setelah ini terisi, supaya penilaian admin tidak terjangkar pada angka AI. */
  pilihan: number | null;
  /** Kolom alasan urgensi sudah berisi sesuatu: menyalin draf menanyakan dulu. */
  alasanTerisi: boolean;
  saran: SaranUi | null;
  onSaran: (saran: SaranUi | null) => void;
  onSalinDraf: (teks: string) => void;
}

type Tahap =
  | { jenis: "diam" }
  | { jenis: "menunggu"; lama: boolean }
  | { jenis: "gagal"; pesan: string; bisaUlang: boolean; perluMasuk: boolean };

/**
 * Catatan pinggir: saran AI tampil seperti catatan seorang rekan yang ikut membaca berkas, bukan kotak ajaib.
 * Tidak pernah mengisi pilihan urgensi dan tidak pernah dikirim otomatis. Admin yang menetapkan.
 */
export function SaranUrgensi({ idUsulan, judul, deskripsi, kategori, pilihan, alasanTerisi, saran, onSaran, onSalinDraf }: Props) {
  const idJudul = useId();
  const [tahap, setTahap] = useState<Tahap>({ jenis: "diam" });
  const [tanyaGanti, setTanyaGanti] = useState(false);
  const [diumumkan, setDiumumkan] = useState("");
  const pengatur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { kutipan: kutipanAktif, sorot } = useSorotKutipan();

  useEffect(() => () => void (pengatur.current && clearTimeout(pengatur.current)), []);

  const masukan = useMemo(() => susunMasukan({ judul, deskripsi, kategori }), [judul, deskripsi, kategori]);
  const siap = pilihan !== null;
  const menunggu = tahap.jenis === "menunggu";

  async function minta() {
    if (!siap || menunggu) return;
    setTanyaGanti(false);
    setTahap({ jenis: "menunggu", lama: false });
    setDiumumkan("Membaca usulan…");
    pengatur.current = setTimeout(() => setTahap((t) => (t.jenis === "menunggu" ? { jenis: "menunggu", lama: true } : t)), 6000);
    let hasil;
    try {
      hasil = await mintaSaranUrgensi(idUsulan, pilihan);
    } catch {
      hasil = null;
    }
    if (pengatur.current) clearTimeout(pengatur.current);
    if (hasil?.ok) {
      onSaran(hasil.saran);
      setTahap({ jenis: "diam" });
      setDiumumkan(`Saran AI siap: nilai ${hasil.saran.nilai} dari 10.`);
      return;
    }
    const pesan = hasil ? hasil.pesan : "Belum bisa meminta saran. Periksa koneksi Anda, lalu coba lagi.";
    setTahap({ jenis: "gagal", pesan, bisaUlang: hasil ? hasil.bisaUlang : true, perluMasuk: hasil?.perluMasuk === true });
    setDiumumkan(pesan);
  }

  function salin() {
    if (!saran) return;
    onSalinDraf(drafAlasan(saran.alasan));
    setTanyaGanti(false);
    setDiumumkan("Draf alasan dari AI sudah masuk ke kolom alasan.");
  }

  const banding = saran && pilihan !== null ? bandingkanDenganSaran(pilihan, saran.nilai) : null;
  const tingkat = saran ? RUBRIK_URGENSI[saran.tingkat - 1] : null;

  return (
    <aside className={styles.catatan} aria-labelledby={idJudul}>
      <h3 id={idJudul} className={styles.label}>
        Saran AI{saran ? <> · <span className={styles.model}>{saran.model}</span></> : null}
      </h3>

      {saran && tingkat ? (
        <div className={styles.isi}>
          <p className={styles.nilaiBaris}>
            <span className={styles.nilai} aria-label={`Nilai saran ${saran.nilai} dari 10`}>
              {saran.nilai}
            </span>
            <span className={styles.tingkat}>{tingkat.ringkas}</span>
          </p>
          {banding && <p className={styles.banding}>{banding.kalimat}</p>}

          <ul className={styles.alasan} aria-label="Alasan menurut AI">
            {saran.alasan.map((a) => {
              const ada = cariKutipan(deskripsi, a.kutipan) !== null;
              const aktif = kutipanAktif === a.kutipan;
              return (
                <li key={a.teks + a.kutipan}>
                  <p>{a.teks}</p>
                  <blockquote className={styles.kutipan}>
                    <span>“{a.kutipan}”</span>
                  </blockquote>
                  {ada ? (
                    <button type="button" className={styles.tombolKecil} aria-pressed={aktif} onClick={() => sorot(aktif ? null : a.kutipan)}>
                      Sorot di usulan
                    </button>
                  ) : (
                    <span className={styles.petunjuk}>Kutipan ini dari judul, atau dari bagian yang disamarkan.</span>
                  )}
                </li>
              );
            })}
          </ul>

          {saran.pertanyaan.length > 0 && (
            <div className={styles.belumJelas}>
              <p>
                <strong>Belum jelas:</strong>
              </p>
              <ul>
                {saran.pertanyaan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <a href={`/forum/${idUsulan}#komentar`} target="_blank" rel="noopener">
                Tanyakan di komentar usulan<span className="sr-only"> (buka di tab baru)</span>
              </a>
            </div>
          )}

          <p className={styles.penutup}>
            Keyakinan {saran.keyakinan}. Ini bahan, bukan keputusan.
            {saran.dariSimpanan && " Saran ini tersimpan dari permintaan sebelumnya untuk isi usulan yang sama."}
          </p>

          {tanyaGanti ? (
            <div className={styles.konfirmasi} role="group" aria-label="Konfirmasi mengganti alasan">
              <p>Kolom alasan sudah terisi. Ganti dengan draf dari AI?</p>
              <div className={styles.baris}>
                <button type="button" className="tombol tombol-kedua" onClick={salin}>
                  Ganti dengan draf
                </button>
                <button type="button" className="tombol tombol-kedua" onClick={() => setTanyaGanti(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="tombol tombol-kedua" onClick={() => (alasanTerisi ? setTanyaGanti(true) : salin())}>
              Salin alasan sebagai draf
            </button>
          )}
        </div>
      ) : (
        <div className={styles.isi}>
          <p className={styles.petunjuk} id={`${idJudul}-bantu`}>
            {siap
              ? "AI membaca judul dan deskripsi usulan, lalu memberi nilai beserta alasan yang mengutip kalimat usulan. Hanya saran."
              : "Pilih nilai Anda dulu, supaya penilaian Anda tidak terpengaruh."}
          </p>
          <div className={styles.baris}>
            <button
              type="button"
              className="tombol tombol-kedua"
              aria-disabled={!siap || menunggu || undefined}
              aria-describedby={`${idJudul}-bantu`}
              onClick={minta}
            >
              {tahap.jenis === "gagal" && tahap.bisaUlang ? "Coba lagi" : "Minta saran AI"}
            </button>
            {tahap.jenis === "menunggu" && (
              <span className={styles.sibuk}>
                {tahap.lama ? "Masih menunggu. Anda bisa melanjutkan tanpa saran." : "Membaca usulan…"}
              </span>
            )}
          </div>
          {tahap.jenis === "gagal" && (
            <p className={styles.galat}>
              {tahap.pesan}
              {tahap.perluMasuk && (
                <>
                  {" "}
                  <a href={`/masuk?lanjut=${encodeURIComponent(`/admin/usulan/${idUsulan}`)}`}>Masuk lagi</a>.
                </>
              )}
            </p>
          )}
        </div>
      )}

      <details className={styles.dikirim}>
        <summary>
          Teks yang dikirim ke AI
          {masukan.jumlahDisamarkan > 0 ? ` (${masukan.jumlahDisamarkan} bagian disamarkan)` : ""}
        </summary>
        <div className={styles.dikirimIsi}>
          <p className={styles.petunjuk}>
            Hanya judul, deskripsi, dan kategori. Nama pengusul, RW, dukungan, biaya, dan komentar tidak dikirim. Bagian bertanda
            <span className={styles.samar}>[…]</span> sengaja disamarkan; samaran ini berbasis pola dan tidak sempurna, jadi periksa
            teksnya.
          </p>
          <p className={styles.dikirimBagian}>
            <strong>Judul:</strong> <Bagian bagian={masukan.tampilan.judul} />
          </p>
          <p className={styles.dikirimBagian}>
            <strong>Deskripsi:</strong> <Bagian bagian={masukan.tampilan.deskripsi} />
          </p>
          <p className={styles.dikirimBagian}>
            <strong>Kategori:</strong> {masukan.kategori}
          </p>
        </div>
      </details>

      <p role="status" className="sr-only">
        {diumumkan}
      </p>
    </aside>
  );
}

function Bagian({ bagian }: { bagian: { teks: string; samar: boolean }[] }) {
  if (bagian.length === 0) return <span className={styles.petunjuk}>(kosong)</span>;
  return (
    <>
      {bagian.map((b, i) =>
        b.samar ? (
          <span key={i} className={styles.samar}>
            {b.teks}
          </span>
        ) : (
          <span key={i}>{b.teks}</span>
        ),
      )}
    </>
  );
}
