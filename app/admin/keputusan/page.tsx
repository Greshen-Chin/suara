import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DialogBatalPenetapan, DialogTandaiSelesai, HapusDrafSetelahTetap, SisaWaktuBatal } from "@/components/admin/DialogKeputusan";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { LembarKerja } from "@/components/admin/LembarKerja";
import { PesanBerhasil } from "@/components/admin/PesanBerhasil";
import lembar from "@/components/admin/LembarKerja.module.css";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaKeadaanKeputusan } from "@/lib/admin-data";
import { rupiah } from "@/lib/format";
import { LABEL_HASIL, sisaWaktuBatal } from "@/lib/keputusan";
import { namaPeriode, rincianHasil, ringkasTerpakai, tanggalMusyawarahTeks } from "@/lib/keputusan-kalimat";
import { bacaBerhasilKeputusan } from "@/lib/keputusan-pesan";
import { RUTE } from "@/lib/tautan";
import { tanggalDanJam } from "@/lib/waktu";

export const metadata: Metadata = { title: "Admin · Keputusan" };

type Param = Record<string, string | string[] | undefined>;

export default function HalamanKeputusanAdmin({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <Suspense fallback={<Kerangka judul="keputusan" />}>
      <IsiKeputusan searchParams={searchParams} />
    </Suspense>
  );
}

