-- =============================================================================
-- SUARA — Data contoh forum
-- Jalankan SETELAH migrasi 0004 (urutan: 0001 -> 0002 -> seed.sql -> 0003 -> 0004
-- -> seed_forum.sql). Seluruh nama warga dan isi komentar di sini fiktif.
--
-- Aman dijalankan ulang: setiap baris punya id tetap dan memakai
-- `on conflict do nothing`, jadi tidak ada yang ganda atau dihapus.
-- Berbeda dari seed.sql, file ini TIDAK menghapus apa pun.
--
-- Tidak menyentuh tujuh usulan berstatus 'voting' maupun 162 dukungannya. Angka
-- halaman utama (Garis Pagu, rekomendasi) tidak berubah. Satu hal yang tampak di
-- halaman utama: entri moderasi (langkah 6) ikut muncul di "Jejak keputusan".
--
-- Isi:
--   - 6 usulan berstatus 'forum', dukungannya tersebar di RW 01, RW 03, dan RW 07
--   - 15 komentar, satu di antaranya sudah disembunyikan admin beserta jejaknya
--   - Satu usulan sengaja mirip dengan usulan voting yang sudah ada
--     ("Lampu jalan gang RW 07 gelap" ~ "Lampu PJU jalan setapak RW 07"),
--     untuk mencoba fitur gabung dukungan.
--   - Akun penulis komentar `seed-*`. Akun ini NONAKTIF dan hash kata sandinya tidak
--     bisa dicocokkan dengan kata sandi apa pun, jadi tidak ada yang bisa masuk lewat akun ini.
--   - Langkah terakhir menautkan akun demo `warga` (kalau sudah dibuat) ke warga RW 07
--     nomor 70. Tanpa tautan itu akun warga tidak boleh mendukung (aturan: dukungan
--     hanya dari akun yang punya warga_id).
--
-- Embedding usulan ini belum terisi. Jalankan `npm run embedding:isi` setelahnya
-- supaya pemeriksaan usulan serupa memakai makna, bukan hanya kemiripan kata.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Akun penulis komentar (nonaktif)
-- -----------------------------------------------------------------------------
insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif)
select v.id::uuid, v.nama_pengguna,
       '$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp',
       v.peran,
       (select w.id from warga w where w.nomor = v.nomor),
       false
from (values
    ('6f1b3d0a-2001-4c8e-9a10-000000000001', 'seed-w01', 'warga',  5),   -- RW 01
    ('6f1b3d0a-2001-4c8e-9a10-000000000002', 'seed-w02', 'warga', 12),   -- RW 01
    ('6f1b3d0a-2001-4c8e-9a10-000000000003', 'seed-w03', 'warga', 44),   -- RW 03
    ('6f1b3d0a-2001-4c8e-9a10-000000000004', 'seed-w04', 'warga', 50),   -- RW 03
    ('6f1b3d0a-2001-4c8e-9a10-000000000005', 'seed-w05', 'warga', 62),   -- RW 07
    ('6f1b3d0a-2001-4c8e-9a10-000000000006', 'seed-w06', 'warga', 66),   -- RW 07
    ('6f1b3d0a-2001-4c8e-9a10-000000000007', 'seed-admin', 'admin', null)
) as v (id, nama_pengguna, peran, nomor)
on conflict (nama_pengguna) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Usulan berstatus 'forum'. urgency_score sengaja kosong: warga tidak menilai
--    urgensi usulannya sendiri.
-- -----------------------------------------------------------------------------
insert into proposals
    (id, title, nama_singkat, description, category, estimated_budget, status, source,
     proposer_id, rw, created_at)
select v.id::uuid, v.title, v.nama_singkat, v.description, v.category, v.biaya,
       'forum', 'forum',
       (select w.id from warga w where w.nomor = v.nomor_pengusul),
       v.rw, now() - v.umur
