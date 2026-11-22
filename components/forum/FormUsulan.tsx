"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  ajukanUsulan,
  dukungUsulan,
  periksaKemiripan,
  type HasilPeriksaMirip,
} from "@/app/forum/aksi";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import { rupiahRinci } from "@/lib/format";
import { parseRupiah } from "@/lib/rupiah";
import { RUTE } from "@/lib/tautan";
import {
  BATAS,
  KATEGORI,
  LABEL_KATEGORI,
  panjang,
  periksaUsulan,
  type Bidang,
  type GalatUsulan,
  type MasukanUsulan,
} from "@/lib/usulan-skema";
import { ribuan } from "@/lib/format";
import styles from "./FormUsulan.module.css";

interface Props {
  /** RW tempat tinggal warga; bawaan isian RW lokasi. */
  rwBawaan: number | null;
  wilayah: { rw: number; nama: string }[];
}

type Langkah = "isi" | "periksa" | "tinjau";
type HasilMirip = Extract<HasilPeriksaMirip, { ok: true }>;

const ALAMAT_FORM = "/forum/usul";
const KUNCI_DRAF = "suara:draf-usulan";
const URUTAN_BIDANG: Bidang[] = ["judul", "namaSingkat", "deskripsi", "kategori", "rw", "biaya"];
const ID_BIDANG: Record<Bidang, string> = {
  judul: "u-judul",
  namaSingkat: "u-singkat",
  deskripsi: "u-deskripsi",
  kategori: "u-kategori",
  rw: "u-rw",
  biaya: "u-biaya",
};

// ---------------------------------------------------------------------------
// Draf di sessionStorage (dibungkus try/catch: bisa ditolak di mode privat)
// ---------------------------------------------------------------------------

function bacaDraf(): MasukanUsulan | null {
  try {
    const mentah = sessionStorage.getItem(KUNCI_DRAF);
    if (!mentah) return null;
    const j: unknown = JSON.parse(mentah);
    if (typeof j !== "object" || j === null) return null;
    const o = j as Record<string, unknown>;
    return {
      judul: String(o.judul ?? ""),
      namaSingkat: String(o.namaSingkat ?? ""),
      deskripsi: String(o.deskripsi ?? ""),
      kategori: String(o.kategori ?? ""),
      rw: String(o.rw ?? ""),
      biaya: String(o.biaya ?? ""),
    };
  } catch {
    return null;
  }
}

function tulisDraf(nilai: MasukanUsulan) {
  try {
    sessionStorage.setItem(KUNCI_DRAF, JSON.stringify(nilai));
  } catch {
    /* draf hanyalah kemudahan; kegagalan menyimpannya tidak boleh mengganggu */
  }
}

function hapusDraf() {
  try {
    sessionStorage.removeItem(KUNCI_DRAF);
  } catch {
    /* abaikan */
  }
}

const adaIsi = (n: MasukanUsulan) => [n.judul, n.namaSingkat, n.deskripsi, n.biaya].some((x) => x.trim() !== "");

// ---------------------------------------------------------------------------
// Pembungkus: formulir hanya dirender setelah hidrasi, karena drafnya ada di browser.
// ---------------------------------------------------------------------------

const tanpaLangganan = () => () => {};

export function FormUsulan(props: Props) {
  const siap = useSyncExternalStore(tanpaLangganan, () => true, () => false);
  if (!siap) {
    return <div className={styles.kerangkaForm} role="status" aria-label="Memuat formulir" />;
  }
  return <IsiFormUsulan {...props} />;
}

