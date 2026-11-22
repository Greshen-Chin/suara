-- =============================================================================
-- SUARA — Migrasi 0003: akun untuk masuk (login)
--
-- Jalankan SETELAH 0002. Akun dibuat dengan: npm run akun:buat
-- (skrip itu mencetak perintah INSERT berisi hash; kata sandi asli tidak pernah disimpan).
--
--   akun             : nama pengguna, hash kata sandi (scrypt + salt), peran.
--   percobaan_masuk  : penghitung login gagal per nama pengguna, untuk mengunci
--                      sementara setelah terlalu banyak percobaan.
-- =============================================================================

begin;

create table akun (
    id               uuid primary key default gen_random_uuid(),
    nama_pengguna    text not null unique
                     check (nama_pengguna ~ '^[a-z0-9._-]{3,32}$'),
    -- Format PHC dari lib/kata-sandi.ts. Kata sandi asli tidak pernah disimpan.
    hash_kata_sandi  text not null check (hash_kata_sandi like '$scrypt$%'),
    peran            text not null check (peran in ('warga', 'admin')),
    warga_id         uuid references warga (id) on delete set null,
    aktif            boolean not null default true,
    -- Naikkan angka ini untuk mencabut semua sesi akun (mis. setelah ganti kata sandi).
    versi_sesi       integer not null default 1 check (versi_sesi > 0),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create trigger akun_updated_at
    before update on akun
    for each row execute function trg_set_updated_at();

-- Dihitung per nama pengguna, termasuk nama yang tidak terdaftar, supaya penguncian
-- tidak membocorkan nama mana yang ada.
create table percobaan_masuk (
    nama_pengguna    text primary key,
    gagal            integer not null default 0,
    jendela_mulai    timestamptz not null default now(),
    terkunci_sampai  timestamptz
);

alter table akun            enable row level security;
alter table percobaan_masuk enable row level security;

-- Catat satu kegagalan secara atomik. Setelah p_batas kegagalan dalam p_jendela,
-- nama pengguna dikunci selama p_kunci. Mengembalikan waktu akhir penguncian (atau null).
create function catat_gagal_masuk(
    p_nama_pengguna text,
    p_batas         integer  default 5,
    p_jendela       interval default '15 minutes',
    p_kunci         interval default '15 minutes'
) returns timestamptz
language plpgsql as $$
declare
    v_gagal   integer;
    v_terkunci timestamptz;
begin
    insert into percobaan_masuk as pm (nama_pengguna, gagal, jendela_mulai)
    values (p_nama_pengguna, 1, now())
    on conflict (nama_pengguna) do update
    set gagal         = case when pm.jendela_mulai < now() - p_jendela then 1
                             else pm.gagal + 1 end,
        jendela_mulai = case when pm.jendela_mulai < now() - p_jendela then now()
                             else pm.jendela_mulai end
    returning gagal, terkunci_sampai into v_gagal, v_terkunci;

    if v_gagal >= p_batas then
        update percobaan_masuk
        set terkunci_sampai = now() + p_kunci,
            gagal = 0,
            jendela_mulai = now()
        where nama_pengguna = p_nama_pengguna
        returning terkunci_sampai into v_terkunci;
    end if;

    return v_terkunci;
end $$;

-- Hanya server (service_role) yang boleh memanggil fungsi ini.
revoke execute on function catat_gagal_masuk(text, integer, interval, interval)
    from public, anon, authenticated;

commit;
