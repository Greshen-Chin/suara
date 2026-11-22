# Prompt: Fitur Forum Warga SUARA

> Prompt ini ditulis untuk agen pengembang (Claude Code atau sejenisnya) yang akan membangun `/forum`.
> Salin seluruh isi file ini sebagai pesan pertama. Keputusan produk di bagian 2 sudah final; jangan ditanyakan ulang.

---

## 0. Peran dan cara kerja

Anda adalah *design engineer* senior yang membangun fitur produksi untuk lomba pengembangan web. Juri menilai fungsionalitas, inovasi, relevansi, UI/UX, kualitas kode, dan dokumentasi.

Sebelum menulis kode, lakukan dua hal berikut.

**Baca dulu:**

1. `PRODUCT.md`: fakta produk, pengguna, prinsip, dan keputusan terbuka.
2. `AGENTS.md`, lalu panduan Next.js 16 di `node_modules/next/dist/docs/`, terutama:
   - `01-app/01-getting-started/07-mutating-data.md` (Server Actions, `updateTag`/`revalidateTag`)
   - `01-app/01-getting-started/09-revalidating.md`
   - `01-app/02-guides/forms.md`
   - `01-app/02-guides/authentication-with-cache-components.md`

   Versi Next.js ini berbeda dari data latih Anda: `cacheComponents`, `proxy.ts`, dan `'use cache'` sudah aktif.

**Jalankan skill:**

- `impeccable`. Jalankan `impeccable context --target app/forum/page.tsx`, lalu ikuti arahannya. Mode permukaan ini **Operate**. Proyek belum punya `DESIGN.md`, jadi jalankan `/impeccable document` lebih dulu untuk mencatat sistem visual yang sudah berjalan di halaman utama, lalu kembangkan dari sana. Ini **perluasan**, bukan desain ulang. Baca `reference/craft-floor.md` sebelum mengubah UI apa pun.
- `ux-writing`, `interaction-design`, `accessibility-audit`, dan `design-critique`, masing-masing di tahap yang relevan.

**Berhenti dan bertanya hanya jika:**

- brief ini bertentangan dengan dirinya sendiri atau dengan kode;
- AI kemiripan (bagian 5) tidak bisa dijalankan di lingkungan ini;
- sebuah perubahan akan mengubah angka Garis Pagu di halaman utama.

Untuk hal lain, pilih default yang paling masuk akal dan catat di laporan akhir.

---

## 1. Tujuan

Forum adalah tempat warga **menyampaikan aspirasi**, langkah 1 dari "Cara kerja" di halaman utama. Setelah fitur ini jadi:

- Siapa pun, tanpa login, bisa membaca semua usulan dan diskusinya, serta memahami posisi tiap usulan terhadap pagu anggaran.
- Warga yang login bisa:
  - mendukung usulan dan membatalkan dukungannya;
  - mengajukan usulan baru;
  - berkomentar.
- Sebelum usulan baru terkirim, sistem menunjukkan usulan yang mirip (dari makna dan lokasinya) dan menawarkan untuk **menggabungkan dukungan**, supaya suara warga tidak terpecah.
- Admin desa bisa menyembunyikan usulan atau komentar yang tidak pantas. Alasannya wajib diisi dan tercatat di jejak keputusan. Konten yang disembunyikan tetap meninggalkan jejak yang bisa dilihat publik.

Halaman utama (`components/landing/CaraKerja.tsx`) sudah menjanjikan *"AI mengenali usulan yang mirip dari makna dan lokasinya, lalu menawarkan gabung dukungan."* Fitur ini harus membuktikan klaim itu dengan sungguh-sungguh. Kalau tidak bisa, ubah klaimnya (lihat bagian 5).

---

## 2. Keputusan produk (final)

