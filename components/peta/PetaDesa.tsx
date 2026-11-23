"use client";

import dynamic from "next/dynamic";
import type { UsulanPeta } from "@/lib/peta-data";

const PetaClient = dynamic(() => import("./PetaDesaClient"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "540px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--papan, #F8FAFC)",
        borderRadius: "0.75rem",
        border: "1px solid var(--garis-sedang, #CBD5E1)",
        color: "var(--tinta-lemah, #64748B)",
        gap: "0.5rem",
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
      <span>Memuat peta wilayah desa…</span>
    </div>
  ),
});

export function PetaDesa({ daftarUsulan }: { daftarUsulan: UsulanPeta[] }) {
  return <PetaClient daftarUsulan={daftarUsulan} />;
}
