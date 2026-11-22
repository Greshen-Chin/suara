"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ubahPagu } from "@/app/admin/aksi";
import { BATAS_ADMIN, periksaPagu } from "@/lib/admin-skema";
import { STATUS_AKSI_AWAL, type StatusAksi } from "@/lib/admin-status";
import { ribuan, rupiah, rupiahRinci } from "@/lib/format";
import { BATAS } from "@/lib/usulan-skema";
import { KolomAlasan, RingkasGalat, type GalatBertaut } from "./Isian";
import { PratinjauDampak } from "./PratinjauDampak";
import styles from "./Admin.module.css";

interface Props {
  pagu: number;
  /** Versi yang dibaca halaman; dikirim kembali supaya admin lain yang lebih dulu tidak tertimpa. */
  versi: number;
}

/**
 * Formulir pagu. Pesan hasil hidup di komponen luar; isian di komponen dalam yang dipasang ulang (key)
 * setiap versi berubah, jadi setelah berhasil atau setelah "Muat ulang nilai terbaru" isiannya bersih
 * dan memakai nilai yang berlaku, sementara pesan konfirmasinya tetap tampil.
 */
export function FormPagu({ pagu, versi }: Props) {
  const router = useRouter();
  const [status, aksi, menunggu] = useActionState(ubahPagu, STATUS_AKSI_AWAL);
  // Pesan bentrok dari bacaan lama tidak boleh tampil lagi setelah nilai terbaru dimuat.
  const [diabaikan, setDiabaikan] = useState(0);
  const tampil: StatusAksi = status.nomor > diabaikan ? status : STATUS_AKSI_AWAL;

  return (
    <IsiFormPagu
      key={versi}
      pagu={pagu}
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

function IsiFormPagu({
  pagu,
  versi,
  status,
  aksi,
  menunggu,
  muatUlang,
}: Props & { status: StatusAksi; aksi: (form: FormData) => void; menunggu: boolean; muatUlang: () => void }) {
  const [teks, setTeks] = useState(ribuan(pagu));
  const [alasan, setAlasan] = useState("");

  const terbaca = periksaPagu(teks);
  const berubah = terbaca.ok && terbaca.nilai !== pagu;
  const galatPagu = status.galatKolom.pagu ?? null;
  const galatAlasan = status.galatAlasan;

  const galat: GalatBertaut[] = [
    ...(galatPagu ? [{ id: "pagu-baru", pesan: galatPagu }] : []),
    ...(galatAlasan ? [{ id: "pagu-alasan", pesan: galatAlasan }] : []),
  ];

  return (
    <form action={aksi} className={styles.form} noValidate>
      <input type="hidden" name="versi" value={versi} />

      <div className={styles.nilaiPagu}>
        <span className={styles.kolomJudul}>Pagu yang berlaku</span>
        <span className={styles.angkaBesar}>{rupiahRinci(pagu)}</span>
      </div>

      {status.hasil === "berhasil" && (
        <div role="status" className={styles.pesan}>
          <strong>{status.pesan}</strong>
          <p>
            Jejaknya tampil di <Link href="/">halaman utama</Link> dan di riwayat di bawah. Garis Pagu di halaman utama
            dan peringkat di forum sudah memakai pagu baru.
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
            <dd>{terbaca.ok ? rupiahRinci(terbaca.nilai) : teks}</dd>
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

      <div className={styles.kolom}>
        <label htmlFor="pagu-baru">Pagu baru</label>
        <input
          id="pagu-baru"
          name="pagu"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          aria-invalid={galatPagu ? true : undefined}
          aria-describedby={`pagu-baca${galatPagu ? " pagu-baru-galat" : ""}`}
        />
        <p id="pagu-baca" className={styles.petunjuk}>
          {terbaca.ok ? (
            <>
              Terbaca sebagai <strong>{rupiahRinci(terbaca.nilai)}</strong> ({rupiah(terbaca.nilai)}).
            </>
          ) : (
            <>
              Tulis angka, misalnya 300.000.000 atau 300 juta. Rentangnya {rupiah(BATAS_ADMIN.pagu.min)} sampai{" "}
              {rupiah(BATAS_ADMIN.pagu.maks)}.
            </>
          )}
        </p>
        {galatPagu && (
          <p id="pagu-baru-galat" className={styles.galatKolom}>
            {galatPagu}
          </p>
        )}
      </div>

      <KolomAlasan
        id="pagu-alasan"
        nama="alasan"
        label="Alasan"
        bantu={`Tulis ${BATAS.alasan.min} sampai ${BATAS.alasan.maks} karakter. Alasan ini tercatat di jejak keputusan dan bisa dibaca semua warga.`}
        nilai={alasan}
        onUbah={setAlasan}
        maks={BATAS.alasan.maks}
        galat={galatAlasan}
      />

      <PratinjauDampak
        masukan={berubah ? { jenis: "pagu", pagu: teks } : null}
        petunjukDiam={
          terbaca.ok
            ? "Pagu sama dengan yang berlaku. Ubah angkanya untuk melihat dampaknya."
            : "Pratinjau tampil begitu pagunya terbaca."
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
          {menunggu ? "Menyimpan…" : "Simpan pagu"}
        </button>
        {menunggu && <span className={styles.sibuk}>Menyimpan pagu dan memperbarui halaman publik…</span>}
      </div>
    </form>
  );
}
