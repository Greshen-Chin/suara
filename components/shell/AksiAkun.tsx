import Link from "next/link";
import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { RUTE } from "@/lib/tautan";

/**
 * Tombol di kanan header dengan dukungan 3 Konteks Akses (Visitor, Warga, Admin)
 * Membaca sesi dalam Suspense sehingga sisa header tetap diprerender statis.
 */
export async function AksiAkun() {
  const pengguna = await ambilPenggunaUntukBaca();

  if (pengguna) {
    if (pengguna.peran === "admin") {
      return (
        <>
          <Link href={RUTE.admin} className="tombol tombol-utama">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Panel Admin
          </Link>
          <Link href={RUTE.akun} className="tombol tombol-kedua">
            {pengguna.nama}
          </Link>
        </>
      );
    }

    // Peran Warga: Tampilkan aksi cepat "Buat Usulan" dan status warga
    return (
      <>
        <Link href="/forum/usul" className="tombol tombol-utama">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Buat Usulan
        </Link>
        <Link href={RUTE.akun} className="tombol tombol-kedua" aria-label={`Akun ${pengguna.nama}`}>
          Warga
        </Link>
      </>
    );
  }

  return <TombolTamu />;
}

export function TombolTamu() {
  return (
    <>
      <Link href={RUTE.forum} className="tombol tombol-kedua">
        Jelajahi Usulan
      </Link>
      <Link href={RUTE.masuk} className="tombol tombol-utama">
        Masuk
      </Link>
    </>
  );
}
