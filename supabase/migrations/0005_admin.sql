-- =============================================================================
-- SUARA — Migrasi 0005: halaman admin desa
--
-- Urutan menjalankan (di SQL Editor Supabase, satu file satu kali Run):
--   0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005 (file ini)
-- File ini butuh `akun` (0003) dan `komentar` serta kolom moderasi (0004). Seluruh file berjalan
-- dalam satu transaksi: kalau satu langkah gagal, tidak ada yang tersisa.
--
-- Yang berubah:
--   1. Pagu pindah dari konstanta di kode ke tabel `pengaturan_anggaran` (satu baris, Rp 300 juta,
--      jadi angka halaman utama tidak berubah). Rentang Rp 10 juta sampai Rp 10 miliar.
--   2. `scoring_weights` dan `pengaturan_anggaran` punya kolom `versi`. Admin yang menyimpan harus
--      menyebut versi yang ia baca; bila sudah berubah (admin lain lebih dulu), simpanan ditolak,
--      bukan menimpa diam-diam. Dipilih bilangan bulat, bukan `updated_at`: stempel waktu yang
--      melewati JSON kehilangan presisi mikrodetiknya, sehingga perbandingannya bisa meleset.
--   3. Jenis log baru `budget_change` (pagu diubah). Entri pagu awal dari seed.sql (tipe `note`)
--      diberi jenis ini supaya ikut terbaca sebagai riwayat pagu.
--   4. `proposals_urgensi_wajib_setelah_forum` dilonggarkan untuk status `rejected`. Usulan yang
--      "tidak dilanjutkan" dari forum belum pernah dinilai urgensinya, dan tidak boleh dipaksa
--      dinilai hanya untuk ditolak. Status `voting`, `approved`, dan `done` tetap wajib bernilai.
--   5. `akun` mendapat `harus_ganti_sandi` dan `dibuat_oleh`, serta indeks unik: satu warga paling
--      banyak punya satu akun. Bila data yang ada sudah melanggar, migrasi berhenti dengan pesan.
--   6. Tabel `jejak_admin`: catatan TERTUTUP untuk perubahan akun dan siapa yang menyembunyikan
--      konten. Tidak pernah dibaca halaman publik, tidak memuat kata sandi atau hash.
--   7. Trigger log bobot membaca pelaku dan alasan dari `set_config` lokal yang diisi `ubah_bobot`,
--      sehingga log memuat nama pengguna admin dan alasannya. Perubahan lewat SQL Editor tetap
--      tercatat seperti sebelumnya (pelaku "admin", pesan dari kolom `catatan`).
--   8. Fungsi atomik (hanya service_role, lewat rpc), semuanya memeriksa sendiri bahwa p_akun adalah
--      akun aktif yang berhak, dan mengembalikan jsonb {"ok": true, ...} atau {"ok": false, "kode": ...}:
--        pindahkan_status, ubah_pagu, ubah_bobot, tampilkan_kembali, cari_warga_bebas,
--        buat_akun_warga, atur_ulang_sandi, atur_aktif, ganti_sandi_sendiri
--      `sembunyikan` (0004) diganti agar ikut mencatat siapa yang menyembunyikan di jejak tertutup.
--   9. View untuk halaman admin: v_admin_usulan, v_admin_akun, v_admin_komentar, v_jejak_admin.
--      Hanya dibaca server, setelah peran admin diperiksa. Memuat isi konten tersembunyi dan data
--      pribadi warga, jadi TIDAK boleh dipakai halaman publik.
--
-- Cek hasil setelah menjalankan 0005 (angka halaman utama TIDAK boleh berubah):
--   select pagu, versi from pengaturan_anggaran;                          -- 300000000, 1
--   select count(*) from rekomendasi_resmi(300000000) where selected;     -- 4
--   select count(*) from votes where proposal_id in
--     (select id from proposals where status = 'voting');                 -- 162
--
-- Bila migrasi berhenti karena "lebih dari satu akun", cari penyebabnya dengan:
--   select warga_id, array_agg(nama_pengguna) from akun
--    where warga_id is not null group by warga_id having count(*) > 1;
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Jenis log baru dan pelonggaran batasan urgensi
-- -----------------------------------------------------------------------------
alter table accountability_logs drop constraint accountability_logs_log_type_check;
alter table accountability_logs add constraint accountability_logs_log_type_check
    check (log_type in ('weight_change', 'status_change', 'selection', 'note', 'moderation', 'budget_change'));

-- Pagu awal dari seed.sql ditulis sebagai 'note' dengan detail.pagu. Jejaknya dipertahankan, hanya
-- jenisnya yang dibetulkan supaya riwayat pagu lengkap dari penetapan pertama.
update accountability_logs
   set log_type = 'budget_change'
 where log_type = 'note' and proposal_id is null and detail ? 'pagu';

