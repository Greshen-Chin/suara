# Prompt: Halaman Admin Desa SUARA

> Prompt ini ditulis untuk agen pengembang (Claude Code atau sejenisnya) yang akan membangun `/admin`.
> Salin seluruh isi file ini sebagai pesan pertama di percakapan baru. Keputusan produk di bagian 2 sudah final; jangan ditanyakan ulang.

---

## 0. Peran dan cara kerja

Anda adalah *design engineer* senior yang membangun fitur produksi untuk lomba pengembangan web. Juri menilai fungsionalitas, inovasi, relevansi, UI/UX, kualitas kode, dan dokumentasi. Juri akan masuk sebagai `admin` / `admin123` dan mencoba setiap layar di bawah ini.

Sebelum menulis kode, lakukan hal berikut.

**Baca dulu:**

1. `PRODUCT.md`: fakta produk, pengguna, prinsip, dan keputusan terbuka.
2. `DESIGN.md`: sistem visual "Papan Pengumuman Desa" yang sudah berjalan di beranda dan forum. Halaman admin adalah **perluasan** sistem ini, bukan dunia visual baru.
3. `docs/forum.md`: pola yang sudah dipakai forum (fungsi SQL atomik, galat, cache, pengujian). Ikuti pola itu, jangan membuat pola kedua.
4. `AGENTS.md`, lalu panduan Next.js 16 di `node_modules/next/dist/docs/`, terutama:
   - `01-app/01-getting-started/07-mutating-data.md` (Server Actions, `updateTag`)
   - `01-app/01-getting-started/09-revalidating.md`
   - `01-app/02-guides/forms.md`
   - `01-app/02-guides/authentication-with-cache-components.md`

   Versi Next.js ini berbeda dari data latih Anda: `cacheComponents`, `proxy.ts`, dan `'use cache'` sudah aktif. `cookies()` dan `new Date()` di rute yang diprerender butuh `await connection()`. Jangan membungkus pembacaan cookie dengan `try/catch` (lihat komentar di `lib/auth.ts`).

**Jalankan skill:**

- `impeccable`. Jalankan `impeccable context --target app/admin/page.tsx`, lalu ikuti arahannya. Mode permukaan ini **Operate**. `DESIGN.md` sudah ada; perluas bagian Components dan Layout untuk komponen admin, jangan menulis ulang yang sudah ada. Baca `reference/craft-floor.md` sebelum mengubah UI apa pun.
- `ux-writing` untuk semua teks (label, konfirmasi, galat, keadaan kosong), `interaction-design` untuk pratinjau dampak dan dialog konfirmasi, `accessibility-audit` untuk tabel, formulir, dan dialog, serta `design-critique` pada putaran verifikasi.

**Berhenti dan bertanya hanya jika:**

- brief ini bertentangan dengan dirinya sendiri atau dengan kode;
- migrasi atau seed baru mengubah angka Garis Pagu di halaman utama **sebelum** admin melakukan apa pun (angka boleh berubah karena aksi admin; itu memang tujuannya);
- sebuah keputusan menyentuh aturan dukungan (lihat bagian 2: jangan diubah di fitur ini).

Untuk hal lain, pilih default yang paling masuk akal dan catat di laporan akhir. Jangan commit atau push kecuali diminta.

---

## 1. Tujuan

Setelah fitur ini jadi, siklus usulan SUARA tidak lagi putus di tengah. Saat ini usulan warga berhenti di status `forum` karena tidak ada yang bisa memindahkannya, pagu tertanam sebagai konstanta di kode, bobot hanya bisa diubah lewat SQL, dan akun hanya bisa dibuat lewat skrip terminal.

Admin desa (perangkat desa) harus bisa:

1. **Meninjau usulan forum** dan memindahkannya ke `voting` (masuk hitungan anggaran) dengan nilai urgensi 1 sampai 10 beserta alasan tertulis, atau menyatakannya tidak dilanjutkan dengan alasan.
2. **Mengatur pagu dan bobot penilaian** dengan alasan tertulis, setelah melihat **pratinjau dampaknya**: usulan mana yang berubah status kalau perubahan ini disimpan.
3. **Mengelola akun warga**: membuat akun untuk warga yang terdaftar, mengatur ulang kata sandi, menonaktifkan, dan mengaktifkan kembali.
4. **Memoderasi**: melihat konten terbaru dan yang sudah disembunyikan, serta menampilkan kembali konten yang keliru disembunyikan, dengan alasan.

Prinsip yang tidak boleh dilanggar (`PRODUCT.md`): **setiap keputusan admin punya alasan yang bisa dibaca warga**. Setiap perubahan status, pagu, bobot, dan moderasi tercatat di jejak keputusan publik (`accountability_logs`) dan muncul di "Jejak keputusan" halaman utama serta riwayat usulan di forum.

---

## 2. Keputusan produk (final)

