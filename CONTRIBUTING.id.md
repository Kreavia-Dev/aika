# Kontribusi

[English](./CONTRIBUTING.md) · **Bahasa Indonesia**

Repo internal. Semua isi dokumen ini soal menjaga Aika tetap aman dipindahkan ke project klien.

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [CONTRIBUTING.md](./CONTRIBUTING.md) yang jadi acuan.

## Sebelum mulai

Baca [ARCHITECTURE.id.md](./ARCHITECTURE.id.md). Sebagian besar komentar review di repo ini soal batas, dan alasannya ada di sana.

## Gerbangnya

```bash
npm run check
```

Perintah itu menjalankan `typecheck`, `typecheck:scripts`, dan `arch:check`. Semuanya wajib hijau sebelum PR di-merge. Tidak ada pengecualian, dan tidak ada "nanti diperbaiki di PR berikutnya", repo ini di-clone ke setiap project klien, jadi gerbang yang rusak ikut terbawa.

Kalau `arch:check` gagal, perbaiki batasnya. Jangan melonggarkan aturannya, kecuali kamu sudah lebih dulu mengubah ARCHITECTURE.md dan menjelaskan alasannya.

## Branch dan commit

- Branch: `feat/…`, `fix/…`, `docs/…`, `chore/…`, singkat dan spesifik.
- Commit: kalimat perintah, Bahasa Inggris, satu perubahan logis per commit.
  - `add blog feature skeleton`
  - `refuse deep cross-feature imports in post web boundary`
  - bukan `fixes` atau `wip`

## Checklist pull request

Tempel ini ke deskripsi PR, lalu isi:

```md
## What
## Why
## Boundary impact
- [ ] Tidak menyentuh file milik klien, atau: tercantum di bawah dan ada alasannya
- [ ] Route `/api` baru tinggal di dalam fitur dan di-mount di shared/http/app.ts
- [ ] Kode browser hanya mengimpor dari ~~/features/<nama>/web
- [ ] Dependency baru ada justifikasinya terhadap ARCHITECTURE.md → "Yang tidak kita bangun"

## Verification
- [ ] npm run check
- [ ] npm run build
- [ ] migrasi dijalankan dan diulang (aman kalau dua kali)
- [ ] dokumentasi diperbarui di KEDUA bahasa

## Downstream impact
- [ ] Tidak ada tindakan yang diperlukan project klien, atau: docs/UPGRADING.md diperbarui
```

## Mengubah batas antara framework dan klien

Ini perubahan dengan taruhan paling tinggi, karena inilah yang membuat `git merge upstream/main` tetap murah di setiap project klien.

Kalau perubahanmu menyentuh file di daftar "wajar berbeda di tiap klien", atau membuat file di daftar itu jadi rawan konflik, sebutkan secara eksplisit di PR.

**Kalau kamu perlu mengubah sesuatu demi satu klien saja:** ubah dulu di Aika, baru tarik ke bawah. Kalau perubahannya memang tidak pantas ada di Aika, kemungkinan besar tempatnya di `features/<milik-klien>/` klien itu.

## Dokumentasi

- Inggris sebagai default: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- Indonesia sebagai pendamping: nama file sama, ditambah `.id.md`.
- **Keduanya diperbarui di PR yang sama.** Reviewer boleh menolak PR yang cuma memperbarui satu.
- Kalau keduanya berbeda, yang benar file Inggris.
- Terjemahan Indonesia ditulis supaya enak dibaca, bukan kata per kata. Panjang kalimatnya boleh berbeda.

## Gaya penulisan

- **Jangan pakai em dash atau en dash.** Pakai koma, titik dua, titik, atau tanda kurung. Tanda hubung biasa tetap boleh di dalam kata dan rentang seperti `R1-R6`. Ditegakkan `npm run prose:check`, yang ikut jalan di `npm run check`.
- Kalimat pendek lebih baik daripada kalimat yang butuh tiga koma.
- Utamakan kalimat aktif.
- Kalau sebuah aturan penting, jadikan skrip, bukan sekadar kalimat di dokumen.

## Perubahan yang terlihat pengguna wajib masuk changelog

Tulis untuk orang yang memelihara project klien, bukan untuk penulis diff-nya:

- Tulis dampaknya, bukan diff-nya. "Route `/api/users` sekarang butuh sesi", bukan "mengubah middleware di features/users/server/routes.ts".
- Setiap entri yang mengubah perilaku harus bisa menjawab: apakah project klien perlu melakukan sesuatu? Kalau ya, tautkan ke bagiannya di [docs/UPGRADING.id.md](./docs/UPGRADING.id.md).
- Perubahan yang memaksa project klien mengedit kode atau konfigurasi itu **major**, walaupun tidak ada yang gagal dikompilasi.

## Review

Tugas reviewer di sini: jaga batas dulu, baru kualitas kode. Yang perlu ditanyakan:

1. Apakah perubahan ini menembus batas, Aika/klien, server/browser, fitur/fitur?
2. Apakah ini akan berkonflik di project klien yang sudah berbeda jauh?
3. Ada kata benda domain yang nyasar ke `shared/`?
4. Apakah kedua versi bahasa sudah diperbarui?

## Test

Belum ada test runner yang dipasang. Itu celah yang kita sadari, bukan kebijakan, lihat bagian "Belum Dirilis" di changelog. Sampai itu ada, sebutkan di PR apa yang kamu lakukan untuk memverifikasi, dan sertakan output perintah yang sebenarnya, bukan sekadar klaim.
