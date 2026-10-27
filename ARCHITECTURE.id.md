# Arsitektur Aika

[English](./ARCHITECTURE.md) · **Bahasa Indonesia**

Dokumen ini adalah **otoritas arsitektur**. Kalau ada kode yang bertentangan dengan dokumen ini, dokumennya yang benar dan kodenya yang perlu diperbaiki.

> Versi Inggris di [ARCHITECTURE.md](./ARCHITECTURE.md) adalah **versi kanonik**. File ini terjemahannya.

## Stack terkunci

| Area | Pilihan |
|---|---|
| Bahasa | TypeScript, `strict: true` |
| Runtime | Node.js >= 22 (tim memakai 24) |
| Frontend | Nuxt 4.6 (SSR) + Vue 3.5 |
| HTTP | Hono 4, di-mount di dalam Nitro |
| Database | SQLite via `better-sqlite3`, SQL mentah |
| Validasi | Zod 4, schema dimiliki fitur |
| Proses | Satu proses Node, PM2 `fork` mode, satu instance |
| Package manager | npm |

Ini bukan daftar preferensi. Ini keputusan yang sudah diambil, supaya tidak diperdebatkan ulang di setiap project klien.

## Model fitur

Unit utamanya adalah **fitur**: satu kemampuan bisnis yang disimpan utuh di satu tempat.

```text
features/billing/
├── contract.ts       # schema Zod & tipe turunan milik fitur ini
├── index.ts          # BATAS SERVER — satu pintu untuk kode server
├── server/           # route, service, repository, config
├── web/              # permukaan browser (opsional)
│   ├── index.ts      # BATAS BROWSER — satu pintu untuk kode browser
│   ├── pages/        #   -> otomatis jadi route (modules/features.ts)
│   └── components/
└── tests/
```

### Dua batas, bukan satu

Sebuah fitur punya **dua pintu**, dan keduanya tidak bisa dipertukarkan:

| Pintu | Konsumen | Boleh berisi |
|---|---|---|
| `index.ts` | kode server, server fitur lain | apa saja |
| `web/index.ts` | komponen Vue, kode `web/` fitur lain | kode dan tipe yang aman untuk browser |

**Kenapa ini ada.** `features/health/index.ts` mengekspor `healthRoutes`, yang mengimpor `better-sqlite3`. Komponen Vue yang mengimpor dari `index.ts` akan menyeret modul native Node ke bundle browser. Mengimpor dari `web/` membuat kesalahan itu mustahil secara struktural — dan aturan **R6** di `npm run arch:check` menangkapnya kalau ada yang mencoba.

Ini bukan contoh hipotetis. Ia ditemukan saat membangun fitur rujukan: versi pertama halaman depan mengimpor tipe dari `index.ts`, dan TypeScript tidak bisa memberi tipe pada respons karena kontraknya tidak terjangkau lewat pintu yang aman untuk browser.

Tipe tidak memakan biaya apa pun untuk browser: `import type` terhapus saat build, jadi mengekspor ulang tipe lewat `web/index.ts` menambah nol byte.

### Aturan

1. **`index.ts` dan `web/index.ts` adalah satu-satunya pintu.** Import antar fitur wajib lewat salah satunya. `import { x } from '~~/features/users/server/repository'` ditolak `npm run arch:check`.
2. **`contract.ts` tidak pernah diimpor langsung dari luar fitur.** Ia di-re-export lewat kedua pintu. Satu pintu per jenis konsumen, bukan dua jalan masuk.
3. **`server/` dan `web/` privat** bagi fitur lain. Di dalam fitur sendiri, bebas.
4. **Aplikasi boleh mengimpor fitur; fitur tidak boleh mengimpor aplikasi.** Tidak ada file di `features/` yang boleh menyentuh `app/`.
5. **Fitur tidak pernah membuka koneksi database sendiri.** Selalu lewat `shared/database/client`.
6. **Kode `web/` tidak pernah mengimpor modul server-only.** Bukan builtin `node:*`, bukan `better-sqlite3`, bukan `shared/database`, bukan `server/` miliknya sendiri.
7. **Graf dependensi antar fitur asiklik.**

Ketujuhnya ditegakkan `scripts/check-boundaries.ts` (`npm run arch:check`), aturan R1–R6. Itu lint heuristik berbasis teks, bukan compiler — specifier yang dirakit dari template string bisa mengecohnya. Ia menangkap kesalahan yang benar-benar terjadi.

