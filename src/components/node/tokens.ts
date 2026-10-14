import type { PortType } from "@/lib/nodes";
import type { MessageKey } from "@/lib/i18n/messages";

/** Wire / port colour per data type. Resolved by CSS so light and dark both work. */
export const PORT_COLOR: Record<PortType, string> = {
  text: "var(--color-t-text)",
  image: "var(--color-t-image)",
  audio: "var(--color-t-audio)",
  video: "var(--color-t-video)",
  json: "var(--color-t-json)",
  any: "var(--color-muted)",
};

/** Message keys for the plain-language port type names (translate with `t`). */
export const PORT_TYPE_KEY: Record<PortType, MessageKey> = {
  text: "canvas.port.text",
  image: "canvas.port.image",
  audio: "canvas.port.audio",
  video: "canvas.port.video",
  json: "canvas.portType.json",
  any: "canvas.portType.any",
};

/** Plain-language names, used for tooltips and the legend. */
export const PORT_NAME: Record<PortType, string> = {
  text: "Text",
  image: "Image",
  audio: "Audio",
  video: "Video",
  json: "Data",
  any: "Anything",
};
