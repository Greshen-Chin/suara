-- =============================================================================
-- SUARA — Data contoh (seed)
-- Jalankan SETELAH migrasi 0002. Desa dan nama warga di bawah ini fiktif.
-- Aman dijalankan ulang: data demo lama dihapus lebih dulu.
--
-- Hasil yang diharapkan untuk pagu Rp 300.000.000:
--   Suara terbanyak     : Gapura + Pengecatan balai warga (Rp 290 jt, sisa Rp 10 jt)
--   Rekomendasi SUARA   : Jalan SDN 03 + Drainase + Jembatan + Lampu PJU (Rp 285 jt, sisa Rp 15 jt)
--   Ditunda             : Talud RW 07 (Rp 220 jt)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Bersihkan data demo lama
-- -----------------------------------------------------------------------------
truncate accountability_logs, votes, proposals, warga restart identity cascade;

-- -----------------------------------------------------------------------------
-- 1. Wilayah
-- -----------------------------------------------------------------------------
insert into wilayah (rw, nama, penduduk, anggaran_lalu)
values (1, 'RW 01', 3000, 250000000),
       (3, 'RW 03', 2000,  60000000),
       (7, 'RW 07',  400,          0)
on conflict (rw) do update
set nama = excluded.nama,
    penduduk = excluded.penduduk,
    anggaran_lalu = excluded.anggaran_lalu;

-- -----------------------------------------------------------------------------
-- 2. Bobot resmi 30/40/30. Trigger log dimatikan sebentar karena entri log-nya
--    ditulis manual di langkah 6, dengan tanggal yang runtut.
-- -----------------------------------------------------------------------------
alter table scoring_weights disable trigger scoring_weights_log;

update scoring_weights
set w_popularitas = 30,
    w_urgensi     = 40,
    w_pemerataan  = 30,
    catatan       = 'Bobot ditetapkan musyawarah desa'
where id = 1;

alter table scoring_weights enable trigger scoring_weights_log;

