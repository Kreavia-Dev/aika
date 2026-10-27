# Menarik update Aika ke project klien

[English](./UPGRADING.md) · **Bahasa Indonesia**

Dokumen ini berisi **prosedur**, bukan catatan rilis. Catatan rilisnya ada di [CHANGELOG.id.md](./CHANGELOG.id.md).

Kalau changelog menjawab *"apa yang berubah"*, dokumen ini menjawab *"apa yang harus saya lakukan"*.

> **Kenapa dokumen ini ada.** Aika berpindah lewat `git merge upstream/main`, bukan lewat version bump package. Tidak ada tool yang bisa memberi tahu project klien bahwa file yang mereka ubah perlu disesuaikan. Dokumen ini pengganti tool itu, dan karena itu dia dokumen paling bernilai di repo ini. Kalau kamu cuma sanggup memelihara satu dokumen dengan baik, pilih yang ini.
>
> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [UPGRADING.md](./UPGRADING.md) yang jadi acuan.

## Prosedur standar

```bash
cd client-name

# 1. Make sure nothing is uncommitted. Always.
git status                 # must be clean
git checkout -b upgrade/aika-<version>

# 2. See what is coming, BEFORE merging.
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD..upstream/main

# 3. Read the relevant version section in the CHANGELOG.
#    If there is an "action required" section, do it AFTER the merge.

# 4. Merge.
git merge upstream/main

# 5. Verify.
npm ci
npm run check
npm run db:backup
npm run db:migrate
npm run build
```

Kalau langkah 2 menunjukkan ada perubahan di file yang masuk daftar "wajar berbeda di tiap klien", berhenti dulu dan periksa manual sebelum merge.

## Rilis yang butuh tindakan

### ke 0.2.0 (belum dirilis): autentikasi

**Apa yang berubah.** Fitur `auth` yang baru menambahkan masuk, keluar, dan pengelolaan sesi. Semua route `/api/auth` bersifat tambahan, jadi tidak ada perilaku lama yang berubah.

**Ada dua hal yang wajib kamu kerjakan:**

1. Jalankan migrasinya. `0002_auth.sql` menambah tabel `users` dan `sessions`. Isinya cuma membuat tabel, jadi tidak mungkin bentrok dengan data yang sudah ada.

   ```bash
   npm run db:migrate
   ```

2. Buat user pertama. Tidak ada halaman pendaftaran, dan itu disengaja.

   ```bash
   npm run user:create -- --email=you@example.com
   ```

   Password-nya di-generate dan dicetak sekali. Simpan, karena belum ada alur ganti password.

**Yang juga terpengaruh:** halaman `/health` sekarang butuh sesi. Endpoint `/api/health` tetap publik, karena pemantauan uptime tidak bisa login. Kalau ada yang memantau `/health` sebagai halaman, bukan `/api/health`, ubah ke API-nya.

### ke 0.2.0 (belum dirilis): unggahan media

**Apa yang berubah.** Fitur `media` yang baru menambahkan endpoint unggah yang butuh login di `POST /api/media`, halaman pustaka di `/media`, dan rute publik yang menyajikan hasil unggahan di `/media/<nama-berkas>`. Tidak ada perilaku lama yang berubah.

**Tiga hal yang harus kamu lakukan:**

1. Setel `MEDIA_ROOT` di environment deployment. Itu tempat berkas unggahan ditulis, dan harus path absolut di luar direktori aplikasi.

   ```bash
   MEDIA_ROOT=/srv/aika/data/media
   ```

   **Kenapa ini penting.** Nilai bawaannya `./storage/media`, yang dihitung relatif terhadap direktori kerja. Kalau dibiarkan kosong di server, berkas unggahan mendarat di dalam direktori aplikasi, dan deploy berikutnya yang mengganti direktori itu akan menghapus gambar milik klien tanpa satu pun pesan error.

