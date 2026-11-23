"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { rupiah, ribuan } from "@/lib/format";
import {
  DAFTAR_WILAYAH_PETA,
  TITIK_PUSAT_DESA,
  type UsulanPeta,
} from "@/lib/peta-data";
import styles from "./PetaDesa.module.css";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

/** Modul Leaflet yang dimuat dinamis di klien (lihat useEffect). */
type ModulLeaflet = typeof Leaflet;

interface Props {
  daftarUsulan: UsulanPeta[];
}

export default function PetaDesaClient({ daftarUsulan }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const markersLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<ModulLeaflet | null>(null);
  const markersMapRef = useRef<Map<string, Leaflet.Marker>>(new Map());

  const [filterRw, setFilterRw] = useState<string>("semua");
  const [filterStatus, setFilterStatus] = useState<string>("semua");
  const [filterKategori, setFilterKategori] = useState<string>("semua");
  const [usulanTerpilih, setUsulanTerpilih] = useState<UsulanPeta | null>(daftarUsulan[0] ?? null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Filter usulan berdasarkan pilihan pengguna
  const usulanTersaring = daftarUsulan.filter((u) => {
    if (filterRw !== "semua" && u.rw !== Number(filterRw)) return false;
    if (filterStatus !== "semua" && u.status !== filterStatus) return false;
    if (filterKategori !== "semua" && u.category.toLowerCase() !== filterKategori.toLowerCase()) return false;
    return true;
  });

  // Fungsi menggambar semua pin marker ke layer peta
  const gambarSemuaMarker = useCallback((L: ModulLeaflet | null, markersGroup: Leaflet.LayerGroup | null, list: UsulanPeta[]) => {
    if (!L || !markersGroup) return;

    markersGroup.clearLayers();
    markersMapRef.current.clear();

    list.forEach((u) => {
      const warnaPin =
        u.status === "voting"
          ? "#0F5132"
          : u.status === "forum"
            ? "#0D6EFD"
            : u.status === "done"
              ? "#D97706"
              : "#64748B";

      const labelBadge =
        u.status === "voting"
          ? "Masuk Hitungan"
          : u.status === "forum"
            ? "Sedang Dibahas"
            : u.status === "done"
              ? "Selesai"
              : "Tidak Dilanjutkan";

      // Custom DivIcon dengan SVG Pin
      const iconSvg = `
        <div style="
          position: relative;
          width: 32px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));
          cursor: pointer;
        ">
          <svg viewBox="0 0 32 38" width="32" height="38" fill="none">
            <path d="M16 0C7.16 0 0 7.16 0 16C0 27.2 16 38 16 38C16 38 32 27.2 32 16C32 7.16 24.84 0 16 0Z" fill="${warnaPin}"/>
            <circle cx="16" cy="15" r="7" fill="#FFFFFF"/>
            <circle cx="16" cy="15" r="4.5" fill="${warnaPin}"/>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconSvg,
        className: "marker-suara-pin",
        iconSize: [32, 38],
        iconAnchor: [16, 38],
        popupAnchor: [0, -36],
      });

      // title: nama yang dibaca pembaca layar dan tooltip saat pin difokus (pin Leaflet bisa difokus dengan Tab).
      const marker = L.marker([u.lat, u.lng], { icon: customIcon, title: u.title });

      const kontenPopup = `
        <div style="font-family: sans-serif; padding: 4px 2px; min-width: 200px;">
          <div style="font-size: 11px; font-weight: 700; color: ${warnaPin}; text-transform: uppercase; margin-bottom: 4px;">
            ${labelBadge} · RW 0${u.rw ?? 1}
          </div>
          <h4 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 6px 0; line-height: 1.3;">
            ${u.title}
          </h4>
          <div style="font-size: 13px; font-weight: 700; color: #0F5132; margin-bottom: 6px;">
            ${rupiah(u.estimated_budget)}
          </div>
          <div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">
            ${u.vote_count} warga mendukung · Kategori ${u.category}
          </div>
          <a href="/forum/${u.id}" style="
            display: inline-block;
            width: 100%;
            text-align: center;
            background-color: #0F5132;
            color: #ffffff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            box-sizing: border-box;
          ">Lihat Detail Usulan &rarr;</a>
        </div>
      `;

      marker.bindPopup(kontenPopup);

      marker.on("click", () => {
        setUsulanTerpilih(u);
      });

      markersMapRef.current.set(u.id, marker);
      markersGroup.addLayer(marker);
    });
  }, []);

  // Inisialisasi Peta Leaflet & render awal marker
  useEffect(() => {
    // Leaflet dimuat asinkron. Bila efek ini dibersihkan SEBELUM peta selesai dibuat (React memasang efek dua kali
    // di mode pengembangan, atau pengguna cepat berpindah halaman), pembuatan yang usang harus berhenti; tanpa
    // penanda ini peta kedua dibuat di wadah yang sama: "Map container is already initialized".
    let batal = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      if (batal || !mapContainerRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [TITIK_PUSAT_DESA.lat, TITIK_PUSAT_DESA.lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      // Basemap OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Gambar Lingkaran Batas Wilayah RW
      DAFTAR_WILAYAH_PETA.forEach((w) => {
        const circle = L.circle([w.pusat.lat, w.pusat.lng], {
          radius: w.radiusMeter,
          color: w.warna,
          weight: 2,
          opacity: 0.8,
          dashArray: "6, 6",
          fillColor: w.warna,
          fillOpacity: 0.08,
        }).addTo(map);

        circle.bindTooltip(`<strong>${w.nama}</strong><br/>${w.penduduk.toLocaleString("id-ID")} jiwa`, {
          sticky: true,
          direction: "top",
        });
      });

      // Buat grup layer marker
      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // LANGSUNG gambar titik usulan begitu peta selesai diinisialisasi
      gambarSemuaMarker(L, markersGroup, daftarUsulan);
      setIsMapReady(true);

      setTimeout(() => {
        if (!batal) map.invalidateSize();
      }, 100);
    }

    initMap();

    return () => {
      batal = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [daftarUsulan, gambarSemuaMarker]);

  // Perbarui Marker ketika data filter berubah (setelah map selesai inisialisasi)
  useEffect(() => {
    if (!isMapReady || !leafletRef.current || !markersLayerRef.current) return;
    gambarSemuaMarker(leafletRef.current, markersLayerRef.current, usulanTersaring);
  }, [usulanTersaring, isMapReady, gambarSemuaMarker]);

  function pusatkanKeDesa() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([TITIK_PUSAT_DESA.lat, TITIK_PUSAT_DESA.lng], 15, {
        duration: 1.2,
      });
      mapInstanceRef.current.closePopup();
    }
  }

  function sorotUsulan(u: UsulanPeta) {
    setUsulanTerpilih(u);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([u.lat, u.lng], 17, {
        duration: 1,
      });
      const m = markersMapRef.current.get(u.id);
      if (m) {
        m.openPopup();
      }
    }
  }

  return (
    <div className={styles.wadahPeta}>
      {/* Kepala & Pengantar */}
      <div className={styles.kepalaPeta}>
        <div className={styles.judulSejarah}>
          <h1 className={styles.judul}>Peta Persebaran Usulan Desa</h1>
          <p className={styles.keterangan}>
            Pantau lokasi fisik seluruh usulan pembangunan desa per wilayah RW. Transparan, berbasis geospasial,
            dan memudahkan musyawarah melihat sebaran keadilan infrastruktur.
          </p>
        </div>
        <Link href="/forum" className="tombol tombol-kedua">
          &larr; Kembali ke Daftar Forum
        </Link>
      </div>

      {/* Bilah Filter & Kendali */}
      <div className={styles.bilahFilter} role="search" aria-label="Filter usulan peta">
        {/* Tiap pilihan dibungkus <label>: teks label menjadi nama pilihan (tanpa aria-label yang berbeda isinya),
            bisa diketuk, dan di ponsel label serta pilihannya tersusun rapi per baris. */}
        <div className={styles.grupFilter}>
          <label className={styles.itemFilter}>
            <span className={styles.labelFilter}>Wilayah</span>
            <select className={styles.pilihanSelect} value={filterRw} onChange={(e) => setFilterRw(e.target.value)}>
              <option value="semua">Semua Wilayah</option>
              <option value="1">RW 01 (Pusat & Balai Desa)</option>
              <option value="3">RW 03 (Pasar & SDN 03)</option>
              <option value="7">RW 07 (Dusun Lereng & Tebing)</option>
            </select>
          </label>

          <label className={styles.itemFilter}>
            <span className={styles.labelFilter}>Status</span>
            <select
              className={styles.pilihanSelect}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="semua">Semua Status</option>
              <option value="voting">Masuk Hitungan (Voting)</option>
              <option value="forum">Sedang Dibahas (Forum)</option>
              <option value="done">Selesai / Terbiayai</option>
              <option value="rejected">Tidak Dilanjutkan</option>
            </select>
          </label>

          <label className={styles.itemFilter}>
            <span className={styles.labelFilter}>Kategori</span>
            <select
              className={styles.pilihanSelect}
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
            >
              <option value="semua">Semua Kategori</option>
              <option value="infrastruktur">Infrastruktur</option>
              <option value="kesehatan">Kesehatan</option>
              <option value="fasilitas">Fasilitas</option>
              <option value="lingkungan">Lingkungan</option>
              <option value="ekonomi">Ekonomi</option>
            </select>
          </label>
        </div>

        <button type="button" className={styles.tombolPusat} onClick={pusatkanKeDesa}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="12 8 8 12 12 16 16 12 12 8" />
          </svg>
          Pusatkan ke Desa
        </button>
      </div>

      {/* Area Peta dan Panel Samping */}
      <div className={styles.tataPeta}>
        <div className={styles.bingkaiPeta}>
          <div ref={mapContainerRef} className={styles.petaLeaflet} />

          {/* Legenda Warna Pin */}
          <div className={styles.legendaPeta}>
            <div className={styles.judulLegenda}>Status Usulan</div>
            <div className={styles.itemLegenda}>
              <span className={styles.titikLegenda} style={{ backgroundColor: "#0F5132" }} />
              <span>Masuk Hitungan ({daftarUsulan.filter((u) => u.status === "voting").length})</span>
            </div>
            <div className={styles.itemLegenda}>
              <span className={styles.titikLegenda} style={{ backgroundColor: "#0D6EFD" }} />
              <span>Sedang Dibahas ({daftarUsulan.filter((u) => u.status === "forum").length})</span>
            </div>
            <div className={styles.itemLegenda}>
              <span className={styles.titikLegenda} style={{ backgroundColor: "#D97706" }} />
              <span>Selesai / Realisasi</span>
            </div>
          </div>
        </div>

        {/* Panel Samping Daftar & Sorot Usulan */}
        <aside className={styles.panelSamping} aria-label="Daftar usulan di peta">
          <div className={styles.panelKepala}>
            <h2 className={styles.panelJudul}>Usulan di Peta</h2>
            <span className={styles.jumlahDitemukan}>{usulanTersaring.length} usulan</span>
          </div>

          {usulanTerpilih && (
            <div className={styles.kartuSorot}>
              <span
                className={`${styles.badgeStatus} ${
                  usulanTerpilih.status === "voting"
                    ? styles.badgeVoting
                    : usulanTerpilih.status === "forum"
                      ? styles.badgeForum
                      : usulanTerpilih.status === "done"
                        ? styles.badgeDone
                        : styles.badgeRejected
                }`}
              >
                {usulanTerpilih.status === "voting"
                  ? "Masuk Hitungan"
                  : usulanTerpilih.status === "forum"
                    ? "Sedang Dibahas"
                    : usulanTerpilih.status === "done"
                      ? "Selesai"
                      : "Tidak Dilanjutkan"}{" "}
                · RW 0{usulanTerpilih.rw ?? 1}
              </span>
              <h3 className={styles.kartuSorotJudul}>{usulanTerpilih.title}</h3>
              <div className={styles.kartuBiaya}>{rupiah(usulanTerpilih.estimated_budget)}</div>
              <div className={styles.kartuMeta}>
                <span>{ribuan(usulanTerpilih.vote_count)} dukungan</span>
                <span>·</span>
                <span>{usulanTerpilih.category}</span>
              </div>
              <Link href={`/forum/${usulanTerpilih.id}`} className={styles.kartuAksi}>
                Buka Halaman Usulan &rarr;
              </Link>
            </div>
          )}

          {usulanTersaring.length === 0 ? (
            <p className={styles.pesanKosong}>Tidak ada usulan yang cocok dengan filter yang dipilih.</p>
          ) : (
            <ul className={styles.daftarRingkas}>
              {/* Tombol sungguhan di dalam <li> (bukan <li role="button">, yang merusak struktur daftar): Enter dan
                  Spasi bekerja dengan sendirinya, dan aria-pressed menandai usulan yang sedang disorot. */}
              {usulanTersaring.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={styles.itemRingkas}
                    onClick={() => sorotUsulan(u)}
                    aria-pressed={usulanTerpilih?.id === u.id}
                  >
                    <span className={styles.itemRingkasJudul}>{u.title}</span>
                    <span className={styles.itemRingkasSub}>
                      <span>RW 0{u.rw ?? 1}</span>
                      <strong style={{ color: "var(--hijau-sawah, #0F5132)" }}>{rupiah(u.estimated_budget)}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
