import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { RiwayatKeputusan } from "@/components/admin/RiwayatKeputusan";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaDasarHitung, bacaLogKeputusan, bacaSemuaAkun, bacaSemuaKomentar, bacaSemuaUsulan } from "@/lib/admin-data";
import { susunRingkasan, teksMenunggu } from "@/lib/admin-ringkasan";
import { ribuan, rupiah } from "@/lib/format";
import { hitungRekomendasi } from "@/lib/pratinjau";
import { RUTE } from "@/lib/tautan";

export const metadata: Metadata = { title: "Admin · Ringkasan" };

export default function HalamanRingkasan() {
  return (
    <Suspense fallback={<Kerangka judul="ringkasan" />}>
      <IsiRingkasan />
    </Suspense>
  );
}

async function IsiRingkasan() {
  // Umur usulan dan "24 jam terakhir" bergantung pada jam saat ini: dirender per permintaan.
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const [usulan, akun, komentar, dasar, log] = await Promise.all([
    bacaSemuaUsulan(admin),
    bacaSemuaAkun(admin),
    bacaSemuaKomentar(admin),
    bacaDasarHitung(admin),
    bacaLogKeputusan(admin, { batas: 5 }),
  ]);

  // Lebih dari 16 usulan tidak bisa dihitung (batas pilih_optimal). Tidak seharusnya terjadi karena
  // fungsi SQL menjaganya; bila terjadi, ringkasan tetap tampil tanpa status pagu, bukan galat.
  let hasil = null;
  try {
    hasil = hitungRekomendasi(dasar);
  } catch {
    hasil = null;
  }

  const r = susunRingkasan({ usulan, akun, komentar, hasil, pagu: dasar.pagu, sekarang: new Date() });

  return (
    <>
      <header className={styles.kepala}>
        <h1>Ringkasan</h1>
        <p>Yang menunggu Anda, dari yang paling mendesak.</p>
      </header>

      {!r.adaPekerjaan && (
        <p className={styles.teks}>
          Tidak ada yang menunggu. Semua usulan sudah ditinjau, dan semua akun warga sudah memakai kata sandi sendiri.
        </p>
      )}

      <ol className={styles.register}>
        <li className={styles.registerBaris}>
          <span className={styles.registerAngka}>{ribuan(r.menunggu.jumlah)}</span>
          <div>
            <h2 className={styles.registerJudul}>
              {r.menunggu.jumlah === 0 ? "Tidak ada usulan yang menunggu ditinjau" : "usulan menunggu ditinjau"}
            </h2>
            {r.menunggu.tertua.length > 0 && (
              <ul className={styles.daftarTertua}>
                {r.menunggu.tertua.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/usulan/${u.id}`}>{u.judul}</Link>
                    <span className={styles.registerKet}>{teksMenunggu(u.umurHari)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/usulan?status=menunggu">Tinjau usulan yang menunggu</Link>
          </div>
        </li>

        <li className={styles.registerBaris}>
          <span className={styles.registerAngka}>{r.hitungan.jumlah}</span>
          <div>
            <h2 className={styles.registerJudul}>
              dari maksimal {r.hitungan.batas} usulan masuk hitungan anggaran
            </h2>
            {r.anggaran ? (
              <p>
                {r.anggaran.terbiayai} terbiayai, {r.anggaran.ditunda} ditunda, {r.anggaran.tidakTerpilih} tidak terpilih.
                Sisa pagu {rupiah(r.anggaran.sisa)} dari {rupiah(r.anggaran.pagu)}.
              </p>
            ) : (
              <p className={styles.registerKet}>Status pagu belum bisa dihitung.</p>
            )}
            {r.hitungan.penuh && (
              <p className={styles.registerKet}>
                Hitungan sudah penuh. Kembalikan satu usulan ke pembahasan sebelum memasukkan yang baru.
              </p>
            )}
            <span className={styles.baris}>
              <Link href="/admin/anggaran">Atur anggaran</Link>
              <Link href="/admin/usulan?status=voting">Lihat usulan dalam hitungan</Link>
            </span>
          </div>
        </li>

        <li className={styles.registerBaris}>
          <span className={styles.registerAngka}>{ribuan(r.belumGantiSandi.jumlah)}</span>
          <div>
            <h2 className={styles.registerJudul}>
              {r.belumGantiSandi.jumlah === 0
                ? "Semua akun warga sudah memakai kata sandi sendiri"
                : "akun warga belum mengganti kata sandi"}
            </h2>
            {r.belumGantiSandi.nama.length > 0 && (
              <p className={styles.registerKet}>
                {r.belumGantiSandi.nama.join(", ")}
                {r.belumGantiSandi.jumlah > r.belumGantiSandi.nama.length ? ", dan lainnya" : ""}. Kata sandinya dibuat atau
                diatur ulang admin.
              </p>
            )}
            <Link href="/admin/akun?sandi=belum">{r.belumGantiSandi.jumlah === 0 ? "Lihat akun" : "Lihat akun yang belum mengganti"}</Link>
          </div>
        </li>

        <li className={styles.registerBaris}>
          <span className={styles.registerAngka}>{ribuan(r.komentar24Jam)}</span>
          <div>
            <h2 className={styles.registerJudul}>komentar dalam 24 jam terakhir</h2>
            <p className={styles.registerKet}>
              {r.tersembunyi.usulan + r.tersembunyi.komentar === 0
                ? "Tidak ada konten yang disembunyikan."
                : `${ribuan(r.tersembunyi.usulan)} usulan dan ${ribuan(r.tersembunyi.komentar)} komentar sedang disembunyikan.`}
            </p>
            <Link href="/admin/moderasi">Buka moderasi</Link>
          </div>
        </li>
      </ol>

      <section className={styles.seksi} aria-labelledby="judul-jejak">
        <h2 id="judul-jejak">Jejak keputusan terbaru</h2>
        <RiwayatKeputusan log={log} kosong="Belum ada keputusan yang tercatat." />
        <p className={styles.teks}>
          Warga membaca jejak yang sama di <Link href={RUTE.beranda}>halaman utama</Link>.
        </p>
      </section>
    </>
  );
}
