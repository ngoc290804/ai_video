# AI Video Studio — Đặc tả triển khai desktop app

Phiên bản đặc tả: 1.0 • Ngày: 28/09/2026 • Ngôn ngữ giao diện mặc định: tiếng Việt.

## 1. Mục tiêu và quy tắc thực hiện dành cho Codex

Xây dựng ứng dụng desktop thực sự chạy được: React + TypeScript + Tauri, backend local riêng thư mục trong cùng repository, dữ liệu nghiệp vụ lưu bằng JSON và media lưu thành file. Người dùng tạo phim từ nội dung, nhân vật, ảnh tham chiếu; duyệt kịch bản; sinh ảnh, video, giọng nói theo cảnh; sửa riêng phần cần thay đổi; xem trước, render và ghép các video có sẵn.

Tài liệu này là hợp đồng sản phẩm và kỹ thuật. MUST/bắt buộc là điều kiện nghiệm thu; SHOULD/nên là ưu tiên nhưng được thay đổi nếu có lý do và ghi ADR. Các lựa chọn dưới đây là quyết định thiết kế cho dự án, không phải khẳng định rằng mọi AI provider có sẵn các tính năng tương ứng.

Quy tắc triển khai:

1. Tạo mã nguồn, cấu hình, schema, test, hướng dẫn và bộ cài; không kết thúc ở mockup hoặc scaffold.
2. Không dùng mock để thay thế adapter thật trong bản release. Mock chỉ dành cho test/demo và luôn gắn nhãn.
3. Không hardcode API key, model ID, giá, giới hạn thời lượng hoặc endpoint chưa xác minh.
4. Không tự tạo tác vụ AI trả phí lúc khởi động/test mặc định. Người dùng chủ động bấm tạo và thấy phạm vi, số tác vụ, ước tính nếu có.
5. Có thể phát triển từng milestone nhưng chỉ gọi “hoàn chỉnh” khi tất cả tiêu chí bắt buộc đạt; báo riêng phần chưa kiểm chứng do thiếu API key, hệ điều hành hoặc chứng chỉ ký.
6. Giữ `sources/` làm tham khảo chỉ đọc nếu repository có thư mục đồng bộ này. Không sửa tài liệu tham khảo gốc.
7. Khi có chi tiết chưa quy định, ưu tiên đơn giản, local-first, không mất dữ liệu; ghi lựa chọn vào `docs/decisions/` và tiếp tục.

## 2. Phạm vi sản phẩm

### 2.1 Bắt buộc cho bản 1

- Không đăng nhập/đăng ký, tài khoản cloud hay hệ thống billing riêng.
- Tạo, mở, đổi tên, nhân bản, lưu, phục hồi, đóng và xóa dự án có xác nhận.
- Quản lý nhiều nhân vật, nhiều ảnh tham chiếu mỗi nhân vật, metadata và voice mapping.
- Story → chapters → scenes → shots/clips; một scene có thể gồm nhiều clip ngắn.
- Nhập/sửa thủ công hoặc nhờ Text AI phân tích và tạo nội dung có cấu trúc.
- Duyệt và áp dụng chỉnh sửa AI theo trường, lời thoại, scene, chapter hoặc story.
- Cấu hình thời lượng, kích thước, FPS, tỷ lệ khung hình và chính sách fit hình.
- Tách Text, Image, Video, Voice thành bốn capability độc lập; được dùng chung provider/account nếu tương thích.
- Tạo ảnh, clip, TTS; nhập media có sẵn; draft bằng ảnh + voice; render MP4 cuối.
- Timeline dạng danh sách có thứ tự, trim, reorder, voice, nhạc nền, phụ đề, cut/crossfade cơ bản.
- Ghép video local, gồm tình huống video cũ 20 phút + video mới 10 phút.
- Autosave, undo/redo phiên làm việc, lịch sử revision, hàng đợi bền vững, retry/cancel/pause/resume.
- Secret store của hệ điều hành; cài đặt chung; đóng gói desktop và kiểm tra máy sạch.

### 2.2 Ngoài phạm vi bản 1

Không huấn luyện AI riêng, không cộng tác nhiều người, không cloud sync, không editor đa track chuyên nghiệp, không tạo/rig model 3D, không hứa lip-sync chính xác hay nhận diện nhân vật nhất quán tuyệt đối. “Hoạt hình 3D” là phong cách hình ảnh/video do provider sinh. Voice cloning, marketplace, tự đăng mạng xã hội và tự cập nhật ứng dụng để giai đoạn sau.

Video dài được ghép từ nhiều shot/cảnh, không yêu cầu provider sinh một lần 20–30 phút.

## 3. Kiến trúc đã chọn

```text
React + TypeScript + Vite
       │ Tauri invoke / events / media URL có phạm vi
Tauri 2 desktop host (frontend/src-tauri, Rust glue mỏng)
       │ gọi Rust library
backend/ (Rust: domain, application, storage, queue, providers, media)
       ├── HTTPS → Text / Image / Video / Voice APIs
       ├── OS credential store
       ├── JSON + file media trên đĩa
       └── FFmpeg / FFprobe child processes
```

Backend là Rust library crate liên kết vào tiến trình Tauri, nằm riêng `backend/`; không cần server HTTP, JVM, Node hay Python trên máy người dùng. FFmpeg/FFprobe là executable được đóng gói theo nền tảng. Công việc I/O dùng async runtime; encode, hashing và thao tác blocking không chạy trên UI thread.

Frontend chỉ làm giao diện, form, state hiển thị và gọi command. Backend là nơi duy nhất ghi dữ liệu nghiệp vụ, gọi AI, đọc secret và chạy chương trình ngoài. Không để React gọi API AI trực tiếp hoặc nhận lại API key đã lưu.

Lựa chọn thư viện: React Router cho điều hướng; TanStack Query cho server state; Zustand cho UI state/selection; React Hook Form + Zod cho form; Rust serde/serde_json cho serialization, JSON Schema cho validate, reqwest cho HTTPS, tokio cho concurrency, tracing cho log. Chọn phiên bản stable tương thích tại thời điểm triển khai và pin lockfile; không mặc định cài `latest` vào build release.

Không dùng SQLite/PostgreSQL/Redis làm database hay queue. Một process owner điều phối ghi; một project chỉ có một writer.

## 4. Cấu trúc repository

```text
ai-video-studio/
├── Cargo.toml                    # workspace backend và Tauri host
├── Cargo.lock
├── package.json                  # lệnh thống nhất từ root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── app/                  # router, layout, providers
│   │   ├── features/             # projects, characters, story, scenes, timeline...
│   │   ├── components/
│   │   ├── contracts/            # TS generated; không sửa tay
│   │   └── lib/                  # typed IPC client, errors, formatting
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── capabilities/
│       ├── binaries/             # FFmpeg/FFprobe theo target
│       └── src/                  # lifecycle, IPC bridge, asset serving
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── commands/
│   │   ├── storage/
│   │   ├── jobs/
│   │   ├── providers/{text,image,video,voice}/
│   │   ├── media/
│   │   ├── secrets/
│   │   └── lib.rs
│   └── tests/
├── contracts/                    # JSON Schema là nguồn hợp đồng chuẩn
├── tests/{fixtures,e2e}/
├── scripts/                      # build, schema generation, media checks
├── docs/{decisions,providers}/
├── .github/workflows/
├── .env.example                  # không chứa secret thực
└── README.md
```

Lệnh root phải cung cấp: `pnpm dev`, `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm package`, `pnpm contracts:generate`, `pnpm contracts:check`. README giải thích chính xác lệnh, runtime phát triển, prerequisites theo OS. Build/package root điều phối đúng frontend và Rust, không đòi người dùng đoán cwd.

