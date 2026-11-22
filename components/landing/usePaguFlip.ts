"use client";

// FLIP (First, Last, Invert, Play) untuk Garis Pagu: saat mode berganti, setiap elemen
// ber-atribut data-flip meluncur dari posisi lamanya ke posisi barunya. Hanya transform
// yang dianimasikan. Isi elemen (data-flip-isi) diberi skala kebalikan supaya teks tidak
// melar selama perpindahan. Dengan prefers-reduced-motion, perpindahan langsung.
import { useLayoutEffect, useRef, type RefObject } from "react";

const DURASI_MS = 520;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

interface Kotak {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Posisi diukur relatif terhadap akar, jadi tahan terhadap gulir halaman. */
function ukurSemua(akar: HTMLElement): Map<string, Kotak> {
  const asal = akar.getBoundingClientRect();
  const hasil = new Map<string, Kotak>();
  akar.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
    const r = el.getBoundingClientRect();
    hasil.set(el.dataset.flip ?? "", {
      x: r.left - asal.left,
      y: r.top - asal.top,
      w: r.width,
      h: r.height,
    });
  });
  return hasil;
}

function efekFlip(el: HTMLElement, dari: Kotak, ke: Kotak) {
  const dx = dari.x - ke.x;
  const dy = dari.y - ke.y;
  const sx = ke.w === 0 ? 1 : dari.w / ke.w;
  const sy = ke.h === 0 ? 1 : dari.h / ke.h;
  const tidakBerubah =
    Math.abs(dx) < 1 &&
    Math.abs(dy) < 1 &&
    Math.abs(sx - 1) < 0.01 &&
    Math.abs(sy - 1) < 0.01;
  if (tidakBerubah) return;

  const opsi = { duration: DURASI_MS, easing: EASING } as const;
  el.animate(
    [
      {
        transformOrigin: "0 0",
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      },
      { transformOrigin: "0 0", transform: "none" },
    ],
    opsi,
  );
  el.querySelector<HTMLElement>(":scope > [data-flip-isi]")?.animate(
    [
      { transformOrigin: "0 0", transform: `scale(${1 / sx}, ${1 / sy})` },
      { transformOrigin: "0 0", transform: "none" },
    ],
    opsi,
  );
}

/**
 * Panggil `tangkap()` tepat sebelum mengubah state yang menggeser tata letak.
 * Setelah render, elemen dianimasikan dari posisi yang ditangkap ke posisi barunya.
 * `kunci` adalah nilai yang berubah bersama state tersebut.
 */
export function usePaguFlip(akar: RefObject<HTMLElement | null>, kunci: unknown) {
  const sebelum = useRef<Map<string, Kotak> | null>(null);

  // Fungsi biasa: React Compiler yang mengurus memoisasinya.
  const tangkap = () => {
    if (akar.current) sebelum.current = ukurSemua(akar.current);
  };

  useLayoutEffect(() => {
    const lama = sebelum.current;
    sebelum.current = null;
    const el = akar.current;
    if (!lama || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Hentikan animasi yang masih berjalan agar posisi akhir terukur tanpa transform.
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const baru = ukurSemua(el);

    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
      const id = node.dataset.flip ?? "";
      const dari = lama.get(id);
      const ke = baru.get(id);
      if (dari && ke) efekFlip(node, dari, ke);
    });
  }, [kunci, akar]);

  return { tangkap };
}