-- -----------------------------------------------------------------------------
-- 3. Warga: 70 orang. Nomor 1-40 di RW 01, 41-60 di RW 03, 61-70 di RW 07.
-- -----------------------------------------------------------------------------
insert into warga (nama, rt, rw)
select
    (array['Agus', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah'])[(n - 1) % 9 + 1]
    || ' ' ||
    (array['Santoso', 'Wijaya', 'Lestari', 'Pratama', 'Hidayat', 'Kusuma', 'Rahayu', 'Nugroho'])[(n - 1) / 9 + 1],
    ((n - 1) % 5 + 1)::smallint,
    (case when n <= 40 then 1 when n <= 60 then 3 else 7 end)::smallint
from generate_series(1, 70) as n;

-- -----------------------------------------------------------------------------
-- 4. Usulan berstatus 'voting'. urgency_score skala 1-10 beserta alasan tertulisnya.
-- -----------------------------------------------------------------------------
insert into proposals
    (title, nama_singkat, description, category, estimated_budget, status, source,
     rw, urgency_score, urgency_reason)
values
    ('Gapura dan taman gerbang desa', 'Gapura',
     'Gapura baru di pintu masuk desa beserta taman kecil di kiri dan kanannya.',
     'fasilitas', 180000000, 'voting', 'musrenbang', 1, 3,
     'Mempercantik tampilan desa. Layanan dasar dan keselamatan warga tidak terganggu bila ditunda.'),
    ('Pengecatan ulang balai warga', 'Balai warga',
     'Pengecatan ulang dinding dalam dan luar balai warga RW 01.',
     'fasilitas', 110000000, 'voting', 'musrenbang', 1, 2,
     'Perawatan tampilan. Balai warga masih bisa dipakai seperti biasa.'),
    ('Perbaikan jalan berlubang depan SDN 03', 'Jalan SDN 03',
     'Penambalan dan pengaspalan ulang jalan di depan gerbang SDN 03.',
     'infrastruktur', 85000000, 'voting', 'musrenbang', 3, 8,
     'Lubang di depan sekolah membahayakan anak dan pengendara setiap hari, terutama saat hujan.'),
    ('Talud penahan longsor tebing RW 07', 'Talud',
     'Talud beton penahan tebing yang rawan longsor di dekat rumah warga RW 07.',
     'infrastruktur', 220000000, 'voting', 'musrenbang', 7, 10,
     'Tebing rawan longsor saat hujan deras dan berdekatan dengan rumah warga. Risiko keselamatan tertinggi dari semua usulan.'),
    ('Normalisasi drainase yang sering banjir', 'Drainase',
     'Pengerukan dan pelebaran saluran air di titik yang sering banjir di RW 07.',
     'lingkungan', 90000000, 'voting', 'musrenbang', 7, 9,
     'Banjir berulang setiap musim hujan merendam rumah dan jalan.'),
    ('Jembatan kecil penghubung ke sekolah', 'Jembatan',
     'Jembatan beton kecil pengganti titian rusak yang dilewati anak ke sekolah.',
     'infrastruktur', 70000000, 'voting', 'musrenbang', 7, 8,
     'Anak-anak harus menyeberang titian rusak atau memutar jauh untuk sampai ke sekolah.'),
    ('Lampu PJU jalan setapak RW 07', 'Lampu PJU',
     'Pemasangan lampu penerangan jalan di jalan setapak utama RW 07.',
     'infrastruktur', 40000000, 'voting', 'musrenbang', 7, 7,
     'Jalan setapak gelap di malam hari, warga rawan terjatuh dan tidak aman melintas.');

-- -----------------------------------------------------------------------------
-- 5. Suara: warga bernomor a sampai b mendukung tiap usulan.
--    Gapura 60, Balai warga 45, Jalan SDN 03 30, Talud 8, Drainase 8, Jembatan 5, Lampu PJU 6.
-- -----------------------------------------------------------------------------
with target (title, dari, sampai) as (
    values
        ('Gapura dan taman gerbang desa',          1, 60),
        ('Pengecatan ulang balai warga',           1, 45),
        ('Perbaikan jalan berlubang depan SDN 03', 41, 70),
        ('Talud penahan longsor tebing RW 07',     61, 68),
        ('Normalisasi drainase yang sering banjir', 63, 70),
        ('Jembatan kecil penghubung ke sekolah',   61, 65),
        ('Lampu PJU jalan setapak RW 07',          65, 70)
)
insert into votes (proposal_id, warga_id)
select p.id, w.id
from target t
join proposals p on p.title = t.title
join warga     w on w.nomor between t.dari and t.sampai;

-- -----------------------------------------------------------------------------
-- 6. Jejak keputusan
-- -----------------------------------------------------------------------------
insert into accountability_logs (log_type, actor, message, detail, created_at)
values ('note', 'admin', 'Pagu anggaran tahun berjalan ditetapkan Rp 300.000.000',
        jsonb_build_object('pagu', 300000000),
        now() - interval '20 days'),
       ('weight_change', 'admin', 'Bobot ditetapkan musyawarah desa: popularitas 30, urgensi 40, pemerataan 30',
        jsonb_build_object(
            'sebelum', jsonb_build_object('popularitas', 35, 'urgensi', 30, 'pemerataan', 35),
            'sesudah', jsonb_build_object('popularitas', 30, 'urgensi', 40, 'pemerataan', 30)),
        now() - interval '3 days');

insert into accountability_logs (log_type, proposal_id, actor, message, detail, created_at)
select 'status_change', p.id, 'admin', 'Usulan dibuka untuk pemungutan suara',
       jsonb_build_object('dari', 'forum', 'ke', 'voting'),
       now() - interval '14 days'
from proposals p
where p.status = 'voting';

insert into accountability_logs (log_type, proposal_id, actor, message, detail, created_at)
select 'selection', p.id, 'sistem',
       'Talud penahan longsor ditunda. Biaya Rp 220 juta menghabiskan pagu yang cukup untuk empat kebutuhan dasar. Disarankan diajukan ke sumber dana lain.',
       jsonb_build_object('pagu', 300000000, 'status', 'ditunda'),
       now() - interval '1 day'
from proposals p
where p.title = 'Talud penahan longsor tebing RW 07';

-- Semua baris lama sudah diganti, jadi batasan skala urgensi boleh diperiksa penuh.
alter table proposals validate constraint proposals_urgensi_skala;

commit;
