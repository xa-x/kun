"use client";

import { useMemo, useState } from "react";
import { mdToHtml, parseTextOutput, type OutputBlock } from "@/lib/render";
import type { NodeOutput } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

/**
 * Universal output renderer — renders whatever the model responded with.
 * Full HTML pages/apps preview in a sandboxed iframe; markdown becomes
 * prose; JSON gets a viewer; bare media URLs become elements.
 */
export function playableSrc(src: string) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return src.includes("?") ? `${src}&play=1` : `${src}?play=1`;
}

export function downloadHref(src: string) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return src.includes("?") ? `${src}&download=1` : `${src}?download=1`;
}

export function filenameFor(kind: string, src: string) {
  const fromUrl = src.split("?")[0].split("/").pop();
  if (fromUrl && fromUrl.includes(".")) return fromUrl;
  const ext =
    kind === "video" ? "mp4" : kind === "audio" ? "mp3" : kind === "image" ? "png" : "bin";
  return `kun-${kind}.${ext}`;
}

export function downloadOutputs(
  outputs: { type: string; text?: string; url?: string }[],
) {
  let n = 0;
  for (const o of outputs) {
    if (o.type === "text" && o.text?.trim()) {
      const blob = new Blob([o.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `output-${++n}.txt`);
      setTimeout(() => URL.revokeObjectURL(url), 4_000);
    } else if (o.url) {
      triggerDownload(downloadHref(o.url), filenameFor(o.type, o.url));
    }
  }
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function OutputRenderer({
  output,
  hint,
}: {
  output: NodeOutput;
  /** width / height the node was asked for, used until the media loads */
  hint?: number;
}) {
  if (output.type === "text") {
    const blocks = parseTextOutput(output.text ?? "");
    return (
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    );
  }
  if (output.url) return <MediaEmbed kind={output.type} src={output.url} hint={hint} />;
  return null;
}

function BlockView({ block }: { block: OutputBlock }) {
  switch (block.kind) {
    case "html":
      return <HtmlPreview code={block.text} />;
    case "md":
      return (
        <div
          dir="auto"
          className="kun-prose nowheel max-h-[420px] overflow-auto rounded-lg border border-line bg-sunken px-3 py-2.5"
          dangerouslySetInnerHTML={{ __html: mdToHtml(block.text) }}
        />
      );
    case "json":
      return <JsonViewer text={block.text} />;
    case "code":
      return <CodeBlock lang={block.lang} text={block.text} />;
    default:
      return <MediaEmbed kind={block.kind} src={block.src} />;
  }
}

/** Live preview of generated pages/apps inside a locked-down iframe. */
function HtmlPreview({ code }: { code: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const src = useMemo(() => `data:text/html;charset=utf-8,${encodeURIComponent(code)}`, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="nowheel overflow-hidden rounded-lg border border-line bg-sunken">
      <div className="flex items-center justify-between border-b border-line px-2 py-1">
        <div className="flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.14em] rtl:tracking-normal">
          {(["preview", "code"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                view === v ? "bg-ink/[0.07] text-ink" : "text-faint hover:text-muted"
              }`}
            >
              {v === "preview" ? t("editor.output.preview") : t("editor.output.code")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] rtl:tracking-normal">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            title={t("editor.output.openTitle")}
            className="text-faint transition-colors hover:text-live"
          >
            {t("editor.output.open")}
          </a>
          <button onClick={copy} className="text-faint transition-colors hover:text-live">
            {copied ? t("editor.output.copiedCheck") : t("editor.output.copy")}
          </button>
        </div>
      </div>
      {view === "preview" ? (
        <iframe
          className="kun-frame nowheel h-[340px]"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          referrerPolicy="no-referrer"
          srcDoc={code}
          title={t("editor.output.generatedPage")}
        />
      ) : (
        <pre dir="ltr" className="max-h-[340px] overflow-auto whitespace-pre-wrap px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
          {code}
        </pre>
      )}
    </div>
  );
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <div className="nowheel overflow-hidden rounded-lg border border-line bg-sunken">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <span dir="ltr" className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          {lang || "code"}
        </span>
        <button onClick={copy} className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-live rtl:tracking-normal">
          {copied ? t("editor.output.copiedCheck") : t("editor.output.copy")}
        </button>
      </div>
      <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
        {text}
      </pre>
    </div>
  );
}

function JsonViewer({ text }: { text: string }) {
  const { t, tn } = useI18n();
  const pretty = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }, [text]);
  return (
    <details className="kun-json nowheel overflow-hidden rounded-lg border border-line bg-sunken">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-muted rtl:tracking-normal">
        <bdi>{"{ }"} {t("editor.output.json")}</bdi> · {tn("editor.output.lines", pretty.split("\n").length)}
      </summary>
      <pre dir="ltr" className="max-h-72 overflow-auto border-t border-line px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
        {pretty}
      </pre>
    </details>
  );
}

/** The tallest a preview grows inside a node. */
const MEDIA_MAX_H = 240;

/**
 * A frame that takes the media's own shape: wide clips wide, portrait clips
 * narrow and centred, square ones square. No letterbox bars, no cropping. It
 * starts from the shape the node was asked for (`hint`) and corrects itself
 * once the file reports its real size.
 */
function Framed({
  ratio,
  children,
}: {
  ratio: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="kun-media relative mx-auto overflow-hidden bg-black/30"
      style={{
        aspectRatio: ratio,
        width: `min(100%, ${Math.round(MEDIA_MAX_H * ratio)}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function MediaEmbed({
  kind,
  src,
  hint,
}: {
  kind: string;
  src: string;
  hint?: number;
}) {
  const { t } = useI18n();
  const [measured, setMeasured] = useState<number | null>(null);
  const ratio = measured ?? hint ?? (kind === "video" ? 16 / 9 : 1);
  const file = filenameFor(kind, src);
  const link = (
    <a
      href={downloadHref(src)}
      download={file}
      title={t("editor.output.download")}
      className="absolute end-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/95 opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
    >
      {t("editor.output.save")}
    </a>
  );
  if (kind === "image")
    return (
      <div className="group relative">
        {link}
        <Framed ratio={ratio}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h) setMeasured(w / h);
            }}
            className="nowheel h-full w-full object-contain"
          />
        </Framed>
      </div>
    );
  if (kind === "audio")
    return (
      <div className="group relative">
        {link}
        <audio
          controls
          preload="metadata"
          src={playableSrc(src)}
          className="nodrag mt-1 w-full"
        />
      </div>
    );
  if (kind === "video")
    return (
      <div className="group relative">
        {link}
        <Framed ratio={ratio}>
          <video
            controls
            playsInline
            preload="metadata"
            src={src}
            onLoadedMetadata={(e) => {
              const { videoWidth: w, videoHeight: h } = e.currentTarget;
              if (w && h) setMeasured(w / h);
            }}
            className="nowheel h-full w-full bg-black object-contain"
          />
        </Framed>
      </div>
    );
  return null;
}
