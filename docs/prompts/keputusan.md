# Prompt: Keputusan Musyawarah (`/keputusan` dan `/admin/keputusan`)

> Baca `docs/prompts/standar.md` **utuh** lebih dulu; itu bagian dari brief ini (proses bergerbang, standar mutu, jebakan, format laporan).
> Keputusan produk di bagian 2 sudah final; jangan ditanyakan ulang. Fakta kode diperiksa pada 22 November 2026.

---

## 1. Tujuan

Menutup siklus SUARA. Saat ini usulan berhenti di `voting`: rekomendasi dihitung, tetapi tidak ada tempat mencatat **apa yang akhirnya diputuskan musyawarah desa** dan **mengapa**. `/keputusan` masih `HalamanStub`, padahal beranda menautkannya dua kali ("Lihat semua keputusan", "Lihat keputusan desa").

Setelah fitur ini:

1. **Admin** mencatat hasil musyawarah untuk semua usulan yang dihitung, dalam satu penetapan yang utuh.
2. **Warga** membaca keputusan itu berdampingan dengan rekomendasi: di mana musyawarah mengikuti, di mana berbeda, dan alasannya.
3. **Periode berikutnya** mewarisi akibatnya: RW yang baru mendapat anggaran tidak lagi didahulukan oleh komponen pemerataan.

Prinsip yang tidak boleh dilanggar: **SUARA merekomendasikan, musyawarah memutuskan, dan setiap perbedaan punya alasan yang bisa dibaca** (`PRODUCT.md`).

---

## 2. Keputusan produk (final)

### Hasil untuk tiap usulan

| Kode | Label di layar | Status usulan sesudahnya | Memakai pagu | Alasan (20–500 karakter) |
|---|---|---|---|---|
| `disetujui` | Disetujui | `approved` | Ya | Wajib **bila berbeda dari rekomendasi** |
| `dana_lain` | Diajukan ke dana lain | `referred` (status baru) | Tidak | Wajib, ditambah nama sumber dana (3–80 karakter) |
| `dilanjutkan` | Dibawa ke periode berikutnya | tetap `voting` (urgensi tetap) | Tidak | Wajib bila berbeda dari rekomendasi |
| `ditolak` | Ditolak | `rejected` | Tidak | Selalu wajib |

**"Berbeda dari rekomendasi"** berarti: disetujui padahal tidak terpilih, atau tidak disetujui padahal terpilih. Untuk keputusan yang sejalan dan tanpa alasan tertulis, sistem menulis kalimat dari potret angkanya ("Mengikuti rekomendasi: peringkat 2 dari 7, skor 9,6").

### Aturan lain

| Topik | Keputusan |
|---|---|
| Periode | Satu periode berjalan setiap saat. Migrasi membuat periode berjalan **Tahun Anggaran 2027**. |
| Penetapan | Utuh: semua usulan `voting` yang ikut dihitung mendapat tepat satu hasil, dalam satu transaksi. Tidak ada penetapan sebagian. |
| Batas | Total `disetujui` tidak boleh melebihi pagu. Ditolak di database, dan terlihat di layar sebelum tombol ditekan. |
| Data rapat | Tanggal musyawarah (tidak boleh di masa depan) dan catatan musyawarah (20–1.000 karakter), wajib. |
| Bentrok | Penetapan membawa versi periode dan **sidik** hitungan yang dilihat admin (id + status rekomendasi tiap usulan, pagu, versi bobot). Bila sudah berubah, ditolak dengan penjelasan apa yang berubah. Jumlah dukungan **tidak** masuk sidik: dukungan boleh bergerak selama rapat asalkan rekomendasinya sama. |
| Potret | Disimpan saat penetapan: pagu, bobot, dan per usulan: peringkat, skor, status rekomendasi, biaya, dukungan, urgensi, RW. Halaman publik membaca **potret**, bukan menghitung ulang. |
| Akibat pada wilayah | `wilayah.anggaran_lalu` tiap RW diganti dengan jumlah biaya `disetujui` pada periode itu (RW tanpa bagian menjadi 0). `dana_lain` tidak dihitung. Admin melihat akibat ini sebelum menetapkan. |
| Periode baru | Penetapan otomatis membuka periode tahun berikutnya. Pagu dan bobot tidak diubah; admin mengubahnya seperti biasa. |
| Pembatalan | Penetapan **terakhir** bisa dibatalkan dalam 24 jam, dengan alasan, selama belum ada usulannya yang `done`. Semua dikembalikan (status, `anggaran_lalu`, periode). Pembatalan tercatat di jejak publik; catatan lama tidak dihapus, hanya ditandai batal. |
| Selesai dikerjakan | `approved → done` dan `referred → done`, dengan catatan wajib (10–500) dan biaya realisasi (opsional). |
| Koreksi lain | Di luar cakupan. Setelah 24 jam, keputusan tetap. |
| Pencatat | Jejak publik memuat nama pengguna admin, seperti pagu dan bobot. |
| Kata "pengesahan" | Dilarang. Ini **ringkasan keputusan musyawarah**, bukan berita acara resmi atau pengesahan anggaran. Tulis itu di halaman dan hasil cetak. |
| Aturan dukungan | Tidak diubah. `dukung_usulan` sudah menolak status selain `forum` dan `voting`, jadi `referred` otomatis tertutup. |

