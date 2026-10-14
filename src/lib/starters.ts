/**
 * First-run starting points. A new user picks what they want to make instead
 * of facing a blank canvas; the picks, in the order chosen, become one brief
 * for the assistant to wire.
 */
export interface Starter {
  id: string;
  title: string;
  /** One line under the title. */
  body: string;
  /** Picture in /public/landing. */
  image: string;
  /** The data this step produces, used for a coloured edge on the tile. */
  kind: "text" | "image" | "audio" | "video";
  /** How the step reads inside the brief, after "a project that…". */
  clause: string;
}

export const STARTERS: Starter[] = [
  {
    id: "summarize",
    title: "Summarize text",
    body: "Paste an article, get the gist",
    image: "/landing/bento-glass.jpg",
    kind: "text",
    clause: "takes text I paste in and summarizes it in a few bullet points",
  },
  {
    id: "voice",
    title: "Voice-over",
    body: "Have it read aloud",
    image: "/landing/bento-mic.jpg",
    kind: "audio",
    clause: "reads the text aloud as speech",
  },
  {
    id: "cover",
    title: "Cover image",
    body: "A picture from words",
    image: "/landing/hero-lighthouse.jpg",
    kind: "image",
    clause: "makes a cover image from the text",
  },
  {
    id: "clip",
    title: "Short clip",
    body: "Bring an image to life",
    image: "/landing/bento-video.jpg",
    kind: "video",
    clause: "turns the image into a short 4 second video with a slow camera push-in",
  },
  {
    id: "product",
    title: "Product shot",
    body: "Restyle an uploaded photo",
    image: "/landing/tpl-product.jpg",
    kind: "image",
    clause: "takes a product photo I upload and restyles it as a clean studio shot",
  },
  {
    id: "storyboard",
    title: "Storyboard",
    body: "Scenes drawn in pencil",
    image: "/landing/tpl-storyboard.jpg",
    kind: "image",
    clause: "writes a scene description and draws it as a pencil storyboard frame",
  },
  {
    id: "moodboard",
    title: "Mood board",
    body: "Textures and colour",
    image: "/landing/tpl-moodboard.jpg",
    kind: "image",
    clause: "makes a mood-board image from my brief",
  },
  {
    id: "film",
    title: "Film still",
    body: "A cinematic frame",
    image: "/landing/tpl-film.jpg",
    kind: "image",
    clause: "makes a cinematic film still from my brief",
  },
];

export const MAX_PICKS = 4;

/**
 * The brief the assistant receives: the picks in order, plus anything the user
 * typed. Empty when there is nothing to build from.
 */
export function composeBrief(ids: string[], details = ""): string {
  const steps = ids
    .map((id) => STARTERS.find((s) => s.id === id)?.clause)
    .filter((c): c is string => !!c);
  const extra = details.trim();
  if (!steps.length) return extra;
  const list =
    steps.length === 1
      ? steps[0]
      : `${steps.slice(0, -1).join(", then ")}, and finally ${steps[steps.length - 1]}`;
  const base = `Build one project that ${list}. Keep it minimal, one node per step, feeding each step into the next where it makes sense.`;
  return extra ? `${base} Details: ${extra}` : base;
}
