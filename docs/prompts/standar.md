# Standar bersama untuk prompt fitur SUARA

> Berkas ini adalah **bagian dari setiap prompt** di folder ini (`simulasi.md`, `keputusan.md`, `saran-urgensi.md`).
> Agen membacanya utuh sebelum menulis kode. Bila prompt fitur bertentangan dengan berkas ini, prompt fitur yang menang.

## Cara memakai (untuk pemilik proyek)

Satu fitur, satu percakapan baru. Buka percakapan baru di folder repo, lalu ketik satu baris:

```
Kerjakan seluruh isi docs/prompts/simulasi.md. Baca docs/prompts/standar.md lebih dulu; itu bagian dari brief.
```

Urutan yang disarankan: **simulasi → keputusan → saran-urgensi**. Alasannya:

1. Tombol utama beranda ("Coba simulasi anggaran") saat ini mengarah ke halaman kosong, jadi Simulasi menutup lubang yang paling terlihat.
2. Simulasi tidak butuh migrasi, jadi risikonya paling kecil, dan ia mengekstrak komponen pembanding yang dipakai ulang Keputusan.
3. Keputusan butuh migrasi 0006 dan mengubah isi beranda setelah periode ditutup.
4. Saran urgensi butuh migrasi 0007 dan kunci Gemini.

Selesaikan satu fitur sampai **diterima** (tabel kriteria di prompt hijau semua), commit, baru mulai yang berikutnya.

---

## 1. Peran

Anda adalah *design engineer* senior yang membangun fitur produksi untuk lomba pengembangan web. Juri menilai fungsionalitas, inovasi, relevansi, UI/UX, kualitas kode, dan dokumentasi. Juri membuka situs yang di-*deploy* di **Google Cloud Run**, sering dari ponsel, dan masuk sebagai `admin` / `admin123` atau `warga` / `warga123`.

## 2. Baca sebelum menulis kode

1. `PRODUCT.md`, `DESIGN.md`, `README.md`.
2. `docs/forum.md` dan `docs/admin.md`: pola yang sudah berjalan. **Ikuti pola itu, jangan membuat pola kedua.**
3. `AGENTS.md`, lalu panduan Next.js di `node_modules/next/dist/docs/`. Versi ini (16.4, `cacheComponents`, `proxy.ts`, `'use cache'`, React Compiler) berbeda dari data latih Anda.
4. Kode yang disebut di prompt fitur. Nama fungsi di prompt diperiksa pada 22 November 2026; bila sudah berubah, kode yang benar, dan perbedaannya dicatat di laporan.

## 3. Skill

- `impeccable`: jalankan `impeccable context` sekali, lalu baca `reference/craft-floor.md` **tepat sebelum** mengubah UI. `DESIGN.md` sudah ada: perluas, jangan ganti.
- `interaction-design` (perilaku dan keadaan), `ux-writing` (semua teks), `accessibility-audit` (tiap layar baru), `design-critique` (putaran verifikasi).
- `superpowers:systematic-debugging` bila ada tes gagal, dan `superpowers:verification-before-completion` sebelum menyatakan selesai.
- Jangan memakai subagen kecuali diminta.

## 4. Kapan berhenti dan bertanya

Hanya bila:

- brief bertentangan dengan dirinya sendiri atau dengan kode;
- sebuah migrasi atau seed mengubah angka Garis Pagu di halaman utama **sebelum** ada aksi pengguna;
- sebuah keputusan menyentuh aturan dukungan warga (jatah dukungan masih sementara, jangan diubah);
- Anda membutuhkan rahasia (kunci API) atau akses ke database pemilik.

Untuk hal lain, pilih default yang paling masuk akal dan catat di laporan. **Jangan commit atau push. Jangan menjalankan SQL ke database pemilik.**

---

## 5. Proses dengan gerbang

Kerjakan berurutan. **Jangan lanjut sebelum gerbangnya hijau.** Di akhir tiap tahap, tulis satu atau dua kalimat status yang menyebut angka.

