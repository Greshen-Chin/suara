// Harness tes SQL: Postgres di dalam Node (PGlite), lengkap dengan pgvector, pg_trgm,
// dan PostGIS. Tidak menyentuh database Supabase milik siapa pun.
//
// Urutan memuat file sama dengan urutan yang dijalankan pemilik proyek di SQL Editor:
//   0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> seed_forum.sql -> 0005 -> 0006 -> seed_keputusan.sql -> 0007
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { postgis } from "@electric-sql/pglite-postgis";
import { vector } from "@electric-sql/pglite-pgvector";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..");

export const BERKAS = {
  m0001: "migrations/0001_schema.sql",
  m0002: "migrations/0002_wilayah_dan_skor_per_kapita.sql",
  seed: "seed.sql",
  m0003: "migrations/0003_akun.sql",
  m0004: "migrations/0004_forum.sql",
  seedForum: "seed_forum.sql",
  m0005: "migrations/0005_admin.sql",
  m0006: "migrations/0006_keputusan.sql",
  m0007: "migrations/0007_saran_urgensi.sql",
  seedKeputusan: "seed_keputusan.sql",
  pulihkanPeriode: "demo_pulihkan_periode.sql",
} as const;

export type NamaBerkas = keyof typeof BERKAS;

export function bacaSql(berkas: NamaBerkas): string {
  return readFileSync(join(AKAR, BERKAS[berkas]), "utf8");
}

// Meniru lingkungan Supabase: skema `extensions`, tiga peran bawaan, dan hak execute
// otomatis untuk fungsi baru (itulah yang membuat `revoke` di migrasi perlu ada).
const PERSIAPAN = `
  create schema if not exists extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter database template1 set search_path = "$user", public, extensions;
  set search_path = "$user", public, extensions;
`;

/**
 * `tanggalSebagaiTeks`: kolom bertipe `date` dibaca sebagai teks "YYYY-MM-DD", seperti PostgREST. Tanpa ini PGlite
 * mengubahnya menjadi objek Date (tengah malam zona waktu mesin), dan JSON-nya bergeser sehari di zona waktu Indonesia.
 * Dipakai server tiruan E2E; tes SQL memakai `::text` sendiri bila butuh.
 */
export async function buatDatabase(opsi: { tanggalSebagaiTeks?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({
    extensions: { vector, pg_trgm, postgis },
    ...(opsi.tanggalSebagaiTeks && { parsers: { 1082: (nilai: string) => nilai } }),
  });
  await db.waitReady;
  await db.exec(PERSIAPAN);
  return db;
}

/** Muat berkas-berkas tertentu berurutan. */
export async function muat(db: PGlite, ...berkas: NamaBerkas[]): Promise<void> {
  for (const nama of berkas) {
    try {
      await db.exec(bacaSql(nama));
    } catch (err) {
      throw new Error(
        `${BERKAS[nama]} gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export const SEBELUM_FORUM = ["m0001", "m0002", "seed", "m0003"] as const;
export const SEMUA = [...SEBELUM_FORUM, "m0004", "seedForum"] as const;
/** Sampai migrasi admin. Akun harus sudah ada sebelum seedForum, jadi pemanggil menyisipkannya sendiri. */
export const SEMUA_DENGAN_ADMIN = [...SEMUA, "m0005"] as const;
/** Sampai migrasi keputusan (m0006); seedKeputusan dimuat sesudahnya oleh pemanggil yang membutuhkannya. */
export const SEMUA_DENGAN_KEPUTUSAN = [...SEMUA_DENGAN_ADMIN, "m0006"] as const;
/** Sampai migrasi saran urgensi (m0007), dimuat sesudah seedKeputusan. */
export const SEMUA_DENGAN_SARAN = [...SEMUA_DENGAN_KEPUTUSAN, "seedKeputusan", "m0007"] as const;

/** Hasil rekomendasi_resmi sebagai teks yang stabil, untuk dibandingkan sebelum dan sesudah. */
export async function sidikRekomendasi(db: PGlite, pagu = 300_000_000): Promise<string> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select peringkat, title, nama_singkat, category, rw, estimated_budget, vote_count,
            urgency_score, skor::text as skor, selected, total_berjalan
       from rekomendasi_resmi($1) order by peringkat`,
    [pagu],
  );
  return JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1);
}
