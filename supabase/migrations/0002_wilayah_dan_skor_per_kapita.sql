-- =============================================================================
-- SUARA — Migrasi 0002: wilayah (RW) dan skor yang adil per kapita
--
-- Jalankan SETELAH 0001_schema.sql, lalu jalankan supabase/seed.sql.
--
-- Yang berubah:
--   1. Tabel baru `wilayah`: penduduk dan anggaran periode lalu tiap RW.
--   2. `proposals` mendapat kolom rw, nama_singkat, dan urgency_reason.
--      Skala urgency_score menjadi 1-10. impact_score dan feasibility_score tidak
--      dipakai lagi (kolomnya dibiarkan, tidak wajib diisi).
--   3. Skor usulan = popularitas + urgensi + pemerataan, masing-masing skala 0-10:
--        popularitas : suara per 1.000 penduduk RW, dibanding yang tertinggi
--        urgensi     : urgency_score (1-10)
--        pemerataan  : makin kecil anggaran per kapita RW periode lalu, makin tinggi
--      Bobot resmi di scoring_weights: popularitas 30, urgensi 40, pemerataan 30.
--   4. rekomendasi_resmi mencari KOMBINASI usulan dengan total skor tertinggi di
--      dalam pagu (bukan urutan satu per satu). Dibatasi 16 usulan berstatus 'voting'.
--   5. Fungsi lama greedy_pilih dan rekomendasi_resmi diganti, tipe hasil_pilih dibuat ulang.
--
-- Seluruh file berjalan dalam satu transaksi.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Wilayah
-- -----------------------------------------------------------------------------
create table wilayah (
    rw            smallint primary key check (rw > 0),
    nama          text    not null,
    penduduk      integer not null check (penduduk > 0),
    anggaran_lalu bigint  not null default 0 check (anggaran_lalu >= 0)   -- rupiah, periode lalu
);

alter table wilayah enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Kolom baru di proposals
-- -----------------------------------------------------------------------------
alter table proposals add column rw             smallint references wilayah (rw);
alter table proposals add column nama_singkat   text;   -- label pendek untuk batang anggaran
alter table proposals add column urgency_reason text;   -- alasan tertulis di balik nilai urgensi

alter table proposals alter column impact_score      drop not null;
alter table proposals alter column feasibility_score drop not null;

-- Skala urgensi baru 1-10. "not valid": baris lama (skala 0-100) tidak diperiksa ulang,
-- tetapi setiap baris baru atau yang diubah wajib mengikuti skala baru.
alter table proposals drop constraint proposals_urgency_score_check;
alter table proposals add constraint proposals_urgensi_skala
    check (urgency_score between 1 and 10) not valid;

-- -----------------------------------------------------------------------------
-- 3. Bobot resmi: dampak -> popularitas, kelayakan -> pemerataan, bonus suara dihapus.
--    Jumlah bobot harus 100.
-- -----------------------------------------------------------------------------
alter table scoring_weights rename column w_dampak    to w_popularitas;
alter table scoring_weights rename column w_kelayakan to w_pemerataan;
alter table scoring_weights drop column w_suara;

create or replace function trg_log_perubahan_bobot() returns trigger
language plpgsql as $$
begin
    if (new.w_popularitas, new.w_urgensi, new.w_pemerataan)
       is distinct from
       (old.w_popularitas, old.w_urgensi, old.w_pemerataan) then
        insert into accountability_logs (log_type, actor, message, detail)
        values (
            'weight_change',
            'admin',
            coalesce(new.catatan, 'Bobot penilaian diubah'),
            jsonb_build_object(
                'sebelum', jsonb_build_object('popularitas', old.w_popularitas,
                                              'urgensi', old.w_urgensi,
                                              'pemerataan', old.w_pemerataan),
                'sesudah', jsonb_build_object('popularitas', new.w_popularitas,
                                              'urgensi', new.w_urgensi,
                                              'pemerataan', new.w_pemerataan)
            )
        );
    end if;
    return new;
end $$;

-- Pasang bobot 30/40/30 tanpa memicu log; seed.sql menulis entri lognya sendiri.
alter table scoring_weights disable trigger scoring_weights_log;
update scoring_weights
set w_popularitas = 30, w_urgensi = 40, w_pemerataan = 30
where id = 1;
alter table scoring_weights enable trigger scoring_weights_log;

alter table scoring_weights add constraint scoring_weights_jumlah_100
    check (w_popularitas + w_urgensi + w_pemerataan = 100);

-- -----------------------------------------------------------------------------
-- 4. Ganti fungsi rekomendasi
-- -----------------------------------------------------------------------------
drop function rekomendasi_resmi(bigint);
drop function greedy_pilih(bigint, text, numeric, numeric, numeric, numeric);
drop type hasil_pilih;

create type hasil_pilih as (
    peringkat        integer,
    id               uuid,
    title            text,
    nama_singkat     text,
    category         text,
    rw               smallint,
    estimated_budget bigint,
    vote_count       integer,
    urgency_score    smallint,
    skor             numeric,   -- mode 'suara': jumlah suara; mode 'skor': skor gabungan 0-10
    selected         boolean,
    total_berjalan   bigint     -- total anggaran terpilih sampai baris ini (urut peringkat)
);