| Topik | Keputusan |
|---|---|
| Siapa yang boleh | Hanya akun berperan `admin` yang aktif. Semua orang lain, termasuk warga yang masuk, mendapat halaman "Halaman ini khusus admin desa" (bukan redirect diam-diam). |
| Perpindahan status yang ada di fitur ini | `forum → voting`, `forum → rejected` ("Tidak dilanjutkan"), dan `voting → forum` ("Kembalikan ke pembahasan"). Semuanya wajib alasan. |
| Perpindahan yang **tidak** ada di fitur ini | `voting → approved/rejected` dan `approved → done`. Itu penetapan hasil musyawarah dan menjadi bagian fitur Keputusan (`/keputusan`), karena butuh konsep periode anggaran. Jangan bangun tombolnya. |
| Urgensi | Diisi admin saat memindahkan ke `voting`: angka 1 sampai 10 dan alasan tertulis (`urgency_reason`, minimal 20 karakter). Admin melihat rubrik singkat supaya penilaian antarusulan konsisten. Penilaian urgensi oleh AI **di luar cakupan**, tetapi sisakan tempat di formulir untuk saran AI nanti (lihat bagian 7). |
| Batas usulan `voting` | Maksimal 16 (`BATAS_USULAN_OPTIMAL` di `lib/seleksi.ts`, sama dengan batas di `pilih_optimal`). Usulan ke-17 ditolak dengan pesan yang menjelaskan alasannya dan arahan untuk mengembalikan usulan lain ke pembahasan. |
| Pagu | Pindah dari konstanta `PAGU_DEFAULT` ke database. Satu nilai pagu yang berlaku. Admin mengubahnya dengan alasan. Rentang yang diterima Rp 10 juta sampai Rp 10 miliar (ubah bila Anda punya alasan, dan tulis alasannya). |
| Bobot | Tiga bobot (popularitas, urgensi, pemerataan), bilangan bulat, jumlahnya tepat 100 (sudah dijaga `scoring_weights_jumlah_100`). Admin mengubahnya dengan alasan. |
| Pratinjau dampak | Wajib sebelum menyimpan pagu, bobot, dan perpindahan `forum → voting`. Admin melihat status setiap usulan sebelum dan sesudah, dan jumlah yang berubah. Tanpa pratinjau, tombol simpan tetap bisa dipakai, tetapi pratinjau tampil otomatis begitu nilainya valid. |
| Akun yang bisa dibuat dari UI | Hanya akun **warga**, dan wajib tertaut ke satu baris `warga` yang belum punya akun. Akun admin tetap dibuat lewat `npm run akun:buat`, supaya kebocoran sesi admin tidak bisa melahirkan admin baru. |
| Kata sandi awal | Dibuat acak oleh server (atau diketik admin, mengikuti `periksaKataSandiBaru`), ditampilkan **sekali** setelah akun dibuat, dengan arahan untuk menyerahkannya langsung ke warga. Tidak pernah disimpan dalam bentuk asli dan tidak pernah tampil lagi. |
| Ganti kata sandi sendiri | Semua pengguna bisa mengganti kata sandinya di `/akun`. Akun yang kata sandinya dibuat atau diatur ulang admin diminta menggantinya saat pertama masuk. |
| Menonaktifkan akun | Boleh untuk akun warga dan admin lain. Admin tidak bisa menonaktifkan dirinya sendiri, dan admin aktif terakhir tidak bisa dinonaktifkan. Menonaktifkan dan mengatur ulang kata sandi mencabut semua sesi akun itu (naikkan `versi_sesi`). |
| Privasi data akun | Nama lengkap dan nomor warga hanya tampil di halaman admin. Perubahan akun **tidak** ditulis ke jejak keputusan publik; catatannya masuk ke jejak admin tertutup (bagian 6). |
| Moderasi | Fungsi `sembunyikan` dari forum dipakai ulang. Tambahan baru: **tampilkan kembali** dengan alasan, tercatat sebagai `moderation` di jejak publik. |
| Data cadangan | Halaman admin **tidak pernah** memakai data cadangan. Kalau database tidak terjangkau, tampilkan galat yang jelas dan nonaktifkan semua aksi. Keputusan anggaran tidak boleh diambil dari data basi. |
| Aturan dukungan | Tidak diubah di fitur ini dan tidak diberi pengaturan di UI admin. Aturan "satu dukungan per usulan" masih sementara dan diputuskan terpisah oleh pemilik produk. |

---

## 3. Fakta kode yang harus dipakai, bukan dibuat ulang

- **Database:**
  - `lib/supabase-server.ts` adalah satu-satunya klien Supabase (server saja, service role). Jangan membuat klien baru, dan jangan memanggil Supabase dari browser.
  - `lib/data.ts`: `denganFallback`, `wajib`, `BATAS_WAKTU_MS`, `Hasil<T>`, `PAGU_DEFAULT`, `getRekomendasi`, `getBobotResmi`, `getWilayah`, `getLogTerbaru`, `JENIS_LOG`, `BarisLog`, `logDariDb`.
  - `PAGU_DEFAULT = 300_000_000` dipakai di `lib/beranda.ts`, `lib/forum-data.ts`, dan `app/api/health/route.ts`. Semuanya harus beralih ke pagu dari database. `PAGU_DEFAULT` tetap ada sebagai nilai data cadangan untuk halaman publik.
- **Pola mutasi forum (ikuti persis):**
  - `lib/forum-aksi.ts`: `KodeGalat`, `buatGalat`, `pesanGalat(kode, konteks)`, `uraiHasilRpc`, `panggilFungsi(nama, (sinyal) => ...)`. Tambahkan konteks dan kode galat admin di sini atau di modul saudara `lib/admin-aksi.ts`. Jangan menduplikasi mesinnya.
  - Fungsi SQL mengembalikan `jsonb` `{ok: true, ...}` atau galat lewat `galat_forum(kode, ulang_detik)` di `0004_forum.sql`. Fungsi baru memakai pola yang sama.
  - `app/forum/aksi.ts`: setiap aksi memeriksa sesi dan peran sendiri, memvalidasi ulang, memanggil fungsi SQL, lalu `segarkan()` yang memanggil `updateTag`. Konstanta tidak boleh diekspor dari file `"use server"` (pakai `lib/forum-status.ts` sebagai contoh).
  - `lib/tag-cache.ts`: `TAG = { beranda, forum, usulan(id) }`. Tambahkan tag untuk pengaturan (pagu dan bobot) bila perlu.
- **Autentikasi:**
  - `lib/auth.ts`: `ambilPengguna()` (akun dicek di database: masih ada, aktif, `versi_sesi` cocok), `ambilPenggunaUntukBaca()`, `wajibMasuk()`, `wajibPeran("admin")`.
  - `wajibPeran` mengalihkan peran lain ke `/akun`. Untuk `/admin`, tampilkan halaman "khusus admin desa" sebagai gantinya. `forbidden()` di Next ini masih **eksperimental** (butuh `experimental.authInterrupts`); jangan dipakai kecuali Anda bisa menjelaskan kenapa risikonya layak. Cukup render komponen penolakan dari server component setelah memeriksa peran.
  - Di Server Action, jangan `redirect` diam-diam; kembalikan galat `belum_masuk` atau `bukan_admin` yang bisa ditampilkan.
  - `proxy.ts`: tambahkan `/admin` ke `DILINDUNGI` dan ke `matcher`. Proxy hanya mengalihkan GET/HEAD; jangan ubah perilaku itu (alasannya ada di komentar proxy).
  - `lib/akun.ts`: `cariAkunById`, `gantiHashKataSandi`. `lib/kata-sandi.ts`: `hashKataSandi`, `periksaKataSandiBaru`, `PANJANG_MIN`, `PANJANG_MAKS`. Hash dibuat di server Node, lalu diteruskan ke fungsi SQL.
  - `scripts/buat-akun.ts` sudah menangani kata sandi tersembunyi dan penautan `warga_id`. UI admin melakukan hal yang sama, dengan aturan yang sama.
