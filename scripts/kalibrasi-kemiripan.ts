// Mengukur seberapa baik pencarian usulan mirip memisahkan "mirip" dari "tidak mirip" pada
// data seed, supaya ambang di lib/kemiripan.ts berdasar angka. Menjalankan SELURUH
// migrasi dan seed di PGlite (bukan database Supabase), mengisi embedding dengan model
// sungguhan, lalu mengeksekusi fungsi SQL cari_usulan_mirip dan cari_usulan_mirip_teks.
//
//   npm run kemiripan:kalibrasi
//
// Butuh unduhan model sekali (118 MB) bila belum ada di cache.
import { buatDatabase, muat, SEMUA } from "../supabase/tests/pglite.ts";
import { embedTeks, keLiteralVektor, susunTeksEmbedding } from "../lib/embedding.ts";
import { hitungSkorMirip, DEFAULT_KEMIRIPAN } from "../lib/kemiripan.ts";

interface Probe {
  teks: string;
  judul: string;
  rw: number;
  /** Judul usulan yang seharusnya dianggap mirip. Kosong: tidak ada yang boleh mirip. */
  harusMirip: string[];
  /** Parafrase yang sengaja tidak memakai kata kunci usulan aslinya. Di sinilah embedding harus unggul. */
  tanpaKataSama?: boolean;
}

const PROBE: Probe[] = [
  // Seharusnya mirip: parafrase dengan kata-kata berbeda.
  { judul: "Jalan setapak RW 07 gelap tidak ada lampunya", rw: 7,
    teks: "Malam hari jalan setapak di RW 07 gelap gulita. Warga minta dipasang lampu penerangan.",
    harusMirip: ["Lampu PJU jalan setapak RW 07", "Lampu jalan gang RW 07 gelap"] },
  { judul: "Penerangan gang dekat musala belum ada", rw: 7,
    teks: "Gang di dekat musala tidak ada penerangan, anak pengajian takut pulang malam.",
    harusMirip: ["Lampu jalan gang RW 07 gelap", "Lampu PJU jalan setapak RW 07"] },
  { judul: "Tolong perbaiki jalan rusak di depan sekolah dasar", rw: 3,
    teks: "Aspal di depan SD 03 banyak lubang dan berbahaya untuk anak sekolah saat hujan.",
    harusMirip: ["Perbaikan jalan berlubang depan SDN 03"] },
  { judul: "Banjir tiap hujan, selokan perlu dikeruk", rw: 7,
    teks: "Setiap musim hujan air meluap dari selokan dan merendam rumah. Saluran perlu dikeruk dan dilebarkan.",
    harusMirip: ["Normalisasi drainase yang sering banjir"] },
  { judul: "Timbangan bayi posyandu rusak", rw: 3,
    teks: "Timbangan di posyandu sering salah, kader juga butuh meja dan kursi yang layak.",
    harusMirip: ["Timbangan dan meja baru untuk posyandu RW 03"] },
  { judul: "Genteng pos ronda bocor", rw: 1,
    teks: "Atap pos ronda bocor kalau hujan sehingga petugas ronda kebasahan. Perlu diganti.",
    harusMirip: ["Atap pos ronda RW 01 bocor saat hujan"] },
  { judul: "Kursus menjahit untuk ibu-ibu", rw: 1,
    teks: "Ibu-ibu ingin belajar menjahit supaya bisa punya usaha kecil di rumah.",
    harusMirip: ["Pelatihan menjahit untuk ibu rumah tangga"] },
  { judul: "Tempat sampah dipisah organik dan non organik di pasar", rw: 3,
    teks: "Pasar butuh tempat sampah terpisah antara sampah basah dan plastik, plus petugas pengangkut.",
    harusMirip: ["Tong sampah terpilah di pasar RW 03"] },
  { judul: "Tebing dekat rumah rawan longsor, butuh penahan", rw: 7,
    teks: "Tebing di belakang rumah warga sering longsor kecil saat hujan deras. Perlu dinding penahan.",
    harusMirip: ["Talud penahan longsor tebing RW 07"] },
  // Parafrase TANPA kata kunci yang sama dengan usulan aslinya.
  { judul: "Kali di belakang rumah meluap kalau musim penghujan", rw: 7, tanpaKataSama: true,
    teks: "Air kali naik dan masuk ke pekarangan setiap penghujan. Alirannya perlu diperlancar.",
    harusMirip: ["Normalisasi drainase yang sering banjir"] },
  { judul: "Warga butuh penghasilan tambahan dari keterampilan membuat pakaian", rw: 1, tanpaKataSama: true,
    teks: "Ibu-ibu ingin belajar membuat baju supaya bisa berjualan dan membantu ekonomi keluarga.",
    harusMirip: ["Pelatihan menjahit untuk ibu rumah tangga"] },
  { judul: "Limbah pasar perlu dibedakan jenisnya dan diangkut rutin", rw: 3, tanpaKataSama: true,
    teks: "Buangan sisa dagangan basah dan kering di pasar menumpuk bercampur dan berbau.",
    harusMirip: ["Tong sampah terpilah di pasar RW 03"] },
  { judul: "Lereng dekat permukiman perlu dinding penguat", rw: 7, tanpaKataSama: true,
    teks: "Tanah di lereng belakang perumahan mulai bergeser saat hujan deras dan mengancam penghuni.",
    harusMirip: ["Talud penahan longsor tebing RW 07"] },
  { judul: "Alat ukur berat badan balita di tempat kader sudah tidak tepat", rw: 3, tanpaKataSama: true,
    teks: "Hasil pengukuran bayi sering meleset sehingga catatan pertumbuhan anak tidak bisa dipercaya.",
    harusMirip: ["Timbangan dan meja baru untuk posyandu RW 03"] },
  { judul: "Lorong kampung tidak diterangi sehingga ibu-ibu takut keluar malam", rw: 7, tanpaKataSama: true,
    teks: "Cahaya di lorong sama sekali tidak ada, orang sering tersandung dan merasa tidak aman.",
    harusMirip: ["Lampu jalan gang RW 07 gelap", "Lampu PJU jalan setapak RW 07"] },
  // Seharusnya TIDAK mirip dengan apa pun.
  { judul: "Perpustakaan desa dengan komputer dan internet", rw: 1,
    teks: "Anak-anak butuh tempat membaca dan mengerjakan tugas dengan komputer dan internet gratis.", harusMirip: [] },
  { judul: "Beasiswa untuk anak berprestasi dari keluarga kurang mampu", rw: 3,
    teks: "Bantuan biaya sekolah bagi anak berprestasi yang orang tuanya berpenghasilan rendah.", harusMirip: [] },
  { judul: "Pengadaan ambulans desa", rw: 7,
    teks: "Warga sakit parah sulit dibawa ke puskesmas, desa perlu punya mobil ambulans sendiri.", harusMirip: [] },
  { judul: "Embung penampung air untuk sawah", rw: 3,
    teks: "Saat kemarau sawah kekurangan air, perlu embung penampung untuk irigasi.", harusMirip: [] },
  { judul: "Lomba kebersihan antar RT setiap bulan", rw: 1,
    teks: "Mengadakan lomba kebersihan lingkungan antar RT dengan hadiah sederhana.", harusMirip: [] },
  // Jebakan: kata sama ("lampu", "jalan"), maksud dan tempat berbeda.
  { judul: "Lampu hias untuk perayaan hari kemerdekaan", rw: 3,
    teks: "Membeli lampu hias untuk menghias jalan utama saat perayaan 17 Agustus.", harusMirip: [] },
];

