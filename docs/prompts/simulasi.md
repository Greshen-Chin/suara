# Prompt: Simulasi Anggaran (`/simulasi`)

> Baca `docs/prompts/standar.md` **utuh** lebih dulu; itu bagian dari brief ini (proses bergerbang, standar mutu, jebakan, format laporan).
> Keputusan produk di bagian 2 sudah final; jangan ditanyakan ulang. Angka di brief ini dihitung dari kode dan data demo pada 22 November 2026.

---

## 1. Tujuan

Warga mengubah pagu dan bobot, lalu **langsung melihat** usulan mana yang terbiayai, siapa yang kebagian, dan apa yang dibutuhkan supaya sebuah usulan terbiayai. Tidak ada yang disimpan.

Tiga pertanyaan yang harus terjawab tanpa penjelasan tambahan:

1. **"Kalau pagunya segini, usulan mana yang jadi?"**
2. **"Berapa pagu yang dibutuhkan supaya usulan RW saya terbiayai?"**
3. **"Jangan-jangan bobotnya dipilih supaya hasilnya begini?"** Ini pertanyaan paling tajam terhadap SUARA, dan halaman ini menjawabnya dengan angka.

Saat ini `/simulasi` adalah `HalamanStub`, padahal tombol utama beranda dan langkah kedua di "Cara kerja" mengarah ke sana.

---

## 2. Keputusan produk (final)

| Topik | Keputusan |
|---|---|
| Siapa yang boleh | Semua orang, tanpa masuk. |
| Menyimpan | Tidak menyimpan apa pun ke database dan tidak mengubah rekomendasi resmi. Katakan itu dengan jelas, sekali, di dekat kendali. |
| Tempat menghitung | Di peramban, dengan `pilihOptimal` (`lib/seleksi.ts`). Tidak ada Server Action per geseran: sinyal warga lemah. |
| Keadaan | Ada di URL (`?pagu=350000000&bobot=20-60-20&tambah=<uuid>.8`), supaya bisa dibagikan dan tombol kembali berfungsi. Nilai yang sama dengan resmi **tidak** ditulis di URL. Nilai tidak sah di URL diabaikan diam-diam, tidak menggagalkan halaman. |
| Rentang pagu | Rp 10 juta sampai yang lebih besar dari: total biaya semua usulan yang disimulasikan, atau dua kali pagu resmi; dibulatkan ke atas ke kelipatan Rp 50 juta. Langkah Rp 5 juta. Bisa juga diketik (`parseRupiah`, batas `BATAS_ADMIN`). |
| Bobot | Tiga geseran 0–100, langkah 5, **selalu berjumlah 100**: menggeser satu membagi ulang dua lainnya secara proporsional (sisa terbesar; bila keduanya nol, bagi rata). Ini sengaja berbeda dari halaman admin (yang tidak menyeimbangkan otomatis): di simulasi setiap keadaan harus sah. |
| Preset | Resmi (nilai dari database), "Dukungan saja" 100/0/0, "Keselamatan dulu" 10/80/10, "Merata dulu" 10/30/60. Preset hanya jalan pintas mengisi geseran. |
| Pembanding | Selalu terlihat: rekomendasi **resmi** vs **simulasi Anda**, dan usulan yang berubah status. |
| Uji ketahanan | Wajib (bagian 5). |
| Peta Pagu | Wajib; elemen khas halaman ini (bagian 4). |
| Usulan forum | Warga bisa menambahkan usulan berstatus `forum` ke simulasi dengan urgensi yang ia andaikan. Total usulan tetap maksimal 16 (`BATAS_USULAN_OPTIMAL`). |
| Data cadangan | Boleh (halaman publik), dengan penanda seperti di beranda dan forum. |
| Aturan dukungan | Tidak disentuh. |

---

## 3. Fakta kode yang harus dipakai

