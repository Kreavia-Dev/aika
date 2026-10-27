# Keamanan

[English](./SECURITY.md) · **Bahasa Indonesia**

Aika itu perangkat internal, bukan produk open source. Jadi tidak ada bug bounty, dan tidak ada peneliti keamanan dari luar. Isi dokumen ini adalah kebijakan internal yang berlaku untuk Aika dan semua project klien turunannya.

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [SECURITY.md](./SECURITY.md) yang jadi acuan.

## Melaporkan masalah keamanan

**Jangan** membuka issue publik di repo klien mana pun. Klien bisa melihatnya.

Laporkan lewat jalur internal (grup tim, atau DM ke pemilik repo). Sertakan: repo dan file-nya, langkah untuk mereproduksi, dampak yang kamu duga, dan apakah ada data klien yang terlibat.

## Rahasia

- **Tidak ada rahasia di dalam repo.** Tidak ada API key, kredensial, atau connection string, tidak di kode, tidak di test, tidak di fixture, tidak di komentar.
- `.env` tidak pernah di-commit. `.gitignore` sudah mengabaikannya. Yang di-commit hanya `.env.example`, dan isinya nilai palsu.
- Di VPS, environment ada di `/etc/aika/env`, **di luar direktori aplikasi**. Dibaca lewat `--env-file-if-exists` dari `ecosystem.config.cjs`.
- Kalau ada rahasia yang terlanjur masuk ke git, mengubahnya di commit berikutnya **tidak cukup**. Rahasianya sudah ada di riwayat. Rotasi rahasianya, baru bersihkan riwayatnya.

## Database

- File SQLite (`.db`, `-wal`, `-shm`) dan semua backup **tidak pernah** masuk git.
- Backup ditulis di luar direktori yang disajikan web server. Tidak boleh ada `.db` yang bisa diunduh lewat HTTP.
- Backup itu **data klien**. Perlakukan setara database produksi: aksesnya terbatas, jangan disalin ke laptop pribadi, jangan dikirim lewat chat.
- Setiap project klien punya file database sendiri di VPS-nya sendiri. Tidak ada database yang dipakai bersama antar klien.

## Dependency

Yang perlu diperiksa sebelum menambah:

- Paketnya benar-benar perlu tidak? Atau ada yang lebih sederhana di ekosistem?
- Berapa maintainer-nya? Terakhir dirilis kapan?
- Ada **postinstall script**? npm menjalankannya otomatis, dan itu vektor serangan supply chain yang paling klasik. Paket dengan postinstall yang tidak bisa dijelaskan sebaiknya jangan dipakai.

Dua catatan khusus Aika:

- **`allowScripts` di `package.json` di-pin ke versi yang persis.** npm 11 membuat install script harus disetujui, dan pin-nya berarti dependency yang di-upgrade harus disetujui ulang secara sadar. Jangan pernah pakai `dangerously-allow-all-scripts`. Jalankan `npm install-scripts ls` untuk melihat apa yang masih tertunda.
- **Jangan menjalankan `npm audit fix --force`** di repo yang sudah melayani klien. Itu bisa melewati versi major dan merusak deploy.

Setiap dependency yang ditambahkan berarti satu runtime tambahan. Aika sengaja hanya satu proses.

## Yang jadi tanggung jawab tiap project klien

Aika menyediakan fondasi, bukan jaminan. Sebelum situs klien naik ke produksi, pastikan:

- `APP_URL` sudah URL `https://` absolut yang benar. Kalau tidak, Aika menolak boot.
- TLS diterminasi di reverse proxy.
- File `.env` di VPS izin bacanya terbatas.
- Backup terjadwal **dan pernah di-restore minimal sekali**. Backup yang belum pernah diuji restore belum bisa disebut backup.
- Reverse proxy tidak men-buffer `text/event-stream`.
- Akun admin bawaan pengembangan sudah diganti, kalau fitur `auth` dipakai.
