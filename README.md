# كُن · Kun

**كُن** — Arabic for *"Be!"* — the original generation command: speak it and
it is. A node-based AI workbook: combine text, image, audio and video nodes
into pipelines on an infinite canvas, run them against any provider, and
watch results stream in live.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + Tailwind 4
- **@xyflow/react** — the node canvas
- **AI SDK v7** (`ai` + `@openrouter/ai-sdk-provider`) — every AI call goes
  through AI SDK model instances (`chat` / `imageModel` / `videoModel`),
  with `streamText` for live token streaming and
  `experimental_generateVideo` for async video jobs
- **Supabase** — Auth for sign-in, Postgres (via Drizzle ORM) for projects,
  run history and usage
- **Cloudflare R2** — uploads and generated media, in a private bucket that
  only the server reads (`.data/media` on disk when the R2 variables are
  unset, for local development)

## Routes and layout

Each route group owns exactly one kind of layout, so a page never has to
guess what chrome surrounds it.

| group         | URLs                                  | layout                                              |
| ------------- | ------------------------------------- | --------------------------------------------------- |
| `(marketing)` | `/`                                   | landing page: marketing header + footer             |
| `(site)`      | `/community`, `/templates/[slug]`, `/pricing` | adapts: workspace shell if signed in, marketing chrome if not |
| `(auth)`      | `/sign-in`, `/sign-up`                | split form + photograph, no app chrome              |
| `(app)`       | `/workspace`, `/assets`, `/shared`, `/runs`, `/billing` | workspace shell (sidebar, account menu, sign out)   |
| `(editor)`    | `/w/[id]`                             | full-bleed canvas, no shell                         |
| `(admin)`     | `/admin`                              | workspace shell, gated to `ADMIN_EMAILS`            |
| (ungrouped)   | `/s/[token]`                          | public read-only share viewer                       |

### Auth routing

Two layers, deliberately split so they cannot loop:

1. `src/proxy.ts` is an optimistic gate. For `/workspace`, `/w`, `/runs`,
   `/billing` and `/admin` it only asks "is there a session cookie for *this*
   Supabase project?" and redirects to `/sign-in?next=...` if not. It never
   decides that someone *is* signed in, and it does not touch the auth pages.
2. Server layouts do the real check (`requirePageActor()` in `src/lib/guard.ts`,
   memoised per request). An expired or revoked session therefore lands on
   `/sign-in` with its destination preserved. The auth pages validate the
   session themselves and only redirect a *validated* user onward.

`?next=` is sanitised by `safeNext()` (`src/lib/routes.ts`): same-origin paths
only, and never an auth page, the landing page or an API route.

## Design system

Colour carries meaning. Surfaces are neutral; the only hues are the four data
types that travel along wires (text, image, audio, video) plus blue for
running, green for ok and red for error. Tokens live in `src/app/globals.css`.
The node card is one presentational component (`components/node/NodeFrame`),
shared by the canvas and the landing-page preview.

## Providers

Every model call goes through OpenRouter with the server's
`OPENROUTER_API_KEY` (`src/lib/providers.ts`). Users never bring their own
key, so model usage is metered and capped per workspace (see below).

## Plans and usage

Plans are defined in one place, `src/lib/billing.ts`:

| plan | runs / month | model credits / month | schedules, webhooks, MCP, versions | team |
| ---- | ------------ | --------------------- | ---------------------------------- | ---- |
| Free | 50           | $1                    | no                                 | no   |
| Pro  | 2,000        | $15                   | yes                                | no   |
| Team | 10,000       | $40                   | yes                                | yes  |

- The run limit is a hard cap, checked in `enqueueRun` before a run starts
  (manual, API, MCP, schedule and webhook alike).
- Model credits are spent in two steps: the plan's included credits, which
  reset monthly, then the org's prepaid balance (`organizations.credit_balance`),
  which Pro and Team top up in $10, $25 or $50 steps and which never expires.
  Work is refused only when both are empty. The assistant and skill generator
  are metered and gated the same way. The run that crosses the line still
  finishes, so the limit can be overshot by one run.
- Usage is the billed cost: provider cost, then the admin's per-model price
  override and margin (`/admin`, `src/lib/model-policy.ts`). It is written to
  `usage_ledger` in micro-dollars when a run finishes, along with the share
  the balance paid.