| Topik | Keputusan |
|---|---|
| Diskusi | Ada komentar per usulan. |
| Aturan dukungan | Satu dukungan per usulan per warga; warga boleh mendukung banyak usulan dan bisa membatalkan. **Sementara.** Pemilik produk akan menimbang ulang jatah terbatas. Rancang supaya aturan ini mudah diganti: logikanya ada di satu fungsi database dan satu modul TypeScript. |
| Usulan baru | Langsung tampil dengan status `forum`. Admin bisa menyembunyikannya dengan alasan. |
| Akun warga | Dibuat admin, tanpa pendaftaran mandiri. Untuk demo pakai akun `warga` / `warga123` (RW 07) dan `admin` / `admin123`. |
| Siapa yang boleh mendukung | Hanya akun berperan `warga` yang punya `warga_id`. Admin tidak mendukung, supaya tidak memengaruhi hasil. |
| Siapa yang boleh berkomentar | Warga dan admin. Komentar admin diberi label "Admin desa". |
| Siapa yang boleh membaca | Semua orang, tanpa login. |

---

## 3. Fakta kode yang harus dipakai, bukan dibuat ulang

- **Database:**
  - `lib/supabase-server.ts` adalah satu-satunya klien Supabase, dipakai server saja dengan service role. Jangan membuat klien baru, dan jangan memanggil Supabase dari browser.
  - Pola baca data ada di `lib/data.ts`: `denganFallback`, `BATAS_WAKTU_MS`, `Hasil<T>`, dan data cadangan `lib/fallback-data.json`. `getForum()` sudah ada tetapi harus diperbarui.
- **Autentikasi:**
  - `lib/auth.ts`: `ambilPengguna()`, `wajibMasuk()`, `wajibPeran("warga" | "admin")`.
    - `Pengguna` saat ini hanya memuat `{ id, nama, peran }`. Tambahkan `wargaId: string | null` dari `akun.warga_id`, lewat `cariAkunById` di `lib/akun.ts`.
    - `wajibMasuk` dan `wajibPeran` memanggil `redirect()`. Itu cocok untuk halaman, tetapi di Server Action yang dipanggil dari tombol, kembalikan status galat yang bisa ditampilkan, bukan redirect diam-diam ke `/akun`.
  - `proxy.ts` hanya pemeriksaan awal. **Setiap Server Action wajib memeriksa sesi dan peran sendiri.**
- **Logika dan format:**
  - `lib/seleksi.ts`: `statusUsulan`, `greedyPilih`, `pilihOptimal`.
  - `lib/beranda.ts`: data halaman utama dengan `'use cache'`.
  - `lib/format.ts`: `rupiah`, `rupiahRinci`, `ribuan`, `desimal`. Selalu pakai ini untuk angka.
- **Komponen:**
  - `components/ui/StatusLabel.tsx` (ikon dan teks status).
  - `components/shell/SiteHeader` dan `SiteFooter`.
  - Kelas global `.wadah`, `.bagian`, `.tombol`, `.tombol-utama`, dan `.tombol-kedua` di `app/globals.css`.
- **Token visual** di `app/globals.css`:
  - warna `--kapur`, `--papan`, `--tinta`, `--abu-semen`, `--biru-stempel`, `--hijau-sawah`, `--kuning-marka`;
  - huruf `--f-judul` (Barlow Condensed) dan `--f-isi` (Public Sans);
  - skala tipe `--t-xs` sampai `--t-hero`, serta `--radius` dan `--tebal`.

  Jangan menambah warna atau huruf baru tanpa alasan yang Anda tulis di `DESIGN.md`.
- **Skema:**
  - `supabase/migrations/0001` sampai `0003`. Tabel `warga`, `proposals`, `votes` (PK `proposal_id, warga_id`), `accountability_logs`, `wilayah`, dan `akun`.
  - Trigger `trg_dukungan_pengusul` memberi satu dukungan otomatis dari pengusul.
- **Tipe database:** `lib/database.types.ts` diperbarui manual. Tambahkan semua objek baru ke sana.
- **Tes:** `npm test` (node:test, TypeScript native).
- **Batasan menjalankan SQL:** semua SQL dijalankan **oleh pemilik proyek** di SQL editor Supabase. Anda tidak boleh menjalankan migrasi ke database mereka. Uji SQL di PGlite (`@electric-sql/pglite`, di luar repo atau sebagai devDependency) dan beri urutan langkah yang jelas.

