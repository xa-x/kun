import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { saveArtifact } from "@/lib/artifacts";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
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
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
    }

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
    const art = await saveArtifact(buf, mime, kind, undefined, actor.org.id);
    return NextResponse.json({ id: art.id, url: `/api/media/${art.id}` });
  } catch (e) {
    return fail(e);
  }
}
