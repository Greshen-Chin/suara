"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTE } from "@/lib/tautan";
import styles from "./MobileBottomNav.module.css";

const NAV_ITEMS = [
  { href: RUTE.beranda, label: "Beranda", icon: "⌂" },
  { href: RUTE.forum, label: "Forum", icon: "▤" },
  { href: RUTE.simulasi, label: "Simulasi", icon: "▥" },
  { href: RUTE.akun, label: "Akun", icon: "◉" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigasiBawah} aria-label="Navigasi cepat ponsel">
      {NAV_ITEMS.map((item) => {
        const isAktif =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.tombol} ${isAktif ? styles.aktif : ""}`}
            aria-current={isAktif ? "page" : undefined}
          >
            <span className={styles.ikon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