alter table proposals drop constraint proposals_urgensi_wajib_setelah_forum;
alter table proposals add constraint proposals_urgensi_wajib_setelah_forum
    check (status in ('forum', 'rejected') or urgency_score is not null);

-- -----------------------------------------------------------------------------
-- 2. Pagu di database, dan versi untuk mendeteksi admin yang menyimpan bersamaan
-- -----------------------------------------------------------------------------
create table pengaturan_anggaran (
    id          smallint    primary key default 1 check (id = 1),
    -- Rp 10 juta: di bawah ini tidak ada usulan yang masuk akal terbiayai. Rp 10 miliar: jauh di
    -- atas desa mana pun yang memakai SUARA, dan menangkap salah nol. Batas biaya usulan (Rp 5 miliar)
    -- tetap di bawahnya.
    pagu        bigint      not null check (pagu between 10000000 and 10000000000),
    versi       integer     not null default 1 check (versi > 0),
    updated_at  timestamptz not null default now()
);

insert into pengaturan_anggaran (id, pagu) values (1, 300000000);

create trigger pengaturan_anggaran_updated_at
    before update on pengaturan_anggaran
    for each row execute function trg_set_updated_at();

alter table pengaturan_anggaran enable row level security;

alter table scoring_weights add column versi integer not null default 1 check (versi > 0);

-- -----------------------------------------------------------------------------
-- 3. Akun: wajib ganti kata sandi, pembuat, dan satu warga satu akun
-- -----------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from akun where warga_id is not null group by warga_id having count(*) > 1) then
        raise exception 'Migrasi 0005 dihentikan: ada warga yang tertaut ke lebih dari satu akun. Rapikan dulu (lihat kueri di kepala file ini), lalu jalankan ulang.';
    end if;
end $$;

alter table akun add column harus_ganti_sandi boolean not null default false;
alter table akun add column dibuat_oleh       uuid references akun (id);

create unique index akun_warga_unik on akun (warga_id) where warga_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Jejak admin tertutup
-- -----------------------------------------------------------------------------
-- Siapa melakukan apa pada akun, dan siapa menyembunyikan atau menampilkan kembali konten.
-- Sengaja terpisah dari accountability_logs: jejak publik hanya menulis "admin" untuk moderasi
-- (keputusan di docs/forum.md, melindungi perangkat desa), sedangkan admin lain perlu tahu siapa.
-- `akun_id` adalah pelaku: admin, atau pemilik akun sendiri untuk 'ganti_sandi'.
-- Tidak pernah memuat kata sandi atau hash.
create table jejak_admin (
    id               bigint generated always as identity primary key,
    akun_id          uuid not null references akun (id),
    aksi             text not null check (aksi in (
                         'buat_akun', 'atur_ulang_sandi', 'nonaktifkan', 'aktifkan',
                         'ganti_sandi', 'sembunyikan', 'tampilkan')),
    sasaran_akun_id  uuid references akun (id),
    detail           jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now()
);

create index jejak_admin_sasaran_idx on jejak_admin (sasaran_akun_id, created_at desc);
create index jejak_admin_pelaku_idx  on jejak_admin (akun_id, aksi, created_at desc);

alter table jejak_admin enable row level security;

-- -----------------------------------------------------------------------------
-- 5. Log bobot yang jujur soal pelakunya
--    Pencatatan tetap di SATU tempat (trigger ini), supaya perubahan lewat SQL Editor pun
--    tercatat. ubah_bobot() hanya memberi tahu siapa dan mengapa lewat set_config lokal
--    (berlaku sampai transaksi selesai, jadi tidak bocor ke permintaan lain).
-- -----------------------------------------------------------------------------
create or replace function trg_log_perubahan_bobot() returns trigger
language plpgsql as $$
declare
    v_pelaku text := nullif(current_setting('suara.pelaku', true), '');
    v_alasan text := nullif(current_setting('suara.alasan', true), '');
    v_pesan  text;
    v_detail jsonb;
begin
    if (new.w_popularitas, new.w_urgensi, new.w_pemerataan)
       is distinct from
       (old.w_popularitas, old.w_urgensi, old.w_pemerataan) then
        v_detail := jsonb_build_object(
            'sebelum', jsonb_build_object('popularitas', old.w_popularitas,
                                          'urgensi', old.w_urgensi,
                                          'pemerataan', old.w_pemerataan),
            'sesudah', jsonb_build_object('popularitas', new.w_popularitas,
                                          'urgensi', new.w_urgensi,
                                          'pemerataan', new.w_pemerataan)
        );
        if v_pelaku is not null and v_alasan is not null then
            v_pesan := format(
                'Bobot penilaian diubah: popularitas %s menjadi %s, urgensi %s menjadi %s, pemerataan %s menjadi %s. Alasan: %s',
                old.w_popularitas, new.w_popularitas, old.w_urgensi, new.w_urgensi,
                old.w_pemerataan, new.w_pemerataan, v_alasan);
            v_detail := v_detail || jsonb_build_object('alasan', v_alasan);
        else
            v_pesan := coalesce(new.catatan, 'Bobot penilaian diubah');
        end if;

        insert into accountability_logs (log_type, actor, message, detail)
        values ('weight_change', coalesce(v_pelaku, 'admin'), v_pesan, v_detail);
    end if;
    return new;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Pembantu
