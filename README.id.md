# Aika

[English](./README.md) · **Bahasa Indonesia**

Application kit internal untuk membangun aplikasi web klien. **Nuxt + Hono + SQLite**, TypeScript, satu proses Node, deploy di VPS dengan PM2.

Aika bukan produk open source dan bukan framework. Aika adalah **titik awal yang hidup**: setiap project klien dimulai sebagai clone repo ini, lalu terus menarik perbaikan dari `upstream` lewat git — tanpa menyalin manual.

> Versi Inggris di [README.md](./README.md) adalah **versi kanonik**. File ini terjemahannya dan harus diperbarui di pull request yang sama. Kalau keduanya berbeda, yang Inggris yang benar.

## Baseline terverifikasi

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

Bukti pada commit awal: `npm run check` hijau, `npm run build` hijau, `GET /api/health` → `200 {"success":true,...,"database":"up"}`, `npm run db:migrate` idempoten saat diulang, dan panel health ter-render ke HTML server.

> **Nuxt 4 menuntut `vue-router ^5.4.0`.** Mem-pin vue-router 4 membuat `npm run typecheck` gagal dengan error resolusi `vue-router/volar/...` yang membingungkan, padahal build-nya tetap sukses. Jangan diturunkan.

## Struktur

```
app/                  shell Nuxt (pages, layouts) — milik klien
features/             potongan vertikal, satu fitur satu kemampuan bisnis
  health/             fitur rujukan: contract.ts, index.ts, web/index.ts, server/
shared/               infrastruktur netral bisnis
  config/env.ts       SATU-SATUNYA tempat process.env dibaca, divalidasi Zod
  database/client.ts  SATU-SATUNYA tempat SQLite dibuka, pemilik pragma WAL
  errors/             error domain dengan code stabil dan status HTTP
  http/app.ts         composition root Hono
server/api/[...path].ts   satu-satunya adapter Nitro → Hono
modules/features.ts   mengubah features/*/web/pages/ jadi route Nuxt
database/migrations/  SQL forward-only
scripts/              migrate, backup, architecture check
```

## Prasyarat

- Node.js >= 22 (tim memakai 24 — lihat `.nvmrc`)
- npm

## Mulai

```bash
npm install
cp .env.example .env
npm run setup      # terapkan migrasi (snapshot database dulu)
npm run dev        # http://localhost:5555
```

Buka halaman depan. Kalau muncul `Database: up`, seluruh rantai tersambung: Nuxt → Nitro → Hono → SQLite.

**Soal `allowScripts` di `package.json`:** npm 11 menahan install script dependency sampai disetujui. `package.json` sudah mem-pin persetujuan untuk `better-sqlite3` (butuh `node-gyp rebuild` untuk binary native-nya) dan `esbuild`. Kalau kamu menambah dependency yang punya install script, npm akan memperingatkan, dan perintah untuk meninjaunya:

```bash
npm install-scripts ls
npm install-scripts approve <paket>
```

Pin-nya per versi persis, dan itu disengaja. Saat `better-sqlite3` di-upgrade, persetujuannya perlu diberikan ulang — itu fitur keamanan supply chain, bukan gangguan.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server dev dengan HMR di :5555 |
| `npm run build` | Build produksi ke `.output/` |
| `npm start` | Jalankan hasil build lokal |
| `npm run check` | **Gerbang utama.** Typecheck Nuxt + scripts + arch:check |
| `npm run typecheck` | Typecheck sisi Nuxt/Vue |
| `npm run typecheck:scripts` | Typecheck `scripts/`, `shared/`, `features/` |
| `npm run arch:check` | Tegakkan aturan batas fitur |
| `npm run db:migrate` | Terapkan migrasi (snapshot dulu) |
| `npm run db:backup` | Snapshot online, menyimpan 14 file terbaru |

`npm run check` harus hijau sebelum PR di-merge. Itu Definition of Done di repo ini.

## Memulai project klien baru

Distribusinya **git upstream** — bukan copy-paste, dan bukan monorepo.

```bash
git clone git@github.com:Kreavia-Dev/aika.git nama-klien
cd nama-klien

# origin milik Aika jadi upstream; origin baru jadi milik klien.
git remote rename origin upstream
git remote add origin git@github.com:Kreavia-Dev/nama-klien.git

npm install
cp .env.example .env
npm run setup
git push -u origin main
```

Mulai sekarang `upstream` = Aika dan `origin` = klien. Tidak ada yang perlu tahu Aika ada.

## Menarik perbaikan dari Aika

```bash
git fetch upstream
git merge upstream/main
```

**Ini tetap nyaman hanya karena batasnya nyata.** Sebagian besar update Aika mendarat di `shared/`, `server/`, dan `modules/` — file yang tidak pernah disentuh project klien. Kerjaan klien hidup di `features/<milik-klien>/`. Dua himpunan file yang hampir tidak beririsan berarti merge yang sepele.

Kalau merge mulai menyakitkan, itu sinyal batasnya bocor — bukan sinyal modelnya salah. Perbaiki batasnya, lalu jalankan `npm run arch:check`.

### File yang wajar berbeda di tiap klien

Sisanya milik Aika; jangan diubah tanpa alasan kuat.

- `app/pages/*`, `app/layouts/*`, `app/app.vue`
- `shared/http/app.ts` — hanya baris mount fitur
- `features/<fitur-milik-klien>/**`
- `database/migrations/*` — hanya menambah file, tidak pernah mengubah
- `.env`, `ecosystem.config.cjs`

Lihat [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) untuk daftar lengkap beserta alasannya, dan [docs/UPGRADING.id.md](./docs/UPGRADING.id.md) untuk prosedurnya.

## Deploy

```bash
# Mesin lokal atau CI — jangan pernah build di VPS.
npm ci
npm run check
npm run build

# Kirim artefak.
rsync -az --delete .output/ vps:/srv/aika/
rsync -az database/migrations/ vps:/srv/aika/database/migrations/

# Di VPS. Migrasi SEBELUM reload, selalu.
ssh vps 'cd /srv/aika && npm run db:backup && npm run db:migrate && pm2 reload aika'
```

Migrasi tidak pernah dijalankan saat boot aplikasi. Kalau dijalankan saat boot, kode yang sudah di-rollback akan bertemu migrasi yang sudah maju — dan itu tidak bisa diperbaiki dengan restart.

`ecosystem.config.cjs` memakai `fork` mode dengan satu instance, disengaja. Lihat komentar di dalamnya dan bagian SQLite di ARCHITECTURE.

Environment berada di `/etc/aika/env` di VPS, di luar direktori yang di-deploy.

## Konvensi bahasa

| | Bahasa |
|---|---|
| Dokumentasi (`README.md`, `ARCHITECTURE.md`, …) | **Inggris adalah default** |
| Terjemahan Indonesia | nama sama + `.id.md` |
| Kode, identifier, komentar, commit, `AGENTS.md` | Inggris |

File ini adalah terjemahan dari [README.md](./README.md). Perbarui keduanya dalam pull request yang sama.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) | **Otoritas.** Stack terkunci, model fitur, batas, alasan keputusan |
| [AGENTS.id.md](./AGENTS.id.md) | Kontrak untuk AI coding agent |
| [CONTRIBUTING.id.md](./CONTRIBUTING.id.md) | Aturan kontribusi dan review |
| [docs/UPGRADING.id.md](./docs/UPGRADING.id.md) | Prosedur menarik update ke project klien |
| [CHANGELOG.id.md](./CHANGELOG.id.md) | Riwayat versi Aika |
| [SECURITY.id.md](./SECURITY.id.md) | Penanganan rahasia dan kerentanan |