/** Hari ini menurut WIB, YYYY-MM-DD. */
const hariIniWib = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function IsiKeputusan({ searchParams }: { searchParams: Promise<Param> }) {
  // Sisa waktu pembatalan dan "hari ini" bergantung pada jam saat ini: dirender per permintaan, tanpa cache.
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const [k, query] = await Promise.all([bacaKeadaanKeputusan(admin), searchParams]);
  const berhasil = bacaBerhasilKeputusan(query);
  const sekarang = new Date();
  const { terakhir } = k;

  const sisaMs = terakhir && terakhir.periode.diputuskanPada ? sisaWaktuBatal(terakhir.periode.diputuskanPada, sekarang) : 0;
  const bisaBatal = terakhir !== null && terakhir.periode.adaRekomendasi && sisaMs > 0 && !terakhir.adaSelesai;
  // Sesudah penetapan baru saja dibuat, bagian pembatalannya didahulukan: itu yang paling mungkin dicari admin.
  const sesudahDulu = terakhir !== null && terakhir.periode.adaRekomendasi && sisaMs > 0;

  const bagianSesudah = terakhir && terakhir.periode.adaRekomendasi && (
    <section className={lembar.sesudah} aria-labelledby="judul-sesudah" key="sesudah">
      <h2 id="judul-sesudah">Sesudah penetapan</h2>
      <p>
        {namaPeriode(terakhir.periode.tahun)} ditetapkan {terakhir.periode.diputuskanPada ? tanggalDanJam(terakhir.periode.diputuskanPada) : ""}
        {terakhir.periode.diputuskanOleh ? ` oleh ${terakhir.periode.diputuskanOleh}` : ""}. Musyawarahnya{" "}
        {tanggalMusyawarahTeks(terakhir.periode.tanggalMusyawarah) ?? "tanggal tidak tercatat"}.
      </p>
      <p className={styles.penjelas}>
        {ringkasTerpakai(terakhir.periode)}. {rincianHasil(terakhir.periode.jumlah)}.{" "}
        <Link href={`${RUTE.keputusan}/${terakhir.periode.tahun}`}>Lihat halaman publiknya</Link>.
      </p>
      {bisaBatal && terakhir.periode.diputuskanPada ? (
        <>
          <p>
            <SisaWaktuBatal diputuskanPada={terakhir.periode.diputuskanPada} sekarangAwal={sekarang.toISOString()} />
          </p>
          <div className={styles.tombolBaris}>
            <DialogBatalPenetapan tahun={terakhir.periode.tahun} />
          </div>
        </>
      ) : (
        <p className={styles.penjelas}>
          {terakhir.adaSelesai
            ? "Sudah ada usulan dari penetapan ini yang ditandai selesai dikerjakan, jadi penetapan tidak bisa dibatalkan."
            : "Sudah lewat 24 jam sejak penetapan, jadi keputusan tetap dan tidak bisa dibatalkan di sini."}
        </p>
      )}
    </section>
  );

  const bagianLembar = (
    <section className={styles.seksi} aria-labelledby="judul-lembar" key="lembar">
      <h2 id="judul-lembar">{k.berjalan ? `Lembar kerja ${namaPeriode(k.berjalan.tahun)}` : "Lembar kerja"}</h2>
      {!k.berjalan ? (
        <p className={lembar.kosong}>Tidak ada periode yang sedang berjalan, jadi belum ada yang bisa ditetapkan. Hubungi pemilik proyek.</p>
      ) : k.hitungan.usulan.length === 0 ? (
        <p className={lembar.kosong}>
          Belum ada usulan dalam hitungan anggaran, jadi belum ada yang bisa diputuskan. Usulan masuk hitungan lewat{" "}
          <Link href="/admin/usulan?status=menunggu">halaman Usulan</Link>, setelah urgensinya dinilai.
        </p>
      ) : (
        <>
          <p className={styles.penjelas}>
            Pilih hasil musyawarah untuk tiap usulan, urut menurut peringkat rekomendasi. Alasan tertulis wajib bila berbeda dari
            rekomendasi. Pilihan Anda disimpan di perangkat ini selama rapat berlangsung, belum di server.
          </p>
          <LembarKerja
            key={`${k.hitungan.sidik}-${k.berjalan.versi}`}
            tahun={k.berjalan.tahun}
            versi={k.berjalan.versi}
            hitungan={k.hitungan}
            wilayah={k.wilayah}
            hariIni={hariIniWib(sekarang)}
          />
        </>
      )}
    </section>
  );

  const bagianKerja = (
    <section className={lembar.pekerjaan} aria-labelledby="judul-kerja" key="kerja">
      <h2 id="judul-kerja">Pekerjaan berjalan</h2>
      {k.pekerjaan.length === 0 ? (
        <p className={lembar.kosong}>Tidak ada usulan yang menunggu ditandai selesai. Yang disetujui atau diajukan ke dana lain muncul di sini.</p>
      ) : (
        <ul className={lembar.daftarKerja}>
          {k.pekerjaan.map((p) => (
            <li key={p.proposalId} className={lembar.itemKerja}>
              <div className={lembar.itemKerjaIsi}>
                <strong>{p.judul ?? "Usulan yang disembunyikan"}</strong>
                <span className={styles.registerKet}>
                  {namaPeriode(p.tahun)} · {LABEL_HASIL[p.hasil]}
                  {p.sumberDana ? ` (${p.sumberDana})` : ""} · {p.rw !== null ? `RW ${String(p.rw).padStart(2, "0")}, ` : ""}
                  {rupiah(p.biaya)}
                </span>
              </div>
              {p.judul ? (
                <DialogTandaiSelesai id={p.proposalId} statusDibaca={p.statusSekarang} judul={p.judul} />
              ) : (
                <span className={styles.registerKet}>Tampilkan kembali dulu di Moderasi.</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <header className={styles.kepala}>
        <h1>Keputusan</h1>
        <p>
          SUARA merekomendasikan, musyawarah memutuskan. Catat hasil musyawarah untuk semua usulan dalam hitungan, lengkap dengan
          alasan bila berbeda dari rekomendasi. Ini ringkasan keputusan, bukan pengesahan anggaran.
        </p>
      </header>

      {berhasil && (
        <PesanBerhasil>
          {berhasil.kode === "ditetapkan" && (
            <>
              <strong>{berhasil.tahun ? `${namaPeriode(berhasil.tahun)} ditetapkan.` : "Keputusan ditetapkan."}</strong>
              <p>
                Ringkasannya sudah tampil di halaman publik
                {berhasil.tahun ? (
                  <>
                    : <Link href={`${RUTE.keputusan}/${berhasil.tahun}`}>buka halaman keputusan</Link>
                  </>
                ) : null}
                . Anda bisa membatalkannya dalam 24 jam, di bagian Sesudah penetapan.
              </p>
              {berhasil.tahun && <HapusDrafSetelahTetap tahun={berhasil.tahun} />}
            </>
          )}
          {berhasil.kode === "dibatalkan" && (
            <>
              <strong>{berhasil.tahun ? `Penetapan ${namaPeriode(berhasil.tahun)} dibatalkan.` : "Penetapan dibatalkan."}</strong>
              <p>
                Usulan kembali dalam hitungan dan anggaran periode lalu tiap RW dipulihkan. Pembatalannya tercatat di{" "}
                <Link href={`${RUTE.keputusan}?jenis=decision#jejak`}>jejak keputusan</Link>.
              </p>
            </>
          )}
          {berhasil.kode === "selesai" && (
            <>
              <strong>Usulan ditandai selesai dikerjakan.</strong>
              <p>
                {berhasil.id ? <Link href={`${RUTE.forum}/${berhasil.id}`}>Lihat usulannya di forum</Link> : "Catatannya tampil di forum dan halaman keputusan."}
              </p>
            </>
          )}
        </PesanBerhasil>
      )}

      {sesudahDulu ? [bagianSesudah, bagianLembar, bagianKerja] : [bagianLembar, bagianSesudah, bagianKerja]}
    </>
  );
}