function IsiFormUsulan({ rwBawaan, wilayah }: Props) {
  const router = useRouter();
  const rwTersedia = wilayah.map((w) => w.rw);

  const [awal] = useState(() => {
    const draf = bacaDraf();
    return {
      nilai: draf ?? {
        judul: "",
        namaSingkat: "",
        deskripsi: "",
        kategori: "",
        rw: rwBawaan !== null ? String(rwBawaan) : "",
        biaya: "",
      },
      dipulihkan: draf !== null && adaIsi(draf),
    };
  });
  const [nilai, setNilai] = useState<MasukanUsulan>(awal.nilai);
  const [dipulihkan, setDipulihkan] = useState(awal.dipulihkan);
  const [langkah, setLangkah] = useState<Langkah>("isi");
  const [galat, setGalat] = useState<GalatUsulan>({});
  const [galatAksi, setGalatAksi] = useState<{ pesan: string; perluMasuk?: boolean } | null>(null);
  const [mirip, setMirip] = useState<HasilMirip | null>(null);
  const [pemeriksaanGagal, setPemeriksaanGagal] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();
  const [sedangMenggabung, setSedangMenggabung] = useState<string | null>(null);
  const [pratinjauSr, setPratinjauSr] = useState("");
  const judulLangkah = useRef<HTMLHeadingElement>(null);

  // Memindahkan fokus ke judul langkah yang baru, supaya pembaca layar dan pengguna keyboard
  // tidak tertinggal di tombol yang sudah hilang.
  useEffect(() => {
    if (langkah !== "isi") judulLangkah.current?.focus();
  }, [langkah]);

  function ubah(bidang: keyof MasukanUsulan, teks: string) {
    const baru = { ...nilai, [bidang]: teks };
    setNilai(baru);
    tulisDraf(baru);
    if (galat[bidang]) setGalat((g) => ({ ...g, [bidang]: undefined }));
  }

  function mulaiDariAwal() {
    hapusDraf();
    setNilai({ judul: "", namaSingkat: "", deskripsi: "", kategori: "", rw: rwBawaan !== null ? String(rwBawaan) : "", biaya: "" });
    setDipulihkan(false);
    setGalat({});
  }

  function fokusBidangPertama(g: GalatUsulan) {
    const pertama = URUTAN_BIDANG.find((b) => g[b]);
    if (pertama) document.getElementById(ID_BIDANG[pertama])?.focus();
  }

  function keMasuk() {
    // Isian sudah tersimpan di draf; setelah masuk lagi formulir ini terisi kembali.
    router.push(`${RUTE.masuk}?lanjut=${encodeURIComponent(ALAMAT_FORM)}`);
  }

  // ---- Langkah 1 -> 2 ----
  function periksa(e: React.FormEvent) {
    e.preventDefault();
    if (menunggu) return;
    const hasil = periksaUsulan(nilai, rwTersedia);
    if (!hasil.ok) {
      setGalat(hasil.galat);
      setGalatAksi(null);
      requestAnimationFrame(() => fokusBidangPertama(hasil.galat));
      return;
    }
    setGalat({});
    setGalatAksi(null);
    setPemeriksaanGagal(null);
    mulai(async () => {
      const h = await periksaKemiripan(nilai);
      if (h.ok) {
        setMirip(h);
        setLangkah("periksa");
        return;
      }
      if (h.kode === "belum_masuk") return keMasuk();
      if (h.kode === "tidak_valid" && "galatBidang" in h && h.galatBidang) {
        setGalat(h.galatBidang);
        requestAnimationFrame(() => fokusBidangPertama(h.galatBidang!));
        return;
      }
      if (h.kode === "gangguan") {
        // Jangan pernah memblokir warga: pemeriksaan boleh dilewati.
        setMirip(null);
        setPemeriksaanGagal(h.pesan);
        setLangkah("periksa");
        return;
      }
      setGalatAksi({ pesan: h.pesan });
    });
  }

  // ---- Menggabung: dukung usulan yang sudah ada, usulan baru tidak dikirim ----
  function gabung(id: string) {
    if (menunggu) return;
    setGalatAksi(null);
    setSedangMenggabung(id);
    mulai(async () => {
      const h = await dukungUsulan(id);
      if (h.ok) {
        hapusDraf();
        router.push(`/forum/${id}?gabung=1`);
        return;
      }
      setSedangMenggabung(null);
      if (h.kode === "belum_masuk") return keMasuk();
      setGalatAksi({ pesan: h.pesan });
    });
  }

  // ---- Langkah 3: kirim ----
  function kirim() {
    if (menunggu) return;
    setGalatAksi(null);
    mulai(async () => {
      const h = await ajukanUsulan(nilai);
      if (h.ok) {
        hapusDraf();
        router.push(`/forum/${h.id}?baru=1`);
        return;
      }
      if (h.kode === "belum_masuk") {
        setGalatAksi({ pesan: `${h.pesan} Isian Anda tersimpan di perangkat ini.`, perluMasuk: true });
        return;
      }
      if (h.kode === "tidak_valid" && "galatBidang" in h && h.galatBidang) {
        setGalat(h.galatBidang);
        setLangkah("isi");
        requestAnimationFrame(() => fokusBidangPertama(h.galatBidang!));
        return;
      }
      setGalatAksi({ pesan: h.pesan });
    });
  }

  const biaya = parseRupiah(nilai.biaya);
  const jumlahGalat = Object.values(galat).filter(Boolean).length;

  return (
    <div className={styles.bungkus}>
      <ol className={styles.langkah} aria-label="Langkah mengajukan usulan">
        {(
          [
            ["isi", "Isi usulan"],
            ["periksa", "Periksa serupa"],
            ["tinjau", "Tinjau dan kirim"],
          ] as const
        ).map(([k, teks], i) => (
          <li key={k} aria-current={langkah === k ? "step" : undefined} className={langkah === k ? styles.langkahAktif : undefined}>
            <span className={styles.nomorLangkah} aria-hidden="true">
              {i + 1}
            </span>
            {teks}
          </li>
        ))}
      </ol>

      {/* ------------------------------------------------------------------ 1. Isi */}
      {langkah === "isi" && (
        <form onSubmit={periksa} noValidate className={styles.form}>
          {dipulihkan && (
            <div role="status" className={styles.pulih}>
              <p>Draf Anda dipulihkan dari perangkat ini.</p>
              <button type="button" className={styles.tautanTombol} onClick={mulaiDariAwal}>
                Mulai dari awal
              </button>
            </div>
          )}

          {jumlahGalat > 0 && (
            <p role="alert" className={styles.ringkasGalat}>
              {jumlahGalat === 1 ? "Ada 1 isian yang perlu diperbaiki." : `Ada ${jumlahGalat} isian yang perlu diperbaiki.`}
            </p>
          )}
          {galatAksi && (
            <p role="alert" className={styles.ringkasGalat}>
              {galatAksi.pesan}
            </p>
          )}

          <Bidang id="u-judul" label="Judul usulan" bantu={`Singkat dan jelas, maksimal ${BATAS.judul.maks} karakter.`} galat={galat.judul}
            tambahan={<span className={styles.hitung}>{panjang(nilai.judul)} / {BATAS.judul.maks}</span>}>
            <input
              id="u-judul"
              type="text"
              value={nilai.judul}
              onChange={(e) => ubah("judul", e.target.value)}
              autoComplete="off"
              aria-invalid={galat.judul ? true : undefined}
              aria-describedby={`u-judul-bantu${galat.judul ? " u-judul-galat" : ""}`}
            />
          </Bidang>

          <Bidang id="u-singkat" label="Nama singkat (boleh dikosongkan)" bantu={`Label pendek di batang anggaran, maksimal ${BATAS.namaSingkat.maks} karakter.`} galat={galat.namaSingkat}>
            <input
              id="u-singkat"
              type="text"
              value={nilai.namaSingkat}
              onChange={(e) => ubah("namaSingkat", e.target.value)}
              autoComplete="off"
              aria-invalid={galat.namaSingkat ? true : undefined}
              aria-describedby={`u-singkat-bantu${galat.namaSingkat ? " u-singkat-galat" : ""}`}
            />
          </Bidang>

          <Bidang id="u-deskripsi" label="Ceritakan usulan Anda" bantu="Apa masalahnya, siapa yang terdampak, dan di mana." galat={galat.deskripsi}
            tambahan={<span className={styles.hitung}>{panjang(nilai.deskripsi)} / {BATAS.deskripsi.maks}</span>}>
            <textarea
              id="u-deskripsi"
              rows={6}
              value={nilai.deskripsi}
              onChange={(e) => ubah("deskripsi", e.target.value)}
              aria-invalid={galat.deskripsi ? true : undefined}
              aria-describedby={`u-deskripsi-bantu${galat.deskripsi ? " u-deskripsi-galat" : ""}`}
            />
          </Bidang>

          <div className={styles.dua}>
            <Bidang id="u-kategori" label="Kategori" galat={galat.kategori}>
              <select
                id="u-kategori"
                value={nilai.kategori}
                onChange={(e) => ubah("kategori", e.target.value)}
                aria-invalid={galat.kategori ? true : undefined}
                aria-describedby={galat.kategori ? "u-kategori-galat" : undefined}
              >
                <option value="">Pilih kategori</option>
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>
                    {LABEL_KATEGORI[k]}
                  </option>
                ))}
              </select>
            </Bidang>

            <Bidang id="u-rw" label="RW lokasi" bantu="Bawaannya RW tempat tinggal Anda." galat={galat.rw}>
              <select
                id="u-rw"
                value={nilai.rw}
                onChange={(e) => ubah("rw", e.target.value)}
                aria-invalid={galat.rw ? true : undefined}
                aria-describedby={`u-rw-bantu${galat.rw ? " u-rw-galat" : ""}`}
              >
                <option value="">Pilih RW</option>
                {wilayah.map((w) => (
                  <option key={w.rw} value={w.rw}>
                    {w.nama}
                  </option>
                ))}
              </select>
            </Bidang>
          </div>

          <Bidang id="u-biaya" label="Perkiraan biaya" bantu="Boleh ditulis 85.000.000, Rp 85 jt, atau 85 juta." galat={galat.biaya}>
            <input
              id="u-biaya"
              type="text"
              inputMode="text"
              value={nilai.biaya}
              onChange={(e) => ubah("biaya", e.target.value)}
              onBlur={() => setPratinjauSr(biaya.ok ? `Terbaca ${rupiahRinci(biaya.nilai)}.` : "")}
              autoComplete="off"
              aria-invalid={galat.biaya ? true : undefined}
              aria-describedby={`u-biaya-bantu u-biaya-pratinjau${galat.biaya ? " u-biaya-galat" : ""}`}
            />
            <p id="u-biaya-pratinjau" className={styles.pratinjau}>
              {nilai.biaya.trim() === "" ? "" : biaya.ok ? <>Terbaca: <strong>{rupiahRinci(biaya.nilai)}</strong></> : ""}
            </p>
            <p className="sr-only" aria-live="polite">
              {pratinjauSr}
            </p>
          </Bidang>

          <div className={styles.tombolBaris}>
            <button type="submit" className="tombol tombol-utama" aria-disabled={menunggu || undefined}>
              {menunggu ? "Memeriksa…" : "Periksa usulan serupa"}
            </button>
            {menunggu && (
              <p role="status" className={styles.menunggu}>
                Memeriksa usulan serupa. Ini biasanya hanya beberapa detik.
              </p>
            )}
          </div>
        </form>
      )}

      {/* ---------------------------------------------------------- 2. Periksa serupa */}
      {langkah === "periksa" && (
        <section className={styles.form} aria-labelledby="judul-periksa">
          <h2 id="judul-periksa" ref={judulLangkah} tabIndex={-1} className={styles.judulLangkah}>
            {pemeriksaanGagal
              ? "Pemeriksaan belum bisa dijalankan"
              : mirip && mirip.usulan.length > 0
                ? `Ada ${mirip.usulan.length} usulan yang mirip`
                : "Tidak ada usulan yang mirip"}
          </h2>

          {galatAksi && (
            <p role="alert" className={styles.ringkasGalat}>
              {galatAksi.pesan}
            </p>
          )}

          {pemeriksaanGagal && (
            <p className={styles.catatanMirip}>
              {pemeriksaanGagal} Anda bisa mencoba lagi, atau lanjut tanpa pemeriksaan.
            </p>
          )}

          {mirip && (
            <>
              <p className={styles.catatanMirip}>
                {mirip.mode === "ai"
                  ? "AI membandingkan makna usulan Anda dengan usulan yang ada, lalu memperhitungkan RW. Ini saran, bukan keputusan."
                  : "Pemeriksaan ini hanya mencocokkan kata, bukan AI, karena pencarian makna sedang tidak bisa dipakai. Hasilnya bisa kurang tepat."}
                {mirip.mode === "ai" && mirip.tanpaEmbedding > 0 &&
                  ` ${ribuan(mirip.tanpaEmbedding)} usulan lama belum diproses AI, jadi hanya dicocokkan lewat kata.`}
              </p>

              {mirip.usulan.length > 0 ? (
                <>
                  <p>Dukung salah satunya supaya suara warga tidak terpecah, atau tetap ajukan usulan Anda.</p>
                  <ul className={styles.hasilMirip}>
                    {mirip.usulan.map((u) => (
                      <li key={u.id} className={styles.itemMirip}>
                        <div className={styles.isiMirip}>
                          <h3 className={styles.judulMirip}>
                            <a href={`/forum/${u.id}`} target="_blank" rel="noopener">
                              {u.judul}
                              <span className="sr-only"> (buka di tab baru)</span>
                            </a>
                          </h3>
                          <p className={styles.metaMirip}>
                            <StatusSiklus status={u.status} />
                            <span>{u.rw !== null ? `RW ${String(u.rw).padStart(2, "0")}` : "Tanpa RW"}</span>
                            <span>{ribuan(u.dukungan)} dukungan</span>
                          </p>
                          <p>{u.alasan}</p>
                        </div>
                        {u.didukung ? (
                          <p className={styles.sudahDukung}>
                            Anda sudah mendukung usulan ini.
                          </p>
                        ) : (
                          <button
                            type="button"
                            className="tombol tombol-utama"
                            aria-disabled={menunggu || undefined}
                            onClick={() => gabung(u.id)}
                          >
                            {sedangMenggabung === u.id ? "Menggabungkan…" : "Dukung usulan ini"}
                            <span className="sr-only">: {u.judul}</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Usulan Anda tampaknya baru. Lanjut ke tinjauan, lalu kirim.</p>
              )}
            </>
          )}

          <div className={styles.tombolBaris}>
            <button type="button" className={mirip && mirip.usulan.length > 0 ? "tombol tombol-kedua" : "tombol tombol-utama"} onClick={() => setLangkah("tinjau")}>
              {mirip && mirip.usulan.length > 0 ? "Tetap ajukan usulan saya" : pemeriksaanGagal ? "Lanjut tanpa pemeriksaan" : "Lanjut ke tinjauan"}
            </button>
            <button type="button" className={styles.tautanTombol} onClick={() => setLangkah("isi")}>
              Ubah isian
            </button>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- 3. Tinjau dan kirim */}
      {langkah === "tinjau" && (
        <section className={styles.form} aria-labelledby="judul-tinjau">
          <h2 id="judul-tinjau" ref={judulLangkah} tabIndex={-1} className={styles.judulLangkah}>
            Tinjau usulan Anda
          </h2>

          <dl className={styles.ringkasan}>
            <div><dt>Judul</dt><dd>{nilai.judul.trim()}</dd></div>
            {nilai.namaSingkat.trim() && <div><dt>Nama singkat</dt><dd>{nilai.namaSingkat.trim()}</dd></div>}
            <div><dt>Cerita</dt><dd className={styles.cerita}>{nilai.deskripsi.trim()}</dd></div>
            <div><dt>Kategori</dt><dd>{(LABEL_KATEGORI as Record<string, string>)[nilai.kategori] ?? nilai.kategori}</dd></div>
            <div><dt>RW lokasi</dt><dd>RW {nilai.rw.padStart(2, "0")}</dd></div>
            <div><dt>Perkiraan biaya</dt><dd>{biaya.ok ? rupiahRinci(biaya.nilai) : nilai.biaya}</dd></div>
          </dl>

          <p className={styles.catatanMirip}>
            Usulan langsung tampil di forum dengan status “Sedang dibahas”, dan dukungan pertama otomatis
            dari Anda. Admin desa bisa menyembunyikan usulan yang tidak pantas, dengan alasan yang tercatat.
          </p>

          {galatAksi && (
            <div role="alert" className={styles.ringkasGalat}>
              <p>{galatAksi.pesan}</p>
              {galatAksi.perluMasuk && (
                <p>
                  <a href={`${RUTE.masuk}?lanjut=${encodeURIComponent(ALAMAT_FORM)}`}>Masuk lagi</a>, lalu kirim ulang.
                </p>
              )}
            </div>
          )}

          <div className={styles.tombolBaris}>
            <button type="button" className="tombol tombol-utama" aria-disabled={menunggu || undefined} onClick={kirim}>
              {menunggu ? "Mengirim…" : "Kirim usulan"}
            </button>
            <button type="button" className={styles.tautanTombol} onClick={() => setLangkah("isi")}>
              Ubah isian
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Satu isian: label terlihat, petunjuk, dan galat di dekat kolomnya. */
function Bidang({
  id,
  label,
  bantu,
  galat,
  tambahan,
  children,
}: {
  id: string;
  label: string;
  bantu?: string;
  galat?: string;
  tambahan?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.kolom}>
      <label htmlFor={id}>{label}</label>
      {bantu && (
        <p id={`${id}-bantu`} className={styles.bantu}>
          {bantu}
        </p>
      )}
      {children}
      {tambahan && <div className={styles.tambahan}>{tambahan}</div>}
      {galat && (
        <p id={`${id}-galat`} className={styles.galatKolom}>
          {galat}
        </p>
      )}
    </div>
  );
}