- **Seleksi dan Garis Pagu:**
  - `lib/seleksi.ts`: `pilihOptimal`, `greedyPilih`, `statusUsulan`, `BATAS_USULAN_OPTIMAL`, tipe `Usulan`, `Wilayah`, `Bobot`. Ini kembaran TypeScript dari `pilih_optimal`/`rekomendasi_resmi` di SQL. `lib/pagu-model.test.ts` mengujinya dengan data cadangan, **belum** dibandingkan langsung dengan SQL; tes kesetaraan di bagian 9 menutup celah itu. **Pratinjau dampak dihitung dengan fungsi ini**, bukan rumus baru.
  - `lib/pagu.ts`, `lib/pagu-model.ts` (`susunModePagu`), dan komponen `components/landing/PaguBar.tsx` (dipakai `GarisPagu.tsx`): batang anggaran. Pakai ulang untuk pratinjau sebelum dan sesudah.
  - `supabase/tests/pglite.ts` sudah punya pembantu yang mengubah hasil `rekomendasi_resmi` menjadi teks stabil untuk dibandingkan.
- **Format dan validasi:** `lib/format.ts` (`rupiah`, `rupiahRinci`, `ribuan`, `desimal`), `lib/rupiah.ts` (`parseRupiah` untuk masukan pagu yang toleran), `lib/usulan-skema.ts` (`BATAS`, `periksaAlasan`, `adalahUuid`, `rapikanTeks`, `panjang`), `lib/waktu.ts` (`waktuRelatif`, `tanggalPanjang`, `tanggalDanJam`).
- **Komponen:**
  - `components/ui/StatusLabel.tsx` (status seleksi) dan `components/ui/StatusSiklus.tsx` (status siklus).
  - `components/forum/DialogSembunyikan.tsx`: pola `<dialog>` modal dengan fokus dan alasan wajib. Dialog konfirmasi admin dibangun dari pola yang sama, idealnya diekstrak menjadi satu komponen dialog alasan yang dipakai forum dan admin.
  - `components/forum/RiwayatUsulan.tsx`: tampilan riwayat dari `accountability_logs`.
  - `components/shell/SiteHeader`, `NavUtama` (`aria-current`), `AksiAkun` (tombol nama pengguna).
  - Kelas global `.wadah`, `.bagian`, `.tombol`, `.tombol-utama`, `.tombol-kedua` di `app/globals.css`.
- **Skema:**
  - `scoring_weights` (satu baris, `id = 1`): `w_popularitas`, `w_urgensi`, `w_pemerataan`, `catatan`, `updated_at`. Trigger `trg_log_perubahan_bobot` (versi terakhir di `0002`) menulis `weight_change` dengan `actor = 'admin'` tertanam dan `message = catatan`. Fungsi baru Anda harus menghasilkan log dengan alasan admin dan nama pengguna admin yang sebenarnya (misalnya dengan `set_config` lokal yang dibaca trigger, atau dengan memindahkan pencatatan ke dalam fungsi; pilih satu dan jelaskan).
  - `accountability_logs.log_type`: `weight_change`, `status_change`, `selection`, `note`, `moderation`. Pagu awal di `seed.sql` dicatat sebagai `note` dengan `detail.pagu`. Kalau Anda menambah jenis log (misalnya `budget_change`), perbarui `JENIS_LOG` di `lib/data.ts` dan `JENIS` di `components/landing/JejakKeputusan.tsx`, karena keduanya bertipe `Record<JenisLog, string>`.
  - `proposals`: `status`, `urgency_score` (nullable selama `forum`, wajib di luar `forum`: `proposals_urgensi_wajib_setelah_forum`), `urgency_reason`, `nama_singkat`, `disembunyikan_pada`, `alasan_disembunyikan`. `komentar` punya kolom moderasi yang sama.
  - `akun`: `nama_pengguna` (`^[a-z0-9._-]{3,32}$`), `hash_kata_sandi` (`$scrypt$...`), `peran`, `warga_id`, `aktif`, `versi_sesi`. `warga`: `nomor`, `nama`, `rt`, `rw`.
  - Status `rejected` sudah ada di `proposals`. `StatusSiklus` menampilkannya sebagai "Ditolak"; untuk usulan forum yang tidak dilanjutkan, teksnya boleh "Tidak dilanjutkan" tanpa status baru.
- **Tipe database:** `lib/database.types.ts` diperbarui manual. Tambahkan semua objek baru ke sana.
- **Tes:** `npm test` (node:test, TypeScript native, strip-only: tanpa *parameter property*, impor `.ts` eksplisit). Tes SQL ada di `supabase/tests/` dengan harness PGlite `supabase/tests/pglite.ts` dan baseline `baseline-rekomendasi.json`. E2E ada di `e2e/` dengan server tiruan PostgREST `e2e/supabase-palsu.ts` di atas PGlite; perluas tiruan itu bila fungsi baru membutuhkannya.
- **Batasan menjalankan SQL:** semua SQL dijalankan **oleh pemilik proyek** di SQL editor Supabase. Anda tidak boleh menjalankan migrasi ke database mereka. Uji SQL di PGlite dan beri urutan langkah yang jelas.

---

## 4. Masalah yang sudah diketahui dan harus diselesaikan

