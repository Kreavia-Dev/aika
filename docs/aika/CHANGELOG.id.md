# Changelog

[English](./CHANGELOG.md) · **Bahasa Indonesia**

Semua perubahan penting pada Aika dicatat di file ini.

Formatnya mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [CHANGELOG.md](./CHANGELOG.md) yang jadi acuan.

## Cara menulis entri

Pembaca changelog ini adalah **orang yang memelihara project klien**, bukan orang yang menulis Aika. Jadi tulis untuk mereka.

- **Tulis dampaknya, bukan diff-nya.** "Route `/api/users` sekarang butuh sesi", bukan "mengubah middleware di features/users/server/routes.ts".
- **Setiap entri yang mengubah perilaku harus bisa menjawab:** apakah project klien perlu melakukan sesuatu? Kalau ya, tautkan ke bagiannya di [docs/UPGRADING.id.md](./UPGRADING.id.md).
- **Kategori:** `Ditambahkan`, `Diubah`, `Usang`, `Dihapus`, `Diperbaiki`, `Keamanan`.
- Bagian `Belum Dirilis` selalu ada di paling atas.

Aturan versinya: perubahan yang memaksa project klien mengedit kode atau konfigurasi itu **major**, walaupun tidak ada yang gagal dikompilasi.

## [Belum Dirilis]

### Ditambahkan

- **`shared/http/envelope.ts`**: envelope kegagalan sebagai schema Zod, jadi aturan envelope di AGENTS.md bisa diperiksa, bukan sekadar harapan. Envelope sukses tetap per fitur, karena `data`-nya milik fitur yang mengembalikannya.
- **Tailwind CSS v4**, lewat `@tailwindcss/vite`, bukan modul Nuxt. `app/assets/css/palette.css` menyimpan token untuk kedua tema, dan `main.css` memetakannya ke theme Tailwind, jadi komponen memakai `bg-card` dan `text-muted-foreground`, bukan nilai hex.
- **Deklarasi `@source` untuk `app/` dan `features/`.** Tailwind v4 mendeteksi source secara otomatis, tapi `features/` itu saudara `app/`, bukan anaknya, jadi mengandalkan heuristiknya adalah mode kegagalan yang senyap. Terverifikasi: class yang hanya dipakai `features/health/web/pages/index.vue` benar-benar muncul di CSS hasil build.
- **Test suite.** `vitest` 5, jalan di environment `node` tanpa build Nuxt dan tanpa server HTTP. 23 test di 2 file, kurang dari satu detik. `npm run check` sekarang menjalankannya.
- **`shared/nuxt/feature-pages.ts`**, plus 12 test unit untuknya. Perhitungan route-nya dipindah keluar dari modul Nuxt supaya bisa dites tanpa menyalakan Nuxt. Test-nya membuat pohon fitur sementara, lalu memeriksa path route yang dihasilkan.
- **`features/health/web/pages/index.vue`**, disajikan di `/health`. Halaman ini sekaligus halaman status yang berguna dan bukti bahwa halaman fitur bekerja.
- **`ROADMAP.md` dan `ROADMAP.id.md`.** Satu-satunya tempat yang menjawab apa yang mau dibangun berikutnya dan kenapa. Disiplinnya: yang sudah selesai keluar sepenuhnya dari roadmap dan pindah ke file ini, jadi keduanya tidak pernah tumpang tindih.
- **`npm run prose:check`**, ikut jalan di `npm run check`. Dia menolak em dash dan en dash di mana pun dalam repo, di kedua bahasa dan di komentar kode. Pakai koma, titik dua, titik, atau tanda kurung. Tanda hubung biasa tetap boleh di dalam kata dan rentang seperti `R1-R6`.

- **`docs/aika/BUILDING.id.md`**: cara menambah fitur dari awal sampai jalan, memakai fitur `health` sebagai contoh nyata. Semua potongan kodenya kode asli, dan sekarang ini dokumen yang dibaca pertama.

