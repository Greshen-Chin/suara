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
| **Forum warga.** Usulan, dukungan, komentar, deteksi usulan mirip, dan moderasi. | Direncanakan, lihat [docs/prompts/forum.md](docs/prompts/forum.md) |
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

## Teknologi

- **Next.js 16.4** (App Router, Cache Components, `proxy.ts`) dan **React 19.3** dengan React Compiler.
- **TypeScript** strict, **CSS Modules**, dan token desain di [app/globals.css](app/globals.css) (Tailwind 4 hanya untuk token).
- **Supabase Postgres**, diakses **hanya dari server** dengan service role. RLS aktif tanpa policy, jadi kunci `anon` tidak bisa membaca apa pun.
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
3. [supabase/seed.sql](supabase/seed.sql): data demo. **File ini menghapus dan mengisi ulang** tabel warga, usulan, dukungan, dan log.
4. [supabase/migrations/0003_akun.sql](supabase/migrations/0003_akun.sql): akun dan penguncian login.

Untuk memeriksa hasilnya, jalankan di SQL Editor:

```sql
select 'wilayah' as tabel, count(*) from wilayah
union all select 'usulan', count(*) from proposals
union all select 'dukungan', count(*) from votes;
-- Harus: wilayah 3, usulan 7, dukungan 162
```

Cara lain: buka `http://localhost:3000/api/health`. Kalau database siap, isinya `{"db":"ok", ...}`.

### Membuat akun

Akun dibuat oleh perangkat desa; warga tidak mendaftar sendiri. Alasannya agar satu orang tidak bisa membuat banyak akun untuk menambah dukungan.

```bash
npm run akun:buat
```

Jalankan dari PowerShell, CMD, atau Windows Terminal. Di Git Bash pakai `winpty npm run akun:buat`.

Skrip menanyakan nama pengguna, peran, dan kata sandi. Kata sandi tidak tampil saat diketik. Skrip lalu **mencetak** perintah `insert` berisi hash. Jalankan perintah itu di SQL Editor. Kata sandi asli tidak pernah disimpan atau dikirim ke mana pun.

### Akun demo

| Nama pengguna | Kata sandi | Peran |
|---|---|---|
| `admin` | `admin123` | Admin desa |
| `warga` | `warga123` | Warga RW 07 |

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
npm test             # tes unit: seleksi, Garis Pagu, kata sandi, pengalihan aman
npm run lint
npx tsc --noEmit
npm run build
```

Sudah diperiksa secara manual:
- **SQL:** dijalankan di PGlite (Postgres di dalam Node), termasuk penguncian login dan batasan tabel.
- **Aksesibilitas:** axe-core (WCAG 2.2 AA) tanpa pelanggaran di 360 px dan 1440 px.
- **Kinerja:** Lighthouse mobile halaman utama mendapat 100 di keempat kategori, dengan CLS 0.
- **Login:** diuji ujung ke ujung dengan Playwright: masuk, keluar, token palsu, dan `alg=none`.

---

## Struktur folder

```
app/                 rute (halaman utama, masuk, akun, forum, simulasi, keputusan, api/health)
components/
  landing/           bagian halaman utama (GarisPagu, WilayahKontras, CaraKerja, JejakKeputusan)
  shell/             header dan footer
  ui/                komponen kecil yang dipakai ulang (StatusLabel, HalamanStub)
lib/                 logika murni dan akses data (seleksi, pagu, format, data, auth, sesi)
scripts/             skrip baris perintah (buat-akun)
supabase/            migrasi dan seed SQL
docs/prompts/        brief untuk fitur berikutnya
PRODUCT.md           pengguna, tujuan, prinsip, dan keputusan produk
```

---

## Keputusan yang masih terbuka

- **Aturan dukungan.** Untuk sementara, satu dukungan per usulan per warga, dan warga boleh mendukung banyak usulan. Alternatifnya jatah terbatas, misalnya 3 dukungan per warga per periode. Ini perlu diputuskan sebelum karya dikumpulkan.
- **Penilaian urgensi oleh AI.** Halaman utama menyebut peran AI, tetapi fiturnya belum dibangun. Saat ini nilai urgensi demo diisi manual di `seed.sql`.
