// Pengujian E2E: server tiruan Supabase (PGlite) + Next dev. Jalankan: npm run e2e
// Memakai server yang sudah berjalan bila ada (reuseExistingServer).
import { defineConfig } from "@playwright/test";

const PORT_APP = 3100;
const PORT_DB = 54321;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
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
  webServer: [
    {
      command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/supabase-palsu.ts",
      url: `http://localhost:${PORT_DB}/rest/v1/akun?limit=1`,
      reuseExistingServer: true,
      timeout: 180_000,
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
  ],
});
