---
name: SUARA
description: Papan pengumuman desa yang bisa diperiksa warga: usulan, dukungan, dan alasan keputusan, semuanya terbaca.
colors:
  kapur: "#f3f5ef"
  papan: "#ffffff"
  tinta: "#14261e"
  abu-semen: "#5b655f"
  garis-halus: "#c9d0c6"
  biru-stempel: "#27409b"
  hijau-sawah: "#1b7048"
  kuning-marka: "#f2b600"
  galat-tepi: "#a4231a"
  galat-teks: "#7a1a13"
  galat-latar: "#fdf1f0"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 6vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.05
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  umum: "0.375rem"
spacing:
  gutter: "clamp(1rem, 4vw, 2.5rem)"
  lebar-maks: "76rem"
  garis-tebal: "3px"
components:
  tombol-utama:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papan}"
    rounded: "{rounded.umum}"
    padding: "0.5rem 1.125rem"
    height: "2.75rem"
  tombol-utama-hover:
    backgroundColor: "{colors.biru-stempel}"
  tombol-kedua:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.umum}"
    padding: "0.5rem 1.125rem"
    height: "2.75rem"
  tombol-kedua-hover:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papan}"
  status-terpilih:
    backgroundColor: "{colors.hijau-sawah}"
    textColor: "{colors.papan}"
    rounded: "{rounded.umum}"
    padding: "0.125rem 0.5rem"
  status-ditunda:
    backgroundColor: "{colors.kuning-marka}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.umum}"
    padding: "0.125rem 0.5rem"
  status-tidak-terpilih:
    backgroundColor: "transparent"
    textColor: "{colors.abu-semen}"
    rounded: "{rounded.umum}"
    padding: "0.125rem 0.5rem"
  cap-siklus:
    backgroundColor: "{colors.papan}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.umum}"
    padding: "0.125rem 0.5rem"
  kolom-isian:
    backgroundColor: "{colors.papan}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.umum}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
---

# Design System: SUARA

> Dokumen ini dibuat dengan `/impeccable document` (mode pemindaian): nilai diambil dari
> `app/globals.css` dan komponen halaman utama yang sudah berjalan, lalu diperluas dengan
> komponen forum. Pertanyaan kualitatif (North Star, karakter warna) tidak ditanyakan ke
> pemilik produk karena sesi ini tidak interaktif; pilihannya dicatat di sini dan bisa direvisi.

## Overview

**Creative North Star: "Papan Pengumuman Desa"**

SUARA tampil seperti papan pengumuman di kantor desa yang dicat dinding: latar kapur, garis tinta
tebal sebagai pembuka, huruf judul rapat seperti papan penunjuk jalan. Semua yang diumumkan bisa
dibaca siapa pun dan dicatat dengan alasan. Antarmukanya tenang dan datar: tidak ada bayangan,
gradasi, atau kartu bertumpuk. Kerapian datang dari garis dan jarak, bukan hiasan.

Pengguna utamanya membuka SUARA dari ponsel, sering dengan sinyal lemah, dan tidak terbiasa dengan
istilah anggaran. Karena itu hirarki dibuat jelas dan bahasanya lugas, sedangkan data penting
(biaya, dukungan, posisi pada pagu) selalu ditulis sebagai angka dan teks, tidak disembunyikan di
balik warna atau ikon.

Forum memperluas bahasa yang sama, tidak menggantinya. Pembeda satu-satunya adalah **baris posisi
anggaran**: sebuah usulan yang masuk hitungan anggaran menampilkan peringkat dan status
(Terbiayai, Ditunda, Tidak terpilih) dengan ikon, teks, dan warna status yang sama seperti Garis
Pagu di halaman utama.