- Payments go through [Polar](https://polar.sh) (`src/lib/polar.ts`), a
  merchant of record. `POST /api/billing/checkout` and `/api/billing/topup`
  answer with a hosted checkout URL (or the customer portal for an existing
  subscriber); `POST /api/billing/webhook` then sets the plan or credits the
  balance. Without `POLAR_ACCESS_TOKEN` both routes apply the change
  instantly, which in production is limited to `ADMIN_EMAILS`.

### Polar setup

1. Create three products: Pro (monthly, $24), Team (monthly, seat-based,
   $39 a seat, 3-seat minimum) and Credits (one-time; its price is replaced per checkout).
   Put their ids in `POLAR_PRODUCT_PRO`, `POLAR_PRODUCT_TEAM` and
   `POLAR_PRODUCT_CREDITS`.
2. Create an organization access token with `checkouts:write` and
   `customer_sessions:write` for `POLAR_ACCESS_TOKEN`.
3. Add a webhook to `https://<site>/api/billing/webhook` for `order.paid`,
   `subscription.active`, `subscription.updated` and `subscription.revoked`;
   its secret is `POLAR_WEBHOOK_SECRET`.
4. Set `POLAR_SERVER=sandbox` to use Polar's sandbox, and
   `NEXT_PUBLIC_SITE_URL` so checkout returns to the right host.

## Access

- Sign-up is invite-only (`SIGNUP_OPEN` in `src/lib/signup-mode.ts`). While
  it is closed, a new account only gets a workspace if its email is in
  `ADMIN_EMAILS` or `INVITED_EMAILS` — the Supabase publishable key is public,
  so creating an Auth user alone gets nobody in. Keep email confirmation on
  in Supabase Auth so an address can't be claimed by someone else.
- API keys (`kun_…`) carry scopes: `read` (GET), `run` (start/cancel runs),
  `write` (edit projects, skills, uploads, assistant) and `mcp`. Keys can
  never manage keys, billing or the admin API — those need a session.
- Media is private to its workspace. Outside it, a file is readable only
  while a project that shows it has an active share link.

## Run engine

- Topological execution with a worker pool (max 4 concurrent nodes)
- `POST /api/run` streams NDJSON events:
  - `{type:"run"}` — run started/done (+ totals: cost, tokens, duration)
  - `{type:"node"}` — node queued/running/done/error (+ outputs, usage)
  - `{type:"delta"}` — live LLM token stream per node
- Every run is persisted: `runs` (aggregate) + `run_nodes` (per-node status,
  model, tokens in/out, cost in micro-dollars, duration)
- OpenRouter cost comes from provider metadata; usage totals roll up per run

## Node types

| kind        | what it does                                   |
| ----------- | ---------------------------------------------- |
| `text`      | raw text, also the prompt wired into a media node |
| `note`      | instruction, or an Agent Skill (`SKILL.md`) picked from bundled, installed, or [skills.sh](https://www.skills.sh) |
| `file.in`   | upload an image, audio or video file (stored as an artifact) |
| `llm`       | chat model (vision: attach an upstream image); shows its full result inline |
| `image.gen` | text-to-image (Seedream, Gemini Image, …); the card takes the picture's shape |
| `tts`       | text-to-speech through the provider's speech endpoint; shows a waveform |
| `video.gen` | text/image-to-video (Seedance, Veo) via `experimental_generateVideo` |
| `comment`, `group` | notes and frames on the canvas; a group can be run on its own. They never run as part of a project. |

There is no Output node: every node shows its own result. A node can be
**frozen** (it keeps its last result and is skipped on Run) and **pinned** with
Return (its result is what an API run hands back; with nothing pinned, the last
AI nodes are). Older projects that still have an Output node are converted when
they are opened.

Ports are typed (`text | image | audio | video`) and connections are
validated against them. Nodes classify model output automatically
(full HTML documents preview live in a sandboxed iframe).

## Languages

English and Arabic (right-to-left). The language is the `kun_lang` cookie, set from the language picker (Settings → Profile, the marketing header and footer, the sign-in pages); without it the browser's `Accept-Language` decides. There is no `/ar` URL prefix. The root layout sets `<html lang dir>` and hands the active messages to client components. Strings live in `src/lib/i18n/dict/{en,ar}/<area>.ts`; the Arabic files are typed against the English ones, so a missing translation fails `tsc`, and `dict.test.ts` checks plural forms and placeholders. Conventions, the Arabic glossary and the RTL rules are in `src/lib/i18n/README.md`. To add a language: add it to `LOCALES` in `config.ts`, create `dict/<code>/` files, and register them in `messages.ts`.

Not translated yet: error messages that API routes return (shown as received), project titles saved in English before the switch ("Untitled"), and model names.

## Workspaces, assets and community

- **Workspaces.** A workspace is an organization: it has its own projects, files, plan, credits, keys and members. A person can belong to several and own as many as their best plan allows (2 on Free). The active one is the `kun_ws` cookie, read when the session is resolved (`ensureWorkspace` in `src/lib/auth.ts`); `/api/workspaces` lists, creates and renames, `/api/workspaces/switch` changes it. API keys always act in the workspace they were made in.
- **Assets** (`/assets`). Every file in the workspace: uploads, generated media and saved stock photos, from the `artifacts` table (`source` = `upload | generated | stock`). Preview, rename, download, delete (with a "used in" warning). The same library opens as a picker from a File node (the Assets button), where it also takes uploads and Unsplash photos. Unsplash needs `UNSPLASH_ACCESS_KEY`; saved photos keep the photographer's credit and trigger Unsplash's download tracking.
- **Shared with me** (`/shared`). Opening someone's share link while signed in remembers it (`saved_shares`). Links that were revoked or expired drop off. Work in any workspace you belong to is not listed here.
- **Community** (`/community`, public). Published projects (the `templates` table) with a cover and up to six showcase files, likes, remix counts, a Trending/New/Most remixed feed and a live "Happening now" rail from `community_events`. Showcase files are the only media served publicly (`/api/media/[id]` checks `templates.media`); a publisher can switch them off. Each project keeps its own page at `/templates/[slug]`.

### Plan limits and settings

Limits live on the plan (`PLANS` in `src/lib/billing.ts`) and are enforced on the server, not just shown: monthly runs and model credits, projects per workspace (`assertCanCreateProject`, applied to create, duplicate, import, clone, fork and the MCP tools), file storage (`assertStorageFits`, checked inside `saveArtifact` so generated media counts too), the largest single upload, workspaces one person may own (judged by their best plan), and members. Usage for the Plan and usage screen comes from `GET /api/workspaces/usage`.

`/settings` has Profile, Workspace (rename, leave or delete), Members, Plan and usage, and Privacy and data. Members: roles owner, admin, editor, viewer; Team workspaces invite by link (`/join/[token]`, 7 days, optionally locked to an email). Privacy switches live on `organizations.settings` (`src/lib/workspace-settings.ts`): allow share links, allow Community publishing, and a default expiry for new share links. Export downloads every project as portable JSON. Deleting a workspace (`src/lib/workspace-delete.ts`) removes its content and files but keeps the billing ledger, and is refused while a subscription is active.

## Admin console

`/admin`, for the emails in `ADMIN_EMAILS` (everyone else gets a 403, and every `/api/admin/*` route checks the same). It has its own frame, a sidebar grouped as **Monitor**, **Customers**, **Content**, **Revenue** and **Platform**, separate from the customer app and always English.

- **Overview:** users, workspaces by plan, runs and failures in 24h, 30-day model spend, storage, job queue, a 14-day runs chart, and a checklist of what is configured (OpenRouter, Supabase, database, R2, Polar, Unsplash, site URL, admins).
- **Runs:** every run across workspaces, filter by status, open one to see each node's status, model, cost and error; stop a running run.
- **Queue:** background jobs; retry failed ones or drop stuck ones.
- **Users** and **Workspaces:** search; a workspace page shows members, usage, recent runs and projects, lets you change its plan, grant up to $500 of credit, or **suspend** it (it can't start runs; reversible; nothing is deleted). A workspace with a live Polar subscription can't have its plan overridden.
- **Access and invites:** switch sign-up between open and invite-only at runtime, and manage the invite allow-list (`platform_invites`; the `ADMIN_EMAILS` and `INVITED_EMAILS` env lists always count). Invited people register on the normal sign-up page.
- **Community** (feature or remove a post) and **Share links** (every public link that works; revoke one).
- **Billing and margin:** credits sold vs granted, what users were charged, recorded model cost and margin, cost by model, recent credit additions.
- **Models:** enablement, price overrides, margin, pins, and the spend check against OpenRouter.
- **Settings:** an announcement banner shown to everyone in the app, and maintenance mode that refuses new runs with a message (`platform_settings`, cached for 10s).
- **Audit log:** plan changes, credit grants, suspensions, run stops, job actions, invites, share revokes, post moderation, settings and model-policy edits, each with the admin's email (`admin_audit`).

## Skills

A skill is a `SKILL.md` file — YAML frontmatter plus instructions — the same
format as [skills.sh](https://www.skills.sh). Kun ships a small bundled
set, and you can search/install more from the registry.

- **Skill node** — pick a skill, edit its text, wire it into an AI node's
  prompt port. "Expand to AI Image" builds Skill → AI Text → AI Image.
- **Inline picker** — every AI node has a skill dropdown under the prompt.
  Chat models load the full body as a system message. Image / video / speech
  nodes get a capped brief so a 10KB skill doesn't blow up a media prompt.

Installed skills are org-scoped. Export and template publish inline the
skill bodies so a clone still resolves.

## Templates

Publish a project from the editor (**Publish**). It lands in the public
gallery at `/templates`. Cloning creates a private copy in your workspace.
Uploaded media is stripped; skills stay with the snapshot.

## Development

```bash
npm install
npm run dev                        # http://localhost:3000
```

`.env` needs:

| variable | what it is |
| -------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project (Auth) |
| `DATABASE_URL` | Supabase Postgres connection string (Settings → Database) |
| `OPENROUTER_API_KEY` | the platform's model key |
| `ADMIN_EMAILS` | comma-separated platform admins (`/admin`, plan switching) |
| `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_PRO`, `POLAR_PRODUCT_TEAM`, `POLAR_PRODUCT_CREDITS` | Polar payments (optional; see Polar setup) |
| `UNSPLASH_ACCESS_KEY` | free stock photos in Assets and the asset picker (optional; the tab explains itself without it) |
| `POLAR_SERVER` | `sandbox` for Polar's sandbox; defaults to production |
| `INVITED_EMAILS` | comma-separated emails allowed to join while sign-up is closed |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token (R2 → Manage API tokens, Object Read & Write on the bucket) |
| `R2_BUCKET` | media bucket name; defaults to `kun-media` |

Database schema lives in `src/db/schema.ts` (Supabase Postgres). Schema
migrations are in `supabase/migrations/`; one-off data migration scripts in
`scripts/`. Tables are created by `npm run db:push` (or the Supabase MCP) —
there is no auto-create on boot. To iterate on the schema:

```bash
npx drizzle-kit push
```

> **Note on the rename:** the app is كُن / Kun everywhere — UI, prompts,
> export bundle kinds (`kun/workbook`, `kun/skills`), storage/event/API-key
> prefixes (`kun.*`, `kun:*`, `Bearer kun_`), the `KUN_SECRET` env var, the
> `x-kun-signature` webhook header, and the local database file
> (`.data/kun.db`). The only Flowbook strings left live in git history.

## Automate

The **Automate** button (bolt) in the project bar opens a panel for running a project without opening it:

- **Live version.** Schedules, webhooks and API-key runs use the *published* version (`graphs.publishedGraph`), not the draft on the canvas. "Publish changes" goes live; the panel shows when the draft differs (`src/lib/publish.ts`).
- **Schedule.** Cron, five fields, UTC (`src/lib/cron-expr.ts`). Pro and Team.
- **Webhook.** `POST /api/webhooks/:token` with `Authorization: Bearer <secret>`. The JSON body fills Text and Instruction nodes by name for that run (`src/lib/run-inputs.ts`); the response lists which names were applied or ignored. Pro and Team.
- **API.** `POST /api/runs {graphId, input}` with a `kun_…` key, then `GET /api/runs/:id` (includes `result`).
- **MCP.** `/api/mcp` speaks JSON-RPC 2.0 (initialize, tools/list, tools/call) so Claude Code, Cursor and others can connect with a key.

## API

| route            | purpose                                          |
| ---------------- | ------------------------------------------------ |
| `POST /api/run`  | execute a graph; NDJSON event stream             |
| `GET /api/runs`  | run history (`?graphId=` / `?runId=&nodes=1`)     |
| `GET/POST/PATCH/DELETE /api/graphs` | project list (metadata) + CRUD |
| `GET /api/graphs/[id]` | one project document                    |
| `POST /api/models` | per-provider model lists (OpenAI-compatible `/models`) |
| `POST /api/upload` | media upload (multipart)                        |
| `GET /api/media/[id]` | stream a stored artifact                    |
| `GET /api/config` | which providers have server-side keys            |
| `GET /api/health` | liveness                                         |
| `POST /api/runs` | enqueue a durable run (`202 { runId }`)          |
| `GET /api/runs/[id]` | one run: `run`, per-node `nodes`, and `result`: the outputs of the nodes pinned with **Return**, or else of the last AI nodes (those nothing is wired out of) |
| `GET /api/runs/[id]/events` | SSE event stream + reconnect (`?after=`) |
| `POST /api/mcp` | scoped MCP tools for agents                      |
| `POST /api/webhooks/[token]` | signed project trigger                   |
| `GET/POST/DELETE /api/skills` | list / author / delete org skills       |
| `GET /api/skills/search` | search [skills.sh](https://www.skills.sh) |
| `POST /api/skills/install` | fetch SKILL.md from GitHub and install    |
| `GET/POST /api/templates` | public gallery + publish a project       |
| `GET/DELETE /api/templates/[slug]` | template detail / unpublish          |
| `POST /api/templates/[slug]/clone` | clone a template into your org      |
