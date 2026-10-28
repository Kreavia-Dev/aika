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

- **`npm run user:password -- --email=<alamat>`, jadi password yang terlupakan bisa dipulihkan.** Sebelumnya satu-satunya jalan masuk ke deployment yang administratornya lupa password adalah membuat administrator lain dan meninggalkan akun lamanya, dan tidak ada perintah hapus user, jadi akun yang ditinggalkan itu tetap ada selamanya. Perintah ini membuat password, mencetaknya sekali, dan mengakhiri semua sesi akun itu, karena reset yang meninggalkan browser yang sudah login tidak mereset apa pun. Ia menolak `--password` dengan sengaja: password di baris perintah tertinggal di riwayat shell dan di daftar proses. **Butuh tindakan: tidak ada**, tapi ada baiknya dicoba sekali di akun percobaan sebelum benar-benar perlu. Lihat [docs/UPGRADING.id.md](./UPGRADING.id.md).
- **`generatePassword`, di fitur auth, bukan di dalam script.** `user:create` dan `user:password` sama-sama butuh satu, dan salinan kedua berarti keputusan kekuatan kedua yang hanya salah satunya diperbaiki nanti.

- **Layar staf sekarang dipagari peran, dan pustaka media menyebut siapa yang boleh menyentuhnya.** `editor` boleh mengunggah, mendaftar, dan menghapus media, karena memproduksi konten memang pekerjaannya. `editor` tidak boleh membaca inbox staf, karena pertanyaan pengunjung adalah data pribadi orang yang tidak pernah setuju masuk database, dan itu administrasi, bukan kerja konten. `editor` yang membuka halaman inbox diarahkan pulang, bukan diberi layar rusak. `admin` boleh semuanya. **Butuh tindakan: tidak ada**, tapi akun yang dibuat sebagai `editor` sekarang benar-benar berperilaku seperti itu. Lihat [docs/UPGRADING.id.md](./UPGRADING.id.md).
- **`requireAtLeast(c, role)` dan `atLeast(role)`, di samping penjaga pencocokan persis yang sudah ada.** Cara "jelas" untuk memagari pustaka media adalah `requireRole(c, 'editor')`, dan itu salah: pencocokan persis menolak administrator, terbalik dari yang diharapkan operator. `requireAtLeast` menyatakan maksudnya, dan menambah peran ketiga nanti akan menggagalkan gate sampai ada yang menuliskan posisinya.
- **`carriesAtLeast`, di `features/auth/contract.ts`.** Urutan peran harus pindah keluar dari penjaga server, karena browser perlu sampai ke jawaban yang sama saat memutuskan apakah menampilkan sebuah halaman. Satu fungsi, dua pintu, jadi halaman dan API tidak bisa berbeda pendapat soal siapa yang boleh masuk.

### Diubah

- **Test yang membaca source dihapus dan diganti test sungguhan.** Pagar browser dulu "dibuktikan" dengan memastikan file middleware memuat string tertentu, dan test itu tetap lulus walaupun perbandingan perannya dihapus. Keputusannya sekarang fungsi murni dengan empat test yang gagal di dua arah, dan redirect-nya sendiri sudah diperiksa terhadap artefak hasil build, bukan diasumsikan. Test yang tidak bisa gagal untuk hal yang disebutnya lebih buruk daripada tidak ada test, karena ia terbaca sebagai bukti.


- **Penegakan peran, dan butir Fase 1 terakhir yang selesai.** `users.role` dulu ada dan tidak ada yang membacanya, jadi setiap user yang login adalah administrator, apa pun isi tabelnya. Sekarang ditegakkan. `requireRole(c, 'admin')` membuka handler yang khusus administrator, `roleGuard('admin')` menjaga satu grup route, dan `editor` yang sudah login mendapat 403, bukan halamannya. Pesan penolakannya sama untuk semua pasangan peran, jadi tidak menjelaskan apa yang kurang dari pemanggilnya. Peran dibaca dari baris user pada setiap request, karena sesi tidak menyimpan peran, jadi promosi dan demosi berlaku di request berikutnya lewat jalur kode yang sama di kedua arah. **Butuh tindakan: tidak ada, tapi semua orang masih administrator, jadi sekarang saatnya memutuskan siapa yang seharusnya tidak.** Lihat [docs/UPGRADING.id.md](./UPGRADING.id.md).
- **`GET /api/auth/users`, khusus administrator.** Route pertama di balik penjaga baru, sekaligus sambungan yang membuat penegakan peran bisa diamati, bukan diasumsikan. Ia mendaftar akun. Ini bukan layar manajemen user, dan tetap belum ada route untuk membuat, menonaktifkan, atau mengubah akun lain.
- **`npm run user:role -- --email=<alamat> --role=admin|editor`.** Memindahkan akun yang sudah ada di antara dua peran, dan melaporkan apa yang berubah serta artinya bagi orang itu.
- **Administrator aktif terakhir dilindungi.** `disableAccount` dan `changeRole` menolak perubahan yang akan menghabiskan semuanya, dengan `ConflictError` yang menyebut perintah pemulihannya. `editor` tidak dihitung sebagai penutup: deployment yang administratornya hilang tidak bisa menjangkau route khusus administrator mana pun, dan satu-satunya jalan balik adalah shell. Alasannya sama dengan penjaga akun aktif terakhir di sebelahnya, satu tingkat lebih dalam.