---

## 4. Masalah yang sudah diketahui dan harus diselesaikan

1. **Forum akan kosong.** `v_forum` hanya memuat `status = 'forum'`, padahal ketujuh usulan di seed berstatus `voting`. Forum harus menampilkan usulan `forum` **dan** `voting` dalam satu daftar dengan filter status. Usulan `approved`, `rejected`, dan `done` tetap bisa dibuka, tetapi dukungannya ditutup.
2. **`urgency_score` wajib diisi** (1 sampai 10). Warga tidak menilai urgensi usulannya sendiri, jadi buat kolom ini nullable selama status `forum`, dengan *check constraint* yang mewajibkannya untuk status selain `forum`. Penilaian urgensi oleh AI **di luar cakupan** fitur ini; itu terjadi saat admin memindahkan usulan ke `voting`. Tulis catatannya sebagai pekerjaan berikutnya.
3. **`accountability_logs.log_type`** belum mengenal moderasi. Tambahkan `moderation`, lalu perbarui `BarisLog` dan tampilan jejak keputusan di halaman utama supaya tipe baru tidak merusaknya.
4. **Jangan mengubah angka halaman utama.** Ketujuh usulan `voting` dan 162 dukungannya harus tetap sama. Data forum tambahan ditaruh di seed terpisah. Jalankan ulang tes `lib/pagu.test.ts` dan `lib/seleksi.test.ts`, lalu bandingkan hasil `rekomendasi_resmi(300000000)` sebelum dan sesudah migrasi.
5. **Cache halaman utama** (`'use cache'`, revalidate 60 detik). Setelah warga mendukung usulan `voting`, angka di halaman utama dan forum harus ikut berubah. Pakai `cacheTag` dan `updateTag`, sesuai dokumentasi Next 16, untuk *read-your-writes*.

---

## 5. Usulan mirip (AI): inti inovasi

**Alur.** Warga mengisi judul, deskripsi, dan RW, lalu menekan "Periksa usulan serupa". Server mencari maksimal 3 usulan yang terbuka (`forum` atau `voting`) dan mirip. Hasilnya tampil sebelum usulan bisa dikirim:

- Setiap usulan mirip menampilkan judul, RW, jumlah dukungan, dan alasan kemiripan yang bisa dibaca manusia, misalnya *"Sama-sama soal penerangan jalan, di RW yang sama"*.
- Ada dua aksi: **"Dukung usulan ini"**, yang menggabungkan dukungan lalu membatalkan usulan baru, atau **"Tetap ajukan usulan saya"**. Jangan pernah memblokir warga.
- Kalau tidak ada yang mirip, katakan begitu dengan jelas, lalu lanjutkan.

**Cara mengukur kemiripan.** Kolom `proposals.embedding vector(384)` dan `location geography` sudah ada.

- Sarankan model embedding multibahasa 384 dimensi yang mengerti bahasa Indonesia, misalnya `Xenova/multilingual-e5-small` lewat `@huggingface/transformers` di server Node. Pakai prefiks `query:` / `passage:` sesuai kartu modelnya.
- Gabungkan jarak kosinus (pgvector, indeks HNSW sudah ada) dengan kecocokan lokasi: RW yang sama, atau jarak titik bila `location` diisi.
- Ambang skornya dikalibrasi pada data seed. Dokumentasikan angkanya beserta alasannya.

**Wajib diperiksa sebelum memilih pendekatan:**

- Ukuran model, waktu muat pertama (*cold start*), dan apakah berjalan di target deploy (kemungkinan Vercel). Kalau model terlalu berat untuk serverless, pertimbangkan Supabase Edge Function. Catat bahwa `gte-small` bawaan Supabase cenderung berbahasa Inggris, lalu ukur kualitasnya pada data Indonesia.
- Buat skrip `npm run embedding:isi` yang mengisi embedding untuk usulan yang belum punya, termasuk data seed. Skrip mencetak SQL `update` atau memakai service role secara eksplisit, dengan persetujuan pemilik.
- Batas waktu: kalau embedding gagal atau lebih lambat dari sekitar 3 detik, turun ke kemiripan teks (`pg_trgm`) ditambah RW, dan beri tahu warga dengan jujur.

