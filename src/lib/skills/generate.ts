import { SKILL_BODY_CAP } from "./format";

export type SkillKindHint = "text" | "image" | "video" | "voice" | "generic";

const KIND_NOTES: Record<SkillKindHint, string> = {
  text: "The skill steers text models (summarize, rewrite, extract, classify). Describe the exact output format under '## Output'.",
  image: "The skill steers image generation/editing. Include a '## Prompting' section with one compact, comma-separated prompt fragment (camera, light, mood, style).",
  video: "The skill steers video generation. Include a '## Prompting' section describing subject, one camera move, lighting, and pacing — no jump cuts.",
  voice: "The skill steers text-to-speech. Include a '## Prompting' section describing pace, tone, and delivery — no stage directions or music cues.",
  generic: "The skill may steer any node type. Include a '## Prompting' section only if it helps media prompting.",
};

export function buildSkillSystemPrompt(kind: SkillKindHint) {
  return `You write Kun Agent Skills — markdown instruction files (SKILL.md, the same format Claude Code uses) that steer AI nodes in Kun pipelines.

Output ONLY the SKILL.md file: YAML frontmatter, then markdown. The very first line must be \`---\`. No commentary, never wrap any part of the file in code fences.

Frontmatter fields:
- name: kebab-case slug, max 64 chars
- displayName: human title
- description: 1–3 sentences — what it does and when to use it. This is what users and the assistant see when picking skills, so make it specific.

Body:
- An "# <title>" heading and one line of intent.
- "## Rules" — 4–8 concrete, imperative bullets. Name the constraints that matter (length, tone, what to never do).
- "## Prompting" — only when the skill guides media generation (see below): a short reusable prompt fragment, not prose.
- "## Output" — for text skills: the exact shape of the answer (e.g. "Five markdown bullets, nothing else.").

${KIND_NOTES[kind]}

Keep the whole file under 120 lines. Prefer concrete instructions over generic advice. Never invent tools, scripts, or file operations — Kun skills are pure instructions.`;
}

export function buildSkillUserPrompt(brief: string, opts: { name?: string } = {}) {
  const nameLine = opts.name ? `\nSuggested name (adapt the slug from it): ${opts.name}` : "";
  return `Write one SKILL.md for this skill request:\n\n${brief.trim()}${nameLine}`;
}

/**
 * Pull the SKILL.md out of a model reply: strips code fences and any
 * chatter before the opening frontmatter. Returns null when the reply has
 * no usable content.
 */
export function extractSkillMarkdown(raw: string): string | null {
  let text = raw.trim();
  const fence = text.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  if (fence) text = fence[1].trim();
  // Models sometimes fence only the frontmatter (```yaml name: … ```).
  const fmFence = text.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*\n?/);
  if (fmFence && /^(name|displayName|description)\s*:/m.test(fmFence[1])) {
    text = `---\n${fmFence[1].trim()}\n---\n${text.slice(fmFence[0].length).replace(/^\s*\n/, "")}`;
  }
  const start = text.search(/^---\s*$/m);
  if (start > 0) {
    const candidate = text.slice(start);
    const rest = candidate.slice(4);
    if (/^---\s*$/m.test(rest)) text = candidate;
  }
  text = text.trim();
  if (!text) return null;
  return text.length > SKILL_BODY_CAP ? text.slice(0, SKILL_BODY_CAP) : text;
}

export function guessSkillKind(brief: string): SkillKindHint {
  const t = brief.toLowerCase();
  if (/\b(tts|voice|narrat|speak|voiceover|audio)\b/.test(t)) return "voice";
  if (/\b(video|shot|camera|b-roll|storyboard|clip|film)\b/.test(t)) return "video";
  if (/\b(image|photo|picture|illustration|render|poster|thumbnail|logo)\b/.test(t)) return "image";
  if (/\b(summar|rewrite|translate|extract|classify|draft|email|write|tone|bullets?)\b/.test(t)) return "text";
  return "generic";
}
