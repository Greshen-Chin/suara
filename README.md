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
| **Masuk (login).** Peran warga dan admin desa, dengan sesi aman. | Selesai |
| **Forum warga.** Usulan, dukungan, komentar, deteksi usulan mirip (AI), dan moderasi. | Selesai, lihat [Forum warga](#forum-warga) dan [docs/forum.md](docs/forum.md) |
| **Simulasi anggaran** dan **halaman Keputusan**. | Direncanakan (halaman sementara) |
| **Halaman admin.** Akun warga, pagu, bobot, dan status usulan. | Direncanakan |

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

Tanpa langkah 5 dan 7, forum tetap tampil dari data cadangan dengan penanda yang jelas, dan semua aksi tulis dimatikan.

Untuk memeriksa hasilnya, jalankan di SQL Editor:

```sql
select 'wilayah' as tabel, count(*) from wilayah
union all select 'usulan', count(*) from proposals
union all select 'dukungan', count(*) from votes;
-- Setelah langkah 1-5: wilayah 3, usulan 7, dukungan 162
-- Setelah langkah 7:   wilayah 3, usulan 13, dukungan 221 (162 + 59 pada usulan forum)
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

Cara lain: buka `http://localhost:3000/api/health`. Kalau database siap, isinya `{"db":"ok", ...}`.

### Membuat akun

Akun dibuat oleh perangkat desa; warga tidak mendaftar sendiri. Alasannya agar satu orang tidak bisa membuat banyak akun untuk menambah dukungan.

```bash
npm run akun:buat
```

Jalankan dari PowerShell, CMD, atau Windows Terminal. Di Git Bash pakai `winpty npm run akun:buat`.

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
npm test             # 178 tes: unit (lib/) dan SQL di PGlite (supabase/tests/)
npm run lint
npx tsc --noEmit
npm run build
npm run e2e          # Playwright + axe di build produksi, melawan server tiruan (lihat docs/forum.md)
```

`npm run e2e` perlu browser Playwright (`npx playwright install chromium`) dan model embedding terunduh (atau `E2E_TANPA_EMBEDDING=1`). Skrip lain: `npm run kemiripan:kalibrasi` (mengukur deteksi usulan mirip), `npm run fallback:buat` (membuat ulang data cadangan forum dari seed), `npm run embedding:isi`.

Sudah diperiksa secara manual:
- **SQL:** migrasi 0001 sampai 0004 dan kedua seed dijalankan di PGlite (Postgres di dalam Node, dengan pgvector, pg_trgm, dan PostGIS): dukung/batal atomik, penolakan admin dan akun tanpa `warga_id`, batas laju, moderasi, hak `execute`, dan `rekomendasi_resmi(300000000)` identik dengan sebelum migrasi forum.
- **Aksesibilitas:** axe-core (WCAG 2.2 AA) tanpa pelanggaran di 360 px dan 1440 px.
- **Kinerja:** Lighthouse mobile halaman utama mendapat 100 di keempat kategori, dengan CLS 0.
- **Login:** diuji ujung ke ujung dengan Playwright: masuk, keluar, token palsu, dan `alg=none`.

---

## Struktur folder

```
app/                 rute (halaman utama, masuk, akun, forum, simulasi, keputusan, api/health)
  forum/             daftar, [id] (detail), usul (formulir), aksi.ts (Server Actions)
components/
  landing/           bagian halaman utama (GarisPagu, WilayahKontras, CaraKerja, JejakKeputusan)
  forum/             daftar, tombol dukung, filter, komentar, dialog moderasi, formulir usulan
  shell/             header (dengan penanda halaman aktif dan sesi) dan footer
  ui/                komponen kecil yang dipakai ulang (StatusLabel, StatusSiklus, HalamanStub)
lib/                 logika murni dan akses data (seleksi, pagu, format, data, auth, sesi, forum-*, kemiripan, embedding)
scripts/             skrip baris perintah (buat-akun, isi-embedding, kalibrasi-kemiripan, buat-fallback)
supabase/            migrasi dan seed SQL; tests/ berisi tes SQL (PGlite)
e2e/                 tes Playwright dan server tiruan Supabase untuk pengujian
docs/                forum.md; prompts/ berisi brief fitur
DESIGN.md            sistem visual (token, komponen, aturan)
PRODUCT.md           pengguna, tujuan, prinsip, dan keputusan produk
```

---

## Keputusan yang masih terbuka

- **Aturan dukungan.** Untuk sementara, satu dukungan per usulan per warga, dan warga boleh mendukung banyak usulan. Alternatifnya jatah terbatas, misalnya 3 dukungan per warga per periode. Ini perlu diputuskan sebelum karya dikumpulkan. Aturannya hanya ada di dua tempat, jadi mudah diganti: lihat [docs/forum.md](docs/forum.md#aturan-dukungan-sementara).
- **Penilaian urgensi oleh AI.** Halaman utama menyebut peran AI, tetapi fiturnya belum dibangun. Saat ini nilai urgensi demo diisi manual di `seed.sql`.
