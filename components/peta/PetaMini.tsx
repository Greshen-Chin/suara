"use client";

import dynamic from "next/dynamic";

const PetaMiniClient = dynamic(() => import("./PetaMiniClient"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "260px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--papan, #F8FAFC)",
        borderRadius: "0.5rem",
        border: "1px solid var(--garis-sedang, #CBD5E1)",
        color: "var(--tinta-lemah, #64748B)",
        fontSize: "0.85rem",
      }}
    >
      Memuat lokasi pada peta…
    </div>
  ),
});

interface Props {
  lat: number;
  lng: number;
  judul: string;
  rw: number | null;
}

export function PetaMini(props: Props) {
  return <PetaMiniClient {...props} />;
}
