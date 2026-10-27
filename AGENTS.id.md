# AGENTS.md — instruksi untuk AI coding agent di Aika

[English](./AGENTS.md) · **Bahasa Indonesia**

Baca ini sebelum menulis kode. `ARCHITECTURE.md` adalah otoritasnya. Kalau file ini dan `ARCHITECTURE.md` berbeda, `ARCHITECTURE.md` yang menang — katakan begitu, jangan menebak.

> Versi Inggris di [AGENTS.md](./AGENTS.md) adalah **versi kanonik** dan yang dibaca agent. File ini untuk dibaca manusia.

## Aika itu apa

Application kit internal (bukan open source) untuk membangun web app klien. Nuxt + Hono + SQLite, TypeScript, satu proses Node, PM2 di VPS.

Distribusinya dengan men-clone repo per project klien lalu menarik perbaikan dari `upstream` lewat git. **Itu hanya tetap mergeable selama batas framework/klien nyata.** Sebagian besar aturan di bawah ada untuk menjaga batas itu, bukan demi kerapian.

## Perintah

```bash
npm run check              # GERBANG utama. Wajib hijau sebelum mengaku selesai.
npm run typecheck          # sisi Nuxt/Vue
npm run typecheck:scripts  # scripts/, shared/, features/
npm run arch:check         # aturan batas fitur R1-R6
npm run dev                # server dev di :5555
npm run db:migrate         # terapkan migrasi (snapshot dulu)
npm run db:backup          # backup SQLite online
```

Jalankan `npm run check` sebelum melaporkan selesai. Jangan pernah melaporkan sukses hanya karena "seharusnya jalan".

## Aturan keras

### 1. Build by feature, bukan by layer

Fitur = satu kemampuan bisnis, disimpan utuh di satu tempat:

```
features/<nama>/
├── contract.ts   # schema Zod + tipe turunan
├── index.ts      # BATAS SERVER
├── server/       # route, service, repository, config
├── web/          # permukaan browser (opsional)
│   ├── index.ts  # BATAS BROWSER
│   ├── pages/    # otomatis jadi route via modules/features.ts
│   └── components/
└── tests/
```

Jangan membuat direktori `controllers/`, `services/`, `models/`, `repositories/` di level atas. Kalau tergoda, logikanya milik sebuah fitur.

### 2. Fitur punya DUA pintu, dan keduanya tidak bisa dipertukarkan

| Impor dari | Boleh dipakai di |
|---|---|
| `~~/features/<nama>` | kode server, server fitur lain |
| `~~/features/<nama>/web` | komponen Vue, kode `web/` fitur lain |

**Salah di sini adalah cara termudah merusak build klien.**

`~~/features/health` mengekspor `healthRoutes`, yang mengimpor `better-sqlite3`. Mengimpornya dari komponen Vue akan menyeret modul native Node ke bundle browser. Kode browser wajib mengimpor dari `~~/features/<nama>/web`.

Keduanya ditolak `arch:check`:

```ts
// ditolak — deep cross-feature import (R2)
import { getCurrentUser } from '~~/features/auth/server/repository'

// ditolak — kode browser mengimpor batas server (R6)
import type { Post } from '~~/features/blog'
```

Jangan mengimpor `contract.ts` fitur lain secara langsung — ia di-re-export lewat kedua pintu. Satu pintu per jenis konsumen.

### 3. Fitur tidak pernah mengimpor dari `app/`

`app/` adalah shell browser. Ia bergantung pada fitur; fitur tidak pernah bergantung padanya.

### 4. Jangan pernah membuka koneksi database sendiri

`shared/database/client.ts` adalah satu-satunya tempat `new Database(...)` muncul. Ia pemilik pragma. Impor `getDb()` dari sana.

### 5. Jangan menduplikasi route `/api` di Nitro

Semua path `/api` milik Hono, di-mount di `shared/http/app.ts`, dijangkau lewat satu adapter `server/api/[...path].ts`. Jangan menambah file `server/api/*.ts`. Jangan menambah route Nitro yang menutupi Hono.

### 6. Error

