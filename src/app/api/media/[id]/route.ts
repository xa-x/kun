import { NextRequest } from "next/server";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, graphs, shares, type ArtifactRow } from "@/db/schema";
import { resolveActor } from "@/lib/auth";
import { objectStore } from "@/lib/storage";
import { ensurePlayableAudio } from "@/lib/audio";

export const runtime = "nodejs";

/**
 * Outside the owning workspace, an artifact is readable only while a workbook
 * that currently shows it has an active share link — that is exactly what the
 * /s/[token] view renders, uploads and run outputs alike. Older runs of a
 * shared workbook stay private.
 */
async function reachableViaActiveShare(row: ArtifactRow) {
  if (!row.orgId) return false;
  const [share] = await db
    .select({ id: shares.id })
    .from(shares)
    .innerJoin(graphs, eq(graphs.id, shares.graphId))
    .where(
      and(
        eq(shares.orgId, row.orgId),
        or(isNull(shares.expiresAt), gt(shares.expiresAt, new Date())),
        sql`${graphs.graph}::text like ${`%"${row.id}"%`}`,
      ),
    )
    .limit(1);
  return Boolean(share);
}

function fileNameOf(filename: string, id: string, mime: string) {
  const base = filename.split("/").pop() || "";
  if (base && base !== filename) return base;
  const ext =
    mime === "video/mp4"
      ? "mp4"
      : mime === "video/webm"
        ? "webm"
        : mime === "audio/mpeg"
          ? "mp3"
          : mime === "audio/wav"
            ? "wav"
            : mime === "image/jpeg"
              ? "jpg"
              : mime === "image/webp"
                ? "webp"
                : mime === "image/png"
                  ? "png"
                  : "bin";
  return base || `kun-${id}.${ext}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [row] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!row) return new Response("not found", { status: 404 });
  const actor = await resolveActor(req).catch(() => null);
  const own = Boolean(actor && row.orgId && row.orgId === actor.org.id);
  if (!own && !(await reachableViaActiveShare(row))) {
    return actor
      ? new Response("not found", { status: 404 })
      : new Response("unauthorized", { status: 401 });
  }

  const raw = await objectStore.get(row.filename);
  if (!raw) return new Response("gone", { status: 410 });

  const playable =
    row.kind === "audio"
      ? ensurePlayableAudio(raw, row.mimeType)
      : { data: raw, mime: row.mimeType };
  const data = playable.data;
  const mime = playable.mime;
  const size = data.byteLength;
  const download = req.nextUrl.searchParams.has("download");
  const name = fileNameOf(row.filename, id, mime);

  const headers: Record<string, string> = {
    "content-type": mime,
    "accept-ranges": "bytes",
    // Media shares the app's origin: never let a file be sniffed into, or
    // opened as, an active document.
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox; default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'",
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
    "cache-control":
      row.kind === "audio" || row.kind === "video"
        ? "private, max-age=60, must-revalidate"
        : "private, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : size - 1;
      if (!m[1] && m[2]) {
        const suffix = Number(m[2]);
        start = Math.max(0, size - suffix);
        end = size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
      }
      end = Math.min(end, size - 1);
      if (start < 0 || start > end || start >= size) {
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${size}` },
        });
      }
      const slice = data.subarray(start, end + 1);
      return new Response(Buffer.from(slice), {
        status: 206,
        headers: {
          ...headers,
          "content-length": String(slice.byteLength),
          "content-range": `bytes ${start}-${end}/${size}`,
        },
      });
    }
  }

  return new Response(Buffer.from(data), {
    headers: {
      ...headers,
      "content-length": String(size),
    },
  });
}