- **Fitur `auth`.** Masuk, keluar, dan sesi. Password di-hash dengan scrypt dari `node:crypto`, jadi tidak ada dependency baru. Sesi disimpan di SQLite dan hanya SHA-256 dari tokennya yang ditulis, jadi database yang bocor tidak menyerahkan sesi yang masih hidup. Cookie-nya `httpOnly` dan `sameSite=Lax`. 24 test baru.
- **`app/middleware/auth.ts`**, jadi halaman mana pun bisa mewajibkan sesi dengan `definePageMeta({ middleware: 'auth' })`.
- **`npm run user:create`**, untuk membuat user pertama. Tidak ada halaman pendaftaran, dan itu disengaja: situs klien punya beberapa akun staf, bukan pendaftaran terbuka.
- **`shared/database/migrate.ts`**: logika migrasinya, dipindah keluar dari skrip supaya setup test menjalankan kode yang persis sama dengan yang dijalankan saat deploy.

- **Kerangka situs yang jalan.** `app/layouts/default.vue`, `app/components/SiteHeader.vue` dan `SiteFooter.vue`, plus tiga halaman sungguhan: Home, About, dan Contact. Sebelumnya `npm run dev` cuma menghasilkan panel status dan tidak ada apa pun yang menyerupai situs, sehingga cara pakai Aika memang sulit dilihat.
- **`app/site.ts`**, satu-satunya file yang diedit saat memulai project klien: nama situs, tagline, navigasi, detail kontak, dan bahasa dokumen. `nuxt.config.ts` juga membaca nama dan bahasanya dari situ, jadi rebranding cukup satu file.

- **Fitur `contact` dan form rujukannya.** Tabel `contact_messages`, `POST /api/contact` dengan validasi Zod, honeypot yang membuang bot bodoh sambil menjawab seolah berhasil, dan form di `/contact`. 15 test. Ini rung yang memperlihatkan seluruh tumpukan sekaligus: migrasi, contract, route, validasi, envelope, dan form yang menampilkan pesan error dari server.
- **`shared/http/error-message.ts`**, supaya form login dan form kontak mengubah error fetch jadi pesan yang bisa dibaca di satu tempat, bukan dua.

- **Inbox staf di `/contact/messages`, di belakang sesi.** `GET /api/contact/messages` mengembalikan seratus kiriman terbaru, terbaru dulu, dan halamannya menampilkannya dengan petunjuk triase kalau user agent-nya tampak otomatis. Lima test, termasuk yang membuktikan pesan yang dibuang honeypot tidak pernah muncul di daftar, dan yang membuktikan batas seratusnya berlaku.

### Diubah

