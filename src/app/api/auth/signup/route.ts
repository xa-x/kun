import { NextRequest, NextResponse } from "next/server";
import { fail, signup } from "@/lib/auth";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!SIGNUP_OPEN) {
      return NextResponse.json(
        { error: "Sign-up is invite-only while we're in development." },
        { status: 403 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const { needsConfirmation } = await signup(
      String(body.email ?? ""),
      String(body.password ?? ""),
      typeof body.name === "string" ? body.name : undefined,
    );
    if (needsConfirmation) {
      return NextResponse.json(
        {
          ok: true,
          needsConfirmation: true,
          message: "Check your email to confirm your account, then sign in.",
        },
        { status: 202 },
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
