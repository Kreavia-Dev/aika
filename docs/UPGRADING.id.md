# Menarik update Aika ke project klien

[English](./UPGRADING.md) · **Bahasa Indonesia**

Dokumen ini adalah **prosedur**, bukan catatan rilis. Catatan rilis ada di [CHANGELOG.id.md](../CHANGELOG.id.md).

Kalau changelog menjawab *"apa yang berubah"*, dokumen ini menjawab *"apa yang harus saya lakukan"*.

> Versi Inggris di [UPGRADING.md](./UPGRADING.md) adalah **versi kanonik**.
>
> **Kenapa dokumen ini ada.** Aika didistribusikan lewat `git merge upstream/main`, bukan lewat version bump package. Tidak ada tool yang bisa memberi tahu project klien bahwa file yang mereka ubah perlu penyesuaian. Dokumen ini adalah pengganti tool itu — dan karena itu dokumen paling bernilai di repo ini. Kalau kamu hanya bisa memelihara satu dokumen dengan baik, pilih yang ini.

## Prosedur standar

```bash
cd nama-klien

# 1. Kerjaan bersih dulu. Selalu.
git status                 # harus bersih
git checkout -b upgrade/aika-<versi>

# 2. Lihat apa yang akan masuk, SEBELUM merge.
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD..upstream/main

# 3. Baca bagian versi terkait di CHANGELOG.
#    Kalau ada bagian "perlu tindakan", kerjakan SETELAH merge, bukan sebelum.

# 4. Merge.
git merge upstream/main

# 5. Verifikasi.
npm ci
npm run check
npm run db:backup
npm run db:migrate
npm run build
```

Kalau langkah 2 menunjukkan perubahan pada file di daftar "wajar berbeda di tiap klien", hentikan dan periksa manual sebelum merge.

## Format entri di dokumen ini

Setiap versi Aika yang memerlukan tindakan mendapat bagian seperti ini:

---

### ke 0.2.0 — (contoh, belum nyata)

**Perlu tindakan.** Perkiraan waktu: 10 menit.

**Apa yang berubah**
`shared/config/env.ts` sekarang mewajibkan `APP_URL` berupa URL `https://` saat `NODE_ENV=production`. Sebelumnya nilai apa pun diterima.

**Yang harus dilakukan**

1. Pastikan environment di VPS punya `APP_URL` yang benar:
   ```
   APP_URL=https://nama-klien.example.id
   ```
2. Kalau filenya di `/etc/aika/env`, ubah di sana juga.
3. Jalankan `npm run build` dan `pm2 reload aika`, lalu cek `GET /api/health`.

**Kenapa**
Boot yang gagal lebih baik daripada situs yang jalan dengan URL relatif — cookie, canonical link, dan SEO rusak senyap, dan tidak ada yang sadar sampai klien menelepon.

**Kalau dilewati**
Aplikasi **gagal boot** di VPS. Ini disengaja.

---

## Kalau merge-nya konflik

Konflik di Aika hampir selalu berarti satu dari dua hal.

**1. Kamu mengubah file framework.** Kamu mengedit sesuatu di `shared/`, `server/`, atau `modules/`. Perbaikan yang benar: kalau perubahan itu berguna untuk semua klien, kembalikan ke Aika dulu, lalu tarik. Kalau hanya untuk klien ini, pindahkan ke `features/<milik-klien>/` supaya tidak lagi bertabrakan.

**2. Kamu mengubah file yang memang wajar berbeda.** Ini normal dan konfliknya dangkal — biasanya `app/pages/*` atau satu baris mount di `shared/http/app.ts`. Selesaikan manual: pertahankan versi klien untuk UI, versi Aika untuk sisanya.

**Yang bukan alasan sah:** mematikan `npm run arch:check`, atau menghapus fitur untuk menghindari konflik. Kalau itu terasa perlu, batasnya sudah rusak dan masalahnya lebih besar dari satu merge.

## Mengecek kesehatan batas

Setelah merge, di repo klien:

```bash
npm run arch:check
```

Kalau ada pelanggaran setelah merge, entah Aika mengirim sesuatu yang melanggar aturannya sendiri, atau ada deep import yang sebelumnya lolos. Perbaiki sebelum melanjutkan — jangan dimatikan.

## Jadwal

Tidak ada SLA formal, tapi aturannya: **semua project klien aktif ditarik ke Aika terbaru dalam 30 hari setelah rilis.** Tanpa itu, versi drift dan bug yang sudah diperbaiki tetap terkirim. Kalau ada banyak klien, tarik semuanya dalam satu sesi — lebih murah daripada mengerjakan satu per satu dengan jeda berbulan-bulan, karena selisihnya tetap kecil.
