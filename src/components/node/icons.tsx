import type { ComponentType } from "react";
import {
  Article,
  ChatTeardropText,
  FilmSlate,
  FilmStrip,
  ImageSquare,
  Image as ImageIcon,
  MonitorPlay,
  Note,
  Sparkle,
  SpeakerHigh,
  TextAa,
  Waveform,
  type IconProps,
} from "@phosphor-icons/react";

const ICONS: Record<string, ComponentType<IconProps>> = {
  text: TextAa,
  note: Note,
  skill: Sparkle,
  "image.in": ImageIcon,
  "audio.in": Waveform,
  "video.in": FilmStrip,
  llm: ChatTeardropText,
  "image.gen": ImageSquare,
  tts: SpeakerHigh,
  "video.gen": FilmSlate,
  "out.text": Article,
  "out.media": MonitorPlay,
};

/** Glyph for a node kind. Falls back to a neutral square for unknown kinds. */
export function NodeKindIcon({
  kind,
  size = 15,
  weight = "bold",
}: {
  kind: string;
  size?: number;
  weight?: IconProps["weight"];
}) {
  const Icon = ICONS[kind] ?? Note;
  return <Icon size={size} weight={weight} aria-hidden />;
}