- **Mesin:** `pilihOptimal`, `statusUsulan`, `BATAS_USULAN_OPTIMAL`, tipe `Usulan`, `Wilayah`, `Bobot` (`lib/seleksi.ts`). `hitungRekomendasi`, `bandingkan`, `modePaguDari`, `ringkasanBanding`, `petaPosisi`, `TEKS_STATUS`, `labelRw`, `namaDenganRw`, tipe `DasarHitung`, `UsulanHitung`, `HasilBanding` (`lib/pratinjau.ts`; murni, aman di peramban).
- **`terapkanPerubahan` hanya menerima satu perubahan.** Simulasi mengubah pagu, bobot, dan daftar usulan sekaligus: susun `DasarHitung` baru langsung lalu panggil `bandingkan`, atau tambah `jenis: "skenario"`. Pilih satu, uji, dan jangan mengubah perilaku yang ada.
- **`HasilBanding.masuk` hanya menampung satu usulan.** Dengan beberapa usulan forum yang ditambahkan, yang terakhir menimpa yang lain. Perbaiki (mis. `masuk: BarisBanding[]`) beserta pemakainya dan tesnya, atau jangan memakai bidang itu di simulasi. Jangan dibiarkan diam-diam salah.
- **`components/admin/PratinjauDampak.tsx` belum bisa dipakai ulang**, meski komentarnya berkata begitu: ia mengimpor `hitungPratinjauAdmin` (Server Action admin) dan labelnya tertanam ("Sesudah disimpan"). **Ekstrak bagian tampilannya** (fungsi `Isi` dan `Perubahan`) menjadi `components/anggaran/PerbandinganPagu.tsx` dengan label lewat props, lalu pakai di admin dan di sini. Perilaku dan tampilan admin tidak boleh berubah (E2E admin tetap hijau). Koreksi komentarnya.
- **Batang:** `components/landing/PaguBar.tsx` (prop `ringkas`), `usePaguFlip.ts` (animasi FLIP yang sudah menghormati `prefers-reduced-motion`). Atribut `data-flip` dipakai untuk mencocokkan elemen; dua batang di satu halaman butuh akar terpisah.
- **Data:** belum ada pembaca publik yang mengembalikan `created_at`, padahal urutan seri SQL memakainya. Buat `lib/simulasi-data.ts` (`server-only`, `'use cache'`, tag `beranda`, `pengaturan`, `forum`, `cacheLife` sama dengan beranda) yang mengembalikan `DasarHitung` + daftar usulan forum ringkas + penanda data cadangan. Contoh kueri: `bacaDasarHitung` di `lib/admin-data.ts` (urut `created_at`, `id`; yang tanpa RW atau tanpa urgensi dilewati).
- **Rubrik urgensi:** `RUBRIK_URGENSI`, `rubrikUntuk`, `label` (`lib/urgensi.ts`).
- **Format:** `rupiah`, `rupiahRinci`, `ribuan`, `desimal` (`lib/format.ts`); `parseRupiah` (`lib/rupiah.ts`).
- **Tautan:** `RUTE.simulasi`; tautan masuk sudah ada di beranda (Hero, Cara kerja) dan navigasi.

---

## 4. Elemen khas: Peta Pagu

Peta Pagu menjawab "berapa pagu supaya usulan ini jadi?" untuk **semua** usulan sekaligus.

- Satu baris per usulan. Sumbu mendatar adalah pagu. Ruas berisi = usulan terbiayai pada rentang pagu itu. Garis tegak tebal = pagu yang sedang disimulasikan; garis tipis = pagu resmi.
- Menggeser pagu menggeser garis tegak di atas peta; ruas yang tersentuh menyala. Petanya sendiri hanya berubah bila bobot atau daftar usulan berubah.

Sketsa 1440 px. Letak ruas di gambar hanya perkiraan; **angka di kolom kanan adalah hasil hitungan nyata** (data demo, bobot 30/40/30, langkah Rp 5 juta, dalam juta):

```
                Rp 0      200       400       600      795 juta
                          pagu Anda ▼ 300
Lampu PJU       ··██··███·████│██████████████████████████████   40–65, 110–155, lalu dari 195
Jembatan        ···█·█··██████│██████████████████████████████   70–85, 110–125, lalu dari 160
Drainase        ····█·███·████│██████████████████████████████   90–105, 130–190, lalu dari 200
Jalan SDN 03    ·········█··██│██████████████████████████████   195, lalu dari 285
Balai warga     ··············│···███·······███········█        395–460, 615–680, lalu dari 795
Gapura          ··············│······██·········████████        465–500, lalu dari 685
Talud           ··············│········██████████████████████   dari 505
```

