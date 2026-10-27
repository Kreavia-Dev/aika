# Security

**English** · [Bahasa Indonesia](./SECURITY.id.md)

Aika is an internal tool, not an open-source product. There is no bug bounty and there are no external security researchers. What follows is the internal policy that applies to Aika and to every client project derived from it.

## Reporting a security issue

**Do not** open a public issue in any client repository. The client can see it.

Report through an internal channel (team group or a DM to the repository owner). Include: repository and file, reproduction steps, the impact you suspect, and whether client data is involved.

## Secrets

- **No secrets in the repository.** No API keys, credentials, or connection strings — not in code, not in tests, not in fixtures, not in comments.
- `.env` is never committed. `.gitignore` already excludes it. Only `.env.example` is committed, and it contains fake values only.
- On the VPS, the environment lives at `/etc/aika/env` — **outside the deployed application directory**. It is read via `--env-file-if-exists` from `ecosystem.config.cjs`.
- If a secret does land in git, changing it in a later commit is **not enough**. It is in the history. Rotate the secret, then clean the history.

## Database

- The SQLite file (`.db`, `-wal`, `-shm`) and all backups **never** enter git.
- Backups are written outside any web-served directory. No `.db` may ever be downloadable over HTTP.
- Backups are **client data**. Treat them with the same care as the production database: restricted access, never copied to a personal laptop, never sent over chat.
- Each client project uses its own database file on its own VPS. There is no shared database between clients.

## Dependencies

Check before adding:

- Is the package actually necessary, or is something simpler available in the ecosystem?
- How many maintainers? When was it last released?
- Does it ship a **postinstall script**? npm runs those automatically, and it is the classic supply-chain attack vector. A package with an unexplained postinstall should not be used.

Two Aika-specific notes:

- **`allowScripts` in `package.json` is pinned to exact versions.** npm 11 makes install scripts opt-in, and the pin means an upgraded dependency must be re-approved deliberately. Never set `dangerously-allow-all-scripts`. Run `npm install-scripts ls` to see what is pending.
- **Do not run `npm audit fix --force`** on a repository that already serves a client. It can cross major versions and break the deploy.

Every added dependency carries a second runtime. Aika is deliberately one process.

## Each client project's own responsibility

Aika provides a foundation, not a guarantee. Before any client site goes to production, confirm:

- `APP_URL` is a correct absolute `https://` URL. Aika refuses to boot otherwise.
- TLS is terminated at the reverse proxy.
- The `.env` file on the VPS has restricted read permissions.
- Backups are scheduled **and have been restored at least once**. A backup that has never been test-restored is not a backup.
- The reverse proxy does not buffer `text/event-stream`.
- Any default development admin account has been replaced, if the `auth` feature is in use.
