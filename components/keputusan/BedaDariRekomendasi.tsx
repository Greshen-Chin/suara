import { StatusLabel } from "@/components/ui/StatusLabel";
import { TEKS_SEJALAN_SEMUA } from "@/lib/keputusan-kalimat";
import { LABEL_HASIL } from "@/lib/keputusan";
import type { KeputusanPublik } from "@/lib/keputusan-tipe";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import { STATUS_SESUDAH } from "@/lib/keputusan";
import { namaRw } from "@/lib/keputusan-banding";
import type { WilayahPeriode } from "@/lib/keputusan-tipe";
import { rupiah } from "@/lib/format";
import styles from "./Keputusan.module.css";

/**
 * "Di mana musyawarah berbeda": bagian yang paling menonjol di halaman. Tiap keputusan yang berbeda dari rekomendasi
 * dengan alasan tertulis dalam huruf besar yang nyaman dibaca. Bila tidak ada: "Musyawarah mengikuti seluruh rekomendasi."
 */
export function BedaDariRekomendasi({ keputusan, wilayah }: { keputusan: readonly KeputusanPublik[]; wilayah: readonly WilayahPeriode[] }) {
  const beda = keputusan.filter((k) => k.beda).sort((a, b) => (a.peringkat ?? 999) - (b.peringkat ?? 999));
  return (
    <section className={styles.beda} aria-labelledby="judul-beda">
      <h2 id="judul-beda">Di mana musyawarah berbeda</h2>
      {beda.length === 0 ? (
        <p className={styles.sejalan}>{TEKS_SEJALAN_SEMUA}</p>
      ) : (
        <ul className={styles.bedaDaftar}>
          {beda.map((k) => (
            <li key={k.proposalId} className={styles.bedaItem}>
              <h3>{k.judul ?? "Usulan yang kemudian disembunyikan admin"}</h3>
              <p className={styles.bedaMeta}>
                <span>
                  {namaRw(k.rw, wilayah)}, {rupiah(k.biaya)}.
                </span>
                {k.statusRekomendasi && (
                  <>
                    <span>Rekomendasi:</span>
                    <StatusLabel status={k.statusRekomendasi} />
                  </>
                )}
                <span className={styles.bedaTanda} aria-label="berbeda dari">
                  ≠
                </span>
                <span>Keputusan:</span>
                <StatusSiklus status={STATUS_SESUDAH[k.hasil]} teks={LABEL_HASIL[k.hasil]} />
              </p>
              {k.sumberDana && <p className={styles.bedaMeta}>Sumber dana: {k.sumberDana}.</p>}
              {k.alasan && <p className={styles.bedaAlasan}>{k.alasan}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
