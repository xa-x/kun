import type { PortType } from "@/lib/nodes";

/** Wire / port colour per data type. Resolved by CSS so light and dark both work. */
export const PORT_COLOR: Record<PortType, string> = {
  text: "var(--color-t-text)",
  image: "var(--color-t-image)",
  audio: "var(--color-t-audio)",
  video: "var(--color-t-video)",
  json: "var(--color-t-json)",
};

/** Plain-language names, used for tooltips and the legend. */
export const PORT_NAME: Record<PortType, string> = {
  text: "Text",
  image: "Image",
  audio: "Audio",
  video: "Video",
  json: "Data",
};
