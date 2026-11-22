"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { buatAkunWarga, cariWargaBebas, cekNamaPengguna } from "@/app/admin/aksi";
import { STATUS_AKSI_AWAL, type HasilCariWarga, type HasilCekNama, type WargaBebas } from "@/lib/admin-status";
import { ATURAN_SANDI } from "@/lib/aturan-sandi";
import { PANJANG_NAMA, periksaNamaPengguna, saranNamaPengguna } from "@/lib/nama-pengguna";
import { RingkasGalat, type GalatBertaut } from "./Isian";
import { LayarSandi } from "./LayarSandi";
import styles from "./Admin.module.css";

const LANGKAH = ["Pilih warga", "Nama pengguna", "Kata sandi awal", "Hasil"] as const;

/** Rincian warga satu baris: "Nomor 20 · RT 3, RW 01". Supaya admin tidak salah orang. */
const rincianWarga = (w: WargaBebas) => `Nomor ${w.nomor} · RT ${w.rt}, RW ${String(w.rw).padStart(2, "0")}`;

/**
 * Membuat akun warga dalam empat langkah pendek: pilih warga, nama pengguna, kata sandi awal, hasil.
 * Hanya akun WARGA yang bisa dibuat dan wajib tertaut ke satu warga yang belum punya akun; akun admin
 * sengaja hanya lewat `npm run akun:buat`, supaya sesi admin yang bocor tidak bisa melahirkan admin
 * baru. Pemakai "Buat akun lain" memasang ulang seluruh alur, jadi tidak ada sisa isian atau kata sandi.
 */
export function AlurBuatAkun() {
  const [kunci, setKunci] = useState(0);
  return <Alur key={kunci} ulang={() => setKunci((k) => k + 1)} />;
}

