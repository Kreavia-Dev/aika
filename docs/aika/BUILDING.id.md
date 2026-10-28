# Membangun fitur

[English](./BUILDING.md) · **Bahasa Indonesia**

## Dokumen ini untuk apa

Ini bagian **bagaimana**. [ARCHITECTURE.id.md](./ARCHITECTURE.id.md) bagian **kenapa**.

Dokumen ini memandu menambah satu kemampuan bisnis dari awal sampai jalan,
memakai fitur `health` di repo ini sebagai rujukan. Semua potongan kode di bawah
adalah kode nyata yang bisa kamu buka.

Kalau kamu cuma membaca satu dokumen Aika, baca yang ini.

> Terjemahan ini ditulis ulang supaya enak dibaca, bukan diterjemahkan kata per kata. Versi Inggris di [BUILDING.md](./BUILDING.md) yang jadi acuan.
>
> Blok kode di sini tetap Bahasa Inggris, karena kode selalu Bahasa Inggris. Lihat [AGENTS.id.md](../../AGENTS.id.md).

## Bentuk sebuah fitur

```
features/invoices/
├── contract.ts       # schema Zod, dan tipe TypeScript hasil turunannya
├── index.ts          # BATAS SERVER: pintu yang dilewati kode server
├── server/
│   ├── routes.ts     # route Hono milik fitur ini
│   ├── service.ts    # opsional: aturan bisnis
│   └── repository.ts # opsional: SQL
├── web/
│   ├── index.ts      # BATAS BROWSER: pintu yang dilewati kode browser
│   ├── pages/        # otomatis jadi route, di bawah /invoices
│   └── components/
└── tests/
```

`contract.ts` dan `index.ts` wajib, dan `arch:check` menolak fitur yang tidak
punya keduanya. Sisanya muncul saat fiturnya memang membutuhkannya. Jangan bikin
folder kosong supaya kelihatan lengkap.

## Langkah 1: tulis contract-nya dulu

Mulai dari sini, sebelum route dan sebelum UI. Contract itu janji publik sebuah
fitur, dan Zod memberi validasi saat runtime sekaligus tipe saat kompilasi dari
satu sumber.

```ts
// features/invoices/contract.ts
import { z } from 'zod'

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  total: z.number().int().nonnegative(),
  issuedAt: z.string(),
})

export const invoiceListResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({ invoices: z.array(invoiceSchema) }),
})

export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceListResponse = z.infer<typeof invoiceListResponseSchema>
```

Tulis tipenya sekali, biarkan `z.infer` yang memproduksinya. Begitu kamu menulis
bentuk yang sama dua kali, yang kedua akan melenceng.

## Langkah 2: route servernya

```ts
// features/invoices/server/routes.ts
import { Hono } from 'hono'
import { listInvoices } from './repository'
import { invoiceListResponseSchema } from '../contract'

export const invoiceRoutes = new Hono()

invoiceRoutes.get('/invoices', (c) => {
  const payload = invoiceListResponseSchema.parse({
    success: true,
    message: 'OK',
    data: { invoices: listInvoices() },
  })

  return c.json(payload)
})
```

Tiga aturan berlaku untuk semua route:

1. **Validasi inputnya sebelum isi handler jalan.** Query string dan body di-parse
   Zod lebih dulu. Jangan pernah mempercayai parameter.
2. **Lempar turunan `AppError`.** `NotFoundError`, `ValidationError`, dan
   sejenisnya ada di `shared/errors`. Jangan menyusun respons error sendiri.
3. **Parse juga responsnya.** Terdengar berlebihan, dan memang sengaja: di situlah
   penyimpangan kontrak jadi kegagalan berisik saat development, bukan perubahan
   bentuk yang senyap di produksi.

Tidak satu pun route di atas memanggil penjaga, artinya route itu publik. Itu
keputusan, bukan kelalaian: `/api/health` harus menjawab pemantau uptime yang
tidak bisa login. Route yang tidak boleh publik butuh penjaga, di bawah ini.

Aturan keempat berlaku begitu sebuah route tidak publik. `features/health` adalah
contoh di atas dan memang publik, jadi ini bentuknya, bukan kode fitur itu:

```ts
import { requireUser, requireRole } from '../../auth'

invoiceRoutes.get('/invoices', (c) => {
  // Cukup login, dan semua staf boleh melihat invoice.
  requireUser(c)
  // ...
})

invoiceRoutes.get('/invoices/export', (c) => {
  // Khusus administrator. `editor` mendapat 403 dengan kode FORBIDDEN.
  requireRole(c, 'admin')
  // ...
})
```