1. **Pagu tertanam di kode.** Pindahkan ke tabel pengaturan satu baris (misalnya `pengaturan_anggaran` dengan `pagu`, `diubah_pada`, `versi`). Migrasi mengisinya dengan 300.000.000, sehingga angka halaman utama tidak berubah. Beranda, forum (`petaPosisi` di `lib/forum-data.ts`), dan `/api/health` membaca pagu dari sana, dengan `PAGU_DEFAULT` sebagai cadangan publik.
2. **Log bobot tidak jujur soal pelakunya.** Trigger menulis `actor = 'admin'` dan memakai `catatan` sebagai pesan. Setelah fitur ini, log harus memuat nama pengguna admin dan alasan yang ia tulis.
3. **Batas 16 usulan `voting`.** `pilih_optimal` dan `pilihOptimal` menolak lebih dari 16 usulan (`RangeError` di TypeScript). Fungsi pemindahan status harus menolak usulan ke-17 di database, dan UI harus menjelaskannya sebelum admin menekan tombol.
4. **Cache.** Halaman utama dan forum memakai `'use cache'`. Setiap aksi admin yang mengubah angka publik harus memanggil `updateTag` untuk `beranda`, `forum`, `usulan(id)` yang terdampak, dan tag pengaturan, supaya admin langsung melihat hasilnya di halaman publik. Halaman admin sendiri **tidak boleh** memakai `'use cache'` untuk data pribadi (akun, nama lengkap, nomor warga); pakai `await connection()` dan baca langsung.
5. **Jangan mengubah angka halaman utama karena migrasi.** Jalankan ulang tes `lib/pagu.test.ts`, `lib/seleksi.test.ts`, `lib/pagu-model.test.ts`, dan bandingkan `rekomendasi_resmi(300000000)` dengan `supabase/tests/baseline-rekomendasi.json` setelah migrasi 0005 dijalankan di PGlite.
6. **Admin bersamaan.** Dua admin bisa membuka formulir bobot atau pagu yang sama. Fungsi simpan menerima versi yang dibaca admin (`updated_at` atau kolom `versi`) dan menolak bila sudah berubah, dengan pesan "Bobot sudah diubah admin lain pada [jam]. Muat ulang untuk melihat nilai terbaru." Hal yang sama untuk perpindahan status (status yang dibaca harus masih sama).

---

## 5. Pratinjau dampak: inti inovasi halaman admin

Inilah pembeda admin SUARA dari panel admin biasa: **admin melihat akibat keputusannya pada anggaran sebelum keputusan itu berlaku**, sama seperti warga melihat posisi anggaran di forum.

**Kapan tampil:**

- Saat admin mengubah pagu atau bobot, begitu nilai yang diketik valid.
- Saat admin akan memindahkan usulan `forum → voting` (dengan urgensi yang sedang diisi) atau `voting → forum`.

**Isinya:**

- Dua batang Garis Pagu kecil, "Sekarang" dan "Sesudah disimpan", memakai komponen batang yang sama dengan halaman utama. Di ponsel, ditumpuk; di layar lebar, berdampingan atau ditumpuk dengan label yang jelas.
- Daftar usulan yang **berubah status** di atas, dengan kalimat yang bisa dibaca warga: *"Talud penahan longsor RW 07: Ditunda → Terbiayai"*, memakai `StatusLabel` sebelum dan sesudah. Usulan yang tidak berubah dilipat di bawah ("5 usulan tidak berubah").
- Ringkasan satu baris: *"2 usulan berubah status. Sisa pagu Rp 12 jt → Rp 40 jt."*
- Bila tidak ada yang berubah, katakan begitu dengan jelas: *"Tidak ada usulan yang berubah status."*
- Untuk perpindahan ke `voting`: *"Jika dimasukkan dengan urgensi 8, usulan ini berada di peringkat 3 dari 8 rekomendasi: Terbiayai. Lampu PJU RW 07 bergeser menjadi Ditunda."*

**Cara menghitung:**

- Di server, dengan `pilihOptimal` dari `lib/seleksi.ts` dan data yang sama dengan `rekomendasi_resmi` (usulan `voting` yang tidak disembunyikan, wilayah, bobot, pagu). Logika pembandingnya (sebelum vs sesudah, daftar yang berubah) adalah fungsi murni di `lib/` dengan tes unit.
- Pratinjau dipanggil lewat Server Action saat nilai berubah, dengan *debounce* sekitar 300 ms, dan hanya menampilkan hasil permintaan terakhir. Kalau pratinjau gagal atau lambat, formulir tetap bisa disimpan; tampilkan "Pratinjau belum bisa dihitung" tanpa memblokir.
- **Satu sumber kebenaran:** setelah disimpan, hasil di halaman utama harus sama dengan pratinjau. Buat tes yang membuktikannya: pratinjau TypeScript untuk bobot X sama dengan `rekomendasi_resmi` di PGlite setelah bobot X disimpan.

Pratinjau ini dirancang sebagai komponen yang bisa dipakai ulang oleh halaman `/simulasi` nanti (warga bermain dengan pagu dan bobot tanpa menyimpan). Jangan bangun `/simulasi`, tetapi jangan mengikat komponennya ke halaman admin.

---

## 6. Model data (migrasi `0005_admin.sql`)

Rancang sendiri detailnya, dengan syarat minimum berikut. Jalankan setelah `0004_forum.sql` dan `seed_forum.sql`. Tidak butuh seed baru, kecuali Anda perlu data demo tambahan yang tidak menyentuh tujuh usulan `voting`.

