# AI Video Studio

Ứng dụng desktop local-first **React + TypeScript + Tauri 2**, backend Rust riêng tại `backend/`. Giao diện tiếng Việt, dữ liệu JSON + media files. Không có tài khoản ứng dụng hoặc database service.

**Trạng thái: bản phát triển 0.1.0 chạy được; chưa nghiệm thu đầy đủ SPEC v1.** Xem [release checklist](docs/release-checklist.md) cho AC01–AC25, tính năng còn thiếu và bằng chứng test. Không có mock trong runtime desktop. Browser preview chỉ xem UI và thông báo rõ khi thiếu Tauri.

## Tải ứng dụng và mã nguồn

Trên trang GitHub của dự án:

- **Releases → Assets**: tải bộ cài đúng hệ điều hành nếu phiên bản đó đã được phát hành. `Source code (zip)` chỉ là mã nguồn, không phải bộ cài.
- **Code → Download ZIP**: tải và giải nén mã nguồn, sau đó làm theo hướng dẫn bên dưới.
- Hoặc chọn **Code → HTTPS**, sao chép URL và chạy (thay `URL_KHO_GITHUB` bằng URL vừa sao chép):

```bash
git clone URL_KHO_GITHUB ai-video-studio
cd ai-video-studio
```

Nếu dùng ZIP, mở Terminal/PowerShell ngay trong thư mục đã giải nén chứa `package.json`. Kho riêng tư yêu cầu tài khoản được cấp quyền truy cập.

| Hệ điều hành      | Cách sử dụng hiện tại                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Ubuntu 26.04 x64  | Có quy trình tạo bộ cài `.deb`; có thể chạy từ mã nguồn.                             |
| Windows 10/11 x64 | Hướng dẫn chạy thử từ mã nguồn; chưa kiểm thử và chưa có bộ cài Windows đã xác nhận. |

README không khẳng định đã có tệp đính kèm trên Releases. Nếu chưa thấy bộ cài, dùng mã nguồn theo hướng dẫn dưới đây.

## Cài đặt trên Ubuntu

### Cài bằng bộ cài `.deb`

Chỉ dùng bộ cài của dự án cho **Ubuntu 26.04 x64**. Tải tệp `.deb` và `SHA256SUMS` cùng phiên bản về một thư mục. Mở Terminal trong thư mục đó:

```bash
sha256sum --check --ignore-missing SHA256SUMS
sudo apt update
sudo apt install ./TEN_BO_CAI.deb
```

Thay `TEN_BO_CAI.deb` bằng tên tệp thực tế; chỉ cài khi kiểm tra checksum báo `OK`. Mở **AI Video Studio** từ menu ứng dụng. Bản đóng gói kèm FFmpeg/FFprobe và khai báo thư viện phụ thuộc; người dùng không cần cài Node.js hoặc Rust. Bộ cài hiện chưa ký chứng chỉ.

Gỡ ứng dụng bằng `sudo apt remove ai-video-studio`; dữ liệu dự án vẫn được giữ lại. Không dùng gói này trên Ubuntu cũ hơn vì phiên bản thư viện media có thể không tương thích.

### Chạy từ mã nguồn

1. Tải mã nguồn như mục trên.
2. Cài công cụ và thư viện hệ thống:

```bash
sudo apt update
sudo apt install -y git curl build-essential pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsecret-1-dev libdbus-1-dev ffmpeg
```

