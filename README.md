# SUARA: Sistem Usulan dan Aspirasi Rakyat

SUARA membantu desa memilih usulan pembangunan yang dibiayai dari pagu yang terbatas, dengan alasan yang terbuka untuk semua warga.

Di kebanyakan desa, usulan dengan suara terbanyak otomatis menang. Akibatnya RW yang penduduknya sedikit hampir selalu kalah, meskipun masalahnya paling mendesak. SUARA menunjukkan, untuk pagu yang sama, apa yang terbiayai jika memakai **suara terbanyak** dan jika memakai **rekomendasi SUARA**. Rekomendasi itu mempertimbangkan dukungan per penduduk, urgensi, dan pemerataan anggaran. Keputusan akhir tetap di tangan musyawarah desa, dan setiap perubahan tercatat.

> Seluruh data di repositori ini adalah **data purwarupa**: 3 RW, 7 usulan, dan pagu Rp 300 juta. Belum ada desa nyata yang memakai SUARA.

---

## Fitur

| Fitur | Status |
|---|---|
| **Halaman utama dengan Garis Pagu.** Batang anggaran yang bisa dialihkan antara "Suara terbanyak" dan "Rekomendasi SUARA", dengan animasi perpindahan dan penjelasan kenapa usulan dengan peringkat tertinggi bisa ditunda. | Selesai |
| **Wilayah kontras.** Perbandingan RW 01 dan RW 07: penduduk, anggaran lalu, dan dukungan per 1.000 penduduk. | Selesai |
| **Jejak keputusan.** Log perubahan bobot, status, dan hasil seleksi. | Selesai (3 log terbaru di halaman utama) |
| **Masuk (login).** Peran warga dan admin desa, dengan sesi aman. Semua peran bisa mengganti kata sandinya di `/akun`. | Selesai |
| **Forum warga.** Usulan, dukungan, komentar, deteksi usulan mirip (AI), dan moderasi. | Selesai, lihat [Forum warga](#forum-warga) dan [docs/forum.md](docs/forum.md) |
| **Admin desa.** Meninjau usulan, mengatur pagu dan bobot dengan pratinjau dampak, mengelola akun warga, dan memoderasi. | Selesai, lihat [Admin desa](#admin-desa) dan [docs/admin.md](docs/admin.md). Perlu migrasi 0005 |
| **Simulasi anggaran.** Warga mengubah pagu dan bobot dan langsung melihat usulan mana yang terbiayai, dengan Peta Pagu, uji ketahanan bobot, tabel per RW, dan usulan forum andaian. Tidak menyimpan apa pun. | Selesai, lihat [Simulasi anggaran](#simulasi-anggaran) dan [docs/simulasi.md](docs/simulasi.md). Tanpa SQL baru |
| **Keputusan musyawarah.** Admin mencatat hasil rapat untuk semua usulan dalam hitungan; warga membacanya berdampingan dengan rekomendasi (dua Garis Pagu), dengan alasan di tiap perbedaan, lembar cetak A4, dan unduhan CSV. | Selesai, lihat [Keputusan musyawarah](#keputusan-musyawarah) dan [docs/keputusan.md](docs/keputusan.md). Perlu migrasi 0006 dan `seed_keputusan.sql` |

---

## Cara SUARA menilai usulan

Setiap usulan berstatus `voting` mendapat skor 0 sampai 10 dari tiga komponen:

| Komponen | Arti | Bobot resmi |
|---|---|---|
| Popularitas | Dukungan **per 1.000 penduduk RW**, dinormalkan ke 0–10 terhadap nilai tertinggi | 30 |
| Urgensi | Nilai 1–10 dengan alasan tertulis (`urgency_reason`) | 40 |
| Pemerataan | Kebalikan anggaran per kapita periode lalu: RW yang paling jarang dibiayai mendapat 10 | 30 |

```
skor = (30 × popularitas + 40 × urgensi + 30 × pemerataan) / 100
```

- **Bobot:** disimpan di tabel `scoring_weights`, jumlahnya wajib 100. Setiap perubahan tercatat otomatis di `accountability_logs`.
- **Rekomendasi SUARA:** mencari kombinasi usulan dengan **total skor terbesar** yang masih muat dalam pagu (*knapsack* eksak, maksimal 16 usulan). Fungsinya `pilih_optimal` di SQL dan `pilihOptimal` di [lib/seleksi.ts](lib/seleksi.ts).
- **Suara terbanyak:** mengambil usulan berurutan dari dukungan terbanyak selama masih muat (*greedy*).

Dengan data demo, mode **suara terbanyak** memilih Gapura dan Balai warga (Rp 290 jt). Mode **rekomendasi** memilih Drainase, Jembatan, Lampu PJU, dan Jalan SDN 03 (Rp 285 jt). Talud berperingkat 1, tetapi biayanya (Rp 220 jt) melebihi sisa pagu, sehingga ditunda dengan penjelasan.

---

## Forum warga

Forum (`/forum`) adalah tempat warga menyampaikan aspirasi. Siapa pun bisa membaca; warga yang masuk
bisa mendukung, mengajukan usulan, dan berkomentar; admin bisa menyembunyikan yang tidak pantas.

- **Daftar** (`/forum`): usulan berstatus *Sedang dibahas* dan *Masuk hitungan anggaran* dalam satu
  daftar, dengan filter (status, RW, kategori) dan urutan (terbaru, dukungan terbanyak, dukungan per
  1.000 penduduk) yang tersimpan di URL. Usulan yang masuk hitungan anggaran menampilkan
  **posisinya pada Garis Pagu** ("Peringkat 2 dari 7 rekomendasi, Terbiayai").
- **Detail** (`/forum/[id]`): isi, urgensi, riwayat keputusan, dan komentar.
- **Ajukan usulan** (`/forum/usul`, hanya warga): isi, **periksa usulan serupa dengan AI**, tinjau,
  kirim. Draf tersimpan di perangkat.
- **Gabung dukungan:** bila ada usulan yang mirip (dari makna dan RW), warga bisa mendukungnya,
  bukan mengirim usulan baru. Warga tidak pernah diblokir.
- **Moderasi:** admin menyembunyikan usulan atau komentar dengan alasan wajib. Alasannya tercatat
  di jejak keputusan dan terbaca publik; isinya tidak.

Aturan dukungan, siklus status, cara kerja dan kalibrasi deteksi mirip, batas laju, serta
keterbatasannya ada di **[docs/forum.md](docs/forum.md)**.

**Cara mencoba** (setelah database disiapkan, lihat di bawah):

1. Buka `/forum` tanpa masuk: semua bisa dibaca.
2. Masuk sebagai `warga` / `warga123` (warga RW 07): dukung dan batalkan dukungan, lalu coba
   **Ajukan usulan**. Isi "Lampu di lorong RW 07 tidak menyala" untuk melihat usulan serupa dan
   tombol gabung dukungan.
3. Masuk sebagai `admin` / `admin123`: buka sebuah usulan lalu coba **Sembunyikan** pada komentar.
   Buka lagi tanpa masuk untuk melihat jejaknya.

## Admin desa

Halaman admin (`/admin`, hanya untuk admin desa aktif) menutup siklus usulan: sebelumnya usulan warga
berhenti di forum, pagu tertanam di kode, dan bobot hanya bisa diubah lewat SQL. Setiap keputusan
**wajib beralasan**, dan alasannya terbaca warga di jejak keputusan.

| Bagian | Alamat | Untuk apa |
|---|---|---|
| Ringkasan | `/admin` | Pekerjaan yang menunggu: usulan belum ditinjau, hitungan anggaran, akun yang belum mengganti kata sandi |
| Usulan | `/admin/usulan` | Memasukkan usulan ke hitungan anggaran (urgensi 1–10 dengan alasan), tidak melanjutkan, atau mengembalikan ke pembahasan |
| Anggaran | `/admin/anggaran` | Mengubah pagu (Rp 10 juta sampai Rp 10 miliar) dan bobot (tiga bilangan bulat, jumlah 100), dengan riwayat |
| Akun | `/admin/akun` | Membuat akun warga (kata sandi acak tampil sekali), mengatur ulang kata sandi, menonaktifkan dan mengaktifkan |
| Moderasi | `/admin/moderasi` | Menyembunyikan dan menampilkan kembali komentar dan usulan |

- **Pratinjau dampak.** Sebelum menyimpan pagu, bobot, atau perpindahan status, admin melihat dua Garis Pagu
  ("Sekarang" dan "Sesudah disimpan") dan daftar usulan yang berubah status. Pratinjau memakai
  `pilihOptimal` yang sama dengan halaman utama, dan tes SQL membuktikan hasilnya sama dengan
  `rekomendasi_resmi` setelah perubahan disimpan.
- **Aturan di database.** Perpindahan status, pagu, bobot, dan pengelolaan akun adalah fungsi SQL atomik yang
  memeriksa sendiri bahwa pemanggilnya admin aktif. Dua admin yang menyimpan bersamaan ditangani dengan versi
  (yang kedua ditolak dengan nilai terbaru, bukan menimpa), dan hitungan anggaran dijaga di 16 usulan.
- **Yang sengaja tidak ada.** Membuat akun admin dari antarmuka (hanya `npm run akun:buat`), menonaktifkan
  akun sendiri. Hasil musyawarah ditetapkan di bagian **Keputusan** (lihat [Keputusan musyawarah](#keputusan-musyawarah)), bukan di halaman Usulan.
- **Cache.** Setiap perubahan memperbarui halaman utama dan forum seketika (`updateTag`). Halaman admin
  sendiri tidak pernah memakai data cadangan.

Alasan, rubrik urgensi, diagram status, jejak publik vs jejak tertutup, dan keterbatasannya ada di
**[docs/admin.md](docs/admin.md)**.

**Cara mencoba** (setelah database disiapkan termasuk migrasi 0005):

1. Masuk sebagai `admin` / `admin123`, lalu buka **Admin** di header.
2. Di **Usulan**, buka usulan berstatus *Sedang dibahas*, pilih "Masukkan ke hitungan anggaran", isi urgensi dan
   alasan, lalu lihat pratinjau pada Garis Pagu sebelum menyimpan. Halaman utama berubah seketika.
3. Di **Anggaran**, ubah pagu atau bobot dan perhatikan usulan yang bergeser status.
4. Di **Akun**, buat akun untuk warga yang belum punya akun, catat kata sandi yang tampil (hanya sekali), lalu
   masuk sebagai akun itu di jendela lain: ia diminta mengganti kata sandinya.

## Keputusan musyawarah

SUARA merekomendasikan, musyawarah memutuskan, dan setiap perbedaan punya alasan yang bisa dibaca. Ini **ringkasan keputusan
musyawarah, bukan pengesahan anggaran**.

- **Admin** (`/admin/keputusan`) mencatat satu hasil untuk **setiap** usulan dalam hitungan, dalam satu penetapan utuh:
  Disetujui, Diajukan ke dana lain (dengan sumber dana), Dibawa ke periode berikutnya, atau Ditolak. Alasan wajib bila
  berbeda dari rekomendasi. Total yang disetujui tidak boleh melebihi pagu (ditolak juga oleh database). Pilihan disimpan
  di perangkat selama rapat (draf), dan penetapan membawa versi periode serta *sidik* hitungan supaya penetapan bersamaan
  atau hitungan yang berubah ditolak dengan penjelasan.
- **Warga** (`/keputusan`, `/keputusan/[tahun]`) membaca dua Garis Pagu bertumpuk (rekomendasi dan keputusan, skala sama;
  yang berbeda berbingkai putus-putus dan bertanda ≠), bagian "Di mana musyawarah berbeda", semua keputusan, anggaran tiap
  RW, dan jejak lengkap. **Cetak ringkasan** menghasilkan lembar A4 untuk papan pengumuman; **Unduh data (CSV)** untuk Excel.
- **Periode berikutnya** mewarisi akibatnya: `wilayah.anggaran_lalu` tiap RW diganti dengan jumlah yang disetujui, jadi RW yang
  baru menerima anggaran tidak lagi didahulukan komponen pemerataan. Penetapan terakhir bisa **dibatalkan dalam 24 jam**.
- **Yang sengaja tidak ada:** koreksi setelah 24 jam, tanda tangan digital, unggah berkas, dan perubahan aturan dukungan.

**Cara mencoba** (setelah migrasi 0006 dan `seed_keputusan.sql`):

1. Buka `/keputusan` tanpa masuk: Tahun Anggaran 2026 sudah diputuskan (data purwarupa), 2027 belum.
2. Masuk sebagai `admin` / `admin123`, buka **Admin → Keputusan**, tekan **Isi sisanya sesuai rekomendasi**, ubah satu usulan
   (alasannya wajib), isi tanggal dan catatan, centang konfirmasi, lalu **Tetapkan keputusan**.
3. Buka `/keputusan/2027`. Halaman utama, forum, dan detail usulan ikut berubah seketika.
4. **Batalkan dalam 24 jam** supaya juri melihat Garis Pagu penuh di halaman utama.

Rancangan lengkap (siklus status, potret, sidik, pembatalan, jejak, keterbatasan): **[docs/keputusan.md](docs/keputusan.md)**.

## Simulasi anggaran

Halaman `/simulasi` terbuka untuk semua orang, tanpa masuk. **Tidak ada yang disimpan dan rekomendasi resmi tidak berubah.**
Perhitungannya terjadi di peramban dengan `pilihOptimal` yang sama dengan halaman utama; keadaannya (pagu, bobot, usulan
andaian) tinggal di alamat, jadi bisa dibagikan.

- **Kendali.** Pagu (geseran Rp 10 juta sampai ujung peta, langkah Rp 5 juta, atau diketik) dan tiga bobot yang **selalu berjumlah
  100** (menggeser satu membagi ulang dua lainnya), dengan pilihan cepat Resmi, Dukungan saja, Keselamatan dulu, dan Merata dulu.
- **Hasil.** Batang Garis Pagu simulasi, kalimat ringkasan, dan apa yang berubah dari rekomendasi resmi ("Sama dengan
  rekomendasi resmi" bila tidak ada).
- **Peta Pagu.** Untuk semua usulan sekaligus: pada rentang pagu mana tiap usulan terbiayai ("Talud baru muat kalau pagunya Rp 505
  juta"). Ruasnya bisa terputus-putus, dan halaman menjelaskan kenapa. Ada kalimat di tiap baris dan tabel setara.
- **Uji ketahanan.** Hasilnya dihitung ulang untuk semua 231 kombinasi bobot, lalu halaman menyebut berapa yang menghasilkan
  pilihan yang sama ("hasilnya sama untuk 231 dari 231 kombinasi bobot" pada pagu Rp 300 juta). Ini menjawab "bobotnya
  dipilih-pilih?", dan **bukan** bukti bahwa keputusannya benar.
- **Siapa yang kebagian.** Tabel per RW: rupiah, jumlah usulan, dan rupiah per penduduk, resmi dan simulasi berdampingan.
- **Usulan forum andaian.** Tambahkan usulan yang masih dibahas dengan urgensi yang Anda andaikan untuk melihat posisinya.

**Cara mencoba** (tanpa SQL dan tanpa variabel lingkungan baru):

1. Buka `/simulasi` dan geser pagu ke **Rp 505 juta**: Talud menjadi *Terbiayai*.
2. Kembalikan ke **Rp 300 juta**: kalimat uji ketahanan menyebut **231 dari 231**.
3. Tekan **Dukungan saja**: yang terbiayai tetap sama, tetapi Gapura dan Balai warga menjadi *Ditunda*, dan halaman menyebutnya.
4. Salin tautan lewat **Bagikan simulasi ini** dan buka di perangkat lain: keadaannya sama.

Cara kerja Peta Pagu (diagram), bukti kesetaraan dengan `rekomendasi_resmi`, arti dan batas uji ketahanan, angka kinerja,
dan keterbatasannya ada di **[docs/simulasi.md](docs/simulasi.md)**.

## Teknologi

- **Next.js 16.4** (App Router, Cache Components, `proxy.ts`) dan **React 19.3** dengan React Compiler.
- **TypeScript** strict, **CSS Modules**, dan token desain di [app/globals.css](app/globals.css) (Tailwind 4 hanya untuk token).
- **Supabase Postgres**, diakses **hanya dari server** dengan service role. RLS aktif tanpa policy, jadi kunci `anon` tidak bisa membaca apa pun.
- **`@huggingface/transformers`** (model `multilingual-e5-small`, 384 dimensi) untuk mengenali usulan yang mirip dari maknanya, dengan **pgvector** dan cadangan `pg_trgm`.
- **jose** untuk JWT sesi. Hash kata sandi memakai `scrypt` bawaan Node.

---

## Menjalankan secara lokal

**Prasyarat:**
- **Node.js 24**: tes dan skrip memakai dukungan TypeScript bawaan Node.
- **Proyek Supabase**: paket gratis sudah cukup.

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya, lihat di bawah
npm run dev                  # http://localhost:3000
```

Isi `.env.local`:

| Variabel | Dari mana |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Di halaman yang sama, kunci `service_role`. **Rahasia, jangan dibagikan.** |
| `SESSION_SECRET` | Minimal 32 karakter acak: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

Kalau database tidak bisa dijangkau, halaman utama tetap tampil dengan data cadangan dari [lib/fallback-data.json](lib/fallback-data.json). Login tidak punya cadangan dan akan menampilkan pesan bahwa server sedang bermasalah.

### Menyiapkan database

Jalankan file berikut **berurutan** di **SQL Editor** Supabase. Untuk setiap file: buka *New query*, tempel seluruh isinya, lalu klik *Run*.

1. [supabase/migrations/0001_schema.sql](supabase/migrations/0001_schema.sql): tabel dasar, ekstensi PostGIS dan pgvector, trigger, dan view.
2. [supabase/migrations/0002_wilayah_dan_skor_per_kapita.sql](supabase/migrations/0002_wilayah_dan_skor_per_kapita.sql): tabel wilayah, skor per kapita, dan fungsi seleksi.
3. [supabase/seed.sql](supabase/seed.sql): data demo. **File ini menghapus dan mengisi ulang** tabel warga, usulan, dukungan, dan log (dan, lewat `cascade`, tabel `akun`). Jalankan **sebelum** membuat akun.
4. [supabase/migrations/0003_akun.sql](supabase/migrations/0003_akun.sql): akun dan penguncian login.
5. [supabase/migrations/0004_forum.sql](supabase/migrations/0004_forum.sql): forum. Komentar, moderasi, fungsi dukung/usul/komentar/sembunyikan, pencarian usulan mirip, dan view baru. **Tidak mengubah angka halaman utama.**
6. **Buat akun demo** (lihat [Membuat akun](#membuat-akun)): `warga` (nomor warga 70, RW 07) dan `admin`.
7. [supabase/seed_forum.sql](supabase/seed_forum.sql): 6 usulan forum, 15 komentar (satu disembunyikan, lengkap dengan jejaknya), dan, bila akun `warga` belum tertaut, menautkannya ke warga RW 07 nomor 70. Aman dijalankan ulang; tidak menghapus apa pun dan tidak menyentuh tujuh usulan voting.
8. **Isi embedding** agar pemeriksaan usulan serupa memakai makna: `npm run embedding:isi`, lalu tempel SQL yang tercetak di SQL Editor (atau `npm run embedding:isi -- --tulis` untuk menulis langsung, dengan konfirmasi). Unduhan model pertama kali sekitar 118 MB.

9. [supabase/migrations/0005_admin.sql](supabase/migrations/0005_admin.sql): halaman admin. Pagu pindah ke tabel `pengaturan_anggaran` (Rp 300 juta, jadi **angka halaman utama tidak berubah**), kolom `versi` untuk admin bersamaan, jenis log pagu, tabel `jejak_admin` (tertutup), fungsi atomik admin, dan view admin. Seluruh file berjalan dalam satu transaksi. Harus sesudah langkah 7, boleh sebelum atau sesudah langkah 8, dan **harus dijalankan sebelum atau bersamaan dengan memasang kode baru**: kode baru membaca kolom `akun.harus_ganti_sandi` saat login, jadi tanpa 0005 login gagal. Bila berhenti dengan pesan "lebih dari satu akun", satu warga punya dua akun; kueri pencarinya ada di kepala file.

10. [supabase/migrations/0006_keputusan.sql](supabase/migrations/0006_keputusan.sql): keputusan musyawarah. Status `referred`, jenis log `decision`, tabel `periode` (membuat **Tahun Anggaran 2027** sebagai periode berjalan) dan `keputusan`, fungsi atomik `tetapkan_keputusan`, `batalkan_penetapan`, `tandai_selesai`, `sidik_hitungan`, dan view `v_periode` dan `v_keputusan`. **Tidak mengubah data hitungan**: usulan, dukungan, bobot, pagu, dan `anggaran_lalu` tetap, jadi angka halaman utama tidak berubah. Satu transaksi. Harus sesudah langkah 9.
11. [supabase/seed_keputusan.sql](supabase/seed_keputusan.sql): **periode lampau Tahun Anggaran 2026** (data purwarupa, diputuskan sebelum SUARA dipakai): empat usulan berstatus `done` atau `rejected` dan jumlahnya cocok dengan `anggaran_lalu` (RW 01 Rp 250 juta, RW 03 Rp 60 juta, RW 07 Rp 0). Tidak ada usulan `voting` dan tidak ada dukungan baru. Aman dijalankan ulang.
12. **Isi embedding lagi** (`npm run embedding:isi`, lalu tempel SQL yang tercetak): usulan 2026 belum punya embedding.

**Sebelum push atau deploy**, jalankan langkah 10 dan 11 **lebih dulu**, cek angkanya (di bawah), baru deploy; bila Cloud Build terhubung ke GitHub, push ke `main` bisa berarti deploy. Kode baru membaca `periode` (halaman utama, `/api/health`): tanpa 0006, `/api/health` menjawab `"db":"error"` dan `/keputusan` menampilkan data contoh. Cadangkan lebih dulu (Supabase → Database → Backups), atau catat bahwa data demo bisa dibuat ulang dari seed.

Tanpa langkah 5 dan 7, forum tetap tampil dari data cadangan dengan penanda yang jelas, dan semua aksi tulis dimatikan. Kode terbaru **tidak boleh dipasang tanpa langkah 9**: login membaca kolom yang baru ada di 0005 dan akan gagal.

Untuk memeriksa hasilnya, jalankan di SQL Editor:

```sql
select 'wilayah' as tabel, count(*) from wilayah
union all select 'usulan', count(*) from proposals
union all select 'dukungan', count(*) from votes;
-- Setelah langkah 1-5: wilayah 3, usulan 7, dukungan 162
-- Setelah langkah 7:   wilayah 3, usulan 13, dukungan 221 (162 + 59 pada usulan forum)
-- Setelah langkah 11:  wilayah 3, usulan 17 (+4 usulan periode 2026), dukungan 221 (tidak ada dukungan baru)
```

Cek hasil setelah **langkah 5** (sebelum seed forum). Angka halaman utama harus tidak berubah:

```sql
select count(*) from rekomendasi_resmi(300000000) where selected;  -- 4 (Drainase, Jembatan, Lampu PJU, Jalan SDN 03)
select count(*) from votes;                                         -- 162
```

Cek hasil setelah **langkah 7**:

```sql
select status, count(*) from v_forum group by status order by status;  -- forum 6, voting 7
select count(*) from komentar;                                          -- 15 (1 tersembunyi)
select a.nama_pengguna, w.rw from akun a join warga w on w.id = a.warga_id
 where a.nama_pengguna = 'warga';                                       -- 1 baris, RW 7
```

Cek hasil setelah **langkah 8**:

```sql
select count(*) from proposals where embedding is null;  -- 0
```

Cek hasil setelah **langkah 9** (angka halaman utama **tidak boleh berubah**):

```sql
select pagu, versi from pengaturan_anggaran;                        -- 300000000, 1
select count(*) from rekomendasi_resmi(300000000) where selected;   -- 4 (sama seperti sebelum 0005)
select count(*) from votes
 where proposal_id in (select id from proposals where status = 'voting');  -- 162
select count(*) from accountability_logs where log_type = 'budget_change'; -- 1 (pagu awal dari seed.sql)
select count(*) from jejak_admin;                                   -- 0 (belum ada tindakan admin)
```

Setelah itu buka `/admin` sebagai `admin`: angka di halaman utama harus tetap sama dengan sebelumnya.

Cek hasil setelah **langkah 10 dan 11** (angka halaman utama **tidak boleh berubah**):

```sql
select tahun, status from periode order by tahun;                     -- 2026 diputuskan, 2027 berjalan
select count(*) from rekomendasi_resmi(300000000) where selected;     -- 4
select count(*) from votes
 where proposal_id in (select id from proposals where status = 'voting'); -- 162
select rw, anggaran_lalu from wilayah order by rw;                    -- 250000000, 60000000, 0
select count(*) from proposals;                                       -- 17 (13 + 4 usulan periode 2026)
```

**Hati-hati saat demo:** menetapkan keputusan mengosongkan sebagian hitungan halaman utama. Itu memang tujuannya, tetapi
**batalkan dalam 24 jam** setelah latihan. Setelah 24 jam, pemulihan data demo hanya lewat SQL:
[supabase/demo_pulihkan_periode.sql](supabase/demo_pulihkan_periode.sql) (baca peringatannya di kepala berkas).

Cara lain: buka `http://localhost:3000/api/health`. Kalau database siap, isinya `{"db":"ok", ...}`.

### Membuat akun

Akun dibuat oleh perangkat desa; warga tidak mendaftar sendiri. Alasannya agar satu orang tidak bisa membuat banyak akun untuk menambah dukungan.

```bash
npm run akun:buat
```

Jalankan dari PowerShell, CMD, atau Windows Terminal. Di Git Bash pakai `winpty npm run akun:buat`.

Setelah migrasi 0005, akun **warga** juga bisa dibuat dari halaman admin (`/admin/akun/baru`), tanpa SQL. Akun **admin** tetap hanya lewat skrip ini, sengaja: sesi admin yang bocor tidak bisa melahirkan admin baru.

Skrip menanyakan nama pengguna, peran, dan (untuk warga) **nomor warga** di tabel `warga`. Akun warga harus tertaut ke data warga: hanya akun seperti itu yang boleh mendukung dan mengajukan usulan. Kata sandi tidak tampil saat diketik. Skrip lalu **mencetak** perintah `insert` berisi hash. Jalankan perintah itu di SQL Editor. Kata sandi asli tidak pernah disimpan atau dikirim ke mana pun.

### Akun demo

| Nama pengguna | Kata sandi | Peran |
|---|---|---|
| `admin` | `admin123` | Admin desa |
| `warga` | `warga123` | Warga RW 07 (nomor warga 70) |

Kedua akun ini **hanya untuk database demo**. Kata sandinya sengaja sederhana, jadi jangan dipakai di database yang berisi data sungguhan.

---

## Keamanan

- **Kata sandi:**
  - Di-hash dengan `scrypt` (N = 2¹⁷, r = 8, p = 1, sesuai rekomendasi OWASP) dan salt acak 16 byte per akun.
  - Disimpan dalam format PHC, sehingga parameternya bisa dinaikkan nanti. Hash diperbarui otomatis saat login.
  - Perbandingan hash memakai `timingSafeEqual`. Lihat [lib/kata-sandi.ts](lib/kata-sandi.ts).
- **Sesi:**
  - JWT HS256 dengan `iss`, `aud`, `exp` (8 jam), dan `jti`. Algoritma lain, termasuk `alg=none`, ditolak.
  - Disimpan di cookie `httpOnly` dan `SameSite=Lax`. Di produksi cookie juga `Secure` dan memakai prefiks `__Host-`.
  - Setiap halaman yang dilindungi memeriksa ulang ke database bahwa akun masih aktif dan sesinya belum dicabut (`versi_sesi`).
  - Lihat [lib/sesi-token.ts](lib/sesi-token.ts) dan [lib/auth.ts](lib/auth.ts).
- **Percobaan login:**
  - Akun dikunci 15 menit setelah 5 kali gagal dalam 15 menit. Hitungannya per nama pengguna.
  - Pesan galat dan waktu respons sama untuk nama yang tidak terdaftar maupun kata sandi yang salah, sehingga tidak membocorkan nama mana yang terdaftar.
- **Pengalihan:** parameter `?lanjut=` hanya menerima jalur di situs ini, sehingga tidak bisa dipakai untuk mengarahkan ke situs lain ([lib/tujuan.ts](lib/tujuan.ts)).
- **Header HTTP:**
  - `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, dan HSTS.
  - `X-Powered-By` dimatikan.
  - Lihat [next.config.ts](next.config.ts).
- **Database:** RLS aktif di semua tabel, dan fungsi sensitif hanya bisa dipanggil service role.

**Keterbatasan yang diketahui:**
- Penguncian per nama pengguna bisa dipakai orang lain untuk sengaja mengunci akun.
- Belum ada batas per IP.
- Belum ada CSP untuk skrip, karena butuh *nonce* dan halaman tidak bisa statis lagi.
- Daftar kata sandi umum yang ditolak masih pendek.

---

## Pengujian

```bash
npm test             # 678 tes: unit (lib/) dan SQL di PGlite (supabase/tests/)
npm run lint
npx tsc --noEmit
npm run build
npm run e2e          # 127 tes Playwright + axe di build produksi, melawan server tiruan (lihat docs/forum.md, docs/admin.md, dan docs/simulasi.md)
```

`npm run e2e` perlu browser Playwright (`npx playwright install chromium`) dan model embedding terunduh (atau `E2E_TANPA_EMBEDDING=1`). Skrip lain: `npm run kemiripan:kalibrasi` (mengukur deteksi usulan mirip), `npm run fallback:buat` (membuat ulang data cadangan forum dari seed), `npm run embedding:isi`.

Sudah diperiksa secara manual:
- **SQL:** migrasi 0001 sampai 0006 dan ketiga seed dijalankan di PGlite (Postgres di dalam Node, dengan pgvector, pg_trgm, dan PostGIS): dukung/batal atomik, penolakan admin dan akun tanpa `warga_id`, batas laju, moderasi, hak `execute`, dan `rekomendasi_resmi(300000000)` identik dengan sebelum migrasi forum **dan** sebelum migrasi admin. Tes admin (90 tes) juga memeriksa penolakan non-admin di setiap fungsi, bentrok versi, batas 16 usulan, jejak tertutup, dan bahwa pratinjau sama dengan `rekomendasi_resmi` setelah perubahan disimpan.
- **Aksesibilitas:** axe-core (WCAG 2.2 AA) tanpa pelanggaran di 360 px dan 1440 px, juga untuk semua halaman `/admin/*` dan `/akun` termasuk dialog, galat, pratinjau, dan tiap langkah membuat akun, dan untuk `/simulasi` di semua keadaannya. Ditambah reflow 320 px, keyboard, target sentuh 44 px, spasi teks WCAG 1.4.12, dan (simulasi) satu pengumuman per jeda. Belum diuji dengan pembaca layar sungguhan.
- **Kinerja:** Lighthouse mobile (build produksi lokal, 23 November 2026): halaman utama 97/100/100, `/forum` 97–98/100/100, `/simulasi` 96–97/100/100 (performa/aksesibilitas/best practices), CLS 0 di ketiganya. Simulasi dengan 16 usulan dan CPU diperlambat 4×: tugas utas utama terpanjang 54–72 ms saat menggeser pagu dan bobot (batas 100 ms); lihat [docs/simulasi.md](docs/simulasi.md#kinerja).
- **Keputusan:** 81 tes SQL (`supabase/tests/keputusan.test.ts`: tiap aturan, kesetaraan status rekomendasi SQL dan TypeScript, pembatalan, skrip pemulihan demo) dan 15 tes E2E (alur penuh, draf, sesi habis, bentrok, 24 jam, nol usulan, PDF A4, CSV, axe, keyboard, reflow, target 44 px). Catatan: `simulasi-kinerja.spec.ts` mengukur tugas utas utama dan, pada mesin yang sedang lebih lambat (23 November 2026: 97–146 ms; kode sebelum fitur ini 132–138 ms), melewati batas 100 ms; angka 54–72 ms di atas diukur saat mesin lebih cepat. Lighthouse belum diukur ulang untuk halaman keputusan.
- **Login:** diuji ujung ke ujung dengan Playwright: masuk, keluar, token palsu, dan `alg=none`.

---

## Struktur folder

```
app/                 rute (halaman utama, masuk, akun, forum, admin, simulasi, keputusan, api/health)
  forum/             daftar, [id] (detail), usul (formulir), aksi.ts (Server Actions)
  admin/             ringkasan, usulan, anggaran, keputusan, akun, moderasi; aksi.ts (Server Actions) dan pratinjau.ts
  keputusan/         daftar periode dan jejak, [tahun] (dua garis, cetak) dan [tahun]/csv (unduhan baca saja)
  simulasi/          halaman simulasi (satu komponen klien dengan status di alamat)
components/
  landing/           bagian halaman utama (GarisPagu, TanpaUsulan, WilayahKontras, CaraKerja, JejakKeputusan)
  keputusan/         halaman publik keputusan: dua garis, cap, tabel, beda dari rekomendasi, jejak lengkap, cetak
  forum/             daftar, tombol dukung, filter, komentar, dialog moderasi, formulir usulan
  admin/             pita mode, navigasi, tabel register, formulir pagu/bobot/status, pratinjau dampak, alur buat akun, lembar kerja keputusan
  anggaran/          PerbandinganPagu: dua Garis Pagu yang dibandingkan, dipakai pratinjau dampak dan simulasi
  simulasi/          kendali pagu dan bobot, hasil, Peta Pagu, uji ketahanan, tabel per RW, usulan andaian, bagikan
  akun/              formulir ganti kata sandi
  shell/             header (dengan penanda halaman aktif dan sesi) dan footer
  ui/                komponen kecil yang dipakai ulang (StatusLabel, StatusSiklus, DialogAlasan, HalamanStub)
lib/                 logika murni dan akses data (seleksi, pagu, format, data, auth, sesi, forum-*, admin-*, keputusan*, pratinjau, simulasi*, peta-pagu, ketahanan, bobot-simulasi, kemiripan, embedding)
scripts/             skrip baris perintah (buat-akun, isi-embedding, kalibrasi-kemiripan, buat-fallback)
supabase/            migrasi dan seed SQL; tests/ berisi tes SQL (PGlite)
e2e/                 tes Playwright dan server tiruan Supabase untuk pengujian
docs/                forum.md, admin.md, simulasi.md, keputusan.md; prompts/ berisi brief fitur
DESIGN.md            sistem visual (token, komponen, aturan)
PRODUCT.md           pengguna, tujuan, prinsip, dan keputusan produk
```

---

## Keputusan yang masih terbuka

- **Aturan dukungan.** Untuk sementara, satu dukungan per usulan per warga, dan warga boleh mendukung banyak usulan. Alternatifnya jatah terbatas, misalnya 3 dukungan per warga per periode. Ini perlu diputuskan sebelum karya dikumpulkan. Aturannya hanya ada di dua tempat, jadi mudah diganti: lihat [docs/forum.md](docs/forum.md#aturan-dukungan-sementara).
- **Penilaian urgensi oleh AI.** Halaman utama menyebut peran AI, tetapi fiturnya belum dibangun. Urgensi kini diisi admin di halaman tinjau usulan, dengan rubrik empat tingkat; tempat untuk saran AI sudah disiapkan di formulirnya, tetapi tidak tampil sampai fiturnya ada.