- **Pengaturan anggaran:** tabel satu baris (`check (id = 1)`) berisi `pagu bigint`, `versi integer` atau `updated_at`, dengan batas rentang di `check`. Diisi 300.000.000 oleh migrasi.
- **Kolom akun:** `harus_ganti_sandi boolean not null default false`, `dibuat_oleh uuid references akun (id)`. Indeks unik parsial `akun (warga_id) where warga_id is not null`, supaya satu warga paling banyak punya satu akun. Periksa dulu bahwa data yang ada tidak melanggarnya.
- **Jejak admin tertutup:** tabel `jejak_admin` (`id`, `akun_id` admin, `aksi`, `sasaran_akun_id`, `detail jsonb`, `created_at`) untuk perubahan akun. Tidak pernah dibaca halaman publik. Tidak menyimpan kata sandi atau hash.
- **Fungsi database atomik** (semuanya lewat `rpc`, `revoke execute ... from public, anon, authenticated`, `set search_path = public, extensions`, mengembalikan `jsonb`, dan memeriksa sendiri bahwa `p_akun` adalah admin aktif):
  - `pindahkan_status(p_akun, p_proposal, p_ke, p_status_dibaca, p_urgensi, p_alasan_urgensi, p_nama_singkat, p_alasan)`. Memeriksa transisi yang diizinkan (bagian 2), status yang dibaca masih sama, usulan tidak disembunyikan, batas 16 `voting`, urgensi dan alasannya untuk `voting`, lalu menulis `status_change` dengan `detail {dari, ke, urgensi?, alasan}` dan `actor` = nama pengguna admin. Untuk `voting → forum`, urgensi dikosongkan atau dipertahankan (pilih, lalu jelaskan).
  - `ubah_pagu(p_akun, p_pagu, p_versi_dibaca, p_alasan)`: menulis log pagu (`note` dengan `detail {pagu_lama, pagu_baru}` atau jenis log baru).
  - `ubah_bobot(p_akun, p_popularitas, p_urgensi, p_pemerataan, p_versi_dibaca, p_alasan)`: menghasilkan `weight_change` yang jujur (bagian 4 nomor 2).
  - `buat_akun_warga(p_akun, p_nama_pengguna, p_hash, p_warga)`: warga ada, belum punya akun, nama pengguna belum dipakai. Mengatur `harus_ganti_sandi = true`. Menulis `jejak_admin`.
  - `atur_ulang_sandi(p_akun, p_sasaran, p_hash)`, `atur_aktif(p_akun, p_sasaran, p_aktif)`: menaikkan `versi_sesi`, menolak menonaktifkan diri sendiri dan admin aktif terakhir, menulis `jejak_admin`.
  - `ganti_sandi_sendiri(p_akun, p_hash)`: dipanggil dari `/akun` setelah kata sandi lama diverifikasi di server; mematikan `harus_ganti_sandi` dan menaikkan `versi_sesi` (sesi saat ini diterbitkan ulang).
  - `tampilkan_kembali(p_akun, p_jenis, p_id, p_alasan)`: kebalikan `sembunyikan`, alasan wajib, menulis `moderation` dengan `detail {jenis, id, alasan, aksi: 'tampilkan'}`.
- **Batas laju** tidak wajib untuk admin (sudah dilindungi penguncian login), tetapi pembuatan akun dibatasi wajar, misalnya 30 per jam per admin, supaya sesi admin yang bocor tidak bisa membuat akun massal. Tulis alasannya.
- **View untuk admin:** `v_admin_usulan` (semua status, termasuk yang disembunyikan, dengan jumlah dukungan, komentar, umur, dan RW) dan `v_admin_akun` (akun dengan nama lengkap, nomor, RT/RW warga yang tertaut). Hanya dibaca server dari halaman admin.
- **RLS** tetap aktif di semua tabel baru, tanpa policy.
- **Header file SQL** berisi urutan menjalankan dan apa yang diubahnya, seperti file migrasi lain.

---

## 7. Layar dan perilaku

Semua layar ditujukan untuk ponsel lebih dulu (360 px), lalu diperluas ke 768 px dan 1440 px. Perangkat desa sering memakai laptop di kantor desa, tetapi juga ponsel saat di lapangan; keduanya harus nyaman. Semua halaman admin `robots: { index: false }` dan judul halaman diawali "Admin · ".

### Arah desain

- **Perluasan "Papan Pengumuman Desa".** Kalau halaman publik adalah papan pengumuman, halaman admin adalah **buku register di meja perangkat desa**: baris bergaris, kolom angka rata, setiap entri punya tanggal dan alasan. Datar, tanpa bayangan, tanpa kartu bersarang, tanpa gradasi, tanpa grafik hiasan. Kerapian dari garis (6/3/2/1 px) dan jarak.
- **Tidak ada warna atau huruf baru.** Satu pengecualian yang sudah direncanakan `DESIGN.md`: jadikan warna galat token (`--galat-tepi`, `--galat-teks`, `--galat-latar`) di `globals.css`, lalu pakai juga untuk aksi berisiko (nonaktifkan akun). Perbarui forum dan formulir masuk agar memakai token yang sama.
- **Penanda mode admin** yang tenang dan selalu terlihat: misalnya pita tipis di bawah header berisi "Mode admin desa · masuk sebagai *admin*" dengan cap biru perisai yang sama dengan label "Admin desa" di forum. Admin harus selalu tahu bahwa aksinya berdampak publik.
- **Angka adalah isi utama.** Barlow Condensed untuk angka besar (pagu, jumlah), angka tabular di tabel, semua lewat `lib/format.ts`.
- **Setiap aksi yang berdampak publik** diakhiri kalimat konfirmasi yang menyebut di mana jejaknya bisa dilihat, dengan tautan ke halaman publik yang terdampak: *"Tersimpan. Jejaknya tampil di halaman utama dan di riwayat usulan."*
- Hindari gaya dasbor SaaS generik: tanpa *sidebar* gelap, tanpa kartu metrik berwarna-warni, tanpa ikon di setiap judul, tanpa eyebrow. Jakob's Law tetap berlaku: tabel, tab, dan dialog harus berperilaku seperti yang orang harapkan.

### Navigasi admin

- Tautan "Admin" muncul di header hanya untuk admin (di `AksiAkun` atau di sebelahnya), di dalam `Suspense`, supaya header tetap bisa di-render statis.
- Di dalam `/admin`, navigasi bagian: **Ringkasan**, **Usulan**, **Anggaran**, **Akun**, **Moderasi**, dengan `aria-current="page"` dan garis bawah 3 px seperti navigasi utama. Di ponsel, tetap satu baris yang bisa digeser atau dibungkus ke dua baris; jangan disembunyikan di menu hamburger.
- Setiap bagian adalah rute sendiri (`/admin`, `/admin/usulan`, `/admin/anggaran`, `/admin/akun`, `/admin/moderasi`), supaya tombol kembali dan tautan berbagi berfungsi.

### `/admin`: Ringkasan

Bukan dasbor metrik, melainkan **daftar pekerjaan yang menunggu**, diurutkan dari yang paling mendesak:

