import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Folder keluaran server dev tambahan untuk uji E2E (NEXT_DIST_DIR), lihat e2e/playwright.config.ts.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bahan desain (mockup HTML dan skripnya), bukan kode aplikasi.
    "docs/**",
  ]),
]);

export default eslintConfig;