## 5. Dữ liệu local và cấu trúc thư mục

Lần chạy đầu đề xuất `~/AI-Video-Studio`, cho phép chọn thư mục khác. Không dùng thư mục cài app/source làm data root. App config hệ điều hành chỉ lưu đường dẫn data root, cấu hình bootstrap và credential reference không bí mật.

```text
<data-root>/
├── config/settings.json
├── database/projects-index.json          # cache có thể dựng lại
├── database/merge-jobs/<job-id>.json
├── shared/{styles,prompts,pronunciations}/
├── projects/<project-id>/
│   ├── project.json                      # snapshot nghiệp vụ authoritative
│   ├── revisions/<revision-id>.json      # snapshot lịch sử
│   ├── jobs/<job-id>.json                 # durable queue records
│   ├── proposals/<proposal-id>.json      # đề xuất AI chưa áp dụng
│   ├── assets/
│   │   ├── characters/<character-id>/
│   │   ├── images/
│   │   ├── videos/
│   │   ├── audio/
│   │   ├── music/
│   │   └── subtitles/
│   ├── renders/{draft,final}/
│   ├── manifests/<render-id>.json
│   ├── cache/{thumbnails,proxies,normalized}/
│   ├── temp/<job-id>/
│   └── .lock
├── exports/
├── cache/merge/<job-id>/
├── backups/
└── logs/
```

Project snapshot chứa toàn bộ character/story/chapter/scene/asset registry/timeline để cập nhật nguyên tử trong một file; không tách nhiều file authoritative cần transaction liên file. Binary không nhúng base64 trong JSON. Job và proposal là record độc lập, có quy trình reconcile rõ ràng.

Asset trong project dùng đường dẫn tương đối và ID ổn định; không dùng tên nhân vật làm khóa. File nhập được copy vào project mặc định, giữ tên gốc ở metadata. Merge ngoài project có thể dùng external path do người dùng chọn; ghi size/mtime/hash và kiểm tra lại trước chạy; UI nêu rõ cần giữ file nguồn đến khi hoàn tất.

Di chuyển nguyên folder project phải mở lại được; secret không đi cùng project. Index mất hoặc hỏng phải rebuild qua scan có giới hạn. Không ghi secret vào backup, log, manifest, export hoặc project.

### 5.1 Ghi an toàn, khóa và phục hồi

- Mọi write qua repository service, validate schema trước commit.
- Ghi temp trong cùng filesystem, flush file, replace nguyên tử bằng cơ chế phù hợp OS; sync directory nơi hỗ trợ. Giữ bản snapshot hợp lệ gần nhất. Không giả định rename-over-existing giống nhau trên mọi OS.
- Dùng OS file lock, kèm metadata PID/session cho chẩn đoán; không tự chiếm khóa chỉ vì timestamp cũ. Instance thứ hai mở read-only hoặc thông báo project đang dùng.
- Mỗi mutation có `expectedRevision`; dưới mutex writer kiểm tra lại, commit `revision + 1`. Sai revision trả conflict, không last-write-wins âm thầm.
- Revision history ghi snapshot cũ trước commit mới; bản history dư sau crash được chấp nhận và có thể dọn.
- Khi khởi động: validate snapshot; nếu hỏng, giữ file lỗi, đề nghị phục hồi bản hợp lệ và nêu số thay đổi có thể mất. Không âm thầm tạo project rỗng.
- Asset output: ghi `.partial` → probe/hash → rename thành immutable asset → commit reference. Crash trước reference tạo orphan, cleanup sau grace period; không xóa asset đã được snapshot/revision/job pin.
- Migration `schemaVersion` tuần tự, tạo backup trước, validate sau, thất bại rollback; schema mới hơn app chỉ mở read-only hoặc từ chối có hướng dẫn, không downgrade ghi đè.
- Data root trên filesystem không bảo đảm lock/atomic replace phải hiện trạng thái không được hỗ trợ ghi an toàn; release kiểm thử local disk trước.

## 6. Hợp đồng dữ liệu

`contracts/*.schema.json` là nguồn chuẩn; generate TypeScript, validate Rust bằng schema và có contract test chống drift. Bật `additionalProperties: false` cho object command/domain ổn định; extension provider nằm trong trường riêng đã định nghĩa. Tất cả timestamp UTC RFC3339, ID UUID, thời gian số nguyên millisecond; timeline dùng frame nguyên. Không lưu index mảng làm reference.

Các kiểu dưới đây là cấu trúc chuẩn cần hiện thực; Codex phải tạo schema đầy đủ cho mọi type và enum, không để `any` hoặc object tùy ý trong domain.

```ts
type Id = string;
type FrameRate = { numerator: number; denominator: number };
type ProviderKind = 'text' | 'image' | 'video' | 'voice';
type Binding = { connectionId: Id; modelId: string; presetId?: Id };
type VideoSettings = {
  targetDurationMs: number;
  durationPolicy: 'target' | 'strict';
  width: number; height: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | 'custom';
  fps: FrameRate;
  fit: 'contain' | 'cover';
  backgroundColor: string;
};
type Character = {
  id: Id; name: string;
  role: 'male_lead' | 'female_lead' | 'supporting' | 'antagonist' | 'narrator' | 'custom';
  customRole?: string;
  personality: string; strengths: string; background: string;
  appearance: string; clothing: string; mannerisms: string;
  continuityNotes: string;
  referenceAssetIds: Id[]; primaryReferenceAssetId?: Id;
  voice?: { binding: Binding; voiceId: string; speed: number; language: string };
  lockedFields: string[];
};
type Dialogue = {
  id: Id; speakerId?: Id; kind: 'dialogue' | 'narration';
  text: string; emotion?: string; pronunciationNotes?: string;
  voiceOverride?: { binding: Binding; voiceId: string };
  audioAssetId?: Id;
  startFrame: number; durationFrames?: number;
};
type Shot = {
  id: Id; description: string; characterIds: Id[];
  imagePrompt: string; videoPrompt: string; negativePrompt?: string;
  camera: string; durationFrames: number;
  referenceAssetIds: Id[];
  selectedImageAssetId?: Id; selectedVideoAssetId?: Id;
};
type Scene = {
  id: Id; title: string; summary: string;
  location: string; timeOfDay: string; mood: string;
  characterIds: Id[]; continuityNotes: string;
  targetDurationMs: number;
  shots: Shot[]; dialogues: Dialogue[];
  lockedFields: string[];
  reviewStatus: 'draft' | 'approved';
};
type Chapter = { id: Id; title: string; summary: string; sceneIds: Id[] };
type Asset = {
  id: Id; kind: 'image' | 'video' | 'audio' | 'subtitle';
  relativePath: string; originalName?: string;
  mime: string; bytes: number; sha256: string; createdAt: string;
  origin: 'imported' | 'generated' | 'rendered';
  width?: number; height?: number; durationMs?: number; fps?: FrameRate;
  sampleRate?: number; channels?: number;
  provenance?: {
    jobId: Id; connectionId?: Id; modelId?: string;
    promptHash?: string; inputHash: string; providerRequestId?: string;
  };
};
type TimelineItem = {
  id: Id; sceneId?: Id; shotId?: Id; assetId: Id;
  inFrame: number; durationFrames: number;
  transitionOut: { kind: 'cut' | 'crossfade'; durationFrames: number };
  sourceAudio: 'mute' | 'keep'; sourceAudioGainDb: number;
};
type AudioTrack = {
  id: Id; assetId: Id; kind: 'voice' | 'music';
  startFrame: number; inFrame: number; durationFrames: number;
  gainDb: number; fadeInFrames: number; fadeOutFrames: number; loop: boolean;
};
type SubtitleCue = { id: Id; startFrame: number; endFrame: number; text: string };
type Project = {
  schemaVersion: number; id: Id; revision: number;
  title: string; createdAt: string; updatedAt: string; language: string;
  story: { idea: string; synopsis: string; fullContent: string;
    genre: string; audience: string; style: string; constraints: string;
    ending: string; lockedFields: string[] };
  video: VideoSettings;
  providerBindings: Record<ProviderKind, Binding | null>;
  characters: Character[]; chapters: Chapter[]; scenes: Scene[]; assets: Asset[];
  timeline: { items: TimelineItem[]; audioTracks: AudioTrack[];
    subtitles: SubtitleCue[]; subtitleMode: 'none' | 'sidecar' | 'burn_in' };
};
```