### Kenapa fitur, bukan layer

Satu tes: *"Saya mau ubah cara pembatalan invoice — berapa folder yang saya buka?"*

Dikelompokkan per layer, jawabannya empat atau lebih: `controllers/`, `services/`, `models/`, `components/`. Dikelompokkan per fitur, jawabannya satu.

Konsekuensi yang paling penting untuk model bisnis Aika: **menghapus fitur.** Per fitur = `rm -rf features/invoices` plus satu baris di `shared/http/app.ts`. Per layer = berburu di enam folder dan berdoa tidak ada yang lupa.

Yang dikorbankan, disengaja: **duplikasi diterima.** Dua fitur boleh punya helper yang mirip. Ekstraksi hanya dilakukan kalau tiga fitur atau lebih memakai logika yang **secara semantik identik** dan berubah karena alasan yang sama. Jangan pernah ekstrak atas dasar kemiripan.

Jebakan yang harus dihindari: folder `shared/` yang membengkak jadi layer kedua. `shared/` hanya berisi infrastruktur netral bisnis. Kalau sebuah file menyebut kata benda domain (blog, invoice, user), ia bukan milik `shared/`.

## Layer aplikasi dan shared

- **`app/`** — shell Nuxt: `app.vue`, `layouts/`, `pages/`. Komposisi browser.
- **`server/`** — direktori Nitro. Tepat satu file: `server/api/[...path].ts`, adapter Hono.
- **`shared/config/`** — satu-satunya tempat `process.env` dibaca, divalidasi Zod, gagal saat boot.
- **`shared/database/`** — satu-satunya tempat SQLite dibuka, pemilik pragma.
- **`shared/errors/`** — error domain dengan `code` stabil dan `status` HTTP.
- **`shared/http/app.ts`** — **composition root server**: Hono app dan semua mount fitur.
- **`modules/features.ts`** — modul Nuxt yang mendaftarkan `features/*/web/pages/` sebagai route.

`shared/http/` adalah pengecualian yang disengaja terhadap prinsip "`shared/` netral bisnis": komposisi harus tinggal di suatu tempat, dan satu file kecil lebih baik daripada menyebar mount ke dalam fitur.

## HTTP dan kontrak

### Envelope

Semua respons `/api` memakai bentuk yang sama:

