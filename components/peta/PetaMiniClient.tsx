"use client";

import { useEffect, useRef } from "react";
import { DAFTAR_WILAYAH_PETA, type UsulanPeta } from "@/lib/peta-data";
import styles from "./PetaDesa.module.css";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  judul: string;
  rw: number | null;
}

export default function PetaMiniClient({ lat, lng, judul, rw }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let map: any = null;

    async function initMiniMap() {
      if (!containerRef.current) return;
      if (mapRef.current) return;

      const L = (await import("leaflet")).default;

      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      // Area RW
      const infoRw = DAFTAR_WILAYAH_PETA.find((w) => w.rw === rw);
      if (infoRw) {
        L.circle([infoRw.pusat.lat, infoRw.pusat.lng], {
          radius: infoRw.radiusMeter,
          color: infoRw.warna,
          weight: 1.5,
          opacity: 0.7,
          dashArray: "4, 4",
          fillColor: infoRw.warna,
          fillOpacity: 0.06,
        }).addTo(map);
      }

      // Marker usulan
      const iconSvg = `
        <div style="
          position: relative;
          width: 30px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          <svg viewBox="0 0 32 38" width="30" height="36" fill="none">
            <path d="M16 0C7.16 0 0 7.16 0 16C0 27.2 16 38 16 38C16 38 32 27.2 32 16C32 7.16 24.84 0 16 0Z" fill="#0F5132"/>
            <circle cx="16" cy="15" r="7" fill="#FFFFFF"/>
            <circle cx="16" cy="15" r="4.5" fill="#0F5132"/>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconSvg,
        className: "marker-suara-mini",
        iconSize: [30, 36],
        iconAnchor: [15, 36],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`<strong>${judul}</strong><br/>Kawasan RW 0${rw ?? 1}`).openPopup();

      mapRef.current = map;
    }

    initMiniMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, judul, rw]);

  return (
    <div className={styles.bingkaiMini}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
