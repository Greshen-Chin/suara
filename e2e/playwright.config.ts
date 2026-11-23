// Pengujian E2E: server tiruan Supabase (PGlite) + Next dev. Jalankan: npm run e2e
// Memakai server yang sudah berjalan bila ada (reuseExistingServer).
//
// Dua proyek, berurutan. Tes admin mengubah data dan cache publik (status usulan, bobot, pagu, akun),
// dan setiap berkas me-reset database dengan id baru sementara cache "use cache" Next masih memegang
// id lama; karena itu tes admin dijalankan SESUDAH tes forum, bukan di antaranya.
// Untuk mengulang satu proyek saja: npx playwright test -c e2e --project=admin --no-deps
import { defineConfig } from "@playwright/test";

const PORT_APP = 3100;
const PORT_DB = 54321;
const PORT_APP_SARAN = 3102;
const PORT_GEMINI = 54399;

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "./.hasil/jejak",
  use: {
    baseURL: `http://localhost:${PORT_APP}`,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    viewport: { width: 360, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "publik", testMatch: /(aksesibilitas|forum|tangkap|simulasi.*)\.spec\.ts/ },
    { name: "admin", testMatch: /admin.*\.spec\.ts/, dependencies: ["publik"] },
    // Saran urgensi AI: server aplikasi kedua (port 3102) berkunci Gemini tiruan; yang lain berjalan TANPA kunci.
    { name: "saran", testMatch: /saran-urgensi.*\.spec\.ts/, dependencies: ["admin"], use: { baseURL: `http://localhost:${PORT_APP_SARAN}` } },
  ],
  webServer: [
    {
      command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/supabase-palsu.ts",
      url: `http://localhost:${PORT_DB}/rest/v1/akun?limit=1`,
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: "..",
    },
    {
      // Gemini tiruan: satu-satunya tujuan panggilan AI di pengujian. Gemini sungguhan tidak pernah dipanggil.
      command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/gemini-palsu.ts",
      url: `http://127.0.0.1:${PORT_GEMINI}/__uji/panggilan`,
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: "..",
    },
    {
      // Build produksi: konsol dan cache berperilaku seperti saat dipakai sungguhan. Server dev
      // menambahkan peringatan validasi sendiri yang bukan bagian dari aplikasi.
      command: `npx next build && npx next start -p ${PORT_APP}`,
      // /api/health tidak memakai cache; membuka /forum di sini akan mengisi cache dengan id sebelum reset.
      url: `http://localhost:${PORT_APP}/api/health`,
      reuseExistingServer: true,
      timeout: 420_000,
      cwd: "..",
      env: {
        SUPABASE_URL: `http://localhost:${PORT_DB}`,
        SUPABASE_SERVICE_ROLE_KEY: "uji-lokal",
        SESSION_SECRET: process.env.SESSION_SECRET ?? "rahasia-uji-e2e-tidak-untuk-produksi-123456",
      },
    },
    {
      // Server dev kedua hanya untuk saran-urgensi*.spec.ts: database tiruan yang sama, kunci Gemini tiruan terpasang,
      // dan folder keluaran sendiri (NEXT_DIST_DIR) supaya tidak bentrok dengan server dev port 3101.
      command: `npx next dev -p ${PORT_APP_SARAN}`,
      url: `http://localhost:${PORT_APP_SARAN}/api/health`,
      reuseExistingServer: true,
      timeout: 240_000,
      cwd: "..",
      env: {
        NEXT_DIST_DIR: ".next-saran",
        SUPABASE_URL: `http://localhost:${PORT_DB}`,
        SUPABASE_SERVICE_ROLE_KEY: "uji-lokal",
        SESSION_SECRET: process.env.SESSION_SECRET ?? "rahasia-uji-e2e-tidak-untuk-produksi-123456",
        GEMINI_API_KEY: "kunci-uji-e2e",
        GEMINI_BASE_URL: `http://127.0.0.1:${PORT_GEMINI}`,
      },
    },
    {
      // Server ketiga hanya untuk simulasi-cadangan.spec.ts: database "tidak terjangkau" (port yang tidak melayani apa pun),
      // jadi halaman publik jatuh ke data cadangan. Server dev, bukan build, karena HTML build sudah memegang data tiruan.
      command: "npx next dev -p 3101",
      url: "http://localhost:3101/masuk",
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: "..",
      env: {
        // Folder keluaran sendiri: Next menolak dua server dev di folder yang sama, jadi tanpa ini pengujian gagal
        // dimulai bila Anda sedang menjalankan `npm run dev`.
        NEXT_DIST_DIR: ".next-cadangan",
        SUPABASE_URL: "http://127.0.0.1:9",
        SUPABASE_SERVICE_ROLE_KEY: "uji-lokal",
        SESSION_SECRET: process.env.SESSION_SECRET ?? "rahasia-uji-e2e-tidak-untuk-produksi-123456",
      },
    },
  ],
});
