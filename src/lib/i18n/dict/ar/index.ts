import { common } from "./common";
import { shell } from "./shell";
import { settings } from "./settings";
import { site } from "./site";
import { editor } from "./editor";
import { canvas } from "./canvas";

export const ar = { ...common, ...shell, ...settings, ...site, ...editor, ...canvas };
