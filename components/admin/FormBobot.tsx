"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ubahBobot } from "@/app/admin/aksi";
import {
  KOLOM_BOBOT,
  LABEL_BOBOT,
  keadaanJumlahBobot,
  periksaBobot,
  sisaUntukUrgensi,
  type KolomBobot,
} from "@/lib/admin-skema";
import { STATUS_AKSI_AWAL, type StatusAksi } from "@/lib/admin-status";
import { BATAS } from "@/lib/usulan-skema";
import { KolomAlasan, RingkasGalat, useDitunda, type GalatBertaut } from "./Isian";
import { PratinjauDampak } from "./PratinjauDampak";
import styles from "./Admin.module.css";

interface Props {
  bobot: Record<KolomBobot, number>;
  versi: number;
}

/** Penjelasan tiap bobot dalam bahasa warga, bukan istilah anggaran. */
const PENJELASAN: Record<KolomBobot, string> = {
  popularitas: "Dukungan per 1.000 penduduk RW. RW kecil tidak kalah hanya karena penduduknya sedikit.",
  urgensi: "Seberapa mendesak, dinilai admin dengan alasan tertulis.",
  pemerataan: "RW yang periode lalu mendapat sedikit anggaran didahulukan.",
};

/** Struktur sama dengan FormPagu: pesan di luar, isian di dalam yang dipasang ulang tiap versi berubah. */
export function FormBobot({ bobot, versi }: Props) {
  const router = useRouter();
  const [status, aksi, menunggu] = useActionState(ubahBobot, STATUS_AKSI_AWAL);
  const [diabaikan, setDiabaikan] = useState(0);
  const tampil: StatusAksi = status.nomor > diabaikan ? status : STATUS_AKSI_AWAL;

  return (
    <IsiFormBobot
      key={versi}
      bobot={bobot}
      versi={versi}
      status={tampil}
      aksi={aksi}
      menunggu={menunggu}
      muatUlang={() => {
        setDiabaikan(status.nomor);
        router.refresh();
      }}
    />
  );
}

