"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTE } from "@/lib/tautan";
import styles from "./MobileBottomNav.module.css";

// Ikon garis dari public/assets/icons (home, forum, chart, check), ditulis langsung supaya warnanya mengikuti
// currentColor: abu saat diam, hijau saat aktif. "Akun" memakai satu sosok dari ikon users.
const IKON = {
  beranda: <path d="M3 10 12 3l9 7v11h-6v-7H9v7H3z" />,
  forum: <path d="M4 5h16v12H9l-5 4V5z" />,
  simulasi: <path d="M3 21h18M5 18v-6h4v6M11 18V5h4v13M17 18v-9h4v9" />,
  keputusan: <path d="m4 12 5 5L20 6" />,
  akun: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
} as const;

// Keputusan ikut di sini: di ponsel menu atas disembunyikan, jadi tanpa ini halaman Keputusan tidak bisa dijangkau.
const NAV_ITEMS = [
  { href: RUTE.beranda, label: "Beranda", ikon: IKON.beranda },
  { href: RUTE.forum, label: "Forum", ikon: IKON.forum },
  { href: RUTE.simulasi, label: "Simulasi", ikon: IKON.simulasi },
  { href: RUTE.keputusan, label: "Keputusan", ikon: IKON.keputusan },
  { href: RUTE.akun, label: "Akun", ikon: IKON.akun },
] as const;

function Daftar({ jalur }: { jalur: string | null }) {
  return (
    <nav className={styles.navigasiBawah} aria-label="Navigasi cepat ponsel">
      {NAV_ITEMS.map((item) => {
        const isAktif =
          jalur !== null &&
          (item.href === "/" ? jalur === "/" : jalur === item.href || jalur.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.tombol} ${isAktif ? styles.aktif : ""}`}
            aria-current={isAktif ? "page" : undefined}
          >
            <svg
              className={styles.ikon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.ikon}
            </svg>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Membaca alamat halaman, jadi pemakainya harus membungkusnya dengan Suspense (lihat app/layout.tsx). */
export function MobileBottomNav() {
  return <Daftar jalur={usePathname()} />;
}

/** Cadangan statis tanpa penanda halaman aktif, dengan ukuran yang sama, selama bagian klien belum siap. */
export function MobileBottomNavStatis() {
  return <Daftar jalur={null} />;
}
