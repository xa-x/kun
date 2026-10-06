import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { getSkill, listSkillRecords } from "@/lib/skills";
import { skillToMarkdown, toSkillsBundle } from "@/lib/skills/bundle";

export const runtime = "nodejs";

/**
 * GET /api/skills/export?id=<skill> → that skill as SKILL.md
 * GET /api/skills/export           → whole library as a kun/skills bundle
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const skill = await getSkill(actor.org.id, id);
      if (!skill) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      const md = skillToMarkdown({
        slug: skill.slug,
        displayName: skill.displayName,
        description: skill.description,
        body: skill.body,
      });
      return new NextResponse(md, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="${skill.slug}-SKILL.md"`,
        },
      });
    }
    const records = await listSkillRecords(actor.org.id);
    const bundle = toSkillsBundle(
      records.map((s) => ({
        slug: s.slug,
        displayName: s.displayName,
        description: s.description,
        body: s.body,
      })),
    );
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="kun-skills.json"',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
