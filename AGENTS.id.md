# AGENTS.id.md: aturan untuk AI coding agent di Aika

[English](./AGENTS.md) · **Bahasa Indonesia**

Baca ini sebelum menulis kode. Yang jadi acuan adalah `ARCHITECTURE.md`. Kalau file ini berbeda dengan `ARCHITECTURE.md`, yang menang `ARCHITECTURE.md`, katakan kalau ada yang tidak cocok, jangan menebak.

> **Catatan:** yang benar-benar dibaca agent adalah [AGENTS.md](./AGENTS.md), dan itu ditulis dalam Bahasa Inggris. File ini versi Indonesianya, untuk dibaca manusia. Isinya sama.

## Aika itu apa

Kit aplikasi internal (bukan open source) untuk membangun web app klien. Nuxt + Hono + SQLite, TypeScript, satu proses Node, PM2 di VPS.

Cara perpindahan kodenya: clone repo ini per project klien, lalu tarik perbaikan dari `upstream` lewat git. **Itu hanya tetap mudah di-merge selama batas antara framework dan klien masih nyata.** Sebagian besar aturan di bawah ada untuk menjaga batas itu, bukan demi kerapian.

## Perintah

```bash
npm run check              # GERBANG utama. Wajib hijau sebelum mengaku selesai.
npm run typecheck          # sisi Nuxt/Vue
npm run typecheck:scripts  # scripts/, shared/, features/
npm run arch:check         # aturan batas fitur R1-R6
npm run prose:check        # menolak em dash dan en dash di mana pun
npm run dev                # server dev di :5555
npm run db:migrate         # jalankan migrasi (snapshot dulu)
npm run db:backup          # backup SQLite online
```

Jalankan `npm run check` sebelum melaporkan selesai. Jangan pernah melaporkan sukses hanya karena "seharusnya jalan".

## Aturan yang tidak bisa ditawar

### 1. Bangun per fitur, bukan per layer

Fitur = satu kemampuan bisnis, disimpan utuh di satu tempat:

```
features/<nama>/
├── contract.ts   # schema Zod + tipe turunannya
├── index.ts      # BATAS SERVER
├── server/       # route, service, repository, config
├── web/          # permukaan browser (opsional)
│   ├── index.ts  # BATAS BROWSER
│   ├── pages/    # otomatis jadi route lewat modules/features.ts
│   └── components/
└── tests/
```

Jangan membuat direktori `controllers/`, `services/`, `models/`, atau `repositories/` di level atas. Kalau tergoda, logikanya sebenarnya milik sebuah fitur.

### 2. Fitur punya DUA pintu, dan keduanya tidak bisa saling menggantikan

| Impor dari | Boleh dipakai di |
|---|---|
| `~~/features/<nama>` | kode server, kode server fitur lain |
| `~~/features/<nama>/web` | komponen Vue, kode `web/` fitur lain |

**Salah di sini adalah cara termudah merusak build klien.**

`~~/features/health` mengekspor `healthRoutes`, dan file itu mengimpor `better-sqlite3`. Kalau diimpor dari komponen Vue, modul native Node ikut masuk ke bundle browser. Kode browser harus mengimpor dari `~~/features/<nama>/web`.

Dua-duanya ditolak `arch:check`:

```ts
// ditolak: deep import antar fitur (R2)
import { getCurrentUser } from '~~/features/auth/server/repository'

// ditolak: kode browser mengimpor batas server (R6)
import type { Post } from '~~/features/blog'
```

Jangan juga mengimpor `contract.ts` milik fitur lain secara langsung. File itu sudah di-re-export lewat kedua pintu. Satu pintu untuk tiap jenis pemakai.

### 3. Fitur tidak mengimpor dari `app/`

`app/` itu shell browser. Shell-nya yang bergantung pada fitur, bukan sebaliknya.

### 4. Jangan pernah membuka koneksi database sendiri

`shared/database/client.ts` adalah satu-satunya tempat `new Database(...)` muncul. di situlah pragma-nya diatur. Impor `getDb()` dari sana.

### 5. Jangan menduplikasi route `/api` di Nitro

Semua path `/api` milik Hono, di-mount di `shared/http/app.ts`, dan dijangkau lewat satu jembatan `server/api/[...path].ts`. Jangan menambah file `server/api/*.ts`. Jangan menambah route Nitro yang menutupi Hono.

### 6. Error

