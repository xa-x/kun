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
- **Drizzle ORM + better-sqlite3** — workbooks, run history, per-node usage
- Media artifacts stored on disk under `.data/media`

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

## Providers (registry-based)

Providers are resolved from a registry (`src/lib/providers.ts`). Each spec
declares its capabilities (`chat` / `image` / `video`), and any
OpenAI-compatible gateway can be added as a new spec entry:

| id           | capabilities       | config                        |
| ------------ | ------------------ | ----------------------------- |
| `openrouter` | chat, image, video | `OPENROUTER_API_KEY`          |
| `pyok`       | chat, image        | `PYOK_BASE_URL` + `PYOK_API_KEY`|

Credentials: the client's Settings (⚙︎, stored in localStorage) ride with
each run; server `.env` values are the fallback. Adding a provider = one
entry in `PROVIDER_SPECS` — model dropdowns, `/api/models` listing, and the
runners pick it up automatically.

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
cp .env.local.example .env.local   # add OPENROUTER_API_KEY
npm run dev                        # http://localhost:3000
```

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