Kalimat di layar untuk warga, misalnya: *"Talud baru muat kalau pagunya Rp 505 juta, Rp 205 juta lebih banyak dari pagu sekarang."* Untuk yang terputus: *"Gapura muat pada Rp 465–500 juta, lalu lagi dari Rp 685 juta."* Batas atas ruas ditulis menurut langkah Rp 5 juta, atau "sebelum Rp …" bila memakai titik tangga yang tepat; pilih satu dan pakai konsisten.

**Kenapa ini menarik dan harus dijelaskan.** Ruasnya **bolong-bolong**: Balai warga terbiayai pada Rp 395 juta, hilang lagi pada Rp 465 juta, lalu muncul lagi. Itu bukan galat: SUARA memilih kombinasi dengan total skor terbesar, jadi pagu yang sedikit lebih besar bisa memuat pasangan yang lebih baik. Beri satu kalimat penjelas di bawah peta dan jadikan bisa ditemukan ("Kenapa terputus?" dengan `<details>`).

**Cara menghitung (fungsi murni `lib/peta-pagu.ts`).** Skor tidak bergantung pada pagu. Jadi cukup sekali: hitung biaya dan skor (bilangan bulat, skor × 10.000) untuk semua kombinasi (maksimal 65.536), urutkan menurut biaya, lalu ambil maksimum berjalan. Hasilnya "tangga": daftar titik pagu tempat pilihan berubah, dan kombinasi yang berlaku sejak titik itu. Aturan serinya **harus sama persis** dengan `pilihOptimal` (skor lebih besar, lalu biaya lebih kecil, lalu kombinasi yang ditemui lebih dulu menurut urutan mask).

**Aksesibilitas Peta.** Peta adalah gambar pendukung, bukan satu-satunya sumber: tiap baris punya kalimat teks di sebelahnya, dan ada tabel setara (`<table>` dengan `<caption>`) yang bisa dibuka. Pagu diatur lewat `<input type="range">` asli dan kolom ketik, bukan dengan menyeret peta (WCAG 2.5.7). Boleh mengetuk peta sebagai jalan pintas, asalkan bukan satu-satunya cara.

**Di 360 px** baris label naik ke atas ruasnya, kalimatnya di bawah, dan peta tetap selebar layar tanpa gulir horizontal.

---

## 5. Uji ketahanan: menjawab "bobotnya dipilih-pilih?"

**Fakta yang menentukan rancangan halaman ini.** Pada pagu Rp 300 juta dengan data demo, **231 dari 231** kombinasi bobot (kelipatan 5) menghasilkan usulan terbiayai yang **sama**: Drainase, Jalan SDN 03, Jembatan, Lampu PJU. Semua preset di bagian 2 juga. Artinya menggeser bobot **tidak mengubah** pilihan; yang berubah hanya skor, peringkat, dan status "Ditunda".

Kalau halaman ini tidak menjelaskannya, warga dan juri mengira geseran bobotnya rusak. Kalau dijelaskan, ini argumen terkuat SUARA.

- **Tampilkan hasilnya sebagai kalimat utama di dekat geseran bobot**, dan perbarui saat pagu berubah:
  - Semua sama: *"Pada pagu Rp 300 juta, hasilnya sama untuk 231 dari 231 kombinasi bobot. Rekomendasi ini tidak bergantung pada bobot yang dipilih."*
  - Sebagian: *"Pada pagu Rp 450 juta, bobot menentukan. 133 dari 231 kombinasi membiayai Balai warga dan Jalan SDN 03; 98 lainnya membiayai Talud."* (Angka nyata data demo. Sebut **bedanya saja**, bukan daftar lengkap kedua pilihan.)
- **Rincian per usulan:** "Drainase terbiayai pada 231 dari 231 kombinasi; Talud pada 0 dari 231." Batang proporsi kecil + angka, bukan diagram lingkaran.
- **Saat geseran bobot tidak mengubah yang terbiayai, katakan apa yang berubah**: peringkat, skor, atau status "Ditunda" (bentuk kalimat: "[Usulan] naik dari peringkat x ke y, tetapi tetap tidak terpilih"). Contoh nyata: pada 100/0/0, Gapura dan Balai warga berubah dari Tidak terpilih menjadi Ditunda, sedangkan yang terbiayai tetap sama. Jangan pernah diam.
- **Ajakan yang jujur:** bila bobot tidak berpengaruh pada pagu sekarang, tawarkan "Coba pagu Rp 450 juta" (pagu terdekat yang hasilnya bergantung pada bobot, dicari dari tangga dan uji ketahanan; jangan ditanam).

