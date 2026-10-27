# Arsitektur Aika

[English](./ARCHITECTURE.md) · **Bahasa Indonesia**

Dokumen ini yang jadi acuan arsitektur. Kalau ada kode yang berbeda dengan isi dokumen ini, dokumennya yang benar, kodenya yang perlu diperbaiki.

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [ARCHITECTURE.md](./ARCHITECTURE.md) tetap yang jadi acuan.

## Stack yang sudah dikunci

| Bagian | Pilihan |
|---|---|
| Bahasa | TypeScript, `strict: true` |
| Runtime | Node.js >= 22 (tim pakai 24) |
| Frontend | Nuxt 4.6 (SSR) + Vue 3.5 |
| Styling | Tailwind CSS v4, lewat plugin `@tailwindcss/vite` |
| HTTP | Hono 4, di-mount di dalam Nitro |
| Database | SQLite lewat `better-sqlite3`, SQL mentah |
| Validasi | Zod 4, schema dimiliki tiap fitur |
| Proses | Satu proses Node, PM2 `fork` mode, satu instance |
| Package manager | npm |

Ini bukan daftar selera. Ini keputusan yang sudah diambil, supaya kita tidak membahasnya ulang di tiap project klien.

## Model fitur

Unit utamanya adalah **fitur**: satu kemampuan bisnis yang disimpan utuh di satu tempat.

```text
features/billing/
├── contract.ts       # Zod schema and inferred types, owned by this feature
├── index.ts          # SERVER boundary: one door for server code
├── server/           # route, service, repository, config
├── web/              # browser surface (optional)
│   ├── index.ts      # BROWSER boundary: one door for browser code
│   ├── pages/        #   -> auto-routed by modules/features.ts
│   └── components/
└── tests/
```

### Dua batas, bukan satu

Sebuah fitur punya **dua pintu**, dan keduanya tidak bisa saling menggantikan:

| Pintu | Dipakai oleh | Boleh berisi |
|---|---|---|
| `index.ts` | kode server, kode server fitur lain | apa saja |
| `web/index.ts` | komponen Vue, kode `web/` fitur lain | kode dan tipe yang aman untuk browser |

**Kenapa harus dipisah.** `features/health/index.ts` mengekspor `healthRoutes`, dan file itu mengimpor `better-sqlite3`. Kalau ada komponen Vue yang mengimpor dari `index.ts`, modul native Node itu ikut masuk ke bundle browser. Lewat `web/` kesalahan itu jadi mustahil secara struktural, dan kalau tetap ada yang mencoba, aturan **R6** di `npm run arch:check` akan menangkapnya.

Ini bukan contoh karangan. Masalah ini muncul saat membangun fitur contoh: versi pertama halaman depan mengimpor tipe dari `index.ts`, dan TypeScript tidak bisa memberi tipe pada respons karena kontraknya tidak terjangkau lewat pintu yang aman untuk browser.

Untuk browser, tipe tidak memakan biaya apa pun. `import type` hilang saat build, jadi mengekspor ulang tipe lewat `web/index.ts` tidak menambah satu byte pun.

### Aturan

1. **Hanya `index.ts` dan `web/index.ts` yang jadi pintu.** Import antar fitur harus lewat salah satunya. `import { x } from '~~/features/users/server/repository'` akan ditolak `npm run arch:check`.
2. **`contract.ts` tidak pernah diimpor langsung dari luar fitur.** File itu di-re-export lewat kedua pintu. Satu pintu untuk tiap jenis pemakai, bukan dua jalan masuk.
3. **`server/` dan `web/` bersifat privat** bagi fitur lain. Di dalam fitur pemiliknya, bebas.
4. **Aplikasi boleh mengimpor fitur; fitur tidak boleh mengimpor aplikasi.** Tidak ada file di dalam `features/` yang menyentuh `app/`.
5. **Fitur tidak membuka koneksi database sendiri.** Selalu lewat `shared/database/client`.
6. **Kode `web/` tidak mengimpor modul khusus server.** Bukan builtin `node:*`, bukan `better-sqlite3`, bukan `shared/database`, bukan `server/` miliknya sendiri.
7. **Dependensi antar fitur tidak boleh melingkar.**

