-- =============================================================================
-- SUARA — Pulihkan periode setelah latihan demo (jalan keluar SETELAH 24 jam)
--
-- PERINGATAN. Ini melewati batas 24 jam yang dijaga aplikasi. Jalankan HANYA bila:
--   - Anda pemilik proyek dan data ini memang data demo, dan
--   - penetapan keputusan terakhir adalah latihan yang ingin dibatalkan, dan
--   - belum ada usulan dari penetapan itu yang ditandai selesai ('done').
-- Untuk data yang sebenarnya, jangan pakai berkas ini: keputusan musyawarah tidak dikoreksi lewat SQL.
--
-- Yang dilakukan sama persis dengan tombol "Batalkan penetapan": status usulan, anggaran_lalu, dan periode
-- dipulihkan, tahun berikutnya ditutup lagi, dan pembatalannya masuk jejak keputusan publik. Yang dipakai
-- adalah fungsi yang sama (pulihkan_periode, migrasi 0006), hanya tanpa pemeriksaan 24 jam.
-- Fungsi menolak sendiri bila ada usulan yang sudah 'done', bila ini bukan penetapan terakhir, atau bila
-- hitungan akan melebihi 16 usulan; hasilnya terbaca di kolom `hasil` di bawah.
--
-- Cara memakai: ganti 2027 di bawah dengan tahun penetapan yang ingin dipulihkan, lalu Run.
-- Hasil yang diharapkan: {"ok": true, "tahun": 2027, "dipulihkan": <jumlah>} dan
--   select tahun, status from periode order by tahun;   -- 2026 diputuskan, 2027 berjalan
--   select count(*) from rekomendasi_resmi(300000000) where selected;   -- 4 (bila datanya belum diubah)
-- =============================================================================

select pulihkan_periode(
    2027,
    'Pemulihan data demo oleh pemilik proyek setelah latihan.',
    'pemilik proyek',
    true
) as hasil;
