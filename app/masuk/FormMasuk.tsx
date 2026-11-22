"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { masuk, type StatusMasuk } from "./aksi";
import styles from "./masuk.module.css";

const AWAL: StatusMasuk = { pesan: null, nama: "" };

export function FormMasuk() {
  const [status, aksi, menunggu] = useActionState(masuk, AWAL);
  const [tampilkan, setTampilkan] = useState(false);
  const lanjut = useRef<HTMLInputElement>(null);

  // Tujuan setelah masuk dibaca dari URL di browser, supaya halaman ini tetap statis.
  // Server memeriksa ulang nilainya (lib/tujuan.ts) sebelum mengarahkan.
  useEffect(() => {
    if (lanjut.current) {
      lanjut.current.value = new URLSearchParams(window.location.search).get("lanjut") ?? "";
    }
  }, []);

  const adaGalat = status.pesan !== null;

  return (
    <form action={aksi} className={styles.form}>
      {adaGalat && (
        <p id="galat-masuk" role="alert" className={styles.galat}>
          {status.pesan}
        </p>
      )}

      <input ref={lanjut} type="hidden" name="lanjut" defaultValue="" />

      <div className={styles.kolom}>
        <label htmlFor="nama_pengguna">Nama pengguna</label>
        <input
          id="nama_pengguna"
          name="nama_pengguna"
          type="text"
          required
          maxLength={32}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={status.nama}
          aria-invalid={adaGalat || undefined}
          aria-describedby={adaGalat ? "galat-masuk" : undefined}
        />
      </div>

      <div className={styles.kolom}>
        <label htmlFor="kata_sandi">Kata sandi</label>
        <div className={styles.sandi}>
          <input
            id="kata_sandi"
            name="kata_sandi"
            type={tampilkan ? "text" : "password"}
            required
            maxLength={128}
            autoComplete="current-password"
            aria-invalid={adaGalat || undefined}
            aria-describedby={adaGalat ? "galat-masuk" : undefined}
          />
          <button
            type="button"
            className="tombol tombol-kedua"
            aria-pressed={tampilkan}
            aria-controls="kata_sandi"
            onClick={() => setTampilkan((t) => !t)}
          >
            {tampilkan ? "Sembunyikan" : "Tampilkan"}
            <span className="sr-only"> kata sandi</span>
          </button>
        </div>
      </div>

      <button type="submit" className="tombol tombol-utama" disabled={menunggu}>
        {menunggu ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  );
}