**Kejujuran klaim (wajib):** label "AI" hanya boleh tampil kalau kemiripan benar-benar dihitung dengan embedding. Kalau Anda akhirnya hanya memakai `pg_trgm`, ubah teks di `CaraKerja.tsx` supaya tidak menyebut AI, lalu laporkan perubahannya.

---

## 6. Model data (migrasi `0004_forum.sql` dan `seed_forum.sql`)

Rancang sendiri detailnya, dengan syarat minimum berikut:

- **Tabel `komentar`:**
  - Kolom: `id`, `proposal_id` (FK, cascade), `akun_id` (FK ke `akun`), `isi` (teks 1 sampai 1.000 karakter, dipangkas), `created_at`, `disembunyikan_pada`, dan `alasan_disembunyikan`.
  - Indeks per usulan, diurut waktu.
  - Tanpa balasan bersarang. Satu tingkat sudah cukup untuk forum desa.
- **Moderasi usulan:** kolom `disembunyikan_pada` dan `alasan_disembunyikan` pada `proposals`. Usulan yang disembunyikan tidak dihitung dalam skor dan tidak tampil di daftar. Halaman detailnya tetap ada dan berbunyi *"Disembunyikan oleh admin desa pada [tanggal]. Alasan: …"*. Hal yang sama berlaku untuk komentar.
- **Fungsi database atomik:** setiap fungsi dipanggil lewat `rpc`, dengan `revoke execute` dari `public`, `anon`, dan `authenticated`, mengikuti pola `catat_gagal_masuk` di `0003_akun.sql`.
  - `dukung_usulan(p_akun, p_proposal)` dan `batal_dukung(...)`. Keduanya memeriksa status usulan, akun aktif, peran warga, dan `warga_id`, lalu mengembalikan jumlah dukungan terbaru. **Aturan dukungan hanya ada di sini.**
  - `ajukan_usulan(...)`: validasi panjang, kategori, RW, dan anggaran (`estimated_budget` > 0 dengan batas atas yang masuk akal; tulis alasannya). Usulan baru otomatis mendapat dukungan pengusul lewat trigger.
  - `tambah_komentar(...)` dan `sembunyikan(...)`. `sembunyikan` khusus admin, wajib ada alasan, dan menulis `accountability_logs` dengan tipe `moderation`.
  - Batas laju per akun di database: maksimal 3 usulan per 24 jam dan 1 komentar per 20 detik. Ubah sesuai pertimbangan Anda, dengan alasan tertulis.
- **`v_forum` baru:** gabungkan status `forum` dan `voting`. Sertakan `rw`, `nama_singkat`, `status`, `vote_count`, `jumlah_komentar`, dan pengusul.
  - Pengusul ditampilkan sebagai **nama depan saja** ditambah RW, untuk privasi. Jangan menampilkan `warga.nomor`.
  - Untuk usulan `voting`, sertakan posisinya di `rekomendasi_resmi` (peringkat, terpilih atau ditunda).
- **`seed_forum.sql`:**
  - 4 sampai 6 usulan berstatus `forum` dengan dukungan yang tersebar di ketiga RW.
  - Minimal satu usulan sengaja mirip dengan usulan yang sudah ada, untuk demo penggabungan. Contohnya "Lampu jalan gang RW 07 gelap" yang mirip dengan "Lampu PJU jalan setapak RW 07".
  - 10 sampai 20 komentar yang terdengar seperti warga sungguhan. Isinya konkret dan pendek, tanpa klaim dramatis.
  - Satu komentar yang sudah disembunyikan, beserta alasan dan log moderasinya.
  - **Tidak boleh menyentuh** ketujuh usulan `voting` dan dukungannya.
  - Bisa dijalankan ulang tanpa gagal (*idempotent*).
