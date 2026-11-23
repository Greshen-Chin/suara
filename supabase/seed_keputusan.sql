-- =============================================================================
-- SUARA — Data contoh keputusan (DATA PURWARUPA)
-- Jalankan SETELAH migrasi 0006 (urutan: ... -> 0005 -> 0006 -> seed_keputusan.sql).
--
-- Satu periode lampau, Tahun Anggaran 2026, supaya /keputusan tidak kosong. Periode ini diputuskan
-- SEBELUM SUARA dipakai, jadi tidak punya potret rekomendasi: halaman menyebutnya terus terang.
-- Jumlahnya cocok dengan wilayah.anggaran_lalu yang sudah ada di seed.sql:
--   RW 01 Rp 250 juta (150 + 100), RW 03 Rp 60 juta, RW 07 Rp 0.
-- Semua usulannya berstatus 'done' atau 'rejected', tidak satu pun 'voting', dan tidak ada dukungan baru:
-- angka halaman utama (Garis Pagu, 162 dukungan pada usulan voting) TIDAK berubah.
--
-- Aman dijalankan ulang: setiap baris punya id tetap dan memakai `on conflict do nothing`.
-- Embedding usulan ini belum terisi; jalankan `npm run embedding:isi` setelahnya.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Usulan Tahun Anggaran 2026 (sudah dikerjakan, dan satu yang ditolak)
-- -----------------------------------------------------------------------------
insert into proposals
    (id, title, nama_singkat, description, category, estimated_budget, status, source, rw,
     urgency_score, urgency_reason, created_at, selesai_pada, catatan_selesai, biaya_realisasi)
values
    ('6f1b3d0a-1002-4c8e-9a10-000000000001',
     'Rehabilitasi saluran irigasi sawah RW 01', 'Irigasi sawah',
     'Perbaikan saluran irigasi sepanjang sekitar 420 meter yang retak dan tersumbat lumpur.',
     'infrastruktur', 150000000, 'done', 'musrenbang', 1, 8,
     'Sawah di ujung saluran sering kekurangan air pada musim tanam kedua.',
     timestamptz '2025-09-10 09:00+07', timestamptz '2026-08-14 10:00+07',
     'Saluran selesai dan sudah dipakai musim tanam kedua. Air sampai ke sawah paling ujung.', 147500000),
    ('6f1b3d0a-1002-4c8e-9a10-000000000002',
     'Perbaikan jalan lingkungan RW 01', 'Jalan lingkungan',
     'Pengaspalan ulang jalan lingkungan utama RW 01 yang berlubang di banyak titik.',
     'infrastruktur', 100000000, 'done', 'musrenbang', 1, 6,
     'Jalan berlubang mengganggu pengendara, tetapi masih bisa dilewati.',
     timestamptz '2025-09-10 09:30+07', timestamptz '2026-06-02 15:00+07',
     'Pengaspalan selesai di seluruh ruas yang diusulkan.', 100000000),
    ('6f1b3d0a-1002-4c8e-9a10-000000000003',
     'Pembangunan MCK umum RW 03', 'MCK umum',
     'MCK umum dengan sumber air bersih untuk keluarga di RW 03 yang belum punya kamar mandi sendiri.',
     'kesehatan', 60000000, 'done', 'musrenbang', 3, 7,
     'Belasan keluarga masih memakai sungai untuk mandi dan mencuci.',
     timestamptz '2025-09-11 10:00+07', timestamptz '2026-07-20 11:00+07',
     'Bangunan MCK dan sumur bor selesai. Pengelolaannya diserahkan ke pengurus RW 03.', 58000000),
    ('6f1b3d0a-1002-4c8e-9a10-000000000004',
     'Pembangunan kolam renang desa', 'Kolam renang',
     'Kolam renang umum berukuran sedang di dekat lapangan.',
     'fasilitas', 400000000, 'rejected', 'musrenbang', 3, 2,
     'Hiburan dan olahraga. Layanan dasar tidak terganggu bila tidak dibangun.',
     timestamptz '2025-09-11 10:30+07', null, null, null)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Periode 2026, sudah diputuskan sebelum SUARA dipakai (tanpa rekomendasi, tanpa potret)
--    pagu Rp 320 juta: 310 juta terpakai, sisa 10 juta. Angka purwarupa.
-- -----------------------------------------------------------------------------
insert into periode (tahun, status, versi, dibuka_pada, diputuskan_pada, tanggal_musyawarah, catatan,
                     pagu, bobot, ada_rekomendasi, wilayah_sebelum, diputuskan_oleh)
values (2026, 'diputuskan', 1, timestamptz '2025-09-01 08:00+07', timestamptz '2025-12-12 20:00+07',
        date '2025-12-12',
        'Musyawarah desa di balai warga, dihadiri perwakilan RT dan RW. Tiga usulan disetujui, satu ditolak karena biayanya melebihi sisa pagu dan bukan kebutuhan dasar.',
        320000000, null, false, null, null)
on conflict (tahun) do nothing;

insert into keputusan (tahun, proposal_id, hasil, alasan, biaya, dukungan, urgensi, rw, judul, nama_singkat,
                       beda_dari_rekomendasi, created_at)
select 2026, p.id, v.hasil, v.alasan, p.estimated_budget, 0, p.urgency_score, p.rw, p.title, p.nama_singkat,
       false, timestamptz '2025-12-12 20:00+07'
  from (values
      ('6f1b3d0a-1002-4c8e-9a10-000000000001'::uuid, 'disetujui', null::text),
      ('6f1b3d0a-1002-4c8e-9a10-000000000002'::uuid, 'disetujui', null),
      ('6f1b3d0a-1002-4c8e-9a10-000000000003'::uuid, 'disetujui', null),
      ('6f1b3d0a-1002-4c8e-9a10-000000000004'::uuid, 'ditolak',
       'Biayanya Rp 400 juta, lebih besar dari seluruh sisa pagu, dan kolam renang bukan kebutuhan dasar warga tahun ini.')
  ) as v (id, hasil, alasan)
  join proposals p on p.id = v.id
on conflict (tahun, proposal_id) where dibatalkan_pada is null do nothing;

commit;
