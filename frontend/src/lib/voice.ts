import type { Project } from "../contracts/project";
export const voices = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
];
export function resolveVoice(p: Project, targetId?: string) {
  const dialogue = p.scenes
    .flatMap((s) => s.dialogues)
    .find((d) => d.id === targetId);
  const mapping = p.characters.find((c) => c.id === dialogue?.speakerId)?.voice;
  const config = dialogue?.voiceOverride ?? mapping;
  return {
    binding: config?.binding ?? p.providerBindings.voice,
    voice: config?.voiceId ?? "coral",
    speed: mapping?.speed ?? 1,
    language: mapping?.language ?? p.language,
  };
}