- **RLS** tetap aktif di semua tabel baru, tanpa policy.

---

## 7. Layar dan perilaku

Semua layar ditujukan untuk ponsel lebih dulu (360 px), lalu diperluas ke 768 px dan 1440 px.

### `/forum`: daftar usulan

- **Isi tiap usulan:**
  - judul, RW, kategori, dan perkiraan biaya (`rupiah`);
  - jumlah dukungan **dan** dukungan per 1.000 penduduk RW;
  - jumlah komentar dan umur usulan ("3 hari lalu");
  - status (`forum` "Sedang dibahas", `voting` "Masuk hitungan anggaran").
- **Momen khas.** Untuk usulan `voting`, tampilkan posisinya terhadap Garis Pagu: *"Peringkat 2 rekomendasi · Terbiayai"* atau *"Peringkat 1 · Ditunda, biaya melebihi sisa pagu"*. Pakai `StatusLabel` atau `IkonStatus` dan warna status yang sama dengan halaman utama. Inilah pembeda SUARA dari forum biasa: warga langsung melihat dampak anggaran dari usulan yang mereka baca. Rancang dengan sungguh-sungguh, tetapi tetap tenang.
- **Filter dan urutan:**
  - Filter: status, RW, dan kategori.
  - Urutan: terbaru, dukungan terbanyak, dan dukungan per 1.000 penduduk.
  - State filter disimpan di URL (`searchParams`), supaya bisa dibagikan dan tombol kembali tetap berfungsi.
- **Tombol "Dukung":**
  - Ada di daftar dan di halaman detail.
  - Memakai `useOptimistic`: angka langsung berubah, lalu dikembalikan disertai pesan kalau server gagal.
  - Status ditandai `aria-pressed`, dengan teks yang berubah ("Dukung" atau "Didukung").
  - Pengunjung tanpa sesi diarahkan ke `/masuk?lanjut=…`, lalu kembali ke tempat yang sama.
  - Untuk admin, tombol diganti teks keterangan bahwa admin tidak memberi dukungan.
  - Untuk akun warga tanpa `warga_id`, tampilkan penjelasan dan arahan untuk menghubungi admin.
- **Tombol "Ajukan usulan"** selalu terlihat dan mudah dijangkau di ponsel.
- **Paginasi:** keyset, atau "Muat lebih banyak" setelah 20 usulan.

### `/forum/[id]`: detail usulan

- Isinya:
  - judul, deskripsi lengkap, pengusul (nama depan dan RW), serta biaya;
  - posisi anggaran (untuk `voting`) dan alasan urgensi bila ada;
  - riwayat status dari `accountability_logs`;
  - komentar.
- **Formulir komentar:**
  - Label terlihat dan penghitung karakter yang diumumkan secara sopan (`aria-live="polite"`, dibatasi frekuensinya).
  - Saat mengirim, tombol dikunci dan tampil keadaan menunggu. Komentar muncul tanpa memuat ulang halaman.
  - Galat validasi ditaruh di dekat kolomnya.
- **Untuk admin:**
  - Aksi "Sembunyikan" pada usulan dan komentar membuka dialog yang mewajibkan alasan.
  - Dialog memakai `<dialog>` asli, dengan fokus terperangkap di dalamnya dan dikembalikan ke tombol asal saat ditutup.
- **Metadata:** judul halaman dari judul usulan dan gambar OpenGraph sederhana.

### `/forum/usul`: ajukan usulan (hanya warga)

- **Bidang:**
  - Judul, maksimal sekitar 80 karakter.
  - Nama singkat, opsional, untuk label batang anggaran.
  - Deskripsi: apa masalahnya, siapa yang terdampak, dan di mana.
  - Kategori.
  - RW lokasi: bawaannya RW warga, bisa diganti.
  - Perkiraan biaya: masukan rupiah yang toleran, sehingga `85000000`, `85.000.000`, `Rp 85 jt`, dan `85 juta` semuanya diterima, dengan pratinjau `rupiah()`.