Bất biến:

- ID duy nhất; mọi reference phải tồn tại và đúng loại. Chapter order theo mảng, scene order theo `sceneIds`; scene thuộc đúng một chapter.
- `speakerId` rỗng dùng narrator mặc định. Voice language phải tương thích capability nếu biết.
- `primaryReferenceAssetId` thuộc `referenceAssetIds`; ảnh/clip/audio được probe trước khi đăng ký.
- `durationFrames > 0`; frame/time không âm; trim không vượt nguồn, trừ still image và loop audio được bật.
- `cut` có duration bằng 0; crossfade nhỏ hơn thời lượng cả hai item và không làm overlap kép vượt clip.
- `width`, `height` là số chẵn dương; ratio nhất quán trong sai số làm tròn pixel. FPS là phân số tối giản có denominator > 0.
- Không coi render status là một enum scene duy nhất: trạng thái sinh media lấy từ jobs; stale tính bằng dependency hash; review status độc lập.
- Mỗi revision giữ đủ snapshot để restore; restore tạo revision mới, không giảm revision counter.

## 7. Workflow người dùng

### 7.1 Tạo và tiếp tục dự án

Home → Tạo dự án → nhập tên, ngôn ngữ, ý tưởng, style, target duration, thông số video → chọn folder → lưu snapshot đầu → workspace. Có thể bỏ qua AI để nhập thủ công. Mở project hiển thị assets thiếu, jobs cần tiếp tục và phiên bản schema. Recent projects lưu đường dẫn, không thay thế project thật.

Duplicate tạo project ID mới, remap ID nội bộ nhất quán, copy assets, bỏ queue đang chạy và secret; không tự gọi AI. Xóa project chuyển thùng rác nơi có hỗ trợ hoặc xác nhận xóa vĩnh viễn; không xóa external file dùng để merge.

### 7.2 Nhân vật và Character Bible

Thêm/sửa/xóa nhân vật; chọn vai trò, metadata, ảnh chính/phụ và giọng. Cho kéo thả ảnh, xem preview, reorder, đổi ảnh, xóa reference. Mặc định nhận PNG/JPEG/WebP; giới hạn 20 MiB/ảnh và giới hạn decoded pixels để tránh ảnh gây cạn RAM; cấu hình giới hạn ở backend. Kiểm tra nội dung file, không chỉ extension.

Ảnh gốc immutable; tạo thumbnail đã áp dụng orientation. Preview phải đúng chiều. Khi gửi provider, encode derivative đúng kích thước/capability, loại metadata không cần thiết. Xóa nhân vật đang được scene sử dụng phải chọn thay thế hoặc bỏ reference sau khi xem số scene ảnh hưởng.

Prompt dựng hình kế thừa appearance/clothing/reference/style/continuity của nhân vật. Nếu provider không hỗ trợ ảnh tham chiếu, hiển thị hạn chế trước chạy; không giả vờ đã gửi ảnh. UI cho chỉnh từng scene và pin variant ưng ý; không hứa nhân vật luôn giống tuyệt đối.

### 7.3 Story, chapter và scene

Story editor có idea, synopsis, full content, genre, audience, style, constraints, ending. Text AI lần lượt phân tích → đề xuất outline → chia scene → chia shot → viết lời thoại/prompt. Cho duyệt tại mỗi bước và có nút chạy nhiều bước có phạm vi rõ.

Không gửi toàn bộ dự án dài vào một request. Context builder chọn story bible, nhân vật liên quan, chapter summary, scene liền kề và dữ liệu đang sửa; áp budget theo capability model. Tạo summary lưu revision/hash nguồn; invalidation khi nguồn đổi. Nếu thiếu context phải báo hoặc chia nhỏ, không âm thầm cắt nội dung trọng yếu.

UI thêm/xóa/duplicate/reorder chapter, scene, shot; edit text thủ công; chọn nhân vật; thời lượng; khóa trường; xem tổng thời lượng. Reorder đánh dấu continuity cần duyệt, không tự tạo lại media.

### 7.4 Sửa một phần bằng AI

Chọn phạm vi → nhập yêu cầu, ví dụ “Sửa lời thoại cảnh 12, giữ nguyên kết thúc” → backend chụp base revision và allowed fields → AI trả đề xuất → validate → hiển thị diff trước/sau, cảnh bị ảnh hưởng và media stale → người dùng Áp dụng hoặc Bỏ.

Proposal gồm ID, project ID, base revision, target `{kind,id,field?}`, yêu cầu, typed operations, input hash, thời gian tạo. Operation phải truy cập entity theo ID; backend ánh xạ sang field allowlist, không nhận JSON patch tùy ý xuyên project. Không chấp nhận AI sửa ID, đường dẫn, secret, cấu hình hệ thống hoặc trường bị khóa.

Base revision thay đổi thì kiểm tra target field hash: nếu không đổi có thể rebase an toàn; nếu đổi trả conflict và yêu cầu duyệt lại. Apply là một transaction, một undo unit. Proposal không tự ghi vào project và không tự gọi Image/Video/TTS sau khi áp dụng.

Dependency rules tối thiểu:

| Thay đổi | Kết quả |
|---|---|
| Lời thoại / voice | Audio tương ứng stale; subtitle và render liên quan stale |
| Image prompt / ảnh tham chiếu | Ảnh phụ thuộc stale; clip dùng ảnh đó và render stale |
| Video prompt / camera / shot duration | Clip tương ứng stale; normalized clip/render stale |
| Character appearance | Các output thực sự dùng Character Bible cũ stale |
| Reorder scene | Timeline/export stale; không bắt buộc sinh lại clip |
| Output resolution/FPS | Normalization/render stale; clip gốc giữ lại |
| Story thay đổi ngoài input media | Cảnh liên quan cần review; không đánh dấu mọi file vô điều kiện |

Stale không xóa kết quả cũ. Render mặc định chặn stale cho đến khi regenerate hoặc người dùng chủ động chọn dùng phiên bản hiện có; manifest ghi lựa chọn đó.

## 8. Thời lượng, FPS và timeline

Preset mặc định: 1920×1080, 16:9, 30/1 FPS, contain, target 60 giây. Có preset 1280×720, 1920×1080, 3840×2160; dọc hoán đổi chiều; vuông 1080×1080. FPS cung cấp 24/1, 25/1, 30/1, 30000/1001, 60/1. Tùy chỉnh output trong giới hạn codec/hardware kiểm tra thực tế.

Ba đại lượng khác nhau phải hiển thị: target duration người dùng mong muốn; planned duration theo timeline; actual duration từ probe. Không hứa đúng thời lượng chỉ bằng prompt.

Timeline dùng frame tại FPS dự án. Với FPS p/q: giây = frames × q/p; chuyển millisecond sang frame làm tròn một lần tại boundary. Khi đổi FPS, quy đổi theo thời gian, hiển thị thay đổi trim/transition và commit toàn timeline; không chỉ thay nhãn.

