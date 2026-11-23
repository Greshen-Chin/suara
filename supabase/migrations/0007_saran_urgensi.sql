-- =============================================================================
-- SUARA — Migrasi 0007: saran urgensi dari AI (Gemini)
--
-- Urutan menjalankan (di SQL Editor Supabase, satu file satu kali Run):
--   0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005
--   -> 0006 -> seed_keputusan.sql -> 0007 (file ini)
-- Seluruh file berjalan dalam satu transaksi: kalau satu langkah gagal, tidak ada yang tersisa.
--
-- Yang berubah:
--   1. Tabel `saran_urgensi`: saran yang pernah dibuat AI untuk satu isi usulan. Satu baris per
--      (usulan, sidik isi, versi prompt, model); isi yang sama dan prompt yang sama tidak memanggil AI lagi.
--   2. Tabel `panggilan_ai`: catatan tiap permintaan (tanpa isi usulan, tanpa isi jawaban) untuk batas laju
--      dan pemantauan.
--   3. `proposals.saran_dibuka_id`: saran yang DIBUKA admin sebelum memasukkan usulan ke hitungan. Hanya ini
--      yang tampil ke publik ("Saran AI sebelumnya: 7"), bukan saran terakhir yang tersimpan.
--   4. Fungsi (hanya service_role, lewat rpc; semuanya memeriksa sendiri bahwa p_akun adalah admin aktif):
--        sidik_isi_usulan, ambil_jatah_saran, simpan_saran, catat_gagal_saran
--      dan `pindahkan_status` diperluas dengan parameter p_saran (nilai bawaan null). Versi lama dihapus.
--   5. `v_usulan` mendapat kolom saran_* di ujung (view lain yang bergantung padanya tidak berubah).
--
-- Batas: 10 permintaan per jam per admin, 100 per 24 jam untuk seluruh desa. Hanya permintaan yang benar-benar
-- sampai ke AI (berhasil, atau gagal karena jawabannya tidak bisa dipakai) yang dihitung; gangguan jaringan,
-- kuota habis, atau batas waktu TIDAK menghabiskan jatah.
--
-- Migrasi ini TIDAK mengubah data hitungan. Cek hasil setelah menjalankan (angka halaman utama tidak boleh berubah):
--   select count(*) from rekomendasi_resmi(300000000) where selected;                  -- 4
--   select count(*) from votes where proposal_id in
--     (select id from proposals where status = 'voting');                              -- 162
--   select count(*) from saran_urgensi;                                                -- 0
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tabel
-- -----------------------------------------------------------------------------
create table saran_urgensi (
    id            uuid primary key default gen_random_uuid(),
    proposal_id   uuid not null references proposals(id) on delete cascade,
    nilai         smallint not null check (nilai between 1 and 10),
    keyakinan     text not null check (keyakinan in ('rendah', 'sedang', 'tinggi')),
    alasan        jsonb not null check (jsonb_typeof(alasan) = 'array' and jsonb_array_length(alasan) between 1 and 3),
    pertanyaan    jsonb not null default '[]' check (jsonb_typeof(pertanyaan) = 'array' and jsonb_array_length(pertanyaan) <= 3),
    model         text not null,
    versi_prompt  text not null,
    sidik_isi     text not null,
    dibuat_oleh   uuid references akun(id) on delete set null,
    created_at    timestamptz not null default now(),
    unique (proposal_id, sidik_isi, versi_prompt, model)
);
alter table saran_urgensi enable row level security;

create table panggilan_ai (
    id           uuid primary key default gen_random_uuid(),
    akun_id      uuid references akun(id) on delete set null,
    proposal_id  uuid references proposals(id) on delete set null,
    created_at   timestamptz not null default now(),
    hasil        text not null default 'diminta' check (hasil in ('diminta', 'berhasil', 'gagal')),
    kode         text,
    dihitung     boolean not null default false,
    model        text,
    durasi_ms    integer
);
alter table panggilan_ai enable row level security;
create index panggilan_ai_akun_waktu on panggilan_ai (akun_id, created_at desc);
create index panggilan_ai_waktu on panggilan_ai (created_at desc);

