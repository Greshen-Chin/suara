import Link from "next/link";
import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { RUTE } from "@/lib/tautan";

/**
 * Tombol di kanan header. Membaca sesi, jadi harus dibungkus Suspense oleh pemakainya:
 * sisa header tetap bisa diprerender statis. Sudah masuk: nama pengguna yang tertaut ke /akun.
 */
export async function AksiAkun() {
  const pengguna = await ambilPenggunaUntukBaca();
  if (pengguna) {
    return (
      <Link href={RUTE.akun} className="tombol tombol-kedua" aria-label={`Akun ${pengguna.nama}`}>
        {pengguna.nama}
      </Link>
    );
  }
  return <TombolTamu />;
}

export function TombolTamu() {
  return (
    <>
      <Link href={RUTE.forum} className="tombol tombol-utama">
        Coba sebagai warga
      </Link>
      <Link href={RUTE.masuk} className="tombol tombol-kedua">
        Masuk
      </Link>
    </>
  );
}
