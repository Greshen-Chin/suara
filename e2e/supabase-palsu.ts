// Server tiruan Supabase REST (subset PostgREST) di atas PGlite, HANYA untuk pengujian E2E.
// Tidak dipakai di produksi dan tidak menyentuh database Supabase siapa pun.
//
//   node e2e/supabase-palsu.ts            (port 54321)
//
// Yang ditiru hanyalah bentuk permintaan yang dipakai aplikasi ini lewat supabase-js:
//   GET   /rest/v1/<tabel|view>?select=a,b&kolom=eq.x&kolom=in.(a,b)&order=k.desc&limit=n
//   HEAD  (dengan Prefer: count=exact)
//   PATCH /rest/v1/<tabel>?kolom=eq.x      DELETE /rest/v1/<tabel>?kolom=eq.x
//   POST  /rest/v1/rpc/<fungsi>            (argumen bernama, hasil jsonb/skalar/tabel)
// Sisanya (embedded resource, upsert, dll.) sengaja tidak ada: aplikasi tidak memakainya.
//
// Konsekuensi yang jujur: ini BUKAN PostgREST. Kecocokan dengan PostgREST asli (mis. cara
// PostgREST mengubah argumen JSON menjadi tipe vector) tidak ikut terverifikasi.
//
// Titik tambahan khusus uji:
//   POST /__uji/mundur   memundurkan waktu komentar dan usulan 25 jam (menguji batas laju)
//   POST /__uji/reset    memuat ulang seluruh skema dan seed dari awal
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { PGlite } from "@electric-sql/pglite";
import { hashKataSandi } from "../lib/kata-sandi.ts";
import { embedTeks, keLiteralVektor, susunTeksEmbedding } from "../lib/embedding.ts";
import { buatDatabase, muat, SEBELUM_FORUM } from "../supabase/tests/pglite.ts";

const PORT = Number(process.env.PORT_SUPABASE_PALSU ?? 54321);
const IDENT = /^[a-z_][a-z0-9_]*$/;

async function siapkan(): Promise<PGlite> {
  const db = await buatDatabase();
  await muat(db, ...SEBELUM_FORUM, "m0004");
  // Akun demo seperti hasil `npm run akun:buat`: `warga` belum tertaut ke data warga,
  // lalu seed_forum.sql menautkannya ke warga RW 07 nomor 70.
  const [warga, admin] = await Promise.all([hashKataSandi("warga123"), hashKataSandi("admin123")]);
  await db.query(
    `insert into akun (nama_pengguna, hash_kata_sandi, peran) values ('warga', $1, 'warga'), ('admin', $2, 'admin')`,
    [warga, admin],
  );
  await muat(db, "seedForum");
  // Migrasi admin dijalankan terakhir, seperti urutan yang diberikan ke pemilik proyek.
  await muat(db, "m0005");

  // Isi embedding seperti `npm run embedding:isi`, supaya jalur "AI" ikut teruji. Bila model
  // tidak bisa dimuat (mis. tanpa internet), dilewati: aplikasi lalu memakai cadangan kata.
  if (process.env.E2E_TANPA_EMBEDDING !== "1") {
    try {
      const { rows } = await db.query<{ id: string; title: string; description: string }>(
        "select id, title, description from proposals where embedding is null",
      );
      for (const u of rows) {
        const v = await embedTeks(susunTeksEmbedding(u.title, u.description ?? ""), 120_000);
        await db.query("update proposals set embedding = $2 where id = $1", [u.id, keLiteralVektor(v)]);
      }
      console.log(`Embedding terisi untuk ${rows.length} usulan.`);
    } catch (err) {
      console.warn("Embedding dilewati:", err instanceof Error ? err.message : err);
    }
  }
  return db;
}

let db = await siapkan();

// ---------------------------------------------------------------------------

class GalatRest extends Error {
  status: number;
  kode: string;
  constructor(status: number, kode: string, message: string) {
    super(message);
    this.status = status;
    this.kode = kode;
  }
}

function ident(nama: string): string {
  if (!IDENT.test(nama)) throw new GalatRest(400, "PGRST100", `nama tidak sah: ${nama}`);
  return `"${nama}"`;
}

