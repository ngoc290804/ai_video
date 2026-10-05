import type { Project, Scene, Shot } from "../contracts/project";

const id = () => crypto.randomUUID();
function draft(p: Project) {
  p.scenes.forEach((s) => {
    s.reviewStatus = "draft";
  });
}
function move<T>(items: T[], index: number, delta: number) {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= items.length) return false;
  [items[index], items[to]] = [items[to], items[index]];
  return true;
}
function generated(p: Project, assetId?: string) {
  return p.assets.some((a) => a.id === assetId && a.origin === "generated");
}
function cloneShot(p: Project, shot: Shot): Shot {
  const copy = { ...structuredClone(shot), id: id() };
  if (generated(p, copy.selectedImageAssetId)) delete copy.selectedImageAssetId;
  if (generated(p, copy.selectedVideoAssetId)) delete copy.selectedVideoAssetId;
  return copy;
}
function cloneScene(p: Project, scene: Scene): Scene {
  return {
    ...structuredClone(scene),
    id: id(),
    title: `${scene.title} (bản sao)`,
    reviewStatus: "draft",
    shots: scene.shots.map((sh) => cloneShot(p, sh)),
    dialogues: scene.dialogues.map((d) => {
      const copy = { ...structuredClone(d), id: id() };
      if (generated(p, copy.audioAssetId)) delete copy.audioAssetId;
      return copy;
    }),
  };
}
export function moveChapter(p: Project, chapterId: string, delta: number) {
  if (
    move(
      p.chapters,
      p.chapters.findIndex((c) => c.id === chapterId),
      delta,
    )
  )
    draft(p);
}
export function duplicateChapter(p: Project, chapterId: string) {
  const index = p.chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) return;
  const original = p.chapters[index];
  const copies = original.sceneIds.map((sid) =>
    cloneScene(p, p.scenes.find((s) => s.id === sid)!),
  );
  p.scenes.push(...copies);
  p.chapters.splice(index + 1, 0, {
    ...structuredClone(original),
    id: id(),
    title: `${original.title} (bản sao)`,
    sceneIds: copies.map((s) => s.id),
  });
  draft(p);
}
export function deleteScenes(p: Project, sceneIds: string[]) {
  const removed = new Set(sceneIds);
  const shots = new Set(
    p.scenes
      .filter((s) => removed.has(s.id))
      .flatMap((s) => s.shots.map((sh) => sh.id)),
  );
  p.scenes = p.scenes.filter((s) => !removed.has(s.id));
  p.chapters.forEach((c) => {
    c.sceneIds = c.sceneIds.filter((sid) => !removed.has(sid));
  });
  p.timeline.items = p.timeline.items.filter(
    (t) => !removed.has(t.sceneId ?? "") && !shots.has(t.shotId ?? ""),
  );
  draft(p);
}
export function deleteChapter(p: Project, chapterId: string) {
  const c = p.chapters.find((c) => c.id === chapterId);
  if (!c) return;
  deleteScenes(p, c.sceneIds);
  p.chapters = p.chapters.filter((c) => c.id !== chapterId);
}
export function moveScene(p: Project, sceneId: string, delta: number) {
  const c = p.chapters.find((c) => c.sceneIds.includes(sceneId));
  if (c && move(c.sceneIds, c.sceneIds.indexOf(sceneId), delta)) draft(p);
}
export function duplicateScene(p: Project, sceneId: string) {
  const c = p.chapters.find((c) => c.sceneIds.includes(sceneId));
  const original = p.scenes.find((s) => s.id === sceneId);
  if (!c || !original) return;
  const copy = cloneScene(p, original);
  p.scenes.push(copy);
  c.sceneIds.splice(c.sceneIds.indexOf(sceneId) + 1, 0, copy.id);
  draft(p);
  return copy.id;
}
export function moveShot(
  p: Project,
  sceneId: string,
  shotId: string,
  delta: number,
) {
  const s = p.scenes.find((s) => s.id === sceneId);
  if (
    s &&
    move(
      s.shots,
      s.shots.findIndex((sh) => sh.id === shotId),
      delta,
    )
  )
    draft(p);
}
export function duplicateShot(p: Project, sceneId: string, shotId: string) {
  const s = p.scenes.find((s) => s.id === sceneId);
  if (!s) return;
  const index = s.shots.findIndex((sh) => sh.id === shotId);
  if (index < 0) return;
  s.shots.splice(index + 1, 0, cloneShot(p, s.shots[index]));
  s.reviewStatus = "draft";
}
export function deleteShot(p: Project, sceneId: string, shotId: string) {
  const s = p.scenes.find((s) => s.id === sceneId);
  if (!s) return;
  s.shots = s.shots.filter((sh) => sh.id !== shotId);
  s.reviewStatus = "draft";
  p.timeline.items = p.timeline.items.filter((t) => t.shotId !== shotId);
}
