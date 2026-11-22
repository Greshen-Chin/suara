-- =============================================================================
-- SUARA — Sistem Usulan dan Aspirasi Rakyat
-- Skema database (PostgreSQL 15+ / Supabase, dengan PostGIS + pgvector)
--
-- Jalankan SEKALI pada database kosong, sebelum suara_seed.sql.
-- Seluruh file berjalan dalam satu transaksi: kalau ada yang gagal, tidak ada
-- yang tersisa.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Ekstensi
-- -----------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists vector  with schema extensions;

-- -----------------------------------------------------------------------------
-- 2. Tabel
-- -----------------------------------------------------------------------------

-- Warga desa yang berhak memberi suara.
create table warga (
    id         uuid primary key default gen_random_uuid(),
    nomor      integer generated always as identity unique,
    nama       text not null,
    rt         smallint not null check (rt > 0),
    rw         smallint not null check (rw > 0),
    created_at timestamptz not null default now()
);

-- Usulan program/kegiatan.
--   forum  : baru diusulkan warga, masih dibahas
--   voting : masuk daftar pemungutan suara
--   approved / rejected / done : hasil akhir
create table proposals (
    id                 uuid primary key default gen_random_uuid(),
    title              text not null,
    description        text,
    category           text not null
                       check (category in ('infrastruktur', 'kesehatan', 'pendidikan',
                                           'lingkungan', 'ekonomi', 'sosial', 'fasilitas')),
    estimated_budget   bigint not null check (estimated_budget > 0),   -- rupiah
    status             text not null default 'forum'
                       check (status in ('forum', 'voting', 'approved', 'rejected', 'done')),
    source             text not null default 'forum'
                       check (source in ('forum', 'musrenbang', 'admin')),
    proposer_id        uuid references warga (id) on delete set null,
    impact_score       smallint not null check (impact_score      between 0 and 100),
    urgency_score      smallint not null check (urgency_score     between 0 and 100),
    feasibility_score  smallint not null check (feasibility_score between 0 and 100),
    location           geography(Point, 4326),
    embedding          vector(384),                                    -- diisi aplikasi (pencarian semantik)
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index proposals_status_idx    on proposals (status);
create index proposals_location_idx  on proposals using gist (location);
create index proposals_embedding_idx on proposals using hnsw (embedding vector_cosine_ops);

-- Satu warga hanya boleh mendukung satu usulan satu kali.
create table votes (
    proposal_id uuid not null references proposals (id) on delete cascade,
    warga_id    uuid not null references warga (id)     on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (proposal_id, warga_id)
);

create index votes_warga_idx on votes (warga_id);

-- Bobot penilaian resmi. Selalu tepat satu baris (id = 1).
create table scoring_weights (
    id           smallint primary key default 1 check (id = 1),
    w_dampak     numeric not null check (w_dampak     >= 0),
    w_urgensi    numeric not null check (w_urgensi    >= 0),
    w_kelayakan  numeric not null check (w_kelayakan  >= 0),
    w_suara      numeric not null check (w_suara      >= 0),   -- bonus dukungan warga (0 = tidak dipakai)
    catatan      text,
    updated_at   timestamptz not null default now()
);

-- Bobot awal. Setiap perubahan setelahnya tercatat otomatis di accountability_logs.
insert into scoring_weights (id, w_dampak, w_urgensi, w_kelayakan, w_suara, catatan)
values (1, 30, 30, 30, 0, 'Bobot awal sistem');

-- Jejak akuntabilitas: siapa mengubah apa, kapan, dan mengapa.
create table accountability_logs (
    id          bigint generated always as identity primary key,
    log_type    text not null
                check (log_type in ('weight_change', 'status_change', 'selection', 'note')),
    proposal_id uuid references proposals (id) on delete set null,
    actor       text not null default 'sistem',
    message     text not null,
    detail      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

create index accountability_logs_created_idx on accountability_logs (created_at desc);
create index accountability_logs_type_idx    on accountability_logs (log_type);

-- -----------------------------------------------------------------------------
-- 3. Trigger
-- -----------------------------------------------------------------------------

-- 3a. Usulan yang masuk lewat forum otomatis mendapat satu dukungan dari pengusulnya.
create function trg_dukungan_pengusul() returns trigger
language plpgsql as $$
begin
    if new.source = 'forum' and new.proposer_id is not null then
        insert into votes (proposal_id, warga_id)
        values (new.id, new.proposer_id)
        on conflict do nothing;
    end if;
    return new;
end $$;

create trigger proposals_dukungan_pengusul
    after insert on proposals
    for each row execute function trg_dukungan_pengusul();

-- 3b. Menjaga updated_at.
create function trg_set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

create trigger proposals_updated_at
    before update on proposals
    for each row execute function trg_set_updated_at();

create trigger scoring_weights_updated_at
    before update on scoring_weights
    for each row execute function trg_set_updated_at();

-- 3c. Setiap perubahan bobot resmi dicatat di log akuntabilitas.
create function trg_log_perubahan_bobot() returns trigger
language plpgsql as $$
begin
    if (new.w_dampak, new.w_urgensi, new.w_kelayakan, new.w_suara)
       is distinct from
       (old.w_dampak, old.w_urgensi, old.w_kelayakan, old.w_suara) then
        insert into accountability_logs (log_type, actor, message, detail)
        values (
            'weight_change',
            'admin',
            coalesce(new.catatan, 'Bobot penilaian diubah'),
            jsonb_build_object(
                'sebelum', jsonb_build_object('dampak', old.w_dampak, 'urgensi', old.w_urgensi,
                                              'kelayakan', old.w_kelayakan, 'suara', old.w_suara),
                'sesudah', jsonb_build_object('dampak', new.w_dampak, 'urgensi', new.w_urgensi,
                                              'kelayakan', new.w_kelayakan, 'suara', new.w_suara)
            )
        );
    end if;
    return new;
end $$;

create trigger scoring_weights_log
    after update on scoring_weights
    for each row execute function trg_log_perubahan_bobot();

-- -----------------------------------------------------------------------------
-- 4. View
-- -----------------------------------------------------------------------------

-- Daftar usulan di forum beserta jumlah dukungannya.
create view v_forum with (security_invoker = true) as
select
    p.id,
    p.title,
    p.description,
    p.category,
    p.estimated_budget,
    p.created_at,
    w.nama                 as pengusul,
    count(v.warga_id)::int as vote_count
from proposals p
left join warga w on w.id = p.proposer_id
left join votes v on v.proposal_id = p.id
where p.status = 'forum'
group by p.id, w.nama
order by vote_count desc, p.created_at desc;

-- -----------------------------------------------------------------------------
-- 5. Fungsi rekomendasi
-- -----------------------------------------------------------------------------

create type hasil_pilih as (
    peringkat        integer,
    id               uuid,
    title            text,
    category         text,
    estimated_budget bigint,
    vote_count       integer,
    skor             numeric,   -- mode 'suara': jumlah suara; mode 'skor': skor gabungan
    selected         boolean,
    total_berjalan   bigint     -- total anggaran terpilih sampai baris ini
);

-- Pemilihan greedy atas usulan berstatus 'voting':
-- urutkan menurut kunci (suara atau skor), lalu ambil satu per satu selama
-- masih muat dalam pagu. Usulan yang tidak muat dilewati, bukan menghentikan proses.
--
--   p_mode = 'suara' : urut jumlah suara terbanyak
--   p_mode = 'skor'  : urut skor = (w_dampak*dampak + w_urgensi*urgensi + w_kelayakan*kelayakan)
--                                  / (w_dampak + w_urgensi + w_kelayakan)
--                                  + w_suara * (suara / suara_tertinggi)
create function greedy_pilih(
    p_pagu        bigint,
    p_mode        text    default 'suara',
    p_w_dampak    numeric default 40,
    p_w_urgensi   numeric default 30,
    p_w_kelayakan numeric default 30,
    p_w_suara     numeric default 0
) returns setof hasil_pilih
language plpgsql stable as $$
declare
    r       record;
    v_total bigint  := 0;
    v_rank  integer := 0;
    v_pilih boolean;
    v_out   hasil_pilih;
begin
    if p_mode not in ('suara', 'skor') then
        raise exception 'mode harus ''suara'' atau ''skor'', diterima: %', p_mode;
    end if;
    if p_pagu is null or p_pagu < 0 then
        raise exception 'pagu harus berupa angka >= 0';
    end if;

    for r in
        with dasar as (
            select p.id, p.title, p.category, p.estimated_budget, p.created_at,
                   p.impact_score, p.urgency_score, p.feasibility_score,
                   (select count(*)::int from votes v where v.proposal_id = p.id) as vote_count
            from proposals p
            where p.status = 'voting'
        ),
        tertinggi as (
            select coalesce(max(vote_count), 0) as maks from dasar
        ),
        nilai as (
            select d.*,
                   case p_mode
                       when 'suara' then d.vote_count::numeric
                       else
                           coalesce(
                               (p_w_dampak * d.impact_score
                                + p_w_urgensi * d.urgency_score
                                + p_w_kelayakan * d.feasibility_score)
                               / nullif(p_w_dampak + p_w_urgensi + p_w_kelayakan, 0), 0)
                           + p_w_suara * d.vote_count / nullif(t.maks, 0)
                   end as skor
            from dasar d cross join tertinggi t
        )
        select * from nilai
        order by skor desc, vote_count desc, created_at, id
    loop
        v_rank  := v_rank + 1;
        v_pilih := v_total + r.estimated_budget <= p_pagu;
        if v_pilih then
            v_total := v_total + r.estimated_budget;
        end if;

        v_out := row(v_rank, r.id, r.title, r.category, r.estimated_budget,
                     r.vote_count, round(coalesce(r.skor, 0), 4), v_pilih, v_total);
        return next v_out;
    end loop;
end $$;

-- Rekomendasi resmi: greedy mode 'skor' dengan bobot resmi dari scoring_weights.
create function rekomendasi_resmi(p_pagu bigint) returns setof hasil_pilih
language sql stable as $$
    select g.*
    from scoring_weights w
    cross join lateral greedy_pilih(p_pagu, 'skor',
                                    w.w_dampak, w.w_urgensi, w.w_kelayakan, w.w_suara) g
$$;

-- -----------------------------------------------------------------------------
-- 6. Keamanan (Row Level Security)
--    Aplikasi mengakses data hanya lewat server dengan service_role key,
--    yang melewati RLS. Tanpa policy, akses anon/authenticated otomatis ditolak.
-- -----------------------------------------------------------------------------
alter table warga               enable row level security;
alter table proposals           enable row level security;
alter table votes               enable row level security;
alter table scoring_weights     enable row level security;
alter table accountability_logs enable row level security;

commit;