from (values
    ('6f1b3d0a-1001-4c8e-9a10-000000000001',
     'Lampu jalan gang RW 07 gelap', 'Lampu gang',
     'Gang di belakang musala RW 07 tidak ada lampunya sama sekali. Malam hari ibu-ibu dan anak-anak pengajian takut lewat, dan sudah dua kali ada yang terjatuh di lubang dekat selokan. Kami usul dipasang lampu di sepanjang gang, sekitar enam titik.',
     'infrastruktur', 25000000, 66, 7, interval '2 days 3 hours'),
    ('6f1b3d0a-1001-4c8e-9a10-000000000002',
     'Timbangan dan meja baru untuk posyandu RW 03', 'Posyandu',
     'Timbangan bayi di posyandu RW 03 sudah tidak akurat, angkanya sering selisih setengah kilo. Meja dan kursi kader juga sudah goyang. Kami usul mengganti timbangan, dua meja, dan delapan kursi.',
     'kesehatan', 12500000, 44, 3, interval '4 days'),
    ('6f1b3d0a-1001-4c8e-9a10-000000000003',
     'Atap pos ronda RW 01 bocor saat hujan', 'Atap pos ronda',
     'Atap pos ronda di depan balai RW 01 bocor di sisi kiri. Setiap hujan, bapak-bapak yang ronda terpaksa pindah ke teras rumah Pak RT. Perlu ganti beberapa lembar seng dan rangka kayunya.',
     'fasilitas', 8000000, 5, 1, interval '5 days'),
    ('6f1b3d0a-1001-4c8e-9a10-000000000004',
     'Tong sampah terpilah di pasar RW 03', 'Tong sampah',
     'Sampah pasar RW 03 menumpuk di satu titik dan bercampur antara sisa sayur dan plastik. Kami usul menyediakan tong sampah organik dan anorganik di lima titik, dengan jadwal angkut yang jelas.',
     'lingkungan', 15000000, 50, 3, interval '6 days'),
    ('6f1b3d0a-1001-4c8e-9a10-000000000005',
     'Pelatihan menjahit untuk ibu rumah tangga', 'Pelatihan menjahit',
     'Beberapa ibu di RW 01 ingin punya penghasilan tambahan dari menjahit. Kami usul pelatihan menjahit dasar selama dua bulan, dengan pelatih dari luar desa dan beberapa mesin jahit yang bisa dipakai bergantian.',
     'ekonomi', 18000000, 12, 1, interval '8 days'),
    ('6f1b3d0a-1001-4c8e-9a10-000000000006',
     'Lampu taman lapangan RW 01 sering mati', 'Lampu lapangan',
     'Dua dari empat lampu di lapangan RW 01 sering mati, jadi anak-anak yang latihan voli sore hari pulang dalam gelap. Kami usul ganti lampu dan perbaiki kabelnya.',
     'infrastruktur', 6000000, 27, 1, interval '9 days')
) as v (id, title, nama_singkat, description, category, biaya, nomor_pengusul, rw, umur)
on conflict (id) do nothing;
-- (Trigger trg_dukungan_pengusul sudah memberi satu dukungan dari tiap pengusul.)

