import { voices, resolveVoice } from "./lib/voice";
import {
  moveChapter,
  duplicateChapter,
  deleteChapter,
  moveScene,
  duplicateScene,
  deleteScenes,
  moveShot,
  duplicateShot,
  deleteShot,
} from "./lib/structure";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Film,
  LayoutDashboard,
  Users,
  BookOpen,
  Clapperboard,
  Layers,
  FolderOpen,
  Settings as SettingsIcon,
  Download,
  Combine,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Check,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  X,
  Upload,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  Volume2,
  Clock,
  HardDrive,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Lock,
  Unlock,
  History,
  Copy,
  Save,
  LoaderCircle,
  Video,
  AlertCircle,
  SlidersHorizontal,
  PanelRightClose,
  CheckCircle2,
} from "lucide-react";
import {
  call,
  IpcError,
  select,
  desktop,
  assetUrl,
  type Bootstrap,
  type Job,
  type Settings,
  type Selection,
} from "./lib/ipc";
import {
  useEditor,
  flush,
  uid,
  newCharacter,
  newScene,
  newChapter,
  newShot,
  frameRate,
  plannedFrames,
  time,
} from "./lib/editor";
import type {
  Project,
  Character,
  Scene,
  Shot,
  VideoSettings,
  Asset,
  TimelineItem,
  ProviderKind,
} from "./contracts/project";
const nav = [
  ["/", "Tổng quan", LayoutDashboard],
  ["/characters", "Nhân vật", Users],
  ["/story", "Cốt truyện", BookOpen],
  ["/scenes", "Phân cảnh", Clapperboard],
  ["/timeline", "Timeline", Layers],
  ["/library", "Thư viện", FolderOpen],
  ["/export", "Xuất video", Download],
  ["/merge", "Ghép video", Combine],
  ["/settings", "Cài đặt", SettingsIcon],
] as const;
const labels: Record<string, string> = {
  idea: "Ý tưởng",
  synopsis: "Tóm tắt",
  fullContent: "Nội dung kịch bản",
  genre: "Thể loại",
  audience: "Khán giả",
  style: "Phong cách",
  constraints: "Ràng buộc",
  ending: "Kết thúc",
  name: "Tên nhân vật",
  personality: "Tính cách",
  strengths: "Điểm mạnh",
  background: "Tiểu sử",
  appearance: "Ngoại hình",
  clothing: "Trang phục",
  mannerisms: "Cử chỉ",
  continuityNotes: "Ghi chú nhất quán",
  title: "Tên cảnh",
  summary: "Nội dung cảnh",
  location: "Bối cảnh",
  timeOfDay: "Thời điểm",
  mood: "Cảm xúc",
  description: "Mô tả shot",
  imagePrompt: "Prompt hình ảnh",
  videoPrompt: "Prompt chuyển động",
  camera: "Góc máy",
  text: "Lời thoại",
};
function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          type={type}
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Empty({
  icon,
  heading,
  children,
  action,
}: {
  icon: ReactNode;
  heading: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{heading}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <Button title="Đóng" variant="icon ghost" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
function AssetPreview({
  asset,
  thumbnail = false,
}: {
  asset: Asset;
  thumbnail?: boolean;
}) {
  const q = useQuery({
    queryKey: ["asset-url", asset.id, thumbnail],
    queryFn: () => assetUrl(asset.id, thumbnail),
  });
  if (!q.data)
    return (
      <div className="media-placeholder">
        <ImageIcon size={26} />
        <span>{q.isError ? "Không tải được preview" : "Đang tải media"}</span>
      </div>
    );
  return asset.kind === "image" || thumbnail ? (
    <img src={q.data} alt={asset.originalName || "Ảnh dự án"} />
  ) : asset.kind === "video" ? (
    <video src={q.data} controls preload="metadata" />
  ) : (
    <audio src={q.data} controls />
  );
}
function useAction() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return {
    error,
    busy,
    run: async (action: () => Promise<unknown>) => {
      setError("");
      setBusy(true);
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    errorView: error ? (
      <div className="error" role="alert">
        <AlertCircle size={17} />
        {error}
      </div>
    ) : null,
  };
}
export default function App() {
  const { project, status, error, undo, redo, past, future } = useEditor();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const action = useAction();
  const [creating, setCreating] = useState(false);
  const [recovering, setRecovering] = useState<Selection | null>(null);
  const [history, setHistory] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => call<Bootstrap>("app_bootstrap"),
    enabled: desktop,
  });
  useEffect(() => {
    if (bootstrap.data) {
      setTheme(bootstrap.data.settings.theme);
    }
  }, [bootstrap.data]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const firstDirty = useRef(0);
  useEffect(() => {
    if (status !== "dirty") return;
    if (!firstDirty.current) firstDirty.current = Date.now();
    const timeout = setTimeout(
      () => {
        firstDirty.current = 0;
        void flush().catch(() => {});
      },
      Math.min(800, Math.max(0, 5000 - (Date.now() - firstDirty.current))),
    );
    return () => clearTimeout(timeout);
  }, [project, status]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void flush().catch(() => {});
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "z" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [undo, redo]);
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await flush();
          const jobs = await call<Job[]>("job_list");
          const active = jobs.filter((j) =>
            [
              "queued",
              "running",
              "waiting_remote",
              "pause_requested",
              "cancelling",
            ].includes(j.state),
          );
          if (active.length) {
            if (
              !window.confirm(
                `Có ${active.length} tác vụ đang chạy/chờ. Tạm dừng rồi thoát? Tác vụ AI ở provider có thể tiếp tục tính phí.`,
              )
            )
              return;
            for (const job of active) {
              if (["queued", "running", "waiting_remote"].includes(job.state))
                await call("job_pause", { id: job.id, version: job.version });
            }
            for (let i = 0; i < 600; i++) {
              const jobs = await call<Job[]>("job_list");
              if (
                !jobs.some((j) =>
                  [
                    "running",
                    "waiting_remote",
                    "pause_requested",
                    "cancelling",
                  ].includes(j.state),
                )
              )
                break;
              if (i === 599)
                throw Error("Tác vụ chưa tạm dừng; giữ cửa sổ mở.");
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
          if (useEditor.getState().status === "saved")
            await getCurrentWindow().destroy();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
        }
      });
      if (disposed) unlisten();
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  async function load(p: Project) {
    useEditor.getState().load(p);
    await qc.invalidateQueries();
    navigate("/");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <div className="brand-mark">
            <Film size={22} />
          </div>
          <div>
            video<span>studio</span>
            <small>YOUR STORY. IN MOTION.</small>
          </div>
        </NavLink>
        <div className="workspace-label">KHÔNG GIAN SÁNG TẠO</div>
        <nav>
          {nav.map(([path, title, Icon], i) => (
            <NavLink
              end={path === "/"}
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""} ${i === 7 ? "nav-separator" : ""}`
              }
            >
              <Icon size={19} />
              <span>{title}</span>
              {path === "/scenes" && project && (
                <small>{project.scenes.length}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="status-dot" />
            <div>
              Lưu trữ trên thiết bị<small>Dữ liệu của bạn, do bạn giữ.</small>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="sidebar-footer">
            <span>
              AI VIDEO STUDIO <b>0.1</b>
            </span>
            <button
              title="Đổi giao diện"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Film size={16} />
            <span>Studio</span>
            <ChevronRight size={14} />
            <strong>{project?.title || "Dự án của bạn"}</strong>
          </div>
          <div className="top-actions">
            {project && (
              <>
                <span
                  className={`save-state ${status === "error" ? "danger" : ""}`}
                >
                  {status === "saved" ? (
                    <Check size={14} />
                  ) : status === "saving" ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <Clock size={14} />
                  )}{" "}
                  {status === "saved"
                    ? "Đã lưu"
                    : status === "saving"
                      ? "Đang lưu…"
                      : status === "error"
                        ? "Lưu thất bại"
                        : "Chưa lưu"}
                </span>
                <Button
                  variant="icon ghost"
                  title="Hoàn tác"
                  disabled={!past.length}
                  onClick={undo}
                >
                  <Undo2 size={17} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Làm lại"
                  disabled={!future.length}
                  onClick={redo}
                >
                  <Redo2 size={17} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Lịch sử phiên bản"
                  onClick={() => setHistory(true)}
                >
                  <History size={17} />
                </Button>
                <Button variant="subtle" onClick={() => navigate("/export")}>
                  <Download size={15} />
                  Xuất video
                </Button>
              </>
            )}
            <div className="avatar">S</div>
          </div>
        </header>
        {!desktop && (
          <div className="notice">
            <ShieldCheck size={16} />
            <span>
              Bản xem giao diện • Chạy <code>pnpm dev</code> để dùng backend
              desktop, lưu dự án và xuất video.
            </span>
          </div>
        )}
        {bootstrap.isError && (
          <div className="error">{bootstrap.error.message}</div>
        )}
        {action.errorView}
        {status === "error" && (
          <div className="error">
            <span>{error}</span>
            <Button onClick={() => void action.run(flush)}>Thử lưu lại</Button>
          </div>
        )}
        <main className="content">
          <Routes>
            <Route
              path="/"
              element={
                project ? (
                  <Overview
                    onClose={() =>
                      void action.run(async () => {
                        await flush();
                        await call("project_close");
                        useEditor.getState().load(null);
                        await qc.invalidateQueries();
                      })
                    }
                    onDuplicate={() =>
                      void action.run(async () => {
                        const p = await flush();
                        if (p)
                          await load(
                            await call<Project>(
                              "project_duplicate",
                              { title: p.title + " — Bản sao" },
                              p,
                            ),
                          );
                      })
                    }
                  />
                ) : (
                  <Home
                    bootstrap={bootstrap.data}
                    onCreate={() => setCreating(true)}
                    onOpen={() =>
                      void action.run(async () => {
                        const [folder] = await select("directory");
                        if (folder) {
                          try {
                            await load(
                              await call<Project>("project_open", {
                                token: folder.token,
                              }),
                            );
                          } catch (error) {
                            if (
                              error instanceof IpcError &&
                              error.detail.code === "PROJECT_CORRUPT"
                            )
                              setRecovering(folder);
                            else throw error;
                          }
                        }
                      })
                    }
                    onRecent={(id) =>
                      void action.run(async () =>
                        load(await call<Project>("project_open", { id })),
                      )
                    }
                  />
                )
              }
            />
            <Route
              path="/characters"
              element={
                <NeedProject>
                  <Characters />
                </NeedProject>
              }
            />
            <Route
              path="/story"
              element={
                <NeedProject>
                  <Story />
                </NeedProject>
              }
            />
            <Route
              path="/scenes"
              element={
                <NeedProject>
                  <Scenes />
                </NeedProject>
              }
            />
            <Route
              path="/timeline"
              element={
                <NeedProject>
                  <Timeline />
                </NeedProject>
              }
            />
            <Route
              path="/library"
              element={
                <NeedProject>
                  <Library />
                </NeedProject>
              }
            />
            <Route
              path="/export"
              element={
                <NeedProject>
                  <Export />
                </NeedProject>
              }
            />
            <Route path="/merge" element={<Merge />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <JobsPanel />
      </div>
      {creating && (
        <CreateProject
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            void load(p);
          }}
        />
      )}
      {history && <Revisions onClose={() => setHistory(false)} />}
      {recovering && (
        <Recovery
          folder={recovering}
          onClose={() => setRecovering(null)}
          onRecovered={(p) => {
            setRecovering(null);
            void load(p);
          }}
        />
      )}
    </div>
  );
}
function NeedProject({ children }: { children: ReactNode }) {
  return useEditor((s) => s.project) ? (
    children
  ) : (
    <Empty icon={<FolderOpen />} heading="Mở một câu chuyện mới">
      Tạo hoặc mở dự án từ Tổng quan để bắt đầu biên tập.
      <NavLink to="/" className="text-link">
        Về Tổng quan <ArrowUpRight size={15} />
      </NavLink>
    </Empty>
  );
}
function Home({
  bootstrap,
  onCreate,
  onOpen,
  onRecent,
}: {
  bootstrap?: Bootstrap;
  onCreate: () => void;
  onOpen: () => void;
  onRecent: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const recent = (bootstrap?.recentProjects || []).filter((p) =>
    p.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="TỪ Ý TƯỞNG ĐẾN THƯỚC PHIM"
        title="Câu chuyện tiếp theo của bạn."
        description="Một không gian để viết, hình dung và tạo nên những thước phim."
        action={
          <Button onClick={onOpen}>
            <FolderOpen size={16} />
            Mở dự án
          </Button>
        }
      />
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <span />
            KHÔNG GIAN SÁNG TẠO CỦA RIÊNG BẠN
          </div>
          <h2>
            Ý tưởng nhỏ.
            <br />
            Khung hình <em>không giới hạn.</em>
          </h2>
          <p>
            Xây dựng nhân vật, viết câu chuyện và kết nối từng cảnh phim.
            <br />
            Từ bản nháp đầu tiên đến video hoàn chỉnh — ngay trên máy bạn.
          </p>
          <Button variant="primary" onClick={onCreate}>
            <Plus size={18} />
            Tạo dự án mới
            <ArrowUpRight size={17} />
          </Button>
          <div className="hero-footnote">
            <ShieldCheck size={14} />
            Local-first <span>•</span> Không cần đăng nhập <span>•</span> Bạn
            chọn AI
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="film-card back">
            <div className="film-landscape" />
          </div>
          <div className="film-card front">
            <div className="film-landscape">
              <div className="sun-disc" />
              <div className="mountain m1" />
              <div className="mountain m2" />
              <div className="mountain m3" />
              <div className="art-cross a" />
              <div className="art-cross b" />
              <div className="art-label">
                SCENE 001 <span>● REC</span>
              </div>
              <div className="art-caption">
                Every frame begins
                <br />
                with a story.
              </div>
            </div>
            <div className="film-strip">
              <span />
              <span />
              <span />
              <span />
              <Play size={12} fill="currentColor" />
              <span />
              <span />
            </div>
          </div>
          <div className="floating-chip">
            <Sparkles size={14} />
            Tạo nên điều khác biệt
          </div>
          <div className="art-coordinates">01 / YOUR NEXT CHAPTER</div>
        </div>
      </section>
      <div className="section-head">
        <h2>
          Dự án gần đây <span className="count">{recent.length}</span>
        </h2>
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Tìm dự án"
            placeholder="Tìm kiếm dự án…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="projects-grid">
        <button className="new-project-card" onClick={onCreate}>
          <span>
            <Plus size={24} />
          </span>
          <strong>Bắt đầu câu chuyện mới</strong>
          <small>Tạo dự án từ ý tưởng của bạn</small>
        </button>
        {recent.map((p, i) => (
          <button
            className="project-card"
            key={p.id}
            onClick={() => onRecent(p.id)}
          >
            <div className={`project-cover cover-${i % 3}`}>
              <Film size={36} />
              <span>DỰ ÁN LOCAL</span>
            </div>
            <div className="project-card-body">
              <h3>{p.title}</h3>
              <p>
                {new Date(p.updatedAt).toLocaleDateString("vi-VN")}
                <ArrowUpRight size={17} />
              </p>
            </div>
          </button>
        ))}
      </div>
      <div className="quick-tools">
        <div>
          <span className="tool-icon">
            <Combine size={21} />
          </span>
          <div>
            <h3>Đã có video? Ghép lại thành một câu chuyện.</h3>
            <p>Sắp xếp, chuẩn hóa và ghép video có sẵn. Không cần AI.</p>
          </div>
        </div>
        <NavLink className="button" to="/merge">
          Mở công cụ ghép
          <ArrowUpRight size={16} />
        </NavLink>
      </div>
      <div className="home-bottom">
        <span>
          <HardDrive size={14} />
          Lưu trữ local · JSON + media
        </span>
        <span>
          <ShieldCheck size={14} />
          API key lưu bằng secret store của hệ điều hành
        </span>
      </div>
    </>
  );
}
const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Nhập tên dự án")
    .max(120, "Tối đa 120 ký tự"),
});
function CreateProject({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createSchema) });
  const action = useAction();
  return (
    <Modal title="Tạo dự án mới" onClose={onClose}>
      <p className="muted">
        Bắt đầu với một tên gọi. Bạn có thể thêm ý tưởng và thông số phim trong
        workspace.
      </p>
      <form
        onSubmit={handleSubmit(
          (v) =>
            void action.run(async () =>
              onCreated(await call<Project>("project_create", v)),
            ),
        )}
      >
        <label className="field">
          <span>Tên dự án</span>
          <input
            autoFocus
            placeholder="Ví dụ: Chuyến tàu mùa hè"
            {...register("title")}
          />
          {errors.title && (
            <small className="danger">{errors.title.message}</small>
          )}
        </label>
        {action.errorView}
        <div className="modal-actions">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={action.busy}>
            <Plus size={16} />
            Tạo dự án
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Overview({
  onClose,
  onDuplicate,
}: {
  onClose: () => void;
  onDuplicate: () => void;
}) {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const action = useAction();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / TỔNG QUAN"
        title={p.title}
        description="Mỗi cảnh phim là một bước gần hơn đến câu chuyện của bạn."
        action={
          <Button onClick={onClose}>
            <ArrowLeft size={16} />
            Đóng dự án
          </Button>
        }
      />
      <div className="stats">
        {[
          [Users, p.characters.length, "Nhân vật"],
          [Clapperboard, p.scenes.length, "Phân cảnh"],
          [ImageIcon, p.assets.length, "Media"],
          [Clock, time(plannedFrames(p) / frameRate(p)), "Thời lượng kế hoạch"],
        ].map(([Icon, num, label]) => {
          const I = Icon as typeof Film;
          return (
            <div className="stat" key={String(label)}>
              <I size={19} />
              <strong>{String(num)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-title">
            <BookOpen size={18} />
            <h2>Câu chuyện của bạn</h2>
            <NavLink to="/story">
              Biên tập
              <ArrowUpRight size={15} />
            </NavLink>
          </div>
          <Field
            label="Tên dự án"
            value={p.title}
            onChange={(v) =>
              edit((p) => {
                p.title = v;
              })
            }
          />
          <Field
            label="Ý tưởng ban đầu"
            value={p.story.idea}
            multiline
            onChange={(v) =>
              edit((p) => {
                p.story.idea = v;
              })
            }
          />
          <div className="row">
            <span className="badge">
              {p.video.width} × {p.video.height}
            </span>
            <span className="badge">
              {p.video.fps.numerator}/{p.video.fps.denominator} FPS
            </span>
            <span className="badge">{p.language.toUpperCase()}</span>
          </div>
        </section>
        <section className="panel">
          <h2>Từng bước tạo phim</h2>
          {[
            [
              "01",
              "Xây dựng nhân vật",
              "Ngoại hình, tính cách và giọng nói",
              "/characters",
            ],
            [
              "02",
              "Phát triển kịch bản",
              "Từ ý tưởng đến từng phân cảnh",
              "/story",
            ],
            [
              "03",
              "Kết nối khung hình",
              "Sắp xếp media trên timeline",
              "/timeline",
            ],
            ["04", "Xuất thước phim", "Kiểm tra và render MP4", "/export"],
          ].map(([num, title, desc, path]) => (
            <button
              className="step-row"
              key={num}
              onClick={() => navigate(path)}
            >
              <span>{num}</span>
              <div>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </section>
      </div>
      <div className="section-head">
        <span className="muted">
          Revision {p.revision} · Cập nhật{" "}
          {new Date(p.updatedAt).toLocaleString("vi-VN")}
        </span>
        <div className="row">
          <Button onClick={onDuplicate}>
            <Copy size={15} />
            Nhân bản
          </Button>
          <Button variant="danger ghost" onClick={() => setDeleting(true)}>
            <Trash2 size={15} />
            Xóa dự án
          </Button>
        </div>
      </div>
      {action.errorView}
      {deleting && (
        <Modal title="Xóa dự án" onClose={() => setDeleting(false)}>
          <p>
            Dự án được chuyển vào thư mục backups để có thể phục hồi. Nhập tên
            dự án để xác nhận.
          </p>
          <Field
            label="Tên dự án"
            value={confirmation}
            onChange={setConfirmation}
          />
          <Button
            variant="danger"
            disabled={confirmation !== p.title}
            onClick={() =>
              void action.run(async () => {
                const latest = await flush();
                await call("project_delete", { confirmation }, latest!);
                useEditor.getState().load(null);
              })
            }
          >
            Xóa dự án
          </Button>
          {action.errorView}
        </Modal>
      )}
    </>
  );
}
function Characters() {
  const p = useEditor((s) => s.project)!;
  const { edit, selection, select: choose } = useEditor();
  const selected =
    p.characters.find((c) => c.id === selection) || p.characters[0];
  const action = useAction();
  const [search, setSearch] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="CHARACTER BIBLE"
        title="Những gương mặt của câu chuyện."
        description="Giữ nhân vật nhất quán qua ngoại hình, ảnh tham chiếu và giọng nói."
        action={
          <Button
            variant="primary"
            onClick={() => {
              const c = newCharacter();
              edit((p) => {
                p.characters.push(c);
              });
              choose(c.id);
            }}
          >
            <Plus size={17} />
            Thêm nhân vật
          </Button>
        }
      />
      {!selected ? (
        <Empty icon={<Users />} heading="Nhân vật đầu tiên đang chờ bạn">
          Thêm nhân vật và mô tả điều khiến họ trở nên đặc biệt.
        </Empty>
      ) : (
        <div className="split-editor">
          <aside className="entity-list">
            <div className="search">
              <Search size={15} />
              <input
                aria-label="Tìm nhân vật"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nhân vật"
              />
            </div>
            {p.characters
              .filter((c) =>
                c.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c, i) => (
                <button
                  key={c.id}
                  className={`entity-row ${selected.id === c.id ? "selected" : ""}`}
                  onClick={() => choose(c.id)}
                >
                  <span className={`character-avatar c${i % 4}`}>
                    {c.name[0]}
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.role.replaceAll("_", " ")}</small>
                  </div>
                  <ChevronRight size={14} />
                </button>
              ))}
          </aside>
          <section className="panel editor-panel">
            <div className="panel-title">
              <h2>Hồ sơ nhân vật</h2>
              <Button
                variant="icon ghost danger"
                title="Xóa nhân vật"
                onClick={() => {
                  const uses = p.scenes.filter(
                    (s) =>
                      s.characterIds.includes(selected.id) ||
                      s.shots.some((sh) =>
                        sh.characterIds.includes(selected.id),
                      ) ||
                      s.dialogues.some((d) => d.speakerId === selected.id),
                  ).length;
                  if (
                    window.confirm(
                      `Xóa ${selected.name}? Bỏ liên kết khỏi ${uses} cảnh; lời thoại sẽ dùng người kể mặc định.`,
                    )
                  )
                    edit((p) => {
                      p.characters = p.characters.filter(
                        (c) => c.id !== selected.id,
                      );
                      p.scenes.forEach((s) => {
                        s.characterIds = s.characterIds.filter(
                          (id) => id !== selected.id,
                        );
                        s.shots.forEach(
                          (sh) =>
                            (sh.characterIds = sh.characterIds.filter(
                              (id) => id !== selected.id,
                            )),
                        );
                        s.dialogues.forEach((d) => {
                          if (d.speakerId === selected.id) delete d.speakerId;
                        });
                      });
                    });
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="two-col">
              <Field
                label="Tên nhân vật"
                value={selected.name}
                onChange={(v) =>
                  edit((p) => {
                    p.characters.find((c) => c.id === selected.id)!.name = v;
                  })
                }
              />
              <Select
                label="Vai trò"
                value={selected.role}
                options={Object.entries({
                  male_lead: "Nam chính",
                  female_lead: "Nữ chính",
                  supporting: "Phụ",
                  antagonist: "Phản diện",
                  narrator: "Người kể",
                  custom: "Tùy chỉnh",
                })}
                onChange={(v) =>
                  edit((p) => {
                    p.characters.find((c) => c.id === selected.id)!.role =
                      v as Character["role"];
                  })
                }
              />
            </div>
            <div className="two-col">
              {(
                [
                  "appearance",
                  "clothing",
                  "personality",
                  "background",
                  "strengths",
                  "mannerisms",
                  "continuityNotes",
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={labels[k]}
                  value={selected[k]}
                  multiline
                  onChange={(v) =>
                    edit((p) => {
                      p.characters.find((c) => c.id === selected.id)![k] = v;
                    })
                  }
                />
              ))}
            </div>
            <CharacterVoice character={selected} />
            <div className="section-head">
              <h3>
                Ảnh tham chiếu{" "}
                <span className="count">
                  {selected.referenceAssetIds.length}
                </span>
              </h3>
              <Button
                onClick={() =>
                  void action.run(async () => {
                    const files = await select("file");
                    if (!files.length) return;
                    const current = await flush();
                    const saved = await call<Project>(
                      "asset_import",
                      { tokens: files.map((f) => f.token) },
                      current!,
                    );
                    const added = saved.assets.filter(
                      (a) =>
                        !current!.assets.some((old) => old.id === a.id) &&
                        a.kind === "image",
                    );
                    useEditor.getState().load(saved);
                    choose(selected.id);
                    edit((p) => {
                      const c = p.characters.find((c) => c.id === selected.id)!;
                      c.referenceAssetIds.push(...added.map((a) => a.id));
                      c.primaryReferenceAssetId ??= added[0]?.id;
                    });
                  })
                }
              >
                <Upload size={15} />
                Nhập ảnh
              </Button>
            </div>
            <p className="muted small">
              PNG, JPEG, WebP · Tối đa 20 MiB / ảnh. Ảnh gốc được giữ nguyên.
            </p>
            <div className="reference-grid">
              {selected.referenceAssetIds.map((id, i) => {
                const a = p.assets.find((a) => a.id === id);
                return (
                  a && (
                    <div key={id} className="reference">
                      <AssetPreview asset={a} thumbnail />
                      <div className="row">
                        <Button
                          variant="icon ghost"
                          title="Đưa ảnh lên"
                          disabled={i === 0}
                          onClick={() =>
                            edit((p) => {
                              const refs = p.characters.find(
                                (c) => c.id === selected.id,
                              )!.referenceAssetIds;
                              [refs[i - 1], refs[i]] = [refs[i], refs[i - 1]];
                            })
                          }
                        >
                          <ArrowUp size={13} />
                        </Button>
                        <Button
                          variant="icon ghost"
                          title="Đưa ảnh xuống"
                          disabled={i === selected.referenceAssetIds.length - 1}
                          onClick={() =>
                            edit((p) => {
                              const refs = p.characters.find(
                                (c) => c.id === selected.id,
                              )!.referenceAssetIds;
                              [refs[i + 1], refs[i]] = [refs[i], refs[i + 1]];
                            })
                          }
                        >
                          <ArrowDown size={13} />
                        </Button>
                      </div>
                      <div className="row">
                        <button
                          className="text-link"
                          onClick={() =>
                            edit((p) => {
                              p.characters.find(
                                (c) => c.id === selected.id,
                              )!.primaryReferenceAssetId = id;
                            })
                          }
                        >
                          {selected.primaryReferenceAssetId === id
                            ? "✓ Ảnh chính"
                            : "Đặt ảnh chính"}
                        </button>
                        <button
                          aria-label="Bỏ ảnh tham chiếu"
                          onClick={() =>
                            edit((p) => {
                              const c = p.characters.find(
                                (c) => c.id === selected.id,
                              )!;
                              c.referenceAssetIds.splice(i, 1);
                              if (c.primaryReferenceAssetId === id)
                                delete c.primaryReferenceAssetId;
                            })
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                );
              })}
            </div>
            {action.errorView}
          </section>
        </div>
      )}
    </>
  );
}
function Story() {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const [target, setTarget] = useState<Target | null>(null);
  const [planning, setPlanning] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="KỊCH BẢN / STORY BIBLE"
        title="Một câu chuyện đáng để kể."
        description="Viết tự do, khóa chi tiết quan trọng và duyệt mọi thay đổi do AI đề xuất."
        action={
          <Button variant="primary" onClick={() => setPlanning(true)}>
            <Sparkles size={15} />
            Đề xuất chương & cảnh
          </Button>
        }
      />
      <div className="story-layout">
        <section className="panel">
          {(["idea", "synopsis", "fullContent", "ending"] as const).map((k) => (
            <div key={k} className="story-field">
              <div className="section-head">
                <h3>{labels[k]}</h3>
                <div className="row">
                  <Button
                    variant="icon ghost"
                    title={
                      p.story.lockedFields.includes(k)
                        ? "Mở khóa trường"
                        : "Khóa trường"
                    }
                    onClick={() =>
                      edit((p) => {
                        p.story.lockedFields = p.story.lockedFields.includes(k)
                          ? p.story.lockedFields.filter((f) => f !== k)
                          : [...p.story.lockedFields, k];
                      })
                    }
                  >
                    {p.story.lockedFields.includes(k) ? (
                      <Lock size={14} />
                    ) : (
                      <Unlock size={14} />
                    )}
                  </Button>
                  <Button
                    variant="ghost small"
                    disabled={p.story.lockedFields.includes(k)}
                    onClick={() => setTarget({ kind: "story", field: k })}
                  >
                    <Sparkles size={14} />
                    AI hỗ trợ
                  </Button>
                </div>
              </div>
              <textarea
                aria-label={labels[k]}
                className={k === "fullContent" ? "long-text" : ""}
                value={p.story[k]}
                placeholder={`Viết ${labels[k].toLowerCase()} của bạn…`}
                onChange={(e) =>
                  edit((p) => {
                    p.story[k] = e.target.value;
                  })
                }
              />
            </div>
          ))}
        </section>
        <aside className="panel story-properties">
          <h3>
            <SlidersHorizontal size={17} /> Định hướng sáng tạo
          </h3>
          {(["genre", "audience", "style", "constraints"] as const).map((k) => (
            <Field
              key={k}
              label={labels[k]}
              value={p.story[k]}
              multiline={k === "constraints"}
              onChange={(v) =>
                edit((p) => {
                  p.story[k] = v;
                })
              }
            />
          ))}
          <div className="info-note">
            <ShieldCheck size={19} />
            <p>
              AI tạo đề xuất để bạn xem trước. Nội dung chỉ thay đổi khi bạn bấm
              Áp dụng.
            </p>
          </div>
        </aside>
      </div>
      <Proposals />
      {target && <AiDialog target={target} onClose={() => setTarget(null)} />}
      {planning && (
        <AiDialog
          target={{ kind: "story", field: "synopsis" }}
          structured
          onClose={() => setPlanning(false)}
        />
      )}
    </>
  );
}
type Target = {
  kind: "story" | "scene" | "shot" | "dialogue";
  id?: string;
  field: string;
};
function Scenes() {
  const p = useEditor((s) => s.project)!;
  const { edit, selection, select: choose } = useEditor();
  const selected = p.scenes.find((s) => s.id === selection);
  const [target, setTarget] = useState<Target | null>(null);
  const [media, setMedia] = useState<{
    target: Target;
    kind: ProviderKind;
    prompt: string;
    seconds?: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  function change(m: (scene: Scene) => void) {
    if (selected) edit((p) => m(p.scenes.find((s) => s.id === selected.id)!));
  }
  return (
    <>
      <PageHeading
        eyebrow="STORYBOARD / PHÂN CẢNH"
        title="Đưa câu chuyện vào khung hình."
        description={`${p.chapters.length} chương · ${p.scenes.length} cảnh · Phát triển từng shot theo nhịp điệu của bạn.`}
        action={
          <Button
            variant="primary"
            onClick={() =>
              edit((p) => {
                p.chapters.push(newChapter());
              })
            }
          >
            <Plus size={17} />
            Thêm chương
          </Button>
        }
      />
      <div className={`scene-layout ${selected ? "with-inspector" : ""}`}>
        <section>
          <div className="search scene-search">
            <Search size={16} />
            <input
              aria-label="Tìm cảnh"
              placeholder="Tìm cảnh theo tên hoặc nội dung…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {p.chapters.length === 0 && (
            <Empty
              icon={<Clapperboard />}
              heading="Bắt đầu với chương đầu tiên"
            >
              Tạo chương, thêm cảnh rồi chia thành các shot ngắn.
            </Empty>
          )}
          {p.chapters.map((ch, chIndex) => (
            <section key={ch.id} className="chapter">
              <div className="chapter-heading">
                <span className="chapter-number">
                  {String(chIndex + 1).padStart(2, "0")}
                </span>
                <input
                  aria-label="Tên chương"
                  value={ch.title}
                  onChange={(e) =>
                    edit((p) => {
                      p.chapters.find((c) => c.id === ch.id)!.title =
                        e.target.value;
                    })
                  }
                />
                <span className="muted small">{ch.sceneIds.length} cảnh</span>
                <Button
                  variant="icon ghost"
                  title="Đưa chương lên"
                  disabled={!chIndex}
                  onClick={() => edit((p) => moveChapter(p, ch.id, -1))}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Đưa chương xuống"
                  disabled={chIndex === p.chapters.length - 1}
                  onClick={() => edit((p) => moveChapter(p, ch.id, 1))}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Nhân bản chương"
                  onClick={() => edit((p) => duplicateChapter(p, ch.id))}
                >
                  <Copy size={14} />
                </Button>
                <Button
                  variant="icon ghost danger"
                  title="Xóa chương"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Xóa chương cùng ${ch.sceneIds.length} cảnh và các đoạn timeline liên quan?`,
                      )
                    )
                      edit((p) => deleteChapter(p, ch.id));
                  }}
                >
                  <Trash2 size={14} />
                </Button>
                <Button
                  variant="ghost small"
                  onClick={() => {
                    const scene = newScene();
                    edit((p) => {
                      p.scenes.push(scene);
                      p.chapters
                        .find((c) => c.id === ch.id)!
                        .sceneIds.push(scene.id);
                    });
                    choose(scene.id);
                  }}
                >
                  <Plus size={14} />
                  Thêm cảnh
                </Button>
              </div>
              <div className="scene-grid">
                {ch.sceneIds
                  .map((id) => p.scenes.find((s) => s.id === id)!)
                  .filter(
                    (s) =>
                      s.title.toLowerCase().includes(search.toLowerCase()) ||
                      s.summary.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((scene, i) => {
                    const a = p.assets.find(
                      (a) => a.id === scene.shots[0]?.selectedImageAssetId,
                    );
                    return (
                      <button
                        className={`scene-card ${selected?.id === scene.id ? "selected" : ""}`}
                        key={scene.id}
                        onClick={() => choose(scene.id)}
                      >
                        <div className="scene-thumb">
                          {a ? (
                            <AssetPreview asset={a} thumbnail />
                          ) : (
                            <>
                              <div className="scene-grid-pattern" />
                              <Clapperboard size={25} />
                              <small>Chưa chọn hình ảnh</small>
                            </>
                          )}
                          <span className="scene-index">
                            SCENE {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="duration-chip">
                            {time(scene.targetDurationMs / 1000)}
                          </span>
                        </div>
                        <div className="scene-card-info">
                          <h3>{scene.title}</h3>
                          <p>
                            {scene.summary ||
                              "Thêm nội dung cho cảnh phim này…"}
                          </p>
                          <div className="scene-meta">
                            <span>{scene.shots.length} shots</span>
                            <span
                              className={`badge ${scene.reviewStatus === "approved" ? "success" : ""}`}
                            >
                              {scene.reviewStatus === "approved"
                                ? "Đã duyệt"
                                : "Bản nháp"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </section>
        {selected && (
          <aside className="panel inspector">
            <div className="panel-title">
              <h3>Chi tiết cảnh</h3>
              <Button
                variant="icon ghost"
                title="Đóng chi tiết"
                onClick={() => choose(null)}
              >
                <PanelRightClose size={17} />
              </Button>
            </div>
            <div className="two-col">
              <Button
                variant="subtle small"
                onClick={() =>
                  change((s) => {
                    s.reviewStatus =
                      s.reviewStatus === "draft" ? "approved" : "draft";
                  })
                }
              >
                <Check size={14} />
                {selected.reviewStatus === "approved"
                  ? "Đã duyệt"
                  : "Duyệt cảnh"}
              </Button>
              <Button
                variant="ghost danger small"
                onClick={() => {
                  if (
                    window.confirm(
                      "Xóa cảnh cùng shot/lời thoại? Timeline liên quan cũng sẽ bị bỏ.",
                    )
                  )
                    edit((p) => deleteScenes(p, [selected.id]));
                }}
              >
                <Trash2 size={14} />
                Xóa
              </Button>
            </div>
            <div className="two-col">
              <Button
                title="Đưa cảnh lên"
                disabled={
                  p.chapters.find((c) => c.sceneIds.includes(selected.id))
                    ?.sceneIds[0] === selected.id
                }
                onClick={() => edit((p) => moveScene(p, selected.id, -1))}
              >
                <ArrowUp size={14} />
                Lên
              </Button>
              <Button
                title="Đưa cảnh xuống"
                disabled={
                  p.chapters
                    .find((c) => c.sceneIds.includes(selected.id))
                    ?.sceneIds.at(-1) === selected.id
                }
                onClick={() => edit((p) => moveScene(p, selected.id, 1))}
              >
                <ArrowDown size={14} />
                Xuống
              </Button>
              <Button
                onClick={() => {
                  let next: string | undefined;
                  edit((p) => {
                    next = duplicateScene(p, selected.id);
                  });
                  if (next) choose(next);
                }}
              >
                <Copy size={14} />
                Nhân bản cảnh
              </Button>
            </div>
            <p className="muted small">
              Đổi thứ tự cần duyệt lại tính liên tục. Timeline giữ thứ tự đã
              dựng; bản sao giữ media nhập ngoài; ảnh/video/audio AI cần chọn
              hoặc tạo lại.
            </p>
            {(
              [
                "title",
                "summary",
                "location",
                "mood",
                "continuityNotes",
              ] as const
            ).map((k) => (
              <Field
                key={k}
                label={labels[k]}
                value={selected[k]}
                multiline={k === "summary" || k === "continuityNotes"}
                onChange={(v) =>
                  change((s) => {
                    s[k] = v;
                  })
                }
              />
            ))}
            <Button
              variant="subtle small"
              onClick={() =>
                setTarget({ kind: "scene", id: selected.id, field: "summary" })
              }
            >
              <Sparkles size={14} />
              Viết lại nội dung cảnh
            </Button>
            <div className="field">
              <span>Nhân vật xuất hiện</span>
              <div className="chips">
                {p.characters.map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${selected.characterIds.includes(c.id) ? "active" : ""}`}
                    onClick={() =>
                      change((s) => {
                        s.characterIds = s.characterIds.includes(c.id)
                          ? s.characterIds.filter((id) => id !== c.id)
                          : [...s.characterIds, c.id];
                      })
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="section-head">
              <h3>Shots</h3>
              <Button
                variant="icon ghost"
                title="Thêm shot"
                onClick={() =>
                  change((s) => {
                    s.shots.push(newShot());
                  })
                }
              >
                <Plus size={16} />
              </Button>
            </div>
            {selected.shots.map((shot, idx) => (
              <div className="shot-editor" key={shot.id}>
                <div className="section-head">
                  <span className="eyebrow">SHOT {idx + 1}</span>
                  <Button
                    variant="icon ghost"
                    title="Đưa shot lên"
                    disabled={idx === 0}
                    onClick={() =>
                      edit((p) => moveShot(p, selected.id, shot.id, -1))
                    }
                  >
                    <ArrowUp size={13} />
                  </Button>
                  <Button
                    variant="icon ghost"
                    title="Đưa shot xuống"
                    disabled={idx === selected.shots.length - 1}
                    onClick={() =>
                      edit((p) => moveShot(p, selected.id, shot.id, 1))
                    }
                  >
                    <ArrowDown size={13} />
                  </Button>
                  <Button
                    variant="icon ghost"
                    title="Nhân bản shot"
                    onClick={() =>
                      edit((p) => duplicateShot(p, selected.id, shot.id))
                    }
                  >
                    <Copy size={13} />
                  </Button>
                  <Button
                    variant="icon ghost"
                    title="Xóa shot"
                    onClick={() =>
                      edit((p) => deleteShot(p, selected.id, shot.id))
                    }
                  >
                    <X size={13} />
                  </Button>
                </div>
                {(
                  [
                    "description",
                    "imagePrompt",
                    "videoPrompt",
                    "camera",
                  ] as const
                ).map((k) => (
                  <Field
                    key={k}
                    label={labels[k]}
                    value={shot[k]}
                    multiline={k !== "camera"}
                    onChange={(v) =>
                      change((s) => {
                        s.shots.find((sh) => sh.id === shot.id)![k] = v;
                      })
                    }
                  />
                ))}
                <Field
                  label="Thời lượng (frame)"
                  type="number"
                  min={1}
                  value={shot.durationFrames}
                  onChange={(v) =>
                    change((s) => {
                      s.shots.find((sh) => sh.id === shot.id)!.durationFrames =
                        Number(v);
                    })
                  }
                />
                <div className="row">
                  <Button
                    variant="subtle small"
                    onClick={() =>
                      setMedia({
                        target: {
                          kind: "shot",
                          id: shot.id,
                          field: "imagePrompt",
                        },
                        kind: "image",
                        prompt: shot.imagePrompt,
                      })
                    }
                  >
                    <ImageIcon size={14} />
                    Tạo ảnh
                  </Button>
                  <Button
                    variant="subtle small"
                    onClick={() =>
                      setMedia({
                        target: {
                          kind: "shot",
                          id: shot.id,
                          field: "videoPrompt",
                        },
                        kind: "video",
                        prompt: shot.videoPrompt,
                        seconds: shot.durationFrames / frameRate(p),
                      })
                    }
                  >
                    <Video size={14} />
                    Tạo video
                  </Button>
                </div>
                <Select
                  label="Chọn variant ảnh"
                  value={shot.selectedImageAssetId || ""}
                  options={[
                    ["", "Chưa chọn"],
                    ...p.assets
                      .filter((a) => a.kind === "image")
                      .map(
                        (a) =>
                          [a.id, a.originalName || a.id] as [string, string],
                      ),
                  ]}
                  onChange={(v) =>
                    change((s) => {
                      const sh = s.shots.find((sh) => sh.id === shot.id)!;
                      if (v) sh.selectedImageAssetId = v;
                      else delete sh.selectedImageAssetId;
                    })
                  }
                />
                <Select
                  label="Chọn variant video"
                  value={shot.selectedVideoAssetId || ""}
                  options={[
                    ["", "Chưa chọn"],
                    ...p.assets
                      .filter((a) => a.kind === "video")
                      .map(
                        (a) =>
                          [a.id, a.originalName || a.id] as [string, string],
                      ),
                  ]}
                  onChange={(v) =>
                    change((s) => {
                      const sh = s.shots.find((sh) => sh.id === shot.id)!;
                      if (v) sh.selectedVideoAssetId = v;
                      else delete sh.selectedVideoAssetId;
                    })
                  }
                />
                <Button
                  variant="ghost small"
                  disabled={
                    !shot.selectedImageAssetId && !shot.selectedVideoAssetId
                  }
                  onClick={() =>
                    edit((p) => {
                      p.timeline.items.push({
                        id: uid(),
                        sceneId: selected.id,
                        shotId: shot.id,
                        assetId: (shot.selectedVideoAssetId ||
                          shot.selectedImageAssetId)!,
                        inFrame: 0,
                        durationFrames: shot.durationFrames,
                        transitionOut: { kind: "cut", durationFrames: 0 },
                        sourceAudio: "mute",
                        sourceAudioGainDb: 0,
                      });
                    })
                  }
                >
                  <Plus size={14} />
                  Thêm vào timeline
                </Button>
              </div>
            ))}
            <div className="section-head">
              <h3>Lời thoại</h3>
              <Button
                title="Thêm lời thoại"
                variant="icon ghost"
                onClick={() =>
                  change((s) => {
                    s.dialogues.push({
                      id: uid(),
                      kind: "narration",
                      text: "",
                      startFrame: 0,
                    });
                  })
                }
              >
                <Plus size={15} />
              </Button>
            </div>
            {selected.dialogues.map((d) => (
              <div className="shot-editor" key={d.id}>
                <Select
                  label="Người nói"
                  value={d.speakerId || ""}
                  options={[
                    ["", "Người kể"],
                    ...p.characters.map(
                      (c) => [c.id, c.name] as [string, string],
                    ),
                  ]}
                  onChange={(v) =>
                    change((s) => {
                      const dialog = s.dialogues.find((x) => x.id === d.id)!;
                      if (v) {
                        dialog.speakerId = v;
                        dialog.kind = "dialogue";
                      } else {
                        delete dialog.speakerId;
                        dialog.kind = "narration";
                      }
                    })
                  }
                />
                <Field
                  label="Lời thoại"
                  value={d.text}
                  multiline
                  onChange={(v) =>
                    change((s) => {
                      s.dialogues.find((x) => x.id === d.id)!.text = v;
                    })
                  }
                />
                <Field
                  label="Cảm xúc khi đọc"
                  value={d.emotion ?? ""}
                  onChange={(v) =>
                    change((s) => {
                      s.dialogues.find((x) => x.id === d.id)!.emotion = v;
                    })
                  }
                />
                <Field
                  label="Ghi chú phát âm"
                  value={d.pronunciationNotes ?? ""}
                  onChange={(v) =>
                    change((s) => {
                      s.dialogues.find(
                        (x) => x.id === d.id,
                      )!.pronunciationNotes = v;
                    })
                  }
                />
                {d.voiceOverride && (
                  <Button
                    variant="ghost small"
                    onClick={() =>
                      change((s) => {
                        delete s.dialogues.find((x) => x.id === d.id)!
                          .voiceOverride;
                      })
                    }
                  >
                    Bỏ giọng riêng, dùng giọng nhân vật
                  </Button>
                )}
                <div className="row">
                  <Button
                    variant="ghost small"
                    onClick={() =>
                      setTarget({ kind: "dialogue", id: d.id, field: "text" })
                    }
                  >
                    <Sparkles size={13} />
                    Sửa riêng
                  </Button>
                  <Button
                    variant="ghost small"
                    onClick={() =>
                      setMedia({
                        kind: "voice",
                        target: { kind: "dialogue", id: d.id, field: "text" },
                        prompt: d.text,
                      })
                    }
                  >
                    <Volume2 size={13} />
                    Tạo giọng
                  </Button>
                  <Button
                    variant="icon ghost"
                    title="Xóa lời thoại"
                    onClick={() =>
                      change((s) => {
                        s.dialogues = s.dialogues.filter((x) => x.id !== d.id);
                      })
                    }
                  >
                    <X size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>
      <Proposals />
      {target && <AiDialog target={target} onClose={() => setTarget(null)} />}
      {media && <AiDialog {...media} onClose={() => setMedia(null)} />}
    </>
  );
}
function Timeline() {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const [selected, setSelected] = useState<string | null>(null);
  const item =
    p.timeline.items.find((t) => t.id === selected) || p.timeline.items[0];
  const asset = p.assets.find((a) => a.id === item?.assetId);
  const rate = frameRate(p);
  function update(m: (t: TimelineItem) => void) {
    if (item) edit((p) => m(p.timeline.items.find((t) => t.id === item.id)!));
  }
  return (
    <>
      <PageHeading
        eyebrow="DỰNG PHIM / TIMELINE"
        title="Tìm nhịp điệu cho câu chuyện."
        description="Sắp xếp, trim và kết nối từng đoạn phim. Thời gian được tính chính xác theo frame."
        action={
          <NavLink to="/library" className="button">
            <Plus size={16} />
            Thêm media
          </NavLink>
        }
      />
      <div className="timeline-top">
        <section className="preview-stage">
          {asset ? (
            <AssetPreview asset={asset} />
          ) : (
            <div>
              <Play size={36} />
              <p>Chọn một đoạn để xem media nguồn</p>
            </div>
          )}
          <div className="preview-footer">
            <span>PREVIEW NGUỒN · DRAFT HIỂN THỊ SAU RENDER</span>
            <span>{time(plannedFrames(p) / rate)}</span>
          </div>
        </section>
        <aside className="panel">
          <h3>Thuộc tính đoạn</h3>
          {item ? (
            <>
              <Select
                label="Media"
                value={item.assetId}
                options={p.assets
                  .filter((a) => a.kind === "image" || a.kind === "video")
                  .map((a) => [a.id, a.originalName || a.id])}
                onChange={(v) =>
                  update((t) => {
                    t.assetId = v;
                  })
                }
              />
              <div className="two-col">
                <Field
                  label="In (frame)"
                  type="number"
                  min={0}
                  value={item.inFrame}
                  onChange={(v) =>
                    update((t) => {
                      t.inFrame = Number(v);
                    })
                  }
                />
                <Field
                  label="Độ dài (frame)"
                  type="number"
                  min={1}
                  value={item.durationFrames}
                  onChange={(v) =>
                    update((t) => {
                      t.durationFrames = Number(v);
                    })
                  }
                />
              </div>
              <Select
                label="Chuyển tiếp ra"
                value={item.transitionOut.kind}
                options={[
                  ["cut", "Cut"],
                  ["crossfade", "Crossfade"],
                ]}
                onChange={(v) =>
                  update((t) => {
                    t.transitionOut = {
                      kind: v as "cut" | "crossfade",
                      durationFrames: v === "cut" ? 0 : Math.round(rate / 2),
                    };
                  })
                }
              />
              {item.transitionOut.kind === "crossfade" && (
                <Field
                  label="Overlap (frame)"
                  type="number"
                  min={1}
                  value={item.transitionOut.durationFrames}
                  onChange={(v) =>
                    update((t) => {
                      t.transitionOut.durationFrames = Number(v);
                    })
                  }
                />
              )}
              <Select
                label="Âm thanh nguồn"
                value={item.sourceAudio}
                options={[
                  ["mute", "Tắt tiếng"],
                  ["keep", "Giữ âm nguồn"],
                ]}
                onChange={(v) =>
                  update((t) => {
                    t.sourceAudio = v as "mute" | "keep";
                  })
                }
              />
              <Field
                label="Âm lượng nguồn (dB)"
                type="number"
                value={item.sourceAudioGainDb}
                onChange={(v) =>
                  update((t) => {
                    t.sourceAudioGainDb = Number(v);
                  })
                }
              />
            </>
          ) : (
            <p className="muted">Thêm media từ thư viện hoặc shot đã chọn.</p>
          )}
        </aside>
      </div>
      <section className="panel timeline-panel">
        <div className="section-head">
          <h3>
            <Layers size={16} /> Timeline
          </h3>
          <span className="badge">
            {plannedFrames(p)} frames · {rate.toFixed(3)} FPS
          </span>
        </div>
        <div className="timeline-ruler">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i}>{time(((plannedFrames(p) / rate) * i) / 5)}</span>
          ))}
        </div>
        <div className="timeline-strip">
          {p.timeline.items.map((t, i) => {
            const a = p.assets.find((a) => a.id === t.assetId);
            return (
              <button
                key={t.id}
                className={`timeline-clip ${item?.id === t.id ? "selected" : ""}`}
                onClick={() => setSelected(t.id)}
              >
                <Film size={15} />
                <strong>
                  {i + 1}. {a?.originalName || "Đoạn phim"}
                </strong>
                <span>
                  {time(t.durationFrames / rate)} · {t.durationFrames}f
                </span>
              </button>
            );
          })}
        </div>
        {!p.timeline.items.length && (
          <div className="timeline-empty">
            Chưa có đoạn phim • Thêm ảnh hoặc video để bắt đầu
          </div>
        )}
        {item && (
          <div className="row">
            <Button
              variant="ghost small"
              disabled={p.timeline.items[0]?.id === item.id}
              onClick={() =>
                edit((p) => {
                  const i = p.timeline.items.findIndex((t) => t.id === item.id);
                  [p.timeline.items[i - 1], p.timeline.items[i]] = [
                    p.timeline.items[i],
                    p.timeline.items[i - 1],
                  ];
                })
              }
            >
              <ArrowLeft size={14} />
              Đưa lên trước
            </Button>
            <Button
              variant="ghost small"
              disabled={p.timeline.items.at(-1)?.id === item.id}
              onClick={() =>
                edit((p) => {
                  const i = p.timeline.items.findIndex((t) => t.id === item.id);
                  [p.timeline.items[i + 1], p.timeline.items[i]] = [
                    p.timeline.items[i],
                    p.timeline.items[i + 1],
                  ];
                })
              }
            >
              Đưa ra sau
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="ghost small danger"
              onClick={() =>
                edit((p) => {
                  p.timeline.items = p.timeline.items.filter(
                    (t) => t.id !== item.id,
                  );
                })
              }
            >
              <Trash2 size={14} />
              Bỏ đoạn
            </Button>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <h3>
            <Volume2 size={17} /> Voice & nhạc nền
          </h3>
          <Select
            label="Thêm audio"
            value=""
            options={[
              ["", "Chọn audio đã nhập"],
              ...p.assets
                .filter((a) => a.kind === "audio")
                .map((a) => [a.id, a.originalName || a.id] as [string, string]),
            ]}
            onChange={(v) => {
              if (v)
                edit((p) => {
                  const a = p.assets.find((a) => a.id === v)!;
                  p.timeline.audioTracks.push({
                    id: uid(),
                    assetId: v,
                    kind: "voice",
                    startFrame: 0,
                    inFrame: 0,
                    durationFrames: Math.max(
                      1,
                      Math.floor(((a.durationMs || 1000) * rate) / 1000),
                    ),
                    gainDb: 0,
                    fadeInFrames: 0,
                    fadeOutFrames: 0,
                    loop: false,
                  });
                });
            }}
          />
        </div>
        {p.timeline.audioTracks.map((t) => (
          <div key={t.id} className="audio-track">
            <span>
              <Volume2 size={15} />
              {p.assets.find((a) => a.id === t.assetId)?.originalName}
            </span>
            <div className="audio-fields">
              <Select
                label="Loại"
                value={t.kind}
                options={[
                  ["voice", "Giọng nói"],
                  ["music", "Nhạc nền"],
                ]}
                onChange={(v) =>
                  edit((p) => {
                    p.timeline.audioTracks.find((a) => a.id === t.id)!.kind =
                      v as "voice" | "music";
                  })
                }
              />
              {(
                [
                  "startFrame",
                  "inFrame",
                  "durationFrames",
                  "gainDb",
                  "fadeInFrames",
                  "fadeOutFrames",
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      startFrame: "Bắt đầu",
                      inFrame: "Trim in",
                      durationFrames: "Độ dài",
                      gainDb: "Gain dB",
                      fadeInFrames: "Fade in",
                      fadeOutFrames: "Fade out",
                    }[k]
                  }
                  type="number"
                  value={t[k]}
                  onChange={(v) =>
                    edit((p) => {
                      p.timeline.audioTracks.find((a) => a.id === t.id)![k] =
                        Number(v);
                    })
                  }
                />
              ))}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={t.loop}
                  onChange={(e) =>
                    edit((p) => {
                      p.timeline.audioTracks.find((a) => a.id === t.id)!.loop =
                        e.target.checked;
                    })
                  }
                />
                Loop
              </label>
              <Button
                title="Xóa audio"
                variant="icon ghost danger"
                onClick={() =>
                  edit((p) => {
                    p.timeline.audioTracks = p.timeline.audioTracks.filter(
                      (a) => a.id !== t.id,
                    );
                  })
                }
              >
                <X size={15} />
              </Button>
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="section-head">
          <h3>Phụ đề</h3>
          <div className="row">
            <Select
              label="Chế độ"
              value={p.timeline.subtitleMode}
              options={[
                ["none", "Không xuất"],
                ["sidecar", "File SRT riêng"],
                ["burn_in", "Ghi lên video"],
              ]}
              onChange={(v) =>
                edit((p) => {
                  p.timeline.subtitleMode =
                    v as Project["timeline"]["subtitleMode"];
                })
              }
            />
            <Button
              onClick={() =>
                edit((p) => {
                  p.timeline.subtitles.push({
                    id: uid(),
                    startFrame: 0,
                    endFrame: Math.round(rate * 2),
                    text: "",
                  });
                })
              }
            >
              <Plus size={15} />
              Thêm cue
            </Button>
          </div>
        </div>
        {p.timeline.subtitles.map((c) => (
          <div className="subtitle-row" key={c.id}>
            <Field
              label="Start frame"
              type="number"
              value={c.startFrame}
              onChange={(v) =>
                edit((p) => {
                  p.timeline.subtitles.find((x) => x.id === c.id)!.startFrame =
                    Number(v);
                })
              }
            />
            <Field
              label="End frame"
              type="number"
              value={c.endFrame}
              onChange={(v) =>
                edit((p) => {
                  p.timeline.subtitles.find((x) => x.id === c.id)!.endFrame =
                    Number(v);
                })
              }
            />
            <Field
              label="Nội dung"
              value={c.text}
              onChange={(v) =>
                edit((p) => {
                  p.timeline.subtitles.find((x) => x.id === c.id)!.text = v;
                })
              }
            />
            <Button
              title="Xóa cue"
              variant="icon ghost"
              onClick={() =>
                edit((p) => {
                  p.timeline.subtitles = p.timeline.subtitles.filter(
                    (x) => x.id !== c.id,
                  );
                })
              }
            >
              <X size={15} />
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}
function Library() {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const action = useAction();
  const [relinked, setRelinked] = useState(0);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  return (
    <>
      <PageHeading
        eyebrow="ASSETS / THƯ VIỆN"
        title="Chất liệu cho thước phim của bạn."
        description="Ảnh, video và âm thanh được lưu cùng dự án. File gốc luôn được giữ nguyên."
        action={
          <Button
            variant="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const files = await select("file");
                if (!files.length) return;
                const p = await flush();
                const saved = await call<Project>(
                  "asset_import",
                  { tokens: files.map((f) => f.token) },
                  p!,
                );
                useEditor.getState().load(saved);
              })
            }
          >
            <Upload size={16} />
            {action.busy ? "Đang nhập…" : "Nhập media"}
          </Button>
        }
      />
      {action.errorView}
      {message && <div className="notice">{message}</div>}
      <div className="tabs">
        {[
          ["all", "Tất cả"],
          ["image", "Hình ảnh"],
          ["video", "Video"],
          ["audio", "Âm thanh"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={filter === k ? "active" : ""}
            onClick={() => setFilter(k)}
          >
            {l}
            <span>
              {p.assets.filter((a) => k === "all" || a.kind === k).length}
            </span>
          </button>
        ))}
      </div>
      {!p.assets.length ? (
        <Empty
          icon={<FolderOpen />}
          heading="Thư viện đang chờ những khung hình"
        >
          Nhập media từ thiết bị hoặc tạo bằng AI trong màn hình Phân cảnh.
        </Empty>
      ) : (
        <div className="asset-grid">
          {p.assets
            .filter((a) => filter === "all" || a.kind === filter)
            .map((a) => (
              <article className="asset-card" key={a.id}>
                <div className="asset-preview">
                  <AssetPreview key={`${a.id}-${relinked}`} asset={a} />
                </div>
                <div className="asset-card-body">
                  <h3 title={a.originalName}>{a.originalName || a.id}</h3>
                  <p>
                    {a.kind.toUpperCase()} ·{" "}
                    {(a.bytes / 1024 / 1024).toFixed(1)} MB
                    {a.durationMs ? ` · ${time(a.durationMs / 1000)}` : ""}
                  </p>
                  <div className="row">
                    {a.kind !== "audio" && a.kind !== "subtitle" && (
                      <Button
                        variant="ghost small"
                        onClick={() =>
                          edit((p) => {
                            p.timeline.items.push({
                              id: uid(),
                              assetId: a.id,
                              inFrame: 0,
                              durationFrames:
                                a.kind === "image"
                                  ? Math.round(frameRate(p) * 4)
                                  : Math.max(
                                      1,
                                      Math.floor(
                                        ((a.durationMs || 1000) *
                                          frameRate(p)) /
                                          1000,
                                      ),
                                    ),
                              transitionOut: { kind: "cut", durationFrames: 0 },
                              sourceAudio: "keep",
                              sourceAudioGainDb: 0,
                            });
                          })
                        }
                      >
                        <Plus size={13} />
                        Timeline
                      </Button>
                    )}
                    <Button
                      variant="ghost small"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          const files = await select("file");
                          if (!files.length) return;
                          if (files.length !== 1)
                            throw Error(
                              "Chọn đúng một file gốc để liên kết lại.",
                            );
                          const latest = await flush();
                          await call(
                            "asset_relink",
                            { id: a.id, token: files[0].token },
                            latest!,
                          );
                          setRelinked((n) => n + 1);
                          setMessage(
                            "Đã xác minh và phục hồi file gốc. Timeline và lịch sử được giữ nguyên.",
                          );
                        })
                      }
                    >
                      <FolderOpen size={13} />
                      Tìm lại file gốc
                    </Button>
                    <Button
                      variant="icon ghost danger"
                      title="Bỏ asset khỏi thư viện"
                      onClick={() =>
                        void action.run(async () => {
                          if (
                            !window.confirm(
                              "Bỏ asset khỏi thư viện? Asset đang được dùng sẽ bị chặn. File gốc/lịch sử vẫn được giữ.",
                            )
                          )
                            return;
                          const p = await flush();
                          useEditor
                            .getState()
                            .load(
                              await call<Project>(
                                "asset_remove",
                                { id: a.id },
                                p!,
                              ),
                            );
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                    <span className="badge">
                      {a.origin === "generated" ? "AI variant" : "Local"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}
    </>
  );
}
const defaultVideo: VideoSettings = {
  targetDurationMs: 60000,
  durationPolicy: "target",
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  fps: { numerator: 30, denominator: 1 },
  fit: "contain",
  backgroundColor: "#101114",
};
function VideoForm({
  v,
  onChange,
}: {
  v: VideoSettings;
  onChange: (v: VideoSettings) => void;
}) {
  return (
    <>
      <div className="two-col">
        <Select
          label="Tỷ lệ khung hình"
          value={v.aspectRatio}
          options={[
            ["16:9", "16:9 · Ngang"],
            ["9:16", "9:16 · Dọc"],
            ["1:1", "1:1 · Vuông"],
            ["4:3", "4:3"],
            ["custom", "Tùy chỉnh"],
          ]}
          onChange={(ratio) => {
            const [w, h] =
              ratio === "9:16"
                ? [1080, 1920]
                : ratio === "1:1"
                  ? [1080, 1080]
                  : ratio === "4:3"
                    ? [1440, 1080]
                    : [1920, 1080];
            onChange({
              ...v,
              aspectRatio: ratio as VideoSettings["aspectRatio"],
              width: w,
              height: h,
            });
          }}
        />
        <Select
          label="FPS"
          value={`${v.fps.numerator}/${v.fps.denominator}`}
          options={["24/1", "25/1", "30/1", "30000/1001", "60/1"].map((x) => [
            x,
            x,
          ])}
          onChange={(value) => {
            const [numerator, denominator] = value.split("/").map(Number);
            onChange({ ...v, fps: { numerator, denominator } });
          }}
        />
        <Field
          label="Chiều rộng (px)"
          type="number"
          min={2}
          step={2}
          value={v.width}
          onChange={(s) => onChange({ ...v, width: Number(s) })}
        />
        <Field
          label="Chiều cao (px)"
          type="number"
          min={2}
          step={2}
          value={v.height}
          onChange={(s) => onChange({ ...v, height: Number(s) })}
        />
        <Select
          label="Fit hình"
          value={v.fit}
          options={[
            ["contain", "Contain · Giữ toàn bộ hình"],
            ["cover", "Cover · Cắt đầy khung"],
          ]}
          onChange={(fit) =>
            onChange({ ...v, fit: fit as "contain" | "cover" })
          }
        />
        <Field
          label="Màu nền"
          type="color"
          value={v.backgroundColor}
          onChange={(s) => onChange({ ...v, backgroundColor: s })}
        />
        <Field
          label="Mục tiêu (giây)"
          type="number"
          min={1}
          value={v.targetDurationMs / 1000}
          onChange={(s) =>
            onChange({ ...v, targetDurationMs: Math.round(Number(s) * 1000) })
          }
        />
        <Select
          label="Chính sách thời lượng"
          value={v.durationPolicy}
          options={[
            ["target", "Mục tiêu · Cho phép lệch"],
            ["strict", "Strict · Tối đa ±1 frame"],
          ]}
          onChange={(s) =>
            onChange({ ...v, durationPolicy: s as "target" | "strict" })
          }
        />
      </div>
    </>
  );
}
function Export() {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const action = useAction();
  const [allowStale, setAllowStale] = useState(false);
  const [preflight, setPreflight] = useState<{
    token: string;
    plannedFrames: number;
    estimatedBytes: number;
    revision: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="RENDER / XUẤT VIDEO"
        title="Sẵn sàng cho màn ảnh."
        description="Kiểm tra timeline, media và thời lượng trước khi xuất MP4. Không sử dụng AI trả phí."
      />
      <div className="export-layout">
        <section className="panel">
          <div className="panel-title">
            <SlidersHorizontal size={18} />
            <h2>Thông số đầu ra</h2>
          </div>
          <VideoForm
            v={p.video}
            onChange={(v) => {
              setPreflight(null);
              edit((p) => {
                const old = frameRate(p),
                  next = v.fps.numerator / v.fps.denominator;
                const f = (x: number) => Math.round((x / old) * next);
                if (old !== next) {
                  p.timeline.items.forEach((t) => {
                    t.inFrame = f(t.inFrame);
                    t.durationFrames = Math.max(1, f(t.durationFrames));
                    t.transitionOut.durationFrames = f(
                      t.transitionOut.durationFrames,
                    );
                  });
                  p.timeline.audioTracks.forEach((t) => {
                    t.inFrame = f(t.inFrame);
                    t.startFrame = f(t.startFrame);
                    t.durationFrames = Math.max(1, f(t.durationFrames));
                    t.fadeInFrames = f(t.fadeInFrames);
                    t.fadeOutFrames = f(t.fadeOutFrames);
                  });
                  p.timeline.subtitles.forEach((c) => {
                    c.startFrame = f(c.startFrame);
                    c.endFrame = f(c.endFrame);
                  });
                  p.scenes.forEach((s) => {
                    s.shots.forEach(
                      (sh) =>
                        (sh.durationFrames = Math.max(1, f(sh.durationFrames))),
                    );
                    s.dialogues.forEach((d) => {
                      d.startFrame = f(d.startFrame);
                      if (d.durationFrames)
                        d.durationFrames = f(d.durationFrames);
                    });
                  });
                }
                p.video = v;
              });
            }}
          />
          <div className="info-note">
            <Film size={18} />
            <p>
              MP4 · H.264 · yuv420p · AAC 48 kHz stereo
              <br />
              Đổi FPS quy đổi toàn bộ mốc thời gian theo giây.
            </p>
          </div>
        </section>
        <section className="panel export-summary">
          <div className="export-icon">
            <Download size={27} />
          </div>
          <h2>Kiểm tra trước khi xuất</h2>
          <div className="summary-row">
            <span>Đoạn phim</span>
            <strong>{p.timeline.items.length}</strong>
          </div>
          <div className="summary-row">
            <span>Thời lượng mục tiêu</span>
            <strong>{time(p.video.targetDurationMs / 1000)}</strong>
          </div>
          <div className="summary-row">
            <span>Thời lượng kế hoạch</span>
            <strong>{time(plannedFrames(p) / frameRate(p))}</strong>
          </div>
          <div className="summary-row">
            <span>Actual</span>
            <strong>Đo sau render</strong>
          </div>
          <div className="summary-row">
            <span>Phụ đề</span>
            <strong>{p.timeline.subtitleMode}</strong>
          </div>
          {preflight && (
            <div className="success-box">
              <CheckCircle2 size={18} />
              <span>
                Preflight hợp lệ · Revision {preflight.revision}
                <small>
                  Dung lượng tạm ước tính{" "}
                  {(preflight.estimatedBytes / 1024 / 1024).toFixed(0)} MB
                </small>
              </span>
            </div>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={allowStale}
              onChange={(e) => {
                setAllowStale(e.target.checked);
                setPreflight(null);
              }}
            />
            Cho phép dùng asset từ input cũ (ghi vào manifest)
          </label>
          <Button
            variant="wide"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const latest = await flush();
                setPreflight(
                  await call("render_preflight", { allowStale }, latest!),
                );
              })
            }
          >
            <ShieldCheck size={16} />
            Kiểm tra media & dung lượng
          </Button>
          <Button
            variant="primary wide"
            disabled={!preflight || action.busy}
            onClick={() =>
              void action.run(async () => {
                const latest = await flush();
                const [file] = await select("save");
                if (!file) return;
                await call(
                  "render_start",
                  {
                    token: preflight!.token,
                    destinationToken: file.token,
                    mode: "final",
                  },
                  latest!,
                );
                setPreflight(null);
                setMessage(
                  "Đã đưa vào hàng đợi. Bạn có thể tiếp tục biên tập.",
                );
              })
            }
          >
            <Play size={16} />
            Chọn nơi lưu & render
          </Button>
          {message && <p className="success-text">{message}</p>}
          {action.errorView}
        </section>
      </div>
    </>
  );
}
type MergeInput = {
  token: string;
  name: string;
  durationMs: number;
  bytes: number;
  sha256: string;
  inFrame?: number;
  durationFrames?: number;
};
function Merge() {
  const [inputs, setInputs] = useState<MergeInput[]>([]);
  const [video, setVideo] = useState<VideoSettings>({ ...defaultVideo });
  const [message, setMessage] = useState("");
  const action = useAction();
  return (
    <>
      <PageHeading
        eyebrow="CÔNG CỤ / GHÉP VIDEO"
        title="Nhiều đoạn phim. Một câu chuyện."
        description="Ghép video local, kể cả nguồn khác độ phân giải hoặc không có audio. Không cần dự án hoặc API key."
        action={
          <Button
            variant="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const files = await select("file");
                if (files.length)
                  setInputs([
                    ...inputs,
                    ...(await call<MergeInput[]>("merge_probe", {
                      tokens: files.map((f) => f.token),
                    })),
                  ]);
              })
            }
          >
            <Plus size={16} />
            Chọn video
          </Button>
        }
      />
      <div className="merge-layout">
        <section className="panel">
          {!inputs.length ? (
            <Empty
              icon={<Combine size={28} />}
              heading="Chọn các video để bắt đầu"
            >
              Thêm video theo thứ tự mong muốn. Nguồn được sao chép vào cache để
              xử lý an toàn.
            </Empty>
          ) : (
            inputs.map((i, index) => (
              <div className="merge-item" key={i.token}>
                <span className="chapter-number">{index + 1}</span>
                <Film size={24} />
                <div>
                  <strong>{i.name}</strong>
                  <small>
                    {time(i.durationMs / 1000)} ·{" "}
                    {(i.bytes / 1024 / 1024).toFixed(1)} MB
                  </small>
                </div>
                <Button
                  variant="icon ghost"
                  title="Đưa lên"
                  disabled={!index}
                  onClick={() => {
                    const next = [...inputs];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    setInputs(next);
                  }}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Đưa xuống"
                  disabled={index === inputs.length - 1}
                  onClick={() => {
                    const next = [...inputs];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    setInputs(next);
                  }}
                >
                  <ArrowDown size={15} />
                </Button>
                <Button
                  variant="icon ghost"
                  title="Bỏ video"
                  onClick={() =>
                    setInputs(inputs.filter((x) => x.token !== i.token))
                  }
                >
                  <X size={15} />
                </Button>
              </div>
            ))
          )}
          <div className="summary-row">
            <span>Tổng thời lượng nguồn</span>
            <strong>
              {time(inputs.reduce((t, i) => t + i.durationMs, 0) / 1000)}
            </strong>
          </div>
          <p className="muted small">
            Cut · Nguồn khác định dạng được chuẩn hóa theo profile đích. File
            nguồn không bị ghi đè.
          </p>
        </section>
        <section className="panel">
          <h3>Profile đầu ra</h3>
          <VideoForm v={video} onChange={setVideo} />
          <Button
            variant="primary wide"
            disabled={!inputs.length || action.busy}
            onClick={() =>
              void action.run(async () => {
                const [file] = await select("save");
                if (!file) return;
                await call("merge_start", {
                  inputs,
                  video,
                  destinationToken: file.token,
                });
                setMessage("Đã tạo tác vụ ghép video. Xem tiến độ ở hàng đợi.");
              })
            }
          >
            <Combine size={16} />
            {action.busy ? "Đang chuẩn bị…" : "Chọn nơi lưu & ghép"}
          </Button>
          {message && <p className="success-text">{message}</p>}
          {action.errorView}
        </section>
      </div>
    </>
  );
}
function SettingsPage() {
  const p = useEditor((s) => s.project);
  const edit = useEditor((s) => s.edit);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => call<Settings>("settings_get"),
    enabled: desktop,
  });
  const action = useAction();
  const [key, setKey] = useState("");
  const [connection, setConnection] = useState("");
  const [sessionOnly, setSessionOnly] = useState(false);
  const [message, setMessage] = useState("");
  const catalog = useQuery({
    queryKey: ["providers"],
    queryFn: () =>
      call<{ kind: ProviderKind; models: string[] }[]>("provider_list"),
    enabled: desktop,
  });
  const boot = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => call<Bootstrap>("app_bootstrap"),
    enabled: desktop,
  });
  return (
    <>
      <PageHeading
        eyebrow="PREFERENCES / CÀI ĐẶT"
        title="Studio theo cách của bạn."
        description="Kết nối AI độc lập cho Text, Image, Video và Voice. Dữ liệu và API key nằm trên thiết bị."
      />
      <div className="settings-layout">
        <section className="panel">
          <div className="panel-title">
            <Sparkles size={18} />
            <h2>Kết nối AI</h2>
            <Button
              variant="small"
              disabled={!desktop}
              onClick={() =>
                void action.run(async () => {
                  const id = uid();
                  await call("settings_update", {
                    connections: [
                      ...(q.data?.connections || []),
                      {
                        id,
                        label: `OpenAI ${(q.data?.connections.length || 0) + 1}`,
                      },
                    ],
                  });
                  await qc.invalidateQueries({ queryKey: ["settings"] });
                  setConnection(id);
                })
              }
            >
              <Plus size={14} />
              Thêm OpenAI
            </Button>
          </div>
          <Select
            label="Connection"
            value={connection}
            options={[
              ["", "Chọn connection"],
              ...(q.data?.connections || []).map(
                (c) => [c.id, c.label] as [string, string],
              ),
            ]}
            onChange={setConnection}
          />
          <Field
            label="API key"
            type="password"
            value={key}
            onChange={setKey}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={sessionOnly}
              onChange={(e) => setSessionOnly(e.target.checked)}
            />
            Chỉ dùng trong phiên (không ghi xuống đĩa)
          </label>
          <div className="row">
            <Button
              disabled={!key || !connection || action.busy}
              variant="primary"
              onClick={() =>
                void action.run(async () => {
                  const secret = key;
                  setKey("");
                  await call("secret_set", {
                    connectionId: connection,
                    key: secret,
                    sessionOnly,
                  });
                  setMessage("Đã lưu key. Frontend không thể đọc lại secret.");
                })
              }
            >
              <Lock size={14} />
              Lưu key
            </Button>
            <Button
              disabled={!connection || action.busy}
              onClick={() =>
                void action.run(async () => {
                  await call("provider_test", { connectionId: connection });
                  setMessage(
                    "Kết nối thành công. Chỉ gọi danh sách model, không tạo nội dung trả phí.",
                  );
                })
              }
            >
              <ShieldCheck size={14} />
              Kiểm tra kết nối
            </Button>
            <Button
              variant="ghost danger"
              disabled={!connection}
              onClick={() =>
                void action.run(async () => {
                  await call("secret_delete", { connectionId: connection });
                  setMessage("Đã xóa key.");
                })
              }
            >
              Xóa key
            </Button>
          </div>
          <p className="muted small">
            Adapter OpenAI dùng API HTTPS chính thức. Image/video ở bản này chưa
            gửi ảnh tham chiếu. Khả năng truy cập model phụ thuộc tài khoản.
          </p>
          {message && <p className="success-text">{message}</p>}
          {action.errorView}
        </section>
        <section className="panel">
          <h2>Bindings của dự án</h2>
          {p ? (
            (catalog.data || []).map((c) => (
              <div className="binding-row" key={c.kind}>
                <span className="capability">
                  {c.kind === "text" ? (
                    <BookOpen size={17} />
                  ) : c.kind === "image" ? (
                    <ImageIcon size={17} />
                  ) : c.kind === "video" ? (
                    <Video size={17} />
                  ) : (
                    <Volume2 size={17} />
                  )}{" "}
                  {c.kind}
                </span>
                <Select
                  label="Connection"
                  value={p.providerBindings[c.kind]?.connectionId || ""}
                  options={[
                    ["", "Chưa cấu hình"],
                    ...(q.data?.connections || []).map(
                      (c) => [c.id, c.label] as [string, string],
                    ),
                  ]}
                  onChange={(v) =>
                    edit((p) => {
                      p.providerBindings[c.kind] = v
                        ? { connectionId: v, modelId: c.models[0] }
                        : null;
                    })
                  }
                />
                <Select
                  label="Model"
                  value={p.providerBindings[c.kind]?.modelId || c.models[0]}
                  options={c.models.map((m) => [m, m])}
                  onChange={(v) =>
                    edit((p) => {
                      if (p.providerBindings[c.kind])
                        p.providerBindings[c.kind]!.modelId = v;
                    })
                  }
                />
              </div>
            ))
          ) : (
            <p className="muted">
              Mở dự án để chọn binding. Thay Voice không ảnh hưởng Text, Image
              hoặc Video.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Thiết bị & quyền riêng tư</h2>
          <div className="summary-row">
            <span>Data root</span>
            <code>{boot.data?.dataRoot || "~/AI-Video-Studio"}</code>
          </div>
          <div className="summary-row">
            <span>FFmpeg</span>
            <small>{boot.data?.diagnostics.ffmpeg || "Chưa xác minh"}</small>
          </div>
          <div className="summary-row">
            <span>Telemetry</span>
            <span className="badge success">Tắt</span>
          </div>
          <div className="summary-row">
            <span>Tự động tạo AI lúc mở app</span>
            <span>Không</span>
          </div>
          {p && (
            <Button
              onClick={() =>
                void action.run(async () => {
                  await call("storage_cleanup", {}, p);
                  setMessage(
                    "Đã xóa cache normalized. Original và revision được giữ nguyên.",
                  );
                })
              }
            >
              <Trash2 size={15} />
              Dọn cache render
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
function CharacterVoice({ character }: { character: Character }) {
  const p = useEditor((s) => s.project)!;
  const edit = useEditor((s) => s.edit);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => call<Settings>("settings_get"),
    enabled: desktop,
  });
  const update = (change: (v: NonNullable<Character["voice"]>) => void) =>
    edit((p) => {
      const v = p.characters.find((c) => c.id === character.id)!.voice;
      if (v) change(v);
    });
  return (
    <section className="panel">
      <h3>Giọng nhân vật</h3>
      <Select
        label="Kết nối giọng"
        value={character.voice?.binding.connectionId ?? ""}
        options={[
          ["", "Dùng cấu hình Voice của dự án"],
          ...(settings.data?.connections ?? []).map(
            (c) => [c.id, c.label] as [string, string],
          ),
        ]}
        onChange={(v) =>
          edit((p) => {
            const c = p.characters.find((c) => c.id === character.id)!;
            if (!v) delete c.voice;
            else
              c.voice = {
                binding: { connectionId: v, modelId: "gpt-4o-mini-tts" },
                voiceId: c.voice?.voiceId ?? "coral",
                speed: c.voice?.speed ?? 1,
                language: c.voice?.language ?? p.language,
              };
          })
        }
      />
      {character.voice && (
        <>
          <Select
            label="Giọng mặc định"
            value={character.voice.voiceId}
            options={voices.map((v) => [v, v])}
            onChange={(v) =>
              update((c) => {
                c.voiceId = v;
              })
            }
          />
          <Field
            label="Tốc độ đọc (0.25–4)"
            type="number"
            min={0.25}
            step={0.05}
            value={character.voice.speed}
            onChange={(v) => {
              const n = Number(v);
              if (n >= 0.25 && n <= 4)
                update((c) => {
                  c.speed = n;
                });
            }}
          />
          <Field
            label="Ngôn ngữ giọng"
            value={character.voice.language}
            onChange={(v) =>
              update((c) => {
                c.language = v;
              })
            }
          />
          <small>
            Model: {character.voice.binding.modelId}. Áp dụng cho lời thoại của
            nhân vật; thay đổi đánh dấu audio liên quan cần tạo lại.
          </small>
        </>
      )}
    </section>
  );
}
function AiDialog({
  target,
  kind = "text",
  prompt = "",
  seconds = 4,
  structured = false,
  onClose,
}: {
  target: Target;
  kind?: ProviderKind;
  prompt?: string;
  seconds?: number;
  structured?: boolean;
  onClose: () => void;
}) {
  const p = useEditor((s) => s.project)!;
  const [instruction, setInstruction] = useState(kind === "text" ? "" : prompt);
  const voiceConfig = resolveVoice(p, target.id);
  const [voice, setVoice] = useState(voiceConfig.voice);
  const [duration, setDuration] = useState(seconds);
  const action = useAction();
  const binding =
    kind === "voice" ? voiceConfig.binding : p.providerBindings[kind];
  return (
    <Modal
      title={
        kind === "text"
          ? "Đề xuất chỉnh sửa bằng AI"
          : `Tạo ${kind === "image" ? "ảnh" : kind === "video" ? "video" : "giọng nói"} bằng AI`
      }
      onClose={onClose}
    >
      <div className="info-note">
        <Sparkles size={19} />
        <p>
          1 tác vụ {kind} · {binding?.modelId || "Chưa cấu hình model"}
          <br />
          Có thể phát sinh phí tại provider. Chưa có ước tính giá.
        </p>
      </div>
      <p className="muted small">
        Phạm vi: {target.kind} / {labels[target.field] || target.field}.{" "}
        {kind === "text"
          ? "Gửi story bible và trường đang chỉnh sửa; kết quả sẽ chờ bạn duyệt."
          : "Kết quả lưu thành variant; bạn chủ động chọn sử dụng."}
      </p>
      {(kind === "image" || kind === "video") && (
        <div className="notice">
          Adapter hiện chỉ gửi prompt văn bản; chưa gửi ảnh tham chiếu.
        </div>
      )}
      <Field
        label={kind === "text" ? "Yêu cầu chỉnh sửa" : "Nội dung gửi provider"}
        value={instruction}
        multiline
        onChange={setInstruction}
      />
      {kind === "video" && (
        <Select
          label="Thời lượng clip (giây)"
          value={String(duration)}
          options={["4", "8", "12"].map((x) => [x, x])}
          onChange={(v) => setDuration(Number(v))}
        />
      )}
      {kind === "voice" && (
        <>
          <Select
            label="Giọng"
            value={voice}
            options={voices.map((x) => [x, x])}
            onChange={setVoice}
          />
          <p className="muted small">
            Giọng được tạo bằng AI. Khi xuất bản, thông báo rõ điều này với
            người nghe.
          </p>
        </>
      )}
      {!binding && (
        <p className="danger">
          Chọn connection và model trong Cài đặt trước khi chạy.
        </p>
      )}
      {action.errorView}
      <div className="modal-actions">
        <Button onClick={onClose}>Hủy</Button>
        <Button
          variant="primary"
          disabled={!binding || !instruction.trim() || action.busy}
          onClick={() =>
            void action.run(async () => {
              if (kind === "voice" && voice !== voiceConfig.voice && binding) {
                useEditor.getState().edit((p) => {
                  const d = p.scenes
                    .flatMap((s) => s.dialogues)
                    .find((d) => d.id === target.id);
                  if (d)
                    d.voiceOverride = {
                      binding: structuredClone(binding),
                      voiceId: voice,
                    };
                });
              }
              const latest = await flush();
              await call(
                structured
                  ? "plan_generate"
                  : kind === "text"
                    ? "ai_edit_propose"
                    : "media_generate",
                {
                  target,
                  kind,
                  instruction,
                  prompt: instruction,
                  voice,
                  seconds: duration,
                },
                latest!,
              );
              onClose();
            })
          }
        >
          <Sparkles size={16} />
          Gửi 1 tác vụ AI
        </Button>
      </div>
    </Modal>
  );
}
type Proposal = {
  id: string;
  target: Target;
  baseValue: unknown;
  value: unknown;
  structured?: boolean;
  createdAt: string;
};
function Proposals() {
  const p = useEditor((s) => s.project)!;
  const action = useAction();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["proposals", p.id],
    queryFn: () => call<Proposal[]>("ai_edit_list", {}, p),
    refetchInterval: 3000,
    enabled: desktop,
  });
  if (!q.data?.length) return null;
  return (
    <section className="panel proposals">
      <div className="panel-title">
        <Sparkles size={17} />
        <h2>Đề xuất chờ duyệt</h2>
        <span className="count">{q.data.length}</span>
      </div>
      {q.data.map((prop) => (
        <div key={prop.id}>
          <h3>
            {prop.target.kind} ·{" "}
            {labels[prop.target.field] || prop.target.field}
          </h3>
          <div className="diff">
            <div>
              <span>TRƯỚC</span>
              <pre>
                {typeof prop.baseValue === "string"
                  ? prop.baseValue
                  : JSON.stringify(prop.baseValue, null, 2)}
              </pre>
            </div>
            <div>
              <span>ĐỀ XUẤT</span>
              <pre>
                {typeof prop.value === "string"
                  ? prop.value
                  : JSON.stringify(prop.value, null, 2)}
              </pre>
            </div>
          </div>
          <div className="row">
            <Button
              variant="primary small"
              onClick={() =>
                void action.run(async () => {
                  const latest = await flush();
                  useEditor
                    .getState()
                    .load(
                      await call<Project>(
                        "ai_edit_apply",
                        { id: prop.id },
                        latest!,
                      ),
                    );
                  await qc.invalidateQueries({ queryKey: ["proposals"] });
                })
              }
            >
              <Check size={14} />
              Áp dụng
            </Button>
            <Button
              variant="ghost small"
              onClick={() =>
                void action.run(async () => {
                  await call("ai_edit_discard", { id: prop.id }, p);
                  await qc.invalidateQueries({ queryKey: ["proposals"] });
                })
              }
            >
              Bỏ đề xuất
            </Button>
          </div>
        </div>
      ))}
      {action.errorView}
    </section>
  );
}
function Revisions({ onClose }: { onClose: () => void }) {
  const p = useEditor((s) => s.project)!;
  const action = useAction();
  const q = useQuery({
    queryKey: ["revisions", p.id, p.revision],
    queryFn: () =>
      call<{ revision: number; title: string; updatedAt: string }[]>(
        "revision_list",
        {},
        p,
      ),
  });
  return (
    <Modal title="Lịch sử phiên bản" onClose={onClose}>
      <p className="muted">
        Khôi phục tạo một revision mới; không ghi đè lịch sử cũ.
      </p>
      <div className="revision-list">
        {q.data?.map((r) => (
          <div className="summary-row" key={r.revision}>
            <div>
              <strong>Revision {r.revision}</strong>
              <small>{new Date(r.updatedAt).toLocaleString("vi-VN")}</small>
            </div>
            <Button
              onClick={() =>
                void action.run(async () => {
                  const latest = await flush();
                  useEditor
                    .getState()
                    .load(
                      await call<Project>(
                        "revision_restore",
                        { revision: r.revision },
                        latest!,
                      ),
                    );
                  onClose();
                })
              }
            >
              <RotateCcw size={14} />
              Khôi phục
            </Button>
          </div>
        ))}
      </div>
      {action.errorView}
    </Modal>
  );
}
const stateLabels: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  waiting_remote: "Provider đang xử lý",
  succeeded: "Hoàn tất",
  failed: "Thất bại",
  blocked: "Bị chặn",
  paused: "Đã tạm dừng",
  pause_requested: "Đang tạm dừng",
  cancelling: "Đang hủy",
  cancelled: "Đã hủy",
};
function JobsPanel() {
  const p = useEditor((s) => s.project);
  const [expanded, setExpanded] = useState(false);
  const action = useAction();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["jobs", p?.id],
    queryFn: () => call<Job[]>("job_list"),
    enabled: desktop,
    refetchInterval: 2000,
  });
  const jobs = q.data || [];
  const active = jobs.filter((j) =>
    [
      "queued",
      "running",
      "waiting_remote",
      "pause_requested",
      "cancelling",
    ].includes(j.state),
  );
  const previous = useRef("");
  useEffect(() => {
    const signature = jobs
      .filter((j) => j.state === "succeeded")
      .map((j) => j.id)
      .join(",");
    if (signature !== previous.current) {
      previous.current = signature;
      if (p && useEditor.getState().status === "saved")
        void call<Project>("project_get", {}, p)
          .then((latest) => {
            if (
              useEditor.getState().status === "saved" &&
              useEditor.getState().project?.id === latest.id
            )
              useEditor.getState().load(latest);
          })
          .catch(() => {});
    }
  }, [jobs, p]);
  return (
    <footer className={`jobs-panel ${expanded ? "expanded" : ""}`}>
      <button className="jobs-toggle" onClick={() => setExpanded(!expanded)}>
        <span>
          <span className={`status-dot ${active.length ? "busy" : ""}`} />
          <strong>Hàng đợi tác vụ</strong>
          <span className="count">{jobs.length}</span>
        </span>
        <span>
          {active.length
            ? `${active.length} tác vụ đang xử lý`
            : "Không có tác vụ đang chạy"}
          <ChevronRight size={15} className={expanded ? "rotated" : ""} />
        </span>
      </button>
      {expanded && (
        <div className="jobs-content">
          {!jobs.length && (
            <p className="muted">
              Render và tác vụ AI xuất hiện tại đây. Bạn có thể tiếp tục biên
              tập khi tác vụ đang chạy.
            </p>
          )}
          {jobs.map((j) => (
            <div className="job-row" key={j.id}>
              <div className="job-kind">
                {j.kind.includes("render") || j.kind === "merge_video" ? (
                  <Film size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
              </div>
              <div className="job-details">
                <strong>{j.kind.replaceAll("_", " ")}</strong>
                <small>
                  {j.progress.message}{" "}
                  {j.progress.total > 0
                    ? `${j.progress.completed}/${j.progress.total}`
                    : ""}
                </small>
                {j.error && (
                  <small className="danger">
                    {j.error.code}: {j.error.message}
                  </small>
                )}
                {j.output?.path && <small>{j.output.path}</small>}
              </div>
              <span
                className={`badge ${j.state === "succeeded" ? "success" : ""}`}
              >
                {stateLabels[j.state] || j.state}
              </span>
              <div className="row">
                {[
                  [
                    "pause",
                    "Tạm dừng",
                    Pause,
                    ["queued", "running", "waiting_remote"],
                  ],
                  ["resume", "Tiếp tục", Play, ["paused"]],
                  ["retry", "Thử lại", RotateCcw, ["failed", "blocked"]],
                  [
                    "cancel",
                    "Hủy",
                    X,
                    [
                      "queued",
                      "running",
                      "paused",
                      "waiting_remote",
                      "blocked",
                    ],
                  ],
                ].map(([cmd, label, Icon, states]) => {
                  const I = Icon as typeof Film;
                  return (
                    (states as string[]).includes(j.state) && (
                      <Button
                        key={String(cmd)}
                        variant="icon ghost"
                        title={String(label)}
                        onClick={() =>
                          void action.run(async () => {
                            await call(`job_${cmd}`, {
                              id: j.id,
                              version: j.version,
                            });
                            await qc.invalidateQueries({ queryKey: ["jobs"] });
                          })
                        }
                      >
                        <I size={15} />
                      </Button>
                    )
                  );
                })}
              </div>
            </div>
          ))}
          {action.errorView}
        </div>
      )}
    </footer>
  );
}

function Recovery({
  folder,
  onClose,
  onRecovered,
}: {
  folder: Selection;
  onClose: () => void;
  onRecovered: (p: Project) => void;
}) {
  const action = useAction();
  const q = useQuery({
    queryKey: ["recovery", folder.token],
    queryFn: () =>
      call<{ revision: number; title: string; updatedAt: string }[]>(
        "project_recovery_list",
        { token: folder.token },
      ),
  });
  return (
    <Modal title="Phục hồi dự án" onClose={onClose}>
      <div className="error">
        Snapshot hiện tại không đọc được. Bản lỗi sẽ được giữ nguyên. Chọn
        revision hợp lệ để phục hồi; thay đổi sau phiên bản này có thể bị mất.
      </div>
      {q.isError && <p className="danger">{q.error.message}</p>}
      <div className="revision-list">
        {q.data?.map((r) => (
          <div className="summary-row" key={r.revision}>
            <div>
              <strong>
                Revision {r.revision} · {r.title}
              </strong>
              <small>{new Date(r.updatedAt).toLocaleString("vi-VN")}</small>
            </div>
            <Button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () =>
                  onRecovered(
                    await call<Project>("project_recover", {
                      token: folder.token,
                      revision: r.revision,
                    }),
                  ),
                )
              }
            >
              <RotateCcw size={14} />
              Phục hồi
            </Button>
          </div>
        ))}
      </div>
      {q.data?.length === 0 && (
        <p>
          Không tìm thấy revision hợp lệ. Giữ thư mục hiện tại và khôi phục từ
          bản backup bên ngoài.
        </p>
      )}
      {action.errorView}
    </Modal>
  );
}