### Data demo

Seed baru (`seed_keputusan.sql`) berisi **satu periode lampau**, Tahun Anggaran 2026, supaya halaman tidak kosong saat juri membukanya. Cocokkan dengan `anggaran_lalu` yang sudah ada: **RW 01 Rp 250 juta, RW 03 Rp 60 juta, RW 07 Rp 0**. Semua usulannya berstatus `done` atau `rejected`, tidak satu pun `voting`. Periode ini diputuskan **sebelum SUARA dipakai**, jadi tidak punya potret rekomendasi: tampilkan *"Periode ini diputuskan sebelum SUARA dipakai, jadi tidak ada rekomendasi untuk dibandingkan."* Tandai sebagai data purwarupa.

---

## 3. Fakta kode dan masalah yang harus diselesaikan

1. **Teks beranda menjadi bohong setelah periode ditutup.** "Belum pernah menerima anggaran" (`components/landing/WilayahKontras.tsx`) dan "belum pernah menerima anggaran dan kali ini tetap tidak kebagian" (`lib/pagu-model.ts`) disimpulkan dari `anggaran_lalu === 0`, yang artinya hanya **periode lalu**. Setelah penetapan, RW 01 bernilai 0 padahal tahun sebelumnya menerima Rp 250 juta. Ubah menjadi "Tidak menerima anggaran periode lalu", atau baca riwayat periode untuk berkata "belum pernah" dengan benar. Perbarui tesnya.
2. **Pembagian nol.** `WilayahKontras` menghitung `jumlah_suara / maksSuara`; tanpa usulan `voting` hasilnya `NaN%`. `GarisPagu` dengan nol usulan menampilkan batang kosong tanpa penjelasan. Rancang keadaan **"tidak ada usulan dalam hitungan"** untuk beranda: tampilkan ringkasan keputusan periode terakhir dan tautannya, bukan batang kosong.
3. **Status baru `referred`** harus ditambahkan di: constraint `proposals_status_check`, `proposals_urgensi_wajib_setelah_forum` (wajib bernilai), `StatusSiklus` (teks, ikon, gaya), `DIPUTUSKAN` di `lib/forum-filter.ts`, `keteranganTanpaAksi` di `lib/transisi-status.ts`, filter admin, dan tes. Cari semua pemakaian status, jangan hanya daftar ini.
4. **Jenis log baru `decision`**: constraint `accountability_logs_log_type_check`, `JENIS_LOG`, dan `LABEL_JENIS_LOG` ("Keputusan musyawarah") di `lib/jenis-log.ts`.
5. **Status rekomendasi dihitung di TypeScript** (`statusUsulan`: "ditunda" = tidak terpilih tetapi skornya ≥ skor terendah yang terpilih). Fungsi SQL penetapan butuh aturan yang sama untuk potret. Tulis di SQL dan buktikan kesetaraannya dengan TypeScript di tes.
6. **Penguncian:** `pindahkan_status` dan `tampilkan_kembali` memakai `pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0))`. Penetapan dan pembatalan memakai **kunci yang sama**, lalu mengunci baris periode.
7. **Batas 16 `voting`** berlaku saat pembatalan mengembalikan usulan ke `voting` sementara periode baru sudah menerima usulan lain. Tolak dengan penjelasan.
8. **Usulan `voting` yang disembunyikan** tidak ikut dihitung dan tidak ikut ditetapkan; statusnya tetap.
9. **Pola yang dipakai ulang:** `panggilFungsi`, `galat_forum`, `galat_bidang`, `rupiah_teks`, `hasilGalat`, `StatusAksi`, `DialogAlasan`, `periksaAkses`, `KhususAdmin`, `Kerangka`, `PesanBerhasil` (`?berhasil=` kode tertutup), `RiwayatKeputusan`, `PaguBar ringkas`, `modePaguDari`, `bacaDasarHitung`. Bila `components/anggaran/PerbandinganPagu.tsx` sudah dibuat fitur Simulasi, pakai; bila belum, ekstrak dari `PratinjauDampak` (lihat `docs/prompts/simulasi.md` bagian 3).
10. **Tag cache:** tambahkan `keputusan` di `lib/tag-cache.ts`. Penetapan dan pembatalan menyegarkan `beranda`, `forum`, `pengaturan`, `keputusan`, dan `usulan(id)` untuk semua usulan terkait.
11. **`/api/health`** tetap berfungsi; tambahkan `periode` (tahun berjalan) supaya migrasi 0006 bisa dicek dari luar.
12. **Server tiruan E2E** memuat `m0005` terakhir; tambahkan `m0006` dan `seedKeputusan` di `supabase/tests/pglite.ts` dan `e2e/supabase-palsu.ts`.
13. Angka di tes dan README yang menghitung jumlah usulan (13) dan dukungan akan berubah karena seed baru. Perbarui dengan angka yang dihitung, dan pastikan **162 dukungan pada usulan `voting`** serta baseline rekomendasi tidak berubah.

