# Pulling Aika updates into a client project

**English** · [Bahasa Indonesia](./UPGRADING.id.md)

This document is a **procedure**, not a release log. Release notes live in [CHANGELOG.md](./CHANGELOG.md).

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

## Releases requiring action

### to 0.2.0 (unreleased): authentication

**What changed.** A new `auth` feature adds sign in, sign out, and session handling. Every `/api/auth` route is additive, so nothing existing changes behaviour.

**Two things are required of you:**

1. Apply the migration. `0002_auth.sql` adds the `users` and `sessions` tables. It only creates tables, so it cannot collide with existing data.

   ```bash
   npm run db:migrate
   ```

2. Create the first user. There is no sign up screen, on purpose.

   ```bash
   npm run user:create -- --email=you@example.com
   ```

   A password is generated and printed once. Save it, because there is no change password flow yet.

**Also affected:** the page at `/health` now requires a session. The endpoint at `/api/health` stays public, because uptime monitoring cannot sign in. If anything in your deployment polls `/health` as a page rather than `/api/health`, point it at the API.

### to 0.2.0 (unreleased): the blog feature

**What changed.** A new `blog` feature adds `/blog`, `/blog/<slug>`, and staff screens at
`/blog/admin`. Nothing existing changes behaviour.

**One thing is required.** Apply two migrations. `0006_blog.sql` adds `blog_posts` and
`blog_categories`, and `0007_blog_previous_slug.sql` adds the column that keeps a renamed
post reachable at its old address. Both only create or add, so neither can collide with
existing data.

```bash
npm run db:migrate
```

**Worth knowing.** Any staff member can write a post at `/blog/admin`, but only an `admin`
can publish one or manage categories. A cover image comes from the existing media library,
picked in the editor, so there is no second upload path. Deleting an image in the library
leaves a post published without a picture rather than deleting it. Renaming a published post
now redirects its old address permanently, but only the most recent one: rename a post twice
and the first old address is gone.

### to 0.2.0 (unreleased): a lost password is recoverable

**What changed.** A new command replaces an account's password from the shell, for the case
where nobody knows it. Before this, the only way back into a deployment whose administrator
had forgotten their password was to create another administrator, and the abandoned account
stayed forever because there is no delete-user command.

```bash
npm run user:password -- --email=you@example.com
```

It prints a generated password once and ends every session that account holds.

**One thing worth doing before you need it:** try it on a throwaway account now.

```bash
npm run user:create -- --email=throwaway@example.com
npm run user:password -- --email=throwaway@example.com
npm run user:disable -- --email=throwaway@example.com
```

A recovery procedure nobody has run is a procedure that does not work. The one thing people
get wrong is not expecting the sign out: after a reset, every browser holding that account
stops working, including one that looks like it is fine.

**Why it is a shell command and not a web route.** A reset route would have to be reachable
without a password, which makes it a way in for anyone who can reach the server. Whoever
runs the deployment already has a shell, so the authority stays where it already is.

**If you skip it.** Nothing fails. The command exists and costs nothing when unused.

### to 0.2.0 (unreleased): the staff screens are gated

**What changed.** The media library and the staff inbox now check the role, not just
whether somebody is signed in. An `editor` keeps the media library and loses the inbox.
An `admin` keeps both.

**One thing is worth checking:**

```bash
npm run user:list
```

Any account that shows `editor` now sees a smaller site than it did yesterday. If that
surprises you, the account was probably meant to be an administrator, and the fix is:

```bash
npm run user:role -- --email=someone@example.com --role=admin
```

**Why it matters.** `editor` used to be a label. It is now a restriction, so an account
you created as an editor to satisfy a naming convention is a reduction in access that
nobody asked for. The inbox is the one screen where the difference is a privacy question
as well as a practical one, because it holds messages from people who never had an account.

**If you skip it.** Nothing fails. An editor simply cannot read the inbox, and sees the
media library as before.

### to 0.2.0 (unreleased): role enforcement

**What changed.** `users.role` is now enforced. The roles are `admin` and `editor`. One
route is administrator only so far, `GET /api/auth/users`, and every other staff screen
and route is still signed-in only, so nothing you can see changes today.

Two things you cannot do any more, on purpose: disable the last active administrator, and
demote the last active administrator. Either would leave a deployment where no
administrator only route can be reached.

**Two things are worth doing:**

1. Look at who your accounts are.

   ```bash
   npm run user:list
   ```

   Every account created before this release is an `admin`, so nobody loses access. That
   is exactly why it is worth a look: if you meant somebody to be staff rather than an
   administrator, they are currently an administrator, and they always were. Decide
   deliberately now that the choice exists.

2. Change a role if step 1 found one that is wrong.

   ```bash
   npm run user:role -- --email=someone@example.com --role=editor
   ```

   The change takes effect on that person's next request. Their session is not ended, so
   they are not signed out; they simply stop reaching administrator only routes.

**Why it matters.** Nothing breaks if you skip this. The reason to do it anyway is that
`editor` is now a real restriction rather than a label, and a client project whose staff
are all administrators is a client project where one compromised staff password is one
compromised administrator. This change does not force you to act, and the next one, which
gates the existing staff screens, will.

**If you skip it.** Nothing fails. Every account stays an administrator and the feature
has no visible effect, which is the intended shape of this release.

### to 0.2.0 (unreleased): media uploads

**What changed.** A new `media` feature adds an authenticated upload endpoint at `POST /api/media`, a library screen at `/media`, and a public route that serves what was uploaded at `/media/<filename>`. Nothing existing changes behaviour.

**Three things are required of you:**

1. Set `MEDIA_ROOT` in the deployment's environment. It is where uploaded files are written, and it must be an absolute path outside the application directory.

   ```bash
   MEDIA_ROOT=/srv/aika/data/media
   ```

   **Why this matters.** The default is `./storage/media`, which resolves against the working directory. Left unset on a server, uploaded files land inside the deployed application directory, and the next deploy that replaces that directory removes a client's images with no error anywhere.

2. Apply the migration. `0005_media.sql` adds the `media_files` table. It only creates a table, so it cannot collide with existing data.

   ```bash
   npm run db:migrate
   ```

3. Build the artefact on the operating system and architecture that will run it. This feature adds `sharp`, a native image library, so a build produced on Windows cannot run on Linux and the other way round.

   This is the same rule `better-sqlite3` already imposed, and it is worth stating plainly: a build is not portable across platforms, and the failure is a module that refuses to load rather than anything readable.

**Also worth knowing:** the serving route is public. Anyone holding a file's URL can fetch it, which is the normal shape for images on a public site, since the URL is the thing that gets pasted into content. Uploading and listing are not public.

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
