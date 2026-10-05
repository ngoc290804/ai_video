# AI Video Studio

Ứng dụng máy tính bằng tiếng Việt để viết cốt truyện, quản lý nhân vật, dựng phân cảnh, ghép và xuất video. Dữ liệu dự án và media được lưu trên máy; không cần tài khoản ứng dụng hoặc cài máy chủ cơ sở dữ liệu.

**Trạng thái: bản phát triển 0.1.0 chạy được; chưa nghiệm thu đầy đủ SPEC v1.** Xem [release checklist](docs/release-checklist.md) cho AC01–AC25, tính năng còn thiếu và bằng chứng test. Không có mock trong runtime desktop. Browser preview chỉ xem UI và thông báo rõ khi thiếu Tauri.

## Cài ứng dụng: không cần môi trường lập trình

**Người dùng chỉ cần bộ cài. Không cần cài Node.js, pnpm, Rust, Git hoặc thêm FFmpeg vào biến môi trường `PATH`.** Các công cụ đó chỉ dành cho người sửa mã nguồn/tạo bộ cài.

### Tải bộ cài đã kiểm tra

Bản **0.1.0** đã được tạo và kiểm tra trong [lần chạy Build installers thành công](https://github.com/ngoc290804/ai_video/actions/runs/37261961275):

| Máy sử dụng       | Tải xuống                                                                                                        | Tệp bên trong gói ZIP                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Windows 10/11 x64 | [Tải bộ cài Windows](https://github.com/ngoc290804/ai_video/actions/runs/37261961275/artifacts/11325525264)      | `ai-video-studio_0.1.0_windows-x64_setup.exe`  |
| Ubuntu 24.04 x64  | [Tải bộ cài Ubuntu 24.04](https://github.com/ngoc290804/ai_video/actions/runs/37261961275/artifacts/11324564321) | `ai-video-studio_0.1.0_ubuntu-24.04-amd64.deb` |

1. Đăng nhập GitHub rồi chọn liên kết đúng hệ điều hành.
2. Giải nén tệp ZIP tải về; bên trong có bộ cài và `SHA256SUMS`.
3. Làm theo mục **Windows** hoặc **Ubuntu** bên dưới. Không cần tải mã nguồn.

Các artifact trên được lưu đến **04/11/2026**. Nếu liên kết hết hạn, vào [Actions → Build installers](https://github.com/ngoc290804/ai_video/actions/workflows/installers.yml) để tải artifact của lần chạy thành công mới hơn, hoặc tìm bản đã công bố tại [Releases](https://github.com/ngoc290804/ai_video/releases). **Source code (zip)** và **Code → Download ZIP** chỉ chứa mã nguồn, không phải bộ cài.

**Ubuntu 26.04:** đã có gói tạo và kiểm tra trên máy phát triển, tại `target/installers/ubuntu-26.04-amd64/ai-video-studio_0.1.0_ubuntu-26.04-amd64.deb`. Gói này chưa nằm trong hai artifact GitHub bên trên; cần lấy từ người phân phối hoặc tự tạo trên Ubuntu 26.04 theo mục dành cho người phát triển. Không dùng gói 26.04 trên Ubuntu 24.04.

Windows kèm FFmpeg/FFprobe và trình cài WebView2 ngoại tuyến; gói tải khoảng **277 MB**. Ubuntu kèm FFmpeg/FFprobe, còn apt tự tải thư viện và codec cần thiết; gói tải khoảng **8 MB**.

**Phạm vi đã kiểm tra:** Ubuntu 24.04 và Windows Server 2022 đã cài thử và xuất video H.264/AAC có phụ đề tiếng Việt bằng FFmpeg đi kèm. Ubuntu 26.04 đã kiểm tra bộ cài giải nén, media và khởi động ứng dụng. Bộ cài chưa ký chứng chỉ; giao diện Windows 10/11 và cài ngoại tuyến trên máy Windows sạch vẫn cần nghiệm thu thêm.

### Windows

1. Tải tệp `*_setup.exe` và mở bằng nhấp đúp.
2. Chọn ngôn ngữ, thư mục cài và hoàn tất trình cài đặt.
3. Mở **AI Video Studio** từ Start Menu.

Không phải tải FFmpeg, sửa `Path`, cài Visual Studio hoặc chạy lệnh. FFmpeg/FFprobe được đặt cạnh chương trình và được gọi bằng đường dẫn nội bộ. Bộ cài mặc định kèm trình cài WebView2 ngoại tuyến, nên dung lượng lớn hơn nhưng không cần tải WebView2 riêng trong lúc cài. Tính năng AI vẫn cần Internet và API key của bạn.

Gỡ qua **Settings → Apps → Installed apps → AI Video Studio → Uninstall**. Sao lưu dữ liệu dự án trước khi chuyển máy; dữ liệu nằm ngoài thư mục cài đặt.

### Ubuntu

Tải đúng bản `.deb`, mở Terminal trong thư mục tải về và chạy:

```bash
sudo apt install ./ai-video-studio_0.1.0_ubuntu-24.04-amd64.deb
```

Nếu đã nhận bộ cài riêng cho Ubuntu 26.04, dùng lệnh tương ứng:

```bash
sudo apt install ./ai-video-studio_0.1.0_ubuntu-26.04-amd64.deb
```

Sau đó mở **AI Video Studio** trong menu ứng dụng. Không cần thiết lập biến môi trường.

**Cần Internet nếu máy còn thiếu thư viện hệ thống**: apt tự tải WebKit/GTK, codec phát video và các thư viện media. `.deb` không phải gói portable dùng chung mọi bản Linux. Không dùng riêng `dpkg -i` nếu muốn hệ thống tự giải quyết phụ thuộc. Gỡ ứng dụng bằng `sudo apt remove ai-video-studio`; dữ liệu dự án vẫn được giữ.

Tùy chọn kiểm tra tệp tải về: đặt `.deb` và `SHA256SUMS` cùng thư mục rồi chạy `sha256sum --check SHA256SUMS`. Trên PowerShell, chạy `Get-FileHash .\TEN_BO_CAI.exe -Algorithm SHA256` và so sánh với `SHA256SUMS`.

### Câu hỏi thường gặp khi cài đặt

- **Có phải cài Node.js, Rust, Visual Studio hoặc FFmpeg trước không?** Không, nếu dùng bộ cài `.exe`/`.deb`. Những công cụ này chỉ cần khi chạy hoặc sửa mã nguồn.
- **Có phải thêm biến môi trường không?** Không. Ứng dụng tự tìm FFmpeg/FFprobe đi kèm và dùng thư mục dữ liệu mặc định.
- **Có cài khi không có mạng được không?** Bộ cài Windows mặc định kèm WebView2 offline. Ubuntu cần mạng nếu còn thiếu thư viện hệ thống. Tính năng AI cần mạng và API key; dựng video từ media có sẵn không cần gọi AI.
- **Tải về nhưng chỉ thấy mã nguồn?** Bạn đã chọn `Source code` hoặc `Download ZIP` ở mục Code. Hãy tải artifact bộ cài theo bảng trên và giải nén.
- **Ubuntu báo không tìm thấy gói hoặc phụ thuộc?** Kiểm tra đúng bản Ubuntu, mở Terminal tại thư mục chứa `.deb`, chạy `sudo apt update`, rồi chạy lại `sudo apt install ./TEN_BO_CAI.deb`.

## Thiết lập lần đầu

- Tạo dự án và nhập media để dựng video; chỉ làm việc với media có sẵn thì không bắt buộc có API key.
- Để dùng AI, vào **Cài đặt**, thêm connection và API key, rồi chọn các binding cho dự án. Không ghi API key vào mã nguồn hoặc GitHub.
- Dữ liệu ở `~/AI-Video-Studio/` trên Ubuntu hoặc thư mục `AI-Video-Studio` trong thư mục người dùng Windows. Không cần cấu hình biến môi trường cho vị trí mặc định.
- Ubuntu: mở khóa keyring để lưu API key lâu dài; nếu môi trường không có Secret Service, chọn chỉ lưu trong phiên.

## Dành cho người phát triển: tải và chạy mã nguồn

**Bỏ qua mục này nếu chỉ muốn cài ứng dụng.** Mã nguồn: [ngoc290804/ai_video](https://github.com/ngoc290804/ai_video).

```bash
git clone https://github.com/ngoc290804/ai_video.git
cd ai_video
```

Toolchain: Node **22.16.0**, pnpm **11.25.0**, Rust **1.90.0** qua [rustup](https://rustup.rs/). `Cargo.lock` và `pnpm-lock.yaml` cố định dependency. Cài pnpm bằng `npm install --global pnpm@11.25.0` sau khi cài [Node.js](https://nodejs.org/download/release/v22.16.0/).

Ubuntu: cài phụ thuộc build, sau đó chạy trong phiên desktop có giao diện đồ họa:

```bash
sudo apt update
sudo apt install -y build-essential pkg-config dpkg-dev libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsecret-1-dev libdbus-1-dev ffmpeg
pnpm install --frozen-lockfile
pnpm dev
```

Windows: cài Build Tools for Visual Studio với **Desktop development with C++**/Windows SDK, Rust MSVC và WebView2 theo [yêu cầu Tauri](https://v2.tauri.app/start/prerequisites/#windows). Chạy `pnpm.cmd install --frozen-lockfile`, rồi `pnpm.cmd dev`. Khi phát triển, cần FFmpeg/FFprobe trong `PATH` để thử tính năng media; bản đóng gói không có yêu cầu này. Dùng `pnpm.cmd` nếu PowerShell chặn `pnpm.ps1`.

```bash
pnpm dev                  # Desktop Tauri + Vite
pnpm dev:web              # Preview UI localhost:1420; không có backend desktop
pnpm contracts:generate   # JSON Schema → TypeScript
pnpm contracts:check      # Kiểm tra generated contract
pnpm check                # Contracts, TypeScript, rustfmt, clippy
pnpm test                 # Frontend + backend/media tests
pnpm test:e2e             # Browser UI; khởi động pnpm dev:web trước
pnpm test:desktop         # Native WebDriver smoke; xem bên dưới
pnpm build                # Biên dịch; chưa phải bộ cài có đầy đủ media tools
pnpm package              # Bộ cài .deb (Ubuntu) hoặc .exe (Windows), kèm media tools
```

## Tạo bộ cài để gửi cho người dùng

Cách tiện nhất: mở [Actions → Build installers](https://github.com/ngoc290804/ai_video/actions/workflows/installers.yml) → **Run workflow**. GitHub chuẩn bị môi trường, build Ubuntu 24.04 và Windows, thử cài gói và render bằng FFmpeg đi kèm, rồi lưu bộ cài trong Artifacts. Workflow cũng chạy khi đẩy tag `v*`; không tự công bố GitHub Release.

Hoặc chạy `pnpm package` trên Ubuntu / `pnpm.cmd package` trên Windows. Kết quả nằm ở `target/installers/<hệ-điều-hành>/`, gồm bộ cài và `SHA256SUMS`.

- Ubuntu: tự dò phụ thuộc của executable ứng dụng và FFmpeg bằng `dpkg-shlibdeps`, không ghi cứng phiên bản libav. Bộ cài có tên bản Ubuntu đã build để tránh tải nhầm.
- Windows: tự tải FFmpeg static cố định phiên bản và xác minh SHA-256 trên máy build; không sửa `PATH`. NSIS đóng gói FFmpeg/FFprobe, giấy phép và WebView2 offline. Có thể chọn bộ cài nhỏ hơn bằng `pnpm.cmd package --webview-online` (máy người dùng cần Internet nếu thiếu WebView2).
- Bản biên dịch thô từ `pnpm build` chưa đủ để phân phối: runtime release tìm `studio-ffmpeg`/`studio-ffprobe` cạnh executable. Dùng `pnpm package` để tránh thiếu các tệp này.

Chi tiết kỹ thuật và kiểm tra: [docs/packaging.md](docs/packaging.md).

## Dùng ứng dụng

1. **Tổng quan → Tạo dự án**. Ghi ý tưởng trong Cốt truyện; thêm nhân vật và ảnh tham chiếu. Tên, metadata, ảnh lưu local.
2. **Phân cảnh**: thêm chương/cảnh/shot/lời thoại; duyệt cảnh. Hoặc cấu hình Text AI và yêu cầu đề xuất chương/cảnh ở Cốt truyện. Xem diff rồi Áp dụng. AI không tự ghi đè nội dung.
3. **Thư viện → Nhập media**: backend probe, copy file vào dự án, hash SHA256. Thêm ảnh/video vào Timeline. Đối với media AI, tạo từ từng shot hoặc lời thoại; output lưu thành variant, người dùng chọn sử dụng.
4. **Timeline**: reorder, trim theo frame, cut/crossfade, âm nguồn, voice/nhạc, fade, gain, loop, subtitle cues. Voice quá slot bị chặn; điều chỉnh timeline trước render.
5. **Xuất video**: chọn kích thước/FPS/fit, kiểm tra preflight, chọn nơi lưu và render. Cho phép dùng asset stale chỉ khi đánh dấu rõ; manifest ghi override. Nguồn HDR chưa được hỗ trợ và bị chặn.
6. **Ghép video** hoạt động độc lập: thêm video, reorder, chọn profile, nơi lưu, chạy. Nguồn khác FPS/resolution/no-audio được normalize. File nguồn không bị ghi đè.
7. **Cài đặt**: thêm connection, lưu API key vào OS secret store hoặc explicit session-only, chọn bốn bindings riêng cho dự án. Test connection chỉ GET model list. Generation chỉ xảy ra khi bấm nút có thông báo số tác vụ và phí chưa ước tính.

AI integration dùng [OpenAI Docs](https://developers.openai.com/api/docs/overview). Chi tiết endpoint/model/capability trong [provider matrix](docs/providers/openai.md). Chưa chạy paid/live generation do không có credentials. Image/video adapter hiện gửi character bible dạng text, **chưa upload ảnh reference**; UI nói rõ trước chạy.

## Dữ liệu, backup và khôi phục

Mặc định `~/AI-Video-Studio/`; không ghi vào source hoặc thư mục cài đặt. `projects/<UUID>/project.json` authoritative, `assets/` là media gốc, `revisions/` giữ snapshot, `jobs/` giữ hàng đợi, `proposals/` giữ đề xuất AI. Index chỉ là cache. Có thể mở folder project đã chuyển bằng **Mở dự án**; asset dùng đường dẫn tương đối.

Mỗi commit kiểm schema/reference, expectedRevision và OS lock; ghi temp + fsync + atomic replace. History và request receipts dùng phục hồi/dedup. Undo/redo của phiên không undo hóa đơn AI. Asset xóa khỏi thư viện vẫn giữ bytes cho revision. Dọn cache chỉ xóa normalized cache khi không có active job.

Backup: đóng ứng dụng hoặc pause job rồi copy nguyên folder project. Secret không nằm trong folder đó. Xóa dự án chuyển folder vào `backups/deleted-*`, có xác nhận nhập tên. Project hỏng bị từ chối và giữ nguyên file; UI cho chọn revision hợp lệ để phục hồi khi mở folder bị hỏng. Không sửa JSON thủ công khi app đang mở. Nếu cần cứu dữ liệu, copy folder trước.

Lịch sử chưa có cơ chế quota/retention đầy đủ, nên dung lượng tăng theo số commit. Dữ liệu jobs/proposals là dữ liệu tin cậy do ứng dụng tạo, không phải định dạng để tải và tự chạy từ người lạ. Không mở job records không rõ nguồn gốc.

## Quyền riêng tư

Frontend không gọi AI, không được đọc secret, không có quyền filesystem/shell rộng. Native dialogs cấp token 15 phút; backend canonicalize và giới hạn scope. CSP không nạp script remote. Provider origin HTTPS cố định, redirect bị chặn; không hỗ trợ endpoint local tùy ý. Không log key, authorization, signed URLs hoặc raw provider errors. Session-only keys giữ trong memory và zeroize khi bỏ.

Prompt gửi provider chứa trường đang sửa và story/character context được thể hiện ở bước tạo. Prompt/job context được lưu trong project để tái dựng, không tự đưa vào diagnostics. Telemetry tắt. Chưa có tự động cập nhật/cloud sync.

## Kiểm thử desktop thật

Ubuntu: cài `webkitgtk-webdriver`, `xvfb`; `cargo install tauri-driver --version 2.0.4 --locked`. Build debug (`cargo build --workspace`), chạy Vite, sau đó:

```bash
xvfb-run -a tauri-driver --native-driver /usr/bin/WebKitWebDriver
# terminal khác
pnpm test:desktop
```

Native smoke tạo/lưu/mở/xóa một project thử có tên rõ ràng; project xóa được chuyển backups. Browser E2E không tính là desktop E2E. Chrome executable cấu hình tại `playwright.config.ts`; sửa đường dẫn nếu hệ thống khác.

Long fixture opt-in (không gọi AI):

```bash
cargo test -p studio-backend --test long_video -- --ignored --nocapture
```

Báo cáo đo đạc, giới hạn fixture, checkpoint và phần chưa kiểm chứng nằm trong `docs/`.

## Xử lý lỗi thường gặp

- `SECRET_STORE_UNAVAILABLE`: mở khóa keyring/Secret Service hoặc chọn chỉ dùng trong phiên. Không có fallback plaintext.
- `SUBMISSION_UNKNOWN`: kiểm tra dashboard provider; không tự retry. Có thể đã phát sinh phí. Nếu chắc cần tạo mới, chủ động gửi job mới.
- `REVISION_CONFLICT`: giữ nội dung đang nhập, tải lại/so sánh trước ghi. Không tự last-write-wins.
- `FFMPEG_MISSING` / `ENCODER_UNAVAILABLE`: development cần FFmpeg có libx264; bản đóng gói cần cài đúng distro dependencies.
- `DURATION_MISMATCH`: sửa trim/slot hoặc chọn target mode; strict không tự cắt cuối phim.
- `STALE_ASSET`: tạo variant mới hoặc xác nhận dùng asset cũ ở preflight.
- `DISK_FULL`: giải phóng/chọn nơi lưu khác, giữ originals và completed cache. Retry render tái dùng segment hash hợp lệ.
- Network/auth/quota: kiểm tra connection riêng; không tự chuyển provider.

## Bổ sung ngày 05/10/2026

- Phân cảnh: nhân bản chương/cảnh/shot, chuyển lên/xuống và xóa chương. Đổi thứ tự đưa cảnh về trạng thái cần duyệt; timeline giữ nguyên thứ tự đã dựng. Bản sao có ID mới, giữ media nhập ngoài; media AI cần chọn/tạo lại.
- Nhân vật: chọn connection, giọng, tốc độ và ngôn ngữ riêng. Lời thoại có cảm xúc, ghi chú phát âm; đổi giọng trong hộp tạo audio lưu thành override riêng và có nút bỏ override.
- Thư viện: **Tìm lại file gốc** phục hồi media bị mất bằng file khớp checksum. File khác nội dung cần nhập thành asset mới.
- Có thể chọn thư mục dữ liệu khác khi khởi động: `AI_VIDEO_STUDIO_DATA_ROOT=/đường/dẫn/tuyệt/đối pnpm dev`. Đây là root độc lập, không tự di chuyển dự án cũ.
