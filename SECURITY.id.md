# Keamanan

[English](./SECURITY.md) · **Bahasa Indonesia**

Aika adalah perangkat internal, bukan produk open source. Karena itu tidak ada bug bounty dan tidak ada peneliti keamanan eksternal. Isi dokumen ini adalah kebijakan internal yang berlaku untuk Aika dan semua project klien turunannya.

> Versi Inggris di [SECURITY.md](./SECURITY.md) adalah **versi kanonik**.

## Melaporkan masalah keamanan

**Jangan** membuka issue publik di repo klien mana pun. Klien bisa melihatnya.

Laporkan lewat kanal internal (grup tim atau DM ke pemilik repo). Sertakan: repo dan file, langkah reproduksi, dampak yang kamu duga, dan apakah data klien terlibat.

## Rahasia

- **Tidak ada rahasia di dalam repo.** Tidak ada API key, kredensial, atau connection string — tidak di kode, tidak di test, tidak di fixture, tidak di komentar.
- `.env` tidak pernah di-commit. `.gitignore` sudah mengabaikannya. Yang di-commit hanya `.env.example`, dan isinya hanya nilai palsu.
- Di VPS, environment berada di `/etc/aika/env` — **di luar direktori aplikasi yang di-deploy**. Dibaca lewat `--env-file-if-exists` dari `ecosystem.config.cjs`.
- Kalau sebuah rahasia terlanjur masuk ke git, mengubahnya di commit berikutnya **tidak cukup**. Ia sudah ada di riwayat. Rotasi rahasianya, lalu bersihkan riwayatnya.

## Database

- File SQLite (`.db`, `-wal`, `-shm`) dan semua backup **tidak pernah** masuk git.
- Backup ditulis di luar direktori yang disajikan web server. Tidak ada `.db` yang boleh bisa diunduh lewat HTTP.
- Backup adalah **data klien**. Perlakukan setara database produksi: akses terbatas, jangan disalin ke laptop pribadi, jangan dikirim lewat chat.
- Setiap project klien memakai file database sendiri di VPS-nya sendiri. Tidak ada database bersama antar klien.

## Dependency

Periksa sebelum menambah:

- Apakah paketnya benar-benar diperlukan, atau ada yang lebih sederhana di ekosistem?
- Punya berapa maintainer? Terakhir dirilis kapan?
- Apakah punya **postinstall script**? npm menjalankannya otomatis, dan itu vektor serangan supply chain yang klasik. Paket dengan postinstall yang tidak bisa dijelaskan sebaiknya tidak dipakai.

Dua catatan khusus Aika:

- **`allowScripts` di `package.json` di-pin ke versi persis.** npm 11 membuat install script opt-in, dan pin-nya berarti dependency yang di-upgrade harus disetujui ulang secara sengaja. Jangan pernah memakai `dangerously-allow-all-scripts`. Jalankan `npm install-scripts ls` untuk melihat apa yang tertunda.
- **Jangan menjalankan `npm audit fix --force`** di repo yang sudah melayani klien. Itu bisa melewati versi major dan merusak deploy.

Setiap dependency yang ditambahkan membawa runtime kedua. Aika sengaja satu proses.

## Tanggung jawab setiap project klien

Aika menyediakan fondasi, bukan jaminan. Sebelum sebuah situs klien naik ke produksi, pastikan:

- `APP_URL` sudah URL `https://` absolut yang benar. Aika menolak boot kalau tidak.
- TLS diterminasi di reverse proxy.
- File `.env` di VPS punya izin baca terbatas.
- Backup terjadwal **dan pernah di-restore minimal sekali**. Backup yang belum pernah diuji restore bukan backup.
- Reverse proxy tidak men-buffer `text/event-stream`.
- Akun admin bawaan pengembangan sudah diganti, kalau fitur `auth` dipakai.