/** Kolom angka dikembalikan sebagai angka JSON, seperti PostgREST (PGlite memberi bigint/numeric sebagai teks atau BigInt). */
const OID_ANGKA = new Set([20, 1700, 700, 701]);
function bersihkan(hasil: { rows: Record<string, unknown>[]; fields: { name: string; dataTypeID: number }[] }) {
  const angka = hasil.fields.filter((f) => OID_ANGKA.has(f.dataTypeID)).map((f) => f.name);
  return hasil.rows.map((r) => {
    const baris: Record<string, unknown> = { ...r };
    for (const k of angka) if (baris[k] !== null && baris[k] !== undefined) baris[k] = Number(baris[k]);
    return baris;
  });
}

function sebagaiJson(nilai: unknown): string {
  return JSON.stringify(nilai, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}

interface Saring {
  sql: string;
  param: unknown[];
}

const KHUSUS = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

function bacaFilter(url: URL, mulaiParam = 1): Saring {
  const potongan: string[] = [];
  const param: unknown[] = [];
  for (const [kunci, nilai] of url.searchParams) {
    if (KHUSUS.has(kunci)) continue;
    const titik = nilai.indexOf(".");
    const op = nilai.slice(0, titik);
    const isi = nilai.slice(titik + 1);
    const kolom = ident(kunci);
    if (op === "eq") {
      param.push(isi);
      potongan.push(`${kolom}::text = $${mulaiParam + param.length - 1}`);
    } else if (op === "in") {
      const daftar = isi
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((x) => x.replace(/^"|"$/g, ""));
      param.push(daftar);
      potongan.push(`${kolom}::text = any($${mulaiParam + param.length - 1}::text[])`);
    } else if (op === "is" && isi === "null") {
      potongan.push(`${kolom} is null`);
    } else {
      throw new GalatRest(400, "PGRST100", `operator tidak didukung: ${op}`);
    }
  }
  return { sql: potongan.length ? ` where ${potongan.join(" and ")}` : "", param };
}

function bacaUrutan(url: URL): string {
  const o = url.searchParams.get("order");
  if (!o) return "";
  const bagian = o.split(",").map((b) => {
    const [kolom, ...opsi] = b.split(".");
    return `${ident(kolom)} ${opsi.includes("desc") ? "desc" : "asc"}${opsi.includes("nullsfirst") ? " nulls first" : ""}`;
  });
  return ` order by ${bagian.join(", ")}`;
}

function bacaKolom(url: URL): string {
  const s = url.searchParams.get("select") ?? "*";
  if (s === "*") return "*";
  return s
    .split(",")
    .map((k) => ident(k.trim()))
    .join(", ");
}

async function bacaBadan(req: IncomingMessage): Promise<string> {
  const potongan: Buffer[] = [];
  for await (const p of req) potongan.push(p as Buffer);
  return Buffer.concat(potongan).toString("utf8");
}

function kirim(res: ServerResponse, status: number, badan?: string, header: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...header });
  res.end(badan);
}