`finalFrames = sum(item.durationFrames) - sum(crossfade.durationFrames)`; audio/subtitle không tự kéo dài video. Không dùng số thập phân cộng dồn để tính timeline dài.

Một scene 30 giây có thể gồm nhiều shot phù hợp giới hạn Video AI. Backend chia kế hoạch, không gửi request 30 giây nếu model chỉ nhận đoạn ngắn. Độ phân giải/FPS của provider và output độc lập; upscale chỉ tăng kích thước không phục hồi chi tiết. Hiển thị thông tin này trước xuất.

Voice dài hơn slot: báo mismatch, cho chọn kéo dài shot, sửa lời thoại, tạo lại voice hoặc time-stretch trong giới hạn mặc định 0.9–1.1x; không cắt chữ âm thầm. Voice ngắn hơn: giữ khoảng nghỉ hoặc chỉnh scene. Khi kéo dài shot từ video không đủ nguồn, cần generate thêm/chọn freeze/loop được người dùng duyệt.

`target` cho phép lệch và hiển thị; `strict` yêu cầu kế hoạch đạt mục tiêu trong ±1 frame trước render, không tự cắt cuối phim. Metadata container/audio padding có sai số riêng ở phần nghiệm thu.

## 9. Provider AI và secret store

### 9.1 Connection và capability

Một connection lưu `id`, label, adapter ID, base URL đã validate, credential reference, timeout, concurrency, tùy chọn không bí mật. Binding cho từng capability chọn connection + model. Global defaults chỉ copy vào project mới; thay setting chung không đổi project cũ. Mỗi job snapshot binding và config hash, không bị đổi giữa chừng.

Adapter API nội bộ:

```ts
type Capability = {
  kind: ProviderKind; modelId: string;
  supportsReferenceImages: boolean; maxReferenceImages?: number;
  supportsNegativePrompt: boolean;
  supportedAspectRatios: string[];
  supportedDurationsMs?: number[];
  maxInputBytes?: number; maxTextCharacters?: number;
  supportsAsyncPolling: boolean; supportsCancel: boolean;
  supportsIdempotency: boolean;
};
type RemoteResult =
  | { state: 'pending'; remoteJobId: string; pollAfterMs: number }
  | { state: 'completed'; artifacts: ProviderArtifact[]; usage?: Usage }
  | { state: 'failed'; error: ProviderError };
// Các tên dưới đây là interface logic; hiện thực bằng Rust traits async.
interface ProviderAdapter {
  capabilities(modelId: string): Promise<Capability>;
  validateConfig(): Promise<ValidationResult>;
  submit(request: ProviderRequest, idempotencyKey: string): Promise<RemoteResult>;
  poll(remoteJobId: string): Promise<RemoteResult>;
  cancel(remoteJobId: string): Promise<CancelResult>;
}
```

`ProviderRequest` phải là discriminated union `text | image | video | voice`, mỗi loại có schema cụ thể: text chứa schema output/context; image chứa prompt/reference; video chứa prompt/reference/duration/ratio; voice chứa text/voice/language/options. `ProviderArtifact` chứa loại output, bytes hoặc download descriptor chỉ dùng nội bộ; `Usage` ghi đơn vị, quantity, giá/tiền tệ tùy chọn và nguồn giá; `ProviderError` ánh xạ về error envelope ở mục 13. Không chuyển URL có token về frontend/log.

Release phải có ít nhất một adapter thật hoạt động cho mỗi capability. Không cần bốn công ty khác nhau. Trước hiện thực adapter, lập `docs/providers/<adapter>.md`: tài liệu chính thức, endpoint/model được xác minh, ngày xác minh, auth, schema, rate limit, poll/cancel/idempotency, tính năng ảnh tham chiếu, ví dụ response đã redacted. Chọn dịch vụ có API video được phép sử dụng với tài khoản thực; không coi “OpenAI-compatible” là chuẩn chung cho image/video/TTS. Thiếu credential thì báo live test chưa chạy, không ghi pass giả.

Capabilities lấy từ API khi có, hoặc catalog adapter versioned được đối chiếu tài liệu. Không hiển thị model không được xác minh là hỗ trợ. Test connection ưu tiên endpoint nhẹ không phát sinh generation; nếu provider chỉ có cách test trả phí, nút và UI phải nói rõ.

### 9.2 Xử lý kết quả provider

Text JSON validate schema và references; tối đa 2 repair attempt có theo dõi usage, sau đó trả lỗi kèm bản nội dung có thể xem. Không thực thi code/lệnh do model trả về. Coi story, prompt, provider output là dữ liệu, không phải chỉ dẫn cấp quyền cho ứng dụng.

Download media streaming vào `.partial`, timeout, giới hạn byte, kiểm MIME + probe, checksum, rồi đăng ký asset. Chỉ HTTPS đến host provider/CDN được adapter cho phép; chặn loopback/private network, validate mọi redirect và bảo vệ DNS rebinding. Không hỗ trợ local model endpoint tùy ý trong bản 1. Signed URL hết hạn được refresh qua adapter nếu hỗ trợ; không tái sinh trả phí chỉ để lấy lại URL.

### 9.3 Secret

Windows dùng credential store của OS, macOS Keychain, Linux Secret Service qua adapter secret store. Config JSON chỉ lưu `credentialRef`. Nếu secret store khóa/không tồn tại, báo rõ và cho session-only key trong memory; không fallback plaintext. Không cung cấp API lấy raw secret cho frontend; chỉ `configured`, `lastValidatedAt`, nhãn/masked metadata không chứa key.

Form nhập key gửi qua IPC cho backend, xóa state sau lưu; không localStorage, telemetry hay query cache. Backend che authorization headers, signed URLs và pattern secret khỏi lỗi/log. Xóa connection đang được project/job tham chiếu phải cho xem ảnh hưởng; job cần key bị blocked cho đến khi sửa, không tự chuyển provider.

## 10. Job queue bền vững

Mỗi project có job records; merge độc lập lưu global records. Scheduler chung giới hạn tài nguyên. Job có `id`, `schemaVersion`, `kind`, `projectId?`, `target`, `state`, `dependencies`, `createdAt`, `updatedAt`, `attempt`, `maxAttempts`, `nextAttemptAt`, `idempotencyKey`, `inputRevision`, `inputHash`, `bindingSnapshot`, `remoteJobId?`, `progress`, `checkpoint`, `outputAssetIds`, `error?`, `cancelRequested`, `costEstimate?`, `actualUsage?`. Không có secret trong record.

Kinds: story_analysis, outline_generation, scene_generation, ai_edit, image_generation, video_generation, voice_generation, normalize_media, render_draft, render_final, merge_video, thumbnail, proxy.

State machine:

```text
queued → running → waiting_remote → running → succeeded
             ├→ retry_wait → queued
             ├→ failed
             ├→ blocked
             └→ cancelling → cancelled
queued → paused → queued
running → pause_requested → paused (tại checkpoint an toàn)
crash: active → interrupted → reconciliation → queued / waiting_remote / blocked
```

