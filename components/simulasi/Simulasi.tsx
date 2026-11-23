"use client";

import { useDeferredValue, useMemo, useRef } from "react";
import { usePaguFlip } from "@/components/landing/usePaguFlip";
import { geserBobot, samaBobot, tulisBobot, type KunciBobot } from "@/lib/bobot-simulasi";
import { bangunTangga } from "@/lib/peta-pagu";
import {
  LANGKAH_PAGU,
  bandingkanBobot,
  bisaDitambah,
  hitungResmi,
  hitungSimulasi,
  lepaskan,
  rentangPagu,
  ringkasPerRw,
  sisaTempat,
  susunUsulan,
  tambahkan,
  ubahUrgensi,
  type DataSimulasi,
} from "@/lib/simulasi";
import { kalimatPosisiAndaian, kalimatYangBerubah, ringkasHasil, ringkasMenempel } from "@/lib/simulasi-kalimat";
import { tulisKeadaan } from "@/lib/simulasi-url";
import { HasilSimulasi } from "./HasilSimulasi";
import { KendaliBobot } from "./KendaliBobot";
import { KendaliPagu } from "./KendaliPagu";
import { KetahananBobot } from "./KetahananBobot";
import { PetaPagu } from "./PetaPagu";
import { TabelRw } from "./TabelRw";
import { TambahUsulan } from "./TambahUsulan";
import { TombolBagikan } from "./TombolBagikan";
import { useKeadaanUrl } from "./useKeadaanUrl";
import { useKetahanan, type AwalKetahanan } from "./useKetahanan";
import styles from "./Simulasi.module.css";

interface Props {
  data: DataSimulasi;
  awal: AwalKetahanan;
}

const URGENSI_AWAL = 5;