Lempar turunan `AppError` dari `shared/errors` (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Jangan pernah membangun respons error sendiri — `api.onError` di `shared/http/app.ts` yang memetakannya, dan hanya di sana.

### 7. Semua respons memakai envelope

```jsonc
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Pesan error dalam Bahasa Inggris; itu permukaan API, bukan UI.

### 8. Validasi di batas dengan Zod, selalu

Body dan query divalidasi sebelum handler berjalan. Tipe datang dari schema lewat `z.infer` — jangan tulis tipenya dua kali.

## Aturan TypeScript

Kamu menulis TypeScript untuk tim yang masih belajar. Utamakan keterbacaan, bukan kepintaran.

- **`strict: true` menyala. Jangan dimatikan. Jangan pakai `// @ts-ignore`.** Kalau sesuatu benar-benar tidak bisa bertipe, pakai `// @ts-expect-error` **dengan komentar alasannya**.
- **Jangan pernah pakai `any`.** Pakai `unknown` lalu persempit.
- **Utamakan inferensi daripada anotasi.** `const x = { a: 1 }` — jangan anotasi hal yang TypeScript sudah tahu. Anotasi hanya untuk parameter fungsi, return type fungsi publik, dan bentuk API/database.
- **Tanpa type gymnastics.** Tidak ada mapped type, conditional type, atau generic buatan sendiri kecuali tidak ada alternatif. Objek anonim lebih baik daripada mesin generic bernama di sini.
- **Turunkan tipe, jangan duplikasi.** `z.infer<typeof schema>` untuk bentuk validasi.
- File `.js` diizinkan dan akan terus diizinkan. Jangan mengusulkan konversi besar-besaran.

## Environment dan konfigurasi

- **`PORT` sengaja tidak ada di schema env.** Nitro memiliki socket-nya dan membaca `PORT` sendiri (default 3000). Jangan menambahkannya ke `shared/config/env.ts` — sumber kebenaran kedua untuk port adalah persis bug yang sudah kita hapus.
- **Jangan membaca `process.env` di mana pun selain `shared/config/env.ts`.** Tambahkan field ke schema Zod di sana.
- **`allowScripts` di `package.json` mem-pin persetujuan install script ke versi persis.** Saat meng-upgrade `better-sqlite3`, npm akan memperingatkan dan kamu harus menjalankan `npm install-scripts approve better-sqlite3`. Jangan pernah memakai `dangerously-allow-all-scripts`.

## SQLite dan migrasi

- Migrasi adalah SQL mentah di `database/migrations/`, urut nama file, **forward-only**.
- Jangan pernah mengubah migrasi yang mungkin sudah diterapkan di mana pun. Tambah file baru.
- Jangan menjatuhkan kolom di rilis yang sama dengan berhentinya penulisan ke kolom itu.
- Migrasi adalah langkah deploy, bukan boot aplikasi.
- Jangan menambah kolom ke tabel milik fitur lain. Fitur memiliki tabelnya sendiri.

## Yang tidak boleh ditambahkan

Aika sengaja tidak punya runtime kustom, framework HTTP, ORM, framework auth, container DI, layer RPC, tool build, tool monorepo, atau wrapper AI.

Sebelum menambah dependency, cek `ARCHITECTURE.md` → "Yang tidak dibangun Aika" dan "Filter desain". Kalau tool ekosistem mainstream sudah menyelesaikannya, pakai tool itu langsung, jangan dibungkus.

## Bahasa dokumentasi

- **Inggris adalah default.** `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- **Indonesia sekunder.** Nama file sama plus `.id.md`.
- **Keduanya diperbarui dalam perubahan yang sama.** Perubahan yang hanya memperbarui satu bahasa belum selesai.
- Kode, identifier, komentar, commit message, dan file ini: **Inggris**.

## Definition of done

Sebuah perubahan selesai ketika:

1. `npm run check` hijau.
2. Setiap route `/api` baru hidup di sebuah fitur dan di-mount di `shared/http/app.ts`.
3. Kode browser hanya mengimpor dari `~~/features/<nama>/web`.
4. Setiap perubahan schema punya file migrasi baru.
5. Kedua versi bahasa dari dokumentasi yang terpengaruh sudah diperbarui.
6. Perilaku baru punya minimal satu test, atau kamu menyatakan eksplisit kenapa tidak.
7. `CHANGELOG.md` dan `CHANGELOG.id.md` diperbarui kalau perubahannya terlihat oleh project klien.

## Kalau kamu tidak yakin

Katakan. Sebutkan asumsinya, sebutkan yang tidak bisa diverifikasi, dan tanyakan. Tebakan senyap yang salah di sebuah boilerplate akan berlipat ke setiap project klien turunannya.