- Usulan forum yang menunggu ditinjau (jumlah dan tiga yang paling lama menunggu, dengan umur "menunggu 12 hari").
- Usulan `voting`: "8 dari maksimal 16", dan status pagu saat ini (terbiayai, ditunda, sisa pagu), dengan tautan ke Anggaran.
- Akun warga yang dibuat admin tetapi belum pernah mengganti kata sandi.
- Komentar 24 jam terakhir (jumlah) dan konten tersembunyi (jumlah), dengan tautan ke Moderasi.
- Lima entri jejak keputusan terbaru, dengan tautan ke halaman utama.

Bila tidak ada pekerjaan menunggu, katakan begitu dengan jelas dan tenang. Jangan mengarang metrik yang tidak ada datanya.

### `/admin/usulan`: tinjau dan pindahkan status

- **Daftar** semua usulan dengan filter status (Menunggu ditinjau = `forum`, Masuk hitungan anggaran = `voting`, Tidak dilanjutkan, Disembunyikan, Semua), RW, dan kategori, serta pencarian judul. State di URL. Urutan bawaan: yang paling lama menunggu di atas.
- **Tiap baris:** judul (tautan ke detail forum), RW, kategori, biaya (`rupiah`), dukungan dan dukungan per 1.000 penduduk, jumlah komentar, umur, `StatusSiklus`, dan untuk `voting` baris posisi anggaran yang sama dengan forum.
- **Di layar lebar**, daftar berupa tabel (`<table>` asli dengan `<caption>`, `<th scope>`, dan kolom angka rata kanan). **Di ponsel**, setiap baris menjadi blok bertumpuk berlabel; jangan memaksa tabel lebar dengan gulir horizontal.
- **Aksi per usulan** membuka panel tinjau (halaman `/admin/usulan/[id]` atau dialog; pilih yang paling nyaman di ponsel dan jelaskan):
  - Ringkasan usulan: deskripsi lengkap, pengusul (nama depan dan RW), biaya, dukungan, komentar terbaru, dan **usulan serupa** dari deteksi mirip forum (`lib/forum-mirip.ts`), supaya admin bisa melihat duplikat sebelum memasukkannya ke hitungan anggaran.
  - **"Masukkan ke hitungan anggaran"**: kolom urgensi 1 sampai 10 (pilihan bertombol atau `<input type="range">` dengan angka terlihat dan bisa diketik), rubrik singkat di sebelahnya (misalnya 1–3 "bisa menunggu periode berikutnya", 4–6 "mengganggu kegiatan sehari-hari", 7–8 "merugikan banyak warga bila ditunda", 9–10 "menyangkut keselamatan"), alasan urgensi (wajib, minimal 20 karakter, dengan penghitung), nama singkat untuk label batang (terisi dari usulan, bisa diubah), dan **pratinjau dampak** (bagian 5).
  - Tempat untuk saran urgensi AI nanti: satu baris di atas kolom urgensi yang saat ini **tidak dirender sama sekali**. Strukturkan komponennya supaya baris itu bisa ditambahkan tanpa mengubah tata letak. Jangan tampilkan label "AI" atau teks "segera hadir".
  - **"Tidak dilanjutkan"** dan **"Kembalikan ke pembahasan"**: dialog dengan alasan wajib, menyebutkan akibatnya ("Usulan tetap bisa dibaca warga dan alasannya tampil di riwayat usulan").
  - Setelah berhasil: kembali ke daftar dengan pesan konfirmasi yang diumumkan (`aria-live="polite"`), fokus ke pesan itu, dan baris yang berubah ditandai singkat.

### `/admin/anggaran`: pagu dan bobot

- Dua bagian di satu halaman, masing-masing formulir sendiri dengan tombol simpan sendiri.
- **Pagu:** nilai saat ini (besar, Barlow), kolom masukan rupiah toleran (`parseRupiah`, pratinjau `rupiah()` di bawah kolom), alasan wajib, pratinjau dampak.
- **Bobot:** tiga kolom angka bulat dengan label yang dijelaskan dalam bahasa warga (popularitas = "dukungan per 1.000 penduduk RW", urgensi = "seberapa mendesak, dinilai admin dengan alasan", pemerataan = "RW yang periode lalu mendapat sedikit anggaran didahulukan"). Penunjuk jumlah yang selalu terlihat dan diumumkan: *"Jumlah 100. Siap disimpan."* atau *"Jumlah 95. Kurang 5."* Jangan menyeimbangkan otomatis kolom lain tanpa izin; boleh ada tombol "Seimbangkan sisa ke urgensi" bila Anda menilai berguna.
- Alasan wajib, pratinjau dampak, dan riwayat perubahan pagu serta bobot (dari jejak keputusan) di bawah formulir.
- Masukan tidak hilang saat galat. Galat bentrok versi (bagian 4 nomor 6) menampilkan nilai terbaru di samping nilai yang diketik admin.

### `/admin/akun`: akun warga

- **Daftar akun** dengan pencarian (nama pengguna, nama warga, nomor warga), filter peran, aktif atau nonaktif, dan "belum mengganti kata sandi". Paginasi 25 per halaman, state di URL. Tiap baris: nama pengguna, peran, warga tertaut (nama lengkap, nomor, RT/RW) atau "Belum tertaut", aktif, dan tanggal dibuat.
- **"Buat akun warga"** (formulir bertahap pendek):
  1. Pilih warga: cari berdasarkan nama atau nomor; hanya warga yang belum punya akun yang bisa dipilih. Tampilkan nama, nomor, RT/RW supaya tidak salah orang. Kombobox harus mengikuti pola ARIA *combobox* yang benar, atau gunakan daftar hasil pencarian biasa dengan tombol "Pilih" bila itu lebih andal.
  2. Nama pengguna: saran otomatis dari nama warga (huruf kecil, tanpa spasi), bisa diubah, divalidasi dengan pola yang sama dengan database, dan dicek ketersediaannya.
  3. Kata sandi awal: bawaannya dibuat acak oleh server (mudah dibacakan, tanpa karakter yang mirip seperti `l`/`1`/`O`/`0`), atau diketik admin.
  4. Hasil: satu layar yang menampilkan nama pengguna dan kata sandi **sekali**, tombol salin, dan petunjuk "Serahkan langsung ke warga. Kata sandi ini tidak akan tampil lagi. Warga diminta menggantinya saat pertama masuk." Kata sandi tidak boleh masuk URL, `sessionStorage`, log server, atau cache.