-- -----------------------------------------------------------------------------
create function galat_bidang(p_bidang text) returns jsonb
language sql immutable as $$
    select jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', p_bidang)
$$;

-- "Rp 300.000.000" untuk pesan di jejak keputusan. Titik sebagai pemisah ribuan dipasang
-- manual: pemisah dari to_char() mengikuti lokal server, yang tidak bisa diandalkan.
create function rupiah_teks(p_nilai bigint) returns text
language sql immutable as $$
    select 'Rp ' || replace(to_char(p_nilai, 'FM999,999,999,999,999'), ',', '.')
$$;

-- -----------------------------------------------------------------------------
-- 7. Memindahkan status usulan
--    Transisi yang ada di sini: forum -> voting, forum -> rejected ("Tidak dilanjutkan"),
--    voting -> forum ("Kembalikan ke pembahasan"). voting -> approved/rejected dan approved -> done
--    adalah penetapan hasil musyawarah (fitur Keputusan) dan SENGAJA tidak ada.
--
--    Batas 16 usulan voting: pilih_optimal mencoba semua kombinasi (2^n) dan menolak lebih dari 16.
--    Bila usulan ke-17 dibiarkan masuk, halaman utama langsung galat. Karena itu batas dijaga di
--    sini, dengan kunci yang membuat dua admin yang bekerja bersamaan tidak sama-sama lolos.
--
--    voting -> forum MENGOSONGKAN urgensi (alasannya tetap ada di jejak keputusan): usulan yang
--    kembali dibahas belum punya nilai yang berlaku, dan halaman forum akan berkata jujur
--    "urgensi belum dinilai". Memasukkannya lagi menuntut penilaian baru dengan alasan baru.
--
--    Untuk forum -> voting, alasan urgensi sekaligus menjadi alasan keputusan (p_alasan diabaikan):
--    satu alasan yang bisa dibaca warga, bukan dua kolom yang saling mengulang.
-- -----------------------------------------------------------------------------
create function pindahkan_status(
    p_akun            uuid,
    p_proposal        uuid,
    p_ke              text,
    p_status_dibaca   text,
    p_urgensi         integer,
    p_alasan_urgensi  text,
    p_nama_singkat    text,
    p_alasan          text
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_p        proposals%rowtype;
    v_alasan   text := btrim(coalesce(p_alasan, ''));
    v_alasan_u text := btrim(coalesce(p_alasan_urgensi, ''));
    v_singkat  text := nullif(btrim(coalesce(p_nama_singkat, '')), '');
    v_jumlah   integer;
    v_pesan    text;
    v_detail   jsonb;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_ke is null or p_ke not in ('voting', 'forum', 'rejected') then
        return galat_bidang('ke');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0));

    select * into v_p from proposals where id = p_proposal for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_p.disembunyikan_pada is not null then return galat_forum('disembunyikan'); end if;

    -- Admin lain bisa saja sudah memindahkannya sejak halaman ini dibuka.
    if v_p.status is distinct from p_status_dibaca then
        return jsonb_build_object('ok', false, 'kode', 'bentrok', 'status_sekarang', v_p.status);
    end if;

    if not ((v_p.status = 'forum'  and p_ke in ('voting', 'rejected'))
         or (v_p.status = 'voting' and p_ke = 'forum')) then
        return jsonb_build_object('ok', false, 'kode', 'transisi_tidak_diizinkan',
                                  'dari', v_p.status, 'ke', p_ke);
    end if;

    if p_ke = 'voting' then
        if p_urgensi is null or p_urgensi not between 1 and 10 then
            return galat_bidang('urgensi');
        end if;
        if char_length(v_alasan_u) not between 20 and 500 then
            return galat_bidang('alasan_urgensi');
        end if;
        if v_singkat is not null and char_length(v_singkat) not between 2 and 24 then
            return galat_bidang('nama_singkat');
        end if;
        -- Usulan tanpa RW tidak punya data penduduk, jadi tidak bisa dinilai (skor_usulan melewatinya).
        if v_p.rw is null then return galat_forum('tanpa_rw'); end if;

        select count(*)::int into v_jumlah
          from proposals where status = 'voting' and disembunyikan_pada is null;
        if v_jumlah >= 16 then
            return jsonb_build_object('ok', false, 'kode', 'batas_voting', 'jumlah', v_jumlah, 'batas', 16);
        end if;

        update proposals
           set status = 'voting', urgency_score = p_urgensi, urgency_reason = v_alasan_u,
               nama_singkat = coalesce(v_singkat, nama_singkat)
         where id = p_proposal;
        v_pesan  := 'Usulan dimasukkan ke hitungan anggaran dengan urgensi ' || p_urgensi
                    || ' dari 10. Alasan: ' || v_alasan_u;
        v_detail := jsonb_build_object('dari', v_p.status, 'ke', 'voting',
                                       'urgensi', p_urgensi, 'alasan', v_alasan_u);
    else
        if char_length(v_alasan) not between 10 and 500 then
            return galat_bidang('alasan');
        end if;

        if p_ke = 'rejected' then
            update proposals set status = 'rejected' where id = p_proposal;
            v_pesan  := 'Usulan tidak dilanjutkan oleh admin desa. Alasan: ' || v_alasan;
            v_detail := jsonb_build_object('dari', v_p.status, 'ke', 'rejected', 'alasan', v_alasan);
        else
            update proposals
               set status = 'forum', urgency_score = null, urgency_reason = null
             where id = p_proposal;
            v_pesan  := 'Usulan dikembalikan ke pembahasan warga dan tidak lagi dihitung dalam anggaran. Alasan: '
                        || v_alasan;
            v_detail := jsonb_build_object('dari', v_p.status, 'ke', 'forum', 'alasan', v_alasan,
                                           'urgensi_sebelumnya', v_p.urgency_score);
        end if;
    end if;

    insert into accountability_logs (log_type, proposal_id, actor, message, detail)
    values ('status_change', p_proposal, v_akun.nama_pengguna, v_pesan, v_detail);

    return jsonb_build_object('ok', true, 'proposal_id', p_proposal, 'status', p_ke);