function IsiFormBobot({
  bobot,
  versi,
  status,
  aksi,
  menunggu,
  muatUlang,
}: Props & { status: StatusAksi; aksi: (form: FormData) => void; menunggu: boolean; muatUlang: () => void }) {
  const [nilai, setNilai] = useState<Record<KolomBobot, string>>({
    popularitas: String(bobot.popularitas),
    urgensi: String(bobot.urgensi),
    pemerataan: String(bobot.pemerataan),
  });
  const [alasan, setAlasan] = useState("");

  const jumlah = keadaanJumlahBobot(nilai);
  const diumumkan = useDitunda(jumlah.teks);
  const sisa = sisaUntukUrgensi(nilai);
  const periksa = periksaBobot(nilai);
  const berubah = periksa.ok && KOLOM_BOBOT.some((k) => periksa.nilai[k] !== bobot[k]);

  const galatAlasan = status.galatAlasan;
  const galat: GalatBertaut[] = [
    ...KOLOM_BOBOT.flatMap((k) => (status.galatKolom[k] ? [{ id: `bobot-${k}`, pesan: status.galatKolom[k] }] : [])),
    ...(status.galatKolom.jumlah ? [{ id: "bobot-jumlah", pesan: status.galatKolom.jumlah }] : []),
    ...(galatAlasan ? [{ id: "bobot-alasan", pesan: galatAlasan }] : []),
  ];

  return (
    <form action={aksi} className={styles.form} noValidate>
      <input type="hidden" name="versi" value={versi} />

      {status.hasil === "berhasil" && (
        <div role="status" className={styles.pesan}>
          <strong>{status.pesan}</strong>
          <p>
            Jejaknya tampil di <Link href="/">halaman utama</Link> dan di riwayat di bawah. Peringkat di Garis Pagu dan
            forum sudah memakai bobot baru.
          </p>
        </div>
      )}

      {status.bentrok && (
        <div role="alert" className={`${styles.pesanGalat} ${styles.bentrok}`}>
          <p>{status.pesan}</p>
          <dl className={styles.bentrokDua}>
            <dt>Berlaku sekarang</dt>
            <dd>{status.bentrok.ringkas}</dd>
            <dt>Yang Anda ketik</dt>
            <dd>
              popularitas {nilai.popularitas || "kosong"}, urgensi {nilai.urgensi || "kosong"}, pemerataan{" "}
              {nilai.pemerataan || "kosong"}
            </dd>
          </dl>
          <div className={styles.tombolBaris}>
            <button type="button" className="tombol tombol-kedua" onClick={muatUlang}>
              Muat ulang nilai terbaru
            </button>
          </div>
        </div>
      )}

      {status.hasil === "galat" && !status.bentrok && (
        <RingkasGalat pesan={status.pesan} galat={galat}>
          {status.perluMasuk && (
            <p>
              <Link href={`/masuk?lanjut=${encodeURIComponent("/admin/anggaran")}`}>Masuk lagi</Link>. Isian Anda tetap di layar.
            </p>
          )}
        </RingkasGalat>
      )}

      <div className={styles.bobot}>
        {KOLOM_BOBOT.map((k) => {
          const galatK = status.galatKolom[k] ?? null;
          return (
            <div key={k} className={styles.bobotKolom}>
              <input
                id={`bobot-${k}`}
                name={k}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={nilai[k]}
                onChange={(e) => setNilai((n) => ({ ...n, [k]: e.target.value }))}
                aria-invalid={galatK ? true : undefined}
                aria-labelledby={`bobot-${k}-label`}
                aria-describedby={`bobot-${k}-bantu${galatK ? ` bobot-${k}-galat` : ""}`}
              />
              <div className={styles.kolom}>
                <label id={`bobot-${k}-label`} htmlFor={`bobot-${k}`}>
                  {LABEL_BOBOT[k]}
                </label>
                <p id={`bobot-${k}-bantu`} className={styles.petunjuk}>
                  {PENJELASAN[k]}
                </p>
                {galatK && (
                  <p id={`bobot-${k}-galat`} className={styles.galatKolom}>
                    {galatK}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Penunjuk jumlah yang selalu terlihat. Yang terlihat langsung berubah; yang diumumkan ke pembaca
            layar ditunda 0,6 detik supaya tidak membanjiri saat mengetik. */}
        <div className={styles.jumlahBobot} id="bobot-jumlah">
          <span data-siap={jumlah.siap} aria-hidden="true">
            {jumlah.teks}
          </span>
          <span role="status" className="sr-only">
            {diumumkan}
          </span>
          {!jumlah.siap && sisa !== null && nilai.urgensi !== String(sisa) && (
            <button type="button" className="tombol tombol-kedua" onClick={() => setNilai((n) => ({ ...n, urgensi: String(sisa) }))}>
              Isi sisanya ke urgensi ({sisa})
            </button>
          )}
        </div>
        {status.galatKolom.jumlah && <p className={styles.galatKolom}>{status.galatKolom.jumlah}</p>}
      </div>

      <KolomAlasan
        id="bobot-alasan"
        nama="alasan"
        label="Alasan"
        bantu={`Tulis ${BATAS.alasan.min} sampai ${BATAS.alasan.maks} karakter. Alasan ini tercatat di jejak keputusan dan bisa dibaca semua warga.`}
        nilai={alasan}
        onUbah={setAlasan}
        maks={BATAS.alasan.maks}
        galat={galatAlasan}
      />

      <PratinjauDampak
        masukan={berubah ? { jenis: "bobot", ...nilai } : null}
        petunjukDiam={
          periksa.ok
            ? "Bobot sama dengan yang berlaku. Ubah angkanya untuk melihat dampaknya."
            : "Pratinjau tampil begitu ketiga bobot berjumlah tepat 100."
        }
      />

      <div className={styles.tombolBaris}>
        <button
          type="submit"
          className="tombol tombol-utama"
          aria-disabled={menunggu || undefined}
          onClick={(e) => {
            if (menunggu) e.preventDefault();
          }}
        >
          {menunggu ? "Menyimpan…" : "Simpan bobot"}
        </button>
        {menunggu && <span className={styles.sibuk}>Menyimpan bobot dan memperbarui halaman publik…</span>}
      </div>
    </form>
  );
}
