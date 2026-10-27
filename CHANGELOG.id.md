# Changelog

[English](./CHANGELOG.md) · **Bahasa Indonesia**

Semua perubahan penting pada Aika dicatat di file ini.

Formatnya mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [CHANGELOG.md](./CHANGELOG.md) yang jadi acuan.

## Cara menulis entri

Pembaca changelog ini adalah **orang yang memelihara project klien**, bukan orang yang menulis Aika. Jadi tulis untuk mereka.

- **Tulis dampaknya, bukan diff-nya.** "Route `/api/users` sekarang butuh sesi", bukan "mengubah middleware di features/users/server/routes.ts".
- **Setiap entri yang mengubah perilaku harus bisa menjawab:** apakah project klien perlu melakukan sesuatu? Kalau ya, tautkan ke bagiannya di [docs/UPGRADING.id.md](./docs/UPGRADING.id.md).
- **Kategori:** `Ditambahkan`, `Diubah`, `Usang`, `Dihapus`, `Diperbaiki`, `Keamanan`.
- Bagian `Belum Dirilis` selalu ada di paling atas.

Aturan versinya: perubahan yang memaksa project klien mengedit kode atau konfigurasi itu **major**, walaupun tidak ada yang gagal dikompilasi.

## [Belum Dirilis]

### Ditambahkan

- **Test runner masih belum ada.** Belum ada `vitest` (atau sejenisnya) yang dipasang. `npm run check` baru mencakup tipe, batas, dan gaya bahasa, dan nol perilaku. Dicatat di sini alih-alih didiamkan. Ini pekerjaan berikutnya.
- **`ROADMAP.md` dan `ROADMAP.id.md`.** Satu-satunya tempat yang menjawab apa yang mau dibangun berikutnya dan kenapa. Disiplinnya: yang sudah selesai keluar sepenuhnya dari roadmap dan pindah ke file ini, jadi keduanya tidak pernah tumpang tindih.
- **`npm run prose:check`**, ikut jalan di `npm run check`. Dia menolak em dash dan en dash di mana pun dalam repo, di kedua bahasa dan di komentar kode. Pakai koma, titik dua, titik, atau tanda kurung. Tanda hubung biasa tetap boleh di dalam kata dan rentang seperti `R1-R6`.

### Diubah

- **Aturan penulisan baru untuk semua dokumen dan komentar: tidak ada em dash dan en dash.** Karakter ini tidak terlihat saat review, jadi tidak ada yang sadar kalau ada yang menambahkannya. Karena itu aturannya ditegakkan skrip, bukan sekadar ditulis lalu dipercaya.
- **Dokumentasi Indonesia ditulis ulang supaya enak dibaca.** Versi sebelumnya diterjemahkan kata per kata, yang menghasilkan kalimat berat pasif dengan struktur kalimat Inggris. Menerjemahkan dokumen tidak sama dengan menulis dokumen.
- Dokumentasi sekarang dwibahasa. File Inggris jadi acuan, terjemahan Indonesia berdampingan sebagai `<nama>.id.md`. Keduanya diperbarui dalam perubahan yang sama.
- `npm run check` sekarang juga menjalankan `prose:check`.

## [0.1.0] - 2026-10-28

Rilis pertama. Fondasinya sudah berdiri; belum ada fitur domain.

### Ditambahkan

- **Cara perpindahan kode:** tanpa monorepo. Tiap project klien adalah clone repo ini, dan perbaikannya ditarik lewat `git merge upstream/main`. Batas antara framework dan klien itulah yang menjaga merge tetap murah.
- **Konvensi fitur** (`contract.ts` / `index.ts` / `server/` / `web/` / `tests/`), dengan batas yang dijaga `npm run arch:check`.
- **Dua batas per fitur.** `index.ts` adalah pintu server, `web/index.ts` adalah pintu yang aman untuk browser. Tanpa pemisahan itu, komponen Vue yang mengimpor tipe sebuah fitur akan menyeret `better-sqlite3` masuk ke bundle klien.
- **Fitur contoh `health`**, yang membuktikan rantai Nuxt → Nitro → Hono → SQLite dari hulu ke hilir.
- **`modules/features.ts`:** halaman di `features/*/web/pages/` otomatis jadi route Nuxt, jadi tidak ada fitur yang perlu menyentuh routing aplikasi.
- **`shared/config/env.ts`:** satu-satunya tempat `process.env` dibaca, divalidasi Zod, dan gagal saat boot dengan pesan yang jelas.
- **`shared/database/client.ts`:** satu-satunya tempat SQLite dibuka, sekaligus pemilik pragma WAL, termasuk `foreign_keys` dan `busy_timeout`, yang keduanya bukan default di mana pun.
- **`shared/errors/`:** error domain dengan `code` dan `status` HTTP yang tetap.
- **`shared/http/app.ts`:** composition root Hono, dan satu-satunya tempat error dipetakan ke envelope JSON.
- **`server/api/[...path].ts`:** satu jembatan Nitro → Hono. Hono tidak mengimpor apa pun dari Nitro, jadi Hono yang berdiri sendiri tetap cuma soal menukar satu file.
- **`scripts/migrate.ts`:** migrasi SQL forward-only yang menulis snapshot dulu, dan menolak jalan kalau snapshot-nya gagal.
- **`scripts/db-backup.ts`:** snapshot online lewat `.backup()` dari better-sqlite3, dengan retensi. Sengaja tidak pakai `cp`, yang akan menangkap WAL dalam keadaan robek.
- **`scripts/check-boundaries.ts`:** enam aturan batas (R1-R6), termasuk keamanan browser dan deteksi siklus dependensi.
- **`ecosystem.config.cjs`:** PM2 `fork` mode satu instance, dengan alasannya ditulis di dalam filenya.
- Dokumentasi: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/UPGRADING.md`, masing-masing punya pasangan Bahasa Indonesia.
- **`allowScripts` di-pin** di `package.json` untuk `better-sqlite3` dan `esbuild`. npm 11 menahan install script secara default; tanpa pin ini, clone baru akan kehilangan binary SQLite native-nya.

### Yang sudah diuji di rilis ini

Bukan klaim, ini output yang benar-benar terlihat:

- `npm run check` hijau: typecheck Nuxt, typecheck scripts, `arch:check` (1 fitur, 0 pelanggaran).
- `npm run build` hijau: preset Nitro `node-server`, menghasilkan `.output/server/index.mjs`.
- `GET /api/health` → `200 {"success":true,"message":"OK","data":{"status":"ok","version":"0.1.0","database":"up","uptimeSeconds":1}}`.
- Path `/api` yang tidak dikenal → `404 {"success":false,"message":"Endpoint not found.","code":"NOT_FOUND"}`.
- `GET /` ikut merender panel health ke HTML server (`Database: up`), SSR-nya jalan, bukan cuma API-nya.
- `npm run db:migrate` menjalankan `0001_init.sql`, lalu melaporkan "up to date" saat diulang (aman dua kali).
- `npm run db:backup` dan snapshot pra-migrasi keduanya menghasilkan file yang valid.

### Catatan untuk project turunan

Belum ada project klien. Jadi belum ada yang perlu dilakukan.

[Belum Dirilis]: https://github.com/Kreavia-Dev/aika/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kreavia-Dev/aika/releases/tag/v0.1.0