end $$;

-- -----------------------------------------------------------------------------
-- 8. Pagu dan bobot
-- -----------------------------------------------------------------------------
create function ubah_pagu(
    p_akun          uuid,
    p_pagu          bigint,
    p_versi_dibaca  integer,
    p_alasan        text
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_s      pengaturan_anggaran%rowtype;
    v_alasan text := btrim(coalesce(p_alasan, ''));
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_pagu is null or p_pagu not between 10000000 and 10000000000 then
        return galat_bidang('pagu');
    end if;
    if char_length(v_alasan) not between 10 and 500 then
        return galat_bidang('alasan');
    end if;

    select * into v_s from pengaturan_anggaran where id = 1 for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;

    if v_s.versi is distinct from p_versi_dibaca then
        return jsonb_build_object('ok', false, 'kode', 'bentrok', 'versi', v_s.versi,
                                  'diubah_pada', v_s.updated_at, 'pagu', v_s.pagu);
    end if;
    if v_s.pagu = p_pagu then return galat_forum('tidak_berubah'); end if;

    update pengaturan_anggaran set pagu = p_pagu, versi = versi + 1 where id = 1;

    insert into accountability_logs (log_type, actor, message, detail)
    values ('budget_change', v_akun.nama_pengguna,
            'Pagu anggaran diubah dari ' || rupiah_teks(v_s.pagu) || ' menjadi ' || rupiah_teks(p_pagu)
                || '. Alasan: ' || v_alasan,
            jsonb_build_object('pagu_lama', v_s.pagu, 'pagu_baru', p_pagu, 'alasan', v_alasan));

    return jsonb_build_object('ok', true, 'versi', v_s.versi + 1, 'pagu', p_pagu);
end $$;

create function ubah_bobot(
    p_akun          uuid,
    p_popularitas   integer,
    p_urgensi       integer,
    p_pemerataan    integer,
    p_versi_dibaca  integer,
    p_alasan        text
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_s      scoring_weights%rowtype;
    v_alasan text := btrim(coalesce(p_alasan, ''));
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_popularitas is null or p_popularitas not between 0 and 100 then return galat_bidang('popularitas'); end if;
    if p_urgensi     is null or p_urgensi     not between 0 and 100 then return galat_bidang('urgensi');     end if;
    if p_pemerataan  is null or p_pemerataan  not between 0 and 100 then return galat_bidang('pemerataan');  end if;
    if p_popularitas + p_urgensi + p_pemerataan <> 100 then return galat_bidang('jumlah'); end if;
    if char_length(v_alasan) not between 10 and 500 then return galat_bidang('alasan'); end if;

    select * into v_s from scoring_weights where id = 1 for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;

    if v_s.versi is distinct from p_versi_dibaca then
        return jsonb_build_object('ok', false, 'kode', 'bentrok', 'versi', v_s.versi,
                                  'diubah_pada', v_s.updated_at,
                                  'popularitas', v_s.w_popularitas, 'urgensi', v_s.w_urgensi,
                                  'pemerataan', v_s.w_pemerataan);
    end if;
    if (v_s.w_popularitas, v_s.w_urgensi, v_s.w_pemerataan)
       = (p_popularitas, p_urgensi, p_pemerataan) then
        return galat_forum('tidak_berubah');
    end if;

    -- Trigger trg_log_perubahan_bobot membaca dua nilai ini. is_local = true: hilang saat transaksi
    -- selesai, dan dikosongkan lagi di bawah supaya perintah lain di transaksi yang sama tidak ikut.
    perform set_config('suara.pelaku', v_akun.nama_pengguna, true);
    perform set_config('suara.alasan', v_alasan, true);

    update scoring_weights
       set w_popularitas = p_popularitas, w_urgensi = p_urgensi, w_pemerataan = p_pemerataan,
           catatan = v_alasan, versi = versi + 1
     where id = 1;

    perform set_config('suara.pelaku', '', true);
    perform set_config('suara.alasan', '', true);

    return jsonb_build_object('ok', true, 'versi', v_s.versi + 1);
end $$;

-- -----------------------------------------------------------------------------
-- 9. Menampilkan kembali konten yang disembunyikan (kebalikan sembunyikan)
--    Usulan voting yang ditampilkan kembali masuk hitungan lagi, jadi batas 16 berlaku di sini juga.
-- -----------------------------------------------------------------------------
create function tampilkan_kembali(p_akun uuid, p_jenis text, p_id uuid, p_alasan text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_alasan   text := btrim(coalesce(p_alasan, ''));
    v_p        proposals%rowtype;
    v_proposal uuid;
    v_pesan    text;
    v_jumlah   integer;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_jenis not in ('usulan', 'komentar') then return galat_bidang('jenis'); end if;
    if char_length(v_alasan) not between 10 and 500 then return galat_bidang('alasan'); end if;

    if p_jenis = 'usulan' then
        perform pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0));

        select * into v_p from proposals where id = p_id for update;
        if not found then return galat_forum('tidak_ditemukan'); end if;
        if v_p.disembunyikan_pada is null then return galat_forum('tidak_disembunyikan'); end if;

        if v_p.status = 'voting' then
            select count(*)::int into v_jumlah
              from proposals where status = 'voting' and disembunyikan_pada is null;
            if v_jumlah >= 16 then
                return jsonb_build_object('ok', false, 'kode', 'batas_voting', 'jumlah', v_jumlah, 'batas', 16);
            end if;
        end if;

        update proposals set disembunyikan_pada = null, alasan_disembunyikan = null where id = p_id;
        v_proposal := p_id;
        v_pesan := 'Usulan ditampilkan kembali oleh admin desa. Alasan: ' || v_alasan;
        if v_p.status = 'voting' then
            v_pesan := v_pesan || ' Usulan ini kembali dihitung dalam anggaran.';
        end if;
    else
        update komentar
           set disembunyikan_pada = null, alasan_disembunyikan = null
         where id = p_id and disembunyikan_pada is not null
        returning proposal_id into v_proposal;
        if not found then
            return galat_forum(case when exists (select 1 from komentar where id = p_id)
                                    then 'tidak_disembunyikan' else 'tidak_ditemukan' end);
        end if;
        v_pesan := 'Satu komentar ditampilkan kembali oleh admin desa. Alasan: ' || v_alasan;
    end if;

    -- Pencatat di jejak publik tetap "admin", sama dengan sembunyikan(); nama akunnya masuk jejak tertutup.
    insert into accountability_logs (log_type, proposal_id, actor, message, detail)
    values ('moderation', v_proposal, 'admin', v_pesan,
            jsonb_build_object('jenis', p_jenis, 'id', p_id, 'alasan', v_alasan, 'aksi', 'tampilkan'));

    insert into jejak_admin (akun_id, aksi, detail)
    values (p_akun, 'tampilkan', jsonb_build_object('jenis', p_jenis, 'id', p_id));

    return jsonb_build_object('ok', true, 'proposal_id', v_proposal);
end $$;

-- sembunyikan() dari 0004, ditambah satu baris: siapa yang menyembunyikan, di jejak tertutup.
-- Selain itu isinya sama, termasuk pesan dan detail di jejak publik.
create or replace function sembunyikan(p_akun uuid, p_jenis text, p_id uuid, p_alasan text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun    akun%rowtype;
    v_alasan  text := btrim(coalesce(p_alasan, ''));
    v_proposal uuid;
    v_status  text;
    v_pesan   text;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_jenis not in ('usulan', 'komentar') then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'jenis');
    end if;
    if char_length(v_alasan) not between 10 and 500 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'alasan');
    end if;

    if p_jenis = 'usulan' then
        update proposals
           set disembunyikan_pada = now(), alasan_disembunyikan = v_alasan
         where id = p_id and disembunyikan_pada is null
        returning id, status into v_proposal, v_status;
        if not found then
            return galat_forum(case when exists (select 1 from proposals where id = p_id)
                                    then 'sudah_disembunyikan' else 'tidak_ditemukan' end);
        end if;
        v_pesan := 'Usulan disembunyikan oleh admin desa. Alasan: ' || v_alasan;
        if v_status = 'voting' then
            v_pesan := v_pesan || ' Usulan ini tidak lagi dihitung dalam anggaran.';
        end if;
    else
        update komentar
           set disembunyikan_pada = now(), alasan_disembunyikan = v_alasan
         where id = p_id and disembunyikan_pada is null
        returning proposal_id into v_proposal;
        if not found then
            return galat_forum(case when exists (select 1 from komentar where id = p_id)
                                    then 'sudah_disembunyikan' else 'tidak_ditemukan' end);
        end if;
        v_pesan := 'Satu komentar disembunyikan oleh admin desa. Alasan: ' || v_alasan;
    end if;

    insert into accountability_logs (log_type, proposal_id, actor, message, detail)
    values ('moderation', v_proposal, 'admin', v_pesan,
            jsonb_build_object('jenis', p_jenis, 'id', p_id, 'alasan', v_alasan));

    insert into jejak_admin (akun_id, aksi, detail)
    values (p_akun, 'sembunyikan', jsonb_build_object('jenis', p_jenis, 'id', p_id));

    return jsonb_build_object('ok', true, 'proposal_id', v_proposal);
