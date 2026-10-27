# Roadmap

**English** · [Bahasa Indonesia](./ROADMAP.id.md)

## What this file is

This is the only place that answers "what are we building next, and why".

It is deliberately not three other things:

- **Not a changelog.** Shipped work leaves this file and appears in [CHANGELOG.md](./CHANGELOG.md). Nothing is ever ticked off and kept.
- **Not an architecture document.** [ARCHITECTURE.md](./ARCHITECTURE.md) says how Aika is built.
- **Not a wish list.** Every item here traces back to shipping a real client site.

**The one discipline that keeps it honest:** when something ships, delete it from here. A roadmap that accumulates finished items becomes a roadmap nobody reads. If this file grows past roughly one page, it has stopped working.

## Where Aika stands

Three features (`auth`, `contact`, `health`). The foundation is verified rather than assumed: boundaries enforced by a script, migrations that snapshot before they touch anything, backups taken online, one process, a suite that has to stay green before anything merges, and feature owned routing, the sign in flow, and the contact form all proven against a production build.

A clone now produces a small working site: a header, a footer, three pages, a form that stores a message, and a staff inbox behind a session. That site is also the example, so it doubles as the tutorial for anybody new to Aika.

**No client project has started yet, and work comes in bursts.** Worth stating plainly, because it decides what is worth building. When the project is picked up after a gap, what matters is that it still makes sense on return: hence the tests, the rule about deleting shipped items from this file, and the site itself doubling as the example.

**Nothing a client would pay for exists yet.** That is expected at this stage, but it should not be described as anything else.

## Open decisions

These block whole phases. Decide them before starting the phase, not during it.

| Decision | Blocks | Why it is still open |
|---|---|---|
| **CMS: build a lean one, or adopt Directus or Payload?** | All of Phase 2 | Building the 80% of WordPress that clients actually use is roughly 10 to 14 weeks for one person. Adopting means a second framework in a stack that already has Nuxt, and possibly a schema that cannot be diffed in git, which would fight the distribution model. |
| **How much of the admin UI gets generated from a schema?** | Phase 2 | If content models are declared as data, then admin CRUD screens, SEO fields, and content API endpoints can all be generated instead of written by hand. This is the highest-leverage investment available to Aika. |

Resolved: a client project learns the conventions from `docs/aika/BUILDING.md`,
which walks through adding a feature using the `health` feature as the worked
example. Aika's own documentation moved into `docs/aika/` so that a client's
`README.md` can live at the root without ever conflicting.

## Phase 1: the minimum a client site needs

- [ ] **Enforce `role`.** `users.role` exists and nothing reads it, so every signed-in user is currently an administrator.

## Phase 2: the WordPress-like part

Blocked by the open decisions above.

- [ ] Content model registry: collections and fields declared as data.
- [ ] Admin CRUD generated from that registry.
- [ ] `blog` as the first real content type, proving the pattern.
- [ ] Draft and published states.
- [ ] Rich text or block content.

## Phase 3: production hardening

- [ ] Structured logging. Today the only logging is one `console.error` call.
- [ ] Security headers, CSRF, rate limiting, and a request body size budget.
- [ ] Rate limiting on auth endpoints specifically.
- [ ] A deploy script per client, with health check gating and rollback.
- [ ] **Backup restore exercised in CI.** A backup that has never been restored is not a backup.
- [ ] Error tracking.

## Phase 4: only when a client pays for it

- [ ] Server-sent events for live updates.
- [ ] Multi-language content.
- [ ] **Notify someone when a contact form is submitted, and give staff an inbox to read them in.** `features/contact/` stores submissions now, but nobody is told and there is no screen to read them on, so a message currently sits in the table until somebody opens the database by hand.

## Deliberately not on this roadmap

Recorded so nobody reopens them without a reason. Cross-check [ARCHITECTURE.md](./ARCHITECTURE.md), "What Aika does not build".

- A visual page builder. It is the largest single item in any CMS build and the least used by small clients.
- Multi-tenancy in one database. Every client gets its own VPS and its own database file.
- A plugin system. Features are installed by pulling source.
- A second frontend framework.

## How to change this file

Move an item up only with a reason tied to a client. If a client needs something that is not listed here, that is the correct reason to add it, and it should replace something else rather than being appended.

## Why this file exists at all, rather than a features document

A separate feature catalogue, mapping which client has which feature, is not worth maintaining yet. There are no clients to map, so it would rot immediately.

Add one when the third client project starts. Until then this roadmap plus [FEATURES in the changelog](./CHANGELOG.md) is enough to see where things stand.
