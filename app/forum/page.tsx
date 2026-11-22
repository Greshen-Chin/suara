import type { Metadata } from "next";
import { HalamanStub } from "@/components/ui/HalamanStub";

export const metadata: Metadata = { title: "Forum" };

export default function Halaman() {
  return <HalamanStub judul="Forum" />;
}
