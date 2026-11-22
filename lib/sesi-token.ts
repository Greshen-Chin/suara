// Token sesi (JWT, HS256) untuk cookie. Dipakai oleh server dan oleh proxy.ts.
// Isi token sengaja minimal: id akun, nama pengguna, peran, dan versi sesi.
// Tidak ada data pribadi atau rahasia di dalamnya (JWT hanya ditandatangani, tidak dienkripsi).
import { SignJWT, jwtVerify } from "jose";

export type Peran = "warga" | "admin";

export interface IsiSesi {
  id: string;
  nama: string;
  peran: Peran;
  /** Harus sama dengan akun.versi_sesi; menaikkannya di database mencabut sesi ini. */
  versi: number;
}

/** 8 jam. Setelah itu pengguna masuk lagi. */
export const UMUR_SESI_DETIK = 8 * 60 * 60;

const PENERBIT = "suara";
const AUDIENS = "suara-web";
const ALGORITMA = "HS256";

/**
 * Di produksi (HTTPS) cookie memakai prefiks __Host-: browser hanya menerimanya bila
 * Secure, Path=/ dan tanpa Domain, sehingga subdomain lain tidak bisa menimpanya.
 */
export const NAMA_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-suara_sesi" : "suara_sesi";

let kunciTersimpan: Uint8Array | null = null;

function kunci(): Uint8Array {
  if (kunciTersimpan) return kunciTersimpan;
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 32) {
    throw new Error(
      "SESSION_SECRET belum diisi atau kurang dari 32 karakter. Buat dengan: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  kunciTersimpan = new TextEncoder().encode(rahasia);
  return kunciTersimpan;
}

export function tandatanganiSesi(isi: IsiSesi): Promise<string> {
  return new SignJWT({ nama: isi.nama, peran: isi.peran, ver: isi.versi })
    .setProtectedHeader({ alg: ALGORITMA, typ: "JWT" })
    .setSubject(isi.id)
    .setIssuer(PENERBIT)
    .setAudience(AUDIENS)
    .setIssuedAt()
    .setExpirationTime(`${UMUR_SESI_DETIK}s`)
    .setJti(crypto.randomUUID())
    .sign(kunci());
}

/** Isi sesi bila token sah dan belum kedaluwarsa; selain itu null. */
export async function bacaTokenSesi(token: string | undefined): Promise<IsiSesi | null> {
  if (!token) return null;
  const k = kunci(); // salah konfigurasi harus terlihat, bukan ditelan sebagai "belum masuk"
  try {
    const { payload } = await jwtVerify(token, k, {
      algorithms: [ALGORITMA],
      issuer: PENERBIT,
      audience: AUDIENS,
    });
    const { sub, nama, peran, ver } = payload;
    if (
      typeof sub !== "string" ||
      typeof nama !== "string" ||
      (peran !== "warga" && peran !== "admin") ||
      typeof ver !== "number"
    ) {
      return null;
    }
    return { id: sub, nama, peran, versi: ver };
  } catch {
    return null; // tanda tangan salah, kedaluwarsa, atau formatnya rusak
  }
}
