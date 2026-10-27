# Changelog

[English](./CHANGELOG.md) · **Bahasa Indonesia**

Semua perubahan penting pada Aika didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

> Versi Inggris di [CHANGELOG.md](./CHANGELOG.md) adalah **versi kanonik**.

## Aturan penulisan

Changelog ini dibaca oleh **orang yang memelihara project klien**, bukan oleh pembuat Aika. Tulis untuk pembaca itu.

- **Tulis dampaknya, bukan diff-nya.** "Route `/api/users` sekarang memerlukan sesi" — bukan "mengubah middleware di features/users/server/routes.ts".
- **Setiap entri yang mengubah perilaku harus bisa dijawab:** apakah project klien perlu melakukan sesuatu? Kalau ya, tautkan ke bagiannya di [docs/UPGRADING.id.md](./docs/UPGRADING.id.md).
- **Kategori:** `Ditambahkan`, `Diubah`, `Ditolak`, `Dihapus`, `Diperbaiki`, `Keamanan`.
- Bagian `Belum Dirilis` selalu ada di paling atas.

Aturan versi: perubahan yang memaksa project klien mengedit kode atau konfigurasi adalah **major**, walaupun tidak ada yang gagal dikompilasi.

## [Belum Dirilis]

### Ditambahkan

- **Test runner belum ada.** Belum ada `vitest` (atau setara) yang dikonfigurasi. Ini celah yang diketahui, dicatat di sini alih-alih dibiarkan implisit. Fitur rujukan saat ini belum punya test; `npm run check` baru mencakup tipe dan batas. Ini prioritas berikutnya.

### Diubah

- Dokumentasi sekarang dwibahasa. File Inggris adalah kanonik; terjemahan Indonesia berdampingan sebagai `<nama>.id.md`. Keduanya harus diperbarui dalam perubahan yang sama.

## [0.1.0] — 2026-10-28

Rilis pertama. Fondasi berdiri; belum ada fitur domain.

### Ditambahkan

- **Model distribusi:** tanpa monorepo. Setiap project klien adalah clone repo ini, dengan perbaikan ditarik lewat `git merge upstream/main`. Batas framework/klien itulah yang menjaga merge tetap murah.
- **Konvensi fitur** (`contract.ts` / `index.ts` / `server/` / `web/` / `tests/`) dengan batas yang ditegakkan `npm run arch:check`.
- **Dua batas per fitur.** `index.ts` adalah pintu server; `web/index.ts` adalah pintu yang aman untuk browser. Tanpa pemisahan itu, komponen Vue yang mengimpor tipe sebuah fitur akan menyeret `better-sqlite3` ke bundle klien.
- **Fitur rujukan `health`**, yang membuktikan rantai Nuxt → Nitro → Hono → SQLite secara end to end.
- **`modules/features.ts`:** halaman di `features/*/web/pages/` otomatis jadi route Nuxt, jadi tidak ada fitur yang perlu menyentuh routing aplikasi.
- **`shared/config/env.ts`:** satu-satunya tempat `process.env` dibaca, divalidasi Zod, gagal saat boot dengan pesan yang terbaca.
- **`shared/database/client.ts`:** satu-satunya tempat SQLite dibuka, pemilik pragma WAL termasuk `foreign_keys` dan `busy_timeout`, yang keduanya bukan default di mana pun.
- **`shared/errors/`:** error domain dengan `code` stabil dan `status` HTTP.
- **`shared/http/app.ts`:** composition root Hono dan satu-satunya tempat error dipetakan ke envelope JSON.
- **`server/api/[...path].ts`:** satu adapter Nitro → Hono. Hono tidak mengimpor apa pun dari Nitro, jadi Hono standalone tetap sekadar swap satu file.
- **`scripts/migrate.ts`:** migrasi SQL forward-only yang menulis snapshot lebih dulu dan menolak jalan kalau snapshot gagal.
- **`scripts/db-backup.ts`:** snapshot online lewat `.backup()` better-sqlite3, dengan retensi. Sengaja bukan `cp`, yang akan menangkap keadaan WAL yang robek.
- **`scripts/check-boundaries.ts`:** enam aturan batas (R1–R6), termasuk keamanan browser dan deteksi siklus.
- **`ecosystem.config.cjs`:** PM2 `fork` mode satu instance, dengan alasannya ditulis di dalam file.
- Dokumentasi: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/UPGRADING.md` — masing-masing dengan pasangan Bahasa Indonesia.
- **`allowScripts` di-pin** di `package.json` untuk `better-sqlite3` dan `esbuild`. npm 11 menahan install script secara default; tanpa pin ini, clone baru akan kehilangan binary SQLite native-nya.

### Terverifikasi pada rilis ini

Bukan klaim — output yang teramati:

- `npm run check` hijau: typecheck Nuxt, typecheck scripts, `arch:check` (1 fitur, 0 pelanggaran).
- `npm run build` hijau: preset Nitro `node-server`, `.output/server/index.mjs` dihasilkan.
- `GET /api/health` → `200 {"success":true,"message":"OK","data":{"status":"ok","version":"0.1.0","database":"up","uptimeSeconds":1}}`.
- Path `/api` tak dikenal → `404 {"success":false,"message":"Endpoint not found.","code":"NOT_FOUND"}`.
- `GET /` merender panel health ke HTML server (`Database: up`) — SSR bekerja, bukan hanya API-nya.
- `npm run db:migrate` menerapkan `0001_init.sql`, lalu melaporkan "up to date" saat diulang (idempoten).
- `npm run db:backup` dan snapshot pra-migrasi keduanya menulis file yang valid.

### Catatan untuk project turunan

Belum ada project klien. Tidak ada yang perlu dilakukan.

[Belum Dirilis]: https://github.com/Kreavia-Dev/aika/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kreavia-Dev/aika/releases/tag/v0.1.0
