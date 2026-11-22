import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlurBuatAkun } from "@/components/admin/AlurBuatAkun";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";

export const metadata: Metadata = { title: "Admin · Buat akun warga" };

export default function HalamanAkunBaru() {
  return (
    <Suspense fallback={<Kerangka judul="formulir akun" />}>
      <IsiAkunBaru />
    </Suspense>
  );
}

async function IsiAkunBaru() {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;

  return (
    <>
      <Link href="/admin/akun" className={styles.kembali}>
        <span aria-hidden="true">←&nbsp;</span>Semua akun
      </Link>
      <header className={styles.kepala}>
        <h1>Buat akun warga</h1>
        <p>
          Hanya untuk warga yang sudah terdaftar. Akun admin dibuat lewat terminal, supaya sesi admin yang bocor tidak bisa
          membuat admin baru.
        </p>
      </header>
      <AlurBuatAkun />
    </>
  );
}
