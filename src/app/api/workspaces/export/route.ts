import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { graphs } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { toPortable } from "@/lib/portable";
import type { GraphDoc } from "@/lib/types";

export const runtime = "nodejs";

/** Everything you built here as one JSON file: each project in Kun's portable format. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const rows = await db.select().from(graphs).where(eq(graphs.orgId, actor.org.id));
    const body = {
      kind: "kun.workspace-export",
      exportedAt: new Date().toISOString(),
      workspace: { name: actor.org.name },
      projects: rows.map((g) => toPortable(g.graph as GraphDoc, { title: g.title })),
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="kun-${actor.org.slug}-export.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