| Tahap | Isi | Gerbang (harus terbukti) |
|---|---|---|
| 0. Dasar | Baca semua bahan; jalankan `npm test`, `npx tsc --noEmit`, `npm run lint` **sebelum** mengubah apa pun | Semua hijau. Catat jumlah tes awal (388 pada 22 November 2026). Bila merah sebelum Anda mulai, berhenti dan laporkan |
| 1. Rencana | Rencana singkat: data, layar, urutan, risiko. Salin tabel kriteria penerimaan dari prompt fitur sebagai daftar tugas | Setiap kriteria punya rencana bukti |
| 2. Data | Migrasi dan tes SQL (bila ada), logika murni dan tes unit | `npm test` hijau; `rekomendasi_resmi(300000000)` sama dengan `supabase/tests/baseline-rekomendasi.json` |
| 3. Server | Pembaca data, Server Action, cache | `tsc`, lint, `npm test` hijau |
| 4. UI | Layar sesuai prompt, semua keadaan (memuat, kosong, galat, sukses) | `npm run build` lulus; layar dilihat sendiri lewat tangkapan layar |
| 5. Verifikasi | Satu putaran: tangkapan layar 360, 768, 1440 px; axe; keyboard; `impeccable detect`; `design-critique`; Lighthouse; E2E | Daftar temuan tertulis |
| 6. Perbaikan | Satu putaran memperbaiki semua temuan sekaligus | Tidak ada temuan tingkat 3 atau 4 tersisa |
| 7. Konfirmasi | Satu putaran: seluruh `npm test`, `tsc`, lint, build, **seluruh** E2E (termasuk yang lama) | Semua hijau. Lalu berhenti memoles |
| 8. Dokumen | Dokumentasi dan laporan akhir | Setiap klaim di dokumen dicocokkan ke kode, bukan ditulis dari ingatan |

**Bukti, bukan klaim.** "Sudah dicek" tidak diterima. Tulis perintahnya dan angkanya. Bila sesuatu gagal atau dilewati, katakan terus terang.

## 6. Standar mutu

- **Build dan tipe:** `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test` bersih.
- **Aksesibilitas:** WCAG 2.2 AA. axe tanpa pelanggaran di 360 dan 1440 px untuk semua layar dan keadaan baru. Penuh dengan keyboard. Target sentuh kontrol mandiri minimal 44 × 44 px. Reflow 320 px tanpa gulir horizontal. Spasi teks WCAG 1.4.12 tanpa konten terpotong. Perubahan dinamis diumumkan sopan dan dibatasi frekuensinya.
- **Kinerja (Lighthouse mobile, build produksi lokal):** performa ≥ 90 di halaman publik, aksesibilitas dan best practices ≥ 95, CLS < 0,1. Angka acuan 22 November 2026: `/` 96/100/100, `/forum` 96/100/100, `/admin` 96/100/100, CLS 0.
- **Gerak:** hanya sebagai jawaban atas aksi, hanya `transform` dan `opacity`, mati saat `prefers-reduced-motion`.
- **Konsol browser bersih** di setiap tes E2E.
- **Bahasa:** Indonesia sehari-hari yang sopan. Tanpa jargon anggaran tanpa penjelasan, tanpa eyebrow, tanpa kalimat promosi.
- **Klaim:** tidak ada angka, testimoni, atau kemampuan yang tidak benar-benar ada (`PRODUCT.md`, prinsip 3).

### Mutu desain

Sistemnya "Papan Pengumuman Desa" (`DESIGN.md`): datar, garis 6/3/2/1 px, Barlow Condensed dan Public Sans, tanpa bayangan, gradasi, kartu bersarang, atau warna baru. Setiap fitur punya **satu elemen khas** yang disebut di promptnya; curahkan sebagian besar usaha desain ke sana, dan biarkan sisanya tenang.

