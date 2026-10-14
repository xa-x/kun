import type { MessageKey } from "@/lib/i18n/messages";

type T = (key: MessageKey) => string;

/** An asset kind ("image", "video", "audio") as a localized word. */
export function kindLabel(t: T, kind: string): string {
  switch (kind) {
    case "image":
      return t("common.image");
    case "video":
      return t("common.video");
    case "audio":
      return t("common.audio");
    default:
      return kind;
  }
}
