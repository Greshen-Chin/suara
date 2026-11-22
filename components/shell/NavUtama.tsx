"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTE } from "@/lib/tautan";

const TAUTAN = [
  { href: RUTE.forum, teks: "Forum" },
  { href: RUTE.simulasi, teks: "Simulasi" },
  { href: RUTE.keputusan, teks: "Keputusan" },
] as const;

/** Menandai halaman yang sedang dibuka (aria-current) tanpa mengubah susunan tautan. */
export function NavUtama({ kelas, kelasAktif }: { kelas?: string; kelasAktif: string }) {
  const jalur = usePathname();
  return (
    <nav className={kelas} aria-label="Navigasi utama">
      {TAUTAN.map(({ href, teks }) => {
        const aktif = jalur === href || jalur.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={aktif ? "page" : undefined} className={aktif ? kelasAktif : undefined}>
            {teks}
          </Link>
        );
      })}
    </nav>
  );
}

/** Cadangan statis (tanpa penanda halaman aktif) selama bagian klien belum siap. */
export function NavUtamaStatis({ kelas }: { kelas?: string }) {
  return (
    <nav className={kelas} aria-label="Navigasi utama">
      {TAUTAN.map(({ href, teks }) => (
        <Link key={href} href={href}>
          {teks}
        </Link>
      ))}
    </nav>
  );
}
