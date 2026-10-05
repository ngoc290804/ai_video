# Đóng gói và kiểm tra bộ cài

Mục tiêu: người dùng cài ứng dụng mà không cài toolchain hoặc cấu hình PATH. Đây là hướng dẫn cho người tạo bộ cài.

## Ubuntu

Chạy `pnpm package` trên bản Ubuntu mục tiêu. Script build release, dùng `dpkg-shlibdeps` quét ứng dụng và hai media executable, rồi tạo `.deb`. Phụ thuộc động được apt xử lý; codec GStreamer cho preview và keyring được khai báo trong gói. Không cài thêm công cụ build trên máy người dùng.

Kết quả: `target/installers/ubuntu-<version>-<architecture>/`. Không dùng gói build trên distro mới cho distro cũ. Workflow hiện build trên Ubuntu 24.04; máy phát triển hiện tại tạo gói 26.04. AppImage/Flatpak và bộ cài Ubuntu hoàn toàn offline chưa được triển khai.

Kiểm tra mà không cài lên máy hiện tại:

```bash
dpkg-deb -x target/installers/ubuntu-26.04-amd64/*.deb target/packaging/verify-ubuntu
dpkg-deb -f target/installers/ubuntu-26.04-amd64/*.deb Depends Recommends
apt-get -s install ./target/installers/ubuntu-26.04-amd64/*.deb
node scripts/packaging/verify-media.mjs target/packaging/verify-ubuntu/usr/bin
```

`verify-media.mjs` chỉ gọi executable trong gói, bỏ FFmpeg hệ thống khỏi PATH và render một video H.264/AAC với phụ đề tiếng Việt trong đường dẫn có khoảng trắng/Unicode. Đây là kiểm tra media, không thay thế kiểm thử UI trên máy sạch.

## Windows x64

Chạy `pnpm.cmd package` trên Windows có toolchain phát triển. Script tải bản FFmpeg static 9.0.2 từ GyanD/codexffmpeg, kiểm SHA-256 đã cố định trong `scripts/packaging/windows-media.ps1`, kiểm encoder/filter rồi đóng gói NSIS. FFmpeg/FFprobe nằm cùng thư mục executable như cơ chế tìm binary hiện có trong backend. File giấy phép, README của nhà cung cấp và manifest SHA-256 được kèm trong resources.

NSIS cài theo tài khoản hiện tại, cung cấp ngôn ngữ Việt/Anh và kèm WebView2 offline installer. Tauri mặc định liên kết static VC runtime cho executable Rust. Bộ cài chưa ký số. Không cung cấp MSI trong quy trình này.

`pnpm.cmd package --webview-online` dùng WebView2 bootstrapper tải qua Internet khi máy thiếu runtime. Không thay đổi FFmpeg đi kèm. Mặc định ưu tiên offline để giảm thao tác cài đặt.

Nếu tự cung cấp FFmpeg, chỉ dùng bộ static độc lập (không phụ thuộc DLL nằm ngoài hệ điều hành), cùng kiến trúc, có libx264/AAC/libass:

```powershell
pnpm.cmd package --media-dir "C:\media-tools\bin" --media-license "C:\media-tools\LICENSE"
```

Dùng `node scripts/packaging/verify-media.mjs "C:\thu-muc-cai-ung-dung"` sau cài để phát hiện missing DLL/codec. Cập nhật phiên bản FFmpeg phải đồng thời cập nhật URL/hash, kiểm tra license và chạy lại installer smoke.

## GitHub Actions

Workflow `Build installers` chạy thủ công hoặc khi có tag `v*`. Hai runner build riêng, cài bộ cài trên runner và chạy media smoke. Chỉ khi các bước thành công mới upload artifact, lưu 30 ngày. Artifacts cần đăng nhập GitHub để tải. Muốn phân phối lâu dài, đính kèm bộ cài đã nghiệm thu vào GitHub Release; workflow không tự publish.

Runner CI đã có nhiều thành phần hệ thống. Thành công trên runner không chứng minh cài được offline trên máy Windows sạch. Trước khi phát hành chính thức, kiểm tra thêm Windows chưa có WebView2, mở/lưu dự án, preview/render và gỡ/cài lại; kiểm tra Ubuntu desktop sạch đúng phiên bản. Không gọi AI trả phí trong installer smoke.

Tham khảo: [Windows installer/WebView2 của Tauri](https://v2.tauri.app/distribute/windows-installer/), [Debian packaging của Tauri](https://v2.tauri.app/distribute/debian/), [FFmpeg Windows builds của Gyan](https://www.gyan.dev/ffmpeg/builds/).
