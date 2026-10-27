# Aika

[English](./README.md) · **Bahasa Indonesia**

Kit internal untuk membangun web app klien. **Nuxt + Hono + SQLite**, TypeScript, satu proses Node, di-deploy ke VPS dengan PM2.

Aika bukan produk open source, dan bukan framework. Aika ini titik awal yang hidup: setiap project klien dimulai dari hasil clone repo ini, lalu terus menarik perbaikan dari `upstream` lewat git, tanpa menyalin apa pun secara manual.

> Versi Inggris di [README.md](./README.md) yang jadi acuan. File ini terjemahannya, dan keduanya diperbarui di pull request yang sama. Kalau isinya berbeda, yang Inggris yang benar.
>
> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Jadi panjang kalimatnya bisa berbeda dari versi Inggris, isinya tetap sama.

## Versi yang sudah diuji

Aika sudah dibangun dan dijalankan, bukan hanya ditulis.

| | Versi |
|---|---|
| Node | 24.22.1 (`.nvmrc`) |
| npm | 11.19.1 |
| Nuxt | 4.6.3 |
| Vue / vue-router | 3.5.44 / 5.4.0 |
| Hono | 4.x |
| Zod | 4.6.7 |
| better-sqlite3 | 12.11.1 |
| TypeScript | 5.9.3 |

Buktinya, per commit pertama: `npm run check` hijau, `npm run build` hijau, `GET /api/health` mengembalikan `200 {"success":true,...,"database":"up"}`, `npm run db:migrate` aman dijalankan dua kali, dan panel health benar-benar ikut ter-render di HTML server.

> **Nuxt 4 butuh `vue-router ^5.4.0`.** Kalau di-pin ke vue-router 4, `npm run typecheck` gagal dengan error `vue-router/volar/...` yang membingungkan, padahal build-nya tetap sukses. Jangan diturunkan.

## Isi repo

```
app/                  Nuxt shell (pages, layouts), client-owned
features/             vertical slices, one feature per business capability
  health/             reference feature: contract.ts, index.ts, web/index.ts, server/
shared/               business-neutral infrastructure
  config/env.ts       the ONLY place process.env is read, validated by Zod
  database/client.ts  the ONLY place SQLite is opened, and the WAL pragmas
  errors/             domain errors with a stable code and HTTP status
  http/app.ts         the Hono composition root
server/api/[...path].ts   the single Nitro to Hono adapter → Hono
modules/features.ts   turns features/*/web/pages/ into Nuxt routes
database/migrations/  SQL forward-only
scripts/              migrate, backup, architecture and prose checks
```

## Yang dibutuhkan

- Node.js >= 22 (tim pakai 24, lihat `.nvmrc`)
- npm

## Mulai

```bash
npm install
cp .env.example .env
npm run setup      # applies migrations (snapshots the database first)
npm run dev        # http://localhost:5555
```

Buka halaman depannya. Kalau muncul `Database: up`, berarti seluruh rantainya sudah tersambung: Nuxt → Nitro → Hono → SQLite.

**Soal `allowScripts` di `package.json`:** npm 11 tidak menjalankan install script milik dependency sampai kita setujui. `package.json` sudah menyetujui `better-sqlite3` (butuh `node-gyp rebuild` untuk binary native-nya) dan `esbuild`. Kalau nanti menambah dependency yang punya install script, npm akan memperingatkan. Perintah untuk memeriksanya:

```bash
npm install-scripts ls
npm install-scripts approve <package>
```

Persetujuannya di-pin ke versi yang persis, dan itu memang disengaja. Setiap kali `better-sqlite3` di-upgrade, persetujuannya harus diberikan ulang, ini fitur keamanan supply chain, bukan gangguan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server dev dengan HMR di :5555 |
| `npm run build` | Build produksi ke `.output/` |
| `npm start` | Jalankan hasil build di lokal |
| `npm run check` | **Gerbang utama.** Typecheck Nuxt + typecheck scripts + arch:check + prose:check + test |
| `npm run typecheck` | Typecheck sisi Nuxt/Vue |
| `npm run typecheck:scripts` | Typecheck `scripts/`, `shared/`, `features/`, dan test-nya |
| `npm run arch:check` | Periksa aturan batas fitur |
| `npm run prose:check` | Tolak em dash dan en dash di dokumen mana pun |
| `npm run test` | Jalankan seluruh test sekali |
| `npm run test:watch` | Mode watch sambil kerja |
| `npm run user:create` | Buat user. Tidak ada halaman pendaftaran, dan itu disengaja |
| `npm run db:migrate` | Jalankan migrasi (snapshot dulu) |
| `npm run db:backup` | Snapshot online, menyimpan 14 file terbaru |

