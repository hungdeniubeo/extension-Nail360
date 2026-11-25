# N360 Auto Updater — macOS

Miễn phí, không cần Chrome Web Store. Dùng macOS với Perl hệ thống (JSON::PP), curl, unzip và launchd; Chrome desktop 116+. Không cần sudo, Homebrew hoặc Git.

## Cài một lần

1. Tải [install.command](https://raw.githubusercontent.com/hungdeniubeo/extension-Nail360/main/macos/install.command) (Save Link As hoặc mở rồi lưu file vào Downloads). Đọc nội dung trước khi chạy, chỉ dùng bản từ repo chính thức của bạn.
2. Mở Terminal và chạy:

```bash
/bin/bash "$HOME/Downloads/install.command"
```

3. Khi Terminal báo N360 installed, Finder mở thư mục cài ổn định và Chrome mở trang extensions. Gỡ bản N360 cũ nếu đang dùng. Bật Developer mode, Load unpacked, chọn thư mục:

```text
~/Library/Application Support/N360 Support/extension
```

Nếu hộp chọn thư mục chưa hiện, bấm Cmd+Shift+G rồi dán đường dẫn trên. Ghim N360 Support và kiểm tra quyền trên dev.nail360.info.

## Sau này

Bộ cập nhật chạy bằng LaunchAgent của tài khoản macOS, kiểm tra mỗi 300 giây khi đã đăng nhập; không kiểm tra trong lúc máy ngủ/tắt. Khi manifest có version cao hơn, tải archive qua HTTPS, kiểm tra version và phạm vi quyền, giữ một bản cũ, thay file ở cùng đường dẫn. macOS có thể gửi thông báo nếu cho phép. Side panel cố gắng đọc marker cục bộ; khi có bản mới, lưu/xuất dữ liệu A/B rồi bấm **Tải lại extension** (nếu không thấy panel, bấm Reload tại chrome://extensions). Side panel có thể đóng và dữ liệu phiên có thể mất lúc reload; mở lại và kiểm tra version. Không cần gỡ/cài lại.

Mọi bản phát hành phải tăng version trong manifest.json và được push cùng toàn bộ runtime asset trong một commit. Không tăng version cho thay đổi chỉ ở README/test. Không có code tải từ xa rồi eval trong extension. Updater không tự chạy script từ archive; chỉ lấy extension runtime assets. Quyền mới/entrypoint thay đổi sẽ bị từ chối cho tới khi người dùng xem xét và cập nhật updater. Repo public là nguồn code tin cậy; bảo vệ tài khoản và main branch, không đưa token hoặc dữ liệu salon vào repo.

## Quản lý / khắc phục

```bash
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" status
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" check
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" rollback
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" stop
```

- status: xem phiên bản trên đĩa và trạng thái LaunchAgent.
- check: yêu cầu kiểm tra ngay (nếu một lần kiểm tra khác đang chạy, thử lại sau).
- rollback: khôi phục bản trước; chặn tự tải lại version vừa rollback, tiếp tục tự cập nhật khi có version cao hơn. Sau đó bấm tải lại extension.
- stop: dừng lịch kiểm tra, giữ file extension. Chạy lại installer để bật lịch. Log: ~/Library/Application Support/N360 Support/updater.log.
- Nếu lỗi, dữ liệu phiên và quyền Chrome không được sao lưu bởi updater; chỉ sao lưu source runtime. Không xóa thư mục cài đang dùng. Nếu repo đổi private, tải không cần xác thực sẽ dừng.

Chrome thực tế trên macOS, launchd, thông báo và marker trong side panel phải được kiểm tra trên máy người dùng. Cài đặt chỉ được thực hiện khi người dùng chạy installer; repo không tự có quyền chạy trên Mac.