### Diubah

- **Suite test `role`, dan tiga test lama yang dibuat jujur.** Test peran diuji mutasi, bukan dipercaya: diperiksa harus merah saat penjaganya dihapus dan lagi saat penjaganya salah satu angka, dan versi pertamanya tidak melakukan keduanya dengan andal. Dalam prosesnya, mengacak urutan test menemukan dua cacat yang tidak ada hubungannya dengan peran dan sudah ada sebelum perubahan ini: test burst sign in bergantung pada test lain yang membuat akunnya, dan test inbox staf membandingkan dengan baris yang oleh test sebelahnya diberi tanggal 2030. Keduanya diperbaiki dengan membuat test membawa premisnya sendiri.
- **`AGENTS.md`, `ARCHITECTURE.md`, dan `SECURITY.md` sekarang menjelaskan peran yang ditegakkan**, bukan lagi menyebut kolom peran itu hiasan. Aturan yang paling banyak dibaca di repositori ini justru yang sudah tidak benar.


- **Fitur `media`.** Staf mengunggah gambar di `/media`, lalu Aika menyimpannya, mencatatnya, dan menyajikannya kembali di `/media/<nama-berkas>`. URL itulah yang ditempel ke konten. Gambar yang tepi terpanjangnya lebih dari 1920 piksel diperkecil dulu sebelum disimpan, jadi foto ponsel tidak mendarat di halaman depan klien dalam ukuran penuh, dan gambar yang sudah cukup kecil disimpan apa adanya tanpa dikodekan ulang. Isi berkasnya diperiksa benar-benar gambar, bukan dipercaya dari kata browser, nama berkasnya dibuat sendiri, dan SVG ditolak dengan sengaja: itu dokumen yang bisa membawa script, dan kalau disajikan dari origin-mu sendiri, script-nya berjalan di origin-mu sendiri. Berkas juga bisa dihapus, dan itu menghapus catatannya sekaligus isinya. **Butuh tindakan:** deployment harus menyetel `MEDIA_ROOT`, kalau tidak berkas unggahan mendarat di dalam direktori aplikasi, tempat deploy berikutnya bisa menghapusnya, dan `sharp` adalah dependency native, jadi artefaknya harus dibangun untuk platform yang akan menjalankannya. Lihat [docs/UPGRADING.id.md](./UPGRADING.id.md).

- **CI, di `.github/workflows/check.yml`.** Ia menjalankan gate, build, migrasi database yang baru, lalu menyalakan server hasil build dan menanyainya: bahwa `/api/health` melaporkan database hidup, bahwa halaman depan merender header, dan bahwa `/contact/messages` masih mengalihkan pengunjung yang belum masuk. Build yang menghasilkan sesuatu yang tidak bisa menyajikan halaman itu bukan build yang lulus. Ini lebih penting dari biasanya karena Aika dikerjakan bergelombang, dan kegagalan yang menyakitkan adalah project yang diam-diam berhenti bekerja saat didiamkan.
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

