-- =============================================================================
-- SUARA — Migrasi 0004: forum warga
--
-- Urutan menjalankan (di SQL Editor Supabase, satu file satu kali Run):
--   0001 -> 0002 -> seed.sql -> 0003 -> 0004 (file ini) -> seed_forum.sql
-- File ini butuh tabel `akun` dari 0003. Seluruh file berjalan dalam satu transaksi.
--
-- Yang berubah:
--   1. accountability_logs.log_type mengenal 'moderation'.
--   2. proposals.urgency_score boleh kosong selama status 'forum'. Usulan warga belum
--      dinilai urgensinya (itu dikerjakan saat admin memindahkannya ke 'voting'),
--      tetapi status selain 'forum' tetap wajib punya nilai 1-10.
--   3. proposals mendapat disembunyikan_pada dan alasan_disembunyikan (moderasi).
--      Usulan tersembunyi tidak ikut skor, tidak tampil di daftar, dan judulnya
--      tidak dikirim ke publik; yang tampil hanya jejak dan alasannya.
--   4. Tabel baru `komentar` (satu tingkat, tanpa balasan bersarang).
--   5. skor_usulan dan v_wilayah mengabaikan usulan tersembunyi. Untuk data yang
--      ada (belum ada yang tersembunyi) hasilnya IDENTIK; angka halaman utama
--      tidak berubah.
--   6. View: v_usulan (detail), v_forum (daftar, menggantikan yang lama), v_komentar.
--      Pengusul dan penulis komentar hanya tampil sebagai NAMA DEPAN + RW.
--      warga.nomor, warga_id, dan akun_id tidak pernah keluar lewat view.
--   7. Fungsi atomik (semua hanya bisa dipanggil service_role, lewat rpc):
--        dukung_usulan, batal_dukung   <- ATURAN DUKUNGAN ada di sini, hanya di sini
--        ajukan_usulan, tambah_komentar, sembunyikan
--        cari_usulan_mirip (pgvector), cari_usulan_mirip_teks (pg_trgm, cadangan)
--      Semuanya mengembalikan jsonb: {"ok": true, ...} atau {"ok": false, "kode": "..."}.
--      Kegagalan yang wajar (batas laju, usulan tertutup) dikembalikan sebagai nilai,
--      bukan exception, supaya pesannya bisa diterjemahkan dengan tepat di aplikasi.
--
-- Cek hasil setelah menjalankan 0004 (sebelum seed_forum.sql):
--   select count(*) from rekomendasi_resmi(300000000) where selected;   -- harus 4
--   select count(*) from votes;                                         -- harus 162
-- =============================================================================

begin;

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Jejak keputusan mengenal moderasi
-- -----------------------------------------------------------------------------
alter table accountability_logs drop constraint accountability_logs_log_type_check;
alter table accountability_logs add constraint accountability_logs_log_type_check
    check (log_type in ('weight_change', 'status_change', 'selection', 'note', 'moderation'));

create index accountability_logs_proposal_idx on accountability_logs (proposal_id, created_at);

-- -----------------------------------------------------------------------------
-- 2. urgency_score: kosong selama 'forum', wajib sesudahnya
-- -----------------------------------------------------------------------------
alter table proposals alter column urgency_score drop not null;

alter table proposals drop constraint proposals_urgensi_skala;
alter table proposals add constraint proposals_urgensi_skala
    check (urgency_score is null or urgency_score between 1 and 10);
alter table proposals add constraint proposals_urgensi_wajib_setelah_forum
    check (status = 'forum' or urgency_score is not null);

-- -----------------------------------------------------------------------------
-- 3. Moderasi usulan
-- -----------------------------------------------------------------------------
alter table proposals add column disembunyikan_pada   timestamptz;
alter table proposals add column alasan_disembunyikan text;
alter table proposals add constraint proposals_moderasi_utuh
    check ((disembunyikan_pada is null) = (alasan_disembunyikan is null));

