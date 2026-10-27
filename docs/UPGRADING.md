# Pulling Aika updates into a client project

**English** · [Bahasa Indonesia](./UPGRADING.id.md)

This document is a **procedure**, not a release log. Release notes live in [CHANGELOG.md](../CHANGELOG.md).

If the changelog answers *"what changed"*, this document answers *"what do I have to do"*.

> **Why this document exists.** Aika is distributed via `git merge upstream/main`, not via a package version bump. No tool can tell a client project that a file they edited needs adjusting. This document is the replacement for that tool, and therefore the single highest-value document in this repository. If you can only maintain one document well, maintain this one.

## Standard procedure

```bash
cd client-name

# 1. Clean working tree first. Always.
git status                 # must be clean
git checkout -b upgrade/aika-<version>

# 2. See what is coming, BEFORE merging.
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD..upstream/main

# 3. Read the relevant version section in the CHANGELOG.
#    If there is an "action required" section, do it AFTER the merge, not before.

# 4. Merge.
git merge upstream/main

# 5. Verify.
npm ci
npm run check
npm run db:backup
npm run db:migrate
npm run build
```

If step 2 shows changes to a file on the "legitimately differs per client" list, stop and inspect manually before merging.

## Entry format in this document

Every Aika release that requires action gets a section like this:

---

### to 0.2.0 (example, not real)

**Action required.** Estimated time: 10 minutes.

**What changed**
`shared/config/env.ts` now requires `APP_URL` to be an `https://` URL when `NODE_ENV=production`. Previously any value was accepted.

**What to do**

1. Ensure the VPS environment has a correct `APP_URL`:
   ```
   APP_URL=https://client-name.example.id
   ```
2. If the file is at `/etc/aika/env`, change it there too.
3. Run `npm run build` and `pm2 reload aika`, then check `GET /api/health`.

**Why**
A failed boot is better than a site running with a relative URL. Cookies, canonical links, and SEO break silently, and nobody notices until the client calls.

**If you skip it**
The application **fails to boot** on the VPS. This is deliberate.

---

## If the merge conflicts

A conflict in Aika almost always means one of two things.

**1. You changed a framework file.** You edited something in `shared/`, `server/`, or `modules/`. The right fix: if the change is useful to every client, take it back to Aika first, then pull it down. If it is only for this client, move it into `features/<client-specific>/` so it stops colliding.

**2. You changed a file that is expected to differ.** This is normal and the conflict is shallow, usually `app/pages/*` or a single mount line in `shared/http/app.ts`. Resolve it by hand: keep the client's version for UI, Aika's version for everything else.

**Not a legitimate reason:** disabling `npm run arch:check`, or deleting a feature to dodge a conflict. If that feels necessary, the boundary has broken and the problem is larger than one merge.

## Checking boundary health

After a merge, in the client repository:

```bash
npm run arch:check
```

If there are violations after a merge, either Aika shipped something that breaks its own rules, or a deep import slipped through earlier. Fix it before continuing, do not switch it off.

## Cadence

There is no formal SLA, but the rule is: **every active client project is pulled to the latest Aika within 30 days of release.** Without that, versions drift and already-fixed bugs keep shipping. With many clients, pull them all in one sitting, it is cheaper than doing them one at a time months apart, because the delta stays small.