3. Cài [Node.js 22.16.0](https://nodejs.org/download/release/v22.16.0/) và [Rust qua rustup](https://rustup.rs/). Mở lại Terminal sau khi cài, rồi cài pnpm:

```bash
npm install --global pnpm@11.25.0
```

4. Trong thư mục gốc dự án, kiểm tra môi trường và chạy ứng dụng:

```bash
node --version
pnpm --version
rustup show
ffmpeg -version
ffprobe -version
pnpm install --frozen-lockfile
pnpm dev
```

Rustup đọc `rust-toolchain.toml` để sử dụng Rust **1.90.0**. Lần chạy đầu cần mạng để tải thư viện và biên dịch. Chạy trong phiên desktop có giao diện đồ họa. Linux cần keyring/Secret Service hoạt động để lưu API key lâu dài; có thể chọn chỉ lưu trong phiên.

Muốn tự tạo bộ cài trên Ubuntu 26.04 x64:

```bash
pnpm package
```

Kết quả nằm trong `target/release/bundle/deb/`, gồm `.deb` và `SHA256SUMS`.

## Cài đặt và chạy thử trên Windows

**Windows chưa được build/kiểm thử trong dự án này.** Các bước sau hướng dẫn chuẩn bị và chạy từ mã nguồn, không phải cam kết hỗ trợ một bộ cài hoàn chỉnh. Script `pnpm package` hiện chỉ dành cho Linux.

1. Cài [Git for Windows](https://git-scm.com/downloads/win) nếu tải bằng Git và [Node.js 22.16.0 x64](https://nodejs.org/download/release/v22.16.0/).
2. Cài **Build Tools for Visual Studio** với workload **Desktop development with C++** và Windows SDK; cài **Microsoft Edge WebView2 Runtime** nếu máy chưa có. Xem [yêu cầu chính thức của Tauri cho Windows](https://v2.tauri.app/start/prerequisites/#windows).
3. Cài [Rust bằng rustup](https://rustup.rs/), chọn toolchain MSVC mặc định trên Windows.
4. Tải FFmpeg cho Windows từ các liên kết tại [trang tải FFmpeg](https://ffmpeg.org/download.html), giải nén và thêm thư mục `bin` chứa **cả `ffmpeg.exe` và `ffprobe.exe`** vào biến môi trường `Path` của tài khoản. Chọn bản có encoder `libx264`, AAC và bộ lọc phụ đề `subtitles`/libass.
5. Mở cửa sổ PowerShell mới, cài pnpm:

```powershell
npm.cmd install --global pnpm@11.25.0
```

6. Tải/giải nén mã nguồn, mở PowerShell trong thư mục chứa `package.json`, rồi chạy:

```powershell
node --version
pnpm.cmd --version
rustup show
ffmpeg -version
ffprobe -version
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Dùng `pnpm.cmd` giúp tránh lỗi PowerShell chặn tệp `pnpm.ps1`. Không cần tắt chính sách bảo mật PowerShell. Nếu lệnh không được nhận diện, kiểm tra `Path` rồi mở lại terminal.

Có thể thử biên dịch bản release bằng `pnpm.cmd build`; nếu thành công, tệp thực thi nằm ở `target/release/ai-video-studio.exe`. Đây chưa phải bộ cài độc lập; máy chạy vẫn cần WebView2 và FFmpeg/FFprobe trong `Path`. Chưa có quy trình đóng gói FFmpeg hoặc kiểm thử `.msi`/NSIS cho Windows.

## Thiết lập lần đầu

- Mở ứng dụng, tạo dự án và nhập media để thử dựng video; không bắt buộc có API key khi chỉ làm việc với media có sẵn.
- Để dùng AI, vào **Cài đặt**, thêm connection và API key rồi chọn các binding cho dự án. Không ghi API key vào mã nguồn, README hoặc GitHub.
- Dữ liệu mặc định ở `~/AI-Video-Studio/` trên Ubuntu hoặc thư mục `AI-Video-Studio` trong thư mục người dùng Windows. Sao lưu cả thư mục dự án trước khi chuyển máy.

## Chạy trên máy phát triển

Node **22.16.0**, pnpm **11.25.0**, Rust **1.90.0** (toolchain pin). `Cargo.lock` và `pnpm-lock.yaml` pin dependency đã resolve.

Ubuntu 26.04 x64 (máy đã dùng để build/test):

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsecret-1-dev ffmpeg
pnpm install
pnpm dev
```

Các script root tự thêm `~/.cargo/bin` vào PATH khi gọi Rust/Tauri. Rust phải được cài qua rustup trước. FFmpeg development cần libx264/AAC, libass cho phụ đề. Linux desktop cần D-Bus/Secret Service để lưu key bền vững; nếu không có, chọn session-only.

```bash
pnpm dev                  # Desktop Tauri + Vite, không phải website thay thế app
pnpm dev:web              # Preview giao diện trên localhost:1420; không có backend mock
pnpm contracts:generate   # JSON Schema → generated TypeScript
pnpm contracts:check      # Kiểm tra generated contract không drift
pnpm check                # Contracts, TypeScript, rustfmt, clippy -D warnings
pnpm test                 # Frontend unit + Rust domain/storage/FFmpeg integration
pnpm test:e2e             # Browser UI check; khởi động pnpm dev:web trước
pnpm test:desktop         # Native WebDriver smoke; xem hướng dẫn bên dưới
pnpm build                # Frontend + Rust release binary
pnpm package              # Unsigned Ubuntu .deb, media binaries, license manifest, SHA256SUMS
```

`pnpm package` kiểm tra FFmpeg/FFprobe cài từ Ubuntu rồi đóng gói thành `studio-ffmpeg` và `studio-ffprobe`, tránh trùng tên file hệ thống. `.deb` khai báo phụ thuộc libav/WebKit/GTK; máy người dùng không cần Node, Rust hoặc cài executable FFmpeg riêng. Profile đóng gói hiện dành cho **Ubuntu 26.04 x64**; không dùng installer này cho Ubuntu cũ hơn. Windows/macOS có mã Tauri nhưng chưa build/kiểm thử/đóng gói; không được công bố supported. Certificate ký chưa được cung cấp.

Bộ cài ở `target/release/bundle/deb/`. Cài bằng `sudo apt install ./<tên-file>.deb` để apt giải quyết thư viện runtime. Gỡ gói không xóa dữ liệu dự án.

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