-- -----------------------------------------------------------------------------
-- 4. Komentar
-- -----------------------------------------------------------------------------
create table komentar (
    id                   uuid primary key default gen_random_uuid(),
    proposal_id          uuid not null references proposals (id) on delete cascade,
    -- Akun tidak dihapus, hanya dinonaktifkan (akun.aktif), jadi tanpa on delete cascade:
    -- komentar tidak boleh hilang diam-diam bersama akunnya.
    akun_id              uuid not null references akun (id),
    isi                  text not null
                         check (char_length(isi) between 1 and 1000 and isi = btrim(isi)),
    created_at           timestamptz not null default now(),
    disembunyikan_pada   timestamptz,
    alasan_disembunyikan text,
    constraint komentar_moderasi_utuh
        check ((disembunyikan_pada is null) = (alasan_disembunyikan is null))
);

create index komentar_proposal_idx on komentar (proposal_id, created_at);
create index komentar_akun_idx     on komentar (akun_id, created_at desc);

alter table komentar enable row level security;

-- -----------------------------------------------------------------------------
-- 5. Usulan tersembunyi tidak ikut dihitung
--    (isi fungsi sama dengan 0002, ditambah satu syarat di klausa where)
-- -----------------------------------------------------------------------------
create or replace function skor_usulan(
    p_w_popularitas numeric,
    p_w_urgensi     numeric,
    p_w_pemerataan  numeric
) returns table (
    id               uuid,
    title            text,
    nama_singkat     text,
    category         text,
    rw               smallint,
    estimated_budget bigint,
    vote_count       integer,
    urgency_score    smallint,
    skor             numeric,
    created_at       timestamptz
)
language sql stable as $$
    with dasar as (
        select p.id, p.title, coalesce(p.nama_singkat, p.title) as nama_singkat,
               p.category, p.rw, p.estimated_budget, p.urgency_score, p.created_at,
               (select count(*)::int from votes v where v.proposal_id = p.id) as vote_count,
               w.penduduk, w.anggaran_lalu
        from proposals p
        join wilayah w on w.rw = p.rw
        where p.status = 'voting'
          and p.disembunyikan_pada is null
    ),
    hitung as (
        select d.*,
               d.vote_count * 1000.0 / d.penduduk       as suara_per_1000,
               d.anggaran_lalu::numeric / d.penduduk    as per_kapita
        from dasar d
    ),
    puncak as (
        select coalesce(max(suara_per_1000), 0) as maks_suara,
               coalesce(max(per_kapita), 0)     as maks_kapita
        from hitung
    )
    select h.id, h.title, h.nama_singkat, h.category, h.rw, h.estimated_budget,
           h.vote_count, h.urgency_score,
           round(
               (  p_w_popularitas * case when pk.maks_suara = 0 then 0
                                         else 10 * h.suara_per_1000 / pk.maks_suara end
                + p_w_urgensi     * h.urgency_score
                + p_w_pemerataan  * case when pk.maks_kapita = 0 then 10
                                         else 10 * (1 - h.per_kapita / pk.maks_kapita) end
               ) / nullif(p_w_popularitas + p_w_urgensi + p_w_pemerataan, 0),
               4) as skor,
           h.created_at
    from hitung h cross join puncak pk
$$;

create or replace view v_wilayah with (security_invoker = true) as
select
    w.rw,
    w.nama,
    w.penduduk,
    w.anggaran_lalu,
    (select count(*)::int
       from proposals p
      where p.rw = w.rw and p.status = 'voting'
        and p.disembunyikan_pada is null)                                 as jumlah_usulan,
    (select count(*)::int
       from votes v
       join proposals p on p.id = v.proposal_id
      where p.rw = w.rw and p.status = 'voting'
        and p.disembunyikan_pada is null)                                 as jumlah_suara
from wilayah w
order by w.rw;

