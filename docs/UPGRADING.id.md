# Menarik update Aika ke project klien

[English](./UPGRADING.md) · **Bahasa Indonesia**

Dokumen ini berisi **prosedur**, bukan catatan rilis. Catatan rilisnya ada di [CHANGELOG.id.md](../CHANGELOG.id.md).

Kalau changelog menjawab *"apa yang berubah"*, dokumen ini menjawab *"apa yang harus saya lakukan"*.

> **Kenapa dokumen ini ada.** Aika berpindah lewat `git merge upstream/main`, bukan lewat version bump package. Tidak ada tool yang bisa memberi tahu project klien bahwa file yang mereka ubah perlu disesuaikan. Dokumen ini pengganti tool itu, dan karena itu dia dokumen paling bernilai di repo ini. Kalau kamu cuma sanggup memelihara satu dokumen dengan baik, pilih yang ini.
>
> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [UPGRADING.md](./UPGRADING.md) yang jadi acuan.

## Prosedur standar

```bash
cd nama-klien

# 1. Pastikan tidak ada kerjaan yang belum di-commit. Selalu.
git status                 # harus bersih
git checkout -b upgrade/aika-<versi>

# 2. Lihat apa yang akan masuk, SEBELUM merge.
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD..upstream/main

# 3. Baca bagian versi terkait di CHANGELOG.
#    Kalau ada bagian "perlu tindakan", kerjakan SETELAH merge, bukan sebelumnya.

# 4. Merge.
git merge upstream/main

# 5. Verifikasi.
npm ci
npm run check
npm run db:backup
npm run db:migrate
npm run build
```

Kalau langkah 2 menunjukkan ada perubahan di file yang masuk daftar "wajar berbeda di tiap klien", berhenti dulu dan periksa manual sebelum merge.

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
   APP_URL=https://nama-klien.example.id
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