const db = await buatDatabase();
await muat(db, ...SEMUA);

const { rows: usulan } = await db.query<{ id: string; title: string; description: string }>(
  "select id, title, description from proposals where status in ('forum', 'voting') order by title",
);
for (const u of usulan) {
  const vektor = await embedTeks(susunTeksEmbedding(u.title, u.description), 60_000);
  await db.query("update proposals set embedding = $2 where id = $1", [u.id, keLiteralVektor(vektor)]);
}
console.log(`Embedding terisi untuk ${usulan.length} usulan.\n`);

interface Baris {
  probe: Probe;
  kandidat: { title: string; rw: number; kosinus: number; skor: number; mirip: boolean }[];
}
const hasil: Baris[] = [];
for (const probe of PROBE) {
  const q = keLiteralVektor(await embedTeks(susunTeksEmbedding(probe.judul, probe.teks)));
  const { rows } = await db.query<{ title: string; rw: number; kosinus: number }>(
    "select title, rw, kosinus from cari_usulan_mirip($1, 20)",
    [q],
  );
  hasil.push({
    probe,
    kandidat: rows.map((r) => {
      const skor = hitungSkorMirip({ kosinus: r.kosinus, samaRw: r.rw === probe.rw }, DEFAULT_KEMIRIPAN);
      return { ...r, skor, mirip: skor >= DEFAULT_KEMIRIPAN.ambang };
    }),
  });
}

