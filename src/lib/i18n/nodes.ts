import type { MessageKey } from "./messages";
import type { Vars } from "./translate";

type T = (key: MessageKey, vars?: Vars) => string;

/** A node kind's display name in the active language (falls back to English `fallback`). */
export function nodeLabel(t: T, type: string, fallback: string): string {
  const key = `canvas.node.${type}.label` as MessageKey;
  const out = t(key);
  return out === key ? fallback : out;
}

/** A node kind's one-line description in the active language. */
export function nodeDescription(t: T, type: string, fallback: string): string {
  const key = `canvas.node.${type}.desc` as MessageKey;
  const out = t(key);
  return out === key ? fallback : out;
}

const PORT_KEYS: Record<string, MessageKey> = {
  text: "canvas.port.text",
  file: "canvas.port.file",
  image: "canvas.port.image",
  audio: "canvas.port.audio",
  video: "canvas.port.video",
  context: "canvas.port.context",
  prompt: "canvas.port.prompt",
  reference: "canvas.port.reference",
  "first frame": "canvas.port.firstFrame",
  result: "canvas.port.result",
  media: "canvas.port.media",
};

/** A port's label ("First frame", "Context") in the active language. */
export function portLabel(t: T, label: string): string {
  const key = PORT_KEYS[label.trim().toLowerCase()];
  return key ? t(key) : label;
}
