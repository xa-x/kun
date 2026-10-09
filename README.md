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
- **Supabase** — Auth for sign-in, Postgres (via Drizzle ORM) for workbooks,
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
| `(site)`      | `/templates`, `/templates/[slug]`, `/pricing` | adapts: workspace shell if signed in, marketing chrome if not |
| `(auth)`      | `/sign-in`, `/sign-up`                | split form + photograph, no app chrome              |
| `(app)`       | `/workbooks`, `/runs`, `/billing`     | workspace shell (sidebar, account menu, sign out)   |
| `(editor)`    | `/w/[id]`                             | full-bleed canvas, no shell                         |
| `(admin)`     | `/admin`                              | workspace shell, gated to `ADMIN_EMAILS`            |
| (ungrouped)   | `/s/[token]`                          | public read-only share viewer                       |

### Auth routing

Two layers, deliberately split so they cannot loop:

1. `src/proxy.ts` is an optimistic gate. For `/workbooks`, `/w`, `/runs`,
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

- Both limits are hard caps, checked in `enqueueRun` before a run starts
  (manual, API, MCP, schedule and webhook alike). The assistant and skill
  generator are metered and gated by the credit cap too. The run that crosses the credit
  line still finishes, so the cap can be overshot by one run.
- Usage is the billed cost: provider cost, then the admin's per-model price
  override and margin (`/admin`, `src/lib/model-policy.ts`). It is written to
  `usage_ledger` in micro-dollars when a run finishes.
- There is no payment provider yet. `POST /api/billing/checkout` switches the
  plan instantly, which in production is limited to `ADMIN_EMAILS`.

## Access

- Sign-up is invite-only (`SIGNUP_OPEN` in `src/lib/signup-mode.ts`). While
  it is closed, a new account only gets a workspace if its email is in
  `ADMIN_EMAILS` or `INVITED_EMAILS` — the Supabase publishable key is public,
  so creating an Auth user alone gets nobody in. Keep email confirmation on
  in Supabase Auth so an address can't be claimed by someone else.
- API keys (`kun_…`) carry scopes: `read` (GET), `run` (start/cancel runs),
  `write` (edit workbooks, skills, uploads, assistant) and `mcp`. Keys can
  never manage keys, billing or the admin API — those need a session.
- Media is private to its workspace. Outside it, a file is readable only
  while a workbook that shows it has an active share link.

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
| `text`/`note` | raw text / system-style instruction           |
| `skill` | Agent Skill (`SKILL.md`) — pick from bundled, installed, or [skills.sh](https://www.skills.sh) |
| `image.in` / `audio.in` / `video.in` | uploads (stored as artifacts) |
| `llm`       | chat model (vision: attach an upstream image)  |
| `image.gen` | text-to-image (Seedream, Gemini Image, …)      |
| `tts`       | text-to-speech through the provider's speech endpoint |
| `video.gen` | text/image-to-video (Seedance, Veo) via `experimental_generateVideo` |
| `out.text`  | renders whatever arrives — HTML preview, JSON viewer, code, prose, media |
| `out.media` | media sink, reusable as input                  |

Ports are typed (`text | image | audio | video`) and connections are
validated against them. Output nodes classify model output automatically
(full HTML documents preview live in a sandboxed iframe).

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

Publish a workbook from the editor (**Publish**). It lands in the public
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

## API

| route            | purpose                                          |
| ---------------- | ------------------------------------------------ |
| `POST /api/run`  | execute a graph; NDJSON event stream             |
| `GET /api/runs`  | run history (`?graphId=` / `?runId=&nodes=1`)     |
| `GET/POST/PATCH/DELETE /api/graphs` | workbook list (metadata) + CRUD |
| `GET /api/graphs/[id]` | one workbook document                    |
| `POST /api/models` | per-provider model lists (OpenAI-compatible `/models`) |
| `POST /api/upload` | media upload (multipart)                        |
| `GET /api/media/[id]` | stream a stored artifact                    |
| `GET /api/config` | which providers have server-side keys            |
| `GET /api/health` | liveness                                         |
| `POST /api/runs` | enqueue a durable run (`202 { runId }`)          |
| `GET /api/runs/[id]/events` | SSE event stream + reconnect (`?after=`) |
| `POST /api/mcp` | scoped MCP tools for agents                      |
| `POST /api/webhooks/[token]` | signed workbook trigger                   |
| `GET/POST/DELETE /api/skills` | list / author / delete org skills       |
| `GET /api/skills/search` | search [skills.sh](https://www.skills.sh) |
| `POST /api/skills/install` | fetch SKILL.md from GitHub and install    |
| `GET/POST /api/templates` | public gallery + publish a workbook       |
| `GET/DELETE /api/templates/[slug]` | template detail / unpublish          |
| `POST /api/templates/[slug]/clone` | clone a template into your org      |
