# Bahan desain UI

Bahan kerja desain UI baru, dipindahkan dari `public/` supaya tidak ikut tersaji di website (semua isi `public/`
bisa dibuka siapa pun lewat alamat situs). Tidak ada kode aplikasi yang membaca folder ini.

- `paket-ui/`: paket desain lengkap (mockup HTML per halaman, tangkapan layar desktop dan ponsel, laporan QA, token,
  dan katalog aset). Dulu di `public/asset/`.
- `referensi/`: gambar arah desain dan papan konsep maskot Tunas. Dulu di `public/assets/reference/`,
  `public/assets/scenes/hero-village-reference.jpg`, dan `public/assets/mascot/tunas-original-scene.png`.

Aset yang benar-benar dipakai halaman (maskot, logo, ikon, pemandangan) tetap di `public/assets/`.