- Dependency thành công mới được chạy; failed/cancelled làm con `blocked` với lý do, không treo mãi.
- Mặc định tối đa Text 2, Image 2, Video 1, Voice 2, FFmpeg encode 1; giới hạn network tổng 4 và per-connection. Settings được thay, không vượt khả năng provider đã biết.
- Lưu job trước side effect; persist remote ID ngay khi nhận. Nếu crash/network timeout sau submit nhưng trước nhận ID: trạng thái `submission_unknown`, là một reason của blocked; dùng idempotency/lookup nếu provider hỗ trợ. Không tự submit lại trả phí khi không xác định lần trước có thành công.
- Idempotency cục bộ dựa trên request ID + input hash; không hứa exactly-once với API ngoài. Retry transport tối đa 5 lần cho 429/5xx/network lỗi xác định an toàn; exponential backoff full jitter 1–60 giây, tôn trọng Retry-After.
- 401/403, quota/balance, model không hỗ trợ, validation lỗi không auto retry; yêu cầu sửa cấu hình hoặc nội dung.
- Pause dừng dispatch mới. Request remote đang chạy có thể tiếp tục và phát sinh phí; UI nói rõ. Render pause thực hiện giữa segment; nếu cần dừng process thì resume encode lại segment đó.
- Cancel gọi remote cancel nếu có, terminate rồi kill process group local sau grace period; late result không được tự apply. Không hứa hoàn phí.
- Crash recovery kiểm tra output hash, remote status và lease; không chạy lại job succeeded hợp lệ. Có file output nhưng job chưa commit thì reconcile theo manifest/hash.
- Job kết thúc sau khi scene đã sửa: lưu output thành variant của input cũ; không tự chọn nó làm current output nếu input hash hiện tại khác.
- Progress gồm phase, completed/total units, percent tùy chọn, message; không giả progress chính xác cho provider không báo. Render dùng FFmpeg progress và duration kế hoạch.
- Đóng app khi có job: chọn tiếp tục mở cửa sổ / pause rồi thoát / hủy rồi thoát. Bản 1 không có daemon chạy sau khi app thoát. Khi sleep/offline chuyển trạng thái chờ phù hợp, không đánh dấu failed ngay.

## 11. FFmpeg, preview, render và merge

### 11.1 Media engine

Backend đóng gói FFmpeg + FFprobe theo OS/architecture, gọi executable bằng argv, không ghép shell command. Frontend không được cấp arbitrary shell execution. Probe metadata trước xử lý; xử lý Unicode, dấu cách và tên file chứa ký tự đặc biệt. Backend tự tạo working filenames an toàn cho concat manifest, không nhúng raw path người dùng vào filter string.

Pipeline:

```text
Chụp immutable render manifest
→ kiểm tra assets, quyền ghi, dung lượng, FFmpeg capability
→ normalize từng segment (có cache)
→ dựng hình/cut/crossfade
→ mix voice + nhạc + âm gốc theo lựa chọn
→ subtitle tùy chế độ
→ encode/mux vào file tạm
→ ffprobe kiểm tra output
→ atomic publish → cập nhật render record
```

Preset output chuẩn: MP4, H.264, yuv420p, AAC 48 kHz stereo, faststart; yêu cầu build FFmpeg thực tế có encoder tương ứng và ghi license. Không khẳng định mọi FFmpeg build đều có libx264. Software encode là đường chuẩn kiểm thử; hardware encode tùy chọn sau capability probe, fallback có thông báo.

Normalization xử lý rotation, sample aspect ratio = 1, dimensions, CFR tại FPS dự án, pixel format, timestamp bắt đầu 0, audio layout/sample rate. Nguồn không audio bổ sung silence khi pipeline yêu cầu. Contain letterbox/pillarbox hoặc cover crop theo setting, không stretch méo ảnh. HDR → SDR chỉ khi có pipeline tone mapping đã test; nếu chưa có thì chặn với lỗi unsupported, không cho output sai màu âm thầm.

Ảnh tĩnh draft được giữ theo duration, có pan/zoom tùy chọn. Clip nguồn vẫn giữ nguyên; proxy/normalized file có thể rebuild. Cache key bao gồm source SHA256, trim, settings, filtergraph, engine version, encoder params; không chỉ tên file.

Render manifest ghi project revision, selected asset IDs + hashes, timeline, audio/subtitle settings, output settings, stale overrides, FFmpeg version/build flags, hash pipeline; không secret. Sửa project trong lúc render không đổi manifest đang chạy. Cảnh không đổi được tái sử dụng cache; final mux/encode vẫn có thể phải chạy lại.

### 11.2 Audio và phụ đề

Mặc định mute âm video AI khi có voice chủ động, nhưng mỗi item có thể giữ âm nguồn. Mix voice, nhạc nền, fade và duck music khi voice hoạt động. Preset loudness mục tiêu -16 LUFS, true peak ≤ -1.5 dBTP; normalize final mix hai lượt khi cần. Không normalize từng nguồn rồi giả định mix không clipping. Dùng silence có chủ ý ở khoảng không lời, không để FFmpeg tự cắt theo audio ngắn nhất.

Subtitle từ lời thoại có timestamp TTS nếu có; nếu không, chia thời gian ước tính theo text và gắn nhãn “cần duyệt”, không gọi là word alignment chính xác. Cho sửa cue/start/end, xuất UTF-8 SRT và burn-in; bundle font hỗ trợ tiếng Việt đúng license, test shaping/dấu. Bản 1 không cần ASR bắt buộc.

### 11.3 Preview

Scene preview cho chọn variants, image/video/audio và xem prompt. Timeline preview dùng proxy đã normalize để nhất quán với final; nếu chưa có draft thì hiển thị skeleton/placeholder rõ ràng. WebView không phát được codec nguồn thì tạo proxy MP4; không đánh giá file hỏng chỉ dựa vào khả năng browser.

### 11.4 Ghép video có sẵn

Tools → Ghép video → chọn nhiều file local hoặc thêm render từ project → reorder, trim, chọn cut/crossfade → chọn profile output và nơi lưu → probe/estimate → chạy queue → preview/mở folder.

- Không cần tạo kịch bản hoặc gọi AI để merge.
- Fast concat stream-copy chỉ khi kiểm tra codec/profile/extradata, pixel format, dimensions, time base, stream layout/audio params tương thích, không trim cần frame accuracy, không filter/transition. Nếu không chắc, dùng normalize/re-encode.
- Nguồn khác FPS/resolution/audio được normalize theo profile đích; video không audio có silence; giữ đồng bộ sau concat.
- Chọn file có thể từ ổ ngoài, kiểm tra file còn tồn tại và không bị đổi. Lỗi chỉ rõ item nào; hỗ trợ relink file thiếu.
- Output không được trùng file input. File đích tồn tại phải chọn tên khác hoặc xác nhận overwrite; chỉ replace sau khi bản mới hoàn chỉnh và probe đạt.
- 20 phút + 10 phút, cut và không trim → khoảng 30 phút theo timestamp nguồn. Với crossfade tổng giảm đúng thời lượng overlap.
- Checkpoint theo segment normalize; restart không encode lại segment hợp lệ. Không tuyên bố có thể resume arbitrary MP4 encode tại byte/frame dở dang.

## 12. UI, autosave và settings

### 12.1 Bố cục