- **`arch:check` dapat dua aturan, dan keduanya dibuktikan dengan sengaja dirusak.** R7 menolak kombinasi saat `app/layouts/` ada tapi `app/app.vue` tidak membungkus `NuxtPage` dengan `NuxtLayout`: bug yang membuat semua layout diam-diam tidak bekerja. R8 menolak direktori top-level yang tidak ada di peta di `docs/aika/README.id.md`, dan menolak entri peta yang direktorynya tidak ada. README jadi sumber kebenarannya dengan sengaja, supaya tidak ada daftar kedua yang bisa terlupa.
- **Inbox staf tinggal di `/contact/messages`, bukan `/admin/messages`.** Halaman fitur selalu dipasang di bawah nama fiturnya sendiri, dan itulah yang mencegah dua fitur sama-sama mengklaim `/admin`. Area admin bersama itu pertanyaan Fase 2.
- **Aturan soal di mana sebuah layar tinggal sekarang tertulis.** `features/contact/` murni potongan backend dan `app/components/ContactForm.vue` milik klien. Garis pemisahnya bukan frontend versus backend, melainkan apa yang semua klien pakai bersama versus apa yang cuma klien ini punya. `features/health` dan `features/auth` memang punya halaman sendiri, karena panel status dan form login itu peralatan, bukan branding. Lihat `docs/aika/ARCHITECTURE.id.md`.
- **Setup test mengosongkan setiap tabel yang ditemukannya**, bukan dua tabel yang dulu disebut namanya, jadi fitur baru tidak bisa membocorkan state ke run berikutnya karena terlupa.
- **Situs rujukannya sekarang berlabel Aika, bukan klien fiktif.** Sebelumnya tertulis "Meridian Studio" dengan teks ala agensi, yang membuat pembaca menebak apa yang sedang dilihatnya. Sekarang halamannya menyebut dirinya apa dan ke mana harus membaca selanjutnya, dan itu memang tugas sebuah contoh.
- **`app/components/AikaWatermark.vue`**, tanda kecil tetap di pojok setiap halaman, dikendalikan `site.watermark` di `app/site.ts`. Itu kredit agensi, bukan kredit klien, jadi sakelarnya terpisah dari nama situs: klien mengganti nama, studio yang memutuskan soal tandanya.
- **`app/app.vue` sekarang membungkus `<NuxtPage>` dengan `<NuxtLayout>`.** Sebelumnya tidak, sehingga `app/layouts/` tidak pernah dipakai dan `definePageMeta({ layout: ... })` diabaikan tanpa peringatan di mana pun. Ketemu saat membangun kerangka situs, dan ini akan menghabiskan setengah hari seseorang.
- **Halaman depan tidak lagi membuktikan rantai Nuxt ke SQLite.** Sekarang tugas itu milik `/health`, dan itu halaman yang dibuka kalau mau memastikan deployment tersambung benar. Halaman depan klien seharusnya bukan panel status.
- Halaman masuk keluar dari kerangka situs lewat `definePageMeta({ layout: false })`. Navbar di atas form login mengundang orang berkeliling alih-alih masuk. Endpoint `/api/health` tetap publik, karena pemantauan uptime tidak bisa login. Pembagian ini disengaja: satu permukaan untuk mesin, satu untuk manusia.
- `scripts/migrate.ts` sekarang cuma pembungkus CLI tipis di atas `shared/database/migrate.ts`, supaya urutan snapshot-dulu tetap di satu tempat.
- **Masa hidup sesi 30 hari**, mutlak bukan bergeser.
- **Jumlah test sekarang 47**, dari sebelumnya 23.
- **Dokumentasi dipindah ke `docs/aika/`.** `README.md` di root sekarang milik project klien, jadi klien bisa menjelaskan situsnya sendiri tanpa pernah berkonflik dengan perubahan dari upstream. Ini bug nyata: `README.md` tidak ada di daftar file yang boleh diedit klien, sehingga yang terjadi adalah repo klien yang halaman depannya menjelaskan Aika, bukan kliennya. `AGENTS.md` tetap di root karena tool agent mencarinya di situ, dan `LICENSE` tetap karena konvensi hukum. Semua tautan relatifnya ditulis ulang dan diperiksa.
- `README.md` di root sekarang jadi penunjuk singkat di repo Aika, dan jadi halaman depan milik klien di project klien. Ia sekarang masuk daftar file yang wajar berbeda di tiap klien.
- **Mekanisme halaman fitur sudah terbukti.** `modules/features.ts` termuat tanpa error sejak commit pertama tapi belum pernah dijalankan, karena belum ada fitur yang punya direktori `web/pages/`. Itu klaim arsitektur terakhir yang belum terbukti di proyek ini. Sekarang sudah dicakup test unit dan dikonfirmasi di build produksi: `GET /health` merender halaman fiturnya, dan `useHead` memasang judulnya.
- `npm run check` sekarang juga menjalankan test suite.
- **Aturan penulisan baru untuk semua dokumen dan komentar: tidak ada em dash dan en dash.** Karakter ini tidak terlihat saat review, jadi tidak ada yang sadar kalau ada yang menambahkannya. Karena itu aturannya ditegakkan skrip, bukan sekadar ditulis lalu dipercaya.
- **Dokumentasi Indonesia ditulis ulang supaya enak dibaca.** Versi sebelumnya diterjemahkan kata per kata, yang menghasilkan kalimat berat pasif dengan struktur kalimat Inggris. Menerjemahkan dokumen tidak sama dengan menulis dokumen.
- Dokumentasi sekarang dwibahasa. File Inggris jadi acuan, terjemahan Indonesia berdampingan sebagai `<nama>.id.md`. Keduanya diperbarui dalam perubahan yang sama.
- `npm run check` sekarang juga menjalankan `prose:check`.
- **Seluruh kode memakai Bahasa Inggris.** Identifier, komentar, nama test, dan blok kode di dalam dokumentasi Indonesia. Satu-satunya pengecualian adalah teks untuk pengguna di `app/` dan `features/<name>/web/`, dan `prose:check` sekarang menegakkan pembagian itu.
- **Aturan styling: hanya utility Tailwind dan token semantik.** Tidak ada blok `<style>` di komponen, dan tidak ada nilai hex mentah. Direktori top-level baru yang berisi komponen wajib dideklarasikan di `@source`, kalau tidak class-nya tidak akan pernah di-generate.

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
