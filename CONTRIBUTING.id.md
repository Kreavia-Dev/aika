# Kontribusi

[English](./CONTRIBUTING.md) · **Bahasa Indonesia**

Repo internal. Semua isinya soal menjaga Aika tetap aman didistribusikan ke project klien.

> Versi Inggris di [CONTRIBUTING.md](./CONTRIBUTING.md) adalah **versi kanonik**.

## Sebelum mulai

Baca [ARCHITECTURE.id.md](./ARCHITECTURE.id.md). Sebagian besar komentar review di repo ini soal batas, dan alasannya ada di sana.

## Gerbangnya

```bash
npm run check
```

Itu menjalankan `typecheck`, `typecheck:scripts`, dan `arch:check`. Wajib hijau sebelum PR di-merge. Tidak ada pengecualian dan tidak ada "perbaiki di PR berikutnya" — repo ini di-clone ke setiap project klien, jadi gerbang yang rusak akan berlipat.

Kalau `arch:check` gagal, perbaiki batasnya. Jangan melonggarkan aturannya kecuali kamu sudah mengubah ARCHITECTURE.md lebih dulu dan menjelaskan alasannya.

## Branch dan commit

- Branch: `feat/…`, `fix/…`, `docs/…`, `chore/…` — singkat dan spesifik.
- Commit: kalimat perintah, Bahasa Inggris, satu perubahan logis per commit.
  - `add blog feature skeleton`
  - `refuse deep cross-feature imports in post web boundary`
  - bukan `fixes` atau `wip`

## Checklist pull request

Tempel ini ke deskripsi PR dan isi:

```md
## What
## Why
## Boundary impact
- [ ] Tidak menyentuh file milik klien, atau: tercantum di bawah dan beralasan
- [ ] Route `/api` baru hidup di sebuah fitur dan di-mount di shared/http/app.ts
- [ ] Kode browser hanya mengimpor dari ~~/features/<nama>/web
- [ ] Dependency baru dijustifikasi terhadap ARCHITECTURE.md → "Yang tidak dibangun Aika"

## Verification
- [ ] npm run check
- [ ] npm run build
- [ ] migrasi diterapkan dan diulang (idempoten)
- [ ] dokumentasi diperbarui di KEDUA bahasa

## Downstream impact
- [ ] Tidak ada tindakan yang diperlukan project klien, atau: docs/UPGRADING.md diperbarui
```

## Mengubah batas framework/klien

Ini perubahan dengan taruhan tertinggi, karena inilah yang menjaga `git merge upstream/main` tetap murah di setiap project klien.

Kalau perubahanmu menyentuh file di daftar "wajar berbeda di tiap klien", atau membuat file di daftar itu rawan konflik, sebutkan eksplisit di PR.

**Kalau kamu perlu mengubah sesuatu untuk satu klien saja:** ubah di Aika dulu, lalu tarik ke bawah. Kalau perubahannya tidak masuk akal untuk Aika, kemungkinan besar ia milik `features/<milik-klien>/` klien itu.

## Dokumentasi

- Inggris adalah default: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/UPGRADING.md`.
- Indonesia sekunder: nama sama plus `.id.md`.
- **Keduanya diperbarui di PR yang sama.** Reviewer boleh menolak PR yang hanya memperbarui satu.
- Kalau keduanya berbeda, file Inggris yang benar.

## Perubahan yang terlihat pengguna butuh entri changelog

Tulis untuk orang yang memelihara project klien, bukan untuk penulis diff-nya:

- Tulis dampaknya, bukan diff-nya. "Route `/api/users` sekarang memerlukan sesi" — bukan "mengubah middleware di features/users/server/routes.ts".
- Setiap entri yang mengubah perilaku harus bisa dijawab: apakah project klien perlu melakukan sesuatu? Kalau ya, tautkan ke bagiannya di [docs/UPGRADING.id.md](./docs/UPGRADING.id.md).
- Perubahan yang memaksa project klien mengedit kode atau konfigurasi adalah **major**, walaupun tidak ada yang gagal dikompilasi.

## Review

Tugas reviewer di sini adalah perlindungan batas dulu, kualitas kode kedua. Tanyakan:

1. Apakah ini bocor melewati batas — Aika/klien, server/browser, fitur/fitur?
2. Apakah ini akan berkonflik di project klien yang sudah divergen?
3. Ada kata benda domain di `shared/`?
4. Apakah kedua versi bahasa sudah diperbarui?

## Test

Belum ada test runner yang dikonfigurasi. Itu celah yang diketahui, bukan kebijakan — lihat bagian "Unreleased" di changelog. Sampai itu ada, nyatakan eksplisit di PR apa yang kamu lakukan untuk memverifikasi, dan sertakan output perintah yang sebenarnya, bukan klaim.
