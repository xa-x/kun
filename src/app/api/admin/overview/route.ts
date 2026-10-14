import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, graphs, jobs, organizations, runs, templates, usageLedger, users } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";
import { SIGNUP_OPEN } from "@/lib/signup-mode";
import { polarEnabled } from "@/lib/polar";
import { unsplashConfigured } from "@/lib/unsplash";
import { envApiKey } from "@/lib/providers";

export const runtime = "nodejs";

const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const now = Date.now();
    const d1 = new Date(now - DAY);
    const d14 = new Date(now - 14 * DAY);
    const d30 = new Date(now - 30 * DAY);

    const [[u], [o], [g], [t], plans, [storage], [r24], [e24], [spend30], queued, failed, series] =
      await Promise.all([
        db.select({ v: count() }).from(users),
        db.select({ v: count() }).from(organizations),
        db.select({ v: count() }).from(graphs),
        db.select({ v: count() }).from(templates),
        db
          .select({ plan: organizations.plan, v: count() })
          .from(organizations)
          .groupBy(organizations.plan),
        db.select({ v: sql<number>`coalesce(sum(${artifacts.bytes}), 0)::float` }).from(artifacts),
        db.select({ v: count() }).from(runs).where(gte(runs.createdAt, d1)),
        db.select({ v: count() }).from(runs).where(and(gte(runs.createdAt, d1), eq(runs.status, "error"))),
        db
          .select({ v: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)::float` })
          .from(usageLedger)
          .where(gte(usageLedger.createdAt, d30)),
        db.select({ v: count() }).from(jobs).where(inArray(jobs.status, ["queued", "running"])),
        db.select({ v: count() }).from(jobs).where(and(eq(jobs.status, "error"), gte(jobs.createdAt, d1))),
        db
          .select({
            day: sql<string>`to_char(date_trunc('day', ${runs.createdAt}), 'YYYY-MM-DD')`,
            runs: count(),
            failed: sql<number>`count(*) filter (where ${runs.status} = 'error')::int`,
          })
          .from(runs)
          .where(gte(runs.createdAt, d14))
          .groupBy(sql`date_trunc('day', ${runs.createdAt})`)
          .orderBy(sql`date_trunc('day', ${runs.createdAt})`),
      ]);

    const env = (k: string) => Boolean((process.env[k] ?? "").trim());
    return NextResponse.json({
      totals: {
        users: Number(u?.v ?? 0),
        workspaces: Number(o?.v ?? 0),
        projects: Number(g?.v ?? 0),
        posts: Number(t?.v ?? 0),
        storageBytes: Number(storage?.v ?? 0),
      },
      plans: Object.fromEntries(plans.map((p) => [p.plan, Number(p.v)])),
      last24h: { runs: Number(r24?.v ?? 0), failedRuns: Number(e24?.v ?? 0) },
      spend30dUsd: Number(spend30?.v ?? 0) / 1e6,
      queue: { active: Number(queued[0]?.v ?? 0), failed24h: Number(failed[0]?.v ?? 0) },
      series: series.map((s) => ({ day: s.day, runs: Number(s.runs), failed: Number(s.failed) })),
      health: [
        { id: "openrouter", label: "Model provider (OpenRouter key)", ok: Boolean(envApiKey()), fix: "Set OPENROUTER_API_KEY." },
        {
          id: "supabase",
          label: "Supabase auth",
          ok: env("NEXT_PUBLIC_SUPABASE_URL") && (env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
          fix: "Set the Supabase URL and publishable key.",
        },
        { id: "database", label: "Database", ok: env("DATABASE_URL"), fix: "Set DATABASE_URL." },
        {
          id: "storage",
          label: "File storage (R2)",
          ok: env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY"),
          fix: "Without R2, files are written to local disk and are lost on redeploy.",
        },
        { id: "polar", label: "Payments (Polar)", ok: polarEnabled(), fix: "Without Polar, plan changes and top-ups apply instantly for admins only." },
        { id: "unsplash", label: "Stock photos (Unsplash)", ok: unsplashConfigured(), fix: "Set UNSPLASH_ACCESS_KEY to enable the Free photos tab." },
        { id: "site", label: "Public site URL", ok: env("NEXT_PUBLIC_SITE_URL"), fix: "Set NEXT_PUBLIC_SITE_URL so links and previews use the right host." },
        { id: "admins", label: "Platform admins", ok: env("ADMIN_EMAILS"), fix: "Set ADMIN_EMAILS." },
      ],
      signupOpen: SIGNUP_OPEN,
    });
  } catch (e) {
    return fail(e);
  }
}