```jsonc
// sukses
{ "success": true,  "message": "OK", "data": { } }

// gagal
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Pesan error dalam Bahasa Inggris — ini permukaan API, bukan UI. Teks untuk pengguna diterjemahkan di sisi klien.

### Validasi

Tidak ada handler yang mempercayai input. Setiap body dan query divalidasi Zod **di batas route**, sebelum handler berjalan. Tipe TypeScript diturunkan dari schema yang sama (`z.infer`), jadi tidak pernah ada sumber kebenaran kedua.

Handler juga boleh mem-`parse` responsnya sendiri saat keluar. Terdengar berlebihan dan memang disengaja: di situlah penyimpangan kontrak menjadi kegagalan berisik saat development, bukan perubahan bentuk senyap di produksi.

### Error

Handler melempar `AppError` (atau turunannya: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Pemetaan ke respons JSON terjadi di tepat satu tempat: `api.onError` di `shared/http/app.ts`. **Tidak ada handler yang membangun respons error sendiri.**

### Kenapa Hono di dalam Nitro

| Pilihan | Kenapa tidak |
|---|---|
| Hono proses terpisah | Setiap render SSR membayar round-trip TCP sungguhan, dan cookie browser tidak diteruskan otomatis — halaman terautentikasi bisa ter-render logged-out secara intermiten. Ditambah dua unit deploy, dua health check, dua aliran log per VPS. |
| Hanya route Nitro | Kehilangan ergonomi middleware dan validasi Hono, dan mengunci API ke Nitro selamanya. |
| **Hono di dalam Nitro** | **Dipilih.** Satu proses, satu deploy, tanpa plumbing cookie. |

Yang menjaga ini tetap sehat: Hono app di `shared/http/app.ts` **tidak mengimpor apa pun dari Nitro**. Kalau suatu saat sebuah klien butuh Hono standalone, itu swap satu file, bukan rewrite.

## Konfigurasi

`shared/config/env.ts` adalah satu-satunya tempat `process.env` dibaca. Semua downstream menerima objek yang tervalidasi dan bertipe, dan proses gagal saat boot dengan pesan yang terbaca, bukan crash belakangan di dalam handler.

**`PORT` sengaja tidak ada di schema itu.** Nitro memiliki socket-nya dan membaca `PORT` sendiri, default 3000. Mencerminkannya di config aplikasi akan menciptakan sumber kebenaran kedua yang bisa diam-diam berbeda dengan port yang benar-benar di-bind. Ini teramati saat build awal: server naik di 3000 sementara config aplikasi mengklaim 5555.

- Development: 5555, lewat `devServer.port` di `nuxt.config.ts`.
- Produksi: sesuai `PORT` di file environment. Kalau berbeda dengan upstream reverse proxy, situs 502 — jadi simpan keduanya di satu tempat.

## Database

### Pragma

Diterapkan di satu tempat, `shared/database/client.ts`:

```js
journal_mode = WAL
busy_timeout = 5000
synchronous  = NORMAL
foreign_keys = ON
wal_autocheckpoint = 1000
```

Dua di antaranya bukan default di mana pun dan tidak boleh dilewati: `better-sqlite3` **tidak** menyalakan penegakan foreign key secara default, dan `busy_timeout` tidak punya default yang aman.

### Migrasi

SQL mentah, forward-only, urut nama file. `npm run db:migrate` menulis snapshot lebih dulu dan menolak jalan kalau snapshot gagal.

Tiga aturan:

1. Jangan pernah mengubah migrasi yang mungkin sudah diterapkan di mana pun.
2. Jangan menjatuhkan kolom di rilis yang sama dengan berhentinya penulisan ke kolom itu.
3. Migrasi **bukan** bagian dari boot aplikasi. Ia langkah deploy tersendiri. Kalau jalan saat boot, kode yang sudah di-rollback akan bertemu migrasi yang sudah maju — tidak bisa diperbaiki dengan restart.

Untuk membalikkan sesuatu, tulis migrasi baru yang membaliknya. Tidak ada down migration.

### Satu database per klien

Setiap klien adalah VPS terpisah dengan file database sendiri. Isolasi gratis, backup gampang di-restore, dan bug query lintas tenant mustahil. Kolom `tenant_id` tidak membeli apa pun di sini dan hanya menambah filter yang cepat atau lambat terlupakan.

Satu detail yang bikin orang frustrasi sekali: file `-wal` dan `-shm` adalah bagian dari database. Backup yang menyalin hanya file `.db` sambil aplikasi berjalan akan menangkap keadaan robek. Karena itu `scripts/db-backup.ts` memakai `.backup()` bawaan better-sqlite3, bukan `cp`.

### SQLite di produksi

WAL memberi pembaca konkuren plus **satu penulis**. Batas praktisnya: ketika transaksi tulis cukup panjang sehingga `busy_timeout` mulai memunculkan `SQLITE_BUSY` pada beban normal, atau ketika butuh beberapa server aplikasi menulis ke file yang sama. Untuk situs klien, batas itu jarang tersentuh.

Itulah alasan `ecosystem.config.cjs` memakai `exec_mode: 'fork'` dengan `instances: 1`. Cluster mode berarti N proses = N koneksi = N penulis yang berebut satu file lock. Karena SQLite menyerialisasi penulisan di level file, penulis tambahan tidak menambah throughput — hanya menambah variasi `SQLITE_BUSY`.

File database, sidecar WAL-nya, dan backup **harus** berada di storage lokal host aplikasi. Jangan pernah di network filesystem bersama.

## Model distribusi — kenapa tanpa monorepo

Ini keputusan yang membentuk repo ini, jadi alasannya dicatat lengkap.

**Kebutuhannya:** Aika terus membaik, dan perbaikan itu harus sampai ke project klien yang sudah jalan. Itu berarti sync, dan sync berarti ada yang harus dikorbankan.

Yang tidak mungkin: **sync dua arah.** Yang mungkin: **satu arah, disengaja, berversi, untuk bagian yang diputuskan untuk dibagikan.** Memilih batas itu adalah keputusan desain, bukan detail implementasi.

| Strategi | Mekanisme sync | Kenapa |
|---|---|---|
| Copy sekali, lupakan | tidak ada | Aika membusuk; klien ke-2 mulai dari baseline lebih buruk dari klien ke-5. Ditolak. |
| Monorepo + package berversi | `npm up @aika/base` | Bekerja, tapi menukar masalah merge dengan disiplin semver dan registry privat. Ditolak — tidak disukai, dan memaksa pnpm untuk proteksi yang hanya relevan di dalam monorepo. |
| **Copy repo + `git pull upstream`** | `git merge upstream/main` | **Dipilih.** |

Kenapa yang ketiga bekerja di sini padahal biasanya membusuk: **karena batasnya ditegakkan, bukan karena git-nya ajaib.**

`git pull upstream` membusuk ketika tidak ada batas — ketika kode klien dan kode framework tercampur di file yang sama. Di Aika batasnya nyata dan bisa diperiksa:

- Update Aika menyentuh `shared/`, `server/`, `modules/` — file yang tidak pernah diubah klien.
- Kerjaan klien hidup di `features/<milik-klien>/`.
- Yang boleh berbeda di tiap klien adalah daftar tertutup, dan daftarnya pendek.

Dua himpunan file yang hampir tidak beririsan → merge yang sepele.

**`npm run arch:check` adalah harga dari keputusan ini.** Itu yang menjaga batasnya tetap nyata. Kalau batasnya bocor, model distribusinya rusak — ini bukan soal kerapian.

### File yang wajar berbeda di tiap klien

Daftar tertutup. Sisanya milik Aika.

| File | Kenapa |
|---|---|
| `app/pages/*`, `app/layouts/*`, `app/app.vue` | UI dan brand klien |
| `shared/http/app.ts` | Baris mount fitur per klien |
| `features/<fitur-milik-klien>/**` | Seluruh kerjaan custom |
| `database/migrations/*` | Hanya menambah file baru |
| `.env`, `ecosystem.config.cjs` | Nama proses dan rahasia |

Semua file lain: kalau kamu perlu mengubahnya untuk satu klien, **ubah di Aika dulu**, lalu tarik ke klien. Kalau perubahannya tidak masuk akal untuk Aika, kemungkinan besar letaknya salah.

## Keputusan yang dicatat

| Keputusan | Alasan singkat |
|---|---|
| TypeScript di batang, JS bebas di daun | Biaya nyata ada di integrasi upstream→klien. Tipe mengubah "500 di halaman yang jarang dibuka" jadi "build gagal". |
| Dua batas per fitur | `index.ts` menjangkau `better-sqlite3`; `web/index.ts` tidak bisa. Sistem tipe dan R6 menegakkan bedanya. |
| Tanpa ORM, SQL mentah | Tipe datang dari Zod di `contract.ts`, bukan dari ORM. Lebih sedikit mesin, lebih sedikit yang dipelajari. |
| `PORT` di luar schema env | Satu sumber kebenaran per fakta. Nitro pemilik socket-nya. |
| `allowScripts` di-pin ke versi persis | npm 11 membuat install script opt-in. Pin-nya higienitas supply chain, disetujui ulang per upgrade. |
| Tanpa monorepo, tanpa pnpm | Lihat model distribusi di atas. |
| Satu proses Node | Lihat "Kenapa Hono di dalam Nitro". |
| Migrasi forward-only | Down migration di SQL jarang ditulis benar dan lebih sering berbohong. |
| Dokumen Inggris default, Indonesia sekunder | Inggris adalah default ekosistem; Indonesia bahasa baca tim. |

## Yang tidak dibangun Aika

Daftar ini sama pentingnya dengan daftar isi. Kalau sebuah ide masuk ke sini, jawabannya tidak — kecuali ada alasan yang sangat kuat.

Tidak ada: runtime kustom, framework HTTP kustom, ORM, framework auth, container DI, sistem RPC, compiler, bahasa baru, tool build, **tool monorepo**, konfigurator multi-stack, atau wrapper AI.

Aika mengorganisir dan menjaga batas aplikasi. Ekosistem yang memiliki stack-nya.

## Filter desain

Sebelum menambah apa pun ke Aika, lewati tiga pertanyaan ini:

1. **Apakah ini memperkuat batas antara Aika dan klien?** Kalau tidak, kemungkinan besar ini kode klien.
2. **Bisakah tool ekosistem menyelesaikannya?** Kalau bisa, pakai tool itu langsung, jangan dibungkus.
3. **Bisakah ini disimpulkan dari kode dan konvensi?** Kalau bisa, simpulkan — jangan tambah metadata yang bisa jadi tidak sinkron.
