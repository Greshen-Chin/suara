# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Warga desa.** Mengajukan usulan pembangunan, mendukung usulan yang sudah ada, dan berdiskusi di tiap usulan. Umumnya membuka SUARA dari ponsel, sering dengan sinyal yang tidak stabil, dan tidak terbiasa dengan istilah anggaran.
- **Admin desa (perangkat desa).** Membuatkan akun warga, mengatur pagu dan bobot penilaian, mengubah status usulan, dan memoderasi forum. Setiap keputusannya harus bisa diperiksa warga.
- **Pengunjung tanpa akun.** Boleh membaca semuanya (usulan, diskusi, simulasi, jejak keputusan), tetapi tidak bisa mengubah apa pun.
- **Juri lomba pengembangan web.** Menilai fungsionalitas, inovasi, relevansi, UI/UX, kualitas kode, dan dokumentasi. Mereka memakai akun demo.

## Product Purpose

SUARA (Sistem Usulan dan Aspirasi Rakyat) membantu desa memilih usulan pembangunan yang dibiayai dari pagu yang terbatas, dengan alasan yang terbuka. Warga menyampaikan aspirasi, sistem membandingkan pilihan anggaran, dan musyawarah desa memutuskan dengan alasan tertulis.

Produk ini berhasil kalau warga RW kecil bisa melihat dengan angka kenapa usulan mereka didanai atau ditunda, dan kalau tidak ada keputusan yang diambil tanpa jejak.

## Positioning

- Suara terbanyak tidak otomatis menang. Skor menggabungkan dukungan per 1.000 penduduk RW, urgensi (1 sampai 10, dengan alasan tertulis), dan pemerataan anggaran per kapita periode lalu. Bobotnya ditetapkan musyawarah dan setiap perubahannya tercatat.
- "Garis Pagu" memperlihatkan, untuk pagu yang sama, apa yang terbiayai jika memakai suara terbanyak dan jika memakai rekomendasi SUARA.
- AI hanya memberi bahan musyawarah (mengenali usulan mirip, menilai urgensi beserta alasannya). AI tidak pernah memutuskan.

## Operating Context

- Siklus usulan: `forum` (baru diajukan, dibahas) → `voting` (masuk perhitungan anggaran) → `approved` / `rejected` / `done`.
- Data demo: 3 RW (RW 01 berpenduduk 3.000 dengan anggaran lalu Rp 250 jt, RW 03 berpenduduk 2.000 dengan Rp 60 jt, RW 07 berpenduduk 400 dengan Rp 0), 7 usulan berstatus voting, 162 dukungan, pagu Rp 300 jt.
- Akun warga dibuat admin, bukan pendaftaran mandiri. Tujuannya mencegah satu orang membuat banyak akun untuk menambah dukungan.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19 dengan React Compiler, TypeScript strict, CSS Modules ditambah token di `app/globals.css`, dan Supabase Postgres. Database hanya diakses dari server dengan service role; RLS aktif tanpa policy.
- Login dengan nama pengguna dan kata sandi: hash scrypt, sesi JWT di cookie httpOnly. Ada peran `warga` dan `admin`, serta `wajibMasuk()` dan `wajibPeran()` di `lib/auth.ts`.
- Seluruh antarmuka berbahasa Indonesia.
- Keputusan yang sudah diambil untuk forum (2026-11-22):
  - ada komentar per usulan;
  - usulan baru langsung tampil, dan admin bisa menyembunyikannya dengan alasan tercatat;
  - satu dukungan per usulan per warga, boleh mendukung banyak usulan.
- Keputusan yang sudah diambil untuk halaman admin (2026-11-22):
  - admin meninjau usulan forum: `forum → voting` (urgensi 1–10 dengan alasan), `forum → rejected` ("Tidak dilanjutkan"), dan `voting → forum`; semuanya wajib beralasan, dan alasannya terbaca publik;
  - `voting → approved/rejected` dan `approved → done` sengaja bukan bagian admin: itu fitur Keputusan (hasil musyawarah);
  - pagu (Rp 10 juta sampai Rp 10 miliar) dan bobot (tiga bilangan bulat, jumlah 100) diatur admin dengan alasan, dan admin melihat pratinjau dampaknya pada Garis Pagu sebelum menyimpan;
  - akun warga dibuat admin dari antarmuka (tertaut ke warga yang belum punya akun, kata sandi acak tampil sekali, wajib diganti saat masuk pertama); akun admin hanya lewat skrip terminal;
  - perubahan akun masuk jejak admin yang tertutup, bukan jejak publik, karena menyangkut data pribadi.
