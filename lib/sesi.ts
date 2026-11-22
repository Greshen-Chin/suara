// Menyimpan, membaca, dan menghapus cookie sesi. Hanya untuk server.
import "server-only";
import { cookies } from "next/headers";
import {
  NAMA_COOKIE,
  UMUR_SESI_DETIK,
  bacaTokenSesi,
  tandatanganiSesi,
  type IsiSesi,
} from "./sesi-token";

const PRODUKSI = process.env.NODE_ENV === "production";

const OPSI_COOKIE = {
  httpOnly: true, // tidak bisa dibaca JavaScript di browser
  secure: PRODUKSI, // hanya lewat HTTPS (localhost dikecualikan saat pengembangan)
  sameSite: "lax", // tidak ikut terkirim pada POST dari situs lain
  path: "/",
} as const;

export async function simpanSesi(isi: IsiSesi): Promise<void> {
  const token = await tandatanganiSesi(isi);
  (await cookies()).set(NAMA_COOKIE, token, { ...OPSI_COOKIE, maxAge: UMUR_SESI_DETIK });
}

export async function hapusSesi(): Promise<void> {
  // Ditimpa dengan atribut yang sama: cookie __Host- hanya bisa dihapus bila Secure dan Path cocok.
  (await cookies()).set(NAMA_COOKIE, "", { ...OPSI_COOKIE, maxAge: 0 });
}

export async function bacaSesi(): Promise<IsiSesi | null> {
  return bacaTokenSesi((await cookies()).get(NAMA_COOKIE)?.value);
}
