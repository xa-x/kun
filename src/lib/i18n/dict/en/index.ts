import { common } from "./common";
import { shell } from "./shell";
import { settings } from "./settings";
import { site } from "./site";
import { editor } from "./editor";
import { canvas } from "./canvas";

/** Every English message. This is the source of truth for the key set. */
export const en = { ...common, ...shell, ...settings, ...site, ...editor, ...canvas };