- **Keputusan terbuka:** aturan dukungan bersifat sementara. Pemilik produk ingin menimbang ulang jatah dukungan terbatas (misalnya 3 per warga per periode).
- Keputusan yang sudah diambil untuk simulasi (2026-11-22):
  - semua orang boleh memakainya tanpa masuk; tidak menyimpan apa pun ke database dan tidak mengubah rekomendasi resmi;
  - dihitung di peramban dengan mesin yang sama dengan halaman utama (`pilihOptimal`), dan keadaannya (pagu, bobot, usulan
    forum andaian) tinggal di alamat supaya bisa dibagikan;
  - bobot di simulasi selalu berjumlah 100 (menggeser satu membagi ulang dua lainnya), sengaja berbeda dari halaman admin;
  - **Peta Pagu** menunjukkan, untuk semua usulan sekaligus, pada rentang pagu mana tiap usulan terbiayai;
  - **uji ketahanan** menghitung hasil untuk semua 231 kombinasi bobot kelipatan 5 dan menyebut berapa yang menghasilkan pilihan
    sama, untuk menjawab "bobotnya dipilih-pilih?". Ini bukan bukti bahwa keputusannya benar.
- **Sudah ada:**
  - forum (daftar, detail, ajukan usulan, komentar, moderasi), termasuk deteksi usulan mirip dengan embedding (`multilingual-e5-small`, 384 dimensi) dan cadangan `pg_trgm`. Lihat `docs/forum.md`;
  - halaman admin desa: ringkasan, usulan, anggaran (pagu dan bobot dengan pratinjau dampak), akun, dan moderasi, plus ganti kata sandi di `/akun` untuk semua peran. Lihat `docs/admin.md`;
  - halaman Simulasi (`/simulasi`): pagu dan bobot yang bisa digeser, Peta Pagu, uji ketahanan bobot, tabel per RW, dan usulan forum
    andaian, tanpa menyimpan. Lihat `docs/simulasi.md`.
- **Belum ada:**
  - Keputusan (masih halaman stub);
  - pengisian `location` pada usulan (deteksi mirip memakai RW);
  - penilaian urgensi oleh AI (admin mengisi urgensi dengan rubrik empat tingkat; tempat untuk saran AI sudah disiapkan di formulir tetapi tidak tampil sampai fiturnya ada);
  - pengaturan data wilayah (penduduk, anggaran periode lalu) dari antarmuka;
  - pengujian dengan pembaca layar dan perangkat sentuh nyata.

## Brand Commitments

- Nama: SUARA, kependekan dari Sistem Usulan dan Aspirasi Rakyat.
- Bahasa visual yang sudah berjalan di halaman utama: papan proyek dan cat tembok kantor desa. Token warnanya `kapur`, `papan`, `tinta`, `abu-semen`, `biru-stempel`, `hijau-sawah`, dan `kuning-marka`, dengan huruf Barlow Condensed dan Public Sans.
- Status selalu ditulis dengan ikon dan teks, tidak pernah hanya warna.
- Nada bahasa lugas, bahasa sehari-hari yang sopan, dan tanpa jargon anggaran.

## Evidence on Hand

- Seluruh data di `supabase/seed.sql` adalah data purwarupa. Belum ada desa nyata, testimoni, atau angka dampak.
- Jangan mengarang testimoni, nama desa nyata, jumlah pengguna, atau klaim dampak.

## Product Principles

1. **Keputusan selalu punya alasan yang bisa dibaca.** Setiap perubahan status, bobot, pagu, atau moderasi dicatat di jejak keputusan. Admin tidak bisa menyimpan keputusan anggaran tanpa alasan, dan melihat dampaknya lebih dulu.
2. **RW kecil tidak boleh kalah hanya karena penduduknya sedikit.** Angka dukungan dinormalkan per penduduk.
3. **AI memberi bahan, manusia memutuskan.** Klaim tentang AI di antarmuka hanya boleh ada kalau fiturnya benar-benar berjalan.
4. **Terbuka untuk dibaca semua orang, tertutup untuk diubah tanpa akun.**
5. **Dirancang untuk ponsel dan sinyal lemah lebih dulu.**

## Accessibility & Inclusion

- Target WCAG 2.2 AA: axe tanpa pelanggaran, bisa dipakai penuh dengan keyboard, dan `prefers-reduced-motion` dihormati.
- Lighthouse mobile minimal 90 untuk performa dan 95 untuk aksesibilitas serta best practices, dengan CLS di bawah 0,1.
- Bahasa sederhana untuk warga yang tidak terbiasa dengan istilah anggaran.