- **Aksi per akun:** "Atur ulang kata sandi" (hasilnya tampil sekali seperti di atas), "Nonaktifkan" / "Aktifkan kembali". Keduanya lewat dialog yang menyebut akibatnya ("Warga ini akan keluar dari semua perangkat dan tidak bisa masuk sampai diaktifkan kembali"). Aksi yang dilarang (menonaktifkan diri sendiri, admin terakhir) tidak ditampilkan, dengan keterangan singkat kenapa.
- **Jejak admin** per akun (siapa membuat, siapa mengatur ulang, kapan), hanya terlihat di sini.

### `/admin/moderasi`

- **Komentar terbaru** (semua usulan, terbaru di atas) dengan aksi "Sembunyikan" yang memakai dialog forum.
- **Konten tersembunyi** (usulan dan komentar) dengan tanggal, alasan, admin yang menyembunyikan, dan aksi "Tampilkan kembali" (dialog, alasan wajib).
- Isi konten yang disembunyikan boleh terlihat oleh admin di sini (diberi tanda jelas "Tidak terlihat publik"), karena admin perlu menilainya ulang.

### `/akun`: ganti kata sandi (untuk semua peran)

- Formulir: kata sandi lama, kata sandi baru, ulangi kata sandi baru, dengan tombol tampilkan/sembunyikan dan aturan dari `periksaKataSandiBaru` yang ditampilkan sebelum mengetik, bukan hanya saat galat. `autocomplete="current-password"` dan `"new-password"`.
- Akun dengan `harus_ganti_sandi` diarahkan ke formulir ini setelah masuk, dengan penjelasan singkat. Mereka tetap bisa keluar.
- Setelah berhasil, sesi diterbitkan ulang (sesi lain dicabut) dan pesan konfirmasi tampil.

### Keadaan yang wajib dirancang

| Keadaan | Perilaku |
|---|---|
| Bukan admin atau belum masuk | Belum masuk: proxy mengalihkan ke `/masuk?lanjut=/admin...`. Sudah masuk sebagai warga: halaman "Halaman ini khusus admin desa" dengan tautan ke forum. |
| Database tidak bisa dijangkau | Galat yang jelas, tanpa data cadangan, semua aksi nonaktif, tombol "Coba lagi". |
| Memuat | Kerangka sesuai ukuran asli, tanpa CLS. |
| Kosong (filter tanpa hasil, tidak ada usulan menunggu) | Pesan jelas dan tautan untuk menghapus filter atau kembali ke ringkasan. |
| Galat validasi | Di dekat kolomnya, plus ringkasan galat di atas formulir (`role="alert"`) yang menaut ke kolom. Masukan tidak hilang. |
| Bentrok versi (admin lain mengubah lebih dulu) | Pesan dengan jam perubahan dan nilai terbaru; tidak menimpa diam-diam. |
| Batas 16 usulan `voting` | Tombol "Masukkan ke hitungan anggaran" diganti penjelasan dan tautan ke daftar usulan `voting`. |
| Sesi habis saat menyimpan | Galat `belum_masuk` dengan tautan masuk yang kembali ke halaman yang sama; isian formulir panjang (alasan) tidak hilang. |
| Pratinjau gagal atau lambat | "Pratinjau belum bisa dihitung"; simpan tetap bisa. |
| Usulan atau akun tidak ditemukan | `notFound()` dengan halaman 404 yang membantu. |

---

## 8. Keamanan (wajib)

- **Semua mutasi lewat Server Action**, dan setiap aksi:
  - memanggil `ambilPengguna()` lalu memastikan peran `admin` dan akun aktif; jangan percaya `akun_id`, peran, atau `warga_id` dari formulir;
  - memvalidasi ulang semua masukan di server (panjang, pola, enum, rentang, UUID);
  - meneruskan id admin dari sesi ke fungsi SQL, yang memeriksa lagi bahwa akun itu admin aktif (pertahanan berlapis).
- **Halaman admin** memeriksa peran di server component (bukan hanya di proxy) dan tidak pernah di-cache lintas pengguna.
- **Kata sandi:** di-hash di server dengan `hashKataSandi`; kata sandi asli tidak pernah dikirim ke database, ditulis ke log, atau disimpan di klien. Kata sandi yang dibuat server ditampilkan sekali di respons aksi, bukan di URL.
- **Data pribadi** (nama lengkap, nomor warga) hanya ada di respons halaman admin. Jejak keputusan publik tidak pernah memuat data akun.
- **XSS:** teks pengguna dirender sebagai teks React saja. Tidak ada `dangerouslySetInnerHTML`.
- **CSRF:** cukup pemeriksaan Origin bawaan Server Actions. Jangan membuat `route.ts` untuk mutasi.
- **Pesan galat:** galat database di-log di server tanpa data pribadi atau kata sandi; pengguna mendapat pesan Indonesia yang bisa ditindaklanjuti.

---

## 9. Standar mutu

- **Build dan tipe:** `npm run build`, `npm run lint`, `npx tsc --noEmit`, dan `npm test` bersih.
- **Aksesibilitas:** WCAG 2.2 AA dengan axe tanpa pelanggaran di semua halaman `/admin/*` dan `/akun`, di 360 px dan 1440 px, termasuk saat dialog terbuka, saat galat, saat pratinjau tampil, dan di setiap langkah "Buat akun warga".
  - Semua bisa dipakai dengan keyboard, termasuk tabel, kombobox atau pencarian warga, dan kolom urgensi.
  - Target sentuh minimal 24 px, idealnya 44 px.
  - Hasil aksi dan perubahan pratinjau diumumkan secara sopan (`aria-live="polite"`, dibatasi frekuensinya supaya pembaca layar tidak dibanjiri saat mengetik).
  - Tabel memakai `<caption>` dan `<th scope>`; status selalu ikon + teks.
  - Dialog: `<dialog>` asli, fokus awal ke kolom alasan, fokus kembali ke tombol asal saat ditutup.