`npm run check` wajib hijau sebelum PR di-merge. Itu definisi "selesai" di repo ini.

## Memulai project klien baru

Perpindahan kodenya lewat **git upstream**: bukan copy-paste, dan bukan monorepo.

```bash
git clone git@github.com:Kreavia-Dev/aika.git client-name
cd client-name

# Aika origin becomes upstream; the new origin belongs to the client.
git remote rename origin upstream
git remote add origin git@github.com:Kreavia-Dev/client-name.git

npm install
cp .env.example .env
npm run setup
git push -u origin main
```

Setelah ini `upstream` adalah Aika, dan `origin` adalah klien. Tidak ada yang perlu tahu Aika ada.

## Menarik perbaikan dari Aika

```bash
git fetch upstream
git merge upstream/main
```

**Ini tetap ringan hanya karena batasnya nyata.** Hampir semua update Aika mendarat di `shared/`, `server/`, dan `modules/`, file yang tidak pernah disentuh project klien. Sementara pekerjaan klien hidup di `features/<milik-klien>/`. Dua kumpulan file yang nyaris tidak bertemu membuat merge jadi sepele.

Kalau merge mulai menyakitkan, itu tanda batasnya sudah bocor, bukan tanda modelnya salah. Perbaiki batasnya, lalu jalankan `npm run arch:check`.

### File yang wajar berbeda di tiap klien

Sisanya milik Aika. Jangan diubah tanpa alasan kuat.

- `app/pages/*`, `app/layouts/*`, `app/app.vue`
- `shared/http/app.ts`, hanya baris mount fitur
- `features/<fitur-milik-klien>/**`
- `database/migrations/*`, hanya menambah file baru, tidak pernah mengubah yang lama
- `.env`, `ecosystem.config.cjs`

Daftar lengkapnya beserta alasannya ada di [ARCHITECTURE.id.md](./ARCHITECTURE.id.md). Prosedur upgrade-nya ada di [docs/UPGRADING.id.md](./UPGRADING.id.md).

## Deploy

```bash
# Local machine or CI: never build on the VPS.
npm ci
npm run check
npm run build

# Ship the artefact.
rsync -az --delete .output/ vps:/srv/aika/
rsync -az database/migrations/ vps:/srv/aika/database/migrations/

# On the VPS. Migrate BEFORE reloading, always.
ssh vps 'cd /srv/aika && npm run db:backup && npm run db:migrate && pm2 reload aika'
```

Migrasi tidak pernah dijalankan saat aplikasi boot. Kalau dijalankan saat boot, kode yang sudah di-rollback akan bertemu migrasi yang sudah maju duluan, dan restart tidak bisa memperbaiki itu.

`ecosystem.config.cjs` memakai `fork` mode dengan satu instance, dan itu disengaja. Alasannya ada di komentar file itu dan di bagian SQLite pada ARCHITECTURE.

Environment di VPS ada di `/etc/aika/env`, di luar direktori yang di-deploy.

## Konvensi bahasa

| | Bahasa |
|---|---|
| Dokumentasi (`README.md`, `ARCHITECTURE.md`, dst.) | **Inggris, sebagai default** |
| Terjemahan | Indonesia, nama file sama plus `.id.md` |
| Kode, identifier, komentar, commit message, `AGENTS.md` | Inggris |

Dokumentasi ditulis dalam dua bahasa, tapi yang Inggris selalu jadi acuan. Kalau menemukan kalimat Indonesia yang terasa janggal atau sulit dipahami, itu bug, laporkan seperti bug lain.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [ROADMAP.id.md](./ROADMAP.id.md) | Apa yang mau dibangun berikutnya, dan kenapa. Yang sudah selesai keluar dari sana |
| [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) | **Acuan utama.** Stack, model fitur, batas, dan alasan tiap keputusan |
| [AGENTS.id.md](../../AGENTS.id.md) | Aturan untuk AI coding agent |
| [CONTRIBUTING.id.md](./CONTRIBUTING.id.md) | Aturan kontribusi dan review |
| [docs/UPGRADING.id.md](./UPGRADING.id.md) | Cara menarik update ke project klien |
| [CHANGELOG.id.md](./CHANGELOG.id.md) | Riwayat versi Aika |
| [SECURITY.id.md](./SECURITY.id.md) | Penanganan rahasia dan celah keamanan |
