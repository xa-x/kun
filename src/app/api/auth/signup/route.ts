import { NextRequest, NextResponse } from "next/server";
import { fail, signup } from "@/lib/auth";
import { canSignUp } from "@/lib/platform";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!(await canSignUp(String(body.email ?? "")))) {
      return NextResponse.json(
        { error: "Sign-up is invite-only right now. Use the email address you were invited with." },
        { status: 403 },
      );
    }
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