end $$;

-- -----------------------------------------------------------------------------
-- 10. Akun warga
--     Hanya akun WARGA yang bisa dibuat dari sini, dan wajib tertaut ke satu warga yang belum punya
--     akun. Akun admin sengaja hanya lewat `npm run akun:buat` (butuh akses terminal): kalau sesi
--     admin bocor, penyerang tidak bisa melahirkan admin baru yang bertahan setelah sesinya dicabut.
-- -----------------------------------------------------------------------------

-- Warga yang belum punya akun, untuk dipilih admin saat membuat akun. Pencarian lewat nama atau
-- nomor. Mengembalikan jsonb {"ok": true, "warga": [...]} supaya pemeriksaan admin ikut di sini.
create function cari_warga_bebas(p_akun uuid, p_cari text, p_batas integer default 8) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare
    v_akun  akun%rowtype;
    v_q     text := lower(btrim(coalesce(p_cari, '')));
    v_hasil jsonb;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if char_length(v_q) < 2 then
        return jsonb_build_object('ok', true, 'warga', '[]'::jsonb);
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nomor', t.nomor, 'nama', t.nama,
                                                 'rt', t.rt, 'rw', t.rw) order by t.nama, t.nomor),
                    '[]'::jsonb)
      into v_hasil
      from (select w.id, w.nomor, w.nama, w.rt, w.rw
              from warga w
             where not exists (select 1 from akun a where a.warga_id = w.id)
               and (position(v_q in lower(w.nama)) > 0 or w.nomor::text = v_q)
             order by w.nama, w.nomor
             limit least(greatest(coalesce(p_batas, 8), 1), 20)) t;

    return jsonb_build_object('ok', true, 'warga', v_hasil);