-- Skor tiap usulan berstatus 'voting'. Usulan tanpa rw tidak ikut dinilai.
create function skor_usulan(
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

-- Pemilihan greedy: urutkan menurut kunci, ambil satu per satu selama masih muat.
-- Usulan yang tidak muat dilewati, bukan menghentikan proses.
--   p_mode = 'suara' : urut jumlah suara terbanyak
--   p_mode = 'skor'  : urut skor gabungan
create function greedy_pilih(
    p_pagu          bigint,
    p_mode          text    default 'suara',
    p_w_popularitas numeric default 30,
    p_w_urgensi     numeric default 40,
    p_w_pemerataan  numeric default 30
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
        select u.*,
               case p_mode when 'suara' then u.vote_count::numeric else u.skor end as kunci
        from skor_usulan(p_w_popularitas, p_w_urgensi, p_w_pemerataan) u
        order by kunci desc, u.vote_count desc, u.created_at, u.id
    loop
        v_rank  := v_rank + 1;
        v_pilih := v_total + r.estimated_budget <= p_pagu;
        if v_pilih then
            v_total := v_total + r.estimated_budget;
        end if;

        v_out := row(v_rank, r.id, r.title, r.nama_singkat, r.category, r.rw,
                     r.estimated_budget, r.vote_count, r.urgency_score,
                     round(r.kunci, 4), v_pilih, v_total);
        return next v_out;
    end loop;
end $$;

-- Mencari kombinasi usulan dengan jumlah skor tertinggi yang muat dalam pagu.
-- Semua kombinasi dicoba (maksimal 16 usulan = 65.536 kombinasi).
-- Jumlah skor sama: pilih yang total biayanya lebih kecil.
create function pilih_optimal(
    p_pagu          bigint,
    p_w_popularitas numeric default 30,
    p_w_urgensi     numeric default 40,
    p_w_pemerataan  numeric default 30
) returns setof hasil_pilih
language plpgsql stable as $$
declare
    v_ids        uuid[];
    v_biaya      bigint[];
    v_nilai      numeric[];
    v_n          integer;
    v_mask       integer;
    v_i          integer;
    v_jumlah     bigint;
    v_skor       numeric;
    v_best_mask  integer := 0;
    v_best_skor  numeric := -1;
    v_best_biaya bigint  := 0;
    v_terpilih   uuid[]  := '{}';
begin
    if p_pagu is null or p_pagu < 0 then
        raise exception 'pagu harus berupa angka >= 0';
    end if;

    select array_agg(u.id               order by u.skor desc, u.vote_count desc, u.created_at, u.id),
           array_agg(u.estimated_budget order by u.skor desc, u.vote_count desc, u.created_at, u.id),
           array_agg(u.skor             order by u.skor desc, u.vote_count desc, u.created_at, u.id)
    into v_ids, v_biaya, v_nilai
    from skor_usulan(p_w_popularitas, p_w_urgensi, p_w_pemerataan) u;

    v_n := coalesce(array_length(v_ids, 1), 0);
    if v_n = 0 then
        return;
    end if;
    if v_n > 16 then
        raise exception 'terlalu banyak usulan (%) untuk dicari kombinasi terbaiknya; batasnya 16', v_n;
    end if;

    for v_mask in 0 .. (1 << v_n) - 1 loop
        v_jumlah := 0;
        v_skor   := 0;
        for v_i in 1 .. v_n loop
            if ((v_mask >> (v_i - 1)) & 1) = 1 then
                v_jumlah := v_jumlah + v_biaya[v_i];
                v_skor   := v_skor   + v_nilai[v_i];
            end if;
        end loop;

        if v_jumlah <= p_pagu
           and (v_skor > v_best_skor
                or (v_skor = v_best_skor and v_jumlah < v_best_biaya)) then
            v_best_mask  := v_mask;
            v_best_skor  := v_skor;
            v_best_biaya := v_jumlah;
        end if;
    end loop;

    for v_i in 1 .. v_n loop
        if ((v_best_mask >> (v_i - 1)) & 1) = 1 then
            v_terpilih := v_terpilih || v_ids[v_i];
        end if;
    end loop;

    return query
    with u as (
        select s.*,
               (row_number() over (order by s.skor desc, s.vote_count desc, s.created_at, s.id))::integer as peringkat
        from skor_usulan(p_w_popularitas, p_w_urgensi, p_w_pemerataan) s
    ),
    r as (
        select u.*, (u.id = any (v_terpilih)) as selected
        from u
    )
    select r.peringkat, r.id, r.title, r.nama_singkat, r.category, r.rw,
           r.estimated_budget, r.vote_count, r.urgency_score, r.skor, r.selected,
           (sum(case when r.selected then r.estimated_budget else 0 end)
                over (order by r.peringkat))::bigint
    from r
    order by r.peringkat;
end $$;

-- Rekomendasi resmi: kombinasi terbaik dengan bobot resmi dari scoring_weights.
create function rekomendasi_resmi(p_pagu bigint) returns setof hasil_pilih
language sql stable as $$
    select g.*
    from scoring_weights w
    cross join lateral pilih_optimal(p_pagu, w.w_popularitas, w.w_urgensi, w.w_pemerataan) g
$$;

-- -----------------------------------------------------------------------------
-- 5. Ringkasan per wilayah
-- -----------------------------------------------------------------------------
create view v_wilayah with (security_invoker = true) as
select
    w.rw,
    w.nama,
    w.penduduk,
    w.anggaran_lalu,
    (select count(*)::int
       from proposals p
      where p.rw = w.rw and p.status = 'voting')                          as jumlah_usulan,
    (select count(*)::int
       from votes v
       join proposals p on p.id = v.proposal_id
      where p.rw = w.rw and p.status = 'voting')                          as jumlah_suara
from wilayah w
order by w.rw;

commit;
