import Link from "next/link";
import type { BarisLog } from "@/lib/data";
import type { Json } from "@/lib/database.types";
import { RUTE } from "@/lib/tautan";
import styles from "./JejakKeputusan.module.css";

interface Props {
  log: BarisLog[];
  /** Judul usulan menurut id, untuk entri yang menyangkut satu usulan. */
  judulUsulan: ReadonlyMap<string, string>;
}

const JENIS: Record<string, string> = {
  weight_change: "Bobot diubah",
  status_change: "Status berubah",
  selection: "Rekomendasi dihitung",
  note: "Catatan",
};

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function adalahObjek(j: Json | undefined): j is { [k: string]: Json | undefined } {
  return typeof j === "object" && j !== null && !Array.isArray(j);
}

/** "Popularitas 35 ke 30, urgensi 30 ke 40, ..." dari detail log perubahan bobot. */
function rincianBobot(detail: Json): string | null {
  if (!adalahObjek(detail)) return null;
  const { sebelum, sesudah } = detail;
  if (!adalahObjek(sebelum) || !adalahObjek(sesudah)) return null;

  const bagian = Object.keys(sesudah)
    .filter((k) => typeof sebelum[k] === "number" && typeof sesudah[k] === "number")
    .map((k) => `${k} ${sebelum[k]} ke ${sesudah[k]}`);
  if (bagian.length === 0) return null;
  const teks = bagian.join(", ");
  return teks.charAt(0).toUpperCase() + teks.slice(1) + ".";
}

/** Tiga entri terbaru dari log akuntabilitas: bukti bahwa setiap perubahan tercatat. */
export function JejakKeputusan({ log, judulUsulan }: Props) {
  return (
    <section aria-labelledby="judul-jejak" className={`bagian ${styles.bagian}`}>
      <div className="wadah bagian-dua-kolom">
        <div className="bagian-kepala">
          <h2 id="judul-jejak">Jejak keputusan</h2>
          <p>Setiap perubahan tercatat: apa yang berubah, siapa yang mencatat, dan kapan.</p>
        </div>

        <div>
          {log.length === 0 ? (
            <p>Belum ada keputusan yang tercatat. Catatan muncul di sini setelah ada perubahan pertama.</p>
          ) : (
            <ol className={styles.daftar} reversed>
              {log.map((l) => {
                const subjek = l.proposal_id ? judulUsulan.get(l.proposal_id) : undefined;
                const rincian = l.log_type === "weight_change" ? rincianBobot(l.detail) : null;
                return (
                  <li key={l.id} className={styles.entri}>
                    <time dateTime={l.created_at} className={styles.waktu}>
                      {tanggal.format(new Date(l.created_at))}
                    </time>
                    <div className={styles.isi}>
                      <p className={styles.jenis}>{JENIS[l.log_type] ?? "Catatan"}</p>
                      {subjek && <p className={styles.subjek}>{subjek}</p>}
                      <p>{l.message}</p>
                      {rincian && <p className={styles.rincian}>{rincian}</p>}
                      <p className={styles.pencatat}>Dicatat oleh {l.actor}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Link href={RUTE.keputusan} className={styles.semua}>
            Lihat semua keputusan
          </Link>
        </div>
      </div>
    </section>
  );
}
