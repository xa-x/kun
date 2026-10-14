import type { MessageKey } from "@/lib/i18n/messages";

type T = (key: MessageKey) => string;

/** A plan id ("free", "pro", "team") as a localized name; unknown ids pass through. */
export function planName(t: T, plan: string): string {
  switch (plan) {
    case "free":
      return t("common.free");
    case "pro":
      return t("common.pro");
    case "team":
      return t("common.team");
    default:
      return plan;
  }
}
