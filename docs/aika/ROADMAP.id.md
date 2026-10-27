# Roadmap

[English](./ROADMAP.md) · **Bahasa Indonesia**

## Dokumen ini untuk apa

Di sinilah satu-satunya tempat yang menjawab "apa yang mau kita bangun berikutnya, dan kenapa".

Sengaja bukan tiga hal ini:

- **Bukan changelog.** Yang sudah selesai keluar dari file ini dan pindah ke [CHANGELOG.id.md](./CHANGELOG.id.md). Tidak ada yang dicentang lalu dibiarkan menumpuk.
- **Bukan dokumen arsitektur.** [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) yang menjelaskan bagaimana Aika dibangun.
- **Bukan daftar keinginan.** Semua yang ada di sini bisa dilacak balik ke kebutuhan mengirim satu situs klien sungguhan.

**Satu disiplin yang menjaga file ini tetap jujur:** begitu sesuatu selesai, hapus dari sini. Roadmap yang menumpuk item selesai lama-lama jadi roadmap yang tidak dibaca siapa pun. Kalau file ini tumbuh lebih dari kira-kira satu halaman, berarti sudah tidak berfungsi.

## Posisi Aika sekarang

Tiga fitur (`auth`, `contact`, `health`). Fondasinya terbukti, bukan diasumsikan: batas ditegakkan skrip, migrasi menulis snapshot sebelum menyentuh apa pun, backup diambil saat aplikasi jalan, satu proses, suite test yang wajib hijau sebelum apa pun di-merge, dan routing milik fitur, alur login, serta form kontak semuanya sudah terbukti di build produksi.

Clone sekarang menghasilkan situs kecil yang jalan: header, footer, tiga halaman, form yang menyimpan pesan, dan inbox staf di belakang sesi. Situs itu sekaligus contohnya, jadi ia merangkap tutorial untuk siapa pun yang baru mengenal Aika.

**Belum ada project klien yang dimulai, dan pengerjaannya datang secara bergelombang.** Ini perlu diucapkan terus terang, karena inilah yang menentukan apa yang layak dibangun. Ketika project ini diambil lagi setelah jeda, yang penting adalah ia masih masuk akal saat dibuka: karena itu ada test, aturan menghapus item yang sudah selesai dari file ini, dan situsnya sendiri yang merangkap contoh.

**Belum ada satu pun hal yang mau dibayar klien.** Itu wajar di tahap ini, tapi jangan disebut sebagai apa pun selain itu.

## Keputusan yang masih terbuka

Ini memblokir satu fase penuh. Putuskan sebelum fasenya dimulai, bukan saat sudah jalan.

| Keputusan | Memblokir | Kenapa masih terbuka |
|---|---|---|
| **CMS: bangun sendiri yang ringkas, atau adopsi Directus atau Payload?** | Seluruh Fase 2 | Membangun 80% WordPress yang benar-benar dipakai klien butuh sekitar 10 sampai 14 minggu untuk satu orang. Kalau mengadopsi, berarti ada framework kedua di stack yang sudah punya Nuxt, dan schemanya mungkin tidak bisa di-diff di git, yang justru melawan cara perpindahan kode kita. |
| **Seberapa banyak admin UI yang bisa di-generate dari schema?** | Fase 2 | Kalau content model dideklarasikan sebagai data, maka layar CRUD admin, field SEO, dan endpoint content API bisa di-generate, bukan ditulis satu per satu. Ini investasi dengan hasil paling besar yang tersedia untuk Aika. |

Sudah diputuskan: project klien mempelajari konvensinya dari
`docs/aika/BUILDING.id.md`, yang memandu menambah fitur memakai fitur `health`
sebagai contoh nyata. Dokumentasi Aika dipindah ke `docs/aika/` supaya
`README.md` milik klien bisa tinggal di root tanpa pernah berkonflik.

## Fase 1: kebutuhan minimum satu situs klien

- [ ] **Tegakkan `role`.** `users.role` ada tapi tidak ada yang membacanya, jadi setiap user yang login sekarang efektif sebagai administrator.
- [ ] `media`: upload, kontrak storage dengan adapter lokal, dan resize gambar.

## Fase 2: bagian yang mirip WordPress

Diblokir keputusan yang masih terbuka di atas.

- [ ] Registry content model: collection dan field dideklarasikan sebagai data.
- [ ] CRUD admin yang di-generate dari registry itu.
- [ ] `blog` sebagai content type sungguhan pertama, sekaligus pembuktian polanya.
- [ ] Status draft dan published.
- [ ] Rich text atau konten berbasis block.

## Fase 3: pengerasan produksi

- [ ] Logging terstruktur. Sekarang satu-satunya logging cuma satu panggilan `console.error`.
- [ ] Security header, CSRF, rate limiting, dan batas ukuran body request.
- [ ] Rate limiting khusus untuk endpoint auth.
- [ ] Script deploy per klien, dengan gerbang health check dan rollback.
- [ ] **Restore backup diuji di CI.** Backup yang belum pernah di-restore bukan backup.
- [ ] Error tracking.

## Fase 4: hanya kalau klien membayarnya

- [ ] Server-sent events untuk update langsung.
- [ ] Konten multi-bahasa.
- [ ] **Beri tahu seseorang saat form kontak dikirim, dan sediakan inbox untuk membacanya.** `features/contact/` sekarang menyimpan kiriman, tapi tidak ada yang diberi tahu dan tidak ada layar untuk membacanya, jadi pesannya duduk di tabel sampai ada yang membuka database secara manual.

## Yang sengaja tidak masuk roadmap

Dicatat supaya tidak ada yang membukanya lagi tanpa alasan. Silang-cek [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) bagian "Yang tidak kita bangun".

- Page builder visual. Itu item terbesar di setiap pembangunan CMS, dan paling jarang dipakai klien kecil.
- Multi-tenant dalam satu database. Tiap klien dapat VPS sendiri dan file database sendiri.
- Sistem plugin. Fitur dipasang dengan menarik source.
- Framework frontend kedua.

## Cara mengubah file ini

Naikkan sebuah item hanya dengan alasan yang terikat ke klien. Kalau ada klien butuh sesuatu yang tidak ada di sini, itu alasan yang sah untuk menambahkannya, dan sebaiknya ia menggantikan sesuatu, bukan sekadar ditambahkan di bawah.

## Kenapa file ini ada, dan bukan dokumen daftar fitur

Katalog fitur terpisah, yang memetakan klien mana punya fitur mana, belum layak dipelihara sekarang. Dengan satu fitur dan nol klien, katalog itu langsung membusuk.

Buat nanti saat project klien ketiga mulai. Sampai itu, roadmap ini ditambah changelog sudah cukup untuk melihat posisi kita.