// Ringkasan kosinus mentah: dasar penentuan batas bawah dan atas normalisasi.
const kosinusBenar: number[] = [];
const kosinusSalah: number[] = [];
for (const { probe, kandidat } of hasil) {
  for (const k of kandidat) {
    (probe.harusMirip.includes(k.title) ? kosinusBenar : kosinusSalah).push(k.kosinus);
  }
}
const ringkas = (n: number[]) => {
  const u = [...n].sort((a, b) => a - b);
  const p = (q: number) => u[Math.min(u.length - 1, Math.floor(q * u.length))].toFixed(3);
  return `n=${u.length} min=${u[0].toFixed(3)} p10=${p(0.1)} median=${p(0.5)} p90=${p(0.9)} maks=${u[u.length - 1].toFixed(3)}`;
};
console.log("Kosinus mentah, pasangan yang SEHARUSNYA mirip :", ringkas(kosinusBenar));
console.log("Kosinus mentah, pasangan yang TIDAK mirip      :", ringkas(kosinusSalah));
console.log(`Parameter aktif: ${JSON.stringify(DEFAULT_KEMIRIPAN)}\n`);

let benarTerdeteksi = 0;
let benarTotal = 0;
let salahTerdeteksi = 0;
let probeTanpaTarget = 0;
let probeTanpaTargetBersih = 0;
for (const { probe, kandidat } of hasil) {
  const terdeteksi = kandidat.filter((k) => k.mirip).slice(0, 3);
  console.log(`• ${probe.judul}  [RW ${probe.rw}]`);
  for (const k of kandidat.slice(0, 4)) {
    const benar = probe.harusMirip.includes(k.title);
    console.log(
      `    ${k.mirip ? "MIRIP " : "      "}${benar ? "(target)" : "        "} kos=${k.kosinus.toFixed(3)} skor=${k.skor.toFixed(2)}  ${k.title}`,
    );
  }
  for (const t of probe.harusMirip) {
    benarTotal++;
    if (terdeteksi.some((k) => k.title === t)) benarTerdeteksi++;
  }
  salahTerdeteksi += terdeteksi.filter((k) => !probe.harusMirip.includes(k.title)).length;
  if (probe.harusMirip.length === 0) {
    probeTanpaTarget++;
    if (terdeteksi.length === 0) probeTanpaTargetBersih++;
  }
}
console.log(`\nTarget yang ditemukan di 3 teratas : ${benarTerdeteksi}/${benarTotal}`);
console.log(`Usulan salah yang ikut ditampilkan  : ${salahTerdeteksi}`);
console.log(`Probe tanpa target yang bersih      : ${probeTanpaTargetBersih}/${probeTanpaTarget}`);

// Pencarian parameter: untuk tiap kombinasi, hitung target yang muncul di 3 teratas dan
// usulan salah yang ikut tampil. Usulan salah dihukum 3x lebih berat daripada target yang
// terlewat: menyodorkan "usulan mirip" yang keliru lebih merusak kepercayaan daripada
// melewatkan satu yang mirip (warga tetap bisa mengajukan, jadi tidak ada yang diblokir).
if (process.argv.includes("--grid")) {
  const calon: { p: typeof DEFAULT_KEMIRIPAN; benar: number; salah: number; nilai: number }[] = [];
  for (const kosinusBawah of [0.8, 0.82, 0.84, 0.86, 0.88])
    for (const kosinusAtas of [0.9, 0.92, 0.94])
      for (const bobotLokasi of [0.1, 0.15, 0.2, 0.3])
        for (const ambang of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]) {
          const p = { ...DEFAULT_KEMIRIPAN, kosinusBawah, kosinusAtas, bobotLokasi, bobotMakna: 1 - bobotLokasi, ambang };
          let benar = 0;
          let salah = 0;
          for (const { probe, kandidat } of hasil) {
            const tampil = kandidat
              .map((k) => ({ ...k, s: hitungSkorMirip({ kosinus: k.kosinus, samaRw: k.rw === probe.rw }, p) }))
              .filter((k) => k.s >= p.ambang)
              .sort((a, b) => b.s - a.s)
              .slice(0, 3);
            benar += tampil.filter((k) => probe.harusMirip.includes(k.title)).length;
            salah += tampil.filter((k) => !probe.harusMirip.includes(k.title)).length;
          }
          calon.push({ p, benar, salah, nilai: benar - 3 * salah });
        }
  calon.sort((a, b) => b.nilai - a.nilai || a.salah - b.salah || b.p.ambang - a.p.ambang);
  console.log("\n--- 12 kombinasi terbaik (nilai = benar - 3 x salah) ---");
  for (const c of calon.slice(0, 12)) {
    console.log(
      `  bawah=${c.p.kosinusBawah} atas=${c.p.kosinusAtas} lokasi=${c.p.bobotLokasi} ambang=${c.p.ambang}  -> benar ${c.benar}/${benarTotal}, salah ${c.salah}, nilai ${c.nilai}`,
    );
  }
}

