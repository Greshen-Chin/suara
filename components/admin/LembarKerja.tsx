"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { tetapkanKeputusan } from "@/app/admin/aksi";
import { DuaGaris } from "@/components/keputusan/DuaGaris";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { desimal, rupiah } from "@/lib/format";
import {
  BATAS,
  HASIL,
  LABEL_HASIL,
  akibatWilayah,
  berbedaDariRekomendasi,
  butirUntukServer,
  dibacaDari,
  isiSesuaiRekomendasi,
  kalimatSejalan,
  penahanPenetapan,
  penjelasanAlasan,
  periksaPilihan,
  pilihanDari,
  ringkasLembar,
  type BarisHitungan,
  type GalatPilihan,
  type HitunganResmi,
  type Isian,
  type Pilihan,
} from "@/lib/keputusan";
import { susunDuaBatang } from "@/lib/keputusan-banding";
import { hapusDraf, simpanDraf, temukanDraf, type Penyimpanan } from "@/lib/keputusan-draf";
import { namaPeriode } from "@/lib/keputusan-kalimat";
import type { KeputusanPublik, Periode, WilayahPeriode } from "@/lib/keputusan-tipe";
import { panjang } from "@/lib/usulan-skema";
import { waktuRelatif } from "@/lib/waktu";
import adm from "./Admin.module.css";
import { RingkasGalat, type GalatBertaut } from "./Isian";
import styles from "./LembarKerja.module.css";

interface Props {
  tahun: number;
  /** Versi periode yang dibaca halaman; dikirim kembali supaya penetapan bersamaan tidak saling menimpa. */
  versi: number;
  hitungan: HitunganResmi;
  wilayah: { rw: number; nama: string; penduduk: number; anggaranLalu: number }[];
  /** Hari ini menurut WIB (YYYY-MM-DD): batas atas tanggal musyawarah. */
  hariIni: string;
}

function ambilPenyimpanan(): Penyimpanan | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const RW = (rw: number) => `RW ${String(rw).padStart(2, "0")}`;

