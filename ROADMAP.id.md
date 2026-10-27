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

Satu fitur (`health`). Fondasinya sudah kokoh dan terbukti: batas ditegakkan, migrasi menulis snapshot lebih dulu, backup diambil saat aplikasi jalan, satu proses.

**Belum ada satu pun hal yang mau dibayar klien.** Itu wajar di tahap ini, tapi jangan disebut sebagai apa pun selain itu.

## Keputusan yang masih terbuka

Ini memblokir satu fase penuh. Putuskan sebelum fasenya dimulai, bukan saat sudah jalan.

| Keputusan | Memblokir | Kenapa masih terbuka |
|---|---|---|
| **CMS: bangun sendiri yang ringkas, atau adopsi Directus atau Payload?** | Seluruh Fase 2 | Membangun 80% WordPress yang benar-benar dipakai klien butuh sekitar 10 sampai 14 minggu untuk satu orang. Kalau mengadopsi, berarti ada framework kedua di stack yang sudah punya Nuxt, dan schemanya mungkin tidak bisa di-diff di git, yang justru melawan cara perpindahan kode kita. |
| **Seberapa banyak admin UI yang bisa di-generate dari schema?** | Fase 2 | Kalau content model dideklarasikan sebagai data, maka layar CRUD admin, field SEO, dan endpoint content API bisa di-generate, bukan ditulis satu per satu. Ini investasi dengan hasil paling besar yang tersedia untuk Aika. |

## Fase 0: buat semuanya bisa diverifikasi

Yang setelah ini tidak bisa dipercaya sebelum fase ini ada.

- [ ] **Test runner.** `npm run check` saat ini memverifikasi tipe dan batas, dan nol perilaku.
- [ ] **Buktikan mekanisme halaman fitur.** `modules/features.ts` termuat tanpa error, tapi belum pernah benar-benar dijalankan karena belum ada fitur yang punya direktori `web/pages/`. Ini satu-satunya klaim arsitektur yang belum terbukti di proyek ini.

## Fase 1: kebutuhan minimum satu situs klien

- [ ] `auth`: sesi, login, peran. Sekaligus menguji kedua batas pada skala nyata.
- [ ] Layout dan navigasi sungguhan. `app/pages/index.vue` itu halaman contoh, bukan situs.
- [ ] **SEO**: meta tag, canonical URL, `sitemap.xml`, `robots.txt`, Open Graph. Aika menjual situs, jadi ini bukan opsional, dan sekarang belum ada sama sekali.
- [ ] Halaman error 404 dan 500 yang bukan bawaan Nuxt.
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
- [ ] Form kontak dan kiriman sejenisnya.

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