**Cara menghitung (`lib/ketahanan.ts`).** 231 kombinasi × `pilihOptimal`. Terukur di Node: 3 ms untuk 7 usulan, tetapi **±970 ms untuk 16 usulan**. Karena itu wajib tidak memblokir utas utama: pakai Web Worker, atau potong menjadi bagian kecil yang menyerahkan giliran. Hemat dengan menghitung himpunan kombinasi yang muat satu kali per pagu. Batalkan hitungan lama saat masukan berubah. Selama menghitung, tampilkan hasil lama yang diredam.

---

## 6. Layar

Satu halaman. Urutan di ponsel = urutan DOM.

1. **Kepala:** `h1` "Simulasi anggaran", satu kalimat: *"Ubah pagu dan bobot, lalu lihat usulan mana yang terbiayai. Tidak ada yang disimpan, dan rekomendasi resmi tidak berubah."*
2. **Kendali pagu:** angka besar (Barlow), geseran, kolom ketik, tombol "Kembali ke pagu resmi".
3. **Hasil:** batang Garis Pagu simulasi (`PaguBar`, animasi FLIP), kalimat ringkasan, dan "Yang berubah dari rekomendasi resmi" (`PerbandinganPagu`). Bila tidak ada: "Sama dengan rekomendasi resmi."
4. **Peta Pagu** (bagian 4).
5. **Kendali bobot + uji ketahanan** (bagian 5), dengan penjelasan bobot memakai kalimat yang sama dengan halaman admin.
6. **Siapa yang kebagian:** tabel per RW: rupiah, jumlah usulan, dan **rupiah per penduduk**, resmi vs simulasi. Ini cara paling jujur menunjukkan pemerataan.
7. **Tambah usulan dari forum:** pilih usulan `forum`, isi urgensi andaian dengan rubrik, lihat posisinya (bentuk kalimat: *"Dengan urgensi 8, [usulan] berada di peringkat 4 dari 8: Terbiayai."*). Beri penanda "andaian" pada setiap tampilan usulan itu. Nilai sungguhan tetap dinilai admin.
8. **Bagikan:** tombol menyalin tautan (`navigator.share` bila ada, jatuh ke salin). Konfirmasi diumumkan.

**Di layar lebar (≥ 62rem):** kendali menempel di kolom kiri (`position: sticky`), hasil dan peta di kanan. **Di ponsel:** ringkasan satu baris yang menempel di dasar layar ("Rp 300 juta · 4 terbiayai · sisa Rp 15 juta"), supaya akibat geseran terlihat tanpa menggulir. Tidak menutupi fokus (WCAG 2.4.11) dan tidak menutupi footer (pola: tombol "Ajukan usulan" di forum).

**Dari forum:** di halaman detail usulan berstatus `forum`, tambahkan satu tautan tenang "Lihat kalau usulan ini dihitung" ke `/simulasi?tambah=<id>.5`.

### Keadaan

| Keadaan | Perilaku |
|---|---|
| Tanpa JavaScript | Rekomendasi resmi (batang, Peta Pagu, tabel RW) tetap terbaca dari server. Kendali disertai kalimat bahwa simulasi butuh JavaScript. |
| Memuat | Kerangka setinggi aslinya, CLS 0. |
| Nol usulan `voting` | "Belum ada usulan dalam hitungan anggaran." + tautan forum; kendali tidak dirender. Harus diuji: ini terjadi setelah periode ditutup oleh fitur Keputusan. |
| Data cadangan | Penanda jelas; simulasi tetap jalan. |
| Pagu lebih kecil dari usulan termurah | "Belum ada usulan yang muat." Batang kosong yang rapi. |
| Pagu memuat semuanya | "Semua usulan terbiayai, sisa Rp …". |
| URL berisi usulan yang sudah tidak berstatus `forum` | Diabaikan, dengan satu kalimat pemberitahuan. |
| Sudah 16 usulan | Tombol tambah diganti penjelasan. |

---

## 7. Kinerja

- Hitungan utama per geseran (`pilihOptimal` + banding): tidak memblokir. Pakai `useDeferredValue`; jangan menulis URL pada tiap gerakan (tunda ±300 ms, `router.replace` tanpa gulir, atau `history.replaceState`).
- **Batas:** dengan CPU 4× lebih lambat, tugas utas utama tunggal ≤ 100 ms saat menggeser dengan 16 usulan. Ukur dengan Performance API di E2E dan laporkan angkanya.
- Lighthouse `/simulasi` ≥ 90 performa, CLS < 0,1. Halaman tetap diprerender (PPR).