---

## 4. Model data (`supabase/migrations/0006_keputusan.sql`)

Satu transaksi, header berisi urutan menjalankan dan angka pemeriksaan. Syarat minimum; rancang detailnya sendiri.

- **`periode`**: `tahun` unik, `status` (`berjalan` / `diputuskan`), `versi`, `dibuka_pada`, `diputuskan_pada`, `tanggal_musyawarah`, `catatan`, `pagu`, `bobot jsonb`, `ada_rekomendasi boolean`, `wilayah_sebelum jsonb`, `diputuskan_oleh`. Indeks unik parsial: paling banyak satu `berjalan`.
- **`keputusan`**: `periode`, `proposal_id`, `hasil`, `alasan`, `sumber_dana`, potret (peringkat, jumlah usulan, skor, status rekomendasi, biaya, dukungan, urgensi, rw, judul, nama singkat), `beda_dari_rekomendasi`, `dibatalkan_pada`. Unik parsial per (periode, usulan) selama belum dibatalkan. Potret menyimpan **judul saat itu**, tetapi view publik mengosongkannya bila usulannya kelak disembunyikan.
- **Kolom di `proposals`**: `selesai_pada`, `catatan_selesai`, `biaya_realisasi`.
- **Fungsi** (atomik, memeriksa admin aktif): `tetapkan_keputusan(p_akun, p_tahun, p_versi_dibaca, p_sidik, p_tanggal, p_catatan, p_butir jsonb)`, `batalkan_penetapan(p_akun, p_tahun, p_alasan)`, `tandai_selesai(p_akun, p_proposal, p_status_dibaca, p_catatan, p_biaya_realisasi)`, dan `sidik_hitungan()` (stabil, dipakai halaman dan penetapan dari satu sumber).
- **Validasi `p_butir`**: array; tiap butir punya id dan hasil yang sah; tidak ada id ganda, asing, atau terlewat; teks dipangkas; panjang dicek; JSON yang salah bentuk menghasilkan `tidak_valid`, bukan pengecualian.
- **Jejak publik** per penetapan: satu `decision` ringkasan (tahun, jumlah tiap hasil, terpakai, sisa, jumlah yang berbeda) dan satu `status_change` atau `decision` per usulan dengan `proposal_id`, supaya muncul di riwayat usulan di forum.
- **View publik** `v_periode`, `v_keputusan`: tanpa id akun dan tanpa data pribadi.

---

