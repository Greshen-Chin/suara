import { Fragment, useState, type CSSProperties } from "react";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { rupiah } from "@/lib/format";
import { titikSkala } from "@/lib/pagu";
import { dalamRuas, kalimatRuas, ruasPerUsulan, teksRuas, type Ruas, type Tangga } from "@/lib/peta-pagu";
import { labelRw, TEKS_STATUS, type PosisiHitung } from "@/lib/pratinjau";
import styles from "./PetaPagu.module.css";

interface Props {
  tangga: Tangga;
  /** Pagu yang sedang disimulasikan, dan pagu resmi. */
  pagu: number;
  paguResmi: number;
  /** Ujung sumbu mendatar dan langkah kisi (sama dengan geseran pagu). */
  maks: number;
  langkah: number;
  /** Posisi tiap usulan pada simulasi sekarang (status pada pagu Anda). */
  posisi: ReadonlyMap<string, PosisiHitung>;
  /** Usulan forum yang ditambahkan sebagai andaian. */
  andaian: ReadonlySet<string>;
}

/**
 * Rentang rupiah ("Rp 110–125 juta", dengan spasi tak terputus) dibungkus supaya tidak patah di tanda pisah:
 * "Rp 110–" di akhir satu baris dan "125 juta" di awal baris berikutnya sulit dibaca.
 */
const POLA_RENTANG = /(Rp\u00a0[\d.,]+–[\d.,]+\u00a0(?:juta|miliar))/;
function tanpaPatah(teks: string) {
  return teks.split(POLA_RENTANG).map((bagian, i) =>
    i % 2 === 1 ? (
      <span key={i} className={styles.rentang}>
        {bagian}
      </span>
    ) : (
      <Fragment key={i}>{bagian}</Fragment>
    ),
  );
}

interface BarisPeta {
  id: string;
  nama: string;
  rw: number;
  biaya: number;
  ruas: readonly Ruas[];
}

const JUTA = 1_000_000;

function urutkan(tangga: Tangga, langkah: number, maks: number): BarisPeta[] {
  const ruas = ruasPerUsulan(tangga, { langkah, maks });
  return tangga.urutan
    .map((b, i) => ({
      i,
      baris: { id: b.usulan.id, nama: b.usulan.namaSingkat, rw: b.usulan.rw, biaya: b.usulan.estimatedBudget, ruas: ruas.get(b.usulan.id) ?? [] },
    }))
    .sort((a, b) => {
      // Yang paling cepat terbiayai di atas; yang tidak pernah terbiayai di bawah; seri menurut peringkat.
      const x = a.baris.ruas[0]?.dari ?? Number.POSITIVE_INFINITY;
      const y = b.baris.ruas[0]?.dari ?? Number.POSITIVE_INFINITY;
      return x === y ? a.i - b.i : x < y ? -1 : 1;
    })
    .map((x) => x.baris);
}

