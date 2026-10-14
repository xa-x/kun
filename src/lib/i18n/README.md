# i18n (English, Arabic)

Cookie-based, no URL prefix. The `kun_lang` cookie (set by `LanguageSwitcher`) or, without it, the browser's
`Accept-Language` decides; the root layout sets `<html lang dir>` and provides messages to client components.

## Using it

```tsx
// client component
const { t, tn, locale, num, ago, until, date } = useI18n();   // from "@/lib/i18n"
t("shell.sidebar.assets");              // plain
t("shell.home.greeting", { name });     // "Hello, {name}"
tn("shell.home.projects", count);       // plural: keys …_one / …_other (en), + _zero/_two/_few/_many (ar); {n} is filled in

// server component / generateMetadata
const { t, tn } = await getT();         // from "@/lib/i18n/server"
```

Node kinds and port labels: `nodeLabel(t, type, fallback)`, `nodeDescription(...)`, `portLabel(t, label)` from `@/lib/i18n/nodes`.

## Where strings live

- English (source of truth): `dict/en/<area>.ts`, `export const <area> = { "<area>.thing": "…" } as const satisfies Record<string,string>`
- Arabic: `dict/ar/<area>.ts`, typed `Tr<typeof en>` so a missing key is a compile error.
- Areas: `common` (shared words, keys `common.*`), `shell`, `settings`, `site`, `editor`, `canvas`. Each area owns its files; keys are prefixed with the area name. Use `common.*` for shared words (cancel, save, delete…).
- Key style: `<area>.<component>.<thing>` in camelCase, e.g. `shell.sidebar.newProject`.

## What to translate

All user-visible text: JSX text, `placeholder`, `aria-label`, `title`, `alt`, toast and error messages written in client code,
`description` props, page `metadata` titles/descriptions (via `getT()` in `generateMetadata`).
Not: model names, node/port ids, API paths, code and curl samples, URLs, env var names, the brand name "Kun".
Module-level arrays of labels (nav items…) store a key and translate at render. Dates and relative times: `ago`, `until`, `date`
from `useI18n()`; numbers: `num()`. Arabic uses Western digits (0–9).

## RTL

Layouts mirror automatically from `dir="rtl"`. Write direction-aware CSS: `ms-/me-/ps-/pe-/start-/end-`, `text-start/text-end`,
`border-s/border-e`, `rounded-s/rounded-e`. Leave symmetric centering (`left-1/2 -translate-x-1/2`) alone. Directional icons
(arrows, carets that mean "forward/back") get the class `rtl-flip`. Free-text user content (prompts, titles, inputs and textareas)
gets `dir="auto"`. Code, URLs, emails and numbers inside Arabic text stay left-to-right (`dir="ltr"` or `<bdi>`).
The canvas (`.react-flow`) stays LTR on purpose.

## Arabic style

Modern Standard Arabic, short and natural for UI. Buttons use the verbal noun or imperative ("إنشاء مشروع", "حفظ").
Glossary: workspace مساحة العمل · project مشروع · assets الملفات · community المجتمع · shared with me مشاركة معي · run (verb/noun) تشغيل ·
runs التشغيلات · node عقدة · canvas اللوحة · prompt الموجِّه · model نموذج · template قالب · remix إعادة مزج · plan الخطة · credits الرصيد ·
schedule جدولة · webhook ويب هوك · API key مفتاح API · publish نشر · group مجموعة · comment تعليق · freeze تجميد · pin تثبيت ·
team فريق · member عضو · invite دعوة · billing الفوترة · usage الاستخدام · privacy الخصوصية · storage التخزين.
Keep "Kun" Latin in running text.