```text
┌ Project / saved state / undo-redo / draft / render ─────────────┐
│ Sidebar       │ Editor hoặc timeline          │ Inspector     │
│ Tổng quan     │                               │ Selection     │
│ Nhân vật      │ Story/chapter/scene cards      │ Properties    │
│ Cốt truyện    │ Preview + variant selector    │ AI edit       │
│ Phân cảnh     │                               │ Dependencies  │
│ Timeline      │                               │               │
│ Thư viện      ├───────────────────────────────┴───────────────┤
│ Xuất video    │ Jobs / progress / pause / retry / logs        │
│ Ghép video    │                                               │
│ Cài đặt       │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

Home: recent projects, tìm kiếm tên, tạo/mở, phục hồi, merge độc lập. Workspace có breadcrumb chapter/scene, danh sách cảnh ảo hóa, inspector theo selection; dưới 1280 px inspector thành drawer. Hỗ trợ cửa sổ tối thiểu 1024×700, bàn phím, focus rõ, label form, trạng thái không chỉ dựa màu, light/dark. UI tiếng Việt, tách i18n strings.

Scene card: title, thumbnail, target/actual duration, character chips, trạng thái từng bước, stale badge, lỗi và nút retry đúng phạm vi. Job panel không chặn tiếp tục sửa phần khác. Export page có summary, missing/stale assets, duration mismatch, destination, estimated disk và progress.

### 12.2 Autosave/undo

Debounce 800 ms sau chỉnh sửa, tối đa 5 giây giữa các commit khi người dùng gõ liên tục; serialize mutations. Hiển thị “Đang lưu”, “Đã lưu lúc…”, “Lưu thất bại” và Retry. Save indicator chỉ thành công sau backend xác nhận commit; không dựa optimistic state.

Khi chuyển project/đóng app phải flush hoặc báo chưa lưu; close bị ngăn khi chưa ghi thành công trừ người dùng chọn bỏ thay đổi. Render/sinh AI chụp bản đã flush. Khi lỗi disk full/permission giữ nội dung đang sửa trong memory và cho retry/Save As, không báo đã lưu.

Undo/redo tối thiểu 100 thay đổi gộp typing burst, tính cả apply proposal/reorder; không undo side effect remote trả phí. Undo tạo revision mới và stale được tính lại. Revision snapshots định kỳ và trước AI apply/render/migration; giữ mặc định 50 bản gần nhất cùng bản pinned bởi export/job, có quota cleanup bảo đảm references.

### 12.3 Settings

- General: ngôn ngữ, theme, data root, nơi export mặc định, autosave.
- AI connections và binding Text/Image/Video/Voice, model/voice, timeout/concurrency, test connection, secret status.
- Shared data: style presets, prompt templates versioned, pronunciation dictionary, narrator defaults.
- Media: default output profile, FFmpeg diagnostics/version, CPU/hardware preference, proxy quality.
- Storage: dung lượng assets/cache/temp, cleanup preview, retention; chỉ xóa derived cache hoặc dữ liệu hết reference.
- Privacy: telemetry mặc định tắt, diagnostics export có preview/redaction; thông báo rõ nội dung/ảnh nào sẽ gửi provider khi tạo.

Đổi data root là migration có lock: pause queue, copy + verify, switch bootstrap sau thành công, giữ root cũ cho tới khi người dùng xác nhận dọn. Không đổi một string trong khi jobs đang chạy.

## 13. Internal API/contracts

Dùng Tauri IPC typed commands. Không mở cổng localhost. Command registry tường minh; mọi input schema validate ở backend. Ví dụ envelope:

```ts
type CommandRequest<T> = {
  apiVersion: 1; requestId: Id; projectId?: Id;
  expectedRevision?: number; payload: T;
};
type ApiResult<T> =
  | { ok: true; requestId: Id; data: T; revision?: number }
  | { ok: false; requestId: Id; error: {
      code: string; message: string; retryable: boolean;
      fieldErrors?: { path: string; message: string }[];
      correlationId: Id;
    } };