end $$;

-- Batas 30 akun per jam per admin. Satu admin yang bekerja wajar membuat puluhan akun sehari,
-- bukan ratusan dalam hitungan menit. Batas ini membuat sesi admin yang bocor tidak bisa dipakai
-- membuat akun massal untuk menggelembungkan dukungan sebelum ketahuan.
create function buat_akun_warga(p_akun uuid, p_nama_pengguna text, p_hash text, p_warga uuid) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun    akun%rowtype;
    v_nama    text := btrim(coalesce(p_nama_pengguna, ''));
    v_warga   warga%rowtype;
    v_id      uuid;
    v_terbaru timestamptz[];
    v_tunggu  integer;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if v_nama !~ '^[a-z0-9._-]{3,32}$' then return galat_bidang('nama_pengguna'); end if;
    if p_hash is null or p_hash not like '$scrypt$%' then return galat_bidang('kata_sandi'); end if;

    select * into v_warga from warga where id = p_warga;
    if not found then return galat_forum('tidak_ditemukan'); end if;

    perform pg_advisory_xact_lock(hashtextextended('buat_akun:' || p_akun::text, 0));

    select array_agg(t.created_at order by t.created_at desc) into v_terbaru
      from (select created_at from jejak_admin
             where akun_id = p_akun and aksi = 'buat_akun'
               and created_at > now() - interval '1 hour'
             order by created_at desc limit 30) t;
    if coalesce(array_length(v_terbaru, 1), 0) >= 30 then
        v_tunggu := greatest(1, ceil(extract(epoch from
                        (v_terbaru[30] + interval '1 hour' - now())))::integer);
        return galat_forum('batas_laju', v_tunggu);
    end if;

    if exists (select 1 from akun where warga_id = p_warga) then
        return galat_forum('warga_sudah_punya_akun');
    end if;
    if exists (select 1 from akun where nama_pengguna = v_nama) then
        return galat_forum('nama_dipakai');
    end if;

    begin
        insert into akun (nama_pengguna, hash_kata_sandi, peran, warga_id, aktif,
                          harus_ganti_sandi, dibuat_oleh)
        values (v_nama, p_hash, 'warga', p_warga, true, true, p_akun)
        returning id into v_id;
    exception when unique_violation then
        -- Admin lain membuat akun yang bentrok di antara pemeriksaan dan penyimpanan.
        return galat_forum(case when exists (select 1 from akun where warga_id = p_warga)
                                then 'warga_sudah_punya_akun' else 'nama_dipakai' end);
    end;

    insert into jejak_admin (akun_id, aksi, sasaran_akun_id, detail)
    values (p_akun, 'buat_akun', v_id,
            jsonb_build_object('nama_pengguna', v_nama, 'warga_nomor', v_warga.nomor));

    return jsonb_build_object('ok', true, 'akun_id', v_id, 'nama_pengguna', v_nama);
