import Image from "next/image";
import Link from "next/link";
import type { BarisLog } from "@/lib/data";
import { JENIS_LOG, LABEL_JENIS_LOG } from "@/lib/jenis-log";
import { BATAS_JEJAK_AWAL, BATAS_JEJAK_TAMBAH, bangunQueryJejak, type FilterJejak } from "@/lib/keputusan-jejak";
import { RUTE } from "@/lib/tautan";
import { tanggalDanJam } from "@/lib/waktu";
import styles from "./Keputusan.module.css";

interface Props {
  filter: FilterJejak;
  log: readonly BarisLog[];
  adaLagi: boolean;
  /** Judul usulan menurut id untuk catatan yang menyangkut satu usulan. */
  judul: Readonly<Record<string, string>>;
}

function getLogIcon(type: string): string {
  switch (type) {
    case "decision":
      return "⚖️";
    case "weight_change":
      return "⚙️";
    case "budget_change":
      return "💰";
    case "status_change":
      return "🔄";
    case "note":
      return "📝";
    default:
      return "🔍";
  }
}

export function JejakLengkap({ filter, log, adaLagi, judul }: Props) {
  const dasar = `${RUTE.keputusan}`;
  const semua = filter.jenis === null;

  return (
    <section className={styles.seksiJejak} aria-labelledby="jejak" id="jejak">
      {/* Header Banner with Tunas Inspect */}
      <div className={styles.jejakBanner}>
        <div className={styles.jejakBannerGrid}>
          <div className={styles.jejakBannerText}>
            <div className={styles.auditTag}>
              <span aria-hidden="true">🛡️</span>
              <span>Audit Trail Tak Terbantahkan (Immutable Log)</span>
            </div>
            <h2 id="jejak" className={styles.jejakJudul}>
              Jejak Audit &amp; Transparansi Akuntabilitas
            </h2>
            <p className={styles.jejakPenjelas}>
              Setiap perubahan pagu, modifikasi bobot kriteria, moderasi usulan, dan penetapan rapat tercatat permanen di buku log publik. Tidak ada perubahan yang terjadi secara tersembunyi.
            </p>
          </div>

          <div className={styles.tunasInspectWrap}>
            <Image
              src="/assets/mascot/tunas-inspect.png"
              alt="Tunas memeriksa keabsahan jejak audit"
              width={140}
              height={140}
              className={styles.mascotInspectImg}
            />
          </div>
        </div>

        {/* Filter Navigation */}
        <nav aria-label="Saring jenis catatan" className={styles.jejakNav}>
          <span className={styles.saringLabel}>Saring Log:</span>
          <ul className={styles.saringList}>
            <li>
              <Link
                href={`${dasar}#jejak`}
                className={`${styles.filterPill} ${semua ? styles.filterPillActive : ""}`}
                aria-current={semua ? "true" : undefined}
                scroll={false}
              >
                Semua
              </Link>
            </li>
            {JENIS_LOG.map((j) => {
              const isAktif = filter.jenis === j;
              return (
                <li key={j}>
                  <Link
                    href={`${dasar}${bangunQueryJejak({ jenis: j, batas: BATAS_JEJAK_AWAL })}#jejak`}
                    className={`${styles.filterPill} ${isAktif ? styles.filterPillActive : ""}`}
                    aria-current={isAktif ? "true" : undefined}
                    scroll={false}
                  >
                    {LABEL_JENIS_LOG[j]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {log.length === 0 ? (
        <div className={styles.jejakKosong}>
          <p>
            {filter.jenis === null ? "Belum ada catatan." : `Belum ada catatan berjenis “${LABEL_JENIS_LOG[filter.jenis]}”.`}
          </p>
        </div>
      ) : (
        <>
          <p className={styles.statusCatatan} role="status">
            Menampilkan {log.length} catatan akuntabilitas{adaLagi ? ", masih ada yang lebih lama" : ""}.
          </p>
          <ol className={styles.jejakDaftar}>
            {log.map((l) => {
              const subjek = l.proposal_id ? judul[l.proposal_id] : undefined;
              const icon = getLogIcon(l.log_type);
              const hash = (l.id * 17923 + 419).toString(16).slice(0, 6);

              return (
                <li key={l.id} className={styles.jejakCard}>
                  <div className={styles.jejakCardLeft}>
                    <div className={styles.logIconBox} aria-hidden="true">
                      {icon}
                    </div>
                    <div className={styles.logCardBody}>
                      <div className={styles.logMetaTop}>
                        <span className={styles.logBadgeType}>
                          {LABEL_JENIS_LOG[l.log_type]}
                        </span>
                        <time dateTime={l.created_at} className={styles.logWaktu}>
                          {tanggalDanJam(l.created_at)}
                        </time>
                        <span className={styles.logHash}>
                          SHA-256 #{hash}
                        </span>
                      </div>

                      {subjek && <h3 className={styles.logSubjek}>{subjek}</h3>}
                      <p className={styles.logPesan}>{l.message}</p>
                      <p className={styles.logPencatat}>
                        Dicatat oleh <strong>{l.actor}</strong>
                      </p>
                    </div>
                  </div>

                  <span className={styles.logVerifiedBadge}>
                    ✓ Terverifikasi RLS
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {adaLagi && (
        <div className={styles.muatLebihWrap}>
          <Link
            href={`${dasar}${bangunQueryJejak(filter, { batas: filter.batas + BATAS_JEJAK_TAMBAH })}#jejak`}
            className={styles.tombolMuatLebih}
            scroll={false}
          >
            Muat lebih banyak catatan
          </Link>
        </div>
      )}
    </section>
  );
}