Panggil penjaganya di baris pertama, sebelum membaca body, jadi request anonim
hanya berbiaya satu select terindeks tanpa parsing. Untuk satu grup, pakai
`invoiceRoutes.use('/invoices/admin/*', roleGuard('admin'))`.

Menentukan route butuh penjaga yang mana adalah pertanyaan bisnis, bukan kode:
apakah semua staf perlu ini, atau hanya orang yang mengurus situsnya? Tulis
jawabannya di komentar di atas route itu, karena orang berikutnya harus menjawab
pertanyaan yang sama saat menambah route di sebelahnya.

## Langkah 3: dua pintu

Ini bagian yang paling mudah salah, jadi baca dengan serius.

```ts
// features/invoices/index.ts  -> pintu SERVER
export { invoiceRoutes } from './server/routes'
export type { Invoice, InvoiceListResponse } from './contract'
```

```ts
// features/invoices/web/index.ts  -> pintu BROWSER
export type { Invoice, InvoiceListResponse } from '../contract'
```

Keduanya tidak bisa saling menggantikan:

| Impor dari | Dipakai di |
|---|---|
| `~~/features/invoices` | kode server, dan server fitur lain |
| `~~/features/invoices/web` | komponen Vue, dan kode `web/` fitur lain |

**Kenapa pemisahan ini bukan basa-basi.** Pintu server mengekspor
`invoiceRoutes`, yang pada akhirnya mengimpor `better-sqlite3`. Komponen Vue yang
mengimpor dari pintu server akan menyeret modul native Node itu ke bundle
browser. Mengimpor dari `web/` membuat kesalahan itu mustahil, dan aturan R6 di
`npm run arch:check` menangkap siapa pun yang tetap mencoba.

Untuk browser, tipe tidak memakan biaya apa pun. `import type` terhapus saat
build.

## Langkah 4: pasang

Satu baris, di satu file:

```ts
// shared/http/app.ts
api.route('/', invoiceRoutes)
```

Ini satu-satunya tempat project klien memang diharapkan berbeda dengan Aika, dan
itulah alasan file ini masuk daftar file yang wajar berbeda di tiap klien. Isinya
cukup baris mount saja.

## Langkah 5: halaman browser

Taruh file `.vue` di `features/invoices/web/pages/`, dan ia jadi route di bawah
nama fiturnya sendiri. Tidak ada file routing yang perlu diedit di mana pun.

| File | Route |
|---|---|
| `web/pages/index.vue` | `/invoices` |
| `web/pages/create.vue` | `/invoices/create` |
| `web/pages/[id].vue` | `/invoices/[id]` |

```vue
<script setup lang="ts">
import type { InvoiceListResponse } from '../index'

const { data, error } = await useFetch<InvoiceListResponse>('/api/invoices')
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-2xl font-semibold tracking-tight">Invoices</h1>

    <p v-if="error" class="text-destructive">{{ error.message }}</p>

    <ul v-else-if="data" class="mt-6 space-y-2">
      <li v-for="invoice in data.data.invoices" :key="invoice.id">
        {{ invoice.number }}
      </li>
    </ul>
  </main>
</template>
```

Dua hal yang perlu diperhatikan:

- **`useFetch<InvoiceListResponse>` itu bukan opsional.** Tanpa parameter tipenya,
  respons bertipe `{}`, dan perubahan kontrak di sisi server akan gagal tanpa
  suara, bukan merusak build-mu.
- **Styling memakai utility Tailwind dan token semantik.** Tidak ada blok
  `<style>`, tidak ada nilai hex. Lihat [AGENTS.id.md](../../AGENTS.id.md) bagian
  "Styling".

## Langkah 6: jalankan gerbangnya

```bash
npm run check
```

Itu menjalankan typecheck Nuxt, typecheck scripts, `arch:check`, `prose:check`,
dan seluruh test. Wajib hijau sebelum pekerjaannya dianggap selesai. Tidak ada
pengecualian dan tidak ada "nanti diperbaiki", karena repo ini di-clone ke setiap
project klien dan gerbang yang rusak akan ikut terbawa.

## Langkah 7: kalau butuh tabel

Tambah file baru di `database/migrations/`. Migrasi itu SQL mentah, dijalankan
urut nama file, forward-only.

