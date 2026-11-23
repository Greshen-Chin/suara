// Hash kata sandi dengan scrypt (bawaan Node, tanpa library tambahan).
//
// - Salt acak 16 byte per kata sandi, dibuat ulang setiap kali hash dibuat.
// - Parameter mengikuti OWASP Password Storage Cheat Sheet: N = 2^17, r = 8, p = 1
//   (sekitar 128 MiB memori per hash), panjang kunci 64 byte.
// - Disimpan dalam format PHC: $scrypt$ln=17,r=8,p=1$<salt base64>$<hash base64>,
//   jadi parameter bisa dinaikkan kelak tanpa merusak hash lama (lihat perluHashUlang).
// - Perbandingan memakai timingSafeEqual agar waktu tidak membocorkan isi hash.
//
// Sengaja tanpa "server-only" supaya skrip scripts/buat-akun.ts juga bisa memakainya.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const PARAMETER_SCRYPT = { ln: 17, r: 8, p: 1 } as const;
const PANJANG_SALT = 16;
const PANJANG_KUNCI = 64;

// Batas panjang ada di lib/aturan-sandi.ts (murni, bisa dibaca klien); diekspor ulang di sini.
import { PANJANG_MAKS, PANJANG_MIN } from "./aturan-sandi.ts";
export { PANJANG_MAKS, PANJANG_MIN };

interface Parameter {
  ln: number;
  r: number;
  p: number;
}

function turunkanKunci(
  kataSandi: string,
  salt: Buffer,
  { ln, r, p }: Parameter,
): Promise<Buffer> {
  const N = 2 ** ln;
  const opsi: ScryptOptions = { N, r, p, maxmem: 128 * N * r * 2 };
  return new Promise((resolve, reject) => {
    scrypt(kataSandi.normalize("NFKC"), salt, PANJANG_KUNCI, opsi, (err, kunci) =>
      err ? reject(err) : resolve(kunci),
    );
  });
}

const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "");
const dariB64 = (s: string) => Buffer.from(s, "base64");

/** Buat hash baru dengan salt acak. */
export async function hashKataSandi(kataSandi: string): Promise<string> {
  if (kataSandi.length > PANJANG_MAKS) {
    throw new RangeError(`Kata sandi maksimal ${PANJANG_MAKS} karakter.`);
  }
  const salt = randomBytes(PANJANG_SALT);
  const kunci = await turunkanKunci(kataSandi, salt, PARAMETER_SCRYPT);
  const { ln, r, p } = PARAMETER_SCRYPT;
  return `$scrypt$ln=${ln},r=${r},p=${p}$${b64(salt)}$${b64(kunci)}`;
}

interface HashTerurai extends Parameter {
  salt: Buffer;
  kunci: Buffer;
}

const POLA_HASH = /^\$scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function urai(hash: string): HashTerurai | null {
  const m = POLA_HASH.exec(hash);
  if (!m) return null;
  const [ln, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Tolak parameter yang tidak masuk akal (hash rusak atau sengaja dibuat berat).
  if (ln < 14 || ln > 20 || r < 1 || r > 16 || p < 1 || p > 4) return null;
  const salt = dariB64(m[4]);
  const kunci = dariB64(m[5]);
  if (salt.length < PANJANG_SALT || kunci.length !== PANJANG_KUNCI) return null;
  return { ln, r, p, salt, kunci };
}

/** true bila kata sandi cocok. Hash yang rusak atau formatnya salah selalu false. */
export async function verifikasiKataSandi(
  kataSandi: string,
  hash: string,
): Promise<boolean> {
  if (kataSandi.length > PANJANG_MAKS) return false;
  const h = urai(hash);
  if (!h) return false;
  const kunci = await turunkanKunci(kataSandi, h.salt, h);
  return timingSafeEqual(kunci, h.kunci);
}

/** true bila hash dibuat dengan parameter lebih lemah dari sekarang; buat ulang saat login berhasil. */
export function perluHashUlang(hash: string): boolean {
  const h = urai(hash);
  if (!h) return true;
  return (
    h.ln < PARAMETER_SCRYPT.ln || h.r < PARAMETER_SCRYPT.r || h.p < PARAMETER_SCRYPT.p
  );
}

// Daftar pendek kata sandi yang paling sering dipakai. Untuk produksi, ganti dengan
// pemeriksaan daftar kata sandi bocor yang lengkap (OWASP ASVS 6.2.4).
const TERLALU_UMUM = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "qwertyuiop",
  "11111111", "00000000", "87654321", "iloveyou", "sayangku", "bismillah",
  "indonesia", "admin123", "admin1234", "rahasia123", "qwerty123", "abc12345",
]);

/**
 * Aturan untuk kata sandi BARU. null bila boleh dipakai, atau alasan penolakan.
 * SEMENTARA: aturan "tidak boleh memuat nama pengguna" dicabut; huruf dan angka saja sudah cukup.
 * TODO: tentukan aturan final sebelum karya dikumpulkan. Parameter `_namaPengguna` dipertahankan agar
 * pemanggil tidak berubah bila aturan itu dipasang lagi.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- sengaja dipertahankan, lihat TODO di atas
export function periksaKataSandiBaru(kataSandi: string, _namaPengguna: string): string | null {
  if (kataSandi.length < PANJANG_MIN) return `Kata sandi minimal ${PANJANG_MIN} karakter.`;
  if (kataSandi.length > PANJANG_MAKS) return `Kata sandi maksimal ${PANJANG_MAKS} karakter.`;
  const kecil = kataSandi.toLowerCase();
  if (TERLALU_UMUM.has(kecil)) return "Kata sandi ini terlalu umum. Pilih yang lain.";
  return null;
}