Ketujuh aturan ini dijaga `scripts/check-boundaries.ts` (`npm run arch:check`), lewat aturan R1-R6. Alat itu memeriksa teks, bukan compiler, jadi specifier yang dirakit dari template string bisa lolos. Tapi kesalahan yang benar-benar sering terjadi, semua tertangkap.

### Kenapa per fitur, bukan per layer

Coba satu pertanyaan: *"Saya mau ubah cara pembatalan invoice. Berapa folder yang harus saya buka?"*

Kalau dikelompokkan per layer, jawabannya empat atau lebih: `controllers/`, `services/`, `models/`, `components/`. Kalau per fitur, jawabannya satu.

Yang paling penting untuk model bisnis Aika adalah **menghapus fitur**. Per fitur: `rm -rf features/invoices` plus satu baris di `shared/http/app.ts`. Per layer: berburu di enam folder sambil berharap tidak ada yang terlewat.

Ada satu hal yang kita relakan: **duplikasi dibiarkan.** Dua fitur boleh punya helper yang mirip. Kita baru memisahkan ke tempat bersama kalau tiga fitur atau lebih memakai logika yang benar-benar sama dan berubah karena alasan yang sama. Jangan memisahkan hanya karena mirip.

Dan satu jebakan yang harus dihindari: `shared/` yang lama-lama berubah jadi layer kedua. `shared/` hanya untuk infrastruktur yang tidak terikat domain. Kalau ada file menyebut kata benda domain (blog, invoice, user), tempatnya bukan di `shared/`.

## Layer aplikasi dan shared

- **`app/`**: shell Nuxt: `app.vue`, `layouts/`, `pages/`. Ini komposisi sisi browser.
- **`server/`**: direktori Nitro. Isinya tepat satu file: `server/api/[...path].ts`, jembatan ke Hono.
- **`shared/config/`**: satu-satunya tempat `process.env` dibaca, divalidasi Zod, dan gagal saat boot kalau ada yang salah.
- **`shared/database/`**: satu-satunya tempat SQLite dibuka, dan pemilik pragma-nya.
- **`shared/errors/`**: error domain dengan `code` dan `status` HTTP yang tetap.
- **`shared/http/app.ts`**: composition root server: Hono app dan semua mount fitur.
- **`shared/http/envelope.ts`**: schema envelope kegagalan. Tempatnya di sini karena `app.ts` satu-satunya yang memproduksi respons error, jadi bentuknya memang dipakai bersama.
- **`shared/nuxt/feature-pages.ts`**: mengubah halaman fitur jadi route record. Fungsi murni, sengaja dipisah dari modul Nuxt supaya bisa dites tanpa menjalankan Nuxt.
- **`modules/features.ts`**: modul Nuxt yang menerapkan route itu.

`shared/http/` sengaja jadi pengecualian dari prinsip "`shared/` netral domain": komposisi harus tinggal di suatu tempat, dan satu file kecil jelas lebih baik daripada menebar mount ke dalam fitur.

## HTTP dan kontrak

### Envelope

Semua respons `/api` memakai bentuk yang sama:

```jsonc
// success
{ "success": true,  "message": "OK", "data": { } }

// failure
{ "success": false, "message": "…", "code": "VALIDATION_ERROR", "errors": [] }
```

Pesan error pakai Bahasa Inggris, karena itu permukaan API, bukan tampilan. Teks untuk pengguna baru diterjemahkan di sisi klien.

### Validasi

Tidak ada handler yang mempercayai input. Setiap body dan query divalidasi Zod **di batas route**, sebelum handler jalan. Tipe TypeScript diturunkan dari schema yang sama (`z.infer`), jadi tidak pernah ada dua acuan yang bisa berbeda.