- **Kinerja:** halaman admin tidak diindeks, jadi Lighthouse cukup untuk aksesibilitas (≥ 95) dan best practices (≥ 95) di `/admin` dan `/admin/anggaran`, dengan CLS di bawah 0,1. Halaman publik (`/`, `/forum`) tetap memenuhi target lama setelah perubahan pagu ke database: performa ≥ 90.
- **Gerak:** hanya sebagai jawaban atas aksi (baris yang berubah ditandai singkat, angka pratinjau berganti). Semuanya hormat pada `prefers-reduced-motion`.
- **Kode:**
  - Logika murni (pembanding pratinjau sebelum/sesudah, validasi bobot dan pagu, transisi status yang diizinkan, saran nama pengguna, pembuat kata sandi acak yang mudah dibacakan) dipisah ke `lib/` dan diberi tes unit.
  - Komponen klien sekecil mungkin; sisanya Server Component.
  - Nama dalam bahasa Indonesia, mengikuti gaya kode yang ada.

### Tes yang wajib ada

- **Unit:** semua fungsi murni baru.
- **SQL di PGlite:** migrasi 0001 sampai 0005, ditambah `seed.sql` dan `seed_forum.sql`.
  - Setiap fungsi baru menolak akun bukan admin, admin nonaktif, dan `anon` tidak punya hak `execute`.
  - Transisi yang tidak diizinkan ditolak; `forum → voting` tanpa urgensi atau alasan ditolak; usulan ke-17 ditolak; status yang dibaca sudah berubah ditolak.
  - Setiap aksi publik menulis log dengan jenis, `actor`, dan `detail` yang benar; aksi akun menulis `jejak_admin` dan tidak menulis `accountability_logs`.
  - Bobot yang jumlahnya bukan 100 ditolak; bentrok versi ditolak.
  - Satu warga tidak bisa punya dua akun; admin tidak bisa menonaktifkan diri sendiri atau admin terakhir; menonaktifkan dan mengatur ulang menaikkan `versi_sesi`.
  - `tampilkan_kembali` membalik `sembunyikan` dan mencatat log.
  - **`rekomendasi_resmi(300000000)` setelah migrasi 0005 sama persis dengan baseline.**
  - **Pratinjau TypeScript sama dengan `rekomendasi_resmi` setelah perubahan disimpan**, untuk minimal tiga kombinasi bobot dan pagu.
- **E2E Playwright** (pakai `e2e/` dan server tiruan yang ada): admin masuk → ringkasan → memasukkan usulan forum ke hitungan anggaran dengan urgensi dan melihat pratinjau → halaman utama dan forum langsung menampilkan usulan itu di Garis Pagu → mengubah bobot dengan pratinjau → membuat akun warga → masuk sebagai warga baru, diminta mengganti kata sandi, lalu bisa mendukung usulan → admin menonaktifkan akun itu dan sesi warga langsung tidak berlaku → menampilkan kembali komentar yang disembunyikan. Juga: warga yang membuka `/admin` mendapat halaman "khusus admin desa". Konsol browser bersih di setiap tes.

---

## 10. Dokumentasi (wajib, ikut dinilai)

1. **`README.md`:** tambahkan bagian Admin desa (apa yang bisa dilakukan, cara mencoba dengan akun demo, urutan demo yang disarankan untuk juri), perbarui tabel Fitur, urutan menjalankan SQL (0005), perintah cek hasil dengan angka yang diharapkan, jumlah tes, dan struktur folder.
2. **`docs/admin.md`:**
   - Hak admin dan batasannya (kenapa admin tidak membuat admin lain dari UI, kenapa tidak bisa menonaktifkan diri sendiri).
   - Siklus status lengkap dengan transisi yang diizinkan di fitur ini dan yang menunggu fitur Keputusan (diagram Mermaid).
   - Rubrik urgensi dan alasannya.
   - Cara kerja pratinjau dampak dan bukti bahwa hasilnya sama dengan `rekomendasi_resmi`.
   - Apa yang masuk jejak keputusan publik dan apa yang masuk jejak admin tertutup, beserta alasannya.
   - Penanganan admin bersamaan (versi) dan batas 16 usulan.
   - Keterbatasan dan pekerjaan berikutnya (penetapan keputusan musyawarah, saran urgensi AI, data wilayah, jatah dukungan).
3. **`DESIGN.md`:** komponen admin baru (penanda mode admin, tabel register, pratinjau dampak, penunjuk jumlah bobot, layar kata sandi sekali tampil, dialog alasan bersama) dan token galat yang baru.
4. **`PRODUCT.md`:** perbarui "Sudah ada" dan "Belum ada".
5. **Kode:** komentar singkat hanya untuk alasan yang tidak terlihat dari kodenya (mengapa versi, mengapa batas 16, mengapa akun admin tidak dibuat dari UI). Header di file SQL.
6. **Langkah untuk pemilik proyek:** daftar bernomor berisi SQL yang harus dijalankan di Supabase secara berurutan, ditambah perintah cek hasil dengan angka yang diharapkan (misalnya pagu 300.000.000, `rekomendasi_resmi(300000000)` tetap 4 terpilih).

---

## 11. Proses dan laporan akhir

**Proses:**

1. Rencana singkat: data, layar, dan urutan pengerjaan.
2. Migrasi 0005 beserta tes PGlite (termasuk baseline).
3. Lapisan data, logika pratinjau, dan Server Actions beserta tes.
4. Pindahkan pagu ke database di beranda, forum, dan health; pastikan angka halaman utama tetap sama.
5. UI admin dan formulir ganti kata sandi.
6. Satu putaran verifikasi berisi tangkapan layar 360, 768, dan 1440 px, `impeccable detect`, critique, dan audit aksesibilitas.
7. Satu putaran perbaikan.
8. Satu putaran konfirmasi, lalu berhenti memoles.

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

- Penetapan hasil musyawarah (`voting → approved/rejected`, `approved → done`) dan konsep periode anggaran: bagian fitur Keputusan.
- Halaman `/simulasi` dan `/keputusan` (komponen pratinjau dampak boleh dirancang agar bisa dipakai ulang nanti).
- Penilaian atau saran urgensi oleh AI (sisakan tempatnya saja, tanpa label).
- Mengubah data wilayah (penduduk, anggaran periode lalu).
- Pengaturan aturan atau jatah dukungan.
- Membuat akun admin dari UI, pendaftaran mandiri, impor warga massal (CSV), ekspor laporan, notifikasi, dan multi-desa.