---

## 8. Kriteria penerimaan

| ID | Kriteria | Bukti yang diminta |
|---|---|---|
| S-01 | Simulasi dengan nilai resmi = rekomendasi resmi beranda, baris demi baris | Tes unit + tes SQL terhadap `rekomendasi_resmi` |
| S-02 | `peta-pagu` sama dengan `pilihOptimal` di **setiap** titik tangga, tepat sebelum dan tepat sesudahnya, untuk data demo dan ≥ 50 kasus acak berbenih tetap (1–12 usulan, termasuk seri) | Tes unit |
| S-03 | Pada data demo (langkah 5 juta): Talud 505+; Gapura 465–500, 685+; Balai warga 395–460, 615–680, 795+; Jalan SDN 03 195, 285+; Drainase 90–105, 130–190, 200+; Jembatan 70–85, 110–125, 160+; Lampu PJU 40–65, 110–155, 195+ | Tes unit dengan angka ini |
| S-04 | Uji ketahanan data demo: pagu 300 → 231/231 satu hasil; 450 → 133 dan 98; 250 → 147, 49, 35 | Tes unit dengan angka ini |
| S-05 | Bobot selalu berjumlah 100 dan tiap nilai 0–100 kelipatan 5, dari urutan geseran apa pun | Tes unit (acak berbenih) |
| S-06 | URL bolak-balik: tulis lalu baca menghasilkan keadaan yang sama; masukan rusak tidak menggagalkan halaman | Tes unit + E2E |
| S-07 | Beberapa usulan forum ditambahkan sekaligus, semuanya tampil benar | Tes unit + E2E |
| S-08 | Admin: `PratinjauDampak` tampil dan berperilaku sama setelah ekstraksi | E2E admin lama hijau, tangkapan layar sebelum/sesudah |
| S-09 | Penuh dengan keyboard; hasil diumumkan ≤ 1 kali per jeda; axe 0 di 360 dan 1440 | E2E |
| S-10 | Peta punya padanan teks untuk tiap baris dan tabel | axe + tes isi |
| S-11 | Nol usulan, data cadangan, tanpa JavaScript | E2E |
| S-12 | Tugas utas utama ≤ 100 ms (16 usulan, CPU 4×); uji ketahanan tidak memblokir | Angka terukur |
| S-13 | Angka beranda dan forum tidak berubah | E2E lama + tes baseline |
| S-14 | Setiap aspek mutu desain ≥ 4 di 360 dan 1440 px | Tabel nilai + tangkapan layar |

---

## 9. Dokumentasi

1. `README.md`: baris Fitur (Simulasi selesai), bagian "Simulasi anggaran" + cara mencoba, jumlah tes, struktur folder.
2. `docs/simulasi.md`: cara kerja Peta Pagu (diagram), bukti kesetaraan, uji ketahanan (apa artinya dan **apa yang bukan**: bukan bukti keputusan benar, hanya bahwa hasilnya tidak peka terhadap bobot), keterbatasan (maksimal 16 usulan; langkah 5).
3. `DESIGN.md`: Peta Pagu, geseran, ringkasan menempel, `PerbandinganPagu`. `PRODUCT.md`: "Sudah ada" / "Belum ada".
4. Koreksi komentar `PratinjauDampak` dan kalimat di `docs/admin.md` yang menyebut keterbatasan pemakaian ulangnya.

## 10. Langkah manual untuk pemilik proyek

1. **Tidak ada SQL dan tidak ada variabel lingkungan baru.**
2. Setelah push: buka `/simulasi` di ponsel, geser pagu ke Rp 505 juta, dan pastikan **Talud** menjadi Terbiayai.
3. Kembalikan ke Rp 300 juta dan pastikan kalimat uji ketahanan menyebut **231 dari 231** (selama data demo belum diubah).
4. Salin tautan, buka di perangkat lain: keadaannya harus sama.

## Di luar cakupan

Menyimpan skenario ke database, akun, atau komentar; mengubah bobot atau pagu resmi; peta geografis; ekspor; menyeret batang anggaran; perubahan rumus skor.