Halaman admin memperluasnya sekali lagi sebagai **buku register di meja perangkat desa**: bukan dunia
visual baru, melainkan papan pengumuman yang sama dilihat dari sisi yang menulis. Isinya baris bergaris,
kolom angka rata, dan setiap entri membawa tanggal dan alasan. Admin adalah pengguna yang bekerja lama
dan teliti (mode *operate*), jadi kepadatan dan keterbacaan lebih penting daripada ekspresi. Pembedanya
adalah **pratinjau dampak**: dua Garis Pagu kecil, "Sekarang" dan "Sesudah disimpan", sebelum keputusan
berlaku. Satu-satunya permukaan gelap di aplikasi adalah **pita mode admin** di puncak halaman, supaya
admin tidak pernah ragu sedang berada di mana.

**Key Characteristics:**
- Datar: kedalaman dari garis (3 px tinta, 2 px, 1 px halus), bukan bayangan.
- Daftar berupa baris bergaris, bukan kartu. Tidak ada kartu di dalam kartu.
- Status selalu ikon + teks + warna. Tidak pernah hanya warna.
- Huruf judul Barlow Condensed untuk angka dan judul; Public Sans untuk isi, dengan angka tabular.
- Gerak hanya sebagai jawaban atas aksi (angka dukungan berubah), dan mati bila `prefers-reduced-motion`.

## Colors

Palet dari cat tembok dan papan proyek: dasar kapur kehijauan, tinta hijau-hitam, dan tiga warna
status yang dipakai sama di seluruh aplikasi.

