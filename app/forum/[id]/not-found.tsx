import Link from "next/link";
import { RUTE } from "@/lib/tautan";

export default function UsulanTidakDitemukan() {
  return (
    <main id="isi" tabIndex={-1} className="wadah" style={{ paddingBlock: "4rem", display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      <h1 style={{ fontSize: "var(--t-2xl)" }}>Usulan tidak ditemukan</h1>
      <p style={{ maxWidth: "52ch" }}>
        Alamat ini tidak cocok dengan usulan mana pun. Mungkin tautannya salah ketik, atau usulannya
        sudah tidak ada.
      </p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem" }}>
        <Link href={RUTE.forum} className="tombol tombol-utama">
          Lihat semua usulan
        </Link>
        <Link href="/forum/usul" className="tombol tombol-kedua">
          Ajukan usulan
        </Link>
      </p>
    </main>
  );
}
