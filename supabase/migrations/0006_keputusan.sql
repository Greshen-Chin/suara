-- =============================================================================
-- SUARA — Migrasi 0006: keputusan musyawarah
--
-- Urutan menjalankan (di SQL Editor Supabase, satu file satu kali Run):
--   0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005
--   -> 0006 (file ini) -> seed_keputusan.sql
-- Seluruh file berjalan dalam satu transaksi: kalau satu langkah gagal, tidak ada yang tersisa.
--
-- Yang berubah:
--   1. Status usulan baru `referred` ("diajukan ke dana lain"). `proposals_urgensi_wajib_setelah_forum`
--      tidak perlu diubah: hanya 'forum' dan 'rejected' yang boleh tanpa urgensi, jadi `referred`
--      (seperti 'voting', 'approved', 'done') tetap wajib bernilai. Jenis log baru `decision`.
--   2. `proposals` mendapat selesai_pada, catatan_selesai, dan biaya_realisasi (usulan yang sudah dikerjakan).
--   3. Tabel `periode` (satu periode berjalan setiap saat; migrasi membuat Tahun Anggaran 2027) dan
--      `keputusan` (satu baris per usulan per penetapan, dengan POTRET angka saat ditetapkan).
--      Halaman publik membaca potret itu, bukan menghitung ulang.
--   4. Fungsi atomik (hanya service_role, lewat rpc), semuanya memeriksa sendiri bahwa p_akun adalah admin aktif:
--        tetapkan_keputusan, batalkan_penetapan, tandai_selesai
--      (batalkan_penetapan memanggil pulihkan_periode, yang juga dipakai supabase/demo_pulihkan_periode.sql)
--      dan pembaca hitungan yang dipakai halaman dan penetapan dari satu sumber:
--        hitungan_dengan_status(pagu), sidik_hitungan()
--      Penetapan dan pembatalan memakai kunci yang sama dengan pindahkan_status (hitungan_anggaran).
--   5. View publik v_periode dan v_keputusan (tanpa id akun dan tanpa data pribadi).
--
-- Migrasi ini TIDAK mengubah data hitungan: usulan, dukungan, bobot, pagu, dan anggaran_lalu tetap.
-- Cek hasil setelah menjalankan 0006 (angka halaman utama TIDAK boleh berubah):
--   select tahun, status from periode order by tahun;                      -- 2027, berjalan
--   select count(*) from rekomendasi_resmi(300000000) where selected;      -- 4
--   select count(*) from votes where proposal_id in
--     (select id from proposals where status = 'voting');                  -- 162
-- Lalu jalankan supabase/seed_keputusan.sql (periode 2026 beserta empat usulannya).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Status dan jenis log baru
-- -----------------------------------------------------------------------------
alter table proposals drop constraint proposals_status_check;
alter table proposals add constraint proposals_status_check
    check (status in ('forum', 'voting', 'approved', 'rejected', 'referred', 'done'));

alter table accountability_logs drop constraint accountability_logs_log_type_check;
alter table accountability_logs add constraint accountability_logs_log_type_check
    check (log_type in ('weight_change', 'status_change', 'selection', 'note', 'moderation',
                        'budget_change', 'decision'));

-- -----------------------------------------------------------------------------
-- 2. Usulan yang sudah dikerjakan
-- -----------------------------------------------------------------------------
alter table proposals add column selesai_pada    timestamptz;
alter table proposals add column catatan_selesai text;
alter table proposals add column biaya_realisasi bigint check (biaya_realisasi is null or biaya_realisasi > 0);

-- -----------------------------------------------------------------------------
-- 3. Periode dan keputusan
-- -----------------------------------------------------------------------------
-- `berjalan`: periode yang sedang menampung usulan (paling banyak satu, dijaga indeks unik parsial).
-- `diputuskan`: sudah ditetapkan. pagu, bobot, dan wilayah_sebelum adalah potret saat penetapan;
-- wilayah_sebelum ({"1": 250000000, ...}) memulihkan anggaran_lalu bila penetapan dibatalkan.
-- `versi` hanya naik (penetapan, pembatalan), tidak pernah dipakai ulang.
create table periode (
    tahun              integer     primary key check (tahun between 2000 and 2200),
    status             text        not null check (status in ('berjalan', 'diputuskan')),
    versi              integer     not null default 1 check (versi > 0),
    dibuka_pada        timestamptz not null default now(),
    diputuskan_pada    timestamptz,
    tanggal_musyawarah date,
    catatan            text,
    pagu               bigint,
    bobot              jsonb,
    ada_rekomendasi    boolean     not null default false,
    wilayah_sebelum    jsonb,
    diputuskan_oleh    text,
    constraint periode_diputuskan_utuh check (
        status = 'berjalan'
        or (diputuskan_pada is not null and tanggal_musyawarah is not null
            and catatan is not null and pagu is not null)
    )
);