## 5. Elemen khas: dua garis, satu keputusan

Halaman keputusan menempatkan **dua Garis Pagu** bertumpuk dengan skala yang sama: "Rekomendasi SUARA" dan "Keputusan musyawarah". Usulan yang sama berada di kedua batang; yang **berbeda** ditandai bentuk (bingkai putus-putus dan tanda ≠), bukan hanya warna. Tepat di bawahnya, bagian yang paling menonjol di halaman: **"Di mana musyawarah berbeda"**, berisi alasan tertulis dengan huruf besar yang nyaman dibaca. Bila tidak ada: *"Musyawarah mengikuti seluruh rekomendasi."*

**Cap keputusan.** Cap stempel biru berbingkai 3 px, sedikit miring (±2–3°), berisi "DIPUTUSKAN · 20 November 2026". Biru stempel memang untuk "yang dicap" (`DESIGN.md`). Satu cap per halaman, dan tetap terbaca sebagai teks.

**Siap cetak.** `@media print` menghasilkan lembar A4 rapi yang bisa ditempel di papan pengumuman balai desa: tanpa navigasi dan tombol, latar putih, batang tetap terbaca hitam-putih (pola atau bingkai, bukan warna), tabel keputusan tidak terpotong di tengah baris, dan catatan kaki "Ringkasan keputusan musyawarah, bukan pengesahan anggaran. Data purwarupa." beserta alamat halaman. Ini jembatan nyata antara aplikasi dan papan pengumuman fisik; rancang dengan sungguh-sungguh.

```
/keputusan/2027 (1440 px)                          360 px: satu lajur, urutan sama
┌──────────────────────────────────────────────┐
│ Tahun Anggaran 2027            [cap DIPUTUSKAN]
│ Rp 285 juta dari pagu Rp 300 juta, 4 usulan
│ ═══════════════════════════════════════════
│ Rekomendasi SUARA
│ [Drainase 90][Jembatan 70][Lampu 40][Jalan 85][·]
│ Keputusan musyawarah
│ [Drainase 90][Jembatan 70][Lampu 40][Jalan 85][·]
│
│ Di mana musyawarah berbeda
│   …alasan…
│ ─────────────────────────────────────────
│ Semua keputusan            (tabel bercaption)
│ Anggaran tiap RW           (Rp, Rp per penduduk, vs periode lalu)
│ Catatan musyawarah
│ [Cetak ringkasan]  [Unduh data (CSV)]
└──────────────────────────────────────────────┘
```

---

## 6. Layar

### `/keputusan` (publik)

- **Periode berjalan** di atas: "Tahun Anggaran 2027 belum diputuskan", ringkasan rekomendasi saat ini (jumlah terbiayai, sisa), tautan ke beranda dan Simulasi.
- **Periode yang sudah diputuskan**: satu baris bergaris per tahun dengan terpakai/pagu, jumlah per hasil, jumlah yang berbeda, tautan.
- **Jejak keputusan lengkap**: semua `accountability_logs`, saring per jenis, paginasi lewat URL (tautan "Lihat semua keputusan" di beranda menuju ke sini). Server tiruan E2E belum mendukung `range`/`offset`: perluas, atau pakai pola "muat lebih banyak" seperti forum.
- Data cadangan: penanda, tanpa galat.

### `/keputusan/[tahun]` (publik)

Bagian 5. `notFound()` untuk tahun yang tidak ada. Periode yang penetapannya dibatalkan tampil sebagai belum diputuskan, dengan catatan pembatalan terbaca di jejak. Ringkasan untuk berbagi (`openGraph`) memakai teks, bukan gambar baru, kecuali pola `opengraph-image` yang ada mudah dipakai ulang.

**Unduh CSV:** `route.ts` **baca saja**, dari potret publik, UTF-8 dengan BOM supaya rapi di Excel, dan sel yang diawali `= + - @` dinetralkan (injeksi rumus). Kerjakan terakhir.

### `/admin/keputusan` (bagian baru di navigasi admin)

Navigasi admin menjadi enam bagian; pastikan rapi di 360 px.