export function LembarKerja({ tahun, versi, hitungan, wilayah, hariIni }: Props) {
  const router = useRouter();
  const [status, aksi, menunggu] = useActionState(tetapkanKeputusan, STATUS_AKSI_AWAL);
  const baris = hitungan.usulan;
  const idSah = useMemo(() => new Set(baris.map((b) => b.id)), [baris]);

  const [isian, setIsian] = useState<Isian>({});
  const [tanggal, setTanggal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [terbukaAlasan, setTerbukaAlasan] = useState<ReadonlySet<string>>(new Set());
  const [tampilGalat, setTampilGalat] = useState(false);
  const [pulih, setPulih] = useState<{ persis: boolean; disimpan: number } | null>(null);
  const [siapSimpan, setSiapSimpan] = useState(false);
  const [pengumuman, setPengumuman] = useState("");
  const kotakGalat = useRef<HTMLDivElement>(null);

  // Draf di perangkat: dipulihkan sekali saat dibuka. Dibaca di efek (bukan saat render) karena server tidak punya
  // localStorage dan HTML pertama harus sama dengan yang dirender server; ini sinkronisasi dengan sistem luar, jadi
  // aturan "setState di dalam efek" sengaja dimatikan untuk blok ini saja.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const s = ambilPenyimpanan();
    const ketemu = s ? temukanDraf(s, tahun, hitungan.sidik, idSah) : null;
    if (ketemu) {
      setIsian(ketemu.draf.isian);
      setTanggal(ketemu.draf.tanggal);
      setCatatan(ketemu.draf.catatan);
      setTerbukaAlasan(new Set(Object.entries(ketemu.draf.isian).filter(([, p]) => p.alasan !== "").map(([id]) => id)));
      setPulih({ persis: ketemu.persis, disimpan: ketemu.draf.disimpan });
    }
    setSiapSimpan(true);
  }, [tahun, hitungan.sidik, idSah]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Simpan 400 ms setelah gerakan terakhir. Lembar kosong tidak disimpan.
  useEffect(() => {
    if (!siapSimpan) return;
    const kosong = Object.keys(isian).length === 0 && tanggal === "" && catatan === "";
    if (kosong) return;
    const t = setTimeout(() => {
      const s = ambilPenyimpanan();
      if (s) simpanDraf(s, tahun, hitungan.sidik, { isian, tanggal, catatan, disimpan: Date.now() });
    }, 400);
    return () => clearTimeout(t);
  }, [siapSimpan, isian, tanggal, catatan, tahun, hitungan.sidik]);

  const r = useMemo(() => ringkasLembar(baris, isian, hitungan.pagu), [baris, isian, hitungan.pagu]);
  const lebih = r.melebihi > 0;
  const teksRingkas = lebih
    ? `Melebihi pagu ${rupiah(r.melebihi)}. Terpakai ${rupiah(r.terpakai)} dari ${rupiah(hitungan.pagu)}. ${r.belumDiisi} belum diisi, ${r.berbeda} berbeda.`
    : `Terpakai ${rupiah(r.terpakai)} dari ${rupiah(hitungan.pagu)}, sisa ${rupiah(r.sisa)}. ${r.belumDiisi} belum diisi, ${r.berbeda} berbeda.`;

  // Pembaca layar diberi tahu pelan-pelan: ringkasan berubah tiap klik, jadi pengumumannya menunggu 1,2 detik tenang.
  useEffect(() => {
    const t = setTimeout(() => setPengumuman(teksRingkas), 1200);
    return () => clearTimeout(t);
  }, [teksRingkas]);

  // Hasil dari server (galat): fokus ke kotaknya supaya diumumkan dan terlihat.
  useEffect(() => {
    if (status.hasil === "galat") kotakGalat.current?.focus();
  }, [status.nomor, status.hasil]);

  const ubah = (id: string, p: Partial<Pilihan>) => setIsian((s) => ({ ...s, [id]: { ...pilihanDari(s, id), ...p } }));

  const adaCatatanSah = panjang(catatan) >= BATAS.catatanRapat.min && panjang(catatan) <= BATAS.catatanRapat.max;
  const galatTanggal =
    tanggal === "" ? "Isi tanggal musyawarah." : tanggal > hariIni ? "Tanggal musyawarah tidak boleh di masa depan." : (status.galatKolom.tanggal ?? null);
  const galatCatatan = adaCatatanSah ? (status.galatKolom.catatan ?? null) : "Tulis catatan musyawarah, 20 sampai 1.000 karakter.";
  const galatKonfirmasi = konfirmasi ? null : "Centang dulu bahwa ini hasil musyawarah yang sebenarnya.";
  const penahan = penahanPenetapan(r);
  const butir = butirUntukServer(baris, isian);

  const galatBaris = (b: BarisHitungan): GalatPilihan => {
    const p = pilihanDari(isian, b.id);
    const lokal: GalatPilihan = tampilGalat ? (p.hasil === null ? { hasil: "Pilih salah satu hasil." } : periksaPilihan(b, p)) : {};
    return {
      hasil: lokal.hasil ?? status.galatKolom[`hasil-${b.id}`],
      alasan: lokal.alasan ?? status.galatKolom[`alasan-${b.id}`],
      sumberDana: lokal.sumberDana ?? status.galatKolom[`sumber-${b.id}`],
    };
  };

  const ringkasGalat: GalatBertaut[] = tampilGalat
    ? [
        ...baris.flatMap((b): GalatBertaut[] => {
          const g = galatBaris(b);
          const pesan = g.hasil ?? g.alasan ?? g.sumberDana;
          return pesan ? [{ id: `baris-${b.id}`, pesan: `${b.namaSingkat}: ${pesan}` }] : [];
        }),
        ...(galatTanggal ? [{ id: "tanggal-rapat", pesan: galatTanggal }] : []),
        ...(galatCatatan ? [{ id: "catatan-rapat", pesan: galatCatatan }] : []),
        ...(galatKonfirmasi ? [{ id: "konfirmasi-rapat", pesan: galatKonfirmasi }] : []),
      ]
    : [];

  function sebelumKirim(e: React.FormEvent<HTMLFormElement>) {
    const adaMasalah = penahan !== null || galatTanggal !== null || !adaCatatanSah || !konfirmasi || butir === null;
    if (adaMasalah) {
      e.preventDefault();
      setTampilGalat(true);
      requestAnimationFrame(() => kotakGalat.current?.focus());
    }
  }

  function hapusDrafIni() {
    const s = ambilPenyimpanan();
    if (s) hapusDraf(s, tahun);
    setIsian({});
    setTanggal("");
    setCatatan("");
    setTerbukaAlasan(new Set());
    setPulih(null);
  }

  // Pratinjau halaman publiknya: hanya bila semua usulan sudah dipilih (dua batang dibandingkan utuh).
  const pratinjau = useMemo(() => {
    if (r.belumDiisi > 0) return null;
    const k: KeputusanPublik[] = baris.flatMap((b) => {
      const p = pilihanDari(isian, b.id);
      return p.hasil === null
        ? []
        : [{
            proposalId: b.id, judul: b.judul, namaSingkat: b.namaSingkat, hasil: p.hasil, alasan: null, sumberDana: null,
            peringkat: b.peringkat, jumlahUsulan: baris.length, skor: b.skor, statusRekomendasi: b.status, biaya: b.biaya,
            dukungan: b.dukungan, urgensi: b.urgensi, rw: b.rw, beda: berbedaDariRekomendasi(p.hasil, b.terpilih),
            statusSekarang: "voting", selesaiPada: null, catatanSelesai: null, biayaRealisasi: null,
          }];
    });
    const periode: Periode = {
      tahun, status: "diputuskan", diputuskanPada: null, tanggalMusyawarah: tanggal || null, catatan: null, pagu: hitungan.pagu,
      bobot: hitungan.bobot, adaRekomendasi: true, wilayahSebelum: null, diputuskanOleh: null,
      jumlah: { disetujui: r.disetujui, danaLain: r.danaLain, dilanjutkan: r.dilanjutkan, ditolak: r.ditolak }, beda: r.berbeda, terpakai: r.terpakai,
    };
    const w: WilayahPeriode[] = wilayah.map((x) => ({ rw: x.rw, nama: x.nama, penduduk: x.penduduk }));
    return susunDuaBatang(periode, k, w);
  }, [r, baris, isian, tahun, tanggal, hitungan.pagu, hitungan.bobot, wilayah]);

  const akibat = useMemo(() => akibatWilayah(wilayah, baris, isian), [wilayah, baris, isian]);
  const idRingkas = useId();

  return (
    <form action={aksi} onSubmit={sebelumKirim} noValidate className={styles.lembar} aria-describedby={idRingkas}>
      <input type="hidden" name="tahun" value={tahun} />
      <input type="hidden" name="versi" value={versi} />
      <input type="hidden" name="sidik" value={hitungan.sidik} />
      <input type="hidden" name="butir" value={JSON.stringify(butir ?? [])} />
      <input type="hidden" name="dibaca" value={JSON.stringify(dibacaDari(hitungan))} />

      {pulih && (
        <div role="status" className={styles.pulih}>
          <p>
            <strong>Draf dipulihkan dari perangkat ini</strong> (disimpan {waktuRelatif(new Date(pulih.disimpan).toISOString())}).
            {pulih.persis
              ? " Pilihan Anda belum dikirim; periksa lagi sebelum menetapkan."
              : " Hitungan anggaran berubah sejak draf ini disimpan. Pilihan untuk usulan yang masih ada dipulihkan; periksa ulang yang berubah."}
          </p>
          <button type="button" className="tombol tombol-kedua" onClick={hapusDrafIni}>
            Hapus draf
          </button>
        </div>
      )}

      <div className={styles.alat}>
        <button
          type="button"
          className="tombol tombol-kedua"
          onClick={() => {
            setIsian((s) => isiSesuaiRekomendasi(baris, s));
          }}
          aria-describedby="petunjuk-isi-sisa"
        >
          Isi sisanya sesuai rekomendasi
        </button>
        <p id="petunjuk-isi-sisa" className={adm.petunjuk}>
          Hanya mengisi yang belum dipilih: yang terpilih jadi Disetujui, lainnya Dibawa ke periode berikutnya. Masih bisa diubah.
        </p>
      </div>

      <ol className={styles.daftar} key={status.nomor}>
        {baris.map((b) => {
          const p = pilihanDari(isian, b.id);
          const g = galatBaris(b);
          const wajib = p.hasil !== null && penjelasanAlasan(p.hasil, b.terpilih) !== null;
          const tampilAlasan = wajib || terbukaAlasan.has(b.id) || p.alasan !== "";
          const sejalan = p.hasil !== null && !berbedaDariRekomendasi(p.hasil, b.terpilih);
          const idAlasan = `alasan-${b.id}`;
          const idSumber = `sumber-${b.id}`;
          const adaGalat = Boolean(g.hasil || g.alasan || g.sumberDana);
          return (
            <li key={b.id} id={`baris-${b.id}`} tabIndex={-1} className={adaGalat ? `${styles.baris} ${styles.barisGalat}` : styles.baris}>
              <div className={styles.judulBaris}>
                <h3>{b.judul}</h3>
                <p className={styles.meta}>
                  <span className={styles.metaIsi}>
                    {RW(b.rw)}, {rupiah(b.biaya)}
                  </span>
                  <span>
                    Peringkat {b.peringkat} dari {baris.length}, skor {desimal(b.skor)}
                  </span>
                  <StatusLabel status={b.status} />
                </p>
              </div>

              <fieldset className={styles.pilihan} aria-describedby={g.hasil ? `${b.id}-galat-hasil` : undefined}>
                <legend>
                  Hasil musyawarah<span className="sr-only"> untuk {b.namaSingkat}</span>
                </legend>
                <div className={styles.tombolHasil}>
                  {HASIL.map((h) => (
                    <label key={h}>
                      <input type="radio" name={`hasil-${b.id}`} checked={p.hasil === h} onChange={() => ubah(b.id, { hasil: h })} />
                      <span>{LABEL_HASIL[h]}</span>
                    </label>
                  ))}
                </div>
                {g.hasil && (
                  <p id={`${b.id}-galat-hasil`} className={adm.galatKolom}>
                    {g.hasil}
                  </p>
                )}
              </fieldset>

              {p.hasil !== null && (
                <div className={styles.rinci}>
                  {p.hasil === "dana_lain" && (
                    <div className={adm.kolom}>
                      <label htmlFor={idSumber}>Sumber dana</label>
                      <input
                        id={idSumber}
                        type="text"
                        autoComplete="off"
                        value={p.sumberDana}
                        onChange={(e) => ubah(b.id, { sumberDana: e.target.value })}
                        aria-invalid={g.sumberDana ? true : undefined}
                        aria-describedby={`${idSumber}-bantu${g.sumberDana ? ` ${idSumber}-galat` : ""}`}
                      />
                      <p id={`${idSumber}-bantu`} className={adm.petunjuk}>
                        Misalnya “Dana kebencanaan kabupaten”. 3 sampai 80 karakter.
                      </p>
                      {g.sumberDana && (
                        <p id={`${idSumber}-galat`} className={adm.galatKolom}>
                          {g.sumberDana}
                        </p>
                      )}
                    </div>
                  )}

                  {wajib && <p className={styles.wajib}>{penjelasanAlasan(p.hasil, b.terpilih)}</p>}

                  {tampilAlasan ? (
                    <div className={adm.kolom}>
                      <label htmlFor={idAlasan}>{wajib ? "Alasan" : "Alasan (boleh dikosongkan)"}</label>
                      <textarea
                        id={idAlasan}
                        rows={3}
                        value={p.alasan}
                        onChange={(e) => ubah(b.id, { alasan: e.target.value })}
                        aria-invalid={g.alasan ? true : undefined}
                        aria-required={wajib || undefined}
                        aria-describedby={`${idAlasan}-bantu${g.alasan ? ` ${idAlasan}-galat` : ""}`}
                      />
                      <div className={adm.hitungBaris}>
                        <p id={`${idAlasan}-bantu`} className={adm.petunjuk}>
                          {BATAS.alasan.min} sampai {BATAS.alasan.max} karakter. Warga membacanya di halaman keputusan.
                        </p>
                        <span className={panjang(p.alasan) > BATAS.alasan.max ? `${adm.hitung} ${adm.hitungLebih}` : adm.hitung} aria-hidden="true">
                          {panjang(p.alasan)} / {BATAS.alasan.max}
                        </span>
                      </div>
                      {g.alasan && (
                        <p id={`${idAlasan}-galat`} className={adm.galatKolom}>
                          {g.alasan}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {sejalan && <p className={styles.otomatis}>Akan dicatat: {kalimatSejalan(b, baris.length)}</p>}
                      <button type="button" className={styles.tulisSendiri} onClick={() => setTerbukaAlasan((s) => new Set(s).add(b.id))}>
                        Tulis alasan sendiri<span className="sr-only"> untuk {b.namaSingkat}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className={lebih ? `${styles.ringkasan} ${styles.ringkasanLebih}` : styles.ringkasan}>
        <p className={styles.ringkasanBaris} id={idRingkas}>
          {lebih ? <strong>Melebihi pagu {rupiah(r.melebihi)}</strong> : <strong>Terpakai {rupiah(r.terpakai)}</strong>}
          <span>dari {rupiah(hitungan.pagu)}</span>
          <span className={styles.pemisah} aria-hidden="true">
            ·
          </span>
          <span>sisa {rupiah(Math.max(0, r.sisa))}</span>
          <span className={styles.pemisah} aria-hidden="true">
            ·
          </span>
          <span>{r.belumDiisi} belum diisi</span>
          <span className={styles.pemisah} aria-hidden="true">
            ·
          </span>
          <span>{r.berbeda} berbeda</span>
        </p>
      </div>
      <p role="status" className="sr-only">
        {pengumuman}
      </p>

      <section className={styles.tinjau} aria-labelledby="judul-tinjau">
        <h2 id="judul-tinjau">Tinjau dan tetapkan</h2>
        <p className={adm.penjelas}>
          Ini ringkasan keputusan musyawarah, bukan pengesahan anggaran. Setelah ditetapkan, ringkasannya tampil di halaman
          publik dan Anda masih bisa membatalkannya dalam 24 jam.
        </p>

        {r.jumlah > 0 && (
          <ul className={styles.hitungHasil}>
            <li>{r.disetujui} disetujui</li>
            <li>{r.danaLain} diajukan ke dana lain</li>
            <li>{r.dilanjutkan} dibawa ke periode berikutnya</li>
            <li>{r.ditolak} ditolak</li>
          </ul>
        )}

        {pratinjau ? (
          <DuaGaris batang={pratinjau} />
        ) : (
          <p className={adm.penjelas}>
            {lebih
              ? `Pratinjau belum bisa digambar: yang disetujui melebihi pagu sebesar ${rupiah(r.melebihi)}.`
              : "Pratinjau halaman publik tampil setelah semua usulan dipilih hasilnya."}
          </p>
        )}

        <table className={styles.akibat}>
          <caption>
            Akibat untuk periode berikutnya: anggaran periode lalu tiap RW, sekarang dan sesudah penetapan
          </caption>
          <thead>
            <tr>
              <th scope="col">RW</th>
              <th scope="col" className={styles.angka}>
                Sekarang
              </th>
              <th scope="col" className={styles.angka}>
                Sesudah
              </th>
            </tr>
          </thead>
          <tbody>
            {akibat.map((a) => (
              <tr key={a.rw}>
                <th scope="row">{a.nama}</th>
                <td className={styles.angka}>{rupiah(a.sekarang)}</td>
                <td className={styles.angka}>
                  {rupiah(a.sesudah)}
                  <span className="sr-only">
                    {a.sesudah === a.sekarang ? ", sama" : a.sesudah > a.sekarang ? ", naik" : ", turun"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={adm.penjelas}>
          Angka sesudah penetapan menjadi anggaran periode lalu yang dipakai komponen pemerataan pada hitungan periode berikutnya.
          RW yang menerima lebih banyak mendapat skor pemerataan lebih rendah; RW tanpa bagian menjadi 0.
        </p>

        <div className={styles.formRapat}>
          <div className={adm.kolom}>
            <label htmlFor="tanggal-rapat">Tanggal musyawarah</label>
            <input
              id="tanggal-rapat"
              name="tanggal"
              type="date"
              className={styles.tanggal}
              max={hariIni}
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              aria-invalid={tampilGalat && galatTanggal ? true : undefined}
              aria-describedby={tampilGalat && galatTanggal ? "tanggal-rapat-galat" : undefined}
            />
            {tampilGalat && galatTanggal && (
              <p id="tanggal-rapat-galat" className={adm.galatKolom}>
                {galatTanggal}
              </p>
            )}
          </div>

          <div className={adm.kolom}>
            <label htmlFor="catatan-rapat">Catatan musyawarah</label>
            <textarea
              id="catatan-rapat"
              name="catatan"
              rows={4}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              aria-invalid={tampilGalat && galatCatatan ? true : undefined}
              aria-describedby={`catatan-rapat-bantu${tampilGalat && galatCatatan ? " catatan-rapat-galat" : ""}`}
            />
            <div className={adm.hitungBaris}>
              <p id="catatan-rapat-bantu" className={adm.petunjuk}>
                Siapa yang hadir, dan hal penting yang dibahas. {BATAS.catatanRapat.min} sampai 1.000 karakter. Tampil di halaman publik.
              </p>
              <span className={panjang(catatan) > BATAS.catatanRapat.max ? `${adm.hitung} ${adm.hitungLebih}` : adm.hitung} aria-hidden="true">
                {panjang(catatan)} / 1.000
              </span>
            </div>
            {tampilGalat && galatCatatan && (
              <p id="catatan-rapat-galat" className={adm.galatKolom}>
                {galatCatatan}
              </p>
            )}
          </div>

          <div>
            <label className={styles.centang} htmlFor="konfirmasi-rapat">
              <input
                id="konfirmasi-rapat"
                name="konfirmasi"
                type="checkbox"
                value="ya"
                checked={konfirmasi}
                onChange={(e) => setKonfirmasi(e.target.checked)}
                aria-invalid={tampilGalat && galatKonfirmasi ? true : undefined}
              />
              <span>Ini hasil musyawarah yang sebenarnya.</span>
            </label>
            {tampilGalat && galatKonfirmasi && <p className={adm.galatKolom}>{galatKonfirmasi}</p>}
          </div>
        </div>

        <div ref={kotakGalat} tabIndex={-1} id="galat-tetapkan">
          {tampilGalat && ringkasGalat.length > 0 && <RingkasGalat pesan="Ada yang belum lengkap." galat={ringkasGalat} />}
          {status.hasil === "galat" && (
            <RingkasGalat pesan={status.pesan} galat={[]}>
              {status.bentrok && (
                <div className={adm.tombolBaris}>
                  <button type="button" className="tombol tombol-kedua" onClick={() => router.refresh()}>
                    Muat ulang hitungan
                  </button>
                </div>
              )}
              {status.tautan && (
                <p>
                  <Link href={status.tautan.href}>{status.tautan.teks}</Link>
                </p>
              )}
              {status.perluMasuk && (
                <p>
                  <Link href={`/masuk?lanjut=${encodeURIComponent("/admin/keputusan")}`}>Masuk lagi</Link>. Pilihan Anda tetap tersimpan di
                  perangkat ini.
                </p>
              )}
            </RingkasGalat>
          )}
        </div>

        {penahan && <p className={styles.penahan}>{penahan}</p>}

        <div className={adm.tombolBaris}>
          <button
            type="submit"
            className="tombol tombol-utama"
            aria-disabled={menunggu || lebih || undefined}
            onClick={(e) => {
              if (menunggu || lebih) e.preventDefault();
            }}
          >
            {menunggu ? "Menetapkan…" : "Tetapkan keputusan"}
          </button>
          {menunggu && <span className={adm.sibuk}>Menyimpan keputusan dan memperbarui halaman publik…</span>}
        </div>
        <p className={adm.petunjuk}>
          {namaPeriode(tahun)}. Semua {baris.length} usulan dalam hitungan diputuskan sekaligus, dalam satu langkah.
        </p>
      </section>
    </form>
  );
}