create unique index periode_satu_berjalan on periode (status) where status = 'berjalan';

alter table periode enable row level security;

-- Satu baris per usulan yang diputuskan. Potret (peringkat sampai judul) disimpan saat penetapan dan
-- tidak ikut berubah bila dukungan, bobot, atau pagu berubah sesudahnya. Periode yang diputuskan
-- sebelum SUARA dipakai tidak punya potret rekomendasi: peringkat, skor, dan status_rekomendasi kosong.
-- Penetapan yang dibatalkan tidak dihapus, hanya diberi dibatalkan_pada.
create table keputusan (
    id                    bigint generated always as identity primary key,
    -- Tanpa kunci asing ke periode: periode berikutnya ditutup lagi (dihapus) bila penetapan dibatalkan,
    -- sedangkan catatan batalnya tetap tersimpan.
    tahun                 integer  not null,
    proposal_id           uuid     not null references proposals (id) on delete cascade,
    hasil                 text     not null check (hasil in ('disetujui', 'dana_lain', 'dilanjutkan', 'ditolak')),
    alasan                text     check (alasan is null or char_length(alasan) between 20 and 500),
    sumber_dana           text     check (sumber_dana is null or char_length(sumber_dana) between 3 and 80),
    peringkat             integer,
    jumlah_usulan         integer,
    skor                  numeric,
    status_rekomendasi    text     check (status_rekomendasi is null
                                          or status_rekomendasi in ('terpilih', 'ditunda', 'tidak-terpilih')),
    biaya                 bigint   not null check (biaya > 0),
    dukungan              integer  not null default 0,
    urgensi               smallint,
    rw                    smallint,
    judul                 text     not null,
    nama_singkat          text,
    beda_dari_rekomendasi boolean  not null default false,
    dibatalkan_pada       timestamptz,
    created_at            timestamptz not null default now(),
    constraint keputusan_ditolak_beralasan   check (hasil <> 'ditolak'   or alasan is not null),
    constraint keputusan_dana_lain_lengkap   check (hasil <> 'dana_lain' or (alasan is not null and sumber_dana is not null))
);

create unique index keputusan_satu_per_usulan on keputusan (tahun, proposal_id) where dibatalkan_pada is null;
create index keputusan_proposal_idx on keputusan (proposal_id);

alter table keputusan enable row level security;

-- -----------------------------------------------------------------------------
-- 4. Pembaca hitungan
-- -----------------------------------------------------------------------------

-- Rekomendasi resmi untuk satu pagu, dengan status tampilan tiap usulan. Aturannya SAMA dengan
-- statusUsulan (lib/seleksi.ts, mode 'skor'): terpilih; "ditunda" bila tidak terpilih tetapi skornya
-- setidaknya setinggi skor terendah yang terpilih; selain itu tidak-terpilih. Tanpa usulan terpilih,
-- tidak ada yang "ditunda". supabase/tests/keputusan.test.ts membuktikan kesetaraannya.
create function hitungan_dengan_status(p_pagu bigint)
returns table (
    peringkat    integer,
    id           uuid,
    judul        text,
    nama_singkat text,
    rw           smallint,
    biaya        bigint,
    dukungan     integer,
    urgensi      smallint,
    skor         numeric,
    status       text,
    terpilih     boolean
)
language sql stable set search_path = public, extensions as $$
    with r as (select * from rekomendasi_resmi(p_pagu)),
         m as (select min(r2.skor) as batas from r r2 where r2.selected)
    select r.peringkat, r.id, r.title, r.nama_singkat, r.rw, r.estimated_budget, r.vote_count,
           r.urgency_score, r.skor,
           case when r.selected          then 'terpilih'
                when r.skor >= m.batas   then 'ditunda'
                else 'tidak-terpilih' end,
           r.selected
      from r cross join m
     order by r.peringkat
$$;

