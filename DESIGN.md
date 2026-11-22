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

### Galat (dipakai di formulir masuk dan forum)
- **Tepi Galat** (#a4231a), **Teks Galat** (#7a1a13), **Latar Galat** (#fdf1f0). Awalnya hanya
  ada di formulir masuk; forum memakainya lagi untuk galat isian. Belum menjadi token di
  `globals.css`; sebaiknya dijadikan token (`--galat-*`) pada perapian berikutnya.

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

Satu radius: `--radius` 0.375rem untuk tombol, kolom isian, cap, dan blok. Cap status
berbingkai 2 px berwarna sesuai maknanya. Status "Tidak terpilih" berbingkai putus-putus
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

### Dialog moderasi
`<dialog>` asli, `showModal()`. Garis 3 px tinta, latar papan, lebar maksimum 32rem. Alasan wajib;
tombol "Batal" dan "Sembunyikan".

### Formulir bertahap (Ajukan usulan)
Penunjuk tiga langkah (Isi usulan, Periksa serupa, Tinjau dan kirim) dengan `aria-current="step"`.
Satu blok berbingkai 3 px per langkah; judul langkah menerima fokus saat langkah berganti.

### Navigation
Header putih dengan garis tinta 3 px di bawahnya. Merek SUARA (Barlow 2rem, jarak huruf .06em).
Tautan aktif bergaris bawah 3 px (`aria-current="page"`), bukan hanya beda warna. Sudah masuk:
tombol berisi nama pengguna ke `/akun`.

## Do's and Don'ts

### Do:
- **Do** tulis status dengan ikon dan teks; gunakan `StatusLabel` untuk seleksi anggaran dan
  `StatusSiklus` untuk siklus usulan.
- **Do** pakai garis (6/3/2/1 px) untuk menyusun halaman, dan baris bergaris untuk daftar.
- **Do** beri tombol dan tautan mandiri tinggi minimal 2.75rem.
- **Do** garis bawahi tautan di tengah kalimat. Preflight Tailwind menghapus garis bawah
  tautan; tautan yang hanya dibedakan lewat warna gagal WCAG 1.4.1.
- **Do** ukur ulang kerangka pemuatan setiap kali isi berubah bentuk; CLS harus tetap 0.

### Don't:
- **Don't** tambahkan bayangan, gradasi, atau kartu bersarang.
- **Don't** pakai biru stempel sebagai dekorasi atau kuning marka dengan teks putih.
- **Don't** tulis eyebrow di atas judul, nomor bagian, atau teks bergradasi.
- **Don't** menyampaikan makna hanya lewat warna atau hanya lewat ikon.
- **Don't** memakai `disabled` untuk tombol yang sedang memproses; pakai `aria-disabled` agar
  fokus tidak hilang.
- **Don't** menambah warna atau huruf baru tanpa mencatat alasannya di sini.