alter table proposals add column saran_dibuka_id uuid references saran_urgensi(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 2. Sidik isi: berubah bila judul, deskripsi, atau kategori berubah. Saran yang sidiknya berbeda dari isi
--    sekarang dianggap basi dan tidak boleh dipakai.
-- -----------------------------------------------------------------------------
create function sidik_isi_usulan(p_judul text, p_deskripsi text, p_kategori text) returns text
language sql immutable as $$
    select md5(coalesce(p_judul, '') || chr(31) || coalesce(p_deskripsi, '') || chr(31) || coalesce(p_kategori, ''))
$$;

-- -----------------------------------------------------------------------------
-- 3. Mengambil jatah sebelum memanggil AI
--    Satu kunci (saran_urgensi) membuat klik ganda dan dua admin yang bersamaan tidak menembus batas:
--    yang kedua melihat permintaan "diminta" yang pertama dan ditolak dengan `sedang_diproses`.
--    Isi yang dikembalikan dibaca dari tabel (judul, deskripsi, kategori), bukan dari formulir.
-- -----------------------------------------------------------------------------
create function ambil_jatah_saran(
    p_akun        uuid,
    p_proposal    uuid,
    p_model       text,
    p_versi       text,
    p_batas_jam   integer default 10,
    p_batas_hari  integer default 100
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_p      proposals%rowtype;
    v_sidik  text;
    v_saran  saran_urgensi%rowtype;
    v_n      integer;
    v_tertua timestamptz;
    v_id     uuid;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    perform pg_advisory_xact_lock(hashtextextended('saran_urgensi', 0));

    select * into v_p from proposals where id = p_proposal;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_p.disembunyikan_pada is not null then return galat_forum('disembunyikan'); end if;
    -- Hanya usulan warga yang masih dibahas di forum: itulah yang akan dinilai admin.
    if v_p.source <> 'forum' or v_p.status <> 'forum' then
        return jsonb_build_object('ok', false, 'kode', 'transisi_tidak_diizinkan', 'dari', v_p.status, 'ke', 'voting');
    end if;

    v_sidik := sidik_isi_usulan(v_p.title, v_p.description, v_p.category);

    -- Isi, prompt, dan model yang sama: pakai yang tersimpan, tanpa menghabiskan jatah.
    select * into v_saran from saran_urgensi
     where proposal_id = p_proposal and sidik_isi = v_sidik and versi_prompt = p_versi and model = p_model;
    if found then
        return jsonb_build_object(
            'ok', true, 'tersimpan', true, 'sidik', v_sidik,
            'saran', jsonb_build_object('id', v_saran.id, 'nilai', v_saran.nilai, 'keyakinan', v_saran.keyakinan,
                                        'alasan', v_saran.alasan, 'pertanyaan', v_saran.pertanyaan,
                                        'model', v_saran.model, 'dibuat', v_saran.created_at));
    end if;

    if exists (select 1 from panggilan_ai
                where proposal_id = p_proposal and hasil = 'diminta' and created_at > now() - interval '30 seconds') then
        return galat_forum('sedang_diproses', 30);
    end if;

    -- Per admin per jam.
    select count(*)::int, min(created_at) into v_n, v_tertua from panggilan_ai
     where akun_id = p_akun and created_at > now() - interval '1 hour'
       and (dihitung or (hasil = 'diminta' and created_at > now() - interval '60 seconds'));
    if v_n >= p_batas_jam then
        return galat_forum('batas_laju', greatest(1, ceil(extract(epoch from (v_tertua + interval '1 hour' - now())))::int));
    end if;

    -- Seluruh desa per 24 jam.
    select count(*)::int, min(created_at) into v_n, v_tertua from panggilan_ai
     where created_at > now() - interval '24 hours'
       and (dihitung or (hasil = 'diminta' and created_at > now() - interval '60 seconds'));
    if v_n >= p_batas_hari then
        return galat_forum('batas_harian', greatest(1, ceil(extract(epoch from (v_tertua + interval '24 hours' - now())))::int));
    end if;

    insert into panggilan_ai (akun_id, proposal_id, model) values (p_akun, p_proposal, p_model)
    returning id into v_id;

    return jsonb_build_object('ok', true, 'tersimpan', false, 'panggilan_id', v_id, 'sidik', v_sidik,
                              'judul', v_p.title, 'deskripsi', v_p.description, 'kategori', v_p.category);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Menyimpan saran yang sudah lolos validasi di server
--    Validasi ulang ringan di sini (pertahanan berlapis): rentang nilai, keyakinan, bentuk larik, dan bahwa
--    isi usulan belum berubah sejak jatah diambil.
-- -----------------------------------------------------------------------------
create function simpan_saran(
    p_akun        uuid,
    p_panggilan   uuid,
    p_proposal    uuid,
    p_sidik       text,
    p_nilai       integer,
    p_keyakinan   text,
    p_alasan      jsonb,
    p_pertanyaan  jsonb,
    p_model       text,
    p_versi       text,
    p_durasi_ms   integer
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_p      proposals%rowtype;
    v_call   panggilan_ai%rowtype;
    v_saran  saran_urgensi%rowtype;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    perform pg_advisory_xact_lock(hashtextextended('saran_urgensi', 0));

    select * into v_call from panggilan_ai where id = p_panggilan;
    if not found or v_call.akun_id is distinct from p_akun or v_call.proposal_id is distinct from p_proposal
       or v_call.hasil <> 'diminta' then
        return galat_forum('saran_tidak_valid');
    end if;

    select * into v_p from proposals where id = p_proposal;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if sidik_isi_usulan(v_p.title, v_p.description, v_p.category) <> p_sidik then
        return galat_forum('saran_tidak_valid');
    end if;

    if p_nilai is null or p_nilai not between 1 and 10 then return galat_bidang('nilai'); end if;
    if p_keyakinan is null or p_keyakinan not in ('rendah', 'sedang', 'tinggi') then return galat_bidang('keyakinan'); end if;
    if p_alasan is null or jsonb_typeof(p_alasan) <> 'array' or jsonb_array_length(p_alasan) not between 1 and 3 then
        return galat_bidang('alasan');
    end if;
    if p_pertanyaan is null or jsonb_typeof(p_pertanyaan) <> 'array' or jsonb_array_length(p_pertanyaan) > 3 then
        return galat_bidang('pertanyaan');
    end if;

    insert into saran_urgensi (proposal_id, nilai, keyakinan, alasan, pertanyaan, model, versi_prompt, sidik_isi, dibuat_oleh)
    values (p_proposal, p_nilai, p_keyakinan, p_alasan, p_pertanyaan, p_model, p_versi, p_sidik, p_akun)
    on conflict (proposal_id, sidik_isi, versi_prompt, model) do update set created_at = saran_urgensi.created_at
    returning * into v_saran;

    update panggilan_ai set hasil = 'berhasil', dihitung = true, durasi_ms = p_durasi_ms, model = p_model
     where id = p_panggilan;

    return jsonb_build_object(
        'ok', true,
        'saran', jsonb_build_object('id', v_saran.id, 'nilai', v_saran.nilai, 'keyakinan', v_saran.keyakinan,
                                    'alasan', v_saran.alasan, 'pertanyaan', v_saran.pertanyaan,
                                    'model', v_saran.model, 'dibuat', v_saran.created_at));
end $$;

-- Mencatat permintaan yang gagal. p_hitung = true bila AI sudah menjawab tetapi jawabannya tidak bisa dipakai
-- (kuota AI sudah terpakai); false untuk gangguan, supaya admin tidak kehilangan jatah karena masalah di luar dirinya.
create function catat_gagal_saran(
    p_akun       uuid,
    p_panggilan  uuid,
    p_kode       text,
    p_hitung     boolean default false,
    p_durasi_ms  integer default null
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun akun%rowtype;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    update panggilan_ai
       set hasil = 'gagal', kode = left(coalesce(p_kode, 'tidak_diketahui'), 40),
           dihitung = coalesce(p_hitung, false), durasi_ms = p_durasi_ms
     where id = p_panggilan and akun_id = p_akun and hasil = 'diminta';

    return jsonb_build_object('ok', true);
end $$;

-- -----------------------------------------------------------------------------
-- 5. pindahkan_status dengan saran
--    Parameter baru p_saran (bawaan null). Versi 8 argumen dihapus supaya PostgREST tidak melihat dua overload.
--    Tanpa p_saran perilakunya SAMA dengan 0005. Bila p_saran diisi, saran harus milik usulan yang sama dan
--    sidik isinya harus masih cocok; nilainya dibaca dari tabel, tidak pernah dari formulir. Saran yang dibuka
--    dicatat di usulan (saran_dibuka_id), di detail jejak, dan di kalimat jejak yang dibaca publik.
--    Dikosongkan lagi saat usulan kembali ke forum (urgensinya pun dikosongkan).
-- -----------------------------------------------------------------------------
drop function pindahkan_status(uuid, uuid, text, text, integer, text, text, text);

create function pindahkan_status(
    p_akun            uuid,
    p_proposal        uuid,
    p_ke              text,
    p_status_dibaca   text,
    p_urgensi         integer,
    p_alasan_urgensi  text,
    p_nama_singkat    text,
    p_alasan          text,
    p_saran           uuid default null
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_p        proposals%rowtype;
    v_saran    saran_urgensi%rowtype;
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

    if p_saran is not null then
        -- Saran hanya ikut bila usulan dimasukkan ke hitungan, dan hanya yang milik usulan ini dengan isi yang sama.
        if p_ke <> 'voting' then return galat_forum('saran_tidak_valid'); end if;
        select * into v_saran from saran_urgensi where id = p_saran and proposal_id = p_proposal;
        if not found
           or v_saran.sidik_isi <> sidik_isi_usulan(v_p.title, v_p.description, v_p.category) then
            return galat_forum('saran_tidak_valid');
        end if;
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
               nama_singkat = coalesce(v_singkat, nama_singkat), saran_dibuka_id = p_saran
         where id = p_proposal;
        v_pesan  := 'Usulan dimasukkan ke hitungan anggaran dengan urgensi ' || p_urgensi
                    || ' dari 10. Alasan: ' || v_alasan_u;
        v_detail := jsonb_build_object('dari', v_p.status, 'ke', 'voting',
                                       'urgensi', p_urgensi, 'alasan', v_alasan_u);
        if p_saran is not null then
            v_pesan  := v_pesan || ' Saran AI yang dibuka admin sebelumnya: ' || v_saran.nilai || ' dari 10.';
            v_detail := v_detail || jsonb_build_object(
                'saran_ai', jsonb_build_object('id', v_saran.id, 'nilai', v_saran.nilai,
                                               'keyakinan', v_saran.keyakinan, 'model', v_saran.model));
        end if;
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
               set status = 'forum', urgency_score = null, urgency_reason = null, saran_dibuka_id = null
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
-- 6. v_usulan: saran yang dibuka saat penetapan (bukan saran terakhir), dikosongkan bila usulan disembunyikan.
--    Kolom baru hanya di ujung, jadi `create or replace` aman dan v_forum (yang memilih kolomnya sendiri) tetap.
-- -----------------------------------------------------------------------------
create or replace view v_usulan with (security_invoker = true) as
select
    p.id,
    case when p.disembunyikan_pada is null then p.title         end as title,
    case when p.disembunyikan_pada is null then p.nama_singkat  end as nama_singkat,
    case when p.disembunyikan_pada is null then p.description   end as description,
    p.category,
    p.estimated_budget,
    p.status,
    p.source,
    p.rw,
    p.created_at,
    p.urgency_score,
    case when p.disembunyikan_pada is null then p.urgency_reason end as urgency_reason,
    p.disembunyikan_pada,
    p.alasan_disembunyikan,
    split_part(pw.nama, ' ', 1)  as pengusul_nama_depan,
    pw.rw                        as pengusul_rw,
    vc.n                         as vote_count,
    (select count(*)::int
       from komentar k
      where k.proposal_id = p.id and k.disembunyikan_pada is null) as jumlah_komentar,
    wl.penduduk,
    case when wl.penduduk is null then null
         else round(vc.n * 1000.0 / wl.penduduk, 2) end            as suara_per_1000,
    case when p.disembunyikan_pada is null then sd.nilai     end as saran_nilai,
    case when p.disembunyikan_pada is null then sd.keyakinan end as saran_keyakinan,
    case when p.disembunyikan_pada is null then sd.alasan    end as saran_alasan,
    case when p.disembunyikan_pada is null then sd.model     end as saran_model
from proposals p
left join warga   pw on pw.id = p.proposer_id
left join wilayah wl on wl.rw = p.rw
left join saran_urgensi sd on sd.id = p.saran_dibuka_id
cross join lateral (select count(*)::int as n from votes v where v.proposal_id = p.id) vc;

-- -----------------------------------------------------------------------------
-- 7. Hak akses: hanya service_role (server) yang boleh memanggil fungsi di atas.
-- -----------------------------------------------------------------------------
revoke execute on function sidik_isi_usulan(text, text, text)                        from public, anon, authenticated;
revoke execute on function ambil_jatah_saran(uuid, uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function simpan_saran(uuid, uuid, uuid, text, integer, text, jsonb, jsonb, text, text, integer)
                                                                                     from public, anon, authenticated;
revoke execute on function catat_gagal_saran(uuid, uuid, text, boolean, integer)     from public, anon, authenticated;
revoke execute on function pindahkan_status(uuid, uuid, text, text, integer, text, text, text, uuid)
                                                                                     from public, anon, authenticated;

commit;