type AppEvent<T> = {
  apiVersion: 1; eventId: Id; sequence: number; sessionId: Id;
  type: string; projectId?: Id; entityId?: Id; timestamp: string; payload: T;
};
```

Command catalog tối thiểu; tất cả đều có schema request/response và typed wrapper:

| Command | Payload chính | Kết quả |
|---|---|---|
| `app_bootstrap` | rỗng | settings không bí mật, recent projects, diagnostics |
| `project_create` | title, directory token, initial settings | project |
| `project_open` | selected directory token | project + recovery report |
| `project_list` | query, cursor, limit | page recent projects |
| `project_get` | rỗng | latest snapshot |
| `project_update` | allowlisted entity operations | revision + changed IDs |
| `project_duplicate` | destination token, title | new project |
| `project_close` | rỗng | closed |
| `project_delete` | project ID, confirmation token | deletion result |
| `revision_list`, `revision_restore` | cursor hoặc revision ID | history hoặc new revision |
| `asset_import` | selection token, intended kind | job ID hoặc imported assets |
| `asset_list`, `asset_remove` | filter hoặc ID + reference policy | assets hoặc impact/result |
| `asset_preview_url` | asset ID, proxy/original | scoped media URL |
| `story_generate`, `outline_generate`, `scenes_generate` | target IDs, instruction, binding override? | job ID |
| `ai_edit_propose` | target, instruction, locked fields | job ID |
| `ai_edit_get`, `ai_edit_apply`, `ai_edit_discard` | proposal ID | proposal hoặc revision |
| `media_generate` | image/video/voice, target IDs, forceNewVariant | parent job ID |
| `timeline_update` | typed operations | revision |
| `render_preflight` | draft/final, profile | issues + manifest preview + estimate |
| `render_start` | validated preflight token, destination token | job ID |
| `merge_probe` | file selection tokens | source metadata + compatible modes |
| `merge_start` | ordered inputs, trims, transitions, profile, destination | job ID |
| `job_list`, `job_get` | filters/cursor hoặc job ID | snapshot |
| `job_pause`, `job_resume`, `job_cancel`, `job_retry` | job ID | current job |
| `settings_get`, `settings_update` | rỗng hoặc typed changes | safe settings |
| `provider_list`, `provider_capabilities`, `provider_test` | connection/model | catalog/result |
| `secret_set`, `secret_delete` | credential reference + key khi set | configured status |
| `storage_inspect`, `storage_cleanup` | scope/preview token | usage/result |
| `diagnostics_export`, `reveal_in_folder` | sanitized export/path token | result |

File/directory token do native dialog hoặc drag-drop được backend xác thực cấp, có phạm vi/TTL; không coi raw string từ webview là quyền truy cập mọi file. Preflight token chứa revision/hash/destination và hết hạn khi input đổi; `render_start` validate lại.

Mutations bắt buộc expectedRevision; job controls dùng state/version riêng. Request ID dedup lưu cùng mutation gần nhất trong repository metadata nội bộ, hoặc kiểm tra input hash/job ID đối với side effects; trả lại kết quả cũ khi cùng request. Không được hứa dedup vô hạn: giữ tối thiểu 24 giờ cho mutation requests và suốt đời job cho job submission.

Events: `project.updated`, `job.created`, `job.progress`, `job.state_changed`, `asset.created`, `proposal.ready`, `storage.warning`. Subscribe trước rồi query snapshot, dùng sequence/session để phát hiện gap; events chỉ là tín hiệu, snapshot/job records là nguồn sự thật. Throttle progress tối đa 5 lần/giây/job; reconnect/query khi mất event.

Error codes tối thiểu:

| Code | Hành vi UI |
|---|---|
| `VALIDATION_FAILED` | đánh dấu field, giữ dữ liệu nhập |
| `REVISION_CONFLICT` | tải bản mới, cho so sánh/áp dụng lại |
| `PROJECT_LOCKED` | mở read-only hoặc đóng instance kia |
| `PROJECT_CORRUPT`, `MIGRATION_FAILED` | recovery với backup, giữ bản lỗi |
| `ASSET_MISSING`, `ASSET_CHANGED` | relink/import lại, nêu asset |
| `DISK_FULL`, `PERMISSION_DENIED` | retry/chọn folder, không mất form |
| `SECRET_STORE_UNAVAILABLE`, `SECRET_MISSING` | unlock/cấu hình/session-only |
| `PROVIDER_AUTH`, `PROVIDER_QUOTA` | sửa connection/balance |
| `RATE_LIMITED`, `NETWORK_UNAVAILABLE` | backoff hoặc chờ mạng |
| `PROVIDER_UNSUPPORTED`, `PROVIDER_REJECTED` | nêu khả năng thiếu/lý do đã sanitize |
| `PROVIDER_OUTPUT_INVALID` | xem response an toàn/sửa input |
| `SUBMISSION_UNKNOWN` | reconcile hoặc người dùng quyết định tạo mới |
| `FFMPEG_MISSING`, `ENCODER_UNAVAILABLE`, `RENDER_FAILED` | diagnostics và retry có phạm vi |
| `DURATION_MISMATCH`, `STALE_ASSET` | sửa kế hoạch/duyệt asset trước xuất |
| `CANCELLED` | trạng thái bình thường, không toast lỗi đỏ |

Không để frontend phụ thuộc chuỗi message; dùng code. Log structured có correlation ID/job ID, không prompt đầy đủ mặc định; debug logging phải opt-in, redacted và có retention mặc định 7 ngày.

## 14. Bảo mật và quản lý tài nguyên

- Tauri capabilities chỉ mở command/dialog/media cần thiết cho main window. Không cho remote page truy cập IPC.
- CSP chặt, không arbitrary remote scripts, không eval; escape text/Markdown từ AI, sanitize link/HTML. External URL mở browser hệ thống sau validate scheme.
- Backend canonicalize đường dẫn và kiểm tra scope; chặn `..`, symlink escape và overwrite file hệ thống. Media endpoint chỉ phục vụ asset registry được phép, có byte-range để seek, không nhận arbitrary filesystem path.
- Không cấp quyền shell/filesystem rộng cho frontend. FFmpeg nhận input local đã xác thực; giới hạn protocol và process resource phù hợp.
- Import project/JSON validate số lượng entity, độ dài text, kích thước file; không tự tải URL trong project imported. Không tự chạy script/plugin bên trong project.
- Kiểm tra free disk trước import/render và định kỳ; estimate từ bitrate/duration/temp factor, gắn nhãn ước tính. Dừng có checkpoint nếu disk thiếu; không xóa originals để lấy chỗ.
- Media xử lý streaming, không load video dài vào RAM. Danh sách scene virtualization/lazy thumbnails. Chặn tải ảnh có decoded dimensions vượt giới hạn.
- Cache cleanup chỉ khi không có active reader/job pin; orphan cleanup grace period mặc định 24 giờ.

## 15. Hiệu năng và độ tin cậy

Mục tiêu kiểm thử trên máy baseline được ghi rõ CPU/RAM/OS/SSD trong báo cáo, không coi là bảo đảm trên mọi máy:

- Mở project 200 scenes, JSON ≤ 10 MiB: editor sẵn sàng ≤ 3 giây, thumbnails tải sau.
- Đổi selection/sửa text không bị chặn bởi network/render; phản hồi UI mục tiêu dưới 100 ms với dataset fixture.
- Autosave backend snapshot thông thường mục tiêu ≤ 500 ms trên SSD; nếu chậm vẫn hiển thị đúng trạng thái.
- Test render ít nhất 30 phút và 200 clips, không tăng memory tuyến tính theo tổng bytes media. Ghi peak RAM, disk và wall time; không đặt cam kết render realtime.
- Render lỗi một segment không làm mất completed cache. Project đang render vẫn cho sửa, job dùng snapshot cố định.
- Không bảo đảm tái tạo output AI giống hệt; lưu seed nếu provider hỗ trợ, model/version/prompt hash và assets thật để tái dựng final từ nguồn đã lưu.

## 16. Tiêu chí nghiệm thu bắt buộc

| ID | Tình huống | Kết quả chấp nhận |
|---|---|---|
| AC01 | Cài trên máy sạch | mở app, tạo project, import và merge không cần môi trường dev |
| AC02 | Không có mạng/API key | CRUD, autosave, nhập media, render local/merge hoạt động; AI báo cần cấu hình |
| AC03 | Nhập 3 nhân vật, nhiều ảnh, metadata tiếng Việt | lưu/mở lại nguyên vẹn, preview đúng, references hợp lệ |
| AC04 | Story → chapter → scene → shot bằng AI | output validate, xem/duyệt được, không ghi cấu trúc lỗi |
| AC05 | AI sửa lời thoại scene 12 | diff đúng phạm vi; scene khác không bị sửa; audio liên quan stale |
| AC06 | Đổi dữ liệu khi proposal/job đang chạy | conflict hoặc variant cũ; không ghi đè edit mới |
| AC07 | Bốn bindings | thay Voice provider không thay Text/Image/Video; key không lộ trong JSON/log |
| AC08 | Sinh media thật | ít nhất một adapter thật mỗi capability được live smoke test có kiểm soát |
| AC09 | Xuất 16:9, 9:16, 1:1 và FPS phân số | ffprobe đúng dimensions/FPS, không méo; audio sync đạt test |
| AC10 | Strict duration | video track lệch kế hoạch ≤ 1 frame; container duration sai số ≤ max(100 ms, 1 frame) |
| AC11 | Voice quá dài | có lựa chọn xử lý; không cắt cuối câu âm thầm |
| AC12 | Kill app giữa autosave | snapshot cũ hoặc mới hợp lệ; không partial JSON; recovery giữ file hỏng nếu có |
| AC13 | Kill app trong submit remote | reconcile/idempotency hoặc submission_unknown; không auto double-charge |
| AC14 | Pause/restart render | tái dùng segment hợp lệ; tiến độ và trạng thái không giả |
| AC15 | Merge 20 phút + 10 phút, cut | output khoảng 30 phút theo nguồn; không overwrite nguồn; A/V lệch ≤ 100 ms ở markers |
| AC16 | Merge nguồn khác codec/FPS/resolution, một file không audio | normalize thành profile đích, không mất đoạn/đen bất ngờ |
| AC17 | FFmpeg fail/disk full/network fail | lỗi có hành động, project vẫn đọc được, retry phạm vi phù hợp |
| AC18 | Di chuyển folder project | mở lại được assets tương đối; connection thiếu được yêu cầu map lại |
| AC19 | Secret store không sẵn sàng | không ghi plaintext; session-only hoặc chặn có lý do |
| AC20 | Hai instance mở cùng project | chỉ một writer; không mất cập nhật |
| AC21 | Revision restore/undo | nội dung đúng, revision mới tăng, media references còn hợp lệ |
| AC22 | Project 200 scenes, render 30 phút | đạt phép đo mục 15; không load tất cả video vào RAM |
| AC23 | Đường dẫn Unicode/dấu cách/ký tự đặc biệt | import/render/merge thành công, không shell injection |
| AC24 | Cleanup cache và mở lại project | không mất original, selected asset, pinned revision hoặc render đã xuất |
| AC25 | Package release | kiểm thử từng OS công bố, license/checksum kèm theo, không mock/default secret |

AC08 chưa có credentials hoặc platform build chưa chạy phải ghi “chưa kiểm chứng”, không được tính hoàn tất. UI phải phân biệt fail, blocked và unsupported.

## 17. Test plan

### 17.1 Unit và property tests

- Domain validation, reference integrity, frame arithmetic FPS phân số, crossfade overlap, trim và duration policies.
- Input hashing/stale graph; cùng dependency cho cùng hash, thay field liên quan đổi hash.
- Targeted edits giữ nguyên fields/entities ngoài scope; locked fields không bị ghi.
- Atomic repository, revision conflict, undo/restore và migration fixture từng version.
- Retry classifier, backoff bounds, state transitions, dependency scheduling, unknown submission.
- Path scope, symlink/path traversal, concat/filter escaping, secret redaction.

### 17.2 Integration

- Real filesystem temp directory: concurrent writes, process kill trước/sau replace, orphan media và reconcile.
- Fake HTTP server theo từng adapter: 401/429/5xx, timeout trước/sau submit, malformed JSON, polling, cancel không hỗ trợ, URL expired, download đứt, redirect/private IP blocked.
- FFmpeg thật với fixtures tự tạo: màu/color bars, số frame, sine/beep và flash markers; kiểm ffprobe, duration, A/V sync đầu/giữa/cuối, không chỉ exit code.
- Nguồn portrait rotation, VFR, no-audio, mono/stereo, Unicode path, corrupt media; crossfade và subtitle tiếng Việt.
- Secret store abstraction unit-test và live OS-store smoke test trên từng OS; quét output/log/backup bằng secret sentinel.
- Job crash recovery: trước submit, sau remote ID, trước asset commit, sau asset commit trước job success.

### 17.3 UI/E2E

Frontend test với fixtures cho form/selection/diff/error; browser E2E có mock IPC chỉ xác minh UI, không được tính là desktop end-to-end. Desktop smoke test thực tế theo driver/tool hỗ trợ từng OS; nơi automation không hỗ trợ ghi checklist manual với bằng chứng.

Kịch bản golden: tạo project → thêm 3 nhân vật → viết story → outline/scenes → duyệt → image/video/voice → sửa một lời thoại → tạo lại đúng audio → draft → final → restart → mở lại → merge với video ngoài. Mock chạy mọi commit; live provider suite chạy opt-in với budget limit, asset nhỏ, credentials từ secret CI, không log key.

### 17.4 Release gates

Schema generation không drift; TypeScript check/lint, Rust fmt/clippy, unit/integration, FFmpeg fixtures, migration/recovery tests pass. Dependency/license audit được ghi lại. CI OS matrix build/test phù hợp; UI test mock không thay thế cài installer máy sạch. Báo cáo kết quả và các manual/live tests còn thiếu trong `docs/release-checklist.md`.

## 18. Build và đóng gói

Ưu tiên Windows x64, đồng thời thiết kế và kiểm thử release cho macOS arm64/x64 và Linux x64. Mỗi artifact chỉ công bố supported khi đã build/cài chạy trên target đó; không giả định cross-compile một lần là đủ. Pin toolchains Node/pnpm/Rust và dependency lockfiles.

- Vite bundle frontend; Tauri host link `backend` crate; đóng gói FFmpeg/FFprobe theo target triple, kèm checksum/version/license.
- Runtime máy người dùng không cần Node/Rust/FFmpeg tự cài. Installer phải xử lý WebView/runtime dependencies theo nền tảng; README nêu prerequisite Linux chính xác theo distro hỗ trợ.
- Windows: MSI hoặc NSIS; macOS: app/DMG; Linux: AppImage và/hoặc deb, chọn ít nhất một định dạng đã test cho mỗi OS công bố.
- macOS signing/notarization và Windows code signing dùng secret của release pipeline. Thiếu certificate xuất bản dev unsigned có nhãn, không mô tả như đã ký.
- Download binary dependencies trong build từ nguồn kiểm chứng và checksum pinned; không tự tải binary lạ lúc user render.
- Kiểm tra license của FFmpeg build/codec/fonts và phụ thuộc thực tế, cung cấp notices/source offer khi giấy phép yêu cầu. Không gắn nhãn LGPL chung nếu build thực tế bật GPL components.
- Build version, commit, schema version và media engine version xuất hiện trong About/diagnostics.
- Gỡ app mặc định giữ project data; không tự xóa data root. Upgrade backup/migrate dữ liệu có kiểm thử.
- Auto-update ngoài phạm vi bản 1; cập nhật bằng bộ cài mới, không cần tài khoản.

## 19. Milestones triển khai

1. **Foundation:** repository, Tauri IPC, schemas, typed client, storage atomic/locks/migrations, secrets abstraction, diagnostics và build skeleton.
2. **Local authoring:** project/characters/story/chapters/scenes/assets, autosave/undo/revisions, workspace UI; dùng được hoàn toàn offline.
3. **Media vertical slice:** import → probe → timeline → draft/final → merge → package chạy thật; hoàn thiện FFmpeg fixtures trước tích hợp AI dài.
4. **AI orchestration:** durable queue, capability registry, adapter thật từng loại, proposal/diff, dependency stale, polling/recovery và usage.
5. **Long video reliability:** segmented caching, 200 scenes/30 phút, crash recovery/disk full/concurrency, transitions/audio/subtitles.
6. **Release:** accessibility, clean-machine installers, security/license checks, live tests, hướng dẫn và demo project nhỏ.

Mỗi milestone có demo chạy được, tests và cập nhật checklist; không thay chức năng chưa làm bằng nút thành công giả. Có thể chọn thư viện UI khác nếu giữ contracts và behavior, ghi ADR. Không tự đổi JSON sang database khác hoặc Rust backend sang service network khi chưa có yêu cầu thay kiến trúc.

## 20. Danh sách bàn giao cuối

- Source đầy đủ `frontend/` + `backend/`, lockfiles và scripts root chạy được.
- Schema/versioned contracts, migrations, tests, fixtures không chứa dữ liệu/secret cá nhân.
- Adapter thật cho Text/Image/Video/Voice cùng provider compatibility matrix và ngày kiểm chứng.
- Demo project offline nhỏ; hướng dẫn cấu hình provider và cách tạo video ngắn trước khi chạy project dài.
- README development/build/install/use; troubleshooting network/key/FFmpeg/storage; privacy/data flow; backup/restore.
- Bộ cài cho platform đã kiểm thử, checksum, licenses, release checklist và known limitations.
- Báo cáo nghiệm thu AC01–AC25: pass/fail/chưa kiểm chứng, bằng chứng, lệnh test, platform; không suy diễn pass từ mã đã viết.

## 21. Nguồn kỹ thuật chính thức và cách dùng

Các nguồn dưới đây được đối chiếu khi soạn tài liệu ngày 28/09/2026. Khi triển khai, kiểm tra lại theo phiên bản đã pin. Chi tiết schema/provider endpoints và giới hạn model cần có tài liệu chính thức riêng; đặc tả này không đóng băng model thương mại hay giá dịch vụ.

- [Tauri architecture](https://v2.tauri.app/concept/architecture/): cơ sở cho desktop host Rust và WebView.
- [Tauri capabilities](https://tauri.app/security/capabilities/): cấu hình quyền cho window/webview; kiểm thử scope theo version sử dụng.
- [Tauri external binaries](https://v2.tauri.app/develop/sidecar/): đóng gói binary bên ngoài theo target; dùng cho FFmpeg/FFprobe, không có nghĩa backend bắt buộc là sidecar riêng.
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html): scale, fps, concat, audio mix, loudness và các filter của build thực tế.
- [FFmpeg documentation](https://www.ffmpeg.org/documentation.html): tra cứu CLI, ffprobe, formats/codecs và giới hạn cụ thể.

## 22. Chỉ dẫn bắt đầu triển khai

Codex đọc toàn bộ đặc tả, kiểm tra repository/AGENTS.md và môi trường trước khi sửa. Tạo checklist AC và milestone, sau đó triển khai từ foundation tới vertical slice local chạy được. Xác minh API provider thực tế trước khi viết adapter; không đoán endpoint. Giữ task scope là ứng dụng desktop local hoàn chỉnh, dữ liệu JSON, bốn capability AI độc lập, sửa có phạm vi và video dài theo nhiều cảnh. Khi thiếu credential/chứng chỉ/platform, tiếp tục những phần độc lập và báo chính xác điều kiện còn thiếu trong bàn giao; không gọi mô phỏng là chức năng production đã nghiệm thu.
