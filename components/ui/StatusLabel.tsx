import type { StatusUsulan } from "@/lib/seleksi";
import styles from "./StatusLabel.module.css";

const TEKS: Record<StatusUsulan, string> = {
  terpilih: "Terpilih",
  ditunda: "Ditunda",
  "tidak-terpilih": "Tidak terpilih",
};

export function IkonStatus({ status }: { status: StatusUsulan }) {
  const umum = {
    className: styles.ikon,
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    "aria-hidden": true,
    focusable: false,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  if (status === "terpilih")
    return (
      <svg {...umum}>
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    );
  if (status === "ditunda")
    return (
      <svg {...umum}>
        <path d="M5.5 3.5v9M10.5 3.5v9" />
      </svg>
    );
  return (
    <svg {...umum}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/**
 * Ikon dan teks selalu tampil bersama: status tidak pernah hanya mengandalkan warna.
 * `teks` menggantikan kata bawaan bila konteksnya butuh kalimat lain (mis. "Terbiayai" di forum),
 * tanpa mengubah ikon dan warna status.
 */
export function StatusLabel({ status, teks }: { status: StatusUsulan; teks?: string }) {
  return (
    <span className={`${styles.label} ${styles[status]}`}>
      <IkonStatus status={status} />
      {teks ?? TEKS[status]}
    </span>
  );
}
