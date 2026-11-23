import type { NextConfig } from "next";

// Header keamanan untuk semua halaman.
const HEADER_KEAMANAN = [
  // Browser tidak menebak tipe berkas (mencegah berkas diperlakukan sebagai skrip).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Halaman tidak boleh dimuat di dalam iframe situs lain (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Alamat lengkap tidak dikirim ke situs lain.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Fitur perangkat yang tidak dipakai dimatikan.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Selalu HTTPS selama 2 tahun (diabaikan browser saat diakses lewat http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Hanya untuk uji E2E: server dev kedua (dengan kunci Gemini tiruan) memakai folder keluaran sendiri supaya tidak bentrok.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: HEADER_KEAMANAN }];
  },
  turbopack: {
    rules: {
      // Hanya globals.css yang memakai direktif Tailwind. Aturan "*.css" yang lebih luas
      // akan ikut mengubah file *.module.css menjadi CSS global dan merusak CSS Modules.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