async function tangani(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/__uji/mundur" && req.method === "POST") {
    await db.exec(`
      update komentar set created_at = created_at - interval '25 hours';
      update proposals set created_at = created_at - interval '25 hours'
       where source = 'forum' and created_at > now() - interval '24 hours';
    `);
    return kirim(res, 200, "{}");
  }
  if (url.pathname === "/__uji/reset" && req.method === "POST") {
    await db.close();
    db = await siapkan();
    return kirim(res, 200, "{}");
  }

  // Tiga usulan forum tambahan (id tetap) supaya halaman simulasi bisa diuji dengan 16 usulan: 7 voting + 9 forum.
  // POST menambah, DELETE menghapus lagi (dukungan ikut terhapus lewat on delete cascade).
  const ID_TAMBAHAN = ["6f1b3d0a-1001-4c8e-9a10-000000000091", "6f1b3d0a-1001-4c8e-9a10-000000000092", "6f1b3d0a-1001-4c8e-9a10-000000000093"];
  if (url.pathname === "/__uji/usulan-tambahan" && req.method === "POST") {
    await db.exec(`
      insert into proposals (id, title, nama_singkat, description, category, estimated_budget, status, source, proposer_id, rw, created_at)
      select v.id::uuid, v.title, v.nama_singkat, v.deskripsi, v.kategori, v.biaya, 'forum', 'forum',
             (select w.id from warga w where w.nomor = v.nomor), v.rw, now() - v.umur
        from (values
          ('${ID_TAMBAHAN[0]}', 'Pagar sekolah RW 03 perlu dicat ulang', 'Pagar sekolah', 'Pagar sekolah dasar di RW 03 sudah mengelupas dan berkarat di beberapa tempat. Kami usul pengecatan ulang dan perbaikan engsel gerbang.', 'pendidikan', 9000000, 45, 3, interval '10 days'),
          ('${ID_TAMBAHAN[1]}', 'Bangku taman dekat balai warga RW 01', 'Bangku taman', 'Bangku kayu di taman dekat balai RW 01 sudah lapuk dan berbahaya. Kami usul mengganti empat bangku dengan bahan yang tahan hujan.', 'fasilitas', 7000000, 10, 1, interval '11 days'),
          ('${ID_TAMBAHAN[2]}', 'Selokan depan musala RW 07 tersumbat', 'Selokan musala', 'Selokan depan musala RW 07 tersumbat sampah dan meluap setiap hujan deras. Kami usul pengerukan dan pemasangan penutup berlubang.', 'lingkungan', 11000000, 63, 7, interval '12 days')
        ) as v (id, title, nama_singkat, deskripsi, kategori, biaya, nomor, rw, umur)
      on conflict (id) do nothing;
    `);
    return kirim(res, 200, "{}");
  }
  if (url.pathname === "/__uji/usulan-tambahan" && req.method === "DELETE") {
    await db.query("delete from proposals where id = any($1::uuid[])", [ID_TAMBAHAN]);
    return kirim(res, 200, "{}");
  }

  const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
  if (rpc && req.method === "POST") {
    const args = JSON.parse((await bacaBadan(req)) || "{}") as Record<string, unknown>;
    const nama = ident(rpc[1]);
    const kunci = Object.keys(args);
    const sql = `select * from ${nama}(${kunci.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")})`;
    const hasil = await db.query<Record<string, unknown>>(sql, kunci.map((k) => args[k]));
    const baris = bersihkan(hasil as never);
    // Fungsi skalar (jsonb, timestamptz): satu kolom bernama sama dengan fungsinya.
    if (hasil.fields.length === 1 && hasil.fields[0].name === rpc[1]) {
      return kirim(res, 200, sebagaiJson(baris[0]?.[rpc[1]] ?? null));
    }
    return kirim(res, 200, sebagaiJson(baris));
  }

  const rel = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (!rel) return kirim(res, 404, sebagaiJson({ code: "PGRST125", message: "Invalid path" }));
  const tabel = ident(rel[1]);
  const { sql: where, param } = bacaFilter(url);

  if (req.method === "GET" || req.method === "HEAD") {
    const batas = url.searchParams.get("limit");
    const sql = `select ${bacaKolom(url)} from ${tabel}${where}${bacaUrutan(url)}${batas ? ` limit ${Number(batas) | 0}` : ""}`;
    const baris = bersihkan((await db.query(sql, param)) as never);
    const header: Record<string, string> = { "content-range": `0-${Math.max(baris.length - 1, 0)}/${baris.length}` };
    if (req.method === "HEAD") return kirim(res, 200, undefined, header);
    if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
      if (baris.length !== 1) {
        return kirim(
          res,
          406,
          sebagaiJson({ code: "PGRST116", details: `The result contains ${baris.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" }),
        );
      }
      return kirim(res, 200, sebagaiJson(baris[0]), header);
    }
    return kirim(res, 200, sebagaiJson(baris), header);
  }

  if (req.method === "PATCH") {
    const badan = JSON.parse((await bacaBadan(req)) || "{}") as Record<string, unknown>;
    const kunci = Object.keys(badan);
    const set = kunci.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ");
    const { sql: whereBaru, param: paramBaru } = bacaFilter(url, kunci.length + 1);
    await db.query(`update ${tabel} set ${set}${whereBaru}`, [...kunci.map((k) => badan[k]), ...paramBaru]);
    return kirim(res, 204);
  }

  if (req.method === "DELETE") {
    await db.query(`delete from ${tabel}${where}`, param);
    return kirim(res, 204);
  }

  return kirim(res, 405, sebagaiJson({ code: "PGRST000", message: "metode tidak didukung" }));
}

createServer((req, res) => {
  tangani(req, res).catch((err: unknown) => {
    if (err instanceof GalatRest) return kirim(res, err.status, sebagaiJson({ code: err.kode, message: err.message }));
    const pesan = err instanceof Error ? err.message : String(err);
    // Seperti PostgREST: kolom/relasi yang tidak ada -> 400/404, galat SQL lain -> 400.
    const tidakAda = /does not exist/.test(pesan);
    kirim(res, tidakAda ? 404 : 400, sebagaiJson({ code: tidakAda ? "42P01" : "P0001", message: pesan, details: null, hint: null }));
  });
}).listen(PORT, () => console.log(`Supabase palsu (PGlite) di http://localhost:${PORT}`));