- **Password bisa diganti, dan akun bisa dicabut.** `features/auth/web/pages/password.vue` menyajikan `/auth/password`, `auth` menyajikan `POST /api/auth/password`, dan `scripts/manage-users.ts` menambah `user:list`, `user:disable`, dan `user:enable`. Pencabutan jadi perintah shell, bukan layar web, karena yang menjalankan deployment sudah punya shell, dan rute web akan membuat user mana pun yang login bisa mengunci user lain, sementara semua akun sekarang administrator.
- **Mengganti password mengakhiri semua sesi lain.** Sesi yang hidup lebih lama dari perubahan password menghapus alasan menggantinya, jadi `changePassword` menghapus semua sesi user itu kecuali yang memintanya. Responsnya menyebut berapa yang diakhiri, karena angka di atas nol itu perlu diperhatikan.
- **Menonaktifkan akun berlaku seketika, dan tidak bisa mengunci semua orang.** Timestamp dan penghapusan sesi terjadi bersamaan: salah satu saja bukan pencabutan. Menonaktifkan akun aktif terakhir ditolak, karena mengunci semua orang keluar dari deployment klien itu cukup buruk untuk pantas dijaga satu aturan, dan penolakannya bisa dipulihkan dari shell yang sama.
- **`createUser` menolak password di bawah dua belas karakter**, jadi `--password=short` bukan cara mengelak dari aturan yang harus dipatuhi form web.
- **`resolveSessionDetail` menggantikan `resolveSession` di dalam.** Ia mengembalikan id sesi bersama user-nya, karena mengganti password harus mengakhiri semua sesi lain dan menyisakan yang ini. `resolveSession` tetap berbentuk sama dan sekarang mendelegasikan.

- **SEO, dari satu composable.** `app/composables/usePageSeo.ts` memancarkan description, pasangan Open Graph, kartu Twitter, dan URL canonical dari judul dan deskripsi yang benar-benar dimiliki halamannya. `app/pages/*` memakainya. Ia sengaja tidak mengarang deskripsi: tag itulah yang menentukan hasil pencarian diklik atau tidak, dan satu deskripsi yang diulang di semua halaman lebih buruk daripada deskripsi yang dipikirkan di halaman yang punya.
- **`/robots.txt` dan `/sitemap.xml`, sebagai rute Nitro.** Hono dijangkau lewat tepat satu adapter dan memiliki `/api`, dan dokumen XML bukan respons API, jadi keduanya milik Nitro. Isinya dibuat `shared/seo/site-files.ts`, yang murni dan ada test unitnya, dan smoke test CI memastikan rutenya benar-benar resolve.
- **Halaman 404 dan 500 yang bukan bawaan Nuxt.** `app/error.vue` mempertahankan kerangka situs lewat layout, memberi jalan keluar, menjaga dirinya keluar dari hasil pencarian, dan hanya menampilkan pesan aslinya di development, karena di situs yang hidup pesan itu hadiah untuk siapa pun yang sedang menyelidiki. Browser mendapat HTML dan klien yang tidak minta HTML mendapat JSON, dan itu Nitro menegosiasikan konten dengan benar; baik filenya maupun job CI menyebutkan itu, karena butuh satu diagnosa untuk mengetahuinya.
- **`site.url` dan `site.socialImage`, keduanya kosong secara bawaan.** Kosong itu keadaan yang aman, bukan yang belum selesai: canonical yang mengarah ke placeholder memberi tahu mesin pencari bahwa halaman aslinya ada di tempat lain, dan sitemap berisi URL example.com meminta mereka mengindeks domain orang lain. Selama `url` kosong, halaman tidak memancarkan canonical maupun URL Open Graph, dan `/sitemap.xml` berupa urlset valid tapi kosong. Mengisi satu field menyalakan semuanya.

### Diubah

- **Semua layar staf sekarang menyatakan dirinya sebagai perkakas, dengan `noindex, nofollow`.** Halaman status, form login, form ganti password, daftar pesan masuk klien, dan halaman error itu sendiri bukan konten, dan tidak satu pun pantas muncul di hasil pencarian. `robots.txt` tidak bisa melakukan ini: `Disallow` hanya meminta crawler tidak mengambil sebuah path, dan halaman bisa terindeks dari tautan tanpa pernah diambil.
- **`arch:check` dapat dua aturan, dan keduanya dibuktikan dengan sengaja dirusak.** R7 menolak kombinasi saat `app/layouts/` ada tapi `app/app.vue` tidak membungkus `NuxtPage` dengan `NuxtLayout`: bug yang membuat semua layout diam-diam tidak bekerja. R8 menolak direktori top-level yang tidak ada di peta di `docs/aika/README.id.md`, dan menolak entri peta yang direktorynya tidak ada. README jadi sumber kebenarannya dengan sengaja, supaya tidak ada daftar kedua yang bisa terlupa. Mendokumentasikan `.github/` membuka titik buta di R8: pengecekan arah sebaliknya hanya melihat direktori non-titik, jadi ia akan menyebut entri itu bohong tentang direktori yang jelas ada. Sekarang kedua arah diperiksa terhadap daftar lengkap.
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