-- -----------------------------------------------------------------------------
-- 6. View
-- -----------------------------------------------------------------------------

-- Satu usulan lengkap, termasuk yang tersembunyi. Untuk usulan tersembunyi, judul dan
-- isinya dikosongkan di sini juga (bukan hanya di aplikasi): bisa jadi judulnya itulah
-- yang tidak pantas. Pengusul hanya nama depan + RW tempat tinggalnya.
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
         else round(vc.n * 1000.0 / wl.penduduk, 2) end            as suara_per_1000
from proposals p
left join warga   pw on pw.id = p.proposer_id
left join wilayah wl on wl.rw = p.rw
cross join lateral (select count(*)::int as n from votes v where v.proposal_id = p.id) vc;

-- Daftar di forum: forum + voting + yang sudah diputuskan, tanpa yang tersembunyi.
-- Menggantikan v_forum lama yang hanya memuat status 'forum' (daftar akan kosong,
-- karena ketujuh usulan seed berstatus 'voting').
drop view v_forum;
create view v_forum with (security_invoker = true) as
select id, title, nama_singkat, category, estimated_budget, status, source, rw,
       created_at, pengusul_nama_depan, pengusul_rw, vote_count, jumlah_komentar,
       penduduk, suara_per_1000
from v_usulan
where disembunyikan_pada is null;

-- Komentar tanpa akun_id. Isi komentar tersembunyi dikosongkan di sini.
create or replace view v_komentar with (security_invoker = true) as
select
    k.id,
    k.proposal_id,
    case when k.disembunyikan_pada is null then k.isi end as isi,
    k.created_at,
    k.disembunyikan_pada,
    k.alasan_disembunyikan,
    (a.peran = 'admin')                                              as dari_admin,
    case when a.peran = 'admin' then null else split_part(w.nama, ' ', 1) end as penulis_nama_depan,
    case when a.peran = 'admin' then null else w.rw end                       as penulis_rw
from komentar k
join akun a        on a.id = k.akun_id
left join warga w  on w.id = a.warga_id;

-- -----------------------------------------------------------------------------
-- 7. Fungsi
--    Pola sama dengan catat_gagal_masuk (0003): hanya service_role yang boleh
--    memanggil. `revoke ... from public, anon, authenticated` ada di bagian akhir.
--    search_path menyertakan `extensions` supaya operator pgvector (<=>) dan
--    similarity() dari pg_trgm ditemukan di Supabase.
-- -----------------------------------------------------------------------------

create function galat_forum(p_kode text, p_ulang_detik integer default null)
returns jsonb
language sql immutable as $$
    select case when p_ulang_detik is null
                then jsonb_build_object('ok', false, 'kode', p_kode)
                else jsonb_build_object('ok', false, 'kode', p_kode, 'ulang_detik', p_ulang_detik)
           end
$$;

-- ---- ATURAN DUKUNGAN (SEMENTARA) -------------------------------------------
-- Sekarang: satu dukungan per usulan per warga, boleh mendukung banyak usulan, boleh
-- dibatalkan. Yang boleh mendukung: akun aktif berperan 'warga' yang punya warga_id.
--
-- Pemilik produk masih menimbang jatah terbatas (mis. 3 dukungan per warga per
-- periode). Kalau jadi: ubah HANYA dua fungsi di bawah ini (dukung_usulan dan
-- batal_dukung) dan lib/aturan-dukungan.ts. Tidak ada tempat lain yang tahu aturannya.
-- Primary key votes (proposal_id, warga_id) menjamin "satu per usulan" apa pun yang terjadi.
-- ----------------------------------------------------------------------------

