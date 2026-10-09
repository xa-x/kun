import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { fail, requireActor } from "@/lib/auth";
import { assertWithinCredits } from "@/lib/runs/enqueue";
import { meterModelCall } from "@/lib/metering";
import { canEdit } from "@/lib/tenant";
import { resolveProvider } from "@/lib/providers";
import {
  buildSkillSystemPrompt,
  buildSkillUserPrompt,
  extractSkillMarkdown,
  guessSkillKind,
  type SkillKindHint,
} from "@/lib/skills";

export const runtime = "nodejs";
export const maxDuration = 120;

const request = z.object({
  brief: z.string().min(3).max(4000),
  name: z.string().max(80).optional(),
  kind: z.enum(["text", "image", "video", "voice", "generic"]).optional(),
});

/** POST /api/skills/generate — draft a SKILL.md with the org's model. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = request.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Describe what the skill should do (3+ characters)." },
        { status: 400 },
      );
    }
    await assertWithinCredits(actor.org.id, actor.org.plan);
    const p = resolveProvider();
    const chatModel = "google/gemini-2.5-flash";
    const kind: SkillKindHint = parsed.data.kind ?? guessSkillKind(parsed.data.brief);
    const result = await generateText({
      model: p.gw.chat(chatModel) as LanguageModel,
      system: buildSkillSystemPrompt(kind),
      prompt: buildSkillUserPrompt(parsed.data.brief, { name: parsed.data.name }),
    });
    await meterModelCall(actor.org.id, "skill", chatModel, {
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    });
    const markdown = extractSkillMarkdown(result.text ?? "");
    if (!markdown) {
      return NextResponse.json(
        { error: "The model returned an empty draft — try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ markdown });
  } catch (e) {
    return fail(e);
  }
}
