"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Admin.module.css";

/**
 * Pesan konfirmasi setelah aksi berhasil. Fokus berpindah ke pesan ini saat muncul: halamannya baru
 * saja berganti (kembali ke daftar), jadi pembaca layar dan pengguna keyboard harus diberi tahu apa
 * yang terjadi tanpa mencarinya. role="status" membuatnya diumumkan dengan sopan.
 */
export function PesanBerhasil({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className={styles.pesan}>
      {children}
    </div>
  );
}
