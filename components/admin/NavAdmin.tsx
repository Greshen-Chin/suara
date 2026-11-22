"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Admin.module.css";

const BAGIAN = [
  { href: "/admin", teks: "Ringkasan", tepat: true },
  { href: "/admin/usulan", teks: "Usulan", tepat: false },
  { href: "/admin/anggaran", teks: "Anggaran", tepat: false },
  { href: "/admin/akun", teks: "Akun", tepat: false },
  { href: "/admin/moderasi", teks: "Moderasi", tepat: false },
] as const;

/**
 * Navigasi antarbagian admin. Tetap satu deret yang dibungkus ke baris kedua di ponsel (bukan menu
 * hamburger, supaya semua bagian selalu terlihat). Bagian yang dibuka bergaris bawah 3 px dan
 * ber-aria-current, seperti navigasi utama.
 */
export function NavAdmin({ statis = false }: { statis?: boolean }) {
  const jalur = usePathname();
  return (
    <nav className={styles.nav} aria-label="Bagian admin">
      <div className="wadah">
        <ul className={styles.navDaftar}>
          {BAGIAN.map(({ href, teks, tepat }) => {
            const aktif = !statis && (tepat ? jalur === href : jalur === href || jalur.startsWith(`${href}/`));
            return (
              <li key={href}>
                <Link href={href} aria-current={aktif ? "page" : undefined} className={aktif ? styles.aktif : undefined}>
                  {teks}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