-- Keadaan hitungan yang dilihat admin: pagu dan bobot yang berlaku, serta tiap usulan dengan statusnya.
-- `sidik` meringkas id + status rekomendasi tiap usulan, pagu, dan versi bobot. Jumlah dukungan sengaja
-- TIDAK masuk: dukungan boleh bergerak selama rapat asalkan rekomendasinya sama.
-- Halaman admin dan tetapkan_keputusan membaca dari fungsi yang sama, jadi sidiknya tidak bisa beda sumber.
create function sidik_hitungan() returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare
    v_pagu  bigint;
    v_versi integer;
    v_bobot jsonb;
    v_u     jsonb;
    v_teks  text;
begin
    select pagu into v_pagu from pengaturan_anggaran where id = 1;
    select versi,
           jsonb_build_object('popularitas', w_popularitas, 'urgensi', w_urgensi, 'pemerataan', w_pemerataan)
      into v_versi, v_bobot
      from scoring_weights where id = 1;

    select coalesce(jsonb_agg(to_jsonb(h) order by h.peringkat), '[]'::jsonb),
           coalesce(string_agg(h.id::text || ':' || h.status, ',' order by h.id), '')
      into v_u, v_teks
      from hitungan_dengan_status(v_pagu) h;

    return jsonb_build_object(
        'sidik', md5(v_pagu::text || '|' || v_versi::text || '|' || v_teks),
        'pagu', v_pagu,
        'versi_bobot', v_versi,
        'bobot', v_bobot,
        'jumlah', jsonb_array_length(v_u),
        'usulan', v_u
    );
end $$;

-- Butir keputusan dari klien sebagai baris. Pemanggil sudah memastikan p_butir berupa larik objek
-- dengan nilai teks atau null; di sini hanya dipangkas dan diubah menjadi kolom.
create function butir_terurai(p_butir jsonb)
returns table (urutan integer, id text, hasil text, alasan text, sumber_dana text)
language sql immutable as $$
    select e.urutan::integer,
           e.nilai ->> 'id',
           e.nilai ->> 'hasil',
           nullif(btrim(e.nilai ->> 'alasan'), ''),
           nullif(btrim(e.nilai ->> 'sumber_dana'), '')
      from jsonb_array_elements(p_butir) with ordinality as e(nilai, urutan)
$$;

-- "9,6" dari 9.6, dengan satu desimal.
create function skor_teks(p_skor numeric) returns text
language sql immutable as $$
    select replace(to_char(round(p_skor, 1), 'FM990.0'), '.', ',')
$$;

