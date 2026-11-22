// Membuat akun baru: npm run akun:buat
//
// Skrip ini meminta nama pengguna, peran, dan kata sandi (tidak ditampilkan saat diketik),
// lalu MENCETAK perintah SQL berisi hash-nya. Jalankan perintah itu di SQL editor Supabase.
// Kata sandi asli tidak pernah disimpan, dikirim ke mana pun, atau ditulis ke berkas.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashKataSandi, periksaKataSandiBaru } from "../lib/kata-sandi.ts";

const POLA_NAMA = /^[a-z0-9._-]{3,32}$/;

/** Membaca satu baris tanpa menampilkannya di layar (butuh terminal TTY). */
function tanyaTersembunyi(pertanyaan: string): Promise<string> {
  stdout.write(pertanyaan);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let isi = "";
    const selesai = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", terima);
      stdout.write("\n");
    };
    const terima = (potongan: string) => {
      for (const c of potongan) {
        if (c === "\r" || c === "\n") {
          selesai();
          resolve(isi);
          return;
        }
        if (c === "\u0003") {
          selesai();
          reject(new Error("Dibatalkan."));
          return;
        }
        if (c === "\u007f" || c === "\b") isi = isi.slice(0, -1);
        else isi += c;
      }
    };
    stdin.on("data", terima);
  });
}

async function utama() {
  if (!stdin.isTTY) {
    console.error(
      "Jalankan dari terminal interaktif (PowerShell, CMD, atau Windows Terminal) supaya " +
        "kata sandi tidak terlihat. Di Git Bash/mintty, pakai: winpty npm run akun:buat",
    );
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const nama = (await rl.question("Nama pengguna (huruf kecil, angka, . _ -): ")).trim().toLowerCase();
  const peran = (await rl.question("Peran (warga/admin): ")).trim().toLowerCase();
  // Akun warga HARUS tertaut ke data warga (nomor di tabel warga): hanya akun seperti itu yang
  // boleh mendukung usulan. Admin tidak tertaut ke warga mana pun.
  const nomorTeks = peran === "warga" ? (await rl.question("Nomor warga (kolom `nomor` di tabel warga): ")).trim() : "";
  rl.close();

  if (!POLA_NAMA.test(nama)) {
    throw new Error("Nama pengguna harus 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
  }
  if (peran !== "warga" && peran !== "admin") throw new Error("Peran harus 'warga' atau 'admin'.");
  const nomor = Number(nomorTeks);
  if (peran === "warga" && (!Number.isInteger(nomor) || nomor < 1)) {
    throw new Error("Akun warga butuh nomor warga berupa bilangan bulat positif, mis. 70.");
  }

  const sandi = await tanyaTersembunyi("Kata sandi: ");
  const alasan = periksaKataSandiBaru(sandi, nama);
  if (alasan) throw new Error(alasan);
  if ((await tanyaTersembunyi("Ulangi kata sandi: ")) !== sandi) {
    throw new Error("Kedua kata sandi tidak sama.");
  }

  const hash = await hashKataSandi(sandi);
  // Nama sudah divalidasi (tanpa tanda kutip) dan hash hanya berisi base64, jadi aman disisipkan.
  console.log("\n-- Jalankan di SQL editor Supabase:");
  // Nomor sudah divalidasi sebagai bilangan bulat, jadi aman disisipkan.
  const kolomWarga = peran === "warga" ? ", warga_id" : "";
  const nilaiWarga = peran === "warga" ? `, (select id from warga where nomor = ${nomor})` : "";
  console.log(
    `insert into akun (nama_pengguna, hash_kata_sandi, peran${kolomWarga})\n` +
      `values ('${nama}', '${hash}', '${peran}'${nilaiWarga});\n`,
  );
  if (peran === "warga") {
    console.log(
      "-- Cek (harus satu baris): select a.nama_pengguna, w.rw from akun a join warga w on w.id = a.warga_id;\n",
    );
  }
}

utama().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
