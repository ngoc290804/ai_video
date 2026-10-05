import { describe, it, expect } from "vitest";
import fixture from "../../../examples/offline-demo/project.json";
import type { Project } from "../contracts/project";
import {
  duplicateChapter,
  duplicateScene,
  duplicateShot,
  deleteChapter,
  deleteShot,
  moveChapter,
  moveScene,
  moveShot,
} from "./structure";
import { resolveVoice } from "./voice";
const project = () => structuredClone(fixture) as Project;
describe("story structure and media references", () => {
  it("deep copies nested identities while preserving shared immutable media and timeline", () => {
    const p = project();
    const original = structuredClone(p.scenes[0]);
    const timeline = structuredClone(p.timeline);
    p.scenes[0].dialogues.push({
      id: crypto.randomUUID(),
      kind: "narration",
      text: "Xin chào",
      startFrame: 0,
    });
    duplicateChapter(p, p.chapters[0].id);
    const copy = p.scenes[1];
    expect(copy.id).not.toBe(original.id);
    expect(copy.shots[0].id).not.toBe(original.shots[0].id);
    expect(copy.dialogues[0].id).not.toBe(p.scenes[0].dialogues[0].id);
    expect(copy.shots[0].selectedImageAssetId).toBe(
      original.shots[0].selectedImageAssetId,
    );
    expect(p.chapters[1].sceneIds).toEqual([copy.id]);
    expect(p.timeline).toEqual(timeline);
    copy.shots[0].description = "New";
    expect(p.scenes[0].shots[0].description).toBe(
      original.shots[0].description,
    );
  });
  it("does not bind copied entities to AI output generated for the old target", () => {
    const p = project();
    p.assets[0].origin = "generated";
    const original = p.scenes[0];
    original.shots[0].selectedImageAssetId = p.assets[0].id;
    const copyId = duplicateScene(p, original.id);
    expect(
      p.scenes.find((s) => s.id === copyId)!.shots[0].selectedImageAssetId,
    ).toBeUndefined();
    expect(original.shots[0].selectedImageAssetId).toBe(p.assets[0].id);
  });
  it("reorders all levels, marks continuity for review and leaves edited timeline intact", () => {
    const p = project();
    const first = p.scenes[0];
    const timeline = structuredClone(p.timeline);
    const sid = duplicateScene(p, first.id)!;
    duplicateShot(p, first.id, first.shots[0].id);
    const shid = first.shots[0].id;
    first.reviewStatus = "approved";
    moveShot(p, first.id, shid, 1);
    expect(first.shots[1].id).toBe(shid);
    expect(first.reviewStatus).toBe("draft");
    moveScene(p, sid, -1);
    expect(p.chapters[0].sceneIds[0]).toBe(sid);
    duplicateChapter(p, p.chapters[0].id);
    const cid = p.chapters[0].id;
    moveChapter(p, cid, 1);
    expect(p.chapters[1].id).toBe(cid);
    moveChapter(p, cid, 1);
    expect(p.chapters[1].id).toBe(cid);
    expect(p.timeline).toEqual(timeline);
  });
  it("removes timeline references on shot or chapter deletion without deleting source media", () => {
    const p = project();
    const assets = structuredClone(p.assets);
    const s = p.scenes[0];
    p.timeline.items[0].sceneId = s.id;
    p.timeline.items[0].shotId = s.shots[0].id;
    deleteShot(p, s.id, s.shots[0].id);
    expect(p.timeline.items).toHaveLength(0);
    deleteChapter(p, p.chapters[0].id);
    expect(p.chapters).toHaveLength(0);
    expect(p.scenes).toHaveLength(0);
    expect(p.assets).toEqual(assets);
  });
  it("resolves dialogue voice before speaker mapping and project defaults", () => {
    const p = project();
    const c = p.characters[0];
    const binding = {
      connectionId: crypto.randomUUID(),
      modelId: "gpt-4o-mini-tts",
    };
    p.providerBindings.voice = binding;
    p.scenes[0].dialogues = [
      {
        id: "dialogue",
        kind: "dialogue",
        speakerId: c.id,
        text: "Hi",
        startFrame: 0,
      },
    ];
    expect(resolveVoice(p, "dialogue").voice).toBe("coral");
    c.voice = { binding, voiceId: "cedar", speed: 1.2, language: "vi" };
    expect(resolveVoice(p, "dialogue")).toMatchObject({
      voice: "cedar",
      speed: 1.2,
    });
    p.scenes[0].dialogues[0].voiceOverride = { binding, voiceId: "marin" };
    expect(resolveVoice(p, "dialogue").voice).toBe("marin");
  });
});