export function PetaPagu({ tangga, pagu, paguResmi, maks, langkah, posisi, andaian }: Props) {
  const [modeTampilan, setModeTampilan] = useState<"warga" | "diagram">("warga");
  const baris = urutkan(tangga, langkah, maks);
  const persen = (x: number) => Math.min(100, Math.max(0, (x / maks) * 100));
  const gaya = { "--anda": persen(pagu), "--resmi": persen(paguResmi) } as CSSProperties;
  const tanda = titikSkala(maks, 4);

  // Kelompokkan usulan untuk tampilan ramah warga
  const usulanTerbiayai = baris.filter((b) => posisi.get(b.id)?.status === "terpilih");
  const usulanBelum = baris.filter((b) => posisi.get(b.id)?.status !== "terpilih");
  const totalTerpakai = usulanTerbiayai.reduce((acc, u) => acc + u.biaya, 0);
  const sisaPagu = Math.max(0, pagu - totalTerpakai);

  return (
    <div className={styles.peta}>
      {/* Pengalih Mode Tampilan */}
      <div className={styles.wadahPilihanMode}>
        <div className={styles.kelompokPilihanMode} role="tablist" aria-label="Format tampilan hasil simulasi pagu">
          <button
            type="button"
            role="tab"
            aria-selected={modeTampilan === "warga"}
            className={`${styles.tombolPilihanMode} ${modeTampilan === "warga" ? styles.tombolModeAktif : ""}`}
            onClick={() => setModeTampilan("warga")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Daftar Usulan Warga</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modeTampilan === "diagram"}
            className={`${styles.tombolPilihanMode} ${modeTampilan === "diagram" ? styles.tombolModeAktif : ""}`}
            onClick={() => setModeTampilan("diagram")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span>Diagram Analisis Rentang Pagu</span>
          </button>
        </div>
      </div>

      {modeTampilan === "warga" ? (
        /* TAMPILAN 1: RAMAH WARGA DESA */
        <div className={styles.tampilanWarga}>
          {/* Bagian 1: Usulan yang Berhasil Lolos Anggaran */}
          <div className={styles.seksiWarga}>
            <div className={styles.kepalaSeksiWarga}>
              <div className={styles.judulGrupWarga}>
                <span className={styles.ikonStatusLolos} aria-hidden="true">✓</span>
                <h3 className={styles.judulKelompok}>Lolos Masuk Anggaran ({usulanTerbiayai.length} Usulan)</h3>
              </div>
              <span className={styles.totalTerpakai}>
                Total Terpakai: <strong>{rupiah(totalTerpakai)}</strong>
              </span>
            </div>

            <div className={styles.daftarKartuWarga}>
              {usulanTerbiayai.map((b, index) => {
                const ikutAndaian = andaian.has(b.id);
                return (
                  <div key={b.id} className={`${styles.kartuWarga} ${styles.kartuLolos}`}>
                    <div className={styles.kartuWargaUtama}>
                      <span className={styles.nomorUrut}>#{index + 1}</span>
                      <div className={styles.infoUsulanWarga}>
                        <div className={styles.namaUsulanWarga}>
                          <strong>{b.nama}</strong>
                          {ikutAndaian && <span className={styles.andaian}>andaian</span>}
                        </div>
                        <div className={styles.metaUsulanWarga}>
                          <span>{labelRw(b.rw)}</span>
                          <span>·</span>
                          <strong className={styles.biayaWarga}>{rupiah(b.biaya)}</strong>
                        </div>
                      </div>
                    </div>
                    <div className={styles.statusLolosWarga}>
                      <span className={styles.badgeLolos}>✅ Masuk Anggaran</span>
                      <span className={styles.keteranganLolos}>Terbiayai pada pagu {rupiah(pagu)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Batas Garis Pagu Anda Saat Ini */}
          <div className={styles.pembatasPaguWarga}>
            <div className={styles.garisPembatas} />
            <div className={styles.kotakBatasPagu}>
              <span className={styles.labelBatasPagu}>Batas Pagu:</span>
              <strong className={styles.angkaBatasPagu}>{rupiah(pagu)}</strong>
              <span className={styles.sisaPaguKecil}>(Sisa Pagu: {rupiah(sisaPagu)})</span>
            </div>
            <div className={styles.garisPembatas} />
          </div>

          {/* Bagian 2: Usulan yang Belum Masuk Anggaran */}
          <div className={styles.seksiWarga}>
            <div className={styles.kepalaSeksiWarga}>
              <div className={styles.judulGrupWarga}>
                <span className={styles.ikonStatusBelum} aria-hidden="true">⏳</span>
                <h3 className={styles.judulKelompok}>Belum Terbiayai ({usulanBelum.length} Usulan)</h3>
              </div>
              <span className={styles.keteranganBelum}>Memerlukan tambahan pagu agar bisa masuk</span>
            </div>

            {usulanBelum.length === 0 ? (
              <p className={styles.semuaTerbiayai}>Hebat! Seluruh usulan pembangunan desa terbiayai pada pagu ini.</p>
            ) : (
              <div className={styles.daftarKartuWarga}>
                {usulanBelum.map((b, index) => {
                  const ikutAndaian = andaian.has(b.id);
                  const ruasBerikutnya = b.ruas.find((r) => r.dari > pagu) ?? b.ruas[0];
                  const paguDibutuhkan = ruasBerikutnya ? ruasBerikutnya.dari : null;
                  const selisih = paguDibutuhkan ? Math.max(0, paguDibutuhkan - pagu) : null;

                  return (
                    <div key={b.id} className={`${styles.kartuWarga} ${styles.kartuBelum}`}>
                      <div className={styles.kartuWargaUtama}>
                        <span className={styles.nomorUrut}>#{usulanTerbiayai.length + index + 1}</span>
                        <div className={styles.infoUsulanWarga}>
                          <div className={styles.namaUsulanWarga}>
                            <span>{b.nama}</span>
                            {ikutAndaian && <span className={styles.andaian}>andaian</span>}
                          </div>
                          <div className={styles.metaUsulanWarga}>
                            <span>{labelRw(b.rw)}</span>
                            <span>·</span>
                            <strong className={styles.biayaWarga}>{rupiah(b.biaya)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className={styles.statusBelumWarga}>
                        <span className={styles.badgeBelum}>Belum Masuk</span>
                        {paguDibutuhkan && selisih !== null ? (
                          <span className={styles.keteranganKekurangan}>
                            Kurang <strong>{rupiah(selisih)}</strong> lagi (Bisa lolos di pagu {rupiah(paguDibutuhkan)})
                          </span>
                        ) : (
                          <span className={styles.keteranganKekurangan}>Belum cukup pada rentang pagu ini</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAMPILAN 2: DIAGRAM ANALISIS TEKNIS RENTANG PAGU */
        <>
          <p className={styles.keterangan}>
            Tiap baris satu usulan. Ruas hijau menunjukkan pagu yang membuat usulan itu terbiayai. Garis tebal adalah pagu
            Anda, garis tipis pagu resmi.
          </p>

          {/* Legenda visual untuk membantu pembacaan arsir vs hijau */}
          <div className={styles.legendaDiagram} aria-label="Keterangan warna diagram">
            <div className={styles.itemLegendaDiagram}>
              <span className={styles.kotakHijauLegenda} aria-hidden="true" />
              <span><strong>Hijau Solid:</strong> Terbiayai (Lolos)</span>
            </div>
            <div className={styles.itemLegendaDiagram}>
              <span className={styles.kotakArsirLegenda} aria-hidden="true" />
              <span><strong>Box Berarsir:</strong> Belum Terbiayai (Dana Belum Cukup)</span>
            </div>
            <div className={styles.itemLegendaDiagram}>
              <span className={styles.garisHitamLegenda} aria-hidden="true" />
              <span><strong>Garis Hitam:</strong> Pagu Anda ({rupiah(pagu)})</span>
            </div>
          </div>

          <div className={styles.kisi} style={gaya}>
            <div className={`${styles.sumbu} ${styles.sumbuAtas}`} aria-hidden="true">
              <div className={styles.jalurSumbu}>
                <span className={styles.bendera}>Pagu Anda {rupiah(pagu)}</span>
              </div>
            </div>

            <ol className={styles.daftar} aria-label="Pagu yang dibutuhkan tiap usulan, dari yang paling cepat terbiayai">
              {baris.map((b) => {
                const pos = posisi.get(b.id);
                const terbiayai = pos?.status === "terpilih";
                const ikutAndaian = andaian.has(b.id);
                return (
                  <li key={b.id} className={styles.baris}>
                    <div className={styles.label}>
                      <span className={styles.nama}>
                        {b.nama}
                        {ikutAndaian && <span className={styles.andaian}>andaian</span>}
                      </span>
                      <span className={styles.meta}>
                        {labelRw(b.rw)} · {rupiah(b.biaya)}
                      </span>
                    </div>
                    <div className={styles.jalur} aria-hidden="true">
                      {/* Box rel berarsir penanda rentang dana belum mencukupi */}
                      <span className={styles.relDasar} />

                      {b.ruas.map((r) => {
                        const akhir = r.sampai === null ? maks : Math.min(maks, r.sampai + langkah);
                        return (
                          <span
                            key={r.dari}
                            className={dalamRuas([r], pagu) ? `${styles.ruas} ${styles.menyala}` : styles.ruas}
                            style={{ left: `${persen(r.dari)}%`, width: `${Math.max(persen(akhir) - persen(r.dari), 0.6)}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className={styles.kalimat}>
                      {pos && <StatusLabel status={pos.status} teks={TEKS_STATUS[pos.status]} />}
                      <p>{tanpaPatah(kalimatRuas(b.nama, b.ruas, pagu, maks, terbiayai))}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className={`${styles.sumbu} ${styles.sumbuBawah}`} aria-hidden="true">
              <div className={styles.jalurSumbu}>
                {tanda.map((t, i) => (
                  <span key={t.posisi} className={styles.tanda} style={{ "--p": t.posisi } as CSSProperties}>
                    {t.rupiah / JUTA}
                    {i === tanda.length - 1 ? " juta" : ""}
                  </span>
                ))}
                {pagu !== paguResmi && <span className={styles.benderaResmi}>Resmi {rupiah(paguResmi)}</span>}
              </div>
            </div>
          </div>

          <details className={styles.rincian}>
            <summary>Kenapa ruasnya bisa terputus?</summary>
            <p>
              Satu usulan bisa terbiayai pada satu rentang pagu, hilang, lalu muncul lagi. Itu bukan galat. SUARA memilih
              kombinasi usulan dengan jumlah skor terbesar yang muat dalam pagu. Pagu yang sedikit lebih besar kadang memuat
              pasangan usulan yang lebih baik, dan pasangan itu tidak berisi usulan tadi.
            </p>
          </details>

          <details className={styles.rincian}>
            <summary>Lihat sebagai tabel</summary>
            <table className={styles.tabel} role="table">
              <caption>Pagu yang membuat tiap usulan terbiayai, dari yang paling cepat</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">Usulan</th>
                  <th scope="col" role="columnheader">Biaya</th>
                  <th scope="col" role="columnheader">Terbiayai pada pagu</th>
                  <th scope="col" role="columnheader">Pada pagu Anda</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {baris.map((b) => {
                  const pos = posisi.get(b.id);
                  return (
                    <tr key={b.id} role="row">
                      <th scope="row" role="rowheader">
                        {b.nama} {labelRw(b.rw)}
                        {andaian.has(b.id) ? " (andaian)" : ""}
                      </th>
                      <td role="cell">{rupiah(b.biaya)}</td>
                      <td role="cell">{b.ruas.length > 0 ? b.ruas.map(teksRuas).join(", ") : "Tidak pernah, sampai " + rupiah(maks)}</td>
                      <td role="cell">{pos ? TEKS_STATUS[pos.status] : "Belum dihitung"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
