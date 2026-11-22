/** Perisai kecil pada cap "Admin desa": sama dengan label pada komentar admin di forum. Dekoratif. */
export function IkonPerisai({ ukuran = 14 }: { ukuran?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={ukuran}
      height={ukuran}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z" />
    </svg>
  );
}