1. **Lembar kerja.** Satu baris register per usulan, urut peringkat: judul, RW, biaya, skor, `StatusLabel` rekomendasi, dan empat pilihan hasil (radio asli, tampil sebagai kelompok tombol). **Tidak ada pilihan bawaan.** Kolom alasan dan sumber dana muncul tepat saat dibutuhkan, dengan penjelasan mengapa wajib ("Berbeda dari rekomendasi, jadi warga perlu tahu alasannya").
   - Tombol "Isi sisanya sesuai rekomendasi": hanya mengisi yang belum dipilih (terpilih → Disetujui, lainnya → Dibawa ke periode berikutnya). Bisa diubah lagi.
   - Ringkasan yang selalu terlihat (menempel di dasar layar ponsel): "Terpakai Rp 285 juta dari Rp 300 juta · sisa Rp 15 juta · 2 belum diisi · 1 berbeda". Melebihi pagu: pesan galat yang menyebut kelebihannya.
   - **Draf di perangkat** (`localStorage`, dibungkus `try/catch`, kunci per tahun dan sidik): rapat bisa lama dan sinyal bisa putus. Pemberitahuan saat draf dipulihkan, tombol hapus draf, dan dibuang setelah penetapan berhasil.
2. **Tinjau dan tetapkan.** Ringkasan hanya-baca (pratinjau halaman publiknya), tanggal dan catatan musyawarah, **akibat untuk periode berikutnya** (tabel anggaran periode lalu per RW: sekarang → sesudah), dan kotak centang "Ini hasil musyawarah yang sebenarnya". Tombol "Tetapkan keputusan" (aksi berisiko).
3. **Sesudah penetapan.** Konfirmasi dengan tautan halaman publik, dan "Batalkan penetapan" dengan sisa waktu. Penghitung waktu tidak mengumumkan tiap detik ke pembaca layar.
4. **Pekerjaan berjalan:** daftar `approved` dan `referred` dengan aksi "Tandai selesai" (dialog: catatan wajib, biaya realisasi opsional dengan `parseRupiah`).
5. **Ringkasan admin** (`/admin`): tambah baris "Tahun Anggaran 2027: n usulan menunggu keputusan".

### Detail usulan di forum

Untuk usulan yang sudah diputuskan: blok tenang "Diputuskan pada musyawarah 20 November 2026: Disetujui. [alasan]" dengan tautan ke halaman tahunnya; untuk `done`, catatan dan realisasi.

### Keadaan

| Keadaan | Perilaku |
|---|---|
| Nol usulan `voting` | Lembar kerja diganti penjelasan; penetapan tidak tersedia |
| Melebihi pagu | Tombol lanjut ditahan dengan penjelasan angka; ditolak juga oleh database |
| Rekomendasi berubah saat mengisi | Galat bentrok: sebut usulan yang berubah dan tawarkan muat ulang **tanpa** membuang draf |
| Admin lain sudah menetapkan | Pesan dengan nama dan jam, tautan ke hasilnya |
| Sesi habis | Galat `belum_masuk`, tautan masuk kembali, draf utuh |
| Lewat 24 jam | Tombol batal hilang, dengan keterangan |
| Pembatalan terhalang batas 16 | Penjelasan dan jalan keluar |

---

## 7. Kriteria penerimaan

