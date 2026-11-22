// Mengisi kolom proposals.embedding untuk usulan yang belum punya (termasuk data seed), supaya
// pemeriksaan "usulan serupa" bisa membandingkan MAKNA, bukan hanya kata.
//
//   npm run embedding:isi             mencetak perintah SQL `update` (hanya MEMBACA dari database)
//   npm run embedding:isi -- --tulis  menulis langsung ke database, setelah Anda mengetik YA
//   npm run embedding:isi -- --semua  hitung ulang semua usulan, bukan hanya yang kosong
//
// Perlu SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local. Kunci service role dipakai di
// sini secara eksplisit dan hanya dari mesin Anda sendiri; skrip ini TIDAK menulis apa pun kecuali
// dengan --tulis dan persetujuan Anda. Mode cetak aman: Anda menempelkan hasilnya di SQL Editor.
//
// Skrip memakai fetch biasa ke API REST Supabase, bukan lib/supabase-server.ts (modul itu
// "server-only" dan sengaja tidak bisa diimpor di luar server Next.js).
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { embedTeks, keLiteralVektor, NAMA_MODEL, susunTeksEmbedding } from "../lib/embedding.ts";

const url = process.env.SUPABASE_URL;
const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tulis = process.argv.includes("--tulis");
const semua = process.argv.includes("--semua");

if (!url || !kunci) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus ada di .env.local.");
  process.exit(1);
}

const alamatDb: string = url; // sudah dipastikan ada oleh pemeriksaan di atas
const header = { apikey: kunci, authorization: `Bearer ${kunci}`, "content-type": "application/json" };

interface Usulan {
  id: string;
  title: string;
  description: string | null;
}

async function ambilUsulan(): Promise<Usulan[]> {
  const saring = semua ? "" : "&embedding=is.null";
  const r = await fetch(`${alamatDb}/rest/v1/proposals?select=id,title,description&status=in.(forum,voting,approved,rejected,done)${saring}&order=created_at`, { headers: header });
  if (!r.ok) throw new Error(`Gagal membaca usulan (${r.status}): ${await r.text()}`);
  return (await r.json()) as Usulan[];
}

async function utama() {
  const daftar = await ambilUsulan();
  if (daftar.length === 0) {
    console.log("Semua usulan sudah punya embedding. Tidak ada yang perlu diisi.");
    return;
  }
  console.error(`Menghitung embedding ${daftar.length} usulan dengan ${NAMA_MODEL} (unduhan pertama sekitar 118 MB)...`);

  const hasil: { id: string; vektor: string; judul: string }[] = [];
  for (const u of daftar) {
    const v = await embedTeks(susunTeksEmbedding(u.title, u.description ?? ""), 180_000);
    hasil.push({ id: u.id, vektor: keLiteralVektor(v), judul: u.title });
    console.error(`  ok  ${u.title}`);
  }

  if (!tulis) {
    console.log("\n-- Jalankan di SQL Editor Supabase (menulis embedding untuk usulan di atas):");
    console.log("begin;");
    for (const h of hasil) {
      console.log(`-- ${h.judul.replace(/[\r\n]+/g, " ")}`);
      console.log(`update proposals set embedding = '${h.vektor}'::vector where id = '${h.id}';`);
    }
    console.log("commit;");
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const jawab = (await rl.question(`Tulis embedding ${hasil.length} usulan ke ${new URL(alamatDb).host}? Ketik YA untuk melanjutkan: `)).trim();
  rl.close();
  if (jawab !== "YA") {
    console.log("Dibatalkan. Tidak ada yang ditulis.");
    return;
  }
  for (const h of hasil) {
    const r = await fetch(`${alamatDb}/rest/v1/proposals?id=eq.${h.id}`, {
      method: "PATCH",
      headers: header,
      body: JSON.stringify({ embedding: h.vektor }),
    });
    if (!r.ok) throw new Error(`Gagal menulis ${h.id} (${r.status}): ${await r.text()}`);
  }
  console.log(`Selesai: ${hasil.length} usulan terisi.`);
}

utama().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
