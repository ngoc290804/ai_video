import { invoke, isTauri, convertFileSrc } from "@tauri-apps/api/core";
import type { Project } from "../contracts/project";
export const desktop = isTauri();
export type StudioError = {
  code: string;
  message: string;
  retryable: boolean;
  correlationId: string;
};
export class IpcError extends Error {
  constructor(public detail: StudioError) {
    super(detail.message);
  }
}
export async function call<T>(
  command: string,
  payload: unknown = {},
  project?: Project,
): Promise<T> {
  if (!desktop)
    throw new Error(
      "Mở ứng dụng desktop bằng pnpm dev để lưu dữ liệu và xử lý media.",
    );
  const result = await invoke<
    { ok: true; data: T } | { ok: false; error: StudioError }
  >("studio_command", {
    command,
    request: {
      apiVersion: 1,
      requestId: crypto.randomUUID(),
      projectId: project?.id,
      expectedRevision: project?.revision,
      payload,
    },
  });
  if (!result.ok) throw new IpcError(result.error);
  return result.data;
}
export type Selection = { token: string; name: string };
export async function select(
  kind: "directory" | "file" | "save",
): Promise<Selection[]> {
  if (!desktop)
    throw new Error("Hộp thoại file chỉ có trong ứng dụng desktop.");
  return invoke("select_path", { kind });
}
export async function assetUrl(id: string, thumbnail = false) {
  return convertFileSrc(
    await call<string>("asset_preview_path", { id, thumbnail }),
  );
}
export type Job = {
  id: string;
  kind: string;
  state: string;
  version: number;
  createdAt: string;
  progress: { completed: number; total: number; message: string };
  error?: StudioError;
  output?: { path?: string; assetId?: string; proposalId?: string };
};
export type Settings = {
  theme: "dark" | "light";
  language: string;
  connections: {
    id: string;
    label: string;
    adapter: string;
    credentialRef: string;
  }[];
  telemetry: boolean;
};
export type Bootstrap = {
  project: Project | null;
  settings: Settings;
  recentProjects: { id: string; title: string; updatedAt: string }[];
  dataRoot: string;
  diagnostics: {
    ffmpeg: string | null;
    ffprobe: string | null;
    version: string;
    platform: string;
  };
};