- **Langkah:** isi → periksa usulan serupa (bagian 5) → tinjau → kirim → halaman detail usulan baru dengan konfirmasi yang jelas.
- **Draf** tersimpan di `sessionStorage` (dibungkus `try/catch`), supaya tidak hilang kalau sinyal putus atau sesi habis. Draf dihapus setelah berhasil terkirim.
- **Validasi** dilakukan di klien untuk umpan balik cepat dan di server sebagai penentu. Pakai satu skema yang sama untuk keduanya. Pustaka validasi boleh ditambah kalau Anda bisa menjelaskan alasannya.

### Keadaan yang wajib dirancang

| Keadaan | Perilaku |
|---|---|
| Kosong (filter tanpa hasil) | Pesan jelas dan tombol untuk menghapus filter. |
| Memuat | Kerangka (*skeleton*) yang sesuai ukuran asli, tanpa CLS. |
| Database tidak bisa dijangkau | Mode baca dari data cadangan, dengan penanda yang jelas bahwa ini data cadangan. Aksi tulis dinonaktifkan dan disertai alasan. |
| Kena batas laju | Pesan berisi kapan bisa mencoba lagi. |
| Sesi habis saat mengirim | Arahkan ke login, lalu kembali dengan draf utuh. |
| Usulan atau komentar disembunyikan | Jejak publik beserta alasannya. |
| Usulan tidak ditemukan | `notFound()` dengan halaman 404 yang membantu. |

### Navigasi

Header perlu indikator halaman aktif (`aria-current="page"`); sekarang belum ada. Kalau sudah login, ganti tombol "Masuk" dengan nama pengguna yang tertaut ke `/akun`. Header harus tetap bisa di-render statis, jadi bagian sesi dibungkus `Suspense`.

---

## 8. Keamanan (wajib)

- **Semua mutasi lewat Server Action:**
  - Di awal setiap aksi, panggil `wajibPeran(...)` atau `ambilPengguna()`. Jangan percaya `akun_id` atau `warga_id` dari formulir; selalu ambil dari sesi.
  - Validasi ulang semua masukan di server (panjang, jenis, enum, dan rentang angka).
  - Terapkan batas laju di database (bagian 6).
- **Cegah XSS:** teks pengguna hanya dirender sebagai teks React. Jangan render HTML atau Markdown, dan jangan pakai `dangerouslySetInnerHTML`. Tautan di komentar ditampilkan sebagai teks biasa.
- **Jangan bocorkan data:** jangan mengirim `warga_id`, `akun_id`, nama lengkap, atau `nomor` warga ke klien, kecuali benar-benar diperlukan.
- **Pesan galat:** galat database di-log di server tanpa data pribadi. Pengguna mendapat pesan umum yang bisa ditindaklanjuti.
- **CSRF:** cukup dengan pemeriksaan Origin bawaan Server Actions. Jangan membuat endpoint `route.ts` untuk mutasi tanpa alasan.

---

## 9. Standar mutu

- **Build dan tipe:** `npm run build`, `npm run lint`, `npx tsc --noEmit`, dan `npm test` bersih.
- **Aksesibilitas:** WCAG 2.2 AA dengan axe tanpa pelanggaran di `/forum`, `/forum/[id]`, dan `/forum/usul`. Periksa di 360 px dan 1440 px, saat belum login dan saat login sebagai warga dan admin, termasuk saat dialog terbuka.
  - Semua bisa dipakai dengan keyboard.
  - Target sentuh minimal 24 px, idealnya 44 px.
  - Hasil aksi diumumkan (`aria-live` untuk dukungan dan komentar terkirim).
- **Kinerja:** Lighthouse mobile minimal 90 untuk performa dan 95 untuk aksesibilitas dan best practices, dengan CLS di bawah 0,1, untuk `/forum` dan satu halaman detail.
- **Gerak:** hanya gerak yang menjawab aksi, misalnya angka dukungan berubah atau komentar baru masuk. Semuanya hormat pada `prefers-reduced-motion`.
- **Kode:**
  - Logika murni (normalisasi rupiah, validasi, skor kemiripan gabungan, format waktu relatif) dipisah ke `lib/` dan diberi tes unit.
  - Komponen klien sekecil mungkin; sisanya Server Component.
  - Nama dalam bahasa Indonesia, mengikuti gaya kode yang ada.

