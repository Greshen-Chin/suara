"use client";

import { useEffect, useState } from "react";

/**
 * Nilai yang baru dipakai setelah `ms` tanpa perubahan. Untuk pengumuman pembaca layar yang tidak membanjiri
 * saat mengetik atau menggeser. Dipakai formulir admin dan halaman simulasi.
 */
export function useDitunda<T>(nilai: T, ms = 600): T {
  const [tunda, setTunda] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setTunda(nilai), ms);
    return () => clearTimeout(t);
  }, [nilai, ms]);
  return tunda;
}
