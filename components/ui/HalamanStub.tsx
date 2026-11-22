import Link from "next/link";
import { RUTE } from "@/lib/tautan";

interface Props {
  judul: string;
}

// TODO: ganti dengan layar sebenarnya. Stub ini ada supaya tautan dari beranda tidak menghasilkan 404.
export function HalamanStub({ judul }: Props) {
  return (
    <main id="isi" tabIndex={-1} className="wadah" style={{ paddingBlock: "4rem" }}>
      <h1 style={{ fontSize: "var(--t-2xl)" }}>{judul}</h1>
      <p style={{ marginTop: "0.75rem" }}>Halaman ini sedang disiapkan.</p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href={RUTE.beranda} className="tombol tombol-kedua">
          Kembali ke beranda
        </Link>
      </p>
    </main>
  );
}