-- -----------------------------------------------------------------------------
-- 5. Menetapkan keputusan
--    Utuh: semua usulan yang ikut dihitung mendapat tepat satu hasil, dalam satu transaksi.
--    p_butir: [{"id": "<uuid>", "hasil": "disetujui|dana_lain|dilanjutkan|ditolak",
--               "alasan": "...", "sumber_dana": "..."}, ...]
--    Alasan wajib bila hasilnya berbeda dari rekomendasi (disetujui padahal tidak terpilih, atau tidak
--    disetujui padahal terpilih), dan selalu untuk 'ditolak' dan 'dana_lain'. Keputusan yang sejalan
--    dan tanpa alasan ditulis dari potret angkanya ("Mengikuti rekomendasi: peringkat 2 dari 7, skor 9,6.").
--    Akibat: anggaran_lalu tiap RW diganti dengan jumlah biaya 'disetujui' periode ini (RW tanpa bagian
--    jadi 0), dan periode tahun berikutnya dibuka.
-- -----------------------------------------------------------------------------
create function tetapkan_keputusan(
    p_akun          uuid,
    p_tahun         integer,
    p_versi_dibaca  integer,
    p_sidik         text,
    p_tanggal       date,
    p_catatan       text,
    p_butir         jsonb
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun     akun%rowtype;
    v_catatan  text := btrim(coalesce(p_catatan, ''));
    v_p        periode%rowtype;
    v_h        jsonb;
    v_u        jsonb;
    v_n        integer;
    v_pagu     bigint;
    v_terpakai bigint;
    v_r        record;
    v_alasan   text;
    v_beda     boolean;
    v_wajib    boolean;
    v_sebelum  jsonb;
    v_hitung   record;
    v_sisa     bigint;
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_tahun is null then return galat_bidang('tahun'); end if;
    if p_tanggal is null or p_tanggal > (now() at time zone 'Asia/Jakarta')::date then
        return galat_bidang('tanggal');
    end if;
    if char_length(v_catatan) not between 20 and 1000 then return galat_bidang('catatan'); end if;

    -- Bentuk p_butir: larik objek, id dan hasil berupa teks, alasan dan sumber_dana teks atau kosong.
    -- JSON yang salah bentuk menghasilkan tidak_valid, bukan pengecualian.
    if p_butir is null or jsonb_typeof(p_butir) <> 'array' or jsonb_array_length(p_butir) > 64 then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir', 'sebab', 'bentuk');
    end if;
    if exists (
        select 1 from jsonb_array_elements(p_butir) e(nilai)
         where jsonb_typeof(e.nilai) <> 'object'
            or jsonb_typeof(e.nilai -> 'id')    is distinct from 'string'
            or jsonb_typeof(e.nilai -> 'hasil') is distinct from 'string'
            or coalesce(jsonb_typeof(e.nilai -> 'alasan'),      'null') not in ('string', 'null')
            or coalesce(jsonb_typeof(e.nilai -> 'sumber_dana'), 'null') not in ('string', 'null')
    ) then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir', 'sebab', 'bentuk');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0));

    select * into v_p from periode where tahun = p_tahun for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_p.status = 'diputuskan' then
        return jsonb_build_object('ok', false, 'kode', 'sudah_ditetapkan', 'tahun', v_p.tahun,
                                  'oleh', v_p.diputuskan_oleh, 'pada', v_p.diputuskan_pada);
    end if;
    if v_p.versi is distinct from p_versi_dibaca then
        return jsonb_build_object('ok', false, 'kode', 'bentrok', 'versi', v_p.versi);
    end if;

    v_h    := sidik_hitungan();
    v_u    := v_h -> 'usulan';
    v_n    := (v_h ->> 'jumlah')::integer;
    v_pagu := (v_h ->> 'pagu')::bigint;
    if v_n = 0 then return galat_forum('tidak_ada_usulan'); end if;

    if (v_h ->> 'sidik') is distinct from p_sidik then
        -- Admin melihat hitungan yang sudah berubah: jawaban memuat keadaan sekarang supaya bisa dijelaskan apa yang berubah.
        return jsonb_build_object('ok', false, 'kode', 'hitungan_berubah',
                                  'pagu', v_pagu, 'versi_bobot', v_h -> 'versi_bobot', 'usulan', v_u);
    end if;

    -- Tiap usulan tepat satu butir: tidak ada yang asing, ganda, atau terlewat.
    if exists (select 1 from butir_terurai(p_butir) b
                where b.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   or not exists (select 1 from jsonb_to_recordset(v_u) as h(id uuid) where h.id::text = lower(b.id))) then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir', 'sebab', 'asing');
    end if;
    if exists (select 1 from butir_terurai(p_butir) b group by lower(b.id) having count(*) > 1) then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir', 'sebab', 'ganda');
    end if;
    if exists (select 1 from jsonb_to_recordset(v_u) as h(id uuid)
                where not exists (select 1 from butir_terurai(p_butir) b where lower(b.id) = h.id::text)) then
        return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir', 'sebab', 'terlewat');
    end if;

    -- Aturan tiap butir. Yang pertama gagal dikembalikan beserta id dan kolomnya, supaya layar menandai barisnya.
    for v_r in
        select b.id, b.hasil, b.alasan, b.sumber_dana, h.status, h.terpilih
          from butir_terurai(p_butir) b
          join jsonb_to_recordset(v_u) as h(id uuid, peringkat integer, status text, terpilih boolean)
            on h.id::text = lower(b.id)
         order by h.peringkat
    loop
        if v_r.hasil not in ('disetujui', 'dana_lain', 'dilanjutkan', 'ditolak') then
            return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir',
                                      'id', v_r.id, 'kolom', 'hasil');
        end if;
        v_wajib := v_r.hasil in ('ditolak', 'dana_lain')
                   or ((v_r.hasil = 'disetujui') is distinct from v_r.terpilih);
        if (v_r.alasan is null and v_wajib)
           or (v_r.alasan is not null and char_length(v_r.alasan) not between 20 and 500) then
            return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir',
                                      'id', v_r.id, 'kolom', 'alasan');
        end if;
        if v_r.hasil = 'dana_lain'
           and (v_r.sumber_dana is null or char_length(v_r.sumber_dana) not between 3 and 80) then
            return jsonb_build_object('ok', false, 'kode', 'tidak_valid', 'bidang', 'butir',
                                      'id', v_r.id, 'kolom', 'sumber_dana');
        end if;
    end loop;

    -- Batas: total yang disetujui tidak melebihi pagu.
    select coalesce(sum(h.biaya), 0) into v_terpakai
      from butir_terurai(p_butir) b
      join jsonb_to_recordset(v_u) as h(id uuid, biaya bigint) on h.id::text = lower(b.id)
     where b.hasil = 'disetujui';
    if v_terpakai > v_pagu then
        return jsonb_build_object('ok', false, 'kode', 'melebihi_pagu', 'terpakai', v_terpakai,
                                  'pagu', v_pagu, 'kelebihan', v_terpakai - v_pagu);
    end if;

    if exists (select 1 from periode where tahun = p_tahun + 1) then
        return galat_forum('tahun_berikut_ada');
    end if;

    select jsonb_object_agg(rw::text, anggaran_lalu) into v_sebelum from wilayah;

    for v_r in
        select b.id, b.hasil, b.alasan, b.sumber_dana,
               h.peringkat, h.judul, h.nama_singkat, h.rw, h.biaya, h.dukungan, h.urgensi, h.skor,
               h.status, h.terpilih
          from butir_terurai(p_butir) b
          join jsonb_to_recordset(v_u) as h(id uuid, peringkat integer, judul text, nama_singkat text,
                                            rw smallint, biaya bigint, dukungan integer, urgensi smallint,
                                            skor numeric, status text, terpilih boolean)
            on h.id::text = lower(b.id)
         order by h.peringkat
    loop
        v_beda   := (v_r.hasil = 'disetujui') is distinct from v_r.terpilih;
        v_alasan := v_r.alasan;
        if v_alasan is null then
            v_alasan := 'Mengikuti rekomendasi: '
                        || case when v_r.terpilih then '' else 'belum terbiayai, ' end
                        || 'peringkat ' || v_r.peringkat || ' dari ' || v_n
                        || ', skor ' || skor_teks(v_r.skor) || '.';
        end if;

        insert into keputusan (tahun, proposal_id, hasil, alasan, sumber_dana, peringkat, jumlah_usulan, skor,
                               status_rekomendasi, biaya, dukungan, urgensi, rw, judul, nama_singkat,
                               beda_dari_rekomendasi)
        values (p_tahun, v_r.id::uuid, v_r.hasil, v_alasan,
                case when v_r.hasil = 'dana_lain' then v_r.sumber_dana end,
                v_r.peringkat, v_n, v_r.skor, v_r.status, v_r.biaya, v_r.dukungan, v_r.urgensi, v_r.rw,
                v_r.judul, v_r.nama_singkat, v_beda);

        if v_r.hasil <> 'dilanjutkan' then
            update proposals
               set status = case v_r.hasil when 'disetujui' then 'approved'
                                           when 'dana_lain' then 'referred'
                                           else 'rejected' end
             where id = v_r.id::uuid;
        end if;

        insert into accountability_logs (log_type, proposal_id, actor, message, detail)
        values ('decision', v_r.id::uuid, v_akun.nama_pengguna,
                'Musyawarah Tahun Anggaran ' || p_tahun || ': '
                    || case v_r.hasil
                         when 'disetujui'   then 'disetujui.'
                         when 'dana_lain'   then 'diajukan ke dana lain (' || v_r.sumber_dana || ').'
                         when 'dilanjutkan' then 'dibawa ke periode berikutnya.'
                         else 'ditolak.' end
                    || ' ' || v_alasan,
                jsonb_build_object('tahun', p_tahun, 'hasil', v_r.hasil, 'alasan', v_alasan,
                                   'berbeda', v_beda, 'sumber_dana',
                                   case when v_r.hasil = 'dana_lain' then v_r.sumber_dana end));
    end loop;

    update wilayah w
       set anggaran_lalu = coalesce((select sum(k.biaya) from keputusan k
                                      where k.tahun = p_tahun and k.dibatalkan_pada is null
                                        and k.hasil = 'disetujui' and k.rw = w.rw), 0);

    update periode
       set status = 'diputuskan', diputuskan_pada = now(), tanggal_musyawarah = p_tanggal,
           catatan = v_catatan, pagu = v_pagu,
           bobot = v_h -> 'bobot', ada_rekomendasi = true, wilayah_sebelum = v_sebelum,
           diputuskan_oleh = v_akun.nama_pengguna, versi = versi + 1
     where tahun = p_tahun;

    insert into periode (tahun, status) values (p_tahun + 1, 'berjalan');

    select count(*) filter (where hasil = 'disetujui')   as disetujui,
           count(*) filter (where hasil = 'dana_lain')   as dana_lain,
           count(*) filter (where hasil = 'dilanjutkan') as dilanjutkan,
           count(*) filter (where hasil = 'ditolak')     as ditolak,
           count(*) filter (where beda_dari_rekomendasi) as beda
      into v_hitung
      from keputusan where tahun = p_tahun and dibatalkan_pada is null;
    v_sisa := v_pagu - v_terpakai;

    -- Ringkasan dicatat terakhir: id-nya terbesar, jadi tampil paling atas di jejak keputusan.
    insert into accountability_logs (log_type, actor, message, detail)
    values ('decision', v_akun.nama_pengguna,
            'Musyawarah menetapkan keputusan Tahun Anggaran ' || p_tahun || ': '
                || v_hitung.disetujui || ' disetujui, ' || v_hitung.dana_lain || ' diajukan ke dana lain, '
                || v_hitung.dilanjutkan || ' dibawa ke periode berikutnya, ' || v_hitung.ditolak || ' ditolak. '
                || 'Terpakai ' || rupiah_teks(v_terpakai) || ' dari pagu ' || rupiah_teks(v_pagu)
                || ', sisa ' || rupiah_teks(v_sisa) || '. '
                || v_hitung.beda || ' keputusan berbeda dari rekomendasi.',
            jsonb_build_object('tahun', p_tahun, 'tanggal', p_tanggal,
                               'disetujui', v_hitung.disetujui, 'dana_lain', v_hitung.dana_lain,
                               'dilanjutkan', v_hitung.dilanjutkan, 'ditolak', v_hitung.ditolak,
                               'terpakai', v_terpakai, 'pagu', v_pagu, 'sisa', v_sisa,
                               'berbeda', v_hitung.beda));

    return jsonb_build_object('ok', true, 'tahun', p_tahun, 'tahun_berikut', p_tahun + 1,
                              'terpakai', v_terpakai, 'pagu', v_pagu, 'sisa', v_sisa,
                              'disetujui', v_hitung.disetujui, 'dana_lain', v_hitung.dana_lain,
                              'dilanjutkan', v_hitung.dilanjutkan, 'ditolak', v_hitung.ditolak,
                              'berbeda', v_hitung.beda);