### Tes yang wajib ada

- **Unit:** semua fungsi murni baru.
- **SQL di PGlite:** migrasi 0001 sampai 0004, ditambah `seed.sql` dan `seed_forum.sql`.
  - Dukung dan batal dukung bersifat atomik dan idempoten.
  - Admin dan akun tanpa `warga_id` ditolak.
  - Usulan `approved` tidak bisa didukung.
  - Batas laju bekerja.
  - Moderasi menulis log.
  - `anon` tidak punya hak `execute`.
  - **Hasil `rekomendasi_resmi(300000000)` sama persis dengan sebelum migrasi.**
- **E2E Playwright** (di luar repo atau sebagai devDependency): baca tanpa login, lalu warga mendukung, membatalkan, mengajukan usulan (termasuk muncul usulan mirip dan memilih gabung), dan berkomentar. Setelah itu admin menyembunyikan komentar, dan jejaknya terlihat publik. Konsol browser harus bersih.

---

## 10. Dokumentasi (wajib, ikut dinilai)

1. **`README.md`:** tambahkan bagian Forum (fitur, cara mencoba dengan akun demo) dan perbarui urutan menjalankan SQL (0004, `seed_forum.sql`, dan pengisian embedding).
2. **`docs/forum.md`:**
   - Aturan dukungan dan alasannya, termasuk catatan bahwa aturan ini sementara.
   - Siklus status usulan dan alur moderasi.
   - Cara kerja deteksi usulan mirip: model, dimensi, rumus skor gabungan, ambang dan cara kalibrasinya, *fallback*, serta keterbatasannya.
   - Batas laju beserta alasannya.
   - Diagram alur sederhana (Mermaid).
3. **`DESIGN.md`:** hasil `/impeccable document`, ditambah komponen forum yang baru.
4. **Kode:**
   - Komentar singkat hanya untuk alasan yang tidak terlihat dari kodenya, seperti mengapa atomik, mengapa ambang ini, atau mengapa nama depan saja.
   - Header di setiap file SQL berisi urutan menjalankan dan apa yang diubahnya.
5. **Langkah untuk pemilik proyek:** daftar bernomor berisi SQL yang harus dijalankan di Supabase, secara berurutan, ditambah perintah cek hasil dengan angka yang diharapkan.

---

## 11. Proses dan laporan akhir

**Proses:**

1. Rencana singkat: data, layar, dan urutan pengerjaan.
2. Migrasi beserta tes PGlite.
3. Lapisan data dan Server Actions beserta tes.
4. UI.
5. Satu putaran verifikasi berisi tangkapan layar 360, 768, dan 1440 px, `impeccable detect`, critique, dan audit aksesibilitas.
6. Satu putaran perbaikan.
7. Satu putaran konfirmasi, lalu berhenti memoles.

**Laporan akhir dalam bahasa Indonesia:**

- apa yang dibangun;
- keputusan yang Anda ambil sendiri, beserta alasannya;
- hasil setiap pemeriksaan, berupa angka, bukan "sudah dicek";
- apa yang **tidak** terverifikasi;
- langkah untuk pemilik proyek;
- keterbatasan yang diketahui.

**Pengingat untuk pemilik proyek, wajib ditulis di akhir laporan:** aturan dukungan (bebas, satu per usulan) masih sementara. Pertimbangkan apakah perlu jatah terbatas, misalnya 3 dukungan per warga per periode, sebelum karya dikumpulkan.

---

## Di luar cakupan (jangan dikerjakan)

- Halaman admin untuk membuat akun, mengatur pagu dan bobot, serta memindahkan status ke `voting`.
- Penilaian urgensi oleh AI.
- Halaman `/simulasi` dan `/keputusan`.
- Notifikasi, unggah foto, peta interaktif, dan balasan komentar bersarang.
- Pendaftaran akun mandiri.
