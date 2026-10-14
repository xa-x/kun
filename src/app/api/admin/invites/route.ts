import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformInvites, users } from "@/db/schema";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";
import { platformAdminEmails } from "@/lib/admin";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const rows = await db.select().from(platformInvites).orderBy(desc(platformInvites.createdAt));
    const joined = new Set((await db.select({ e: users.email }).from(users)).map((u) => u.e));
    const fromEnv = (process.env.INVITED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    return NextResponse.json({
      invites: rows.map((r) => ({ email: r.email, note: r.note, createdAt: r.createdAt, joined: joined.has(r.email) })),
      fixed: [...new Set([...platformAdminEmails(), ...fromEnv])].map((email) => ({
        email,
        source: platformAdminEmails().includes(email) ? "admin" : "env",
        joined: joined.has(email),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const body = await req.json().catch(() => ({}));
    const emails = String(body.emails ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const bad = emails.filter((e) => !EMAIL.test(e));
    if (!emails.length || bad.length) {
      return NextResponse.json({ error: bad.length ? `Not an email address: ${bad[0]}` : "Enter one or more email addresses." }, { status: 400 });
    }
    if (emails.length > 50) return NextResponse.json({ error: "Up to 50 at a time." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 120) || null : null;
    await db
      .insert(platformInvites)
      .values(emails.map((email) => ({ email, note, invitedBy: gate.actor.user.email })))
      .onConflictDoNothing();
    await audit(gate.actor, "invite.add", { type: "invite", id: emails.join(",").slice(0, 120) }, { count: emails.length });
    return NextResponse.json({ added: emails.length }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    await db.delete(platformInvites).where(eq(platformInvites.email, email));
    await audit(gate.actor, "invite.remove", { type: "invite", id: email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