// Percobaan: gabungkan sinyal makna (embedding) dan sinyal kata (trigram) pada kandidat yang sama.
if (process.argv.includes("--hibrida")) {
  const teksPerProbe = new Map<string, Map<string, { j: number; i: number }>>();
  for (const { probe } of hasil) {
    const { rows } = await db.query<{ title: string; sim_judul: number; sim_isi: number }>(
      "select title, sim_judul, sim_isi from cari_usulan_mirip_teks($1, $2, 20)",
      [probe.judul, probe.teks],
    );
    teksPerProbe.set(probe.judul, new Map(rows.map((r) => [r.title, { j: r.sim_judul, i: r.sim_isi }])));
  }
  const potong = (n: number) => Math.min(1, Math.max(0, n));
  const calon: { desc: string; benar: number; salah: number; nilai: number; tanpa: number }[] = [];
  for (const wEmb of [1, 0.8, 0.7, 0.6, 0.5])
    for (const bawah of [0.8, 0.82, 0.84, 0.86])
      for (const atas of [0.92, 0.94])
        for (const ambang of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7])
          for (const bobotLokasi of [0.1, 0.2]) {
            let benar = 0;
            let salah = 0;
            let tanpa = 0;
            for (const { probe, kandidat } of hasil) {
              const tk = teksPerProbe.get(probe.judul)!;
              const tampil = kandidat
                .map((k) => {
                  const t = tk.get(k.title) ?? { j: 0, i: 0 };
                  const mEmb = potong((k.kosinus - bawah) / (atas - bawah));
                  const mTeks = potong((0.4 * t.j + 0.6 * t.i) / DEFAULT_KEMIRIPAN.teksAtas);
                  const makna = wEmb * mEmb + (1 - wEmb) * mTeks;
                  return { ...k, s: (1 - bobotLokasi) * makna + bobotLokasi * (k.rw === probe.rw ? 1 : 0) };
                })
                .filter((k) => k.s >= ambang)
                .sort((a, b) => b.s - a.s)
                .slice(0, 3);
              const b = tampil.filter((k) => probe.harusMirip.includes(k.title)).length;
              benar += b;
              if (probe.tanpaKataSama) tanpa += b;
              salah += tampil.length - b;
            }
            calon.push({
              desc: `wEmb=${wEmb} bawah=${bawah} atas=${atas} lokasi=${bobotLokasi} ambang=${ambang}`,
              benar, salah, nilai: benar - 3 * salah, tanpa,
            });
          }
  calon.sort((a, b) => b.nilai - a.nilai || b.tanpa - a.tanpa);
  console.log("\n--- Hibrida makna+kata: 12 terbaik ---");
  for (const c of calon.slice(0, 12)) console.log(`  ${c.desc} -> benar ${c.benar}/${benarTotal} (tanpa kata sama ${c.tanpa}/7), salah ${c.salah}`);
  const murni = calon.filter((c) => c.desc.startsWith("wEmb=1 ")).slice(0, 1)[0];
  console.log(`  (pembanding embedding murni terbaik: ${murni.desc} -> benar ${murni.benar}, salah ${murni.salah})`);
}

// Cadangan: pg_trgm pada probe yang sama.
console.log("\n--- Cadangan pg_trgm ---");
let trgmBenar = 0;
let trgmSalah = 0;
let trgmTanpaKata = 0;
let trgmTanpaKataTotal = 0;
for (const { probe } of hasil) {
  const { rows } = await db.query<{ title: string; rw: number; sim_judul: number; sim_isi: number }>(
    "select title, rw, sim_judul, sim_isi from cari_usulan_mirip_teks($1, $2, 5)",
    [probe.judul, probe.teks],
  );
  const atas = rows[0];
  const skor = hitungSkorMirip({ kosinus: null, simJudul: atas.sim_judul, simIsi: atas.sim_isi, samaRw: atas.rw === probe.rw }, DEFAULT_KEMIRIPAN);
  const mirip = skor >= DEFAULT_KEMIRIPAN.ambangTeks;
  const benar = probe.harusMirip.includes(atas.title);
  if (benar && mirip) trgmBenar++;
  if (probe.tanpaKataSama) {
    trgmTanpaKataTotal += probe.harusMirip.length;
    if (benar && mirip) trgmTanpaKata++;
  }
  if (mirip && !benar) trgmSalah++;
  console.log(
    `  ${mirip ? "MIRIP " : "      "}${benar ? "(target)" : "        "} judul=${atas.sim_judul.toFixed(2)} isi=${atas.sim_isi.toFixed(2)} skor=${skor.toFixed(2)}  ${probe.judul} -> ${atas.title}`,
  );
}
console.log(`Cadangan teks: target benar di peringkat 1 = ${trgmBenar}, salah tampil = ${trgmSalah}`);
console.log(`[Parafrase tanpa kata sama] pg_trgm: ${trgmTanpaKata}/${trgmTanpaKataTotal} target (hanya peringkat 1) ditemukan`);

await db.close();
