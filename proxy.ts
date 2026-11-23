// Pemeriksaan "optimistis": hanya membaca dan memverifikasi token di cookie, tanpa
// database. Ini mengarahkan pengunjung lebih awal; keputusan akhir tetap di lib/auth.ts.
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE, bacaTokenSesi } from "@/lib/sesi-token";

// /forum/usul hanya untuk yang sudah masuk. Forum lainnya terbuka untuk dibaca siapa pun.
// /admin: yang belum masuk dialihkan ke /masuk. Yang sudah masuk tetapi bukan admin TIDAK dialihkan
// di sini (proxy hanya membaca token, bukan peran yang berlaku): halaman admin sendiri memeriksa
// perannya di server dan menampilkan "Halaman ini khusus admin desa".
const DILINDUNGI = ["/akun", "/forum/usul", "/admin"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sesi = await bacaTokenSesi(req.cookies.get(NAMA_COOKIE)?.value);

  const butuhMasuk = DILINDUNGI.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Hanya navigasi (GET/HEAD) yang dialihkan. Server Action adalah POST ke alamat halaman yang
  // sama; mengalihkannya membuat klien menerima halaman masuk sebagai "jawaban" aksi dan gagal
  // dengan "This page couldn't load". Setiap Server Action memeriksa sesinya sendiri dan
  // mengembalikan galat "belum_masuk" yang bisa ditampilkan dengan pesan yang jelas.
  const navigasi = req.method === "GET" || req.method === "HEAD";
  if (butuhMasuk && !sesi && navigasi) {
    const url = new URL("/masuk", req.nextUrl);
    url.searchParams.set("lanjut", pathname + search);
    return NextResponse.redirect(url);
  }

  // Yang sudah masuk tidak perlu halaman masuk. Pengecualian: ?sesi=berakhir, dari halaman yang baru saja
  // menemukan bahwa akun di tokennya sudah tidak berlaku (proxy tidak bisa tahu: ia tidak membaca database).
  if (pathname === "/masuk" && sesi && req.nextUrl.searchParams.get("sesi") !== "berakhir") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/akun/:path*", "/forum/usul", "/admin/:path*", "/masuk"],
};