Handler juga boleh mem-`parse` responsnya sendiri saat keluar. Terdengar berlebihan, dan memang sengaja: di situlah penyimpangan kontrak berubah jadi kegagalan yang berisik saat development, bukan perubahan bentuk yang senyap di produksi.

### Error

Handler melempar `AppError` atau turunannya (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`). Pemetaan ke respons JSON terjadi di satu tempat saja: `api.onError` di `shared/http/app.ts`. **Tidak ada handler yang menyusun respons error sendiri.**

### Kenapa Hono di dalam Nitro

| Pilihan | Kenapa tidak dipakai |
|---|---|
| Hono sebagai proses terpisah | Setiap render SSR membayar round-trip TCP sungguhan. Cookie browser juga tidak otomatis diteruskan, jadi halaman yang seharusnya login bisa ter-render sebagai logged-out, dan itu muncul-hilang. Belum lagi dua unit deploy, dua health check, dan dua aliran log per VPS. |
| Hanya route Nitro | Kehilangan middleware dan kemudahan validasi dari Hono, dan API jadi terkunci ke Nitro selamanya. |
| **Hono di dalam Nitro** | **Dipilih.** Satu proses, satu deploy, tidak ada urusan cookie. |

Yang bikin ini tetap sehat: Hono app di `shared/http/app.ts` **tidak mengimpor apa pun dari Nitro**. Kalau suatu saat ada klien yang butuh Hono berdiri sendiri, itu cuma menukar satu file, bukan menulis ulang.

## Konfigurasi

`shared/config/env.ts` adalah satu-satunya tempat `process.env` dibaca. Semua bagian lain menerima objek yang sudah tervalidasi dan bertipe, dan prosesnya gagal saat boot dengan pesan yang jelas, bukan crash belakangan di tengah request.

**`PORT` sengaja tidak ada di schema itu.** Nitro yang memiliki socket-nya dan membaca `PORT` sendiri, dengan default 3000. Kalau kita cerminkan di config aplikasi, akan ada dua acuan yang bisa berbeda yang bisa diam-diam berbeda dengan port yang benar-benar dipakai. Ini benar-benar terjadi saat build awal: server naik di 3000 sementara config aplikasi mengklaim 5555.

- Development: 5555, lewat `devServer.port` di `nuxt.config.ts`.
- Produksi: sesuai `PORT` di file environment. Kalau nilainya berbeda dengan upstream reverse proxy, situs jadi 502, jadi simpan keduanya di satu tempat.

## Database

### Pragma

Semuanya diterapkan di satu tempat, `shared/database/client.ts`:

```js
journal_mode = WAL
busy_timeout = 5000
synchronous  = NORMAL
foreign_keys = ON
wal_autocheckpoint = 1000
```

Dua di antaranya perlu diperhatikan karena bukan default di mana pun: `better-sqlite3` **tidak** menyalakan penegakan foreign key secara default, dan `busy_timeout` tidak punya default yang aman.

### Migrasi

SQL mentah, forward-only, dijalankan urut nama file. `npm run db:migrate` menulis snapshot dulu, dan menolak jalan kalau snapshot-nya gagal.

Tiga aturan:

1. Jangan pernah mengubah migrasi yang mungkin sudah dijalankan di mana pun.
2. Jangan menghapus kolom di rilis yang sama dengan berhentinya penulisan ke kolom itu.
3. Migrasi **bukan** bagian dari boot aplikasi. Migrasi itu langkah deploy tersendiri. Kalau dijalankan saat boot, kode yang sudah di-rollback akan bertemu migrasi yang sudah maju duluan, dan restart tidak bisa memperbaikinya.

Untuk membatalkan sesuatu, tulis migrasi baru yang membaliknya. Tidak ada down migration.

### Satu database per klien

Tiap klien adalah VPS terpisah dengan file database sendiri. Isolasinya gratis, backup-nya gampang di-restore, dan bug query lintas tenant jadi mustahil. Kolom `tenant_id` tidak memberi keuntungan apa pun di sini, hanya menambah satu filter yang cepat atau lambat akan terlupakan.

Satu detail yang bikin orang frustrasi sekali lalu kapok: file `-wal` dan `-shm` itu bagian dari database. Backup yang hanya menyalin file `.db` sambil aplikasi jalan akan menangkap keadaan yang robek. Karena itu `scripts/db-backup.ts` memakai `.backup()` dari better-sqlite3, bukan `cp`.

### SQLite di produksi

Dengan WAL, banyak pembaca bisa jalan bersamaan, tapi penulisnya tetap satu. Batas praktisnya: saat transaksi tulis sudah cukup panjang sehingga `busy_timeout` mulai memunculkan `SQLITE_BUSY` di beban normal, atau saat butuh beberapa server aplikasi menulis ke file yang sama. Untuk situs klien, batas itu jarang tersentuh.

Itu sebabnya `ecosystem.config.cjs` memakai `exec_mode: 'fork'` dengan `instances: 1`. Cluster mode berarti N proses = N koneksi = N penulis yang berebut satu file lock. Karena SQLite menyerialisasi penulisan di level file, penulis tambahan tidak menambah throughput sama sekali, yang bertambah cuma variasi `SQLITE_BUSY`.

File database, sidecar WAL-nya, dan semua backup **harus** ada di storage lokal host aplikasi. Jangan pernah di network filesystem bersama.

## Autentikasi

Ditulis sendiri, bukan diadopsi, dan sengaja yang paling kecil yang bisa jalan.
Pemiliknya `features/auth/`, dan ini rujukan untuk fitur yang memakai kedua
batas sekaligus.

| Keputusan | Kenapa |
|---|---|
| scrypt dari `node:crypto`, bukan argon2 atau bcrypt | Keduanya modul native, yang berarti satu entri `allowScripts` lagi dan satu hal lagi yang bisa gagal build saat clone baru. scrypt bersifat memory-hard dan sudah ada di Node |
| Sesi di SQLite, bukan JWT | Pencabutan. Baris bisa dihapus. Token yang sudah ditandatangani tidak bisa dibatalkan, dan "keluar dari semua perangkat" berubah jadi masalah rotasi kunci |
| Hanya SHA-256 dari token sesi yang disimpan | Database yang bocor tidak menyerahkan sesi yang masih hidup. Tokennya 32 byte acak, jadi hash yang lambat tidak membeli apa pun dan justru membebani setiap permintaan |
| Cookie `httpOnly` biasa | Tidak bisa dibaca JavaScript, jadi bug XSS tidak bisa mengangkat sesinya. `sameSite=Lax` tetap mengirimnya saat navigasi top level dan memblokir form lintas situs |
| Masa hidup 30 hari mutlak, bukan bergeser | Masa hidup bergeser berarti sesi yang dicuri tidak pernah mati selama terus dipakai. Masa hidup mutlak membatasi kerusakannya |

Faktor kerjanya disimpan di dalam tiap hash, jadi bisa dinaikkan nanti tanpa
membatalkan password yang sudah ada. `verifyPassword` membaca parameternya dari
hash yang diberikan, bukan mengasumsikan nilai yang berlaku sekarang.

### Menjaga sebuah halaman

Halaman mana pun bisa mewajibkan sesi:

```ts
definePageMeta({ middleware: 'auth' })
```

Middleware-nya memanggil `/api/auth/me` lewat HTTP, bukan mengimpor fiturnya.
Aplikasi boleh mengimpor fitur, tapi lewat HTTP berarti penjaganya tetap bekerja
bagaimanapun fitur auth memutuskan menyimpan sesinya nanti.

**Detail SSR yang penting:** ia memakai `useRequestFetch`, bukan `useFetch`. Di
server, fetch biasa tidak membawa cookie dari request yang masuk, jadi pengunjung
yang sudah login akan dilempar ke halaman login di setiap navigasi keras,
sementara setelah navigasi sisi klien semuanya tampak normal. Bug seperti ini
cuma muncul di server rendering, justru saat tidak ada yang memperhatikan.

### Pembagian `/health`

Halaman `/health` butuh sesi. Endpoint `/api/health` tidak. Itu bukan kelalaian.
Pemantauan tidak bisa login, dan health endpoint yang butuh kredensial akan gagal
tepat saat dibutuhkan. Satu permukaan untuk mesin, satu untuk manusia.

## Testing

Test berjalan di environment `node`, tanpa build Nuxt dan tanpa server HTTP. Itu bisa karena `shared/http/app.ts` tidak mengimpor apa pun dari Nitro: Hono app bisa langsung didorong dengan `Request` standar Web.

| Jenis | Lokasi | Cakupan |
|---|---|---|
| Unit | `tests/unit/` | Logika murni tanpa framework, misalnya perhitungan route halaman fitur. |
| Perilaku fitur | `features/<nama>/tests/` | Endpoint fitur itu, dijalankan lewat Hono app yang sebenarnya. |

Aturannya:

1. **Parse responsnya, jangan periksa field satu per satu.** `response.json()` bertipe `unknown`, dan itu disengaja. Melewatkannya ke schema Zod milik fiturnya sekaligus jadi validasi dan penyempitan tipe, dan yang diperiksa adalah kontrak yang diterbitkan, bukan salinannya.
2. **Jalankan Hono app yang sebenarnya.** Biayanya murah, dan mem-mock-nya cuma menguji mock-nya.
3. **Uji sambungannya, bukan implementasinya.** `shared/nuxt/feature-pages.ts` dipisahkan dari modul Nuxt justru untuk ini.
4. **Test yang tidak mungkin gagal bukan test.** Semua test di sini memeriksa nilai yang masuk akal untuk salah.

Yang sengaja belum dicakup: test yang menyalakan server hasil build lalu meminta halaman asli. Sekarang pemeriksaan itu dijalankan manual (`npm run build`, nyalakan server, minta `/health`). Tempatnya di CI begitu pipelinenya ada.

## Cara kode ini berpindah: kenapa tanpa monorepo

Ini keputusan yang paling membentuk repo ini, jadi alasannya saya tulis lengkap.

**Kebutuhannya:** Aika terus diperbaiki, dan perbaikan itu harus sampai ke project klien yang sudah jalan. Berarti harus ada sinkronisasi. Dan setiap sinkronisasi selalu ada harganya.

Yang tidak mungkin: **sinkronisasi dua arah.** Yang mungkin: **satu arah, disengaja, berversi, hanya untuk bagian yang kita putuskan untuk dibagikan.** Memilih batas itu adalah keputusan desain, bukan detail teknis.

| Cara | Sinkronisasinya | Kenapa tidak dipilih |
|---|---|---|
| Clone sekali, lalu lupakan | tidak ada | Aika membusuk. Klien kedua mulai dari titik yang lebih buruk daripada klien kelima. |
| Monorepo + package berversi | `npm up @aika/base` | Bisa jalan, tapi masalah merge cuma berganti jadi masalah disiplin semver dan registry privat. Tidak dipilih karena tidak disukai, dan karena memaksa pnpm untuk perlindungan yang hanya relevan di dalam monorepo. |
| **Clone repo + `git pull upstream`** | `git merge upstream/main` | **Dipilih.** |

Kenapa cara ketiga bisa bertahan di sini, padahal biasanya membusuk: **karena batasnya dijaga, bukan karena git-nya ajaib.**

`git pull upstream` membusuk saat tidak ada batas, saat kode klien dan kode framework tercampur di file yang sama. Di Aika batasnya nyata dan bisa diperiksa:

- Update Aika menyentuh `shared/`, `server/`, `modules/`, file yang klien tidak pernah ubah.
- Pekerjaan klien ada di `features/<milik-klien>/`.
- Yang boleh berbeda di tiap klien ada daftar tertutupnya, dan daftarnya pendek.

Dua kelompok file yang hampir tidak pernah bertemu bikin merge-nya sepele.

**`npm run arch:check` adalah harga yang harus kita bayar untuk keputusan ini.** Alat itulah yang menjaga batasnya tetap nyata. Kalau batasnya bocor, cara perpindahan kodenya rusak, ini bukan soal kerapian.

### File yang wajar berbeda di tiap klien

Daftar tertutup. Sisanya milik Aika.

| File | Kenapa |
|---|---|
| `README.md` | Halaman depan milik klien sendiri. Aika tidak mengubahnya |
| `app/pages/*`, `app/layouts/*`, `app/app.vue` | UI dan brand klien |
| `shared/http/app.ts` | Baris mount fitur tiap klien |
| `features/<fitur-milik-klien>/**` | Semua pekerjaan custom |
| `database/migrations/*` | Hanya menambah file baru |
| `.env`, `ecosystem.config.cjs` | Nama proses dan rahasia |

Untuk semua file lain: kalau kamu perlu mengubahnya demi satu klien, **ubah dulu di Aika**, baru tarik ke klien. Kalau perubahannya memang tidak pantas ada di Aika, kemungkinan besar tempatnya salah.

## Keputusan yang sudah dicatat

| Keputusan | Alasan singkat |
|---|---|
| TypeScript di batang, JS bebas di daun | Biaya sesungguhnya ada di integrasi upstream ke klien. Tipe mengubah "500 di halaman yang jarang dibuka" jadi "build gagal". |
| Dua batas per fitur | `index.ts` menjangkau `better-sqlite3`, `web/index.ts` tidak. Sistem tipe dan aturan R6 yang menjaga bedanya. |
| Tanpa ORM, SQL mentah | Tipe datang dari Zod di `contract.ts`, bukan dari ORM. Lebih sedikit bagian yang bergerak, lebih sedikit yang harus dipelajari. |
| `PORT` di luar schema env | Satu fakta, satu acuan. Socket-nya milik Nitro. |
| `allowScripts` di-pin ke versi persis | npm 11 membuat install script harus disetujui. Pin-nya bagian dari higienitas supply chain, dan disetujui ulang tiap upgrade. |
| Tanpa monorepo, tanpa pnpm | Lihat bagian cara kode ini berpindah. |
| Satu proses Node | Lihat "Kenapa Hono di dalam Nitro". |
| Migrasi forward-only | Down migration di SQL jarang ditulis dengan benar, dan lebih sering berbohong. |
| Dokumen Inggris sebagai default, Indonesia sebagai pendamping | Inggris bahasa default ekosistemnya; Indonesia bahasa baca tim. |

## Yang tidak kita bangun

Daftar ini sama pentingnya dengan daftar isi. Kalau ada ide masuk ke sini, jawabannya tidak, kecuali alasannya sangat kuat.

Tidak ada: runtime buatan sendiri, framework HTTP, ORM, framework auth, container DI, sistem RPC, compiler, bahasa baru, tool build, **tool monorepo**, konfigurator multi-stack, atau wrapper AI.

Aika mengatur dan menjaga batas aplikasi. Urusan stack diserahkan ke ekosistem.

## Filter desain

Sebelum menambah apa pun ke Aika, lewati tiga pertanyaan ini:

1. **Apakah ini memperkuat batas antara Aika dan klien?** Kalau tidak, kemungkinan besar itu kode klien.
2. **Bisakah tool yang sudah ada menyelesaikannya?** Kalau bisa, pakai tool itu langsung, jangan dibikin wrapper sendiri.
3. **Bisakah ini disimpulkan dari kode dan konvensi?** Kalau bisa, simpulkan saja, jangan tambah metadata yang bisa jadi tidak sinkron.
