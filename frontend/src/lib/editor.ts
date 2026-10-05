import { create } from "zustand";
import type {
  Project,
  Scene,
  Character,
  Shot,
  Chapter,
} from "../contracts/project";
import { call } from "./ipc";
export const uid = () => crypto.randomUUID();
export const newCharacter = (): Character => ({
  id: uid(),
  name: "Nhân vật mới",
  role: "supporting",
  personality: "",
  strengths: "",
  background: "",
  appearance: "",
  clothing: "",
  mannerisms: "",
  continuityNotes: "",
  referenceAssetIds: [],
  lockedFields: [],
});
export const newShot = (): Shot => ({
  id: uid(),
  description: "",
  characterIds: [],
  imagePrompt: "",
  videoPrompt: "",
  camera: "Toàn cảnh",
  durationFrames: 120,
  referenceAssetIds: [],
});
export const newScene = (): Scene => ({
  id: uid(),
  title: "Cảnh mới",
  summary: "",
  location: "",
  timeOfDay: "Ngày",
  mood: "",
  characterIds: [],
  continuityNotes: "",
  targetDurationMs: 4000,
  shots: [newShot()],
  dialogues: [],
  lockedFields: [],
  reviewStatus: "draft",
});
export const newChapter = (): Chapter => ({
  id: uid(),
  title: "Chương mới",
  summary: "",
  sceneIds: [],
});
export const frameRate = (p: Project) =>
  p.video.fps.numerator / p.video.fps.denominator;
export const plannedFrames = (p: Project) =>
  p.timeline.items.reduce(
    (sum, i) => sum + i.durationFrames - i.transitionOut.durationFrames,
    0,
  );
export const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
type Editor = {
  project: Project | null;
  saved: Project | null;
  past: Project[];
  future: Project[];
  status: "saved" | "dirty" | "saving" | "error";
  error: string | null;
  selection: string | null;
  load: (p: Project | null) => void;
  edit: (mutate: (p: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
};
export const useEditor = create<Editor>((set, get) => ({
  project: null,
  saved: null,
  past: [],
  future: [],
  status: "saved",
  error: null,
  selection: null,
  load: (p) =>
    set({
      project: p,
      saved: p,
      past: [],
      future: [],
      status: "saved",
      error: null,
      selection: null,
    }),
  edit: (mutate) => {
    const p = get().project;
    if (!p) return;
    const next = structuredClone(p);
    mutate(next);
    set({
      project: next,
      past: [...get().past.slice(-99), p],
      future: [],
      status: "dirty",
      error: null,
    });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const p = structuredClone(past[past.length - 1]);
    p.revision = project.revision;
    p.assets = project.assets;
    set({
      project: p,
      past: past.slice(0, -1),
      future: [project, ...future],
      status: "dirty",
    });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const p = structuredClone(future[0]);
    p.revision = project.revision;
    p.assets = project.assets;
    set({
      project: p,
      past: [...past, project],
      future: future.slice(1),
      status: "dirty",
    });
  },
  select: (selection) => set({ selection }),
}));
let pending: Promise<Project | null> | null = null;
export async function flush(): Promise<Project | null> {
  if (pending) {
    await pending;
    return flush();
  }
  const state = useEditor.getState();
  if (!state.project || state.status === "saved") return state.project;
  const snapshot = state.project;
  useEditor.setState({ status: "saving" });
  pending = call<Project>("project_update", snapshot, snapshot)
    .then((saved) => {
      const current = useEditor.getState().project;
      if (current === snapshot) {
        useEditor.setState({
          project: saved,
          saved,
          status: "saved",
          error: null,
        });
      } else if (current?.id === saved.id) {
        useEditor.setState({
          project: {
            ...current,
            revision: saved.revision,
            updatedAt: saved.updatedAt,
            assets: saved.assets,
          },
          saved,
          status: "dirty",
        });
      }
      return saved;
    })
    .catch((e) => {
      useEditor.setState({ status: "error", error: e.message });
      throw e;
    })
    .finally(() => {
      pending = null;
    });
  const result = await pending;
  if (useEditor.getState().status === "dirty") return flush();
  return result;
}
