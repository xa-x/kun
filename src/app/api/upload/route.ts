import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { saveArtifact } from "@/lib/artifacts";
import { planOf, uploadLimitBytes } from "@/lib/billing";

export const runtime = "nodejs";

/** Hard ceiling for the request itself; each plan sets its own, lower, limit. */
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const plan = planOf(actor.org.plan);
    const tooBig = () =>
      NextResponse.json(
        { error: `Files can be up to ${plan.uploadMb} MB on the ${plan.label} plan.` },
        { status: 413 },
      );
    if (Number(req.headers.get("content-length") ?? 0) > Math.min(MAX_UPLOAD_BYTES, uploadLimitBytes(plan) + 1024 * 1024)) {
      return tooBig();
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const mime =
      file.type ||
      (file.name.endsWith(".png")
        ? "image/png"
        : file.name.endsWith(".mp4")
          ? "video/mp4"
          : "application/octet-stream");

    // SVG (and anything else XML/HTML-based) can carry script, and media is
    // served from the app's own origin.
    if (/xml|html|svg/i.test(mime)) {
      return NextResponse.json({ error: `unsupported type: ${mime}` }, { status: 415 });
    }
    if (file.size > uploadLimitBytes(plan)) return tooBig();

    const kind = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("audio/")
        ? "audio"
        : mime.startsWith("video/")
          ? "video"
          : null;
    if (!kind) {
      return NextResponse.json({ error: `unsupported type: ${mime}` }, { status: 415 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const art = await saveArtifact(buf, mime, kind, undefined, actor.org.id, {
      source: "upload",
      meta: { name: file.name.slice(0, 120) },
    });
    return NextResponse.json({ id: art.id, url: `/api/media/${art.id}` });
  } catch (e) {
    return fail(e);
  }
}
