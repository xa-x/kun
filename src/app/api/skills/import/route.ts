import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { canEdit } from "@/lib/tenant";
import {
  createLocalSkill,
  listSkills,
  materializePortableSkills,
} from "@/lib/skills";
import { parseSkillsBundle } from "@/lib/skills/bundle";
import { isPortable } from "@/lib/portable";

export const runtime = "nodejs";

/**
 * POST /api/skills/import
 *   { markdown }                    — one SKILL.md (pasted or uploaded)
 *   { bundle }                      — kun/skills bundle, or a workbook
 *                                     export whose skills get materialized
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));

    if (typeof body.markdown === "string" && body.markdown.trim()) {
      const skill = await createLocalSkill(
        actor.org.id,
        actor.user.id,
        { body: body.markdown },
      );
      return NextResponse.json({ skills: [skill] }, { status: 201 });
    }

    const incoming = body.bundle ?? body;
    const bundleSkills =
      parseSkillsBundle(incoming) ??
      (isPortable(incoming) ? incoming.skills ?? null : null);
    if (!bundleSkills) {
      return NextResponse.json(
        {
          error:
            "Send a SKILL.md as { markdown } or a skills/workbook bundle as { bundle }.",
        },
        { status: 400 },
      );
    }
    await materializePortableSkills(actor.org.id, actor.user.id, bundleSkills);
    const skills = await listSkills(actor.org.id);
    const wanted = new Set(bundleSkills.map((s) => s.slug));
    return NextResponse.json(
      { skills: skills.filter((s) => wanted.has(s.slug)) },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}