end $$;

-- -----------------------------------------------------------------------------
-- 6. Membatalkan penetapan
--    Hanya penetapan TERAKHIR, dalam 24 jam, selama belum ada usulannya yang 'done'. Semua dikembalikan:
--    status usulan, anggaran_lalu, dan periode (tahun berikutnya ditutup lagi). Catatan lama tidak
--    dihapus: keputusan diberi dibatalkan_pada, dan pembatalannya masuk jejak publik.
--    Usulan yang dikembalikan ke 'voting' tunduk pada batas 16 yang sama dengan pindahkan_status.
-- -----------------------------------------------------------------------------
-- Inti pembatalan, dipakai batalkan_penetapan (admin, dengan batas 24 jam) dan supabase/demo_pulihkan_periode.sql
-- (pemilik proyek lewat SQL Editor, p_abaikan_waktu = true). Satu kode, jadi satu perilaku yang diuji.
create function pulihkan_periode(
    p_tahun          integer,
    p_alasan         text,
    p_pelaku         text,
    p_abaikan_waktu  boolean
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_p       periode%rowtype;
    v_pulih   integer;
    v_voting  integer;
    v_r       record;
begin
    perform pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0));

    select * into v_p from periode where tahun = p_tahun for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_p.status <> 'diputuskan' or not v_p.ada_rekomendasi then
        return galat_forum('tidak_bisa_dibatalkan');
    end if;
    if exists (select 1 from periode where status = 'diputuskan' and tahun > p_tahun) then
        return galat_forum('bukan_terakhir');
    end if;
    if not p_abaikan_waktu and v_p.diputuskan_pada <= now() - interval '24 hours' then
        return galat_forum('lewat_batas');
    end if;
    if exists (select 1 from keputusan k join proposals p on p.id = k.proposal_id
                where k.tahun = p_tahun and k.dibatalkan_pada is null and p.status = 'done') then
        return galat_forum('sudah_dikerjakan');
    end if;

    -- Yang dikembalikan ke 'voting' ditambah yang sudah menunggu di hitungan (periode berikutnya) maksimal 16.
    select count(*)::int into v_pulih
      from keputusan k join proposals p on p.id = k.proposal_id
     where k.tahun = p_tahun and k.dibatalkan_pada is null
       and k.hasil <> 'dilanjutkan' and p.disembunyikan_pada is null;
    select count(*)::int into v_voting
      from proposals where status = 'voting' and disembunyikan_pada is null;
    if v_pulih + v_voting > 16 then
        return jsonb_build_object('ok', false, 'kode', 'batas_voting',
                                  'jumlah', v_pulih + v_voting, 'batas', 16, 'dipulihkan', v_pulih);
    end if;

    for v_r in
        select k.proposal_id, k.hasil from keputusan k
         where k.tahun = p_tahun and k.dibatalkan_pada is null order by k.peringkat nulls last, k.id
    loop
        if v_r.hasil <> 'dilanjutkan' then
            update proposals set status = 'voting' where id = v_r.proposal_id;
        end if;
        insert into accountability_logs (log_type, proposal_id, actor, message, detail)
        values ('decision', v_r.proposal_id, p_pelaku,
                'Penetapan keputusan Tahun Anggaran ' || p_tahun || ' dibatalkan, usulan ini kembali dalam hitungan anggaran. Alasan: ' || p_alasan,
                jsonb_build_object('tahun', p_tahun, 'aksi', 'batal', 'alasan', p_alasan));
    end loop;

    update keputusan set dibatalkan_pada = now() where tahun = p_tahun and dibatalkan_pada is null;

    update wilayah w
       set anggaran_lalu = (v_p.wilayah_sebelum ->> w.rw::text)::bigint
     where v_p.wilayah_sebelum ? w.rw::text;

    delete from periode where tahun = p_tahun + 1 and status = 'berjalan';

    update periode
       set status = 'berjalan', diputuskan_pada = null, tanggal_musyawarah = null, catatan = null,
           pagu = null, bobot = null, ada_rekomendasi = false, wilayah_sebelum = null,
           diputuskan_oleh = null, versi = versi + 1
     where tahun = p_tahun;

    insert into accountability_logs (log_type, actor, message, detail)
    values ('decision', p_pelaku,
            'Penetapan keputusan Tahun Anggaran ' || p_tahun || ' dibatalkan. Alasan: ' || p_alasan,
            jsonb_build_object('tahun', p_tahun, 'aksi', 'batal', 'alasan', p_alasan,
                               'tanggal_musyawarah', v_p.tanggal_musyawarah, 'catatan_lama', v_p.catatan));

    return jsonb_build_object('ok', true, 'tahun', p_tahun, 'dipulihkan', v_pulih);