### Primary
- **Tinta Papan** (#14261e): teks, garis tebal, tombol utama. Bukan hitam murni; condong hijau tua.

### Secondary
- **Biru Stempel** (#27409b): tautan, cincin fokus, dan semua "cap" (jenis catatan di jejak,
  status Masuk hitungan anggaran, label Admin desa). Satu-satunya warna interaktif.

### Tertiary (status)
- **Hijau Sawah** (#1b7048): Terbiayai/Terpilih, Disetujui, konfirmasi berhasil.
- **Kuning Marka** (#f2b600): Ditunda. Teksnya selalu tinta, tidak pernah putih.

### Neutral
- **Kapur** (#f3f5ef): latar halaman.
- **Papan** (#ffffff): permukaan isian, dialog, dan blok yang perlu terangkat dari latar.
- **Abu Semen** (#5b655f): teks redam. Kontras 5,3:1 di atas kapur.
- **Garis Halus** (#c9d0c6): pemisah baris, bukan teks.

### Galat (dipakai di formulir masuk, forum, dan admin)
- **Tepi Galat** (#a4231a, `--galat-tepi`), **Teks Galat** (#7a1a13, `--galat-teks`), **Latar Galat**
  (#fdf1f0, `--galat-latar`). Awalnya hanya ada di formulir masuk dan disalin per berkas; kini token di
  `app/globals.css` dan dipakai semua formulir. Kontras yang dihitung: teks galat di atas latar galat
  9,58:1; teks galat di atas papan 10,58:1; tepi galat di atas papan 7,41:1; tepi galat di atas kapur 6,75:1
  (semuanya melewati 4,5:1 untuk teks dan 3:1 untuk garis).
- Pesan galat berupa kotak berbingkai penuh (garis `--galat-tepi`, latar `--galat-latar`), tidak pernah
  garis tebal di satu sisi saja.

### Named Rules
**The Never-Color-Alone Rule.** Status tidak pernah hanya warna: setiap status memiliki ikon dan
teks. Cap siklus (Sedang dibahas, Masuk hitungan anggaran, ...) berbingkai garis dan tidak
berisi penuh, supaya tidak tertukar dengan tiga status seleksi yang berisi penuh.

**The One Interactive Blue Rule.** Biru stempel hanya untuk hal yang bisa ditekan atau yang
dicap. Jangan dipakai sebagai dekorasi.

## Typography

**Display Font:** Barlow Condensed (cadangan Arial Narrow), bobot 600/700.
**Body Font:** Public Sans (cadangan system-ui), angka tabular.

**Character:** Condensed tegas seperti papan penunjuk jalan di atas huruf layanan publik yang
tenang. Angka (dukungan, rupiah) dibaca sama lebarnya, jadi kolom angka rapi.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 1.1rem + 6vw, 4.75rem)`, 1.05): judul hero beranda.
- **Headline** (700, 2.5rem, 1.05): judul halaman (`h1`) dan judul bagian (`h2`).
- **Title** (700, 1.75rem, 1.1): judul usulan di daftar, angka dukungan, judul dialog.
- **Body** (400, 1.0625rem, 1.6): isi. Lebar baris 62-65ch (`max-width` pada deskripsi, komentar).
- **Label** (700, 0.8125rem): cap status, meta, penghitung karakter.

### Named Rules
**The Real-Numbers Rule.** Angka uang selalu lewat `rupiah()`/`rupiahRinci()` dan angka lain lewat
`ribuan()`/`desimal()` di `lib/format.ts`. Jangan memformat angka dengan tangan.

## Layout

Satu lajur untuk ponsel (gutter `clamp(1rem, 4vw, 2.5rem)`), maksimum 76rem di layar lebar.
Bagian halaman dibuka garis tinta 6 px (`.bagian`). Daftar dipisah garis 1 px halus dengan garis
tinta 2 px di atas daftar.

- **Daftar forum:** satu kolom di ponsel (isi, lalu angka dukungan); di ≥ 52rem dua kolom
  (isi | kolom dukungan 13rem). Tombol "Ajukan usulan" menempel di dasar layar ponsel
  (`position: sticky` di akhir `main`, tidak menutupi footer) dan pindah ke kepala di layar lebar.
- **Filter:** dilipat di ponsel (tombol "Saring dan urutkan · n aktif"), terbuka di layar lebar;
  tanpa JavaScript tetap terbuka.
- **Detail usulan:** satu lajur di ponsel dengan blok dukungan paling atas; di ≥ 62rem dua kolom
  (isi | samping 17rem, lengket). Di DOM samping ada lebih dulu, supaya urutan fokus sama dengan
  urutan visual.
- **Tinjau usulan (admin):** isi, dukungan, dan usulan serupa di kolom utama, kotak "Keputusan" di samping
  (`<aside>`); formulir "Masukkan ke hitungan anggaran" di bawahnya selebar halaman karena memuat rubrik
  dan pratinjau; komentar dan riwayat **di bawah formulir**, supaya keputusan tidak terdorong ke dasar halaman.
- **Kerangka pemuatan** meniru tinggi isi sebenarnya agar tidak ada lompatan (CLS 0 pada
  Lighthouse). Kerangka detail setinggi layar supaya footer tidak sempat terlihat lalu terdorong.

## Elevation & Depth

Datar. Tidak ada `box-shadow`. Kedalaman dibuat dari tiga tebal garis: 6 px (pembuka bagian),
3 px (`--tebal`: tombol, formulir, dialog), 2 px (daftar, cap), 1 px (pemisah baris). Satu-satunya
lapisan: latar `<dialog>::backdrop` berupa tinta 55% (`rgb(20 38 30 / 0.55)`).

### Named Rules
**The Flat-By-Default Rule.** Permukaan datar saat diam. Perubahan keadaan (hover, fokus) lewat
warna dan garis, bukan bayangan.

## Shapes

Dua radius, keduanya rendah: `--radius` 0.375rem untuk tombol, kolom isian, dialog, dan blok; 0.25rem
untuk cap kecil dan penanda yang berdiri di dalam baris teks (cap status, cap perisai admin, penanda
jumlah bobot). Pemindai `impeccable detect` menandai radius kecil ini sebagai advisory; sengaja dipertahankan
karena sama dengan cap di beranda dan forum. Cap status berbingkai 2 px berwarna sesuai maknanya. Status "Tidak terpilih" berbingkai putus-putus
(bentuk, bukan hanya warna, yang membedakannya). Ikon digambar sendiri di kotak 16 px, garis
2,25 px, ujung bulat, tanpa isi.

## Components

### Buttons
- **Shape:** persegi bersudut 0.375rem, garis 3 px tinta, tinggi minimal 2.75rem (44 px).
- **Primary (`.tombol-utama`):** tinta, teks putih. Hover berubah biru stempel.
- **Secondary (`.tombol-kedua`):** transparan, garis tinta. Hover terbalik (tinta, teks putih).
- **Pending:** `aria-disabled="true"` (bukan `disabled`, supaya fokus keyboard tidak lepas),
  kursor `progress`, opasitas .75, dan teks berubah ("Mengirim…").
- **Tautan masuk untuk pengunjung:** tautan teks bergaris bawah, bukan tombol, supaya daftar
  tidak dipenuhi tombol identik.

### Tombol dukung
Angka (Barlow 1.75rem) + satuan "dukungan" + "n per 1.000 penduduk RW", lalu tombol. `aria-pressed`
dan teks berubah ("Dukung" / "Didukung" dengan ikon centang). Angka naik sebentar (0,28 detik)
setelah aksi, tidak saat dimuat. Keadaan yang tidak boleh mendukung (admin, belum tertaut,
ditutup, data cadangan) diganti kalimat penjelasan.

### Cap status
- **Seleksi** (`StatusLabel`): Terpilih = hijau penuh; Ditunda = kuning penuh; Tidak terpilih =
  putus-putus abu. Teks bisa diganti (mis. "Terbiayai") tanpa mengubah ikon dan warna.
- **Siklus** (`StatusSiklus`): Sedang dibahas (tinta), Masuk hitungan anggaran (biru),
  Disetujui (hijau), Ditolak dan Selesai (abu). Berbingkai, latar putih.

### Baris posisi anggaran
Satu baris antara dua garis halus: "Peringkat 2 dari 7 rekomendasi" (tebal) + cap seleksi +
keterangan abu. Inilah pembeda SUARA dari forum biasa. Tenang: bukan panel, bukan kartu.

### Inputs / Fields
- **Style:** garis 2 px tinta, latar papan, radius umum, tinggi ≥ 44 px, ukuran huruf ≥ 16 px
  (`max(1rem, --t-md)`) supaya iOS tidak memperbesar halaman.
- **Label:** selalu terlihat di atas kolom; petunjuk di bawah label; galat di bawah kolom,
  berwarna teks galat dan `aria-describedby` ke kolom.
- **Focus:** cincin 3 px biru stempel, offset 3 px (global `:focus-visible`).
- **Error:** garis kolom `--galat-tepi`; ringkasan galat di atas formulir (`role="alert"`).

### Filter
Empat pilihan (status, RW, kategori, urutan) dalam blok berbingkai 3 px. Pilihan berlaku saat
dipilih; keadaan ada di URL. Di ponsel dilipat di balik tombol berbingkai.

### Baris daftar (usulan, komentar, riwayat)
Garis 2 px tinta di atas daftar, 1 px halus di antara baris. Judul Barlow 1.75rem berupa tautan.
Komentar admin berlabel "Admin desa" (cap biru dengan ikon perisai). Komentar atau usulan yang
disembunyikan diganti kotak berbingkai putus-putus berisi tanggal dan alasan.

### Dialog alasan
`<dialog>` asli, `showModal()`. Garis 3 px tinta, latar papan, lebar maksimum 32rem. Alasan wajib dengan
penghitung karakter; tombol "Batal" dan tombol aksi. Satu komponen bersama (`components/ui/DialogAlasan`)
dipakai untuk menyembunyikan (forum), menampilkan kembali, tidak melanjutkan, mengembalikan ke pembahasan,
menonaktifkan akun, dan mengatur ulang kata sandi; tiap pemakai hanya mengisi judul, penjelasan, dan teks
tombol. Isinya dipasang ulang dengan `key` setiap dibuka, jadi isian dan galat lama tidak terbawa. Saat
berhasil, dialog bisa menampilkan layar hasil sendiri (`tampilanBerhasil`) dan tetap bernama aksesibel
(judulnya ber-id yang diteruskan ke layar hasil). Esc menutup dan fokus kembali ke pemicu.

### Pita mode admin dan navigasi bagian
Pita gelap (latar tinta, teks putih, tinggi ±33 px) di atas header, hanya untuk admin: cap perisai biru
yang sama dengan label "Admin desa" di forum, dibalik (putih berbingkai biru) supaya terbaca, lalu nama
pengguna. Di bawahnya navigasi bagian (Ringkasan, Usulan, Anggaran, Akun, Moderasi) berlatar kapur dengan
garis 1 px; tautan aktif bergaris bawah 3 px dengan `aria-current="page"`, bukan hanya warna. Pita dan
navigasi dibaca dari sesi di dalam `Suspense` dengan kerangka setinggi aslinya, jadi tidak ada lompatan.

### Baris register (daftar kerja admin)
Garis 2 px tinta di atas, 1 px halus di antara baris. Di layar lebar: kolom angka rata kanan (4,5rem,
Barlow, tabular) lalu isi; di ponsel angka dan isi ditumpuk. Judul baris memakai huruf isi tebal
(bukan Barlow, karena `h2` Barlow pada ukuran isi terlihat kerdil). Tabel data (usulan, akun) memakai
`<table>` asli dengan `<caption>` dan `th scope`; di 360 px sel dipecah menjadi pasangan label-nilai dua kolom.
Tautan aksi di baris dan tautan yang berdiri sendiri bertinggi minimal 2.75rem.

### Rubrik urgensi
Empat tingkat (bukan sepuluh) dalam daftar bergaris di bawah kelompok pilihan 1–10: rentang angka (Barlow
tabular) lalu nama tingkat dan keterangan kecil abu. Tingkat yang sesuai dengan angka terpilih
**ditebalkan dan rentangnya digarisbawahi 3 px**, bukan hanya diwarnai. Kelompok radio diberi `key` supaya
pilihan tidak kembali ke nilai awal saat React mereset formulir. Tidak ada nilai bawaan.

### Pratinjau dampak
Blok berbingkai 3 px berjudul "Pratinjau dampak": dua `PaguBar` varian `ringkas` ("Sekarang",
"Sesudah disimpan") dengan nama di tiap blok (elipsis bila terlalu sempit) dan biaya hanya untuk pembaca
layar, satu kalimat ringkasan, kalimat khusus perpindahan status, lalu daftar usulan yang berubah dengan
`StatusLabel` sebelum dan sesudah. Yang tidak berubah dilipat. Dihitung ulang dengan jeda 300 ms; hasilnya
diumumkan lewat live region `role="status"` yang dibatasi frekuensinya, jadi pembaca layar tidak dibanjiri
saat admin mengetik. Bila gagal atau lambat: "Pratinjau belum bisa dihitung. Anda tetap bisa menyimpan."
Komponennya (`PratinjauDampak`) tidak tahu soal admin, supaya halaman Simulasi bisa memakainya.

### Penunjuk jumlah bobot
Tiga kolom bilangan bulat dan satu penunjuk yang selalu terlihat, di antara dua garis 2 px tinta. Maknanya
ada di kalimatnya, bukan di warna: "Jumlah 95. Kurang 5.", "Jumlah 105. Lebih 5.", atau "Jumlah 100. Siap
disimpan." Warna (teks galat atau hijau sawah) hanya menyertai kalimat itu. Bila ada selisih, tombol "Isi
sisanya ke urgensi (n)" menawarkan jalan pintas. Dua salinan sengaja ada: yang terlihat berubah seketika
(`aria-hidden`), dan satu `role="status"` untuk pembaca layar yang baru berubah setelah jeda 0,6 detik.
Tombol "Simpan bobot" tidak dimatikan sebelum jumlahnya pas: kalau ditekan terlalu dini, galatnya ditulis
di tempat yang sama. Selama menyimpan ia memakai `aria-disabled`, bukan `disabled`.

### Layar kata sandi sekali tampil
Dipakai setelah membuat akun atau mengatur ulang kata sandi. Nama pengguna dan kata sandi acak
(`xxxx-xxxx-xxxx`, tanpa karakter mirip) dalam huruf lebar tetap, `white-space: nowrap` dengan `clamp()`
supaya tidak pecah di 360 px. Dua tombol: "Salin kata sandi" dan "Salin keduanya" (nama pengguna dan kata
sandi); bila penyalinan gagal, ada petunjuk memilih dengan tangan. Peringatan tebal "Serahkan langsung ke
warga" bahwa kata sandi tidak akan tampil lagi dan tidak tersimpan di mana pun. Hanya ada di memori
komponen: tidak ke URL, penyimpanan peramban, atau cache.

### Formulir bertahap (Ajukan usulan)
Penunjuk tiga langkah (Isi usulan, Periksa serupa, Tinjau dan kirim) dengan `aria-current="step"`.
Satu blok berbingkai 3 px per langkah; judul langkah menerima fokus saat langkah berganti. Alur
membuat akun di admin memakai pola yang sama, dengan empat langkah (Pilih warga, Nama pengguna,
Kata sandi awal, Hasil).

### Navigation
Header putih dengan garis tinta 3 px di bawahnya. Merek SUARA (Barlow 2rem, jarak huruf .06em).
Tautan aktif bergaris bawah 3 px (`aria-current="page"`), bukan hanya beda warna. Sudah masuk:
tombol berisi nama pengguna ke `/akun`. Untuk admin ada tautan "Admin" ke `/admin`; warga dan pengunjung
tidak melihatnya.

## Do's and Don'ts

### Do:
- **Do** tulis status dengan ikon dan teks; gunakan `StatusLabel` untuk seleksi anggaran dan
  `StatusSiklus` untuk siklus usulan.
- **Do** pakai garis (6/3/2/1 px) untuk menyusun halaman, dan baris bergaris untuk daftar.
- **Do** beri tombol dan tautan mandiri tinggi minimal 2.75rem.
- **Do** garis bawahi tautan di tengah kalimat. Preflight Tailwind menghapus garis bawah
  tautan; tautan yang hanya dibedakan lewat warna gagal WCAG 1.4.1.
- **Do** ukur ulang kerangka pemuatan setiap kali isi berubah bentuk; CLS harus tetap 0.
- **Do** pakai token galat (`--galat-tepi/-teks/-latar`) untuk semua pesan galat, dengan bingkai penuh.
- **Do** wajibkan alasan pada setiap keputusan admin, dan tunjukkan pratinjau dampaknya sebelum tombol simpan.
- **Do** tulis tabel data sebagai `<table>` asli dengan `<caption>` dan `th scope`; pecah menjadi pasangan
  label-nilai di 360 px, jangan menggulir ke samping.

### Don't:
- **Don't** tambahkan bayangan, gradasi, atau kartu bersarang.
- **Don't** pakai biru stempel sebagai dekorasi atau kuning marka dengan teks putih.
- **Don't** tulis eyebrow di atas judul, nomor bagian, atau teks bergradasi.
- **Don't** menyampaikan makna hanya lewat warna atau hanya lewat ikon.
- **Don't** memakai `disabled` untuk tombol yang sedang memproses; pakai `aria-disabled` agar
  fokus tidak hilang.
- **Don't** menambah warna atau huruf baru tanpa mencatat alasannya di sini.
- **Don't** menampilkan penanda "AI", "segera hadir", atau tempat kosong untuk fitur yang belum berjalan
  (mis. saran urgensi AI di formulir admin): klaim di antarmuka harus sudah ada fiturnya.
- **Don't** menaruh kata sandi (atau apa pun yang rahasia) di URL, penyimpanan peramban, atau cache.
- **Don't** memakai garis tebal di satu sisi sebagai penanda galat atau peringatan; pakai bingkai penuh.