end $$;

-- Mengatur ulang kata sandi: akun harus menggantinya lagi saat masuk, dan semua sesinya dicabut.
-- Kata sandi sendiri diganti lewat ganti_sandi_sendiri(), bukan di sini, supaya admin tidak
-- mengunci dirinya dengan kata sandi yang hanya ia ketahui.
create function atur_ulang_sandi(p_akun uuid, p_sasaran uuid, p_hash text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_target akun%rowtype;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_hash is null or p_hash not like '$scrypt$%' then return galat_bidang('kata_sandi'); end if;
    if p_sasaran = p_akun then return galat_forum('diri_sendiri'); end if;

    select * into v_target from akun where id = p_sasaran for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;

    update akun
       set hash_kata_sandi = p_hash, harus_ganti_sandi = true, versi_sesi = versi_sesi + 1
     where id = p_sasaran;

    insert into jejak_admin (akun_id, aksi, sasaran_akun_id)
    values (p_akun, 'atur_ulang_sandi', p_sasaran);

    return jsonb_build_object('ok', true, 'nama_pengguna', v_target.nama_pengguna);
end $$;

-- Menonaktifkan mencabut semua sesi (versi_sesi naik). Admin tidak bisa menonaktifkan dirinya
-- sendiri. "Admin aktif terakhir" tidak bisa dinonaktifkan: lewat satu panggilan, aturan diri-sendiri
-- sudah menjaganya (pemanggil sendiri admin aktif); pemeriksaan kedua melindungi dari dua admin yang
-- saling menonaktifkan bersamaan. Kunci di awal membuat keduanya berurutan.
create function atur_aktif(p_akun uuid, p_sasaran uuid, p_aktif boolean) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_target akun%rowtype;
begin
    perform pg_advisory_xact_lock(hashtextextended('admin_aktif', 0));

    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_aktif is null then return galat_bidang('aktif'); end if;
    if not p_aktif and p_sasaran = p_akun then return galat_forum('diri_sendiri'); end if;

    select * into v_target from akun where id = p_sasaran for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_target.aktif = p_aktif then return galat_forum('tidak_berubah'); end if;

    if not p_aktif and v_target.peran = 'admin'
       and not exists (select 1 from akun where peran = 'admin' and aktif and id <> p_sasaran) then
        return galat_forum('admin_terakhir');
    end if;

    update akun
       set aktif = p_aktif,
           versi_sesi = versi_sesi + case when p_aktif then 0 else 1 end
     where id = p_sasaran;

    insert into jejak_admin (akun_id, aksi, sasaran_akun_id)
    values (p_akun, case when p_aktif then 'aktifkan' else 'nonaktifkan' end, p_sasaran);

    return jsonb_build_object('ok', true, 'aktif', p_aktif, 'nama_pengguna', v_target.nama_pengguna);
end $$;

-- Dipanggil dari /akun setelah aplikasi memastikan kata sandi LAMA benar. Mengembalikan versi sesi
-- yang baru supaya aplikasi menerbitkan ulang sesi pengguna ini (sesi di perangkat lain tercabut).
create function ganti_sandi_sendiri(p_akun uuid, p_hash text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun  akun%rowtype;
    v_versi integer;
begin
    select * into v_akun from akun where id = p_akun for update;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if p_hash is null or p_hash not like '$scrypt$%' then return galat_bidang('kata_sandi'); end if;

    update akun
       set hash_kata_sandi = p_hash, harus_ganti_sandi = false, versi_sesi = versi_sesi + 1
     where id = p_akun
    returning versi_sesi into v_versi;

    insert into jejak_admin (akun_id, aksi, sasaran_akun_id)
    values (p_akun, 'ganti_sandi', p_akun);

    return jsonb_build_object('ok', true, 'versi_sesi', v_versi);
end $$;

-- -----------------------------------------------------------------------------
-- 11. View untuk halaman admin
--     security_invoker: RLS tabel dasarnya (tanpa policy) tetap berlaku bagi anon dan authenticated.
-- -----------------------------------------------------------------------------

-- Semua usulan, termasuk yang tersembunyi, dengan judul dan isi aslinya (admin perlu menilai ulang).
create view v_admin_usulan with (security_invoker = true) as
select
    p.id, p.title, p.nama_singkat, p.description, p.category, p.estimated_budget,
    p.status, p.source, p.rw, p.created_at, p.updated_at,
    p.urgency_score, p.urgency_reason, p.disembunyikan_pada, p.alasan_disembunyikan,
    split_part(pw.nama, ' ', 1) as pengusul_nama_depan,
    pw.rw                       as pengusul_rw,
    vc.n                        as vote_count,
    (select count(*)::int from komentar k
      where k.proposal_id = p.id and k.disembunyikan_pada is null) as jumlah_komentar,
    wl.penduduk,
    case when wl.penduduk is null then null
         else round(vc.n * 1000.0 / wl.penduduk, 2) end            as suara_per_1000
from proposals p
left join warga   pw on pw.id = p.proposer_id
left join wilayah wl on wl.rw = p.rw
cross join lateral (select count(*)::int as n from votes v where v.proposal_id = p.id) vc;

-- Akun dengan nama lengkap dan nomor warga yang tertaut. Tanpa hash kata sandi.
create view v_admin_akun with (security_invoker = true) as
select
    a.id, a.nama_pengguna, a.peran, a.aktif, a.harus_ganti_sandi, a.created_at,
    a.dibuat_oleh, d.nama_pengguna as dibuat_oleh_nama,
    w.nomor as warga_nomor, w.nama as warga_nama, w.rt as warga_rt, w.rw as warga_rw
from akun a
left join akun  d on d.id = a.dibuat_oleh
left join warga w on w.id = a.warga_id;

-- Semua komentar dengan isi aslinya, termasuk yang tersembunyi. Penulis hanya nama depan + RW,
-- sama dengan yang tampil di forum.
create view v_admin_komentar with (security_invoker = true) as
select
    k.id, k.proposal_id, p.title as proposal_judul, k.isi, k.created_at,
    k.disembunyikan_pada, k.alasan_disembunyikan,
    (a.peran = 'admin')                                                          as dari_admin,
    case when a.peran = 'admin' then null else split_part(w.nama, ' ', 1) end    as penulis_nama_depan,
    case when a.peran = 'admin' then null else w.rw end                          as penulis_rw
from komentar k
join proposals p   on p.id = k.proposal_id
join akun a        on a.id = k.akun_id
left join warga w  on w.id = a.warga_id;

-- Jejak admin dengan nama pelaku dan sasaran.
create view v_jejak_admin with (security_invoker = true) as
select
    j.id, j.aksi, j.created_at, j.akun_id, pl.nama_pengguna as pelaku_nama,
    j.sasaran_akun_id, sa.nama_pengguna as sasaran_nama, j.detail
from jejak_admin j
join akun pl       on pl.id = j.akun_id
left join akun sa  on sa.id = j.sasaran_akun_id;

-- -----------------------------------------------------------------------------
-- 12. Hak akses: hanya service_role (server) yang boleh memanggil fungsi di atas.
-- -----------------------------------------------------------------------------
revoke execute on function galat_bidang(text)                             from public, anon, authenticated;
revoke execute on function rupiah_teks(bigint)                            from public, anon, authenticated;
revoke execute on function pindahkan_status(uuid, uuid, text, text, integer, text, text, text)
                                                                          from public, anon, authenticated;
revoke execute on function ubah_pagu(uuid, bigint, integer, text)        from public, anon, authenticated;
revoke execute on function ubah_bobot(uuid, integer, integer, integer, integer, text)
                                                                          from public, anon, authenticated;
revoke execute on function tampilkan_kembali(uuid, text, uuid, text)     from public, anon, authenticated;
revoke execute on function sembunyikan(uuid, text, uuid, text)           from public, anon, authenticated;
revoke execute on function cari_warga_bebas(uuid, text, integer)         from public, anon, authenticated;
revoke execute on function buat_akun_warga(uuid, text, text, uuid)       from public, anon, authenticated;
revoke execute on function atur_ulang_sandi(uuid, uuid, text)            from public, anon, authenticated;
revoke execute on function atur_aktif(uuid, uuid, boolean)               from public, anon, authenticated;
revoke execute on function ganti_sandi_sendiri(uuid, text)               from public, anon, authenticated;

commit;