create function dukung_usulan(p_akun uuid, p_proposal uuid) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_status   text;
    v_sembunyi timestamptz;
    v_jumlah   integer;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'warga'       then return galat_forum('bukan_warga');      end if;
    if v_akun.warga_id is null       then return galat_forum('tanpa_warga');      end if;

    -- "for share": status dan moderasi usulan tidak bisa berubah di antara pemeriksaan
    -- dan penyimpanan dukungan. Admin yang menyembunyikan atau menutup usulan menunggu.
    select status, disembunyikan_pada into v_status, v_sembunyi
      from proposals where id = p_proposal for share;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_sembunyi is not null then return galat_forum('disembunyikan'); end if;
    if v_status not in ('forum', 'voting') then return galat_forum('ditutup'); end if;

    -- on conflict do nothing: menekan dua kali (atau dua tab) tetap satu dukungan.
    insert into votes (proposal_id, warga_id)
    values (p_proposal, v_akun.warga_id)
    on conflict do nothing;

    select count(*)::int into v_jumlah from votes where proposal_id = p_proposal;
    return jsonb_build_object('ok', true, 'didukung', true, 'jumlah', v_jumlah);
end $$;

create function batal_dukung(p_akun uuid, p_proposal uuid) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_status   text;
    v_sembunyi timestamptz;
    v_jumlah   integer;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'warga'       then return galat_forum('bukan_warga');      end if;
    if v_akun.warga_id is null       then return galat_forum('tanpa_warga');      end if;

    select status, disembunyikan_pada into v_status, v_sembunyi
      from proposals where id = p_proposal for share;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_sembunyi is not null then return galat_forum('disembunyikan'); end if;
    -- Setelah diputuskan, dukungan dikunci: tidak bisa ditambah dan tidak bisa ditarik.
    if v_status not in ('forum', 'voting') then return galat_forum('ditutup'); end if;

    delete from votes where proposal_id = p_proposal and warga_id = v_akun.warga_id;

    select count(*)::int into v_jumlah from votes where proposal_id = p_proposal;
    return jsonb_build_object('ok', true, 'didukung', false, 'jumlah', v_jumlah);
end $$;

-- Batas isian. Angka yang sama ada di lib/usulan-skema.ts; aplikasi memeriksa lebih dulu
-- untuk umpan balik cepat, fungsi ini yang memutuskan.
--   biaya minimal Rp 100.000 : menangkap salah ketik seperti "85" untuk "85 juta".
--   biaya maksimal Rp 5 miliar: jauh di atas pagu desa (demo: Rp 300 juta). Menangkap
--                               salah nol, tetapi masih memuat proyek besar seperti jalan atau jembatan.
--   batas laju 3 usulan / 24 jam / warga: cukup untuk warga yang aktif, terlalu sedikit
--                               untuk membanjiri forum. Dihitung per warga, bukan per akun.
create function ajukan_usulan(
    p_akun         uuid,
    p_judul        text,
    p_nama_singkat text,
    p_deskripsi    text,
    p_kategori     text,
    p_rw           integer,
    p_biaya        bigint,
    p_embedding    extensions.vector(384) default null
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun      akun%rowtype;
    v_judul     text := btrim(coalesce(p_judul, ''));
    v_singkat   text := nullif(btrim(coalesce(p_nama_singkat, '')), '');
    v_deskripsi text := btrim(coalesce(p_deskripsi, ''));
    v_terbaru   timestamptz[];
    v_tunggu    integer;
    v_id        uuid;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'warga'       then return galat_forum('bukan_warga');      end if;
    if v_akun.warga_id is null       then return galat_forum('tanpa_warga');      end if;

    if char_length(v_judul) not between 8 and 80 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'judul');
    end if;
    if v_singkat is not null and char_length(v_singkat) not between 2 and 24 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'nama_singkat');
    end if;
    if char_length(v_deskripsi) not between 20 and 1500 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'deskripsi');
    end if;
    if p_kategori is null or p_kategori not in
       ('infrastruktur', 'kesehatan', 'pendidikan', 'lingkungan', 'ekonomi', 'sosial', 'fasilitas') then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'kategori');
    end if;
    if p_rw is null or not exists (select 1 from wilayah where rw = p_rw) then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'rw');
    end if;
    if p_biaya is null or p_biaya not between 100000 and 5000000000 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'biaya');
    end if;

    -- Kunci per warga: dua permintaan bersamaan tidak bisa sama-sama lolos hitungan.
    perform pg_advisory_xact_lock(hashtextextended('usulan:' || v_akun.warga_id::text, 0));

    select array_agg(t.created_at order by t.created_at desc) into v_terbaru
      from (select created_at from proposals
             where proposer_id = v_akun.warga_id
               and source = 'forum'
               and created_at > now() - interval '24 hours'
             order by created_at desc limit 3) t;
    if coalesce(array_length(v_terbaru, 1), 0) >= 3 then
        -- Slot pertama kosong lagi saat usulan paling lama di antara tiga terbaru lewat 24 jam.
        v_tunggu := greatest(1, ceil(extract(epoch from
                        (v_terbaru[3] + interval '24 hours' - now())))::integer);
        return galat_forum('batas_laju', v_tunggu);
    end if;

    -- Trigger trg_dukungan_pengusul memberi dukungan pertama dari pengusul.
    insert into proposals (title, nama_singkat, description, category, estimated_budget,
                           status, source, proposer_id, rw, embedding)
    values (v_judul, v_singkat, v_deskripsi, p_kategori, p_biaya,
            'forum', 'forum', v_akun.warga_id, p_rw, p_embedding)
    returning id into v_id;

    return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Batas laju komentar: 1 per 20 detik per akun. Cukup lama untuk memutus banjir komentar
