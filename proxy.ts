// Pemeriksaan "optimistis": hanya membaca dan memverifikasi token di cookie, tanpa
// database. Ini mengarahkan pengunjung lebih awal; keputusan akhir tetap di lib/auth.ts.
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE, bacaTokenSesi } from "@/lib/sesi-token";

const DILINDUNGI = ["/akun"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sesi = await bacaTokenSesi(req.cookies.get(NAMA_COOKIE)?.value);

  const butuhMasuk = DILINDUNGI.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (butuhMasuk && !sesi) {
    const url = new URL("/masuk", req.nextUrl);
    url.searchParams.set("lanjut", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/masuk" && sesi) {
    return NextResponse.redirect(new URL("/akun", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/akun/:path*", "/masuk"],
};