Lempar turunan `AppError` dari `shared/errors` (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Jangan menyusun respons error sendiri. Yang memetakannya cuma `api.onError` di `shared/http/app.ts`.

### 7. Semua respons pakai envelope

```jsonc
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Pesan error pakai Bahasa Inggris, karena itu permukaan API, bukan tampilan.

### 8. Validasi di batas dengan Zod, selalu

Body dan query divalidasi sebelum handler jalan. Tipe diambil dari schema lewat `z.infer`, jangan menulis tipenya dua kali.

## Aturan TypeScript

Kamu menulis TypeScript untuk tim yang masih belajar. Utamakan yang mudah dibaca, bukan yang terlihat pintar.

- **`strict: true` menyala. Jangan dimatikan. Jangan pakai `// @ts-ignore`.** Kalau benar-benar tidak bisa diberi tipe, pakai `// @ts-expect-error` **beserta komentar alasannya**.
- **Jangan pakai `any`.** Pakai `unknown`, lalu dipersempit.
- **Lebih baik biarkan TypeScript menyimpulkan.** `const x = { a: 1 }` sudah cukup, jangan menulis anotasi untuk hal yang TypeScript sudah tahu. Anotasi dipakai untuk parameter fungsi, return type fungsi publik, dan bentuk data API/database.
- **Jangan bikin tipe yang rumit-rumit.** Tidak perlu mapped type, conditional type, atau generic bikinan sendiri kalau masih ada jalan lain. Di sini, objek anonim lebih baik daripada generic yang dibikin berlapis-lapis.
- **Turunkan tipe, jangan tulis ulang.** Pakai `z.infer<typeof schema>` untuk bentuk validasi.
- File `.js` tetap diizinkan. Jangan mengusulkan konversi besar-besaran.

## Environment dan konfigurasi

- **`PORT` sengaja tidak ada di schema env.** Nitro yang memiliki socket-nya dan membaca `PORT` sendiri (default 3000). Jangan menambahkannya ke `shared/config/env.ts`, dua acuan yang bisa berbeda untuk port itu persis bug yang sudah kita buang.
- **Jangan membaca `process.env` di tempat lain, selain `shared/config/env.ts`.** Tambahkan field ke schema Zod di sana.
- **`allowScripts` di `package.json` mem-pin persetujuan install script ke versi yang persis.** Saat meng-upgrade `better-sqlite3`, npm akan memperingatkan dan kamu harus menjalankan `npm install-scripts approve better-sqlite3`. Jangan pernah pakai `dangerously-allow-all-scripts`.

## SQLite dan migrasi

- Migrasi itu SQL mentah di `database/migrations/`, dijalankan urut nama file, **forward-only**.
- Jangan pernah mengubah migrasi yang mungkin sudah dijalankan di mana pun. Tambah file baru.
- Jangan menghapus kolom di rilis yang sama dengan berhentinya penulisan ke kolom itu.
- Migrasi itu langkah deploy, bukan boot aplikasi.
- Jangan menambah kolom ke tabel milik fitur lain. Tiap fitur memiliki tabelnya sendiri.

## Yang tidak boleh ditambahkan

Aika sengaja tidak punya runtime buatan sendiri, framework HTTP, ORM, framework auth, container DI, layer RPC, tool build, tool monorepo, atau wrapper AI.

Sebelum menambah dependency, cek `ARCHITECTURE.md` bagian "Yang tidak kita bangun" dan "Filter desain". Kalau tool di ekosistem sudah menyelesaikannya, pakai tool itu langsung, jangan dibikin wrapper sendiri.

## Bahasa dokumentasi

- **Inggris sebagai default.** `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- **Indonesia sebagai pendamping.** Nama file sama, ditambah `.id.md`.
- **Keduanya diperbarui dalam perubahan yang sama.** Perubahan yang hanya memperbarui satu bahasa belum selesai.
- Kode, identifier, komentar, commit message, dan `AGENTS.md`: **Inggris**.

## Gaya penulisan

Berlaku untuk semua dokumen di repo ini, dalam kedua bahasa.

- **Jangan pakai em dash atau en dash.** Pakai koma, titik dua, titik, atau tanda kurung. Tanda hubung biasa tetap boleh di dalam kata dan rentang seperti `R1-R6`. `npm run prose:check` menolak kedua karakter itu, dan ikut jalan sebagai bagian dari `npm run check`.
- **Jaga kalimat tetap pendek.** Kalau satu kalimat butuh tiga koma supaya utuh, pecah jadi dua.
- **Utamakan kalimat aktif.** "Skrip ini menolak deep import" lebih enak dibaca daripada "deep import ditolak".
- **Kalau sebuah aturan penting, jadikan skrip.** Aturan yang cuma hidup di dokumen akan luntur. `arch:check` dan `prose:check` ada justru karena itu.

## Kapan sebuah perubahan dianggap selesai

1. `npm run check` hijau.
2. Setiap route `/api` baru tinggal di dalam fitur dan di-mount di `shared/http/app.ts`.
3. Kode browser hanya mengimpor dari `~~/features/<nama>/web`.
4. Setiap perubahan schema punya file migrasi baru.
5. Kedua versi bahasa dari dokumentasi yang terpengaruh sudah diperbarui.
6. Perilaku baru punya minimal satu test, atau kamu menyebutkan alasannya kenapa tidak.
7. `CHANGELOG.md` dan `CHANGELOG.id.md` diperbarui kalau perubahannya terlihat oleh project klien.

## Kalau kamu tidak yakin

Bilang. Sebutkan asumsimu, sebutkan apa yang tidak bisa kamu verifikasi, lalu tanya. Tebakan senyap yang salah di sebuah boilerplate ikut terbawa ke setiap project klien turunannya.