-- dari skrip, cukup pendek untuk tidak mengganggu orang yang membalas dua tiga kali berturut-turut.
create function tambah_komentar(p_akun uuid, p_proposal uuid, p_isi text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_isi      text := btrim(coalesce(p_isi, ''));
    v_sembunyi timestamptz;
    v_terakhir timestamptz;
    v_id       uuid;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    -- Warga dan admin boleh berkomentar; warga tidak perlu punya warga_id untuk berkomentar.
    if v_akun.peran not in ('warga', 'admin') then return galat_forum('bukan_warga'); end if;

    if char_length(v_isi) not between 1 and 1000 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'isi');
    end if;

    select disembunyikan_pada into v_sembunyi from proposals where id = p_proposal for share;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_sembunyi is not null then return galat_forum('disembunyikan'); end if;

    perform pg_advisory_xact_lock(hashtextextended('komentar:' || p_akun::text, 0));

    select max(created_at) into v_terakhir from komentar where akun_id = p_akun;
    if v_terakhir is not null and v_terakhir > now() - interval '20 seconds' then
        return galat_forum('batas_laju',
            greatest(1, ceil(extract(epoch from (v_terakhir + interval '20 seconds' - now())))::integer));
    end if;

    insert into komentar (proposal_id, akun_id, isi)
    values (p_proposal, p_akun, v_isi)
    returning id into v_id;

    return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Menyembunyikan usulan atau komentar. Khusus admin. Alasan wajib (10-500 karakter) dan
-- tercatat di jejak keputusan dengan tipe 'moderation', yang bisa dibaca semua orang.
-- Pencatat di log hanya tertulis "admin": nama akun tidak dibuka ke publik.
create function sembunyikan(p_akun uuid, p_jenis text, p_id uuid, p_alasan text) returns jsonb
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

    -- Isi komentar atau judul usulan sengaja tidak ikut dicatat: bisa jadi itulah yang tidak pantas.
    insert into accountability_logs (log_type, proposal_id, actor, message, detail)
    values ('moderation', v_proposal, 'admin', v_pesan,
            jsonb_build_object('jenis', p_jenis, 'id', p_id, 'alasan', v_alasan));

    return jsonb_build_object('ok', true, 'proposal_id', v_proposal);
