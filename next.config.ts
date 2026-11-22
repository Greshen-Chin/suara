import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