Nilai sendiri tiap layar pada putaran verifikasi (1 sampai 5), di 360 dan 1440 px. **Setiap baris minimal 4**; yang kurang diperbaiki di tahap 6. Tulis nilainya di laporan beserta satu kalimat alasan.

| Aspek | Pertanyaan |
|---|---|
| Lima detik | Apa halaman ini dan apa yang harus saya lakukan, jelas tanpa membaca? |
| Hirarki | Hanya satu hal yang paling menonjol, dan itu memang yang terpenting? |
| Irama | Jarak dan garis konsisten; tidak ada baris yang terlalu tinggi atau menempel? |
| Tipografi | Ukuran, bobot, dan lebar baris (62–66ch) benar; tidak ada kata yatim atau judul pecah jelek? |
| Data | Angka rata, satuan jelas, perbandingan terbaca tanpa menghitung sendiri? |
| Keadaan | Kosong, memuat, galat, dan sukses dirancang, bukan dibiarkan? |
| Ponsel | Di 360 px terasa dirancang untuk ponsel, bukan versi desktop yang diperas? |
| Ciri | Elemen khasnya membuat layar ini tidak mungkin tertukar dengan dasbor generik? |

Lihat tangkapan layarnya sungguhan dengan alat baca gambar. Lulus axe bukan berarti bagus.

## 7. Aturan kode dan keamanan

- **Mutasi** hanya lewat Server Action (`"use server"`), pola `useActionState`. Tiap aksi memeriksa sesi dan peran sendiri (`sesiAdmin()` di `lib/admin-akses.ts`), memvalidasi ulang di server, dan meneruskan id dari sesi ke fungsi SQL yang memeriksa lagi. Tidak ada `route.ts` untuk mutasi.
- **Fungsi SQL** atomik, mengembalikan `jsonb` (`{ok:true,…}` atau `galat_forum(...)` / `galat_bidang(...)`), `set search_path = public, extensions`, dan `revoke execute … from public, anon, authenticated`. Tabel baru: RLS aktif tanpa policy. View: `security_invoker = true`.
- **Pemanggilan** lewat `panggilFungsi` (`lib/forum-aksi.ts`); kode galat baru ditambahkan ke `KodeGalat`, `KODE_DIKENAL`, `NamaFungsi`, dan kalimatnya di `lib/admin-aksi.ts`.
- **Cache:** tag dari `lib/tag-cache.ts`; setiap mutasi yang mengubah angka publik memanggil `updateTag`. Halaman admin tidak memakai `'use cache'` dan tidak memakai data cadangan. Halaman publik punya data cadangan dan menampilkan penandanya.
- **Privasi:** nama lengkap, nomor warga, dan id akun tidak pernah sampai ke halaman publik.
- **XSS:** teks pengguna hanya sebagai teks React. Jangan pernah `dangerouslySetInnerHTML`.
- **Logika murni** dipisah ke `lib/` tanpa `server-only` dan diberi tes unit. Komponen klien sekecil mungkin.
- **Tipe database** (`lib/database.types.ts`) diperbarui manual untuk setiap tabel, view, dan fungsi baru.
- Nama dalam bahasa Indonesia, mengikuti gaya kode yang ada. Komentar hanya untuk alasan yang tidak terlihat dari kodenya.
- Jangan menambah dependensi kecuali prompt fitur menyebutnya, atau Anda menulis alasannya.

## 8. Lingkungan dan jebakan yang sudah pernah terjadi

Windows 11; Git Bash dan PowerShell 5.1 tersedia. Sebagian berkas memakai CRLF (mis. `PRODUCT.md`).