| ID | Kriteria | Bukti yang diminta |
|---|---|---|
| K-01 | Migrasi 0006 dan seed tidak mengubah angka beranda: baseline sama, 4 terpilih, 162 dukungan `voting` | Tes SQL |
| K-02 | Hanya admin aktif yang bisa menetapkan, membatalkan, menandai selesai; `anon` tanpa hak `execute`; view kosong bagi `anon` | Tes SQL per fungsi |
| K-03 | Semua aturan bagian 2 ditegakkan **di database**: butir kurang/ganda/asing, alasan wajib, sumber dana, melebihi pagu, tanggal masa depan, versi, sidik | Tes SQL per aturan |
| K-04 | Mengikuti rekomendasi sepenuhnya (pagu 300 juta): terpakai Rp 285 juta; `anggaran_lalu` menjadi RW 01 = 0, RW 03 = 85 juta, RW 07 = 200 juta; periode 2028 terbuka | Tes SQL dengan angka ini |
| K-05 | Potret tidak berubah walau dukungan, bobot, atau pagu berubah sesudahnya | Tes SQL |
| K-06 | Status rekomendasi di potret sama dengan `statusUsulan` TypeScript untuk ≥ 5 kombinasi pagu dan bobot | Tes SQL + TS |
| K-07 | Batal dalam 24 jam memulihkan **semua** keadaan persis (bandingkan potret database sebelum dan sesudah); lewat 24 jam, ada `done`, atau batas 16 → ditolak | Tes SQL |
| K-08 | Dua penetapan bersamaan: hanya satu yang berhasil | Tes SQL (versi) |
| K-09 | Status `referred` ditangani di semua tempat; tidak ada teks "undefined" atau status mentah di layar | Pencarian kode + E2E |
| K-10 | Beranda benar untuk: nol `voting`, RW dengan `anggaran_lalu = 0`, dan sesudah penetapan; tidak ada `NaN` | Tes unit + E2E |
| K-11 | Setelah penetapan, beranda, forum, detail usulan, dan `/keputusan` langsung berubah tanpa menunggu cache | E2E |
| K-12 | Alur penuh: isi lembar kerja (satu berbeda dengan alasan) → tetapkan → halaman publik → batalkan → tetapkan lagi → tandai selesai | E2E, konsol bersih |
| K-13 | Draf bertahan setelah muat ulang dan sesi habis | E2E |
| K-14 | Cetak: PDF A4 dari Playwright (`page.pdf`) terbaca, tidak terpotong | Berkas PDF dilihat dan dilampirkan jalurnya |
| K-15 | CSV terbuka benar, rumus dinetralkan | Tes unit |
| K-16 | axe 0, keyboard, reflow, target 44 px di semua layar dan keadaan baru | E2E |
| K-17 | Setiap aspek mutu desain ≥ 4 di 360 dan 1440 px | Tabel nilai + tangkapan layar |
| K-18 | Semua tes dan E2E lama tetap hijau | Keluaran perintah |

---

## 8. Dokumentasi

1. `README.md`: Fitur, bagian "Keputusan musyawarah" + cara mencoba, langkah SQL 0006 dan seed dengan angka pemeriksaan, jumlah tes, struktur folder; perbarui angka 13 usulan.
2. `docs/keputusan.md`: diagram status lengkap (Mermaid), apa yang dipotret dan mengapa, cara kerja sidik, akibat pada pemerataan periode berikutnya beserta contoh angka, aturan pembatalan, jejak publik, keterbatasan.
3. Perbarui `docs/admin.md`, `docs/forum.md` (siklus status), `DESIGN.md` (dua garis, cap keputusan, lembar kerja, gaya cetak), `PRODUCT.md`.

## 9. Langkah manual untuk pemilik proyek

**Sebelum push atau deploy** (Cloud Run):

1. Cadangkan: Supabase → Database → Backups, atau catat bahwa data demo bisa dibuat ulang dari seed.
2. SQL Editor: jalankan `supabase/migrations/0006_keputusan.sql`, lalu `supabase/seed_keputusan.sql`.
3. Cek (agen mengisi angka pastinya di laporan):
   ```sql
   select tahun, status from periode order by tahun;                     -- 2026 diputuskan, 2027 berjalan
   select count(*) from rekomendasi_resmi(300000000) where selected;     -- 4
   select count(*) from votes
    where proposal_id in (select id from proposals where status='voting'); -- 162
   select rw, anggaran_lalu from wilayah order by rw;                    -- 250000000, 60000000, 0
   ```
4. `npm run embedding:isi`, lalu jalankan SQL yang tercetak (usulan periode lampau belum punya embedding).

**Sesudah push:**

5. `/api/health` memuat `"periode":2027`. Beranda tidak berubah. `/keputusan` menampilkan 2026.
6. **Hati-hati saat demo:** menetapkan keputusan mengosongkan sebagian hitungan beranda. Itu memang tujuannya, tetapi **batalkan dalam 24 jam** setelah latihan supaya juri melihat Garis Pagu penuh. Setelah 24 jam, pemulihan hanya lewat SQL; minta agen menyertakan `supabase/demo_pulihkan_periode.sql` beserta peringatannya.

## Di luar cakupan

Koreksi keputusan sesudah 24 jam, tanda tangan digital, unggah berkas, rencana kerja rinci dan progres persen, notifikasi, perubahan aturan dukungan, dan perubahan rumus skor.