```sql
-- database/migrations/0002_invoices.sql
CREATE TABLE invoices (
  id         TEXT    PRIMARY KEY,
  number     TEXT    NOT NULL UNIQUE,
  total      INTEGER NOT NULL CHECK (total >= 0),
  issued_at  TEXT    NOT NULL
);
```

```bash
npm run db:migrate
```

Tiga aturan, dan `npm run db:migrate` menegakkan aturan pertama untukmu dengan
menulis snapshot sebelum menerapkan apa pun:

1. Jangan pernah mengubah migrasi yang mungkin sudah dijalankan di mana pun.
   Tambah file baru.
2. Jangan menghapus kolom di rilis yang sama dengan berhentinya penulisan ke
   kolom itu.
3. Jangan menambah kolom ke tabel milik fitur lain. Fitur memiliki tabelnya
   sendiri.

Migrasi itu langkah deploy, bukan boot aplikasi. Alasannya ada di
[UPGRADING.id.md](./UPGRADING.id.md).

## Langkah 8: tes

Test ada di dua tempat, dan pembedaannya soal apa yang dibutuhkan untuk
menjalankannya:

| Jenis | Lokasi | Cakupan |
|---|---|---|
| Unit | `tests/unit/` | Logika murni tanpa framework |
| Fitur | `features/<nama>/tests/` | Endpoint fitur itu |

```ts
// features/invoices/tests/invoices.test.ts
import { describe, expect, it } from 'vitest'
import { api } from '../../../shared/http/app'
import { invoiceListResponseSchema } from '../contract'

describe('GET /api/invoices', () => {
  it('conforms to the schema the feature publishes', async () => {
    const response = await api.request('/api/invoices')
    const parsed = invoiceListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })
})
```

Jalankan Hono app yang sebenarnya. Cepat, karena `shared/http/app.ts` tidak
mengimpor apa pun dari Nitro, dan `Request` standar Web sudah cukup. Jangan
di-mock.

Parse body-nya, jangan periksa field satu per satu. `response.json()` bertipe
`unknown`, jadi melewatkannya ke schema sekaligus jadi validasi dan penyempitan
tipe, dan yang diperiksa adalah kontrak yang diterbitkan, bukan salinannya.

## Contoh nyata di repo ini

Buka `features/health/` dan baca dengan urutan ini:

| File | Yang perlu diperhatikan |
|---|---|
| `contract.ts` | Schema-nya, dan tipenya diturunkan bukan ditulis ulang |
| `server/routes.ts` | Validasi, lalu parse responsmu sendiri sebelum dikembalikan |
| `index.ts` | Pintu server, dan komentar yang menjelaskan jebakannya |
| `web/index.ts` | Pintu browser, dan isinya cuma tipe |
| `web/pages/index.vue` | Route milik fitur, dan `useFetch` yang bertipe |
| `tests/health.test.ts` | Menjalankan app sungguhan, parse lewat kontraknya |

Ukurannya kecil dan itu disengaja. Semua isi dokumen ini kelihatan di enam file
itu.

## Kesalahan yang mudah terjadi

| Kesalahan | Yang menangkapnya |
|---|---|
| Deep import antar fitur, misalnya `~~/features/users/server/repository` | `arch:check` aturan R2 |
| Kode browser mengimpor pintu server | `arch:check` aturan R6 |
| Fitur tanpa `contract.ts` atau `index.ts` | `arch:check` aturan R1 |
| Dependensi melingkar antar dua fitur | `arch:check` aturan R5 |
| Membuka SQLite langsung di dalam fitur | `arch:check` aturan R4 |
| Layout yang diam-diam tidak bekerja karena `app.vue` tidak membungkus `NuxtPage` dengan `NuxtLayout` | `arch:check` aturan R7 |
| Direktori top-level yang tidak ada di peta di `docs/aika/README.id.md` | `arch:check` aturan R8 |
| Em dash atau en dash di mana pun | `prose:check` |
| Bahasa Indonesia di kode framework | `prose:check` |
| Class yang tidak pernah muncul di CSS | Tidak ada. Lihat catatan di bawah |

Baris terakhir itu yang perlu diingat. Tailwind hanya menghasilkan class dari
direktori yang dideklarasikan lewat `@source` di `app/assets/css/main.css`. Kalau
kamu menambah direktori top-level baru yang berisi komponen, tambahkan baris
`@source`-nya. Kalau tidak, class-nya tidak akan pernah di-generate, tanpa error
di mana pun.