end $$;

-- Pencarian usulan mirip dari makna: jarak kosinus pgvector (indeks HNSW dari 0001).
-- Hanya mengembalikan kandidat; penilaian akhir (ambang, lokasi, alasan yang bisa dibaca)
-- ada di lib/kemiripan.ts supaya bisa diuji dan diubah tanpa migrasi.
create function cari_usulan_mirip(p_embedding extensions.vector(384), p_batas integer default 10)
returns table (
    id          uuid,
    title       text,
    description text,
    category    text,
    rw          smallint,
    status      text,
    vote_count  integer,
    kosinus     double precision
)
language sql stable set search_path = public, extensions as $$
    select p.id, p.title, p.description, p.category, p.rw, p.status,
           (select count(*)::int from votes v where v.proposal_id = p.id),
           (1 - (p.embedding <=> p_embedding))::double precision
      from proposals p
     where p.embedding is not null
       and p.disembunyikan_pada is null
       and p.status in ('forum', 'voting')
     order by p.embedding <=> p_embedding
     limit least(greatest(coalesce(p_batas, 10), 1), 20)
$$;

-- Kemiripan teks (trigram), tanpa makna. Dua kegunaan:
--   1. cadangan penuh bila embedding tidak tersedia (model gagal atau lewat batas waktu);
--   2. melengkapi pencarian makna untuk usulan yang BELUM punya embedding (punya_embedding
--      = false), supaya usulan itu tidak diam-diam terlewat dan warga salah diberi tahu
--      "tidak ada yang mirip".
create function cari_usulan_mirip_teks(p_judul text, p_deskripsi text, p_batas integer default 10)
returns table (
    id              uuid,
    title           text,
    description     text,
    category        text,
    rw              smallint,
    status          text,
    vote_count      integer,
    sim_judul       double precision,
    sim_isi         double precision,
    punya_embedding boolean
)
language sql stable set search_path = public, extensions as $$
    select p.id, p.title, p.description, p.category, p.rw, p.status,
           (select count(*)::int from votes v where v.proposal_id = p.id),
           similarity(lower(p.title), lower(coalesce(p_judul, '')))::double precision,
           similarity(lower(p.title || ' ' || coalesce(p.description, '')),
                      lower(coalesce(p_judul, '') || ' ' || coalesce(p_deskripsi, '')))::double precision,
           (p.embedding is not null)
      from proposals p
     where p.disembunyikan_pada is null
       and p.status in ('forum', 'voting')
     order by 0.4 * similarity(lower(p.title), lower(coalesce(p_judul, '')))
            + 0.6 * similarity(lower(p.title || ' ' || coalesce(p.description, '')),
                               lower(coalesce(p_judul, '') || ' ' || coalesce(p_deskripsi, ''))) desc
     limit least(greatest(coalesce(p_batas, 10), 1), 20)
$$;

-- -----------------------------------------------------------------------------
-- 8. Hak akses: hanya service_role (server) yang boleh memanggil fungsi di atas.
-- -----------------------------------------------------------------------------
revoke execute on function galat_forum(text, integer)               from public, anon, authenticated;
revoke execute on function dukung_usulan(uuid, uuid)                from public, anon, authenticated;
revoke execute on function batal_dukung(uuid, uuid)                 from public, anon, authenticated;
revoke execute on function ajukan_usulan(uuid, text, text, text, text, integer, bigint, extensions.vector)
                                                                    from public, anon, authenticated;
revoke execute on function tambah_komentar(uuid, uuid, text)        from public, anon, authenticated;
revoke execute on function sembunyikan(uuid, text, uuid, text)      from public, anon, authenticated;
revoke execute on function cari_usulan_mirip(extensions.vector, integer)
                                                                    from public, anon, authenticated;
revoke execute on function cari_usulan_mirip_teks(text, text, integer)
                                                                    from public, anon, authenticated;

commit;