export function Simulasi({ data, awal }: Props) {
  const { keadaan, ubah, tidakTersedia, terpotong, alamatBagikan } = useKeadaanUrl(data);
  // Kendali mengikuti jari seketika; hitungan berat (kombinasi, peta, tabel) boleh menyusul tanpa menahan geseran.
  const tunda = useDeferredValue(keadaan);

  const resmi = useMemo(() => hitungResmi(data), [data]);
  const usulan = useMemo(() => susunUsulan(data, tunda.tambah), [data, tunda.tambah]);
  const rentang = useMemo(() => rentangPagu(usulan, data.dasar.pagu), [usulan, data]);
  // Peta Pagu tidak bergantung pada pagu: hanya dihitung ulang bila daftar usulan atau bobot berubah.
  const tangga = useMemo(() => bangunTangga(usulan, data.dasar.wilayah, tunda.bobot), [usulan, data, tunda.bobot]);
  // Hasilnya dibaca dari tangga (satu pencarian biner), bukan pilihOptimal lagi: menggeser pagu hampir tanpa biaya.
  const hasil = useMemo(() => hitungSimulasi(data, tunda, resmi, tangga), [data, tunda, resmi, tangga]);

  const andaian = useMemo(() => new Set(tunda.tambah.map((t) => t.id)), [tunda.tambah]);
  const bobotResmi = data.dasar.bobot;
  const bobotBeda = !samaBobot(tunda.bobot, bobotResmi);

  // Batang besar memakai nama yang menandai usulan andaian.
  const mode = useMemo(
    () => ({
      ...hasil.mode,
      terpilih: hasil.mode.terpilih.map((t) => (andaian.has(t.id) ? { ...t, nama: `${t.nama} (andaian)` } : t)),
    }),
    [hasil.mode, andaian],
  );

  const perubahan = useMemo(
    () => kalimatYangBerubah(hasil.banding, { bobotBeda, skorBeda: hasil.skorBeda, sertakanStatus: false }),
    [hasil, bobotBeda],
  );
  // Tangga untuk bobot resmi pada usulan yang sama: hanya dibangun bila bobot Anda berbeda, dan tidak dihitung ulang
  // selama bobot digeser (hanya bila daftar usulan berubah).
  const tanggaResmi = useMemo(
    () => (bobotBeda ? bangunTangga(usulan, data.dasar.wilayah, bobotResmi) : null),
    [bobotBeda, usulan, data, bobotResmi],
  );
  const perubahanBobot = useMemo(() => {
    if (!tanggaResmi) return [];
    const { banding, skorBeda } = bandingkanBobot(data, hasil.dasar, hasil.hasil, tanggaResmi);
    return kalimatYangBerubah(banding, { bobotBeda: true, skorBeda });
  }, [tanggaResmi, data, hasil]);

  const ketahanan = useKetahanan({
    pagu: tunda.pagu,
    usulan,
    wilayah: data.dasar.wilayah,
    tangga,
    kunciBobot: tulisBobot(tunda.bobot),
    awal,
    rentang,
  });

  const perRwResmi = useMemo(() => ringkasPerRw(data.dasar.wilayah, resmi.hasil), [data, resmi]);
  const perRwSimulasi = useMemo(() => ringkasPerRw(data.dasar.wilayah, hasil.hasil), [data, hasil]);

  // Animasi FLIP untuk batang besar hanya pada loncatan (preset, tombol, tambah usulan). Saat menggeser, batang
  // mengikuti jari tanpa animasi.
  const akarBatang = useRef<HTMLDivElement>(null);
  const kunciFlip = useMemo(() => tulisKeadaan(tunda, data), [tunda, data]);
  const { tangkap } = usePaguFlip(akarBatang, kunciFlip);

  // Urutan peringkat tidak bergantung pada pagu: dari tangga, jadi tidak berganti saat pagu digeser.
  const urutanPeringkat = useMemo(
    () =>
      tangga.urutan.map((b) => ({
        id: b.usulan.id,
        nama: andaian.has(b.usulan.id) ? `${b.usulan.namaSingkat} (andaian)` : b.usulan.namaSingkat,
      })),
    [tangga, andaian],
  );
  const kalimatDasar = useMemo(() => new Map(hasil.banding.masuk.map((m) => [m.id, m])), [hasil]);

  const tersedia = bisaDitambah(data, keadaan);
  const tempat = sisaTempat(data);
  const ditambah = keadaan.tambah.flatMap((t) => {
    const f = data.forum.find((x) => x.id === t.id);
    if (!f) return [];
    const baris = kalimatDasar.get(t.id);
    return [
      {
        id: f.id,
        nama: f.namaSingkat,
        rw: f.rw,
        biaya: f.estimatedBudget,
        urgensi: t.urgensi,
        kalimat: baris && andaian.has(t.id) ? kalimatPosisiAndaian(baris, t.urgensi) : "Menghitung posisinya…",
      },
    ];
  });

  const ringkas = ringkasHasil(hasil);
  const jamak = (n: number) => (n === 1 ? "Satu usulan" : `${n} usulan`);

  return (
    <div className={styles.tata}>
      {(tidakTersedia > 0 || terpotong > 0) && (
        <p role="note" className={styles.catatan}>
          {tidakTersedia > 0 &&
            `${jamak(tidakTersedia)} dari tautan ini tidak bisa ditambahkan lagi (sudah masuk hitungan, ditutup, atau disembunyikan), jadi tidak ikut dihitung. `}
          {terpotong > 0 && `${jamak(terpotong)} dari tautan ini tidak muat karena hitungan dibatasi 16 usulan.`}
        </p>
      )}

      <div className={styles.dua}>
        <div className={styles.lengket}>
          <KendaliPagu
            pagu={keadaan.pagu}
            paguResmi={data.dasar.pagu}
            min={rentang.min}
            maks={rentang.maks}
            langkah={LANGKAH_PAGU}
            onUbah={(pagu, cara) => {
              if (cara === "loncat") tangkap();
              ubah((k) => ({ ...k, pagu }));
            }}
          />
          <noscript>
            <p className={styles.tanpaJs}>
              Mengubah pagu dan bobot butuh JavaScript. Yang tampil di halaman ini adalah rekomendasi resmi.
            </p>
          </noscript>
        </div>

        <div className={styles.kanan}>
          <section aria-labelledby="judul-hasil" className={styles.seksi}>
            <h2 id="judul-hasil" className={styles.judulSeksi}>
              Yang terbiayai pada pagu ini
            </h2>
            <HasilSimulasi
              akar={akarBatang}
              pagu={tunda.pagu}
              paguResmi={data.dasar.pagu}
              mode={mode}
              modeResmi={resmi.mode}
              banding={hasil.banding}
              ringkasan={ringkas}
              perubahan={perubahan}
              samaDenganResmi={hasil.samaDenganResmi}
              andaian={andaian}
              bobot={tunda.bobot}
            />
          </section>

          <section aria-labelledby="judul-peta" className={styles.seksi}>
            <h2 id="judul-peta" className={styles.judulSeksi}>
              Peta Pagu: berapa pagu supaya usulan terbiayai?
            </h2>
            <PetaPagu
              tangga={tangga}
              pagu={tunda.pagu}
              paguResmi={data.dasar.pagu}
              maks={rentang.maks}
              langkah={LANGKAH_PAGU}
              posisi={hasil.posisi}
              andaian={andaian}
            />
          </section>
        </div>
      </div>

      <section aria-labelledby="judul-bobot" className={styles.seksi}>
        <h2 id="judul-bobot" className={styles.judulSeksi}>
          Bobot penilaian
        </h2>
        <div className={styles.dua}>
          <div className={styles.lengket}>
            <KendaliBobot
              bobot={keadaan.bobot}
              bobotResmi={bobotResmi}
              onGeser={(kunci: KunciBobot, nilai: number) => ubah((k) => ({ ...k, bobot: geserBobot(k.bobot, kunci, nilai) }))}
              onPreset={(bobot) => {
                tangkap();
                ubah((k) => ({ ...k, bobot }));
              }}
            />
          </div>
          <KetahananBobot
            hasil={ketahanan.hasil}
            menghitung={ketahanan.menghitung}
            ajakan={ketahanan.ajakan}
            usulan={urutanPeringkat}
            perubahanBobot={perubahanBobot}
            onCobaPagu={(pagu) => {
              tangkap();
              ubah((k) => ({ ...k, pagu }));
            }}
          />
        </div>
      </section>

      <section aria-labelledby="judul-rw" className={styles.seksi}>
        <h2 id="judul-rw" className={styles.judulSeksi}>
          Siapa yang kebagian
        </h2>
        <TabelRw resmi={perRwResmi} simulasi={perRwSimulasi} />
      </section>

      <section aria-labelledby="judul-tambah" className={styles.seksi}>
        <h2 id="judul-tambah" className={styles.judulSeksi}>
          Tambah usulan dari forum
        </h2>
        <TambahUsulan
          tersedia={tersedia}
          ditambah={ditambah}
          penuh={keadaan.tambah.length >= tempat}
          urgensiAwal={URGENSI_AWAL}
          onTambah={(id, urgensi) => {
            tangkap();
            ubah((k) => tambahkan(data, k, id, urgensi));
          }}
          onUbahUrgensi={(id, urgensi) => ubah((k) => ubahUrgensi(k, id, urgensi))}
          onLepas={(id) => {
            tangkap();
            ubah((k) => lepaskan(k, id));
          }}
        />
      </section>

      <section aria-labelledby="judul-bagikan" className={styles.seksi}>
        <h2 id="judul-bagikan" className={styles.judulSeksi}>
          Bagikan
        </h2>
        <p className={styles.paragrafIsi}>
          Tautan membawa pagu, bobot, dan usulan yang Anda tambahkan. Siapa pun yang membukanya melihat simulasi yang
          sama. Tidak ada yang disimpan di server.
        </p>
        <TombolBagikan alamat={alamatBagikan} />
      </section>

      {/* Ringkasan satu baris yang menempel di dasar layar ponsel, supaya akibat geseran terlihat tanpa menggulir. Bisa
          ditekan: membawa kembali ke pengatur pagu yang ada jauh di atas. Teks yang terlihat disembunyikan dari pembaca
          layar (ringkasannya sudah ada di atas) tetapi tercakup dalam nama tautannya (WCAG 2.5.3). */}
      <a
        href="#kendali-pagu"
        className={styles.menempel}
        aria-label={`${ringkasMenempel(tunda.pagu, hasil).replaceAll(" · ", ", ")}. Ke pengatur pagu`}
      >
        <span aria-hidden="true">{ringkasMenempel(tunda.pagu, hasil)}</span>
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10.5L8 6l4.5 4.5" />
        </svg>
      </a>
    </div>
  );
}

