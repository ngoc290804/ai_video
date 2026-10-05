import { describe, it, expect } from "vitest";
import {
  newCharacter,
  newScene,
  newShot,
  plannedFrames,
  frameRate,
  useEditor,
} from "./editor";
import type { Project } from "../contracts/project";
import schema from "../../../contracts/project.schema.json";
const p = (): Project => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  revision: 0,
  title: "Test",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  language: "vi",
  story: {
    idea: "",
    synopsis: "",
    fullContent: "",
    genre: "",
    audience: "",
    style: "",
    constraints: "",
    ending: "",
    lockedFields: [],
  },
  video: {
    targetDurationMs: 60000,
    durationPolicy: "target",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    fps: { numerator: 30000, denominator: 1001 },
    fit: "contain",
    backgroundColor: "#101114",
  },
  providerBindings: { text: null, image: null, video: null, voice: null },
  characters: [],
  chapters: [],
  scenes: [],
  assets: [],
  timeline: { items: [], audioTracks: [], subtitles: [], subtitleMode: "none" },
});
describe("editor session invariants", () => {
  it("undo and redo keep current revision", () => {
    const project = p();
    useEditor.getState().load(project);
    useEditor.getState().edit((p) => {
      p.story.idea = "Mùa hè";
    });
    expect(useEditor.getState().status).toBe("dirty");
    useEditor.getState().undo();
    expect(useEditor.getState().project?.story.idea).toBe("");
    useEditor.getState().redo();
    expect(useEditor.getState().project?.story.idea).toBe("Mùa hè");
  });
  it("frame total accounts for crossfade without rounding drift", () => {
    const project = p();
    project.timeline.items = [
      {
        id: "1",
        assetId: "a",
        inFrame: 0,
        durationFrames: 300,
        transitionOut: { kind: "crossfade", durationFrames: 15 },
        sourceAudio: "mute",
        sourceAudioGainDb: 0,
      },
      {
        id: "2",
        assetId: "a",
        inFrame: 0,
        durationFrames: 300,
        transitionOut: { kind: "cut", durationFrames: 0 },
        sourceAudio: "mute",
        sourceAudioGainDb: 0,
      },
    ];
    expect(plannedFrames(project)).toBe(585);
    expect(frameRate(project)).toBe(30000 / 1001);
  });
  it("new entities have stable independent identities", () => {
    expect(newCharacter().id).not.toBe(newCharacter().id);
    expect(newScene().shots[0].durationFrames).toBeGreaterThan(0);
    expect(newShot().referenceAssetIds).toEqual([]);
  });
});
