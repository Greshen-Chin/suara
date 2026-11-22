"use server";

// Pratinjau dampak untuk halaman admin. Dihitung di server dengan hitungPratinjau (lib/pratinjau.ts),
// yang memakai pilihOptimal: mesin yang sama dengan halaman utama. Tidak menyimpan apa pun.
// Gagal atau lambat tidak boleh memblokir penyimpanan; klien menampilkan "Pratinjau belum bisa dihitung".
import { sesiAdmin } from "@/lib/admin-akses";
import { bacaDasarHitung, bacaUsulan } from "@/lib/admin-data";
import { BATAS_ADMIN, periksaBobot, periksaNamaSingkat, periksaPagu, periksaUrgensi } from "@/lib/admin-skema";
import { hitungPratinjau, type HasilPratinjau, type Perubahan } from "@/lib/pratinjau";
import { adalahUuid } from "@/lib/usulan-skema";

export type MasukanPratinjau =
  | { jenis: "pagu"; pagu: string }
  | { jenis: "bobot"; popularitas: string; urgensi: string; pemerataan: string }
  | { jenis: "masuk"; id: string; urgensi: string; namaSingkat: string }
  | { jenis: "keluar"; id: string };

export type HasilPratinjauAksi =
  | { ok: true; hasil: HasilPratinjau }
  | { ok: false; pesan: string; perluMasuk: boolean };

const BELUM = "Pratinjau belum bisa dihitung. Anda tetap bisa menyimpan.";

export async function hitungPratinjauAdmin(masukan: MasukanPratinjau): Promise<HasilPratinjauAksi> {
  const sesi = await sesiAdmin();
  if (!sesi.ok) {
    return {
      ok: false,
      perluMasuk: sesi.kode === "belum_masuk",
      pesan: sesi.kode === "belum_masuk" ? "Sesi Anda sudah berakhir. Masuk lagi untuk melihat pratinjau." : BELUM,
    };
  }

  try {
    const dasar = await bacaDasarHitung(sesi.pengguna);
    let perubahan: Perubahan;

    switch (masukan?.jenis) {
      case "pagu": {
        const p = periksaPagu(String(masukan.pagu ?? ""));
        if (!p.ok) return { ok: false, perluMasuk: false, pesan: p.pesan };
        perubahan = { jenis: "pagu", pagu: p.nilai };
        break;
      }
      case "bobot": {
        const b = periksaBobot({
          popularitas: String(masukan.popularitas ?? ""),
          urgensi: String(masukan.urgensi ?? ""),
          pemerataan: String(masukan.pemerataan ?? ""),
        });
        if (!b.ok) return { ok: false, perluMasuk: false, pesan: Object.values(b.galat)[0] ?? BELUM };
        perubahan = { jenis: "bobot", bobot: b.nilai };
        break;
      }
      case "masuk": {
        const id = String(masukan.id ?? "");
        const urgensi = periksaUrgensi(String(masukan.urgensi ?? ""));
        const singkat = periksaNamaSingkat(String(masukan.namaSingkat ?? ""));
        if (!adalahUuid(id) || !urgensi.ok || !singkat.ok) {
          return { ok: false, perluMasuk: false, pesan: urgensi.ok ? BELUM : urgensi.pesan };
        }
        if (dasar.usulan.length >= BATAS_ADMIN.usulanVoting) {
          return { ok: false, perluMasuk: false, pesan: `Hitungan anggaran sudah berisi ${BATAS_ADMIN.usulanVoting} usulan, jadi tidak ada yang bisa ditambah.` };
        }
        const u = await bacaUsulan(sesi.pengguna, id);
        if (!u || u.status !== "forum" || u.disembunyikan_pada !== null || u.rw === null) {
          return { ok: false, perluMasuk: false, pesan: BELUM };
        }
        perubahan = {
          jenis: "masuk",
          usulan: {
            id: u.id,
            title: u.title,
            namaSingkat: singkat.nilai ?? u.nama_singkat ?? u.title,
            category: u.category,
            rw: u.rw,
            estimatedBudget: u.estimated_budget,
            voteCount: u.vote_count,
            urgencyScore: urgensi.nilai,
            dibuat: u.created_at,
          },
        };
        break;
      }
      case "keluar": {
        const id = String(masukan.id ?? "");
        if (!adalahUuid(id) || !dasar.usulan.some((u) => u.id === id)) return { ok: false, perluMasuk: false, pesan: BELUM };
        perubahan = { jenis: "keluar", id };
        break;
      }
      default:
        return { ok: false, perluMasuk: false, pesan: BELUM };
    }

    return { ok: true, hasil: hitungPratinjau(dasar, perubahan) };
  } catch (err) {
    // Hanya jenis galatnya yang dicatat. Pratinjau yang gagal tidak menghalangi penyimpanan.
    console.error("Pratinjau gagal:", err instanceof Error ? `${err.name}: ${err.message}` : "tidak diketahui");
    return { ok: false, perluMasuk: false, pesan: BELUM };
  }
}