| Jebakan | Yang benar |
|---|---|
| React 19 mereset formulir setelah aksi, radio terkontrol kembali ke nilai awal | Beri `key={status.nomor}` pada kelompok radio (contoh: `FormPindahStatus`) |
| Kelas CSS Modules ditulis sebagai string (`"sel-utama"`) tidak pernah berlaku | `styles.selUtama` |
| `<h2>` mewarisi Barlow dan terlihat kerdil pada ukuran isi | Pakai huruf isi (contoh: `.registerJudul`) |
| Dialog kehilangan nama aksesibel saat isinya berganti | Judul pengganti memakai `idJudul` yang sama |
| Locator E2E bentrok dengan `role="alert"` kosong milik Next | Persempit dengan teks atau wadah |
| `redirect` antara `/masuk` dan `/akun` saling memanggil | Pakai `wajibMasuk()`, jangan menulis ulang |
| PGlite tidak rollback sendiri setelah `raise exception` di dalam `begin;` | `db.exec("rollback")` di tes |
| Server tiruan `e2e/supabase-palsu.ts` hanya mengenal `eq`, `in`, `is.null`, `order`, `limit`, rpc bernama | Perluas tiruannya bila butuh operator lain (`range`, `gte`, `or`, …), dan catat |
| Menambah parameter fungsi SQL membuat dua versi (overload) dan PostgREST bingung | `drop function` versi lama di migrasi yang sama, beri nilai bawaan pada parameter baru |
| Pembagian nol saat tidak ada usulan (`width: NaN%`) | Uji keadaan nol usulan |
| `npm run e2e` memakan ±14 menit | Jalankan di latar belakang sambil menulis dokumen |
| Dokumen ditulis dari ingatan lalu keliru | Cocokkan tiap klaim ke kode sebelum selesai |

## 9. Laporan akhir (bahasa Indonesia)

1. Apa yang dibangun.
2. **Tabel kriteria penerimaan**: setiap baris dari prompt fitur, dengan status (terpenuhi / sebagian / tidak) dan **bukti** (nama tes, perintah, atau angka).
3. Keputusan yang Anda ambil sendiri beserta alasannya, dan penyimpangan dari brief.
4. Hasil pemeriksaan berupa angka (tes, axe, Lighthouse, E2E) dan nilai mutu desain per layar.
5. Apa yang **tidak** terverifikasi.
6. **Langkah manual untuk pemilik proyek**: bernomor, lengkap dengan perintah dan hasil yang diharapkan (salin dari prompt fitur, perbarui bila berubah).
7. Keterbatasan.
8. Pengingat wajib: aturan dukungan (satu per usulan, boleh banyak usulan) masih sementara; putuskan apakah perlu jatah, misalnya 3 dukungan per warga per periode, sebelum karya dikumpulkan.

## 10. Langkah manual yang berlaku untuk semua fitur

Dilakukan **pemilik proyek**, bukan agen:

1. **Pastikan migrasi 0005 sudah dijalankan** di Supabase. Kode yang sekarang ada di `main` membutuhkannya. Cek: buka `https://<alamat-cloud-run>/api/health`. Harus berisi `"db":"ok"` dan `"pagu":300000000`. Bila `"db":"error"`, jalankan `supabase/migrations/0005_admin.sql`.
2. **Variabel lingkungan Cloud Run:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (minimal 32 karakter, berbeda dari lokal). Rahasia disimpan di Secret Manager, tidak pernah di image atau Git. Beranda diprerender saat build, jadi pastikan build juga bisa membaca database atau halamannya direvalidasi setelah start.
3. **Wilayah dan instance:** wilayah dekat Supabase (mis. `asia-southeast1`). Pakai **maksimal 1 instance** (`--max-instances=1`): cache Next ada di memori tiap instance, jadi `updateTag` di satu instance tidak menyegarkan yang lain. Memori minimal 2 GiB (perkiraan, ukur) karena model embedding.
4. **SQL sebelum deploy.** Bila fitur punya migrasi, jalankan di Supabase **lebih dulu**, cek angkanya, baru deploy. Bila Cloud Build terhubung ke GitHub, push ke `main` bisa berarti deploy.
5. **Cek sesudah deploy:** `/api/health` hijau, beranda menampilkan Garis Pagu tanpa catatan "data contoh", dan alur utama fitur dicoba sekali dari ponsel.
