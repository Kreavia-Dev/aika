<script setup lang="ts">
/**
 * Aika reference page.
 *
 * It exists to prove the whole loop end to end:
 *   Nuxt page -> Nitro -> Hono -> SQLite
 * If this renders "database: up", the foundation is wired correctly.
 *
 * Note where the type comes from: `~~/features/health/web`, the feature's
 * browser-safe boundary. NOT `~~/features/health`, which would pull
 * better-sqlite3 into the client bundle.
 *
 * The explicit `useFetch<HealthResponse>` is what gives this page a typed
 * response instead of `{}`. Without it the client knows nothing about the
 * API shape, and a server-side contract change fails silently in production.
 */
import type { HealthResponse } from '~~/features/health/web'

const { data, error, refresh, status } = await useFetch<HealthResponse>('/api/health')
</script>

<template>
  <main class="shell">
    <h1>Aika</h1>
    <p class="lede">
      Application kit internal. Build by feature, not by layer.
    </p>

    <section class="card">
      <h2>Health</h2>

      <p v-if="error" class="bad">
        Gagal menghubungi API: {{ error.message }}
      </p>

      <dl v-else-if="data">
        <div>
          <dt>Status</dt>
          <dd>{{ data.data.status }}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd :class="data.data.database === 'up' ? 'good' : 'bad'">
            {{ data.data.database }}
          </dd>
        </div>
        <div>
          <dt>Versi</dt>
          <dd>{{ data.data.version }}</dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd>{{ data.data.uptimeSeconds }}s</dd>
        </div>
      </dl>

      <p v-else class="muted">
        Memuat…
      </p>

      <button type="button" @click="refresh()">
        Cek ulang
      </button>
      <small class="muted">permintaan terakhir: {{ status }}</small>
    </section>
  </main>
</template>

<style scoped>
.shell {
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1.5rem;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #16181d;
}

h1 {
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  margin: 0 0 0.25rem;
}

.lede {
  color: #5b6270;
  margin: 0 0 2rem;
}

.card {
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}

h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #5b6270;
  margin: 0 0 1rem;
}

dl {
  margin: 0 0 1.25rem;
}

dl > div {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f0f2f4;
}

dt {
  color: #5b6270;
}

dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.good {
  color: #1a7f4b;
  font-weight: 600;
}

.bad {
  color: #c0392b;
  font-weight: 600;
}

.muted {
  color: #8b92a0;
}

button {
  font: inherit;
  padding: 0.45rem 0.9rem;
  border: 1px solid #d2d7de;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

button:hover {
  background: #f6f7f9;
}

small {
  margin-left: 0.75rem;
}
</style>