-- -----------------------------------------------------------------------------
-- 3. Dukungan tambahan. Warga bernomor a sampai b mendukung usulan itu.
--    Nomor 1-40 RW 01, 41-60 RW 03, 61-70 RW 07. Nomor 70 (akun demo) sengaja tidak ikut,
--    supaya masih ada yang bisa didukung saat mencoba.
-- -----------------------------------------------------------------------------
with target (id, dari, sampai) as (
    values
        -- Lampu gang RW 07: 6 warga RW 07 dan 2 dari RW 03
        ('6f1b3d0a-1001-4c8e-9a10-000000000001'::uuid, 62, 67),
        ('6f1b3d0a-1001-4c8e-9a10-000000000001'::uuid, 41, 42),
        -- Posyandu RW 03: 10 warga RW 03 dan 3 dari RW 01
        ('6f1b3d0a-1001-4c8e-9a10-000000000002'::uuid, 41, 50),
        ('6f1b3d0a-1001-4c8e-9a10-000000000002'::uuid,  3,  5),
        -- Atap pos ronda RW 01: 9 warga RW 01 dan 1 dari RW 07
        ('6f1b3d0a-1001-4c8e-9a10-000000000003'::uuid,  1,  9),
        ('6f1b3d0a-1001-4c8e-9a10-000000000003'::uuid, 61, 61),
        -- Tong sampah pasar RW 03
        ('6f1b3d0a-1001-4c8e-9a10-000000000004'::uuid, 51, 56),
        ('6f1b3d0a-1001-4c8e-9a10-000000000004'::uuid, 10, 12),
        -- Pelatihan menjahit RW 01
        ('6f1b3d0a-1001-4c8e-9a10-000000000005'::uuid, 13, 24),
        -- Lampu lapangan RW 01
        ('6f1b3d0a-1001-4c8e-9a10-000000000006'::uuid, 25, 27),
        ('6f1b3d0a-1001-4c8e-9a10-000000000006'::uuid, 57, 57),
        ('6f1b3d0a-1001-4c8e-9a10-000000000006'::uuid, 68, 68)
)
insert into votes (proposal_id, warga_id, created_at)
select t.id, w.id, now() - interval '1 day'
from target t
join proposals p on p.id = t.id
join warga     w on w.nomor between t.dari and t.sampai
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. Komentar. Pendek dan konkret, seperti ditulis warga.
-- -----------------------------------------------------------------------------
insert into komentar (id, proposal_id, akun_id, isi, created_at)
select v.id::uuid, v.proposal::uuid, a.id, v.isi, now() - v.umur
from (values
    -- Lampu jalan gang RW 07
    ('6f1b3d0a-3001-4c8e-9a10-000000000001', '6f1b3d0a-1001-4c8e-9a10-000000000001', 'seed-w05',
     'Betul, gang belakang musala itu gelap sekali. Kemarin Bu RT hampir jatuh karena lubang dekat selokan.',
     interval '2 days 1 hour'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000002', '6f1b3d0a-1001-4c8e-9a10-000000000001', 'seed-w06',
     'Setahu saya tiang listriknya sudah ada, tinggal pasang lampu. Mungkin biayanya bisa lebih kecil dari Rp 25 juta.',
     interval '1 day 20 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000003', '6f1b3d0a-1001-4c8e-9a10-000000000001', 'seed-admin',
     'Terima kasih atas usulannya. Perangkat desa akan menghitung jumlah titik lampu yang dibutuhkan bersama ketua RT, lalu hasilnya ditulis di sini.',
     interval '1 day 6 hours'),
    -- Posyandu RW 03
    ('6f1b3d0a-3001-4c8e-9a10-000000000004', '6f1b3d0a-1001-4c8e-9a10-000000000002', 'seed-w03',
     'Timbangan yang sekarang sudah tidak akurat. Bulan lalu berat anak saya tercatat turun, padahal setelah ditimbang di puskesmas naik.',
     interval '3 days 20 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000005', '6f1b3d0a-1001-4c8e-9a10-000000000002', 'seed-w04',
     'Setuju. Meja dan kursinya juga sudah goyang. Kader sering membawa meja lipat dari rumah sendiri.',
     interval '3 days 8 hours'),
    -- Atap pos ronda RW 01
    ('6f1b3d0a-3001-4c8e-9a10-000000000006', '6f1b3d0a-1001-4c8e-9a10-000000000003', 'seed-w01',
     'Bocornya di sisi kiri, tepat di atas bangku. Kalau hujan deras, ronda pindah ke teras rumah Pak RT.',
     interval '4 days 18 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000007', '6f1b3d0a-1001-4c8e-9a10-000000000003', 'seed-w02',
     'Mungkin cukup ganti beberapa lembar seng dan reng kayunya. Rp 8 juta sepertinya sudah cukup.',
     interval '4 days 2 hours'),
    -- Tong sampah pasar RW 03
    ('6f1b3d0a-3001-4c8e-9a10-000000000008', '6f1b3d0a-1001-4c8e-9a10-000000000004', 'seed-w03',
     'Kalau tongnya dibedakan, siapa yang mengangkut? Mohon dipikirkan jadwal petugasnya.',
     interval '5 days 20 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000009', '6f1b3d0a-1001-4c8e-9a10-000000000004', 'seed-w04',
     'Pedagang sayur sudah bersedia memilah kalau tempatnya tersedia. Yang sulit biasanya pedagang gorengan.',
     interval '5 days 10 hours'),
    -- Komentar ini disembunyikan admin di langkah 5
    ('6f1b3d0a-3001-4c8e-9a10-000000000010', '6f1b3d0a-1001-4c8e-9a10-000000000004', 'seed-w02',
     'Dapatkan pulsa murah dan diskon belanja di http://contoh.invalid/promo, klik sekarang.',
     interval '3 days'),
    -- Pelatihan menjahit RW 01
    ('6f1b3d0a-3001-4c8e-9a10-000000000011', '6f1b3d0a-1001-4c8e-9a10-000000000005', 'seed-w02',
     'Sudah ada tiga ibu di RT 4 yang mau ikut. Kira-kira pelatihannya berapa kali seminggu?',
     interval '7 days 20 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000012', '6f1b3d0a-1001-4c8e-9a10-000000000005', 'seed-w01',
     'Mesin jahitnya dipinjamkan atau peserta bawa sendiri? Sebaiknya itu dijelaskan di rincian biaya.',
     interval '7 days 4 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000013', '6f1b3d0a-1001-4c8e-9a10-000000000005', 'seed-admin',
     'Pertanyaan yang bagus. Pengusul, mohon tambahkan perkiraan jumlah peserta dan siapa yang menyediakan mesin.',
     interval '6 days 22 hours'),
    -- Lampu lapangan RW 01
    ('6f1b3d0a-3001-4c8e-9a10-000000000014', '6f1b3d0a-1001-4c8e-9a10-000000000006', 'seed-w01',
     'Yang mati lampu sebelah timur dan selatan. Kabelnya juga ada yang terkelupas, hati-hati kalau hujan.',
     interval '8 days 12 hours'),
    ('6f1b3d0a-3001-4c8e-9a10-000000000015', '6f1b3d0a-1001-4c8e-9a10-000000000006', 'seed-w05',
     'Lapangan ini dipakai anak-anak RW lain juga kalau ada turnamen. Semoga cepat diperbaiki.',
     interval '8 days 1 hour')
) as v (id, proposal, nama_akun, isi, umur)
join akun a on a.nama_pengguna = v.nama_akun
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. Satu komentar sudah disembunyikan admin, lengkap dengan alasan dan jejaknya.
--    (Pola yang sama dengan fungsi sembunyikan(): ubah baris, lalu catat di log.)
-- -----------------------------------------------------------------------------
with disembunyikan as (
    update komentar
       set disembunyikan_pada   = now() - interval '2 days 12 hours',
           alasan_disembunyikan = 'Berisi tautan promosi yang tidak berkaitan dengan usulan.'
     where id = '6f1b3d0a-3001-4c8e-9a10-000000000010'
       and disembunyikan_pada is null
    returning proposal_id, id, alasan_disembunyikan, disembunyikan_pada
)
insert into accountability_logs (log_type, proposal_id, actor, message, detail, created_at)
select 'moderation', d.proposal_id, 'admin',
       'Satu komentar disembunyikan oleh admin desa. Alasan: ' || d.alasan_disembunyikan,
       jsonb_build_object('jenis', 'komentar', 'id', d.id, 'alasan', d.alasan_disembunyikan),
       d.disembunyikan_pada
from disembunyikan d;

-- -----------------------------------------------------------------------------
-- 6. Tautkan akun demo `warga` ke warga RW 07 nomor 70 (hanya kalau belum tertaut).
-- -----------------------------------------------------------------------------
update akun
   set warga_id = (select id from warga where nomor = 70)
 where nama_pengguna = 'warga'
   and peran = 'warga'
   and warga_id is null;

commit;
