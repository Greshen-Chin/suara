import type { Metadata } from "next";
import { HalamanStub } from "@/components/ui/HalamanStub";

export const metadata: Metadata = { title: "Simulasi" };

export default function Halaman() {
  return <HalamanStub judul="Simulasi" />;
}