2. Jalankan migrasinya. `0005_media.sql` menambahkan tabel `media_files`. Ia hanya membuat tabel, jadi tidak bisa bertabrakan dengan data yang sudah ada.

   ```bash
   npm run db:migrate
   ```

3. Bangun artefaknya di sistem operasi dan arsitektur yang akan menjalankannya. Fitur ini menambahkan `sharp`, pustaka gambar native, jadi build yang dibuat di Windows tidak bisa jalan di Linux, dan sebaliknya.

   Ini aturan yang sama yang sudah dipaksakan `better-sqlite3`, dan perlu ditulis terang: build tidak portabel antar platform, dan kegagalannya berupa modul yang menolak dimuat, bukan sesuatu yang bisa dibaca.

**Perlu juga diketahui:** rute penyajiannya publik. Siapa pun yang memegang URL sebuah berkas bisa mengambilnya, dan itu bentuk yang wajar untuk gambar di situs publik, karena URL-nya memang yang ditempel ke konten. Yang tidak publik adalah mengunggah dan mendaftar.

## Format entri di dokumen ini

Setiap versi Aika yang butuh tindakan mendapat satu bagian seperti ini:

---

### ke 0.2.0 (contoh, belum nyata)

**Perlu tindakan.** Perkiraan waktu: 10 menit.

**Apa yang berubah**
`shared/config/env.ts` sekarang mewajibkan `APP_URL` berupa URL `https://` saat `NODE_ENV=production`. Sebelumnya nilai apa pun diterima.

**Yang harus dilakukan**

1. Pastikan environment di VPS punya `APP_URL` yang benar:
   ```
   APP_URL=https://client-name.example.id
   ```
2. Kalau file-nya ada di `/etc/aika/env`, ubah di sana juga.
3. Jalankan `npm run build` dan `pm2 reload aika`, lalu cek `GET /api/health`.

**Kenapa**
Lebih baik boot-nya gagal daripada situs jalan dengan URL relatif, cookie, canonical link, dan SEO rusak tanpa suara, dan tidak ada yang sadar sampai klien menelepon.

**Kalau dilewati**
Aplikasi **gagal boot** di VPS. Ini memang disengaja.

---

## Kalau merge-nya konflik

Konflik di Aika hampir selalu berarti salah satu dari dua hal.

**1. Kamu mengubah file framework.** Kamu mengedit sesuatu di `shared/`, `server/`, atau `modules/`. Perbaikan yang benar: kalau perubahannya berguna untuk semua klien, kembalikan dulu ke Aika, baru tarik ke bawah. Kalau cuma untuk klien ini, pindahkan ke `features/<milik-klien>/` supaya tidak bertabrakan lagi.

**2. Kamu mengubah file yang memang wajar berbeda.** Ini normal, dan konfliknya dangkal, biasanya `app/pages/*` atau satu baris mount di `shared/http/app.ts`. Selesaikan manual: pertahankan versi klien untuk UI, versi Aika untuk sisanya.

**Yang bukan alasan sah:** mematikan `npm run arch:check`, atau menghapus fitur supaya konfliknya hilang. Kalau itu sampai terasa perlu, batasnya sudah rusak dan masalahnya lebih besar dari satu merge.

## Memeriksa kesehatan batas

Setelah merge, di repo klien:

```bash
npm run arch:check
```

Kalau ada pelanggaran setelah merge, kemungkinan Aika mengirim sesuatu yang melanggar aturannya sendiri, atau ada deep import yang sebelumnya lolos. Perbaiki sebelum lanjut. Jangan dimatikan.

## Jadwalnya

Tidak ada SLA formal, tapi aturannya: **semua project klien yang masih aktif ditarik ke Aika terbaru dalam 30 hari setelah rilis.** Tanpa itu, versinya melenceng dan bug yang sudah diperbaiki tetap terkirim. Kalau kliennya banyak, tarik semuanya dalam satu sesi, lebih murah daripada mengerjakan satu per satu dengan jeda berbulan-bulan, karena selisihnya tetap kecil.
