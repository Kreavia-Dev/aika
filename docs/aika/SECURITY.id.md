# Keamanan

[English](./SECURITY.md) · **Bahasa Indonesia**

Aika itu perangkat internal, bukan produk open source. Jadi tidak ada bug bounty, dan tidak ada peneliti keamanan dari luar. Isi dokumen ini adalah kebijakan internal yang berlaku untuk Aika dan semua project klien turunannya.

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [SECURITY.md](./SECURITY.md) yang jadi acuan.

## Melaporkan masalah keamanan

**Jangan** membuka issue publik di repo klien mana pun. Klien bisa melihatnya.

Laporkan lewat jalur internal (grup tim, atau DM ke pemilik repo). Sertakan: repo dan file-nya, langkah untuk mereproduksi, dampak yang kamu duga, dan apakah ada data klien yang terlibat.

## Rahasia

- **Tidak ada rahasia di dalam repo.** Tidak ada API key, kredensial, atau connection string, tidak di kode, tidak di test, tidak di fixture, tidak di komentar.
- `.env` tidak pernah di-commit. `.gitignore` sudah mengabaikannya. Yang di-commit hanya `.env.example`, dan isinya nilai palsu.
- Di VPS, environment ada di `/etc/aika/env`, **di luar direktori aplikasi**. Dibaca lewat `--env-file-if-exists` dari `ecosystem.config.cjs`.
- Kalau ada rahasia yang terlanjur masuk ke git, mengubahnya di commit berikutnya **tidak cukup**. Rahasianya sudah ada di riwayat. Rotasi rahasianya, baru bersihkan riwayatnya.

## Database

- File SQLite (`.db`, `-wal`, `-shm`) dan semua backup **tidak pernah** masuk git.
- Backup ditulis di luar direktori yang disajikan web server. Tidak boleh ada `.db` yang bisa diunduh lewat HTTP.
- Backup itu **data klien**. Perlakukan setara database produksi: aksesnya terbatas, jangan disalin ke laptop pribadi, jangan dikirim lewat chat.
- Setiap project klien punya file database sendiri di VPS-nya sendiri. Tidak ada database yang dipakai bersama antar klien.

## Autentikasi

- **Password** di-hash dengan scrypt pada `N=2^15, r=8, p=1`, dengan salt per password. Faktor kerjanya disimpan di dalam tiap hash, jadi bisa dinaikkan nanti tanpa membatalkan password yang sudah ada.
- **Sesi** disimpan di sisi server. Database cuma menyimpan SHA-256 dari tokennya, jadi database yang bocor tidak menyerahkan sesi yang masih hidup.
- **Cookie**-nya `httpOnly`, `sameSite=Lax`, dan `secure` di produksi.
- **Proses masuk tidak membocorkan email mana yang terdaftar.** Email tidak dikenal dan password salah menghasilkan pesan yang sama, status yang sama, dan waktu respons yang sebanding.

### Celah yang kita sadari: proses masuk tidak dibatasi

**Login tidak punya rate limiting.** Penyerang bisa mencoba password secepat server menjawab. scrypt membuat tiap percobaan berbiaya puluhan milidetik, dan itu polisi tidur, bukan pertahanan.

Ini disengaja, dan ini bukan hal kecil. Lockout per akun gampang disalahgunakan untuk mengunci user yang sah, dan mengerjakannya dengan benar butuh komponen per IP yang tempatnya bersama pekerjaan rate limiting lain di Fase 3 roadmap.

Sampai itu ada: pakai password hasil generate, jangan biarkan halaman masuk terindeks publik, dan jangan pernah memakai ulang password staf di tempat lain.

## Data yang dikumpulkan situs

Form kontak menyimpan nama, alamat email, isi pesan, dan user agent pengirim. Itu
data pribadi, dan begitu form seperti itu terbuka di situs klien, ia jadi hal yang
paling mungkin membawa kewajiban serta.

- **Tentukan masa simpan dan patuhi.** Tidak ada apa pun di Aika yang menghapus kiriman lama, jadi tanpa keputusan ia menumpuk selamanya. `DELETE` terjadwal itu beberapa baris, dan yang menentukan lamanya adalah siapa pun yang memegang hubungan dengan klien itu.
- **Jangan menambah field yang tidak perlu.** Setiap field adalah data yang jadi tanggung jawabmu.
- **Jangan menulis isi pesannya ke log.** Kiriman disimpan dengan sengaja. Salinan di log proses tersimpan tanpa sengaja, dengan masa simpan yang berbeda dan daftar pembaca yang berbeda.
- **User agent pengirim dipotong di 300 karakter**, karena datangnya tanpa batas dan bisa dikendalikan penyerang.
- **Alamat IP pengirim sengaja tidak disimpan.** Tambahkan hanya kalau spam benar-benar jadi masalah, dan tulis alasannya di hari kamu menambahkannya.

## Dependency

Yang perlu diperiksa sebelum menambah:

- Paketnya benar-benar perlu tidak? Atau ada yang lebih sederhana di ekosistem?
- Berapa maintainer-nya? Terakhir dirilis kapan?
- Ada **postinstall script**? npm menjalankannya otomatis, dan itu vektor serangan supply chain yang paling klasik. Paket dengan postinstall yang tidak bisa dijelaskan sebaiknya jangan dipakai.

Dua catatan khusus Aika:

- **`allowScripts` di `package.json` di-pin ke versi yang persis.** npm 11 membuat install script harus disetujui, dan pin-nya berarti dependency yang di-upgrade harus disetujui ulang secara sadar. Jangan pernah pakai `dangerously-allow-all-scripts`. Jalankan `npm install-scripts ls` untuk melihat apa yang masih tertunda.
- **Jangan menjalankan `npm audit fix --force`** di repo yang sudah melayani klien. Itu bisa melewati versi major dan merusak deploy.

Setiap dependency yang ditambahkan berarti satu runtime tambahan. Aika sengaja hanya satu proses.

## Yang jadi tanggung jawab tiap project klien

Aika menyediakan fondasi, bukan jaminan. Sebelum situs klien naik ke produksi, pastikan:

- `APP_URL` sudah URL `https://` absolut yang benar. Kalau tidak, Aika menolak boot.
- TLS diterminasi di reverse proxy.
- File `.env` di VPS izin bacanya terbatas.
- Backup terjadwal **dan pernah di-restore minimal sekali**. Backup yang belum pernah diuji restore belum bisa disebut backup.
- Reverse proxy tidak men-buffer `text/event-stream`.
- Akun admin bawaan pengembangan sudah diganti. Tidak ada perintah hapus user, dan itu disengaja, tapi ada `npm run user:disable -- --email=<alamat>`, yang mengakhiri semua sesi akun itu dan menghentikannya login lagi. Buat akun sungguhannya dengan `npm run user:create -- --email=<alamat>`, jangan tinggalkan akun sekali pakai di database produksi.