function Alur({ ulang }: { ulang: () => void }) {
  const [langkah, setLangkah] = useState<1 | 2 | 3>(1);
  const [warga, setWarga] = useState<WargaBebas | null>(null);
  const [nama, setNama] = useState("");
  const [mode, setMode] = useState<"acak" | "manual">("acak");
  const [sandi, setSandi] = useState("");
  const [status, aksi, menunggu] = useActionState(buatAkunWarga, STATUS_AKSI_AWAL);

  const selesai = status.hasil === "berhasil" && status.rahasia !== null;
  const posisi = selesai ? 4 : langkah;

  // Judul langkah menerima fokus saat langkah berganti (pola yang sama dengan formulir "Ajukan usulan").
  const judul = useRef<HTMLHeadingElement>(null);
  const awal = useRef(true);
  useEffect(() => {
    if (awal.current) {
      awal.current = false;
      return;
    }
    judul.current?.focus();
  }, [posisi]);

  function pilih(w: WargaBebas) {
    setWarga(w);
    // Saran nama dibuat sekali, saat warga dipilih; admin bebas mengubahnya.
    setNama((n) => (n === "" || warga?.id !== w.id ? saranNamaPengguna(w.nama) : n));
    setLangkah(2);
  }

  return (
    <div className={styles.sandi}>
      <ol className={styles.langkah} aria-label="Langkah membuat akun">
        {LANGKAH.map((teks, i) => (
          <li key={teks} aria-current={posisi === i + 1 ? "step" : undefined}>
            {i + 1}. {teks}
          </li>
        ))}
      </ol>

      {selesai && status.rahasia ? (
        <>
          <LayarSandi namaPengguna={status.rahasia.namaPengguna} kataSandi={status.rahasia.kataSandi} judul="Akun dibuat." />
          {warga && (
            <p className={styles.teks}>
              Akun untuk <strong>{warga.nama}</strong> ({rincianWarga(warga)}). Perubahan ini tercatat di jejak admin yang hanya
              terlihat oleh admin.
            </p>
          )}
          <div className={styles.tombolBaris}>
            <button type="button" className="tombol tombol-utama" onClick={ulang}>
              Buat akun lain
            </button>
            <Link href="/admin/akun" className="tombol tombol-kedua">
              Lihat semua akun
            </Link>
          </div>
        </>
      ) : langkah === 1 ? (
        <PilihWarga judul={judul} onPilih={pilih} />
      ) : langkah === 2 && warga ? (
        <LangkahNama
          judul={judul}
          warga={warga}
          nama={nama}
          setNama={setNama}
          kembali={() => setLangkah(1)}
          lanjut={() => setLangkah(3)}
        />
      ) : warga ? (
        <form action={aksi} className={styles.form} noValidate>
          <input type="hidden" name="warga" value={warga.id} />
          <input type="hidden" name="namaPengguna" value={nama} />
          <input type="hidden" name="mode" value={mode} />
          {mode === "manual" && <input type="hidden" name="kataSandi" value={sandi} />}

          <h2 ref={judul} tabIndex={-1} className={styles.judulSeksiKecil}>
            Kata sandi awal untuk {nama}
          </h2>

          {status.hasil === "galat" && <GalatBuat status={status} balikNama={() => setLangkah(2)} balikWarga={() => setLangkah(1)} />}

          {/* key: setelah aksi selesai React mereset formulir, dan radio terkontrol kembali ke nilai awalnya
              (bukan state saat ini). Dipasang ulang tiap hasil baru supaya yang terlihat sama dengan state. */}
          <fieldset key={status.nomor} className={styles.pilihanMode}>
            <legend>Bagaimana kata sandi dibuat?</legend>
            <label>
              <input type="radio" name="pilihMode" value="acak" checked={mode === "acak"} onChange={() => setMode("acak")} />
              <span>
                <strong>Dibuat otomatis (disarankan).</strong> Mudah dibacakan: huruf kecil dan angka tanpa karakter yang
                mirip, misalnya k7mq-w3pa-hx8t.
              </span>
            </label>
            <label>
              <input type="radio" name="pilihMode" value="manual" checked={mode === "manual"} onChange={() => setMode("manual")} />
              <span>
                <strong>Saya ketik sendiri.</strong>
              </span>
            </label>
          </fieldset>

          {mode === "manual" && <KolomSandi nilai={sandi} setNilai={setSandi} galat={status.galatKolom.kataSandi ?? null} />}

          <p className={styles.petunjuk}>
            Kata sandi tampil sekali setelah akun dibuat. Warga diminta menggantinya saat pertama masuk.
          </p>

          <div className={styles.tombolBaris}>
            <button type="button" className="tombol tombol-kedua" onClick={() => setLangkah(2)}>
              Kembali
            </button>
            <button
              type="submit"
              className="tombol tombol-utama"
              aria-disabled={menunggu || undefined}
              onClick={(e) => {
                if (menunggu) e.preventDefault();
              }}
            >
              {menunggu ? "Membuat akun…" : "Buat akun"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Langkah 1: pilih warga
// ---------------------------------------------------------------------------

function PilihWarga({ judul, onPilih }: { judul: React.RefObject<HTMLHeadingElement | null>; onPilih: (w: WargaBebas) => void }) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<HasilCariWarga | null>(null);
  const [mencari, setMencari] = useState(false);
  const kata = q.trim();

  // Pencarian langsung dengan jeda 300 ms; hanya jawaban permintaan terakhir yang dipakai
  // (permintaan sebelumnya ditandai kedaluwarsa saat efek dipasang ulang).
  useEffect(() => {
    if (kata.length < 2) return;
    let kedaluwarsa = false;
    const t = setTimeout(async () => {
      setMencari(true);
      const h = await cariWargaBebas(kata);
      if (kedaluwarsa) return;
      setHasil(h);
      setMencari(false);
    }, 300);
    return () => {
      kedaluwarsa = true;
      clearTimeout(t);
    };
  }, [kata]);

  const tampil = kata.length >= 2 ? hasil : null;
  const pengumuman =
    tampil === null || mencari
      ? ""
      : !tampil.ok
        ? tampil.pesan
        : tampil.warga.length === 0
          ? "Tidak ada warga yang cocok. Mungkin warga itu sudah punya akun."
          : `${tampil.warga.length} warga ditemukan.`;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => e.preventDefault()}
      noValidate
    >
      <h2 ref={judul} tabIndex={-1} className={styles.judulSeksiKecil}>
        Pilih warga
      </h2>
      <p className={styles.penjelas}>
        Cari lewat nama atau nomor warga. Hanya warga yang belum punya akun yang muncul di sini.
      </p>

      <div className={styles.kolom}>
        <label htmlFor="cari-warga">Nama atau nomor warga</label>
        <input
          id="cari-warga"
          type="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-describedby="cari-warga-bantu"
        />
        <p id="cari-warga-bantu" className={styles.petunjuk}>
          Ketik minimal 2 huruf nama, atau nomor warga lengkap.
        </p>
      </div>

      <p role="status" className={styles.petunjuk}>
        {pengumuman}
      </p>
      {mencari && (
        <p className={styles.petunjuk} aria-hidden="true">
          Mencari…
        </p>
      )}

      {tampil?.ok && tampil.warga.length > 0 && (
        <ul className={styles.hasilCari} aria-label="Hasil pencarian warga">
          {tampil.warga.map((w) => (
            <li key={w.id}>
              <span>
                <strong>{w.nama}</strong>
                <span className={styles.sedikit}>{rincianWarga(w)}</span>
              </span>
              <button type="button" className="tombol tombol-kedua" onClick={() => onPilih(w)}>
                Pilih<span className="sr-only"> {w.nama}, nomor {w.nomor}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Langkah 2: nama pengguna
// ---------------------------------------------------------------------------

function LangkahNama({
  judul,
  warga,
  nama,
  setNama,
  kembali,
  lanjut,
}: {
  judul: React.RefObject<HTMLHeadingElement | null>;
  warga: WargaBebas;
  nama: string;
  setNama: (n: string) => void;
  kembali: () => void;
  lanjut: () => void;
}) {
  const galat = periksaNamaPengguna(nama);
  const [cek, setCek] = useState<{ nama: string; hasil: HasilCekNama } | null>(null);

  // Ketersediaan dicek setelah berhenti mengetik. Hasilnya hanya berlaku untuk nama yang diperiksa.
  useEffect(() => {
    if (periksaNamaPengguna(nama)) return;
    let batal = false;
    const t = setTimeout(async () => {
      const hasil = await cekNamaPengguna(nama);
      if (!batal) setCek({ nama, hasil });
    }, 500);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [nama]);

  const hasil = cek?.nama === nama ? cek.hasil : null;
  const dipakai = hasil?.ok === true && !hasil.tersedia;
  const bisaLanjut = galat === null && !dipakai;

  let keterangan: string;
  let nada: "netral" | "galat" | "baik" = "netral";
  if (galat) {
    keterangan = galat;
    nada = nama === "" ? "netral" : "galat";
  } else if (hasil === null) keterangan = "Memeriksa ketersediaan…";
  else if (!hasil.ok) keterangan = "Belum bisa memeriksa ketersediaan. Anda tetap bisa lanjut; pemeriksaan akhir dilakukan saat akun dibuat.";
  else if (hasil.tersedia) {
    keterangan = "Nama pengguna ini tersedia.";
    nada = "baik";
  } else {
    keterangan = "Nama pengguna ini sudah dipakai.";
    nada = "galat";
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (bisaLanjut) lanjut();
      }}
      noValidate
    >
      <h2 ref={judul} tabIndex={-1} className={styles.judulSeksiKecil}>
        Nama pengguna
      </h2>

      <div className={styles.dipilih}>
        <strong>{warga.nama}</strong>
        <span className={styles.sedikit}>{rincianWarga(warga)}</span>
        <button type="button" className={styles.hapus} onClick={kembali}>
          Pilih warga lain
        </button>
      </div>

      <div className={styles.kolom}>
        <label htmlFor="nama-pengguna">Nama pengguna</label>
        <input
          id="nama-pengguna"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={PANJANG_NAMA.maks + 8}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          aria-invalid={nada === "galat" ? true : undefined}
          aria-describedby="nama-pengguna-bantu nama-pengguna-ket"
        />
        <p id="nama-pengguna-bantu" className={styles.petunjuk}>
          Warga memakainya untuk masuk. Disarankan dari namanya; boleh diubah. Huruf kecil, angka, titik, garis bawah, atau
          tanda hubung, {PANJANG_NAMA.min} sampai {PANJANG_NAMA.maks} karakter.
        </p>
        <p id="nama-pengguna-ket" role="status" className={nada === "galat" ? styles.galatKolom : styles.petunjuk}>
          {keterangan}
        </p>
        {dipakai && hasil.ok && hasil.saran && (
          <button type="button" className={`tombol tombol-kedua ${styles.rataKiri}`} onClick={() => setNama(hasil.saran ?? nama)}>
            Pakai {hasil.saran}
          </button>
        )}
      </div>

      <div className={styles.tombolBaris}>
        <button type="button" className="tombol tombol-kedua" onClick={kembali}>
          Kembali
        </button>
        <button type="submit" className="tombol tombol-utama" aria-disabled={!bisaLanjut || undefined}>
          Lanjut
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Langkah 3: kata sandi
// ---------------------------------------------------------------------------

function KolomSandi({ nilai, setNilai, galat }: { nilai: string; setNilai: (n: string) => void; galat: string | null }) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className={styles.kolom}>
      <label htmlFor="sandi-manual">Kata sandi</label>
      <div className={styles.sandiManual}>
        <input
          id="sandi-manual"
          type={lihat ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          maxLength={128}
          value={nilai}
          onChange={(e) => setNilai(e.target.value)}
          aria-invalid={galat ? true : undefined}
          aria-describedby={`sandi-aturan${galat ? " sandi-galat" : ""}`}
        />
        <button type="button" className="tombol tombol-kedua" aria-pressed={lihat} onClick={() => setLihat((l) => !l)}>
          {lihat ? "Sembunyikan" : "Tampilkan"}
          <span className="sr-only"> kata sandi</span>
        </button>
      </div>
      <ul id="sandi-aturan" className={styles.petunjuk}>
        {ATURAN_SANDI.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      {galat && (
        <p id="sandi-galat" className={styles.galatKolom}>
          {galat}
        </p>
      )}
    </div>
  );
}

function GalatBuat({
  status,
  balikNama,
  balikWarga,
}: {
  status: { pesan: string | null; galatKolom: Record<string, string>; perluMasuk: boolean };
  balikNama: () => void;
  balikWarga: () => void;
}) {
  const galat: GalatBertaut[] = [
    ...(status.galatKolom.kataSandi ? [{ id: "sandi-manual", pesan: status.galatKolom.kataSandi }] : []),
  ];
  return (
    <RingkasGalat pesan={status.pesan} galat={galat}>
      {status.galatKolom.namaPengguna && (
        <p>
          {status.galatKolom.namaPengguna}{" "}
          <button type="button" className={styles.hapus} onClick={balikNama}>
            Ubah nama pengguna
          </button>
        </p>
      )}
      {status.galatKolom.warga && (
        <p>
          {status.galatKolom.warga}{" "}
          <button type="button" className={styles.hapus} onClick={balikWarga}>
            Pilih warga lain
          </button>
        </p>
      )}
      {status.perluMasuk && (
        <p>
          <Link href={`/masuk?lanjut=${encodeURIComponent("/admin/akun/baru")}`}>Masuk lagi</Link>. Pilihan Anda tetap di layar.
        </p>
      )}
    </RingkasGalat>
  );
}