end $$;

create function batalkan_penetapan(p_akun uuid, p_tahun integer, p_alasan text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun   akun%rowtype;
    v_alasan text := btrim(coalesce(p_alasan, ''));
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if p_tahun is null then return galat_bidang('tahun'); end if;
    if char_length(v_alasan) not between 10 and 500 then return galat_bidang('alasan'); end if;

    return pulihkan_periode(p_tahun, v_alasan, v_akun.nama_pengguna, false);
end $$;

-- -----------------------------------------------------------------------------
-- 7. Menandai usulan selesai dikerjakan (approved -> done, referred -> done)
-- -----------------------------------------------------------------------------
create function tandai_selesai(
    p_akun             uuid,
    p_proposal         uuid,
    p_status_dibaca    text,
    p_catatan          text,
    p_biaya_realisasi  bigint default null
) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
    v_akun    akun%rowtype;
    v_p       proposals%rowtype;
    v_catatan text := btrim(coalesce(p_catatan, ''));
begin
    select * into v_akun from akun where id = p_akun;
    if not found or not v_akun.aktif then return galat_forum('akun_tidak_aktif'); end if;
    if v_akun.peran <> 'admin'       then return galat_forum('bukan_admin');      end if;

    if char_length(v_catatan) not between 10 and 500 then return galat_bidang('catatan'); end if;
    if p_biaya_realisasi is not null and p_biaya_realisasi not between 1 and 10000000000 then
        return galat_bidang('biaya_realisasi');
    end if;

    -- Kunci yang sama dengan penetapan: tidak berjalan bersamaan dengan pembatalan.
    perform pg_advisory_xact_lock(hashtextextended('hitungan_anggaran', 0));

    select * into v_p from proposals where id = p_proposal for update;
    if not found then return galat_forum('tidak_ditemukan'); end if;
    if v_p.disembunyikan_pada is not null then return galat_forum('disembunyikan'); end if;
    if v_p.status is distinct from p_status_dibaca then
        return jsonb_build_object('ok', false, 'kode', 'bentrok', 'status_sekarang', v_p.status);
    end if;
    if v_p.status not in ('approved', 'referred') then
        return jsonb_build_object('ok', false, 'kode', 'transisi_tidak_diizinkan', 'dari', v_p.status, 'ke', 'done');
    end if;

    update proposals
       set status = 'done', selesai_pada = now(), catatan_selesai = v_catatan, biaya_realisasi = p_biaya_realisasi
     where id = p_proposal;

    insert into accountability_logs (log_type, proposal_id, actor, message, detail)
    values ('status_change', p_proposal, v_akun.nama_pengguna,
            'Usulan ditandai selesai dikerjakan.'
                || case when p_biaya_realisasi is null then '' else ' Biaya realisasi ' || rupiah_teks(p_biaya_realisasi) || '.' end
                || ' Catatan: ' || v_catatan,
            jsonb_build_object('dari', v_p.status, 'ke', 'done', 'catatan', v_catatan,
                               'biaya_realisasi', p_biaya_realisasi));

    return jsonb_build_object('ok', true, 'proposal_id', p_proposal);
end $$;

-- -----------------------------------------------------------------------------
-- 8. View publik
--    Tanpa id akun dan tanpa data pribadi. security_invoker: RLS tabel dasarnya (tanpa policy) tetap
--    berlaku bagi anon dan authenticated.
-- -----------------------------------------------------------------------------
create view v_periode with (security_invoker = true) as
select
    p.tahun, p.status, p.versi, p.dibuka_pada, p.diputuskan_pada, p.tanggal_musyawarah, p.catatan,
    p.pagu, p.bobot, p.ada_rekomendasi, p.wilayah_sebelum, p.diputuskan_oleh,
    coalesce(k.disetujui, 0)   as jumlah_disetujui,
    coalesce(k.dana_lain, 0)   as jumlah_dana_lain,
    coalesce(k.dilanjutkan, 0) as jumlah_dilanjutkan,
    coalesce(k.ditolak, 0)     as jumlah_ditolak,
    coalesce(k.beda, 0)        as jumlah_beda,
    coalesce(k.terpakai, 0)    as terpakai
from periode p
left join lateral (
    select count(*) filter (where hasil = 'disetujui')::int   as disetujui,
           count(*) filter (where hasil = 'dana_lain')::int   as dana_lain,
           count(*) filter (where hasil = 'dilanjutkan')::int as dilanjutkan,
           count(*) filter (where hasil = 'ditolak')::int     as ditolak,
           count(*) filter (where beda_dari_rekomendasi)::int as beda,
           coalesce(sum(biaya) filter (where hasil = 'disetujui'), 0)::bigint as terpakai
      from keputusan where tahun = p.tahun and dibatalkan_pada is null
) k on true;

-- Keputusan yang berlaku (tanpa yang dibatalkan). Judul dikosongkan bila usulannya kelak disembunyikan.
create view v_keputusan with (security_invoker = true) as
select
    k.tahun, k.proposal_id, k.hasil, k.alasan, k.sumber_dana,
    k.peringkat, k.jumlah_usulan, k.skor, k.status_rekomendasi, k.biaya, k.dukungan, k.urgensi, k.rw,
    case when p.disembunyikan_pada is null then k.judul        end as judul,
    case when p.disembunyikan_pada is null then k.nama_singkat end as nama_singkat,
    k.beda_dari_rekomendasi,
    p.status          as status_sekarang,
    p.selesai_pada,
    case when p.disembunyikan_pada is null then p.catatan_selesai end as catatan_selesai,
    p.biaya_realisasi
from keputusan k
join proposals p on p.id = k.proposal_id
where k.dibatalkan_pada is null;

-- -----------------------------------------------------------------------------
-- 9. Periode berjalan pertama
-- -----------------------------------------------------------------------------
insert into periode (tahun, status) values (2027, 'berjalan');

-- -----------------------------------------------------------------------------
-- 10. Hak akses: hanya service_role (server) yang boleh memanggil fungsi di atas.
-- -----------------------------------------------------------------------------
revoke execute on function hitungan_dengan_status(bigint)  from public, anon, authenticated;
revoke execute on function sidik_hitungan()                from public, anon, authenticated;
revoke execute on function butir_terurai(jsonb)            from public, anon, authenticated;
revoke execute on function skor_teks(numeric)              from public, anon, authenticated;
revoke execute on function tetapkan_keputusan(uuid, integer, integer, text, date, text, jsonb)
                                                           from public, anon, authenticated;
revoke execute on function batalkan_penetapan(uuid, integer, text)
                                                           from public, anon, authenticated;
revoke execute on function pulihkan_periode(integer, text, text, boolean)
                                                           from public, anon, authenticated;
revoke execute on function tandai_selesai(uuid, uuid, text, text, bigint)
                                                           from public, anon, authenticated;

commit;
